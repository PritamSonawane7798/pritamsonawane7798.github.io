// Every 3D form on the page is a cloud of the same number of points, so the
// scene can morph any form into any other. Forms are described as weighted
// primitives (line segments and spheres) and then sampled by size.

const TAU = Math.PI * 2;

class Form {
  constructor() {
    this.items = [];
  }

  // Add a sampler; `size` decides what share of the points it receives.
  add(size, sample) {
    this.items.push({ size, sample });
  }

  seg(a, b, { weight = 1, depth = 0, fuzz = 0.018 } = {}) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0));
    this.add(length * weight, () => {
      const t = Math.random();
      return [
        a[0] + (b[0] - a[0]) * t + (Math.random() - 0.5) * fuzz,
        a[1] + (b[1] - a[1]) * t + (Math.random() - 0.5) * fuzz,
        (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t + (Math.random() - 0.5) * (depth + fuzz),
      ];
    });
  }

  path(points, options) {
    for (let i = 0; i < points.length - 1; i++) this.seg(points[i], points[i + 1], options);
  }

  circle(cx, cy, z, r, options, steps = 72) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    }
    this.path(points, options);
  }

  roundRect(cx, cy, z, w, h, r, options) {
    const x = w / 2 - r;
    const y = h / 2 - r;
    const points = [];
    const corners = [[x, y, 0], [-x, y, 1], [-x, -y, 2], [x, -y, 3]];
    for (const [ox, oy, quarter] of corners) {
      for (let i = 0; i <= 10; i++) {
        const a = ((quarter + i / 10) * Math.PI) / 2;
        points.push([cx + ox + Math.cos(a) * r, cy + oy + Math.sin(a) * r, z]);
      }
    }
    points.push(points[0]);
    this.path(points, options);
  }

  // A filled area drawn as closely spaced horizontal lines.
  fill(cx, cy, z, w, h, options, rows = 14) {
    for (let i = 0; i < rows; i++) {
      const y = cy - h / 2 + (h * (i + 0.5)) / rows;
      this.seg([cx - w / 2, y, z], [cx + w / 2, y, z], options);
    }
  }

  sphere(c, r, weight = 1) {
    this.add(r * r * 12 * weight, () => {
      const y = Math.random() * 2 - 1;
      const a = Math.random() * TAU;
      const s = Math.sqrt(1 - y * y);
      const k = r * (0.96 + Math.random() * 0.08);
      return [c[0] + Math.cos(a) * s * k, c[1] + y * k, c[2] + Math.sin(a) * s * k];
    });
  }

  sample(count) {
    const out = new Float32Array(count * 3);
    const cumulative = [];
    let total = 0;
    for (const item of this.items) {
      total += item.size;
      cumulative.push(total);
    }
    for (let i = 0; i < count; i++) {
      const pick = Math.random() * total;
      let lo = 0;
      let hi = cumulative.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cumulative[mid] < pick) lo = mid + 1;
        else hi = mid;
      }
      out.set(this.items[lo].sample(), i * 3);
    }
    return out;
  }
}

