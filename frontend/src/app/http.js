let bootstrap;

export function getBootstrap() {
  if (!bootstrap) {
    bootstrap = JSON.parse(document.getElementById('planshift-bootstrap').textContent);
  }
  return bootstrap;
}

export const urlFromTemplate = (template, id) => template.replace('/0/', `/${id}/`);

export function submitPost(action, fields = {}) {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = action;
  form.hidden = true;

  for (const [name, value] of Object.entries({ csrfmiddlewaretoken: getBootstrap().csrfToken, ...fields })) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.append(input);
  }

  document.body.append(form);
  form.submit();
}

export function pageDataUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('format', 'json');
  return url;
}

export const getPageData = () => getJSON(pageDataUrl());

export async function postForm(url, data) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
      'X-CSRFToken': getBootstrap().csrfToken,
    },
    body: new URLSearchParams(data),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.ok) return payload;

  throw new Error(payload.error || '');
}
