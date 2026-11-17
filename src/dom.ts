// Tiny DOM helpers.

export type Child = Node | string | number | null | undefined | false | Child[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Props = Record<string, any>;

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

function setProps(el: Element, props: Props | null | undefined): void {
  if (!props) return;
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') {
      const st = (el as HTMLElement).style;
      for (const [p, pv] of Object.entries(v)) {
        if (pv === null || pv === undefined) continue;
        if (p.startsWith('--')) st.setProperty(p, String(pv));
        else (st as unknown as Props)[p] = pv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in el && !k.includes('-') && k !== 'list' && !(el instanceof SVGElement)) (el as unknown as Props)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  setProps(el, props);
  append(el, children);
  return el;
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  setProps(el, props);
  append(el, children);
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replace(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, children);
}

export function go(hash: string): void {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function toast(message: string): void {
  const t = h('div', { class: 'toast', role: 'status' }, message);
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('toast-out'), 2200);
  setTimeout(() => t.remove(), 2600);
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => `${dateFmt.format(new Date(iso))}, ${timeFmt.format(new Date(iso))}`;
export const fmtMonth = (iso: string) => monthFmt.format(new Date(iso));

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
