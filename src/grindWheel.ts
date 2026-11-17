// Grind wheel modeled on the 1Zpresso K-Ultra adjustment ring: a brushed-silver
// cylinder seen from the side with embossed digits and a raised dot between each.

import { h } from './dom';
import { formatSetting, wrapSetting, type Grinder } from './model';

type Range = Pick<Grinder, 'min' | 'max' | 'step'>;

export interface WheelHandle {
  el: HTMLElement;
  setRange(range: Range, value: number): void;
  value(): number;
}

function labelEvery(span: number): number {
  for (const base of [1, 2, 5]) {
    for (let exp = -2; exp <= 4; exp++) {
      const e = base * 10 ** exp;
      if (span / e <= 12) return e;
    }
  }
  return span;
}

let noise: HTMLCanvasElement | null = null;
function brushedNoise(): HTMLCanvasElement {
  if (noise) return noise;
  noise = document.createElement('canvas');
  noise.width = 256;
  noise.height = 64;
  const c = noise.getContext('2d')!;
  // Horizontal streaks give the brushed-metal look.
  for (let y = 0; y < 64; y++) {
    for (let i = 0; i < 6; i++) {
      const x = Math.random() * 256;
      const len = 20 + Math.random() * 90;
      const light = Math.random() > 0.5;
      c.strokeStyle = light ? `rgba(255,255,255,${0.08 + Math.random() * 0.14})` : `rgba(70,70,66,${0.04 + Math.random() * 0.08})`;
      c.beginPath();
      c.moveTo(x, y + 0.5);
      c.lineTo(x + len, y + 0.5);
      c.stroke();
    }
  }
  return noise;
}

