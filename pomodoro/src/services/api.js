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
  const response = await send(path, method, body, token);

  /*
   * There is no recovery from a 401 — the access token is the only credential, and nothing can
   * mint a new one without the password. So the session is dropped and the user is sent back to
   * the login screen by the route guards.
   *
   * Only a request that actually carried a token can mean "your session ended". A 401 from an
   * anonymous request is the login endpoint saying the credentials were wrong, which is the
   * form's business and must not clear anyone's session.
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
  /** Resolves to null: the API answers 204 with no body for a successful delete. */
  del: (path) => request(path, { method: 'DELETE' }),
  getBlob: (path) => request(path, { blob: true }),
};
