/*
 * appearance.js — the thin bridge between persisted personalization settings and
 * the live DOM. Kept separate from storage.js (which never touches the DOM) so
 * both AppLayout (applying saved settings on mount) and the Settings editors
 * (previewing edits live) drive the exact same code path.
 *
 * The forest palette + background live as CSS custom properties / background on
 * `.app-shell` (see AppLayout.css); every helper here overrides them with inline
 * values and, crucially, REMOVES those inline values to fall cleanly back to the
 * stylesheet defaults — so "reset to default" needs no hard-coded originals.
 */

/** Forest CSS variables the gated theme editor can recolour. */
export const THEME_VARS = [
  { key: 'accent', cssVar: '--fg-accent', label: 'Accent', fallback: '#cfe6b4' },
  { key: 'leaf', cssVar: '--fg-leaf', label: 'Highlight', fallback: '#a9c98d' },
  { key: 'wood', cssVar: '--fg-wood', label: 'Focus ring', fallback: '#d59b6c' },
];

/**
 * Background choices for the gated Pace Setter feature. `image: null` is the
 * built-in forest artwork (restored by clearing the inline override); the rest
 * are self-contained CSS gradients — no external assets — kept dark enough to
 * preserve the shell's light-on-dark contrast.
 */
export const BACKGROUND_PRESETS = [
  { key: 'forest', label: 'Forest', image: null },
  {
    key: 'dusk',
    label: 'Dusk',
    image: 'linear-gradient(160deg, #1b2a33 0%, #24323a 45%, #3a2f3d 100%)',
  },
  {
    key: 'ember',
    label: 'Ember',
    image: 'linear-gradient(160deg, #241a17 0%, #33231c 50%, #402a1f 100%)',
  },
  {
    key: 'midnight',
    label: 'Midnight',
    image: 'linear-gradient(160deg, #10161f 0%, #131b2b 55%, #1a1330 100%)',
  },
];

/**
 * Base colour-scheme options for the theme toggle. 'light' is deferred until a
 * light .app-shell palette exists — see CONTRACT.md §9.3.
 */
export const THEME_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'dark', label: 'Dark' },
];

/**
 * Apply the base colour scheme at the document level. 'system' clears the
 * override so the OS preference (via prefers-color-scheme) wins again.
 */
export function applyBaseTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.style.colorScheme = theme;
    root.dataset.theme = theme;
  } else {
    root.style.removeProperty('color-scheme');
    delete root.dataset.theme;
  }
}

/** Override (or clear) the forest palette variables on the shell element. */
export function applyCustomTheme(element, customTheme) {
  if (!element) return;
  for (const { key, cssVar } of THEME_VARS) {
    const value = customTheme?.[key];
    if (value) element.style.setProperty(cssVar, value);
    else element.style.removeProperty(cssVar);
  }
}

/** Swap the shell background to a preset, or clear it to restore the forest. */
export function applyBackground(element, presetKey) {
  if (!element) return;
  const preset = BACKGROUND_PRESETS.find((option) => option.key === presetKey);
  if (!preset || !preset.image) {
    element.style.removeProperty('background-image');
    element.style.removeProperty('background-size');
    element.style.removeProperty('background-position');
    element.style.removeProperty('background-attachment');
    return;
  }
  element.style.backgroundImage = preset.image;
  element.style.backgroundSize = 'cover';
  element.style.backgroundPosition = 'center';
  element.style.backgroundAttachment = 'fixed';
}
