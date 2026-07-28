# Evergrove Backend & System Architecture

> **Design document — nothing here has been built.** Written 2026-07-28 against the repo at
> commit `74b5438`. `pomodoro-backend/` still contains only a `.gitignore`.
>
> Companion documents: [`../project_idea.md`](../project_idea.md) (original product plan),
> [`../product_analysis.md`](../product_analysis.md) (product critique and roadmap — this design
> assumes four of its proposals, see below),
> [`../.claude/rules/backend/backend-rules.md`](../.claude/rules/backend/backend-rules.md)
> (the governance file whose "once the stack is picked" checklist this document answers).

---

## Context

`pomodoro-frontend/` is a finished, tested React SPA that persists **everything** in
`localStorage` behind one facade (`services/storage.js`) and "authenticates" against a single
hardcoded account (`services/auth.js`). `pomodoro-backend/` has no stack chosen.

`backend-rules.md:43-49` already identifies the seam correctly: **those two modules are what a
real backend replaces.** This design keeps that seam intact, so the frontend keeps building and
testing on its own throughout — as `change-discipline.md` requires.

**Why now:** the app's central promise is permanent accumulation of lifetime points, and it
currently stores them in the most volatile client store available, with no export and no recovery.
That is not a feature gap, it is a broken promise. A backend is the fix.

### Confirmed requirements

| Decision | Answer | Consequence |
|---|---|---|
| Runtime | Unconstrained — chosen on requirements | See §5 |
| Source of truth | **Server-authoritative, online-only** | No conflict resolution, no idempotency merge, no clock-skew reconciliation |
| Scale | Public side project, low budget, one maintainer | No Redis, no broker, no microservices, no k8s |
| Schema scope | **All four** `product_analysis.md` proposals adopted | Reason capture, unlimited retention, day-streaks + freezes, estimation |
| Auth | Email + password only | No email provider, no background jobs in v1 |
| Session | **Opaque token in httpOnly cookie** | Server-side session store, instantly revocable |
| Authorization | Single user type, ownership checks only | No roles table, no permissions table |
| Build vs buy | Build a real service | Domain layer owned outright |

### Flagged, proceeding anyway

**No password reset means permanent account loss on a forgotten password**, for a product whose
entire value proposition is permanence. Mitigation is baked into this design so reset becomes a
pure addition later rather than a behavioural migration: `email_verified_at` exists nullable from
day one, and password hashing sits behind an interface.

---

## 1. What exists today

### 1.1 Data inventory (every `pomodoro.v1.*` key)

| Key | Shape | Owner |
|---|---|---|
| `users` | `[{id, firstName, lastName, email, username, createdAt}]` | `storage.js:78` |
| `session` | the profile object itself | `auth.js:104` |
| `profile` | `{firstName, lastName, username}` overrides | `auth.js:64` |
| `password` | **plaintext string** | `auth.js:87` |
| `tasks` | `[{id, title, status, createdAt, endedAt?}]` | `TimerPage.jsx` |
| `sessions` | `[{id, taskTitle, durationMs, endedAt, status}]` | `TimerPage.jsx` |
| `gamification` | `{balance, currentStreak, lifetimePoints, unlockedTitles}` | `storage.js:166` |
| `settings` | `{workMinutes, breakMinutes, theme, …customTheme/background/labels/schedule}` | `storage.js:242` |

### 1.2 Model defects that must not reach the database

1. **`sessions[].taskTitle` is a denormalised string, not a foreign key.** Renaming a task
   silently orphans its history.
2. **Sessions record `endedAt` + `durationMs` but no `startedAt`.** Time-of-day analysis, overlap
   detection, and the adopted reason-capture diagnostic are all uncomputable from this shape.
3. **Breaks are never recorded.** No `type` discriminator.
4. **Gamification is a stored aggregate with no event log.** `lifetimePoints` is a running total
   nothing can recompute — `storage.js:166-181` guards it with `Math.max` precisely because it is
   unrecoverable. One bad server write would corrupt it permanently.
