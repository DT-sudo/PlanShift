import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { getJSON, postForm } from '../app/http.js';
import { useLiveEvents } from '../app/live.js';
import { Bell } from './Icons.jsx';
import { Modal } from './Modal.jsx';

const ToastContext = createContext(() => {});
const HistoryContext = createContext(null);

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ initialMessages = [], notifications = null, children }) {
  const [toasts, setToasts] = useState([]);
  const [history, setHistory] = useState(notifications?.items ?? []);
  const timers = useRef(new Map());
  const urls = notifications?.urls;

  const showToast = useCallback((level, title, description = '') => {
    const key = `${level}|${title}|${description}`;

    setToasts((current) =>
      current.some((toast) => toast.key === key)
        ? current.map((toast) => (toast.key === key ? { ...toast, count: toast.count + 1 } : toast))
        : [...current, { key, level, title, description, count: 1 }],
    );
    clearTimeout(timers.current.get(key));
    timers.current.set(
      key,
      setTimeout(() => setToasts((current) => current.filter((toast) => toast.key !== key)), level === 'error' ? 6000 : 4000),
    );
  }, []);

  const reloadHistory = () =>
    getJSON(urls.list)
      .then((payload) => setHistory(payload.notifications))
      .catch(() => {});

  useLiveEvents(
    (event) => {
      if (event.type !== 'notification') return;
      const entry = event.notification;
      setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)]);
      showToast(entry.level, entry.title, entry.description);
    },
    { enabled: Boolean(urls), onReconnect: reloadHistory },
  );

  useEffect(() => {
    if (!urls) return undefined;
    return onLanguageChange(reloadHistory);
  }, [urls]);

  const flashed = useRef(false);
  useEffect(() => {
    if (flashed.current) return;
    flashed.current = true;
    for (const { level, text } of initialMessages) showToast(level, t(`toast.${level}`), text);
  }, [initialMessages, showToast]);

  const center = useMemo(() => {
    const save = (url) => postForm(url, {}).catch(() => showToast('error', "Error", "Could not update notifications."));
    return {
      history,
      markAllRead: () => {
        if (!history.some((entry) => !entry.read)) return;
        setHistory((current) => current.map((entry) => ({ ...entry, read: true })));
        save(urls.markRead);
      },
      clear: () => {
        setHistory([]);
        save(urls.clear);
      },
    };
  }, [history, urls, showToast]);

  return (
    <ToastContext.Provider value={showToast}>
      <HistoryContext.Provider value={center}>
        {children}
        <div className="fixed end-4 bottom-4 z-[6000] flex flex-col gap-2" aria-live="polite" aria-atomic="true">
          {toasts.map((toast) => (
            <div key={toast.key} className={`toast toast-${toast.level}`}>
              <div className="toast-dot" aria-hidden="true" />
              <NotificationText entry={toast} />
            </div>
          ))}
        </div>
      </HistoryContext.Provider>
    </ToastContext.Provider>
  );
}

export function NotificationBell() {
  const { history, markAllRead, clear } = useContext(HistoryContext);
  const [open, setOpen] = useState(false);
  const unread = history.filter((entry) => !entry.read).length;

  return (
    <>
      <button
        className="btn btn-ghost btn-icon relative"
        type="button"
        aria-label={unread ? (unread === 1 ? `Notifications, ${unread} unread` : `Notifications, ${unread} unread`) : "Notifications"}
        onClick={() => {
          setOpen(true);
          markAllRead();
        }}
      >
        <Bell />
        {unread ? <span className="notification-badge">{unread > 99 ? '99+' : unread}</span> : null}
      </button>

      {/* Portalled: the sticky header is a stacking context the modal must not be trapped in. */}
      {open
        ? createPortal(
            <Modal
              title="Notifications"
              onClose={() => setOpen(false)}
              footer={
                history.length ? (
                  <button className="btn btn-outline" type="button" onClick={clear}>
                    Clear history
                  </button>
                ) : null
              }
            >
              {history.length ? (
                <ul className="modal-body p-0">
                  {history.map((entry) => (
                    <li key={entry.id} className={`notification-item toast-${entry.level}`}>
                      <div className="toast-dot" aria-hidden="true" />
                      <NotificationText entry={entry} />
                      <time className="ms-auto shrink-0 text-xs text-muted-foreground" dateTime={entry.time}>
                        {timeAgo(entry.time)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="modal-body text-center text-sm text-muted-foreground">No notifications yet.</p>
              )}
            </Modal>,
            document.body,
          )
        : null}
    </>
  );
}
