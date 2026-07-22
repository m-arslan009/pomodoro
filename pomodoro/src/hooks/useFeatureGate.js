import { useState } from 'react';
import { getLifetimePoints } from '../services/storage.js';
import { featureTitle, isFeatureUnlocked } from '../services/gamification.js';

/*
 * useFeatureGate — resolves whether a title-gated feature is available to the
 * current player. Lifetime points only change on the Timer page (never on the
 * pages that gate features), so they are read once on mount; the hook then
 * derives the unlock state and the title still required, which <FeatureGate>
 * uses to render either the live feature or its "Reach {Title} to unlock"
 * preview.
 */
export default function useFeatureGate(feature) {
  const [lifetimePoints] = useState(() => getLifetimePoints());
  return {
    unlocked: isFeatureUnlocked(lifetimePoints, feature),
    requiredTitle: featureTitle(feature),
    lifetimePoints,
  };
}