function core(count) {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const roll = i / count;
    let x, y, z;
    if (roll < 0.72) {
      // Rippled shell.
      const v = 1 - (i / (count * 0.72)) * 2;
      const s = Math.sqrt(1 - v * v);
      const a = i * golden;
      const ripple = 1 + 0.09 * Math.sin(v * 9 + a * 0.02) + 0.05 * Math.sin(a * 3.1 + v * 5);
      const r = 1.75 * ripple;
      x = Math.cos(a) * s * r;
      y = v * r;
      z = Math.sin(a) * s * r;
    } else if (roll < 0.86) {
      // Dense glowing centre.
      const r = 0.7 * Math.cbrt(Math.random());
      const a = Math.random() * TAU;
      const v = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - v * v);
      x = Math.cos(a) * s * r;
      y = v * r;
      z = Math.sin(a) * s * r;
    } else {
      // Tilted orbit ring.
      const a = Math.random() * TAU;
      const r = 2.35 + (Math.random() - 0.5) * 0.12;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      x = px;
      y = pz * 0.34 + (Math.random() - 0.5) * 0.03;
      z = pz * 0.94;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

function compass(count) {
  const f = new Form();
  f.circle(0, 0, 0.12, 2.15, { weight: 1.3 });
  f.circle(0, 0, -0.12, 2.15, { weight: 1.3 });
  f.circle(0, 0, 0, 1.55, { weight: 0.45 });
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const inner = i % 9 === 0 ? 1.72 : 1.92;
    f.seg(
      [Math.cos(a) * inner, Math.sin(a) * inner, 0],
      [Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0],
      { weight: 1.2 },
    );
  }
  // Four point star, tilted like a needle finding its heading.
  const turn = 0.46;
  for (let i = 0; i < 8; i++) {
    const a = turn + (i / 8) * TAU;
    const nextA = turn + ((i + 1) / 8) * TAU;
    const r = i % 2 === 0 ? (i === 0 ? 1.85 : 1.35) : 0.26;
    const nextR = (i + 1) % 2 === 0 ? ((i + 1) % 8 === 0 ? 1.85 : 1.35) : 0.26;
    const tip = [Math.cos(a) * r, Math.sin(a) * r, 0];
    const next = [Math.cos(nextA) * nextR, Math.sin(nextA) * nextR, 0];
    f.seg(tip, next, { weight: 2 });
    // Faces rise to a raised centre.
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      f.seg(
        [tip[0] * t, tip[1] * t, 0.42 * (1 - t)],
        [next[0] * t, next[1] * t, 0.42 * (1 - t)],
        { weight: 1.1 },
      );
    }
  }
  return f.sample(count);
}

function windows(count) {
  const f = new Form();
  const frame = (cx, cy, z, w, h, weight) => {
    f.roundRect(cx, cy, z, w, h, 0.14, { weight: 1.5 * weight, depth: 0.05 });
    const top = cy + h / 2 - 0.3;
    f.seg([cx - w / 2, top, z], [cx + w / 2, top, z], { weight: weight });
    for (let i = 0; i < 3; i++) {
      f.circle(cx - w / 2 + 0.22 + i * 0.17, top + 0.15, z, 0.05, { weight: 3 * weight }, 14);
    }
  };

  frame(-0.75, 0.8, -1.3, 3.2, 2.2, 0.5);
  frame(-0.25, 0.3, -0.65, 3.2, 2.2, 0.7);
  frame(0.2, -0.2, 0, 3.4, 2.4, 1);

  // Page content on the front window.
  f.fill(-0.45, 0.25, 0, 1.6, 0.7, { weight: 0.55 }, 12);
  f.seg([0.55, 0.45, 0], [1.6, 0.45, 0], { weight: 1.6 });
  f.seg([0.55, 0.25, 0], [1.6, 0.25, 0], { weight: 1.6 });
  f.seg([0.55, 0.05, 0], [1.25, 0.05, 0], { weight: 1.6 });
  for (let i = 0; i < 3; i++) {
    f.roundRect(-0.9 + i * 1.07, -0.8, 0, 0.92, 0.6, 0.06, { weight: 1.3 });
  }

  // A phone in front, for the application half of the service.
  f.roundRect(1.75, -0.75, 0.95, 0.9, 1.75, 0.14, { weight: 2.2, depth: 0.05 });
  f.fill(1.75, -0.35, 0.95, 0.66, 0.5, { weight: 0.8 }, 7);
  for (let i = 0; i < 3; i++) {
    f.seg([1.47, -0.8 - i * 0.2, 0.95], [2.03, -0.8 - i * 0.2, 0.95], { weight: 2 });
  }
  return f.sample(count);
}

function chip(count) {
  const f = new Form();
  for (const z of [0.16, -0.16]) f.roundRect(0, 0, z, 2.9, 2.9, 0.2, { weight: 1.5 });
  f.roundRect(0, 0, 0.16, 1.75, 1.75, 0.1, { weight: 1.6 });
  f.fill(0, 0, -0.16, 2.8, 2.8, { weight: 0.12 }, 18);

  // Pins and circuit traces on all four sides.
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const cos = Math.round(Math.cos(a));
    const sin = Math.round(Math.sin(a));
    const place = (along, out, z) => [cos * out - sin * along, sin * out + cos * along, z];
    for (let i = 0; i < 7; i++) {
      const along = -1.14 + i * 0.38;
      f.seg(place(along, 1.45, 0), place(along, 2.0, 0), { weight: 1.8, depth: 0.12 });
      f.seg(place(along * 0.62, 0.9, 0.16), place(along, 1.3, 0.16), { weight: 0.8 });
    }
  }

  // "AI" lettering, the reason this chip is on the page.
  const letter = { weight: 3.6, depth: 0.16, fuzz: 0.05 };
  f.path([[-0.62, -0.42, 0.22], [-0.27, 0.42, 0.22], [0.08, -0.42, 0.22]], letter);
  f.seg([-0.47, -0.1, 0.22], [-0.07, -0.1, 0.22], letter);
  f.seg([0.46, -0.42, 0.22], [0.46, 0.42, 0.22], letter);
  f.seg([0.3, 0.42, 0.22], [0.62, 0.42, 0.22], letter);
  f.seg([0.3, -0.42, 0.22], [0.62, -0.42, 0.22], letter);
  return f.sample(count);
}