5. **7-day pruning and 24h task expiry are quota workarounds** applied in `TimerPage.jsx`, not
   domain rules. Unlimited retention is adopted; they do not survive.

### 1.3 Security posture — replace wholesale, do not port

Plaintext password at `pomodoro.v1.password` (`auth.js:87`); a hardcoded credential pair in
shipped client source (`auth.js:30-33`); a session that is a plain profile object in
`localStorage`, **forgeable from devtools**, unsigned and non-expiring (`auth.js:104-113`); and
`verifyCredentials` never reading the `users` list, so registered accounts can never log in
(`auth.js:96`).

### 1.4 What the backend genuinely owns

Identity; durable cross-device storage; **authoritative point computation** (otherwise devtools is
an infinite-points cheat); **time authority** (the client clock is user-controlled); aggregation
once history outgrows the browser.

---

## 2. Architecture

### 2.1 The shape: modular monolith, pragmatically layered

**Not** Clean Architecture, **not** full Hexagonal, **not** microservices:

- **Microservices are disqualified.** One maintainer, one deployable, no independent scaling need,
  and a distributed transaction across "record session" and "award points" would be the first
  thing to build. This is the textbook case *against*.
- **Full Clean Architecture is over-ceremony here.** Entities → use-cases → interface-adapters
  with a mapper at every boundary triples the file count to buy independence from a database that
  will never be swapped. At this size that ceremony is what makes a solo project die.
- **Hexagonal ports earn their keep in exactly two places**, so they go in only there:
  `PasswordHasher` (so an algorithm change is a swap, and reset drops in cleanly) and `Clock` (so
  time-authority logic is testable without wall-clock flake).
- **DDD tactical patterns without the strategic overhead:** a genuine, pure domain layer for
  gamification. This is not aspiration — `services/gamification.js` is *already* pure,
  config-driven and side-effect free, and is the best-designed file in the repository. The backend
  should mirror that discipline rather than dissolve it into a service class.

The result: **NestJS modules as bounded contexts, layered Controller → Service → Repository inside
each, with a framework-free domain core.**

```
Controller   HTTP only. Parse, validate (Zod), map to DTO, delegate. No logic.
Service      Use-case orchestration. Owns transactions. Knows the domain, not HTTP.
Domain       Pure functions/classes. Zero Nest, zero Prisma imports. Exhaustively unit-tested.
Repository   Data access. Prisma lives here and nowhere else.
```

### 2.2 The decision that matters most: sessions are the event log

`focus_sessions` is **append-only and immutable**. `user_gamification` and `daily_rollups` are
**projections** — caches derived from it, rebuildable at any time by replay.

This directly fixes defect §1.2.4. It means a bug in the points rules is a recoverable incident
(fix the rule, replay) rather than permanent silent corruption of every user's lifetime total. A
`gamification:rebuild` CLI command is part of the deliverable, not a nice-to-have.

**Deliberately synchronous, not eventually consistent.** The projection updates inside the same
transaction as the session insert, because the client needs `+150, you unlocked The Anchor` in the
response. Async event-sourcing here would buy nothing and cost a consistency window on the most
visible interaction in the product. In-process `EventEmitter2` is reserved for genuine side
effects later (notifications, digests) — not for this.

### 2.3 Module layout

