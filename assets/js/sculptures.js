import * as THREE from '../vendor/three.module.min.js';

// Each service is a small solid sculpture in porcelain, pastel ceramic and
// champagne gold. Every piece is a direct child of its group, so the scene can
// draw the pieces apart and back together between sections.

const UP = new THREE.Vector3(0, 1, 0);

const glaze = (color, roughness = 0.34, envMapIntensity = 0.62) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
    envMapIntensity,
  });

export function makeMaterials() {
  return {
    porcelain: glaze('#f7efe2', 0.3, 0.72),
    pearl: new THREE.MeshPhysicalMaterial({
      color: '#f6e6d6',
      roughness: 0.26,
      envMapIntensity: 0.72,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      iridescence: 0.55,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 420],
    }),
    gold: new THREE.MeshStandardMaterial({ color: '#d8ae72', metalness: 1, roughness: 0.25 }),
    ink: glaze('#101a33', 0.34, 0.22),
    peach: glaze('#f39f76'),
    rose: glaze('#ec8fa2'),
    sky: glaze('#74aeea'),
    periwinkle: glaze('#8f9ef0'),
    mint: glaze('#6fd3b0'),
    lilac: glaze('#ae8cea'),
    sage: glaze('#96cc82'),
    butter: glaze('#f5ca66'),
    white: glaze('#fdf9f3', 0.3, 0.72),
  };
}

function rounded(w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function extrude(shape, depth, bevel = 0.035) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function piece(geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const slab = (w, h, depth, r, material, x, y, z) =>
  piece(extrude(rounded(w, h, r), depth), material, x, y, z);

const ball = (r, material, x, y, z) => piece(new THREE.SphereGeometry(r, 48, 32), material, x, y, z);

function rod(a, b, radius, material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const span = end.clone().sub(start);
  const mesh = piece(new THREE.CylinderGeometry(radius, radius, span.length(), 16), material);
  mesh.position.copy(start).addScaledVector(span, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, span.normalize());
  return mesh;
}

function ring(radius, tube, material, rx = 0, ry = 0, rz = 0) {
  const mesh = piece(new THREE.TorusGeometry(radius, tube, 24, 140), material);
  mesh.rotation.set(rx, ry, rz);
  return mesh;
}

// An armillary sphere: an old instrument for reading the sky.
function armillary(m) {
  const group = new THREE.Group();
  group.add(ball(0.92, m.pearl, 0, 0, 0));

  const outer = ring(2.05, 0.06, m.gold, 1.28, 0.2, 0);
  const middle = ring(1.72, 0.05, m.rose, 0.3, 0.9, 0);
  const inner = ring(1.38, 0.045, m.gold, 1.9, -0.7, 0);
  outer.userData.spin = [0, 0, 0.12];
  middle.userData.spin = [0, 0, -0.17];
  inner.userData.spin = [0, 0, 0.23];

  const moon = ball(0.17, m.sky, 2.05, 0, 0);
  moon.userData.orbit = { radius: 2.05, speed: 0.34, tilt: 1.28 };
  group.add(outer, middle, inner, moon);
  return group;
}

function compass(m) {
  const group = new THREE.Group();
  const disc = piece(new THREE.CylinderGeometry(2, 2, 0.24, 96), m.porcelain, 0, 0, -0.14);
  disc.rotation.x = Math.PI / 2;
  group.add(disc);
  group.add(ring(2.02, 0.085, m.gold));
  group.add(ring(1.5, 0.018, m.gold));

  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const major = i % 6 === 0;
    const outer = 1.86;
    const inner = major ? 1.62 : 1.74;
    group.add(
      rod(
        [Math.cos(a) * inner, Math.sin(a) * inner, 0.02],
        [Math.cos(a) * outer, Math.sin(a) * outer, 0.02],
        major ? 0.024 : 0.012,
        major ? m.ink : m.gold,
      ),
    );
  }

  // A two tone needle, turned to its heading.
  const blade = (length, width) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, length);
    shape.lineTo(width, 0);
    shape.lineTo(0, -length);
    shape.lineTo(-width, 0);
    shape.closePath();
    return shape;
  };
  const cross = piece(extrude(blade(1.12, 0.14), 0.05, 0.02), m.peach, 0, 0, 0.09);
  cross.rotation.z = -0.44;
  const needle = piece(extrude(blade(1.38, 0.2), 0.08, 0.025), m.ink, 0, 0, 0.17);
  needle.rotation.z = -0.44 + Math.PI / 2;
  needle.userData.wobble = { base: needle.rotation.z, size: 0.07, speed: 0.8 };
  group.add(cross, needle, ball(0.15, m.gold, 0, 0, 0.3));
  return group;
}

