import { Link } from 'react-router-dom';
import { actionMeta } from '../../services/adminAudit.js';

/*
 * AdminAuditEventCard — one row of the audit record.
 *
 * A CARD, NOT A TABLE ROW, for the reason AdminUserCard gives and one more. An event carries seven
 * drawn fields, three of which (the reason, an address, the request id) have no width they can be
 * held to; seven columns are unreadable below a tablet, and the usual repair — a table on wide
 * screens and a stacked list on narrow ones — is two components rendering the same audit entry,
 * which is precisely how two surfaces come to disagree about what the record says. A card reflows on
 * its own at every width, so there is one markup for all of them.
 *
 * IT DRAWS LESS THAN THE API RETURNS, DELIBERATELY. `ip` and `userAgent` are recorded on every row
 * and are still in the response — nothing about the data model or the endpoint changed — but neither
 * is read while scanning a feed, and a user agent is two lines of text that pushed the fields an
 * operator actually reads apart from each other. They are omitted from this view alone.
 *
 * NOTHING HERE IS AN ACTION ON THE EVENT. `admin_audit_events` is append-only — the repository
 * exposes `create` and two reads and no update or delete (`admin_role_plan.md` §3.2) — so there is no
 * edit control to omit and no delete control to guard. The two buttons are filters over the *feed*,
 * described below; the links go to accounts, not to anything that could change this row.
 *
 * THE FILTER BUTTONS ARE WHAT MAKE THE ID FILTERS USABLE AT ALL. §6.8 filters by `actorUserId` and
 * `targetUserId`, both uuids — values no operator has memorised and none is going to type. Without a
 * way to lift one out of a row that is already on screen, those two filters are controls that can
 * only be used by someone who already has a uuid on their clipboard. One press is the whole
 * interaction: it fills the box, which resets the feed to that person's events.
 *
 * THE ACTION IS THE CARD'S HEADING, and it is toned rather than coloured-in. `services/adminAudit.js`
 * decides which tone each action gets and every badge still says what it is IN WORDS, so the record
 * survives a monochrome screen and a colour-blind reader — the same rule AdminUserBadges states, for
 * the same reason. Making it an <h3> gives a screen reader a list of actions to jump between, which
 * is how this page is actually read.
 */

/** Absolute date and time in the reader's locale. Null when missing or unparseable. */
function formatDateTime(iso) {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** `sessionsRevoked` / `session_count` → "Sessions revoked". For metadata keys we have no label for. */
function humanizeKey(key) {
  const text = String(key)
    .replace(/[._]/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Detail';
}

/*
 * What each metadata key is called. `from`/`to` are the one pair that would be actively misleading
 * under a generic label — on a page whose filter bar also has a From and a To, a role change reading
 * "From: user" next to a date range is a genuine misreading — so that action names them explicitly.
 * Everything else falls through to the shared map and then to `humanizeKey`.
 */
const METADATA_LABELS_BY_ACTION = {
  'user.role_changed': { from: 'Previous role', to: 'New role' },
};

const METADATA_LABELS = {
  reason: 'Reason',
  sessionsRevoked: 'Sessions revoked',
  revoked: 'Sessions revoked',
  via: 'Recorded via',
  counts: 'Records deleted',
};

function metadataLabel(action, key) {
  return METADATA_LABELS_BY_ACTION[action]?.[key] ?? METADATA_LABELS[key] ?? humanizeKey(key);
}

/**
 * One metadata value as text.
 *
 * VALUES ARE SHOWN AS THEY WERE RECORDED. Strings are not title-cased or otherwise tidied: the
 * dominant one is the operator's own disable reason, and a record that prettifies what was written
 * is no longer a record of what was written. Numbers are grouped because `sessionsRevoked: 1200` is
 * read, not parsed.
 *
 * `counts` is the one nested shape in the union (§3.2) and is flattened into "12 tasks, 34 focus
 * sessions". Anything else that arrives as an object is stringified rather than dropped — an event
 * whose metadata this bundle predates must still be legible.
 */
function formatMetadataValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const parts = Object.entries(value)
      .filter(([, inner]) => inner !== null && inner !== undefined && typeof inner !== 'object')
      .map(([innerKey, inner]) => `${inner} ${humanizeKey(innerKey).toLowerCase()}`);
    return parts.length > 0 ? parts.join(', ') : JSON.stringify(value);
  }
  if (Array.isArray(value)) return value.join(', ');
  return null;
}

