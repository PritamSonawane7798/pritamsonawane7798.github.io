// Draws the site's isometric illustrations as static SVG files.
// Run with: node tools/build-illustrations.mjs
// Output: assets/img/*.svg. The website itself has no build step.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'img');
const COS = Math.cos(Math.PI / 6);
const n = (v) => Math.round(v * 10) / 10;

const MATERIALS = {
  blue: ['url(#topBlue)', '#2a45c4', '#1c2f9c'],
  deep: ['url(#topDeep)', '#26349f', '#1a2479'],
  cyan: ['#56e0f7', '#24add9', '#1684b8'],
  pink: ['#ff78a6', '#e84585', '#b92c69'],
  white: ['#f4f8ff', '#c6d6f7', '#9db4ea'],
  ink: ['#2f3f9e', '#1d2877', '#141b5c'],
  gold: ['#ffd36e', '#f0a93e', '#c98422'],
};

const SKIN = { a: '#c98a5f', b: '#a86c45', c: '#e2ab82' };

class Scene {
  constructor() {
    this.parts = [];
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }

  // World to screen: +x runs down-right, +y runs down-left, +z runs up.
  p(x, y, z = 0) {
    const sx = (x - y) * COS;
    const sy = (x + y) * 0.5 - z;
    this.mark(sx, sy);
    return [sx, sy];
  }

  mark(x, y) {
    this.minX = Math.min(this.minX, x);
    this.maxX = Math.max(this.maxX, x);
    this.minY = Math.min(this.minY, y);
    this.maxY = Math.max(this.maxY, y);
  }

  add(svg) {
    this.parts.push(svg);
  }

  poly(points, fill, extra = '') {
    const d = points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
    return `<polygon points="${d}" fill="${fill}" ${extra}/>`;
  }

  // A solid block. A same-colour stroke softens its corners.
  box(x, y, z, w, d, h, material = 'blue') {
    const [top, left, right] = MATERIALS[material] || material;
    const soft = (fill) => `stroke="${fill.startsWith('url') ? '#3f63e6' : fill}" stroke-width="1.6" stroke-linejoin="round"`;
    const leftFace = [this.p(x, y + d, z), this.p(x + w, y + d, z), this.p(x + w, y + d, z + h), this.p(x, y + d, z + h)];
    const rightFace = [this.p(x + w, y, z), this.p(x + w, y + d, z), this.p(x + w, y + d, z + h), this.p(x + w, y, z + h)];
    const topFace = [this.p(x, y, z + h), this.p(x + w, y, z + h), this.p(x + w, y + d, z + h), this.p(x, y + d, z + h)];
    return (
      this.poly(leftFace, left, soft(left)) +
      this.poly(rightFace, right, soft(right)) +
      this.poly(topFace, top, soft(top))
    );
  }

  shadow(x, y, z, w, d, length = 70) {
    const points = [
      this.p(x + w, y, z),
      this.p(x + w + length, y + length * 0.34, z),
      this.p(x + w + length, y + d + length * 0.34, z),
      this.p(x + length, y + d + length * 0.34, z),
      this.p(x, y + d, z),
    ];
    return this.poly(points, '#0d1250', 'opacity=".28"');
  }

  platform(x, y, w, d, h = 16, material = 'blue') {
    this.add(this.shadow(x, y, 0, w, d, 80));
    this.add(this.box(x, y, 0, w, d, h, material));
    const edge = [this.p(x, y + d, h), this.p(x + w, y + d, h), this.p(x + w, y, h)];
    this.add(`<polyline points="${edge.map(([a, b]) => `${n(a)},${n(b)}`).join(' ')}" fill="none" stroke="#7fd4ff" stroke-width="1.4" stroke-linejoin="round" opacity=".75"/>`);
  }

  // 2D content on an upright wall running along x, seen from the front left.
  onWallX(x, y, z, content) {
    const [ox, oy] = this.p(x, y, z);
    return `<g transform="matrix(${n(COS * 100) / 100} .5 0 1 ${n(ox)} ${n(oy)})">${content}</g>`;
  }

  // 2D content on an upright wall running along y, seen from the front right.
  // The content origin is the wall's near top corner at (x, y, z).
  onWallY(x, y, z, content) {
    const [ox, oy] = this.p(x, y, z);
    return `<g transform="matrix(${n(COS * 100) / 100} -.5 0 1 ${n(ox)} ${n(oy)})">${content}</g>`;
  }

  onFloor(x, y, z, content) {
    const [ox, oy] = this.p(x, y, z);
    const c = n(COS * 100) / 100;
    return `<g transform="matrix(${c} .5 ${-c} .5 ${n(ox)} ${n(oy)})">${content}</g>`;
  }

  toSVG(title, padding = 26) {
    const x = n(this.minX - padding);
    const y = n(this.minY - padding);
    const w = n(this.maxX - this.minX + padding * 2);
    const h = n(this.maxY - this.minY + padding * 2);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" role="img"><title>${title}</title>${DEFS}${this.parts.join('')}</svg>\n`;
  }
}