```
pomodoro-backend/
├─ src/
│  ├─ main.ts                     bootstrap: helmet, cookie parser, CORS, global pipes/filters
│  ├─ app.module.ts
│  ├─ core/                       cross-cutting, no business logic
│  │  ├─ config/                  env schema (Zod-validated at boot — fail fast)
│  │  ├─ logging/                 Pino, request-id correlation, redaction
│  │  ├─ errors/                  domain error base + global exception filter (RFC 9457)
│  │  ├─ validation/              ZodValidationPipe
│  │  └─ clock/                   Clock port + system adapter
│  ├─ database/
│  │  ├─ prisma.service.ts
│  │  └─ migrations/              Prisma Migrate
│  ├─ auth/
│  │  ├─ auth.controller.ts       register, login, logout, logout-all, me, change-password
│  │  ├─ auth.service.ts
│  │  ├─ session.repository.ts    auth_sessions
│  │  ├─ hashing/                 PasswordHasher port + Argon2id adapter
│  │  ├─ guards/                  SessionGuard (populates request.user)
│  │  └─ dto/
│  ├─ users/                      profile, settings, timezone
│  ├─ tasks/                      task CRUD + estimation
│  ├─ sessions/                   focus_sessions recording  ← the write hot path
│  ├─ gamification/
│  │  ├─ domain/                  PURE: points.ts, titles.ts, streak.ts  (no Nest, no Prisma)
│  │  ├─ gamification.service.ts  projection updates, rebuild
│  │  └─ gamification.controller.ts
│  └─ stats/                      read-model aggregation (summary, timeline, outcomes)
├─ test/                          e2e (Supertest)
├─ prisma/schema.prisma
├─ Dockerfile
├─ .env.example
└─ package.json
```

**Boundary rule to record in `backend-rules.md`:** `gamification/domain/**` may import nothing
from `@nestjs/*` or `@prisma/client`. Enforce with an ESLint `no-restricted-imports` rule so it is
checked, not merely intended.

### 2.4 Patterns — used, and deliberately not used

**Used:** Dependency Injection (Nest-native); Service Layer; Repository (thin, one per aggregate —
*not* one per table ceremonially); DTO with Zod schemas as the single source of truth for both
validation and TypeScript types; Ports & Adapters for `PasswordHasher` and `Clock` only.

**Deliberately not used, and why:** *Factory* — nothing here has construction complexity worth
abstracting. *Strategy for points rules* — there is exactly one rule set; a strategy interface
with one implementation is a lie about the future. *CQRS* — the read and write models do differ,
but `daily_rollups` handles that with a table, not a framework. *Unit of Work* — Prisma's
interactive transactions already are one. *Async event sourcing* — see §2.2.

Each is trivially addable the day a second case appears. None is addable for free once wrongly
imposed.

### 2.5 API design

**REST, versioned at `/api/v1`.** GraphQL is rejected on requirements: one known first-party
client, a small fixed resource set, and no over-fetching problem to solve. In exchange it would
cost per-field authorization, query-complexity limiting, and N+1 management — three ongoing
burdens for one maintainer, buying flexibility nobody is asking for.

```
POST   /api/v1/auth/register          → sets session cookie
POST   /api/v1/auth/login             → sets session cookie
POST   /api/v1/auth/logout
POST   /api/v1/auth/logout-all        multi-device revocation
GET    /api/v1/auth/me
POST   /api/v1/auth/change-password   requires current password; revokes other sessions

GET    /api/v1/me                     profile
PATCH  /api/v1/me                     firstName, lastName, username, timezone
GET    /api/v1/me/settings
PUT    /api/v1/me/settings

GET    /api/v1/tasks?status=&cursor=&limit=
POST   /api/v1/tasks                  { title, estimatedPomodoros? }
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id

POST   /api/v1/sessions               record one interval  ← see contract below
GET    /api/v1/sessions?from=&to=&cursor=&limit=

GET    /api/v1/gamification           balance, lifetime, titles, day streak, freezes
GET    /api/v1/stats/summary?from=&to=
GET    /api/v1/stats/timeline?interval=daily|weekly|monthly&from=&to=
GET    /api/v1/stats/outcomes?from=&to=
```

**The contract that matters.** `POST /sessions` is the only endpoint with real domain weight:

```jsonc
// request
{ "taskId": "…", "type": "focus", "status": "terminated",
  "startedAt": "…", "endedAt": "…", "plannedDurationMs": 1500000,
  "terminationReason": "interrupted" }

// response — the client computes NOTHING
{ "session": { "id": "…", "actualDurationMs": 412000, … },
  "gamification": { "balance": 1250, "lifetimePoints": 4150,
                    "currentDayStreak": 6, "pointsDelta": 0,
                    "unlockedTitles": ["catalyst"] } }
```