function windows(m) {
  const group = new THREE.Group();
  group.add(slab(3.1, 2.15, 0.08, 0.16, m.periwinkle, -0.68, 0.74, -0.9));
  group.add(slab(3.5, 2.5, 0.1, 0.17, m.white, -0.1, 0.1, -0.2));

  // Page: title bar, hero block, text lines and three cards.
  const left = -1.72;
  const barY = 1.13;
  group.add(ball(0.06, m.rose, left, barY, -0.07));
  group.add(ball(0.06, m.butter, left + 0.18, barY, -0.07));
  group.add(ball(0.06, m.sage, left + 0.36, barY, -0.07));
  group.add(slab(1.55, 0.86, 0.04, 0.07, m.sky, -0.92, 0.38, -0.07));
  for (const [y, w, x] of [[0.66, 1.24, 0.75], [0.42, 1.24, 0.75], [0.18, 0.86, 0.56]]) {
    group.add(slab(w, 0.08, 0.03, 0.03, m.ink, x, y, -0.07));
  }
  [m.peach, m.mint, m.lilac].forEach((material, i) => {
    group.add(slab(0.92, 0.6, 0.04, 0.06, material, -1.1 + i * 1.03, -0.55, -0.07));
  });

  // The phone, for the application half of the service.
  group.add(slab(0.98, 1.92, 0.1, 0.15, m.ink, 2.08, -0.62, 0.5));
  group.add(slab(0.8, 1.68, 0.03, 0.08, m.white, 2.08, -0.62, 0.6));
  group.add(slab(0.64, 0.56, 0.03, 0.05, m.sky, 2.08, -0.26, 0.65));
  for (let i = 0; i < 3; i++) {
    group.add(slab(0.64, 0.09, 0.02, 0.03, m.periwinkle, 2.08, -0.72 - i * 0.2, 0.65));
  }
  return group;
}

function letterA() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, -0.56);
  shape.lineTo(-0.31, -0.56);
  shape.lineTo(-0.2, -0.25);
  shape.lineTo(0.2, -0.25);
  shape.lineTo(0.31, -0.56);
  shape.lineTo(0.5, -0.56);
  shape.lineTo(0.09, 0.56);
  shape.lineTo(-0.09, 0.56);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-0.14, -0.1);
  hole.lineTo(0.14, -0.1);
  hole.lineTo(0, 0.28);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}

function chip(m) {
  const group = new THREE.Group();
  group.add(slab(3, 3, 0.3, 0.26, m.mint, 0, 0, -0.1));
  group.add(slab(2.12, 2.12, 0.08, 0.14, m.white, 0, 0, 0.13));

  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const cos = Math.round(Math.cos(a));
    const sin = Math.round(Math.sin(a));
    for (let i = 0; i < 6; i++) {
      const along = -1.1 + i * 0.44;
      group.add(
        rod(
          [cos * 1.5 - sin * along, sin * 1.5 + cos * along, -0.1],
          [cos * 2.02 - sin * along, sin * 2.02 + cos * along, -0.1],
          0.05,
          m.gold,
        ),
      );
    }
  }

  group.add(piece(extrude(letterA(), 0.12, 0.018), m.ink, -0.34, 0, 0.3));
  group.add(slab(0.2, 0.92, 0.12, 0.02, m.ink, 0.55, 0, 0.3));
  group.add(slab(0.56, 0.14, 0.12, 0.02, m.ink, 0.55, 0.49, 0.3));
  group.add(slab(0.56, 0.14, 0.12, 0.02, m.ink, 0.55, -0.49, 0.3));
  return group;
}

function agents(m) {
  const group = new THREE.Group();
  const nodes = [
    [1.85, 0.8, 0.3, m.sky],
    [1.15, -1.42, -0.3, m.mint],
    [-0.8, -1.62, 0.4, m.butter],
    [-1.92, -0.2, -0.3, m.rose],
    [-1.12, 1.45, 0.3, m.lilac],
    [0.62, 1.72, -0.4, m.peach],
  ];
  group.add(ball(0.68, m.pearl, 0, 0, 0));
  group.add(ring(0.9, 0.025, m.gold, 1.2, 0.2, 0));
  nodes.forEach(([x, y, z, material], i) => {
    const next = nodes[(i + 1) % nodes.length];
    group.add(rod([0, 0, 0], [x, y, z], 0.03, m.gold));
    group.add(rod([x, y, z], [next[0], next[1], next[2]], 0.014, m.gold));
    const node = ball(0.33, material, x, y, z);
    node.userData.bob = { size: 0.03, phase: i * 1.1 };
    group.add(node);
  });
  return group;
}

function bubble(w, h, r, tailX, tailDrop, lean) {
  const x = -w / 2;
  const y = -h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  // The tail breaks the bottom edge and leans towards its speaker.
  shape.lineTo(tailX - 0.3, y);
  shape.lineTo(tailX + 0.34 * lean, y - tailDrop);
  shape.lineTo(tailX + 0.3, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function chat(m) {
  const group = new THREE.Group();

  const reply = piece(extrude(bubble(2.3, 1.36, 0.42, 0.55, 0.42, 1), 0.14), m.white, 0.78, -1.02, -0.5);
  group.add(reply);
  group.add(slab(1.5, 0.1, 0.03, 0.04, m.sage, 0.78, -0.82, -0.37));
  group.add(slab(1.5, 0.1, 0.03, 0.04, m.sage, 0.78, -1.04, -0.37));
  group.add(slab(0.95, 0.1, 0.03, 0.04, m.sage, 0.5, -1.26, -0.37));

  group.add(piece(extrude(bubble(3.2, 2.1, 0.58, -0.75, 0.56, -1), 0.26), m.sage, -0.32, 0.62, 0.15));
  [-1.12, -0.32, 0.48].forEach((x, i) => {
    const dot = ball(0.23, i === 1 ? m.gold : m.porcelain, x, 0.62, 0.42);
    dot.userData.bob = { size: 0.045, phase: i * 0.9 };
    group.add(dot);
  });
  return group;
}

export function buildSculptures(materials) {
  return { armillary, compass, windows, chip, agents, chat };
}

export function makeAll() {
  const materials = makeMaterials();
  const groups = {};
  for (const [name, build] of Object.entries(buildSculptures(materials))) groups[name] = build(materials);
  return { materials, groups };
}