const DEFS = `<defs>
<linearGradient id="topBlue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f86ff"/><stop offset="1" stop-color="#3350e0"/></linearGradient>
<linearGradient id="topDeep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3c51d8"/><stop offset="1" stop-color="#2a36ae"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3fc0"/><stop offset="1" stop-color="#5a2fb8"/></linearGradient>
<linearGradient id="screenLight" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e8ff"/></linearGradient>
<linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6d9f"/><stop offset="1" stop-color="#ff6d9f" stop-opacity=".15"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fe9ff" stop-opacity=".6"/><stop offset="1" stop-color="#5f7bff" stop-opacity=".25"/></linearGradient>
<linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#56e0f7" stop-opacity=".55"/><stop offset="1" stop-color="#56e0f7" stop-opacity="0"/></linearGradient>
<radialGradient id="orb" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".42" stop-color="#7ce9ff"/><stop offset="1" stop-color="#3a63ee"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#7ce9ff" stop-opacity=".65"/><stop offset="1" stop-color="#7ce9ff" stop-opacity="0"/></radialGradient>
</defs>
<style>
.f1{animation:f 5s ease-in-out infinite}.f2{animation:f 6.5s ease-in-out -2s infinite}.f3{animation:f 4.2s ease-in-out -1s infinite}
@keyframes f{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
.flow{stroke-dasharray:5 11;animation:d 1.4s linear infinite}
@keyframes d{to{stroke-dashoffset:-32}}
.blink{animation:b 2.6s ease-in-out infinite}.blink2{animation:b 2.6s ease-in-out -1.3s infinite}
@keyframes b{0%,100%{opacity:1}50%{opacity:.35}}
@media (prefers-reduced-motion:reduce){.f1,.f2,.f3,.flow,.blink,.blink2{animation:none}}
</style>`;

