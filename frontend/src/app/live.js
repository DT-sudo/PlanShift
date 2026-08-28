import { useEffect, useRef, useState } from 'react';

import { onLanguageChange } from '../i18n/index.js';
import { getBootstrap, getPageData } from './http.js';

const SOCKET_PATH = '/ws/schedule/';
const MAX_RETRY_DELAY_MS = 15000;

const subscribers = new Set();
let socket = null;
let retryTimer = null;
let attempts = 0;
let wasLive = false;

function connect() {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const current = new WebSocket(`${scheme}://${window.location.host}${SOCKET_PATH}`);
  socket = current;

  current.onopen = () => {
    subscribers.forEach((subscriber) => {
      if (wasLive) subscriber.onReconnect();
      subscriber.onOpen();
    });
    wasLive = true;
    attempts = 0;
  };

  current.onmessage = (message) => {
    const event = JSON.parse(message.data);
    subscribers.forEach((subscriber) => subscriber.onEvent(event));
  };

  current.onclose = () => {
    if (socket !== current) return;
    const delay = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempts);
    attempts += 1;
    retryTimer = setTimeout(connect, delay);
  };
}

function subscribe(subscriber) {
  subscribers.add(subscriber);
  if (!socket) connect();
  else if (socket.readyState === WebSocket.OPEN) subscriber.onOpen();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size) return;
    clearTimeout(retryTimer);
    const closing = socket;
    socket = null;
    wasLive = false;
    attempts = 0;
    closing?.close();
  };
}

export function sendLive(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

export function useLiveEvents(onEvent, { onReconnect, onOpen, enabled = true } = {}) {
  const handlers = useRef({ onEvent, onReconnect, onOpen });
  useEffect(() => {
    handlers.current = { onEvent, onReconnect, onOpen };
  });

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe({
      onEvent: (event) => handlers.current.onEvent(event),
      onReconnect: () => handlers.current.onReconnect?.(),
      onOpen: () => handlers.current.onOpen?.(),
    });
  }, [enabled]);
}

export function useLivePageData(initial, eventTypes = ['shifts.changed'], patch = null) {
  const [data, setData] = useState(initial);
  const refresh = () => getPageData().then(setData).catch(() => {});
  useEffect(() => onLanguageChange(() => setData(getBootstrap().data)), []);
  useLiveEvents(
    (event) => {
      if (eventTypes.includes(event.type)) refresh();
      else if (patch) setData((current) => patch(current, event));
    },
    { onReconnect: refresh },
  );
  return data;
}
