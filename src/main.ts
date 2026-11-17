import '@fontsource/archivo/700.css';
import '@fontsource/archivo/800.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import './styles.css';

import { registerSW } from 'virtual:pwa-register';
import { getMeta, setMeta } from './db';
import { h, replace } from './dom';
import { icon } from './icons';
import { beanDetailScreen } from './screens/beanDetail';
import { brewScreen } from './screens/brew';
import { brewDetailScreen } from './screens/brewDetail';
import { historyScreen } from './screens/history';
import { settingsScreen } from './screens/settings';

type Cleanup = (() => void) | void;
type Route = [RegExp, (root: HTMLElement, m: RegExpMatchArray) => Cleanup | Promise<Cleanup>];

const routes: Route[] = [
  [/^#\/brew$/, (root) => brewScreen(root)],
  [/^#\/history$/, (root) => historyScreen(root, 'brews')],
  [/^#\/history\/beans$/, (root) => historyScreen(root, 'beans')],
  [/^#\/history\/brew\/([\w-]+)$/, (root, m) => brewDetailScreen(root, m[1])],
  [/^#\/history\/bean\/(.+)$/, (root, m) => beanDetailScreen(root, decodeURIComponent(m[1]))],
  [/^#\/settings$/, (root) => settingsScreen(root)],
];

const tabs = [
  { href: '#/brew', label: 'Brew', icon: icon.brew },
  { href: '#/history', label: 'History', icon: icon.history },
  { href: '#/settings', label: 'Settings', icon: icon.settings },
];

const app = document.getElementById('app')!;
const view = h('main', { class: 'view' });
const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Main' }, h('div', { class: 'tabbar-inner' }));
replace(app, view, tabbar);

function renderTabs(hash: string) {
  replace(
    tabbar.firstElementChild as HTMLElement,
    tabs.map((t) => {
      const active = hash === t.href || hash.startsWith(`${t.href}/`);
      return h('a', { class: `tab${active ? ' active' : ''}`, href: t.href, 'aria-current': active ? 'page' : null }, t.icon(), t.label);
    }),
  );
}

let cleanup: Cleanup;
let renderId = 0;

async function route() {
  const hash = location.hash || '#/brew';
  if (!routes.some(([re]) => re.test(hash))) {
    location.replace('#/brew');
    return;
  }
  if (typeof cleanup === 'function') cleanup();
  cleanup = undefined;
  const id = ++renderId;
  renderTabs(hash);
  // A fresh container per route so late async renders of an old route can't leak in.
  const root = h('div');
  replace(view, root);
  for (const [re, render] of routes) {
    const m = hash.match(re);
    if (m) {
      const c = await render(root, m);
      if (id === renderId) cleanup = c;
      else if (typeof c === 'function') c();
      break;
    }
  }
  if (id === renderId && !hash.startsWith('#/brew')) window.scrollTo({ top: 0 });
}

window.addEventListener('hashchange', () => void route());
void route();

// ---- Persistent storage, once ----
void (async () => {
  if (!(await getMeta('persistAsked')) && navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
    await setMeta('persistAsked', true);
  }
})();

// ---- Service worker update prompt ----
const updateSW = registerSW({
  onNeedRefresh() {
    const banner = h(
      'div',
      { class: 'banner', role: 'status' },
      h('span', null, 'Update available'),
      h('button', { type: 'button', class: 'btn', onclick: () => void updateSW(true) }, 'Reload'),
    );
    document.body.appendChild(banner);
  },
});
