/*
 * Shared failure copy for the admin panel's reads and writes.
 *
 * OUR WORDS FOR OUR PROBLEMS, THE SERVER'S WORDS FOR ITS RULES. `components/settings/saveFailure.js`
 * makes the same split and states the general case: raw server detail is not surfaced, because a
 * problem document is written for a developer reading a log and can carry internals. The exception
 * there is a 422, *"where it is the server's own field-level explanation and is meant to be read"*.
 *
 * This surface has a second exception, and it is the more important one: a **409** from the admin
 * namespace is never an internal condition. It is one of exactly three domain rules — an admin may
 * not change their own role, may not disable or delete their own account, and the last remaining
 * admin may not be demoted or disabled (`admin_role_plan.md` §4.3) — and the server's sentence says
 * which one fired. Replacing it with a generic "that is not allowed" would take away the only
 * information the operator actually needs, and the client cannot regenerate it: the last-admin rule
 * depends on a count no admin page holds. So a 409 is passed through when the server explains
 * itself, and falls back to naming the three rules when it does not.
 *
 * Nothing here is a substitute for the rules themselves. They are enforced server-side and this
 * module only reports the refusal.
 */

/**
 * @param {{status?: number, detail?: string, isNetworkError?: boolean}} error
 * @param {string} [fallback] What to say when the failure is not one of the known shapes.
 * @returns {string}
 */
export function describeAdminFailure(error, fallback = 'Something went wrong. Try again.') {
  if (error?.status === 0) {
    return 'We could not reach the server. Check your connection, then try again.';
  }
  if (error?.status === 404) {
    /*
     * Genuinely ambiguous, and said as such. §4.2 makes the whole admin namespace answer 404 to a
     * non-admin, so this is either "no such account" or "this namespace is not yours" — and after a
     * deletion it is also simply true.
     */
    return 'This account is not available. It may have been deleted, or the directory may not be available for this session.';
  }
  if (error?.status === 409) {
    return (
      error.detail ||
      'The server refused this action. An administrator cannot change their own role, disable or delete their own account, and the last remaining administrator cannot be demoted or disabled.'
    );
  }
  if (error?.status === 422) {
    return error.detail || 'The server rejected these values. Review them and try again.';
  }
  if (error?.status === 429) {
    return 'Too many requests in a row. Wait a moment, then try again.';
  }
  return fallback;
}