function agents(count) {
  const f = new Form();
  const hub = [0, 0, 0];
  const nodes = [
    [1.95, 0.85, 0.35],
    [1.2, -1.55, -0.45],
    [-0.75, -1.85, 0.55],
    [-2.05, -0.3, -0.35],
    [-1.3, 1.5, 0.45],
    [0.55, 1.95, -0.55],
  ];
  f.sphere(hub, 0.62, 1.1);
  nodes.forEach((node, i) => {
    f.sphere(node, 0.3, 2);
    f.seg(hub, node, { weight: 1.6, fuzz: 0.03 });
    f.seg(node, nodes[(i + 1) % nodes.length], { weight: 0.75, fuzz: 0.025 });
  });
  // Agents hand work directly to one another, not only through the hub.
  f.seg(nodes[0], nodes[3], { weight: 0.3, fuzz: 0.02 });
  f.seg(nodes[1], nodes[4], { weight: 0.3, fuzz: 0.02 });
  return f.sample(count);
}

function chat(count) {
  const f = new Form();
  const solid = { weight: 1.5, depth: 0.28 };

  // Large bubble with a tail at the lower left.
  f.roundRect(-0.25, 0.4, 0.3, 3.5, 2.3, 0.55, solid);
  f.path([[-1.35, -0.75, 0.3], [-1.75, -1.5, 0.3], [-0.55, -0.75, 0.3]], solid);
  for (const x of [-1.05, -0.25, 0.55]) {
    f.circle(x, 0.4, 0.3, 0.27, { weight: 3 }, 28);
    f.sphere([x, 0.4, 0.3], 0.2, 3);
  }

  // Reply bubble behind, at the lower right.
  f.roundRect(1.05, -1.15, -0.65, 2.3, 1.35, 0.42, { weight: 0.95, depth: 0.2 });
  f.path([[1.5, -1.82, -0.65], [1.95, -2.3, -0.65], [0.95, -1.82, -0.65]], { weight: 0.95, depth: 0.2 });
  for (let i = 0; i < 3; i++) {
    f.seg([0.3, -0.85 - i * 0.3, -0.65], [1.8 - i * 0.3, -0.85 - i * 0.3, -0.65], { weight: 0.95 });
  }
  return f.sample(count);
}

function galaxy(count) {
  const out = new Float32Array(count * 3);
  const arms = 3;
  const tilt = 1.12;
  for (let i = 0; i < count; i++) {
    const r = 3.9 * Math.pow(Math.random(), 1.5) + 0.08;
    const arm = (i % arms) * (TAU / arms);
    const spin = r * 1.25;
    const spread = 0.42 * Math.pow(Math.random(), 2.2) * (Math.random() < 0.5 ? 1 : -1);
    const a = arm + spin + spread * (1.6 + r * 0.2);
    const x = Math.cos(a) * r;
    const y = (Math.random() - 0.5) * 0.3 * (1 - r / 4.2);
    const z = Math.sin(a) * r;
    out[i * 3] = x;
    out[i * 3 + 1] = y * Math.cos(tilt) - z * Math.sin(tilt) * 0.42;
    out[i * 3 + 2] = y * Math.sin(tilt) + z * Math.cos(tilt);
  }
  return out;
}

export function buildForms(count) {
  return {
    core: core(count),
    compass: compass(count),
    windows: windows(count),
    chip: chip(count),
    agents: agents(count),
    chat: chat(count),
    galaxy: galaxy(count),
  };
}
