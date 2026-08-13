import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { postForm } from '../app/http.js';
const ToastContext = createContext(() => {});
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

