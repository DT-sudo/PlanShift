import { useEffect, useRef } from 'react';

const layers = [];

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || layers.length === 0) return;
  event.preventDefault();
  layers[layers.length - 1].handler();
});

export function pushLayer(handler, token) {
  const layer = { handler, token };
  layers.push(layer);
  return {
    depth: layers.length,
    remove: () => {
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
    },
  };
}

export function isTopLayer(token) {
  return layers.length > 0 && layers[layers.length - 1].token === token;
}

export function useDismiss(open, onDismiss) {
  const ref = useRef(null);
  const handler = useRef(onDismiss);
  handler.current = onDismiss;

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      handler.current?.();
    };

    document.addEventListener('mousedown', onPointerDown);
    const layer = pushLayer(() => handler.current?.());

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      layer.remove();
    };
  }, [open]);

  return ref;
}