Returning the resulting gamification state inline is what makes server-authoritative points
tolerable — one round trip, no refetch, no client-side duplicate of the rules.

**Errors: RFC 9457 Problem Details**, one global exception filter, never a raw stack to the
client. `{ type, title, status, detail, instance, errors[] }` for field-level validation.

**Docs:** `@nestjs/swagger` at `/api/docs`, generated from the Zod schemas so the spec cannot
drift from the validation.

### 2.6 Time authority

The client clock is user-controlled, so points cannot trust it. On every `POST /sessions` the
server: rejects `endedAt` in the future or `startedAt` more than a few hours old; rejects
`actualDuration > plannedDuration` or `> 4h`; rejects an interval overlapping an existing session
for that user; and computes points from the **server-clamped** duration only.

Even online-only, a double-tap or a retry can double-record — so a unique index on
`(user_id, started_at)` provides idempotency for free, without an idempotency-key mechanism.

---

## 3. Database

### 3.1 PostgreSQL — decided on requirements, not familiarity

- The data is **inherently relational**: user → tasks → focus_sessions. Defect §1.2.1 exists
  precisely *because* the current store has no foreign keys. Choosing a document store would
  re-import that bug by design.
- The core read pattern is **time-bucketed aggregation with grouping** — SQL's home ground.
- Recording a session must atomically insert an event *and* update two projections. That is a
  **multi-row ACID transaction**, the thing document stores make awkward.
- Day-streak computation is textbook **gaps-and-islands**, solvable in a single window-function
  query. Nothing else on the shortlist does that.
- Postgres specifically: `date_trunc(… AT TIME ZONE …)` for per-user local-day bucketing, partial
  indexes, CHECK constraints, `citext` for case-insensitive email/username (the current code
  hand-rolls `.toLowerCase()` in four places), and JSONB for the settings blob that genuinely *is*
  schemaless.

**Naming trap to resolve up front:** "session" currently means two different things. Use
**`focus_sessions`** for pomodoro intervals and **`auth_sessions`** for logins. Never `sessions`.

### 3.2 Schema

```sql
users (
  id uuid PK, email citext UNIQUE NOT NULL, username citext UNIQUE NOT NULL,
  first_name text NOT NULL, last_name text NOT NULL,
  password_hash text NOT NULL,
  email_verified_at timestamptz NULL,        -- present from day one; unused in v1
  timezone text NOT NULL DEFAULT 'UTC',      -- REQUIRED by day-streaks
  created_at, updated_at timestamptz
)

auth_sessions (
  id uuid PK, user_id uuid FK→users ON DELETE CASCADE,
  token_hash bytea UNIQUE NOT NULL,          -- SHA-256 of the cookie value, never the value
  expires_at timestamptz NOT NULL, last_seen_at timestamptz,
  user_agent text, ip inet, created_at timestamptz
)

tasks (
  id uuid PK, user_id uuid FK→users ON DELETE CASCADE,
  title text NOT NULL,
  status text CHECK (status IN ('todo','completed','abandoned')),
  estimated_pomodoros smallint NULL,         -- estimation calibration
  created_at, completed_at NULL, updated_at
)                                            -- 'expired' is gone; no 24h expiry

focus_sessions (                             -- APPEND-ONLY. The event log.
  id uuid PK, user_id uuid FK→users ON DELETE CASCADE,
  task_id uuid FK→tasks ON DELETE SET NULL,
  task_title_snapshot text NOT NULL,         -- history survives task deletion
  type text CHECK (type IN ('focus','break')),
  status text CHECK (status IN ('completed','terminated')),
  started_at timestamptz NOT NULL, ended_at timestamptz NOT NULL,
  planned_duration_ms integer NOT NULL, actual_duration_ms integer NOT NULL,
  termination_reason text NULL CHECK (termination_reason IN
      ('interrupted','wrong_task','finished_early','out_of_energy')),
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz,
  CHECK (termination_reason IS NULL OR status = 'terminated'),
  CHECK (ended_at > started_at),
  UNIQUE (user_id, started_at)               -- free idempotency
)

user_gamification (                          -- PROJECTION. Rebuildable.
  user_id uuid PK FK→users ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  current_day_streak, longest_day_streak integer NOT NULL DEFAULT 0,
  last_active_date date NULL, streak_freezes_available smallint NOT NULL DEFAULT 1,
  unlocked_titles text[] NOT NULL DEFAULT '{}', updated_at
)

daily_rollups (                              -- PROJECTION. Also the cache. See §5.
  user_id uuid FK→users ON DELETE CASCADE, day date NOT NULL,   -- user-local day
  focus_ms integer, completed_count, terminated_count, points_earned integer,
  PRIMARY KEY (user_id, day)
)

user_settings (
  user_id uuid PK FK→users ON DELETE CASCADE,
  work_minutes smallint NOT NULL DEFAULT 25, break_minutes smallint NOT NULL DEFAULT 5,
  theme text NOT NULL DEFAULT 'system',
  preferences jsonb NOT NULL DEFAULT '{}'    -- customTheme, background, labels, schedule
)
```

