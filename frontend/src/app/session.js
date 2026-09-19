import { getBootstrap } from './http.js';
import { useLiveEvents } from './live.js';

function toSignIn() {
  window.location.replace(getBootstrap().urls.login);
}

export function useSessionGuard() {
  useLiveEvents((event) => event.type === 'session.ended' && toSignIn(), {
    enabled: Boolean(getBootstrap().user),
  });
}

export function watchBackForwardCache() {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}