export function grindWheel(opts: {
  range: Range;
  value: number;
  height?: number;
  interactive?: boolean;
  readout?: boolean;
  onChange?: (v: number) => void;
}): WheelHandle {
  let range = opts.range;
  let pos = opts.value;
  const interactive = opts.interactive ?? true;
  const cssH = opts.height ?? 104;

  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const readout = h('div', { class: 'wheel-readout', 'aria-live': 'polite' });
  const wheel = h(
    'div',
    {
      class: 'wheel',
      role: interactive ? 'slider' : 'img',
      tabindex: interactive ? 0 : null,
      'aria-label': 'Grind setting',
      style: { cursor: interactive ? 'grab' : 'default' },
    },
    canvas,
    h('div', { class: 'wheel-notch' }),
    h('div', { class: 'wheel-notch bottom' }),
  );
  const el = h(
    'div',
    { class: 'wheel-wrap' },
    opts.readout === false ? null : readout,
    wheel,
    interactive ? h('div', { class: 'wheel-hint muted' }, 'Swipe the ring · tap a side for ±' + formatSetting(range.step, range.step)) : null,
  );

  const span = () => range.max - range.min + range.step;
  const shown = () => wrapSetting(pos, range);
  let lastStepIndex = Math.round(pos / range.step);

  function updateReadout() {
    const v = formatSetting(shown(), range.step);
    readout.textContent = v;
    wheel.setAttribute('aria-valuenow', v);
    wheel.setAttribute('aria-valuetext', v);
    const idx = Math.round(pos / range.step);
    if (idx !== lastStepIndex) {
      lastStepIndex = idx;
      if (interactive) navigator.vibrate?.(4);
    }
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = wheel.clientWidth || 320;
    canvas.style.height = `${cssH}px`;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const c = canvas.getContext('2d')!;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const H = cssH;

    // Metal body with bevel bands top and bottom.
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7e7d79');
    g.addColorStop(0.05, '#c8c7c2');
    g.addColorStop(0.12, '#a19f9a');
    g.addColorStop(0.15, '#efeee9');
    g.addColorStop(0.35, '#dddcd7');
    g.addColorStop(0.7, '#d2d1cc');
    g.addColorStop(0.85, '#c6c5c0');
    g.addColorStop(0.88, '#9b9a95');
    g.addColorStop(0.95, '#c2c1bc');
    g.addColorStop(1, '#73726e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, H);

    // Brushed texture.
    c.globalAlpha = 0.45;
    const pattern = c.createPattern(brushedNoise(), 'repeat');
    if (pattern) {
      c.fillStyle = pattern;
      c.fillRect(0, H * 0.15, w, H * 0.7);
    }
    c.globalAlpha = 1;

    // Markings.
    const cx = w / 2;
    const R = w / 2;
    const S = span();
    const every = labelEvery(S);
    const fontSize = Math.round(H * 0.46);
    c.font = `800 ${fontSize}px Archivo, system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const cy = H * 0.52;
    const first = Math.ceil((pos - S / 2 - range.min) / (every / 2)) * (every / 2) + range.min;
    for (let u = first; u <= pos + S / 2; u += every / 2) {
      const theta = ((u - pos) / S) * Math.PI * 2;
      if (Math.abs(theta) >= Math.PI / 2) continue;
      const cos = Math.cos(theta);
      const x = cx + R * Math.sin(theta);
      const k = Math.round((u - range.min) / (every / 2));
      const isLabel = k % 2 === 0;
      c.save();
      c.translate(x, cy);
      c.scale(Math.max(cos, 0.05), 1);
      c.globalAlpha = 0.3 + 0.7 * cos;
      const emboss = (paint: (dx: number, dy: number) => void) => {
        c.fillStyle = 'rgba(38,38,36,0.35)';
        paint(0.8, 3.6);
        c.fillStyle = 'rgba(38,38,36,0.8)';
        paint(0, 2.4);
        c.fillStyle = 'rgba(255,255,255,0.95)';
        paint(0, -1.6);
        const tg = c.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
        tg.addColorStop(0, '#f4f3ef');
        tg.addColorStop(1, '#a3a29c');
        c.fillStyle = tg;
        paint(0, 0);
      };
      if (isLabel) {
        const value = wrapSetting(u, range);
        const label = every >= 1 ? String(Math.round(value)) : formatSetting(value, every);
        emboss((dx, dy) => c.fillText(label, dx, dy));
      } else {
        const r = Math.max(2.5, H * 0.045);
        emboss((dx, dy) => {
          c.beginPath();
          c.arc(dx, dy, r, 0, Math.PI * 2);
          c.fill();
        });
      }
      c.restore();
    }

    // Cylinder shading: darker toward the edges.
    const sh = c.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, 'rgba(40,40,38,0.55)');
    sh.addColorStop(0.18, 'rgba(40,40,38,0.12)');
    sh.addColorStop(0.42, 'rgba(255,255,255,0.10)');
    sh.addColorStop(0.58, 'rgba(255,255,255,0.10)');
    sh.addColorStop(0.82, 'rgba(40,40,38,0.12)');
    sh.addColorStop(1, 'rgba(40,40,38,0.55)');
    c.fillStyle = sh;
    c.fillRect(0, 0, w, H);
  }

  function render() {
    updateReadout();
    draw();
  }

  // ---- Interaction ----
  let anim = 0;
  const pxPerUnit = () => ((wheel.clientWidth || 320) / 2) * ((Math.PI * 2) / span());

  function stopAnim() {
    cancelAnimationFrame(anim);
    anim = 0;
  }

  function snap() {
    const target = Math.round((pos - range.min) / range.step) * range.step + range.min;
    const from = pos;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 160);
      pos = from + (target - from) * (1 - (1 - k) ** 3);
      render();
      if (k < 1) anim = requestAnimationFrame(step);
      else {
        anim = 0;
        pos = wrapSetting(target, range);
        lastStepIndex = Math.round(pos / range.step);
        render();
        opts.onChange?.(pos);
      }
    };
    anim = requestAnimationFrame(step);
  }

  function nudge(steps: number) {
    stopAnim();
    pos = Math.round((pos - range.min) / range.step) * range.step + range.min + steps * range.step;
    snap();
  }

  if (interactive) {
    let dragging = false;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // units per ms
    let moved = 0;

    wheel.addEventListener('pointerdown', (e) => {
      stopAnim();
      dragging = true;
      startX = lastX = e.clientX;
      lastT = e.timeStamp;
      velocity = 0;
      moved = 0;
      wheel.setPointerCapture(e.pointerId);
    });
    wheel.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dt = Math.max(1, e.timeStamp - lastT);
      const du = -dx / pxPerUnit();
      pos += du;
      velocity = 0.7 * (du / dt) + 0.3 * velocity;
      moved = Math.max(moved, Math.abs(e.clientX - startX));
      lastX = e.clientX;
      lastT = e.timeStamp;
      render();
    });
    const release = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved < 6) {
        const rect = wheel.getBoundingClientRect();
        const rel = (e.clientX - rect.left) / rect.width;
        if (rel < 0.35) nudge(-1);
        else if (rel > 0.65) nudge(1);
        else snap();
        return;
      }
      if (e.timeStamp - lastT > 80) velocity = 0;
      // Cap the fling so one jerky swipe can't spin the ring around several times.
      velocity = Math.max(-0.012, Math.min(0.012, velocity));
      let prev = performance.now();
      const glide = (t: number) => {
        const dt = t - prev;
        prev = t;
        pos += velocity * dt;
        velocity *= Math.pow(0.994, dt);
        render();
        if (Math.abs(velocity) > 0.0004) anim = requestAnimationFrame(glide);
        else snap();
      };
      anim = requestAnimationFrame(glide);
    };
    wheel.addEventListener('pointerup', release);
    wheel.addEventListener('pointercancel', release);
    wheel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') nudge(-1);
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') nudge(1);
      else return;
      e.preventDefault();
    });
  }

  const ro = new ResizeObserver(() => draw());
  ro.observe(wheel);
  document.fonts?.load(`800 40px Archivo`).then(() => draw(), () => {});
  render();

  return {
    el,
    setRange(r, value) {
      stopAnim();
      range = r;
      pos = wrapSetting(value, r);
      lastStepIndex = Math.round(pos / r.step);
      const hint = el.querySelector('.wheel-hint');
      if (hint) hint.textContent = 'Swipe the ring · tap a side for ±' + formatSetting(r.step, r.step);
      render();
    },
    value: () => wrapSetting(pos, range),
  };
}
