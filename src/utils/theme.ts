export type ThemePreference = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

export function normalizeThemePreference(theme?: string | null): ThemePreference {
  if (theme === 'light' || theme === 'dark' || theme === 'system') return theme;
  return 'system';
}

export function getSystemTheme(): EffectiveTheme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function resolveThemePreference(theme?: string | null): EffectiveTheme {
  const preference = normalizeThemePreference(theme);
  return preference === 'system' ? getSystemTheme() : preference;
}

export function applyThemePreference(theme?: string | null): EffectiveTheme {
  const effectiveTheme = resolveThemePreference(theme);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
  return effectiveTheme;
}