/**
 * One party to the event — who did it, or who it was done to.
 *
 * BOTH IDS ARE NULLABLE AND THE TWO NULLS MEAN DIFFERENT THINGS, so each is said in words rather than
 * left as a missing link. A null actor is an event the system wrote about itself (the CLI bootstrap,
 * the reuse detector — §5.2 gives those `actor NULL` with a `'system:cli'` or `'system'` snapshot). A
 * null target is an account that has since been deleted, because the foreign keys are
 * `ON DELETE SET NULL`. The email survives either way: it is a snapshot column written at the time of
 * the event, which is the whole reason a deletion row can still say who it was about.
 *
 * The address is a link only when there is still an account to open. When there is not, it stays
 * plain text — a link to a deleted user would 404, and offering it would suggest the record is
 * recoverable when the point of the snapshot is that it is not.
 */
function Party({ label, party, note, onFilter, filterLabel }) {
  const id = party?.id ?? null;
  const email = party?.email ?? '';

  return (
    <div className="admin-audit-card__party">
      <span className="admin-audit-card__party-label">{label}</span>
      <span className="admin-audit-card__party-value">
        {email ? (
          id ? (
            <Link className="admin-audit-card__email-link" to={`/admin/users/${id}`}>
              {email}
            </Link>
          ) : (
            <span className="admin-audit-card__email">{email}</span>
          )
        ) : (
          <span className="admin-audit-card__absent">Not recorded</span>
        )}
        {note && <span className="admin-audit-card__party-note">{note}</span>}
      </span>
      {id && (
        <button
          type="button"
          className="admin-audit-card__filter"
          onClick={() => onFilter(id)}
          /*
           * The visible word is just "Filter" — repeating the address in every button would make the
           * card's own text longer than the record it is showing. The accessible name carries the
           * whole sentence, because a screen reader user tabbing the feed hears the name alone.
           */
          aria-label={`${filterLabel} ${email || id}`}
        >
          Filter
        </button>
      )}
    </div>
  );
}

/**
 * @param {{
 *   event: import('../../services/adminAudit.js').AdminAuditEvent,
 *   onFilterActor: (id: string) => void,
 *   onFilterTarget: (id: string) => void,
 * }} props
 */
function AdminAuditEventCard({ event, onFilterActor, onFilterTarget }) {
  const meta = actionMeta(event.action);
  const when = formatDateTime(event.createdAt);

  /*
   * Only the keys that actually carry something. `user.reactivated` is specified with `{}` — nothing
   * is restored except sign-in, so there is nothing to record — and an empty "Details" heading over
   * an empty list would imply the detail failed to load rather than that there is none.
   */
  const metadata = Object.entries(
    event.metadata && typeof event.metadata === 'object' ? event.metadata : {}
  )
    .map(([key, value]) => [key, formatMetadataValue(value)])
    .filter(([, value]) => value !== null && value !== undefined && value !== '');

  return (
    <li className="admin-audit__item">
      <article className={`admin-audit-card admin-audit-card--${meta.tone}`}>
        <div className="admin-audit-card__head">
          <h3 className={`admin-audit-card__action admin-audit-card__action--${meta.tone}`}>
            {meta.label}
          </h3>
          {when && (
            <time className="admin-audit-card__time" dateTime={event.createdAt}>
              {when}
            </time>
          )}
        </div>

        <div className="admin-audit-card__parties">
          <Party
            label="Actor"
            party={event.actor}
            note={event.actor?.id ? null : 'System'}
            onFilter={onFilterActor}
            filterLabel="Show only events by"
          />
          <Party
            label="Target"
            party={event.target}
            note={event.target?.id ? null : 'Account deleted'}
            onFilter={onFilterTarget}
            filterLabel="Show only events about"
          />
        </div>

        {/*
          The action's own detail and the request id, in ONE list. The request id is the only one of
          the three request fields shown: it is the one an operator actually uses, to join this row
          to its Pino log line (§3.2), and it reads as another fact about the event rather than as
          transport trivia. The ip and the user agent are still recorded and still returned by the
          API — they are simply not drawn here, because neither is read while scanning a feed and a
          user agent is two lines of text that pushed every event's real content apart.
        */}
        {(metadata.length > 0 || event.requestId) && (
          <dl className="admin-audit-card__meta">
            {metadata.map(([key, value]) => (
              <div className="admin-audit-card__meta-item" key={key}>
                <dt className="admin-audit-card__meta-label">{metadataLabel(event.action, key)}</dt>
                <dd className="admin-audit-card__meta-value">{value}</dd>
              </div>
            ))}

            {event.requestId && (
              <div className="admin-audit-card__meta-item">
                <dt className="admin-audit-card__meta-label">Request ID</dt>
                <dd className="admin-audit-card__meta-value admin-audit-card__meta-value--mono">
                  {event.requestId}
                </dd>
              </div>
            )}
          </dl>
        )}
      </article>
    </li>
  );
}

export default AdminAuditEventCard;
