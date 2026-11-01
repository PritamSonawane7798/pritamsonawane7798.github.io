import * as THREE from '../vendor/three.module.min.js';
import { makeAll } from './sculptures.js';

const canvas = document.getElementById('scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => innerWidth < 900;
const { lerp, smoothstep, clamp } = THREE.MathUtils;

// A small studio, baked into reflections: broad soft boxes above and to the
// sides give porcelain its sheen and gold something to reflect.
function makeStudio(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#a8a29a');
  const light = (color, power, w, h, position) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  light('#ffffff', 5, 12, 8, [0, 9, 3]);
  light('#ffe9d6', 3.5, 7, 10, [-9, 2, 4]);
  light('#dfeaff', 3, 7, 10, [9, 1, 3]);
  light('#ffffff', 1.6, 10, 5, [0, 1, 11]);
  light('#6f6a66', 1, 16, 16, [0, -9, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(studio, 0.03).texture;
  generator.dispose();
  return texture;
}

function makeGroundShadow() {
  const size = 256;
  const canvas2d = document.createElement('canvas');
  canvas2d.width = canvas2d.height = size;
  const context = canvas2d.getContext('2d');
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(45, 50, 80, 0.3)');
  gradient.addColorStop(0.55, 'rgba(45, 50, 80, 0.1)');
  gradient.addColorStop(1, 'rgba(45, 50, 80, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas2d);
}

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const compactAtStart = isCompact();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = !compactAtStart;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.environment = makeStudio(renderer);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  camera.position.z = 10;

  const key = new THREE.DirectionalLight('#fff4e6', 2.1);
  key.position.set(-3.5, 6, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.camera.far = 22;
  key.shadow.bias = -0.0004;
  key.shadow.radius = 5;
  scene.add(key);

  const { groups, materials } = makeAll();
  const shadowTexture = makeGroundShadow();

  // Each sculpture sits on a rig: the rig moves and scales, the sculpture turns.
  const rigs = {};
  for (const [name, sculpture] of Object.entries(groups)) {
    const rig = new THREE.Group();
    sculpture.children.forEach((child) => {
      child.userData.home = child.position.clone();
    });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 0.8),
      new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }),
    );
    ground.position.set(0, -2.62, -1);
    rig.add(ground, sculpture);
    rig.visible = false;
    rig.userData = { sculpture, ground };
    scene.add(rig);
    rigs[name] = rig;
  }

  // A few small beads drift in the open space on the right. Phones skip them
  // because the text there fills the whole width.
  const beadGeometry = new THREE.SphereGeometry(1, 24, 16);
  const beads = [];
  const beadMaterials = [materials.gold, materials.pearl, materials.peach, materials.sky];
  for (let i = 0; i < (compactAtStart ? 0 : 9); i++) {
    const bead = new THREE.Mesh(beadGeometry, beadMaterials[i % beadMaterials.length]);
    const size = 0.025 + Math.random() * 0.035;
    bead.scale.setScalar(size);
    bead.position.set(0.8 + Math.random() * 5.4, (Math.random() - 0.5) * 16, -4 + Math.random() * 3);
    bead.userData = { y: bead.position.y, phase: Math.random() * 6.28, drift: 0.2 + Math.random() * 0.8 };
    scene.add(bead);
    beads.push(bead);
  }

  // Each section marked data-form is a stop. "none" clears the stage for cards.
  const sections = [...document.querySelectorAll('[data-form]')];
  let stops = [];
  let viewHalfWidth = 1;
  let fit = 1;

  function layout() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const compact = isCompact();
    renderer.setPixelRatio(Math.min(devicePixelRatio, compact ? 1.75 : 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    viewHalfWidth = halfHeight * camera.aspect;
    fit = compact ? Math.min(1, viewHalfWidth / 2.45) : 1;

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    let previous = -1;
    stops = sections.map((section, index) => {
      const rect = section.getBoundingClientRect();
      const data = section.dataset;
      let y = rect.top + scrollY + rect.height / 2 - innerHeight / 2;
      if (index === 0) y = 0;
      if (index === sections.length - 1) y = maxScroll;
      y = Math.min(maxScroll, Math.max(previous + 1, y));
      previous = y;
      return {
        y,
        form: data.form,
        x: compact ? 0 : Number(data.x || 0) * Math.min(1, viewHalfWidth / 4.45),
        offsetY: compact ? Number(data.compactY || 0) : Number(data.y || 0),
        scale: Number(data.scale || 1) * (compact ? Number(data.compactScale || 1) : 1),
      };
    });
  }

  const pointer = { x: 0, y: 0 };
  addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  let lastWidth = innerWidth;
  let lastHeight = innerHeight;
  addEventListener('resize', () => {
    // Mobile browsers change height as the address bar slides. Ignore that.
    if (innerWidth === lastWidth && Math.abs(innerHeight - lastHeight) < 120) return;
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    layout();
  });
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);
  new ResizeObserver(layout).observe(document.body);
  layout();

  // Place one sculpture. `apart` is 0 when assembled and 1 when fully dispersed.
  function pose(stop, apart, turn, time) {
    const rig = rigs[stop.form];
    if (!rig) return;
    const { sculpture, ground } = rig.userData;
    const presence = 1 - apart;
    rig.visible = presence > 0.01;
    if (!rig.visible) return;

    const eased = presence * presence * (3 - 2 * presence);
    rig.position.set(stop.x, stop.offsetY, 0);
    rig.scale.setScalar(stop.scale * fit * (0.7 + 0.3 * eased));
    ground.material.opacity = eased;
    ground.visible = !isCompact();

    const sway = reduceMotion ? 0 : Math.sin(time * 0.4) * 0.16;
    const nod = reduceMotion ? 0 : Math.sin(time * 0.3) * 0.05;
    sculpture.rotation.y = turn + sway + smoothPointerX * 0.24 + (1 - eased) * 1.1;
    sculpture.rotation.x = nod - smoothPointerY * 0.14 + (1 - eased) * 0.3;
    sculpture.position.y = reduceMotion ? 0 : Math.sin(time * 0.7) * 0.05;

    const spread = 1 + (1 - eased) * 1.1;
    for (const child of sculpture.children) {
      const { home, spin, orbit, wobble, bob } = child.userData;
      child.position.copy(home).multiplyScalar(spread);
      child.scale.setScalar(Math.max(eased, 0.001));
      if (reduceMotion) continue;
      if (spin) child.rotation.z = time * spin[2];
      if (wobble) child.rotation.z = wobble.base + Math.sin(time * wobble.speed) * wobble.size;
      if (bob) child.position.y += Math.sin(time * 1.1 + bob.phase) * bob.size;
      if (orbit) {
        const a = time * orbit.speed;
        const x = Math.cos(a) * orbit.radius;
        const flat = Math.sin(a) * orbit.radius;
        child.position.set(x, -flat * Math.cos(orbit.tilt) * -1, flat * Math.sin(orbit.tilt) * -1);
      }
    }
  }

  let smoothScroll = scrollY;
  let smoothPointerX = 0;
  let smoothPointerY = 0;
  let last = performance.now();
  let clock = 0;
  let intro = reduceMotion ? 1 : 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    const time = reduceMotion ? 0 : clock;

    smoothScroll = reduceMotion ? scrollY : lerp(smoothScroll, scrollY, 1 - Math.exp(-dt * 6));
    smoothPointerX = lerp(smoothPointerX, pointer.x, 1 - Math.exp(-dt * 3));
    smoothPointerY = lerp(smoothPointerY, pointer.y, 1 - Math.exp(-dt * 3));
    if (intro < 1) intro = Math.min(1, clock / 1.5);

    let index = 0;
    while (index < stops.length - 2 && smoothScroll >= stops[index + 1].y) index++;
    const a = stops[index];
    const b = stops[index + 1] || a;
    const raw = clamp((smoothScroll - a.y) / (b.y - a.y || 1), 0, 1);

    // Hold each sculpture while its section is read. The outgoing one leaves
    // before the next arrives, so two never fight for attention.
    const leaving = smoothstep(raw, 0.3, 0.56);
    const arriving = 1 - smoothstep(raw, 0.5, 0.78);

    for (const rig of Object.values(rigs)) rig.visible = false;
    const introApart = 1 - (1 - Math.pow(1 - intro, 3));
    if (a.form === b.form) pose(a, Math.max(0, introApart), 0, time);
    else {
      pose(a, Math.max(leaving, index === 0 ? introApart : 0), 0, time);
      pose(b, arriving, 0, time);
    }

    for (const bead of beads) {
      const travel = bead.userData.drift * smoothScroll * 0.0016;
      const bob = reduceMotion ? 0 : Math.sin(time * 0.4 + bead.userData.phase) * 0.12;
      bead.position.y = ((bead.userData.y + travel + 8) % 16 + 16) % 16 - 8 + bob;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