const limb = (points, width, color) =>
  `<polyline points="${points.map((v) => v.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

// People are small flat figures, like figures in an architect's drawing.
// pose: stand | point | present | think | phone | type | sit | wave
function person(scene, x, y, z, options = {}) {
  const { pose = 'stand', top = '#ffffff', bottom = '#1d2877', skin = SKIN.a, hair = '#201a3a', style = 'short', flip = false, scale = 1 } = options;
  const [sx, sy] = scene.p(x, y, z);
  scene.mark(sx - 34 * scale, sy - 84 * scale);
  scene.mark(sx + 34 * scale, sy + 6 * scale);
  const shoe = '#ffffff';
  let body = `<ellipse cx="9" cy="1" rx="19" ry="5" fill="#0d1250" opacity=".3"/>`;

  if (pose === 'sit') {
    body += limb([[2, -28], [15, -26], [15, -6]], 7, bottom);
    body += limb([[-3, -28], [11, -24], [9, -5]], 7, bottom);
    body += limb([[15, -3], [20, -3]], 5, shoe);
    body += limb([[9, -2], [14, -2]], 5, shoe);
    body += `<path d="M-8 -53 Q0 -57 8 -53 L7 -26 L-7 -26 Z" fill="${top}" stroke="${top}" stroke-width="2" stroke-linejoin="round"/>`;
    body += limb([[6, -50], [13, -38], [22, -36]], 4.6, top);
    body += limb([[22, -36], [24, -36]], 4.4, skin);
    body += limb([[0, -55], [0, -59]], 5, skin);
    body += `<circle cx="1" cy="-63" r="6" fill="${skin}"/>`;
    body += hairShape(style, hair, 1, -63);
  } else {
    if (style === 'skirt') {
      body += limb([[-3, -34], [-4, -3]], 4.6, skin);
      body += limb([[4, -34], [6, -2]], 4.6, skin);
    } else {
      body += limb([[-2, -36], [-5, -3]], 7.4, bottom);
      body += limb([[4, -36], [7, -2]], 7.4, bottom);
    }
    body += limb([[-5, -1.5], [-1, -1]], 5, shoe);
    body += limb([[7, -0.5], [11, 0]], 5, shoe);
    if (style === 'skirt') {
      body += `<path d="M-7 -40 L8 -40 L12 -20 L-11 -20 Z" fill="${bottom}" stroke="${bottom}" stroke-width="2" stroke-linejoin="round"/>`;
    }
    body += `<path d="M-9 -60 Q0 -64 9 -60 L7 -35 L-7 -35 Z" fill="${top}" stroke="${top}" stroke-width="2" stroke-linejoin="round"/>`;
    const arms = {
      stand: [[[-9, -58], [-11, -44], [-10, -33]], [[9, -58], [11, -44], [10, -33]]],
      point: [[[-9, -58], [-12, -44], [-10, -33]], [[9, -58], [19, -62], [29, -71]]],
      present: [[[-9, -58], [-20, -50], [-29, -56]], [[9, -58], [20, -52], [28, -60]]],
      think: [[[-9, -58], [-12, -44], [-10, -33]], [[9, -58], [13, -48], [4, -62]]],
      phone: [[[-9, -58], [-11, -46], [-3, -46]], [[9, -58], [11, -46], [4, -48]]],
      type: [[[-9, -58], [-13, -46], [-19, -44]], [[9, -58], [8, -46], [-3, -44]]],
      wave: [[[-9, -58], [-12, -44], [-10, -33]], [[9, -58], [17, -70], [15, -80]]],
    }[pose];
    for (const arm of arms) {
      body += limb(arm, 4.8, top);
      const hand = arm[arm.length - 1];
      body += `<circle cx="${hand[0]}" cy="${hand[1]}" r="2.8" fill="${skin}"/>`;
    }
    if (pose === 'phone') body += `<rect x="-3" y="-54" width="7" height="11" rx="1.6" fill="#1d2877"/>`;
    body += limb([[0, -62], [0, -66]], 5, skin);
    body += `<circle cx="1" cy="-71" r="6.4" fill="${skin}"/>`;
    body += hairShape(style, hair, 1, -71);
  }
  const mirror = flip ? -1 : 1;
  scene.add(`<g transform="translate(${n(sx)} ${n(sy)}) scale(${mirror * scale} ${scale})">${body}</g>`);
}

function hairShape(style, color, cx, cy) {
  if (style === 'long' || style === 'skirt') {
    return `<path d="M${cx - 7} ${cy + 9} Q${cx - 9} ${cy - 8} ${cx} ${cy - 8} Q${cx + 8} ${cy - 8} ${cx + 7} ${cy - 2} Q${cx + 1} ${cy - 5} ${cx - 3} ${cy - 3} Q${cx - 4} ${cy + 4} ${cx - 2} ${cy + 9} Z" fill="${color}"/>`;
  }
  if (style === 'bun') {
    return `<circle cx="${cx - 2}" cy="${cy - 9}" r="3.4" fill="${color}"/><path d="M${cx - 7} ${cy} Q${cx - 7} ${cy - 8} ${cx} ${cy - 7.5} Q${cx + 7} ${cy - 7} ${cx + 7} ${cy - 2} Q${cx + 1} ${cy - 5} ${cx - 3} ${cy - 3} Z" fill="${color}"/>`;
  }
  return `<path d="M${cx - 7} ${cy + 1} Q${cx - 8} ${cy - 8} ${cx} ${cy - 8} Q${cx + 8} ${cy - 8} ${cx + 7} ${cy - 2} Q${cx + 1} ${cy - 5} ${cx - 4} ${cy - 3} Z" fill="${color}"/>`;
}

function robot(scene, x, y, z, { scale = 1, wave = false, cls = 'f3' } = {}) {
  const [sx, sy] = scene.p(x, y, z);
  scene.mark(sx - 42 * scale, sy - 104 * scale);
  scene.mark(sx + 42 * scale, sy + 8 * scale);
  scene.add(`<ellipse cx="${n(sx + 6)}" cy="${n(sy + 2)}" rx="${26 * scale}" ry="${10 * scale}" fill="#0d1250" opacity=".32"/>`);
  const arm = wave
    ? limb([[23, -53], [36, -66], [37, -80]], 6, '#c6d6f7')
    : limb([[23, -53], [31, -42], [29, -31]], 6, '#c6d6f7');
  scene.add(`<g class="${cls}"><g transform="translate(${n(sx)} ${n(sy)}) scale(${scale})">
