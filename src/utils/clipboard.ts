let clipboardClearTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleClipboardClear(value: string, seconds: number): void {
  if (clipboardClearTimer) {
    clearTimeout(clipboardClearTimer);
    clipboardClearTimer = null;
  }

  if (!value || seconds <= 0 || !navigator.clipboard?.writeText) return;

  clipboardClearTimer = setTimeout(async () => {
    clipboardClearTimer = null;

    try {
      await navigator.clipboard.writeText('');
    } catch {
      // Clipboard writes can be blocked by the browser; ignore failed cleanup attempts.
    }
  }, seconds * 1000);
}
