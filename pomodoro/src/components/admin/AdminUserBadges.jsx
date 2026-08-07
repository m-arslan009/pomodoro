/*
 * AdminUserBadges — role, status and email verification, as the panel's three badges.
 *
 * SHARED BY THE LIST AND THE DETAIL PAGE, which is the whole reason it is a component. Both
 * surfaces show the same three facts about the same account, and an operator who reads "Disabled"
 * on a card and something else on the page it opens has been told the account is in two states at
 * once. The labels, the tone mapping and the unknown-value fallback therefore live here once
 * instead of being written twice and drifting.
 *
 * THE THREE BADGES ARE ALSO EXPORTED SINGLY, because the detail page shows the same three states
 * twice: once in its header as an at-a-glance summary, and once inside the Account card where Role,
 * Status and Email verification are fields of the record like any other. Those field cells render
 * `RoleBadge`/`StatusBadge`/`VerifiedBadge` rather than their own text, so there is still exactly one
 * place that decides what `disabled` is called and how it is toned. `withSubject` is the only
 * difference between the two uses: a badge standing alone in a header has to name its own subject
 * ("Email verified"), while one sitting under an "Email verification" label must not repeat it.
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

/** @param {{ role?: string }} props */
export function RoleBadge({ role }) {
  return (
    <span className={`admin-badge admin-badge--role-${toneFor(ROLE_LABELS, role)}`}>
      {labelFor(ROLE_LABELS, role)}
    </span>
  );
}

/** @param {{ status?: string }} props */
export function StatusBadge({ status }) {
  return (
    <span className={`admin-badge admin-badge--${toneFor(STATUS_LABELS, status)}`}>
      {labelFor(STATUS_LABELS, status)}
    </span>
  );
}

/**
 * @param {{ verified?: boolean, withSubject?: boolean }} props `withSubject` names the thing being
 *   verified, for the header where the badge stands on its own; a badge under a label that already
 *   says "Email verification" would otherwise read "Email verification: Email verified".
 */
export function VerifiedBadge({ verified, withSubject = false }) {
  const state = verified ? 'verified' : 'unverified';
  return (
    <span className={`admin-badge admin-badge--${state}`}>
      {withSubject ? `Email ${state}` : verified ? 'Verified' : 'Unverified'}
    </span>
  );
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
      <RoleBadge role={user.role} />
      <StatusBadge status={user.status} />
      <VerifiedBadge verified={user.emailVerified} withSubject />
    </span>
  );
}

export default AdminUserBadges;