<ellipse cx="0" cy="-10" rx="13" ry="5" fill="url(#glow)"/>
<path d="M-23 -60 Q0 -68 23 -60 L18 -24 Q0 -14 -18 -24 Z" fill="url(#screenLight)"/>
<path d="M18 -24 Q0 -14 -18 -24 L-19 -29 Q0 -19 19 -29 Z" fill="#9db4ea"/>
<circle cx="0" cy="-42" r="8" fill="#2b3fc0"/><circle class="blink" cx="0" cy="-42" r="4" fill="#56e0f7"/>
${limb([[-23, -53], [-31, -42], [-29, -31]], 6, '#c6d6f7')}${arm}
<rect x="-27" y="-96" width="54" height="34" rx="14" fill="url(#screenLight)"/>
<rect x="-20" y="-90" width="40" height="22" rx="10" fill="#20307f"/>
<circle class="blink" cx="-8" cy="-79" r="3.6" fill="#56e0f7"/><circle class="blink" cx="8" cy="-79" r="3.6" fill="#56e0f7"/>
${limb([[0, -96], [0, -104]], 2.4, '#c6d6f7')}<circle class="blink2" cx="0" cy="-106" r="3.2" fill="#ff78a6"/>
</g></g>`);
}

const lines = (rows, x, y, gap, height, color, widths) =>
  rows
    .map((_, i) => `<rect x="${x}" y="${y + i * gap}" width="${widths[i % widths.length]}" height="${height}" rx="${height / 2}" fill="${color}"/>`)
    .join('');

const chartContent = (w, h) => {
  const b = h - 16;
  const curve = `M0 ${b * 0.8} C${w * 0.18} ${b * 0.8} ${w * 0.22} ${b * 0.3} ${w * 0.4} ${b * 0.42} S${w * 0.62} ${b * 0.72} ${w * 0.74} ${b * 0.4} S${w * 0.9} ${b * 0.12} ${w} ${b * 0.1}`;
  return `<path d="${curve} L${w} ${b} L0 ${b} Z" fill="url(#area)"/><path d="${curve}" fill="none" stroke="#ff9cc0" stroke-width="3"/><circle class="blink" cx="${w * 0.74}" cy="${b * 0.4}" r="5" fill="#fff"/>`;
};

function barChart(w, h, count = 6) {
  const heights = [0.4, 0.62, 0.5, 0.78, 0.66, 0.92, 0.74];
  const gap = w / count;
  return Array.from({ length: count }, (_, i) => {
    const bar = heights[i % heights.length] * h;
    const fill = i % 2 ? '#56e0f7' : '#ff78a6';
    return `<rect x="${n(i * gap + gap * 0.18)}" y="${n(h - bar)}" width="${n(gap * 0.62)}" height="${n(bar)}" rx="2.4" fill="${fill}"/>`;
  }).join('');
}

// A large screen on a stand, its face turned to the front left.
function monitor(scene, x, y, z, w, h, content, { depth = 12, lift = 34 } = {}) {
  const mid = x + w / 2;
  scene.add(scene.box(mid - 46, y - 18, z, 92, 52, 7, 'ink'));
  scene.add(scene.box(mid - 13, y, z + 7, 26, 11, lift, 'ink'));
  scene.add(scene.box(x, y, z + lift, w, depth, h, 'ink'));
  const inset = 7;
  scene.add(
    scene.onWallX(
      x,
      y + depth,
      z + lift + h,
      `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" rx="5" fill="url(#screen)"/><g transform="translate(${inset + 10} ${inset + 10})">${content(w - inset * 2 - 20, h - inset * 2 - 20)}</g>`,
    ),
  );
}

function desk(scene, x, y, z, w, d, h = 42) {
  scene.add(scene.box(x + 6, y + 6, z, w - 12, d - 12, h - 6, 'deep'));
  scene.add(scene.box(x, y, z + h - 6, w, d, 6, 'cyan'));
}

function laptop(scene, x, y, z, content = 'bars') {
  scene.add(scene.box(x, y, z, 46, 32, 2.5, 'white'));
  scene.add(scene.box(x, y - 2, z + 2, 46, 2.5, 30, 'ink'));
  const body = content === 'bars' ? `<g transform="translate(5 5)">${barChart(30, 18, 5)}</g>` : `<g transform="translate(5 5)">${lines([0, 1, 2, 3], 0, 0, 5.4, 2.4, '#a9e9ff', [30, 22, 34, 18])}</g>`;
  scene.add(scene.onWallX(x + 2, y + 0.5, z + 32, `<rect width="42" height="28" rx="2" fill="url(#screen)"/>${body}`));
}

function seat(scene, x, y, z) {
  scene.add(scene.box(x, y, z, 34, 34, 15, 'deep'));
  scene.add(scene.box(x, y, z + 15, 34, 34, 9, 'pink'));
}

function stack(scene, x, y, z = 0, size = 60) {
  scene.add(scene.shadow(x, y, z, size, size, 40));
  scene.add(scene.box(x, y, z, size, size, 16, 'blue'));
  scene.add(scene.box(x, y, z + 16, size, size, 5, 'pink'));
  scene.add(scene.box(x, y, z + 21, size, size, 12, 'blue'));
  scene.add(scene.box(x, y, z + 33, size, size, 5, 'pink'));
  scene.add(scene.box(x, y, z + 38, size, size, 14, 'blue'));
}

function board(scene, x, y, z, w, h, content) {
  const [ax, ay] = scene.p(x + 8, y + 6, z);
  const [bx, by] = scene.p(x + w - 8, y + 6, z);
  const [cx, cy] = scene.p(x + w / 2, y - 14, z);
  const [tx, ty] = scene.p(x + w / 2, y, z + h + 28);
  scene.add(`<path d="M${n(ax)} ${n(ay)} L${n(tx)} ${n(ty)} L${n(bx)} ${n(by)} M${n(cx)} ${n(cy)} L${n(tx)} ${n(ty)}" stroke="#141b5c" stroke-width="3.4" fill="none" stroke-linecap="round"/>`);
  scene.add(scene.box(x, y, z + 28, w, 5, h, 'ink'));
  scene.add(scene.onWallX(x + 3, y + 5, z + 28 + h - 3, `<rect width="${w - 6}" height="${h - 6}" rx="3" fill="url(#screenLight)"/><g transform="translate(9 9)">${content(w - 24, h - 24)}</g>`));
}

