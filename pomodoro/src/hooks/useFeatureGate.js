import { useSelector } from 'react-redux';
import { featureTitle, isFeatureUnlocked } from '../services/gamification.js';
import { selectLifetimePoints } from '../store/timerSelectors.js';

/*
 * useFeatureGate — resolves whether a title-gated feature is available.
 *
 * NOTHING IN THE PRODUCT IS GATED TODAY (CONTRACT.md §9.5). Settings was ungated on 2026-07-30 and
 * the History charts on 2026-08-01, so this hook's only remaining consumer is <FeatureGate>, which
 * has no production consumer of its own. Both are retained deliberately, on §9.4's reasoning: they
 * are the mechanism the cosmetic ladder (N5) reuses. Do not wire this to an analytics or utility
 * surface — "gate identity, never utility" is the rule that ungated both surfaces above.
 *
 * Reads lifetime points from the store, which is fed by the server. It previously read them from
 * localStorage once, in a mount-only initialiser, so a title earned on the Timer page stayed
 * invisible until the user navigated somewhere that remounted the gate — you unlocked something and
 * the app did not admit it (defect F7).
 *
 * Subscribing to the store also means the unlock now arrives with the same response that awarded
 * the points, rather than depending on a write to storage having already happened.
 */
export default function useFeatureGate(feature) {
  const lifetimePoints = useSelector(selectLifetimePoints);

  return {
    unlocked: isFeatureUnlocked(lifetimePoints, feature),
    requiredTitle: featureTitle(feature),
    lifetimePoints,
  };
}
