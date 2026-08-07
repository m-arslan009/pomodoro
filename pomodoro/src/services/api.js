/*
 * api.js — the single HTTP boundary between the app and the Evergrove API.
 *
 * Nothing else in src/ calls fetch. Every request carries a bearer access token when there is
 * one; every failure arrives as an ApiError so callers branch on `status` and `fieldErrors`
 * instead of parsing response bodies themselves.
 *
 * The path is relative on purpose: the API is same-origin in every environment — the Vite dev
 * proxy locally, the Netlify /api/* rewrite in production.
 */

const API_BASE = '/api/v1';

/**
 * A failed request. `status` is 0 when the network never answered, so "offline" is
 * distinguishable from "the server said no".
 */
export class ApiError extends Error {
  constructor(status, title, detail, fieldErrors = {}) {
    super(detail || title || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.title = title;
    this.detail = detail;
    /** Field name → message, ready to drop into a form's error state. */
    this.fieldErrors = fieldErrors;
  }

  /** True when the failure was the network itself rather than a response. */
  get isNetworkError() {
    return this.status === 0;
  }
}

/** RFC 9457 problem document → ApiError. */
function toApiError(status, payload) {
  const problem = payload && typeof payload === 'object' ? payload : {};
  const fieldErrors = {};
  if (Array.isArray(problem.errors)) {
    for (const entry of problem.errors) {
      if (entry?.field && typeof entry.message === 'string' && !(entry.field in fieldErrors)) {
        fieldErrors[entry.field] = entry.message;
      }
    }
  }
  return new ApiError(status, problem.title, problem.detail, fieldErrors);
}

async function readBody(response) {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- Token plumbing -- */
/*
 * The access token is a JWT that lives in Redux state, in memory only. This module reads it
 * through an injected accessor rather than importing the store, for two reasons: the store
 * imports the services, so the reverse import would close a cycle; and injection keeps this
 * file usable — and testable — with no store present at all.
 *
 * Both hooks are optional. Unwired, api.js sends anonymous requests and lets a 401 propagate
 * untouched.
 */

/** @type {() => (string | null)} */
let readAccessToken = () => null;

/** @type {() => void} */
let handleAuthFailure = () => {};

/** @type {(() => Promise<unknown>) | null} */
let requestRefresh = null;

/**
 * Supplies the reader for the current access token, called on every request.
 * @param {() => (string | null)} accessor
 */
export function setAuthTokenAccessor(accessor) {
  readAccessToken = accessor;
}

/**
 * Supplies the callback that drops local authentication state when the server rejects the token.
 * @param {() => void} onFailure
 */
export function setOnAuthFailure(onFailure) {
  handleAuthFailure = onFailure;
}

/**
 * Supplies the renewal action, invoked at most once per 401 and shared across concurrent ones.
 *
 * Injected like the other two, and for the same reason: renewing means dispatching, and importing
 * the store here would close the cycle this whole seam exists to avoid. Unwired, api.js behaves
 * exactly as it did before refresh tokens existed — a 401 propagates untouched.
 *
 * @param {() => Promise<unknown>} refresher Resolves when a new access token is in the store.
 */
export function setAuthRefreshHandler(refresher) {
  requestRefresh = refresher;
}

/*
 * The in-flight renewal, shared by every request that hits a 401 while it runs.
 *
 * Single-flight is not an optimisation here, it is a correctness requirement. Refresh tokens
 * rotate, so four parallel renewals would present the same token four times; the first rotates it
 * away and the other three look like a *replayed* token, which the server treats as theft and
 * answers by revoking every session the account has. Landing on /history — which fires four
 * hydration reads at once — would sign the user out. One promise, shared, is what prevents that.
 */
/** @type {Promise<boolean> | null} */
let inFlightRefresh = null;

/** @returns {Promise<boolean>} whether a usable token is now in place. */
function refreshOnce() {
  inFlightRefresh ??= Promise.resolve()
    .then(() => requestRefresh?.())
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      inFlightRefresh = null;
    });

  return inFlightRefresh;
}

/**
 * Paths where a 401 means "those credentials are wrong", not "your token aged out".
 * Retrying any of them is at best pointless and at worst a recursion.
 */
const NO_RETRY_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];

/** Fires the request itself. Rejects only when the network never answered. */
async function send(path, method, body, token) {
  const headers = {};
  /*
   * A FormData body is passed through untouched and without a Content-Type: only the browser
   * knows the multipart boundary it generated, and setting the header by hand leaves that
   * boundary out, which makes the request unparseable on the server.
   */
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: body === undefined || isForm ? body : JSON.stringify(body),
      /*
       * The refresh cookie. Strictly belt-and-braces at the moment — the API is same-origin in
       * every environment (§7.2), and fetch already defaults to 'same-origin' — but it states the
       * intent, and it is what makes a dev setup that points Vite straight at the API port work.
       */
      credentials: 'include',
    });
  } catch {
    throw new ApiError(
      0,
      'Network error',
      'We could not reach the server. Check your connection and try again.'
    );
  }
}

/**
 * @param {string} path
 * @param {{method?: string, body?: unknown, blob?: boolean}} [options]
 */
async function request(path, { method = 'GET', body, blob = false } = {}) {
  const token = readAccessToken();
  let response = await send(path, method, body, token);

  /*
   * A 401 on a token-bearing request now usually means the access token aged out mid-session, not
   * that the session ended — the tokens are short-lived and a refresh cookie exists. So it is worth
   * exactly one renewal and one replay, after which the user has noticed nothing.
   *
   * Three bounds, all load-bearing:
   *
   *  - ONE replay. If the replayed request 401s again the error propagates. A loop here hangs the
   *    browser, and "refresh succeeded but the request still fails" is not a token problem.
   *  - NO retry for the paths in NO_RETRY_PATHS. A 401 from /auth/refresh is the server's final
   *    answer about the session; retrying it would recurse. A 401 from login or register is a
   *    rejected credential, which is the form's business.
   *  - Only when a token was actually sent. An anonymous 401 must not clear anyone's session, for
   *    the same reason.
   */
  if (response.status === 401 && token && !NO_RETRY_PATHS.includes(path)) {
    if (await refreshOnce()) {
      response = await send(path, method, body, readAccessToken());
    }
  }

  /*
   * Whatever the recovery attempt did, a 401 that survives it ends the session: nothing else can
   * mint a token, so the route guards send the user back to the login screen.
   */
  if (response.status === 401 && token) handleAuthFailure();

  if (response.status === 204) return null;

  // A failure is a problem document whatever the request asked for, so errors are always read as
  // JSON — only a successful response honours `blob`.
  if (!response.ok) throw toApiError(response.status, await readBody(response));
  return blob ? response.blob() : readBody(response);
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  /**
   * Resolves to the parsed body, or to null when the API answers 204 with no content.
   *
   * `body` is optional and is almost always omitted — a DELETE says everything it needs to in its
   * path. The one exception is the admin account deletion, which the server will only accept with a
   * typed confirmation of the address in the body (`admin_role_plan.md` §6.9), so that the check is
   * the server's rather than a dialog's. Omitting it sends exactly what this method always sent: no
   * body and no Content-Type.
   */
  del: (path, body) => request(path, { method: 'DELETE', body }),
  getBlob: (path) => request(path, { blob: true }),
};