// A translucent card that hovers in the air.
function card(scene, x, y, z, w, h, content, { wall = 'y', cls = 'f1' } = {}) {
  const face = `<rect width="${w}" height="${h}" rx="7" fill="url(#glass)" stroke="#a9e9ff" stroke-width="1.6"/><g transform="translate(${w * 0.16} ${h * 0.16})">${content(w * 0.68, h * 0.68)}</g>`;
  scene.p(x, y + w, z - h);
  scene.p(x + w, y, z);
  scene.add(`<g class="${cls}">${wall === 'y' ? scene.onWallY(x, y + w, z, face) : scene.onWallX(x, y, z, face)}</g>`);
}

function flowLine(scene, points, color = '#56e0f7') {
  const d = points.map(([x, y, z = 0]) => scene.p(x, y, z)).map(([a, b]) => `${n(a)},${n(b)}`).join(' ');
  scene.add(`<polyline class="flow" points="${d}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`);
}

function cylinder(scene, x, y, z, r, h, tone = 'cyan') {
  const [sx, sy] = scene.p(x, y, z);
  const rx = r * 1.22;
  const ry = r * 0.7;
  const [top, side, dark] = MATERIALS[tone];
  scene.mark(sx - rx, sy + ry);
  scene.mark(sx + rx, sy - h - ry);
  return (
    `<path d="M${n(sx - rx)} ${n(sy - h)} L${n(sx - rx)} ${n(sy)} A${n(rx)} ${n(ry)} 0 0 0 ${n(sx + rx)} ${n(sy)} L${n(sx + rx)} ${n(sy - h)} Z" fill="${side}"/>` +
    `<path d="M${n(sx)} ${n(sy - h + ry)} L${n(sx)} ${n(sy + ry)} A${n(rx)} ${n(ry)} 0 0 0 ${n(sx + rx)} ${n(sy)} L${n(sx + rx)} ${n(sy - h)} A${n(rx)} ${n(ry)} 0 0 1 ${n(sx)} ${n(sy - h + ry)} Z" fill="${dark}"/>` +
    `<ellipse cx="${n(sx)}" cy="${n(sy - h)}" rx="${n(rx)}" ry="${n(ry)}" fill="${top}"/>`
  );
}

function database(scene, x, y, z, r = 44) {
  scene.add(scene.shadow(x - r, y - r, z, r * 2, r * 2, 40));
  for (let i = 0; i < 3; i++) {
    scene.add(cylinder(scene, x, y, z + i * 36, r, 28, i === 1 ? 'pink' : 'cyan'));
    const [sx, sy] = scene.p(x, y, z + i * 36 + 14);
    scene.add(`<circle class="blink" cx="${n(sx + r * 0.72)}" cy="${n(sy + r * 0.5)}" r="3" fill="#fff"/>`);
  }
}

// The centrepiece: an AI chip on a pedestal with a glowing core above it.
function aiCore(scene, x, y, z, size = 150) {
  scene.add(scene.box(x - 16, y - 16, z, size + 32, size + 32, 14, 'deep'));
  const pin = size / 7;
  for (let i = 1; i < 7; i++) {
    scene.add(scene.box(x + i * pin - 4, y + size, z + 16, 8, 16, 4, 'gold'));
    scene.add(scene.box(x + size, y + i * pin - 4, z + 16, 16, 8, 4, 'gold'));
  }
  scene.add(scene.box(x, y, z + 14, size, size, 18, 'ink'));
  scene.add(scene.box(x + 14, y + 14, z + 32, size - 28, size - 28, 5, 'cyan'));
  const u = size - 28;
  const letters = `<g fill="#1d2877"><path d="M${u * 0.16} ${u * 0.76} L${u * 0.36} ${u * 0.24} L${u * 0.46} ${u * 0.24} L${u * 0.66} ${u * 0.76} L${u * 0.54} ${u * 0.76} L${u * 0.5} ${u * 0.64} L${u * 0.32} ${u * 0.64} L${u * 0.28} ${u * 0.76} Z M${u * 0.35} ${u * 0.54} L${u * 0.47} ${u * 0.54} L${u * 0.41} ${u * 0.37} Z" fill-rule="evenodd"/><rect x="${u * 0.72}" y="${u * 0.24}" width="${u * 0.11}" height="${u * 0.52}"/></g>`;
  scene.add(scene.onFloor(x + 14, y + 14, z + 37, letters));

  const [cx, cy] = scene.p(x + size / 2, y + size / 2, z + 37);
  const lift = 120;
  scene.mark(cx - 80, cy - lift - 70);
  scene.add(`<path d="M${n(cx - 62)} ${n(cy)} L${n(cx - 26)} ${n(cy - lift)} L${n(cx + 26)} ${n(cy - lift)} L${n(cx + 62)} ${n(cy)} Q${n(cx)} ${n(cy + 34)} ${n(cx - 62)} ${n(cy)} Z" fill="url(#beam)"/>`);
  scene.add(`<g class="f3"><circle cx="${n(cx)}" cy="${n(cy - lift)}" r="82" fill="url(#glow)"/><ellipse cx="${n(cx)}" cy="${n(cy - lift)}" rx="66" ry="24" fill="none" stroke="#ffd36e" stroke-width="3" opacity=".9"/><circle cx="${n(cx)}" cy="${n(cy - lift)}" r="38" fill="url(#orb)"/><path d="M${n(cx - 66)} ${n(cy - lift)} A66 24 0 0 0 ${n(cx + 66)} ${n(cy - lift)}" fill="none" stroke="#ffd36e" stroke-width="3"/><circle class="blink" cx="${n(cx + 60)}" cy="${n(cy - lift + 10)}" r="6" fill="#ff78a6"/></g>`);
}

