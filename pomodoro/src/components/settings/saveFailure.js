/*
 * Shared failure copy for the settings sections.
 *
 * Every section saves through the same endpoint and fails in the same three ways, so the wording
 * lives in one place rather than being re-invented per card. Raw server detail is deliberately
 * not surfaced: `error.message` is used only for a 422, where it is the server's own field-level
 * explanation and is meant to be read.
 */

/**
 * @param {{isNetworkError?: boolean, status?: number, message?: string}} error
 * @param {string} what What failed to save, as a noun phrase — "theme preference", "appearance".
 * @returns {string}
 */
export function describeSaveFailure(error, what = 'settings') {
  if (error?.isNetworkError) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (error?.status === 422) {
    return error.message || 'Some values were rejected. Please review them and try again.';
  }
  return `Could not save your ${what}. Please try again.`;
}
