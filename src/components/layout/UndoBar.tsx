/**
 * Undo Bar Component | 撤销提示条
 *
 * Renders a bottom-pinned snackbar that lets the user revert a recently
 * deleted account within a short window. The bar counts down, and once
 * it reaches zero the parent commits the deletion to storage.
 *
 * 显示底部固定的撤销提示条，允许用户在限定时间内撤销刚被删除的账户。
 * 倒计时归零后由父组件把删除操作真正写入 storage。
 */

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

interface UndoBarProps {
  issuer: string;
  durationMs: number;
  onUndo: () => void;
  onExpire: () => void;
}

export default function UndoBar({
  issuer,
  durationMs,
  onUndo,
  onExpire,
}: UndoBarProps) {
  const { t } = useI18n();
  const startedAtRef = React.useRef<number>(Date.now());
  const [remainingMs, setRemainingMs] = useState<number>(durationMs);

  // Tick the countdown every 100ms; trigger onExpire when it reaches zero.
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      const elapsed = Date.now() - startedAtRef.current;
      const next = durationMs - elapsed;
      if (next <= 0) {
        setRemainingMs(0);
        onExpire();
        return;
      }
      setRemainingMs(next);
      timeoutId = setTimeout(tick, 100);
    };

    timeoutId = setTimeout(tick, 100);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [durationMs, onExpire]);

  const progressPercent = Math.max(0, Math.min(100, (remainingMs / durationMs) * 100));
  const secondsLeft = Math.ceil(remainingMs / 1000);

  return (
    <div className="undo-bar" role="status" aria-live="polite">
      <div className="undo-bar-track">
        <div
          className="undo-bar-progress"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="undo-bar-content">
        <span className="undo-bar-message">
          {t('undo_delete_message').replace('{name}', issuer)}
          <span className="undo-bar-countdown"> ({secondsLeft}s)</span>
        </span>
        <button
          type="button"
          className="undo-bar-button"
          onClick={onUndo}
          aria-label={t('undo')}
        >
          {t('undo')}
        </button>
      </div>
    </div>
  );
}