const code = (w, h) => {
  const colors = ['#56e0f7', '#ff9cc0', '#ffd36e', '#a9e9ff'];
  const rows = Math.floor(h / 15);
  const widths = [0.5, 0.82, 0.66, 0.92, 0.42, 0.74, 0.58];
  return Array.from({ length: rows }, (_, i) => {
    const indent = [0, 16, 16, 32, 16, 0, 16][i % 7];
    return `<rect x="${indent}" y="${i * 15}" width="${n(w * widths[i % 7] - indent)}" height="6" rx="3" fill="${colors[i % 4]}" class="${i % 3 ? '' : 'blink'}"/>`;
  }).join('');
};

const check = (x, y, on = true) =>
  `<circle cx="${x}" cy="${y}" r="7" fill="${on ? '#3ddc97' : '#c6d6f7'}"/><path d="M${x - 3.2} ${y} l2.4 2.6 l4.2 -4.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

const icon = {
  chart: (w, h) => barChart(w, h, 4),
  chat: (w, h) => `<path d="M2 0 H${w - 2} Q${w} 0 ${w} 2 V${h * 0.7} Q${w} ${h * 0.72} ${w - 2} ${h * 0.72} H${w * 0.42} L${w * 0.2} ${h} V${h * 0.72} H2 Q0 ${h * 0.72} 0 ${h * 0.7} V2 Q0 0 2 0 Z" fill="#ffffff"/><circle cx="${w * 0.28}" cy="${h * 0.36}" r="${w * 0.07}" fill="#3350e0"/><circle cx="${w * 0.5}" cy="${h * 0.36}" r="${w * 0.07}" fill="#ff78a6"/><circle cx="${w * 0.72}" cy="${h * 0.36}" r="${w * 0.07}" fill="#3350e0"/>`,
  doc: (w, h) => `<rect width="${w}" height="${h}" rx="3" fill="#fff"/>${lines([0, 1, 2, 3], w * 0.14, h * 0.18, h * 0.19, h * 0.07, '#3350e0', [w * 0.72, w * 0.56, w * 0.72, w * 0.4])}`,
  gear: (w, h) => {
    const r = Math.min(w, h) / 2;
    const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="${n(-r * 0.15)}" y="${n(-r)}" width="${n(r * 0.3)}" height="${n(r * 0.4)}" rx="1.4" transform="rotate(${i * 45})"/>`).join('');
    return `<g transform="translate(${w / 2} ${h / 2})" fill="#fff">${teeth}<circle r="${n(r * 0.68)}"/><circle r="${n(r * 0.28)}" fill="#3350e0"/></g>`;
  },
  check: (w, h) => `<circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}" fill="#3ddc97"/><path d="M${w * 0.28} ${h * 0.52} l${w * 0.16} ${h * 0.17} l${w * 0.3} ${h * 0.34 * -1}" stroke="#fff" stroke-width="${w * 0.1}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  code: (w, h) => `<path d="M${w * 0.34} ${h * 0.2} L0 ${h / 2} L${w * 0.34} ${h * 0.8} M${w * 0.66} ${h * 0.2} L${w} ${h / 2} L${w * 0.66} ${h * 0.8}" stroke="#fff" stroke-width="${w * 0.11}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
};

// Scenes

