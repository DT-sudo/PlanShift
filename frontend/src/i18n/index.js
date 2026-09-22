import { cloneElement, isValidElement, useSyncExternalStore } from 'react';

import { getBootstrap, pageDataUrl, postForm } from '../app/http.js';
import ar from './locales/ar.json';
import cs from './locales/cs.json';
import en from './locales/en.json';

const CATALOGS = { en, cs, ar };
const FALLBACK = 'en';

let language = CATALOGS[document.documentElement.lang] ? document.documentElement.lang : FALLBACK;
const listeners = new Set();

const getLanguage = () => language;

export const isRtl = () => document.documentElement.dir === 'rtl';

const INTL_LOCALES = { en: 'en-GB', ar: 'ar-u-nu-latn' };

export const intlLocale = () => INTL_LOCALES[language] ?? language;

const lookup = (catalog, key) => key.split('.').reduce((node, part) => node?.[part], catalog);

function template(key, count) {
  let entry = lookup(CATALOGS[language], key) ?? lookup(CATALOGS[FALLBACK], key);
  if (entry && typeof entry === 'object' && count !== undefined) {
    entry = entry[new Intl.PluralRules(language).select(count)] ?? entry.other;
  }
  return typeof entry === 'string' ? entry : key;
}

export function t(key, params = {}) {
  return template(key, params.count).replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

export function tx(key, params = {}) {
  return template(key, params.count)
    .split(/(\{\w+\})/)
    .map((part, index) => {
      const name = part.match(/^\{(\w+)\}$/)?.[1];
      if (!name || !(name in params)) return part;
      return isValidElement(params[name]) ? cloneElement(params[name], { key: index }) : String(params[name]);
    });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLanguage() {
  return useSyncExternalStore(subscribe, getLanguage);
}

export function onLanguageChange(callback) {
  return subscribe(callback);
}

async function rereadPage() {
  try {
    const response = await fetch(pageDataUrl(), { headers: { Accept: 'application/json' } });
    if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return null;
    return { data: await response.json(), title: response.headers.get('X-Page-Title') };
  } catch {
    return null;
  }
}

export async function changeLanguage(code) {
  if (code === language || !CATALOGS[code]) return;
  const bootstrap = getBootstrap();
  const saved = await postForm(bootstrap.urls.language, { language: code });
  const page = await rereadPage();

  if (page) {
    bootstrap.data = page.data;
    if (page.title) document.title = decodeURIComponent(page.title);
  }
  if (saved.user) bootstrap.user = saved.user;
  bootstrap.locale = { language: code, dir: saved.dir };
  language = code;
  document.documentElement.lang = code;
  document.documentElement.dir = saved.dir;
  listeners.forEach((listener) => listener());
}
