import { useSelector } from 'react-redux';
import { featureTitle, isFeatureUnlocked } from '../services/gamification.js';
import { selectLifetimePoints } from '../store/timerSelectors.js';

/*
 * useFeatureGate — resolves whether a title-gated feature is available.
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