function hero() {
  const s = new Scene();
  // Back: analytics screen.
  s.platform(20, -60, 340, 250);
  monitor(s, 44, 20, 16, 292, 196, (w, h) => chartContent(w, h) + lines([0, 1], 0, h - 8, 8, 3, '#a9e9ff', [w * 0.6, w * 0.4]));
  person(s, 300, 136, 16, { pose: 'point', top: '#ffd36e', style: 'skirt', bottom: '#ff5f97', hair: '#3a1f2e', skin: SKIN.c, flip: true });

  // Right: AI core.
  s.platform(400, -30, 270, 270);
  aiCore(s, 460, 30, 16, 150);

  flowLine(s, [[340, 90, 8], [400, 90, 8]]);
  flowLine(s, [[535, 240, 8], [535, 330, 8]]);
  flowLine(s, [[190, 180, 8], [190, 270, 8]]);

  stack(s, 330, 212, 0, 58);

  // Left: strategy session.
  s.platform(30, 270, 290, 250);
  board(s, 150, 300, 16, 110, 84, (w, h) => barChart(w, h * 0.92, 5));
  person(s, 118, 340, 16, { pose: 'present', top: '#ffffff', bottom: '#20307f', hair: '#201a3a' });
  seat(s, 66, 420, 16);
  person(s, 84, 432, 40, { pose: 'sit', top: '#56e0f7', style: 'short', hair: '#3a2a20', skin: SKIN.b });
  seat(s, 196, 430, 16);
  person(s, 212, 442, 40, { pose: 'sit', top: '#ff78a6', style: 'long', hair: '#201a3a', skin: SKIN.a });

  // Front: developers and the agent.
  s.platform(390, 330, 310, 230);
  desk(s, 430, 362, 16, 200, 66);
  laptop(s, 462, 384, 58);
  laptop(s, 552, 384, 58, 'code');
  person(s, 496, 462, 16, { pose: 'type', top: '#ffffff', bottom: '#1d2877', style: 'bun', hair: '#2a1a2e', skin: SKIN.c, flip: true });
  person(s, 590, 470, 16, { pose: 'type', top: '#ffd36e', bottom: '#20307f', hair: '#201a3a', skin: SKIN.b, flip: true });
  robot(s, 672, 490, 16, { wave: true, scale: 0.86 });

  card(s, 716, -120, 250, 80, 80, icon.chat, { cls: 'f2' });
  card(s, 400, -190, 250, 70, 70, icon.gear, { cls: 'f1' });
  card(s, 770, 230, 100, 70, 70, icon.code, { cls: 'f3' });
  return s.toSVG('People and an AI robot working around a data screen, an AI chip, a planning board and laptops');
}

function consult() {
  const s = new Scene();
  s.platform(0, 0, 400, 340);
  board(s, 150, 40, 16, 180, 128, (w, h) =>
    `<rect width="${w}" height="${h}" fill="none"/>${check(9, 12)}${check(9, 40)}${check(9, 68, false)}${lines([0, 1, 2], 24, 8, 28, 8, '#3350e0', [w * 0.7, w * 0.54, w * 0.62])}`);
  person(s, 106, 110, 16, { pose: 'present', top: '#ffffff', bottom: '#20307f', scale: 1.25 });
  seat(s, 60, 240, 16);
  person(s, 78, 252, 40, { pose: 'sit', top: '#ff78a6', style: 'long', hair: '#201a3a', scale: 1.25 });
  seat(s, 210, 256, 16);
  person(s, 226, 268, 40, { pose: 'sit', top: '#56e0f7', hair: '#3a2a20', skin: SKIN.b, scale: 1.25 });
  stack(s, 442, 160, 0, 74);
  card(s, 420, 30, 210, 88, 88, icon.chart, { cls: 'f1' });
  card(s, 20, 20, 190, 78, 78, icon.check, { wall: 'x', cls: 'f2' });
  return s.toSVG('A consultant presenting a roadmap checklist to two clients');
}

function web() {
  const s = new Scene();
  s.platform(0, 0, 440, 330);
  monitor(s, 40, 60, 16, 320, 196, (w, h) =>
    `<circle cx="6" cy="5" r="4" fill="#ff78a6"/><circle cx="20" cy="5" r="4" fill="#ffd36e"/><circle cx="34" cy="5" r="4" fill="#3ddc97"/>
<rect y="18" width="${w * 0.54}" height="${h * 0.44}" rx="4" fill="#56e0f7"/>${lines([0, 1, 2], w * 0.6, 22, 16, 7, '#ffffff', [w * 0.38, w * 0.32, w * 0.22])}
<rect y="${h * 0.7}" width="${w * 0.3}" height="${h * 0.3}" rx="4" fill="#ff78a6"/><rect x="${w * 0.35}" y="${h * 0.7}" width="${w * 0.3}" height="${h * 0.3}" rx="4" fill="#ffd36e"/><rect x="${w * 0.7}" y="${h * 0.7}" width="${w * 0.3}" height="${h * 0.3}" rx="4" fill="#a9e9ff"/>`);
  person(s, 150, 214, 16, { pose: 'point', top: '#ffffff', style: 'skirt', bottom: '#ff5f97', hair: '#201a3a', skin: SKIN.c, scale: 1.25, flip: true });
  desk(s, 250, 220, 16, 150, 62);
  laptop(s, 300, 238, 58, 'code');
  person(s, 336, 306, 16, { pose: 'type', top: '#ffd36e', bottom: '#20307f', skin: SKIN.b, scale: 1.25, flip: true });

  // Phone standing beside the platform.
  s.add(s.box(486, 130, 0, 96, 9, 176, 'ink'));
  s.add(s.onWallX(486, 139, 176, `<rect x="6" y="6" width="84" height="164" rx="8" fill="url(#screenLight)"/><rect x="14" y="18" width="68" height="58" rx="5" fill="#3f6df0"/>${lines([0, 1, 2], 14, 90, 18, 10, '#ff78a6', [68, 52, 62])}`));
  card(s, 470, -30, 250, 80, 80, icon.code, { cls: 'f1' });
  return s.toSVG('A team building a website on a large screen with a mobile app version beside it');
}