**Indexes:** `focus_sessions(user_id, started_at DESC)` — the dominant query;
`focus_sessions(user_id, task_id)`; partial `tasks(user_id, created_at DESC) WHERE status='todo'`
— the Timer page's only task read; `auth_sessions(token_hash)` unique; `auth_sessions(expires_at)`
for sweeping; `daily_rollups(user_id, day DESC)`.

**Growth:** a committed user produces roughly 4 000 focus_sessions a year — about 500 KB. Ten
thousand such users is ~5 GB. **Postgres does not care.** No partitioning, no sharding, no
time-series store. Revisit only if a single user ever exceeds ~1 M rows, which this product cannot
generate.

**Consistency:** recording a session runs one `READ COMMITTED` transaction with
`SELECT … FOR UPDATE` on that user's `user_gamification` row. Contention is per-user and
effectively zero; serializable isolation would buy nothing and cost retries.

**Timezone correctness:** rollup day = `date_trunc('day', started_at AT TIME ZONE users.timezone)`.
This is exactly why adopting day-streaks made `users.timezone` mandatory — a UTC-bucketed streak
breaks for anyone west of Greenwich who focuses in the evening.

---

## 4. Security

- **Hashing:** Argon2id via `@node-rs/argon2` (no native build pain on Windows), OWASP parameters
  m=19 MiB, t=2, p=1. Behind the `PasswordHasher` port.
- **Session token:** 32 random bytes, base64url. Stored **SHA-256-hashed** in `auth_sessions`, so
  a database leak does not hand over live sessions. Sliding expiry, 30-day absolute cap.
- **Cookie:** `HttpOnly; Secure; SameSite=Lax; Path=/`.
- **The deployment trap this creates — solve it now, not later.** The frontend is on Netlify and
  the API will be on a different host, which makes the cookie **cross-site**, and `SameSite=Lax`
  cookies are not sent cross-site. The tempting fix (`SameSite=None`) weakens CSRF posture and
  forces a token scheme. **Do this instead:** add a Netlify rewrite `/api/*` →
  `https://<api-host>/api/:splat` to the existing `netlify.toml`. The cookie becomes first-party,
  `SameSite=Lax` works, CORS largely disappears, and no CSRF token is needed.
- **Rate limiting:** `@nestjs/throttler` — 5 attempts / 15 min per IP+email on login and register,
  plus a global ceiling.
- **Also:** helmet; strict CORS allowlist as defence in depth; body size limit; generic
  `Invalid credentials` (no user enumeration on login); password change revokes every other
  `auth_session`; env validated by Zod at boot so a missing secret fails startup rather than
  request 4 000; `.env` git-ignored with a committed `.env.example`.

**Known accepted gaps** (scope decisions, recorded rather than hidden): registration inherently
enumerates existing emails; no reset means permanent lockout; unverified emails mean the address
is not trustworthy for any future purpose.

---

## 5. Stack selection

