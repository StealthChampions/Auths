import React, { useEffect } from 'react';
import { useNotification, useStyle } from '../../store';

export default function NotificationHandler() {
  const { notification, dispatch } = useNotification();
  const { style } = useStyle();

  useEffect(() => {
    if (!notification.messageIdle && style.notificationFadeout) {
      const timer = setTimeout(() => {
        dispatch({ type: 'clear' });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [notification.messageIdle, style.notificationFadeout, dispatch]);

  useEffect(() => {
    if (style.notificationFadein) {
      const timer = setTimeout(() => {
        dispatch({ type: 'clear' });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [style.notificationFadein, dispatch]);

  return (
    <>
      {/* Alert Messages */}
      {notification.message && (
        <div className={`alert-container ${!notification.messageIdle ? 'active' : ''}`}>
          <div className="alert-content">
            <p>{notification.message}</p>
            <button
              onClick={() => dispatch({ type: 'clear' })}
              className="alert-close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}