function custom() {
  const s = new Scene();
  s.platform(0, 0, 330, 300);
  aiCore(s, 76, 60, 16, 170);
  s.platform(390, -20, 220, 210);
  database(s, 500, 80, 16, 50);
  s.platform(370, 250, 240, 170);
  desk(s, 410, 276, 16, 150, 58);
  laptop(s, 462, 292, 58);
  person(s, 500, 360, 16, { pose: 'type', top: '#ff78a6', style: 'long', hair: '#201a3a', scale: 1.2, flip: true });
  flowLine(s, [[330, 90, 8], [390, 90, 8]]);
  flowLine(s, [[500, 190, 8], [500, 250, 8]]);
  card(s, 120, -60, 230, 74, 92, icon.doc, { cls: 'f2' });
  card(s, 620, 40, 230, 74, 92, icon.doc, { cls: 'f1' });
  return s.toSVG('An AI chip connected to a database and to an analyst working on a laptop');
}

function agents() {
  const s = new Scene();
  const spots = [
    [70, 0, 'chart'],
    [360, -30, 'gear'],
    [380, 290, 'doc'],
    [50, 300, 'check'],
  ];
  for (const [x, y] of spots.slice(0, 2)) s.platform(x, y, 180, 180, 14, 'deep');
  s.platform(170, 100, 260, 260);
  for (const [x, y] of spots.slice(2)) s.platform(x, y, 180, 180, 14, 'deep');
  for (const [x, y] of spots) flowLine(s, [[x + 90, y + 90, 15], [300, 230, 17]], '#ffd36e');

  const pedestal = (x, y, kind) => {
    s.add(s.box(x + 56, y + 56, 14, 68, 68, 12, 'cyan'));
    card(s, x + 52, y + 54, 124, 76, 76, icon[kind], { cls: 'f2' });
  };
  pedestal(spots[0][0], spots[0][1], spots[0][2]);
  pedestal(spots[1][0], spots[1][1], spots[1][2]);
  const [cx, cy] = s.p(300, 230, 16);
  s.add(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="108" ry="58" fill="none" stroke="#56e0f7" stroke-width="2.4" opacity=".8"/><ellipse class="blink" cx="${n(cx)}" cy="${n(cy)}" rx="76" ry="40" fill="#56e0f7" opacity=".3"/>`);
  robot(s, 300, 230, 16, { scale: 1.45, wave: true });
  person(s, spots[3][0] + 90, spots[3][1] + 100, 14, { pose: 'phone', top: '#ffd36e', style: 'bun', hair: '#201a3a', scale: 1.2 });
  robot(s, spots[2][0] + 90, spots[2][1] + 90, 14, { scale: 0.9, cls: 'f1' });
  return s.toSVG('A central AI agent robot directing smaller agents, tools and a human approver');
}

function chat() {
  const s = new Scene();
  s.platform(0, 0, 430, 330);
  monitor(s, 90, 40, 16, 200, 250, (w, h) => {
    const bubble = (x, y, width, fill, tone) =>
      `<rect x="${x}" y="${y}" width="${width}" height="38" rx="12" fill="${fill}"/>${lines([0, 1], x + 12, y + 11, 11, 5, tone, [width - 28, width - 54])}`;
    return `<rect width="${w}" height="${h}" rx="8" fill="#ffffff" opacity=".1"/>${bubble(6, 10, 118, '#ffffff', '#3350e0')}${bubble(w - 126, 60, 120, '#56e0f7', '#1d2877')}${bubble(6, 110, 128, '#ffffff', '#3350e0')}${bubble(w - 110, 160, 104, '#ff78a6', '#ffffff')}`;
  }, { lift: 22 });
  robot(s, 330, 180, 16, { scale: 1.35, wave: true });
  person(s, 150, 262, 16, { pose: 'phone', top: '#ffffff', style: 'skirt', bottom: '#ff5f97', hair: '#201a3a', skin: SKIN.c, scale: 1.25 });
  person(s, 268, 292, 16, { pose: 'think', top: '#ffd36e', bottom: '#20307f', skin: SKIN.b, scale: 1.25, flip: true });
  stack(s, 470, 220, 0, 62);
  card(s, 440, -20, 250, 96, 86, icon.chat, { cls: 'f1' });
  card(s, 520, 110, 150, 70, 64, icon.check, { cls: 'f3' });
  return s.toSVG('A support robot chatting on a large screen while two customers read answers on their phones');
}

mkdirSync(OUT, { recursive: true });
const scenes = { hero, consult, web, custom, agents, chat };
for (const [name, build] of Object.entries(scenes)) {
  const svg = build();
  writeFileSync(join(OUT, `${name}.svg`), svg);
  console.log(name, Math.round(svg.length / 1024), 'KB');
}