Assessed against *these* requirements — low budget, one maintainer, modest domain logic, heavy
time-bucketed aggregation, a JS-native frontend, and a hosting tier that scales to zero.

| | Spring Boot | **NestJS + TS** | FastAPI |
|---|---|---|---|
| Idle memory | 250–400 MB | **~70 MB** | ~60 MB |
| Cold start (scale-to-zero) | 3–8 s | **~1 s** | ~0.8 s |
| Security defaults | Best (Spring Security) | Good (explicit) | Weakest (DIY) |
| Imposed structure | Strong | **Strong (modules + DI)** | None — drifts solo |
| Context switch from this repo | High | **None (same language)** | Moderate |
| Compile-time contract safety | Yes | **Yes** | Partial (runtime only) |

**Recommendation: NestJS + TypeScript on Node 22.**

- **Spring Boot loses on the budget, not on quality.** A 250–400 MB idle footprint and
  multi-second cold starts are a poor fit for a free-tier container that sleeps. Its security
  story is the best of the three, but that advantage is largely neutralised here because this
  design needs only password hashing plus opaque cookie sessions — a few hundred lines either way.
- **FastAPI loses on structure, not on speed.** It is the fastest to write, and if the product
  chases the analytics/diagnostic direction hard it becomes the better long-term answer. But it
  imposes nothing: a solo, unsupervised project in FastAPI drifts toward a folder of route files.
  NestJS's opinionated modules and DI are guardrails, and guardrails are worth more than velocity
  when there is no second reviewer.
- **NestJS wins on the thing that is actually scarce here: maintainer attention.** One language
  across both packages, one mental model, one debugger. `change-discipline.md` forbids literally
  sharing source across the package boundary, so this is a shared *model*, not shared code — which
  is the honest version of the claim.
- **TypeScript is the real upgrade.** The frontend is locked to plain JS by
  `locked_decisions.md`, and `backend-rules.md:24-26` explicitly says that does not carry over.
  API contracts and database rows are exactly where static types pay for themselves.

**Supporting choices:**

| Concern | Choice | Reasoning |
|---|---|---|
| ORM | **Prisma 6** + raw SQL for analytics | Best-in-class migrations; the schema file doubles as documentation. Aggregations use `$queryRaw` — honest, since `date_trunc`/window functions are beyond any ORM worth using. *Alternative if you want to stay closer to SQL: Drizzle.* |
| Validation | **Zod** + custom pipe | One schema yields validation *and* the TS type *and* the OpenAPI entry. class-validator needs the shape declared twice. |
| Tests | **Vitest** | Same runner as the frontend, so the existing `test-runner` agent needs no new command shape. |
| Logging | **Pino** | Structured JSON, request-id correlation, cookie/password redaction. |
| Errors | Sentry free tier | Actually gets looked at, unlike a self-hosted dashboard. |
| Host (API) | **Fly.io** or Render, one Docker container | Scale-to-zero suits ~1 s Node cold start. |
| Host (DB) | **Neon** Postgres | Generous free tier, scale-to-zero, branch-per-preview. |
| Host (web) | Netlify (already configured) | Plus the `/api/*` rewrite from §4. |
| CI | GitHub Actions | Lint → unit → integration (service-container Postgres) → build. |

### Explicitly not adopted yet

- **No Redis, no caching layer.** At low thousands of users, correct indexes plus `daily_rollups`
  make every read fast. `daily_rollups` **is** the cache — a table you already need, rather than a
  second stateful service on a budget with no room for one. Add Redis when a measured query is
  actually slow, not before.
- **No job queue, no worker.** Nothing in the adopted scope requires background work. The one
  recurring chore — sweeping expired `auth_sessions` — is a `DELETE` on a cron trigger. When jobs
  do arrive (reset emails, reminders), reach for **`pg-boss`** first: it stores jobs in the
  Postgres you already run, adding zero infrastructure.
- **No API gateway, no service mesh, no message broker, no separate analytics store.**

---

## 6. Frontend migration

