let bootstrap;

export function getBootstrap() {
  if (!bootstrap) {
    bootstrap = JSON.parse(document.getElementById('planshift-bootstrap').textContent);
  }
  return bootstrap;
}

export function pageDataUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('format', 'json');
  return url;
}

export const getPageData = () => getJSON(pageDataUrl());

