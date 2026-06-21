const debugEnabled = (import.meta.env as { DEV?: boolean }).DEV === true;

export function debugLog(...args: unknown[]) {
  if (debugEnabled) {
    console.log(...args);
  }
}

export function debugWarn(...args: unknown[]) {
  if (debugEnabled) {
    console.warn(...args);
  }
}

export function debugError(...args: unknown[]) {
  if (debugEnabled) {
    console.error(...args);
  }
}