Contract-first, exactly as `backend-rules.md:43-49` prescribes: **keep the exported signatures of
`services/storage.js` and `services/auth.js` and replace their bodies with `fetch` calls.** The
pages, hooks, and components do not change, so the frontend keeps building and testing on its own
throughout.

Consequences to handle in that swap: every reader becomes async, so pages need the loading/error
states `general-coding.md` already requires; `services/gamification.js` stops being the authority
and becomes display-only formatting over server values; and a **one-time import** must offer to
upload existing `localStorage` data on first login, or early users lose the progress this whole
exercise exists to protect.

---

## 7. Delivery phases

Each phase ends green and committable per `github.md` — no phase leaves the build broken.

- **Phase 0 — Contract.** OpenAPI spec + fill in `backend-rules.md`'s "once the stack is picked"
  checklist. No code. This is what keeps the two packages safely independent.
- **Phase 1 — Skeleton.** Nest app, Zod-validated config, Prisma + Postgres, health endpoints,
  global error filter, Pino, Dockerfile, CI.
- **Phase 2 — Auth.** Register, login, logout, logout-all, me, change-password. Argon2id, opaque
  cookie sessions, throttler. **E2E covering register → login → authorised read**, which is
  precisely the join the frontend suite never asserted.
- **Phase 3 — Core domain.** Tasks, focus_sessions, settings. The transactional recording path and
  the time-authority validation.
- **Phase 4 — Gamification & stats.** Pure domain layer, projection updates, `rebuild` command,
  rollups, aggregation endpoints.
- **Phase 5 — Frontend swap.** Rewrite the two service internals, add the Netlify `/api/*`
  rewrite, ship the localStorage import.
- **Phase 6 — Hardening.** Rate-limit tuning, Sentry, automated DB backups, a load sanity check.

---

## 8. Testing strategy

- **Unit — the pure domain.** `gamification/domain/**` exhaustively: point awards, streak
  advancement across timezone boundaries, title crossing, freeze consumption. Fast, no I/O. This
  is the layer that must never be wrong.
- **Integration — services against real Postgres.** Docker Compose test database with a schema per
  test file (Testcontainers is heavy on Windows). Covers transaction correctness, constraint
  violations, and the aggregation SQL — none of which a mock can verify.
- **E2E — Supertest against the full app.** Auth flows, cookie handling, ownership enforcement
  (user A cannot read user B's sessions), and the `POST /sessions` contract shape.
- **Explicit anti-regression:** the frontend suite passes today while sign-up → login is broken,
  because it asserts each half separately and never the join. Every flow here gets one end-to-end
  test that crosses the seam.

---

## 9. Verification

From `pomodoro-backend/`:

1. `npm run lint && npm test && npm run build` green at every phase.
2. `docker compose up` then `npx prisma migrate deploy` — schema applies to an empty database.
3. **Auth:** register → cookie set, `HttpOnly`+`Secure`+`SameSite=Lax` present, body contains no
   token → logout → the same cookie is rejected → login again succeeds.
4. **Ownership:** user A's cookie requesting user B's task id returns 404 (not 403 — no existence
   leak). Assert for every resource route.
5. **Time authority:** post a session with `endedAt` in the future → rejected. Post one claiming
   8 h → rejected. Post the identical `startedAt` twice → second rejected by the unique index.
6. **Projection integrity:** record 20 sessions across 3 days, snapshot `user_gamification`, run
   `gamification:rebuild`, assert the row is byte-identical. *This is the test that justifies the
   entire event-log design — if it does not pass, the projection is not actually derivable.*
7. **Timezone:** the same session data with `timezone='Pacific/Auckland'` vs `'UTC'` produces
   different day buckets and different streaks. Confirms the rollup is user-local.
8. **Rate limiting:** 6 failed logins in a minute → the 6th returns 429.
9. **Full-stack:** with the Netlify rewrite live, sign up in the browser → record a session →
   refresh → history persists → log in from a second browser → the same data appears.
10. Frontend stays green independently — `npm run lint && npm test && npm run build` from
    `pomodoro-frontend/` throughout Phase 5.
