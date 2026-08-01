/*
 * alerts.js — the end-of-interval chime and desktop notification.
 *
 * A pomodoro is only useful if you can stop looking at it. Without an audible or
 * out-of-tab signal the user has to watch the countdown, which defeats the point
 * of running one.
 *
 * The chime is synthesised with WebAudio rather than shipped as an asset: it is
 * two short sine tones, so a file would be bytes on the wire and a decode for a
 * sound we can generate exactly. No dependency, nothing to preload, no CORS.
 *
 * Everything here degrades silently. Audio may be blocked until the user has
 * interacted with the page, notifications may be denied, and neither is worth an
 * error — the on-screen toast is always shown regardless, so the signal is never
 * only audible.
 */

const TONES = {
  // Rising pair — a focus block completed.
  work: [660, 880],
  // Falling pair — the break is over, back to work.
  break: [560, 420],
};

let audioContext = null;

/** Lazily create (and revive) the shared AudioContext. */
function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  try {
    if (!audioContext) audioContext = new Ctor();
    // Browsers suspend the context until a gesture; resuming is a no-op if running.
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  } catch {
    return null;
  }
}

/** Play a single tone with a short attack/decay so it does not click. */
function playTone(ctx, frequency, startAt, duration) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

/**
 * Sound the end of an interval. `phase` is 'work' or 'break'.
 * Returns true when a sound was actually produced.
 */
export function playChime(phase = 'work') {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    const [first, second] = TONES[phase] ?? TONES.work;
    const now = ctx.currentTime;
    playTone(ctx, first, now, 0.18);
    playTone(ctx, second, now + 0.16, 0.26);
    return true;
  } catch {
    return false;
  }
}

/** Whether the Notification API exists and the user has already granted it. */
export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission === 'granted'
    : false;
}

/**
 * Ask for notification permission. Called from a user gesture (starting a block),
 * never on mount — an unprompted permission dialog on page load is the pattern
 * every browser now penalises.
 */
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Show a desktop notification, but only when the tab is hidden — notifying
 * someone about something already on their screen is noise.
 */
export function notify(title, body) {
  if (!canNotify()) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return false;
  try {
    new Notification(title, { body, tag: 'evergrove-timer', silent: false });
    return true;
  } catch {
    return false;
  }
}

/** The end-of-interval signal: chime plus a notification when the tab is hidden. */
export function announceIntervalEnd(phase, message) {
  playChime(phase);
  notify(phase === 'work' ? 'Focus block complete' : 'Break over', message);
}
