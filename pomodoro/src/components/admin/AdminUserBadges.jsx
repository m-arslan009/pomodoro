/*
 * AdminUserBadges — role, status and email verification, as the panel's three badges.
 *
 * SHARED BY THE LIST AND THE DETAIL PAGE, which is the whole reason it is a component. Both
 * surfaces show the same three facts about the same account, and an operator who reads "Disabled"
 * on a card and something else on the page it opens has been told the account is in two states at
 * once. The labels, the tone mapping and the unknown-value fallback therefore live here once
 * instead of being written twice and drifting.
 *
 * EVERY STATE IS A WORD, NEVER A COLOUR. Disabled and unverified are the two an operator scans for,
 * and they are the two that must survive a monochrome screen or a colour-blind reader. The tone
 * classes only reinforce a label that already says it.
 *
 * The markup is inline elements throughout: the list renders these inside a <Link>, where a <div>
 * would be invalid.
 */

const ROLE_LABELS = { user: 'User', admin: 'Admin' };
const STATUS_LABELS = { active: 'Active', disabled: 'Disabled' };

/*
 * Renders a value the API sends that we do not have a label for, rather than dropping it. A role or
 * status added server-side should degrade to readable text — a blank badge would tell the operator
 * the field is empty, which is a different and false statement.
 */
function labelFor(labels, value) {
  if (!value) return 'Unknown';
  return labels[value] ?? String(value).replace(/_/g, ' ');
}

/** The tone class suffix, restricted to values we actually style. */
function toneFor(labels, value) {
  return value && value in labels ? value : 'unknown';
}

/**
 * @param {{
 *   user: import('../../services/adminUsers.js').AdminUserSummary,
 *   className?: string,
 * }} props
 */
function AdminUserBadges({ user, className = '' }) {
  return (
    <span className={`admin-badges ${className}`.trim()}>
      <span className={`admin-badge admin-badge--role-${toneFor(ROLE_LABELS, user.role)}`}>
        {labelFor(ROLE_LABELS, user.role)}
      </span>
      <span className={`admin-badge admin-badge--${toneFor(STATUS_LABELS, user.status)}`}>
        {labelFor(STATUS_LABELS, user.status)}
      </span>
      <span
        className={`admin-badge admin-badge--${user.emailVerified ? 'verified' : 'unverified'}`}
      >
        {user.emailVerified ? 'Email verified' : 'Email unverified'}
      </span>
    </span>
  );
}

export default AdminUserBadges;
