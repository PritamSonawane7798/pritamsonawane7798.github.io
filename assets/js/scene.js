import * as THREE from '../vendor/three.module.min.js';
import { buildForms } from './shapes.js';

// Paired colours for each form. The first runs through the body of the form,
// the second through its edges and its far side.
const PALETTE = {
  core: ['#ffb45c', '#ff4f6d'],
  compass: ['#ffd76a', '#ff7f32'],
  windows: ['#63d2ff', '#6a7bff'],
  chip: ['#46ffc8', '#25a4ff'],
  agents: ['#ff74da', '#8f62ff'],
  chat: ['#c4ff5e', '#21e6a6'],
  galaxy: ['#ffc36b', '#ff4fa3'],
};

const canvas = document.getElementById('scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCompact = () => innerWidth < 900;

function start() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' });
  } catch {
    document.documentElement.classList.add('no-webgl');
    return;
  }

  const pointCount = isCompact() ? 9000 : 18000;
  const forms = buildForms(pointCount);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.z = 7.4;

  const noise = new Float32Array(pointCount * 4).map(() => Math.random());
  const geometry = new THREE.BufferGeometry();
  const fromAttribute = new THREE.BufferAttribute(forms.core.slice(), 3);
  const toAttribute = new THREE.BufferAttribute(forms.core.slice(), 3);
  fromAttribute.setUsage(THREE.DynamicDrawUsage);
  toAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', fromAttribute);
  geometry.setAttribute('aTarget', toAttribute);
  geometry.setAttribute('aNoise', new THREE.BufferAttribute(noise, 4));

  const uniforms = {
    uMorph: { value: 0 },
    uIntro: { value: reduceMotion ? 1 : 0 },
    uTime: { value: 0 },
    uSize: { value: 1 },
    uOpacity: { value: 1 },
    uPointer: { value: new THREE.Vector3(99, 99, 0) },
    uColorA: { value: new THREE.Color(PALETTE.core[0]) },
    uColorB: { value: new THREE.Color(PALETTE.core[1]) },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aTarget;
      attribute vec4 aNoise;
      uniform float uMorph, uIntro, uTime, uSize;
      uniform vec3 uPointer;
      varying float vAlpha;
      varying float vMix;
      const float PI = 3.14159265;

      void main() {
        // Points leave at slightly different moments, so a morph reads as a
        // swarm reorganising rather than a crossfade.
        float delay = aNoise.w * 0.34;
        float t = smoothstep(delay, delay + 0.66, uMorph);
        vec3 p = mix(position, aTarget, t);

        vec3 dir = aNoise.xyz - 0.5;
        p += dir * sin(t * PI) * 2.6;
        p += dir * (1.0 - uIntro) * 15.0;
        p += 0.014 * vec3(
          sin(uTime * 0.9 + aNoise.x * 40.0),
          cos(uTime * 0.8 + aNoise.y * 40.0),
          sin(uTime * 0.7 + aNoise.z * 40.0)
        );

        vec4 world = modelMatrix * vec4(p, 1.0);

        // The pointer parts the cloud.
        vec2 away = world.xy - uPointer.xy;
        float dist = length(away);
        float push = smoothstep(1.25, 0.0, dist);
        world.xy += away / max(dist, 0.001) * push * 0.5;
        world.z += push * 0.5;

        vec4 view = viewMatrix * world;
        gl_Position = projectionMatrix * view;
        gl_PointSize = uSize * (0.55 + aNoise.y * 1.1) / -view.z;

        float depth = smoothstep(10.2, 5.2, -view.z);
        float twinkle = 0.72 + 0.28 * sin(uTime * 1.6 + aNoise.z * 60.0);
        vAlpha = (0.22 + 0.78 * depth) * twinkle;
        vMix = clamp(0.5 - (view.z + 7.4) * 0.22 + p.y * 0.14 + (aNoise.x - 0.5) * 0.35, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColorA, uColorB;
      uniform float uOpacity;
      varying float vAlpha;
      varying float vMix;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float glow = smoothstep(0.5, 0.0, d);
        glow *= glow;
        gl_FragColor = vec4(mix(uColorA, uColorB, vMix), glow * vAlpha * uOpacity);
      }
    `,
  });

  const cloud = new THREE.Points(geometry, material);
  cloud.frustumCulled = false;
  scene.add(cloud);

  // A sparse far field gives the page real depth as it scrolls.
  const starCount = isCompact() ? 500 : 1100;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPositions[i * 3] = (Math.random() - 0.5) * 30;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
    starPositions[i * 3 + 2] = -3 - Math.random() * 16;
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0xa9b6d8,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(stars);

  // Each section marked data-form is a stop. Scrolling moves between stops.
  const sections = [...document.querySelectorAll('[data-form]')];
  let stops = [];
  let pair = 'core>core';
  let viewHalfWidth = 1;
  let viewHalfHeight = 1;
  let fit = 1;

  function layout() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const compact = isCompact();
    const ratio = Math.min(devicePixelRatio, compact ? 1.5 : 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    viewHalfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    viewHalfWidth = viewHalfHeight * camera.aspect;
    fit = Math.min(1, camera.aspect * 1.25);
    uniforms.uSize.value = height * ratio * (compact ? 0.034 : 0.029);

    const maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    let previous = -1;
    stops = sections.map((section, index) => {
      const rect = section.getBoundingClientRect();
      const top = rect.top + scrollY;
      const data = section.dataset;
      let y = top + rect.height / 2 - innerHeight / 2;
      if (index === 0) y = 0;
      if (index === sections.length - 1) y = maxScroll;
      y = Math.min(maxScroll, Math.max(previous + 1, y));
      previous = y;
      return {
        y,
        form: data.form,
        x: compact ? 0 : Number(data.x || 0) * Math.min(1, viewHalfWidth / 4.4),
        offsetY: compact ? Number(data.compactY || 0) : 0,
        scale: Number(data.scale || 1) * (compact ? Number(data.compactScale || 1) : 1),
        opacity: compact ? Number(data.compactOpacity || data.opacity || 0.5) : Number(data.opacity || 1),
      };
    });
  }

  function setPair(fromName, toName) {
    const key = `${fromName}>${toName}`;
    if (key === pair) return;
    pair = key;
    fromAttribute.array.set(forms[fromName]);
    toAttribute.array.set(forms[toName]);
    fromAttribute.needsUpdate = true;
    toAttribute.needsUpdate = true;
  }

  const pointer = { x: 0, y: 0, active: false };
  addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    pointer.x = (event.clientX / innerWidth) * 2 - 1;
    pointer.y = -((event.clientY / innerHeight) * 2 - 1);
    pointer.active = true;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer.active = false; });

  let lastWidth = 0;
  let lastHeight = 0;
  const onResize = () => {
    // Mobile browsers change height as the address bar slides. Ignore that.
    if (innerWidth === lastWidth && Math.abs(innerHeight - lastHeight) < 120) return;
    lastWidth = innerWidth;
    lastHeight = innerHeight;
    layout();
  };
  addEventListener('resize', onResize);
  addEventListener('load', layout);
  document.fonts?.ready.then(layout);
  new ResizeObserver(layout).observe(document.body);

  layout();
  lastWidth = innerWidth;
  lastHeight = innerHeight;

  const colorA = new THREE.Color();
  const colorB = new THREE.Color();
  let smoothScroll = scrollY;
  let smoothPointerX = 0;
  let smoothPointerY = 0;
  let last = performance.now();
  let clock = 0;
  const lerp = THREE.MathUtils.lerp;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;

    smoothScroll = reduceMotion ? scrollY : lerp(smoothScroll, scrollY, 1 - Math.exp(-dt * 5.5));
    smoothPointerX = lerp(smoothPointerX, pointer.x, 1 - Math.exp(-dt * 3));
    smoothPointerY = lerp(smoothPointerY, pointer.y, 1 - Math.exp(-dt * 3));

    let index = 0;
    while (index < stops.length - 2 && smoothScroll >= stops[index + 1].y) index++;
    const a = stops[index];
    const b = stops[index + 1] || a;
    const span = b.y - a.y || 1;
    const raw = THREE.MathUtils.clamp((smoothScroll - a.y) / span, 0, 1);
    // Hold each form while its section is being read; morph between them.
    const eased = THREE.MathUtils.smoothstep(raw, 0.22, 0.82);

    setPair(a.form, b.form);
    uniforms.uMorph.value = a.form === b.form ? 0 : eased;
    uniforms.uOpacity.value = lerp(a.opacity, b.opacity, eased);
    uniforms.uColorA.value.copy(colorA.set(PALETTE[a.form][0])).lerp(colorB.set(PALETTE[b.form][0]), eased);
    uniforms.uColorB.value.copy(colorA.set(PALETTE[a.form][1])).lerp(colorB.set(PALETTE[b.form][1]), eased);
    uniforms.uTime.value = reduceMotion ? 0 : clock;

    if (uniforms.uIntro.value < 1) {
      const intro = Math.min(1, clock / 2);
      uniforms.uIntro.value = 1 - Math.pow(1 - intro, 4);
    }

    cloud.position.x = lerp(a.x, b.x, eased);
    cloud.position.y = lerp(a.offsetY, b.offsetY, eased);
    cloud.scale.setScalar(lerp(a.scale, b.scale, eased) * fit);

    // One full turn per stop, so every form arrives facing the viewer.
    const sway = reduceMotion ? 0 : Math.sin(clock * 0.42) * 0.3;
    const nod = reduceMotion ? 0 : Math.sin(clock * 0.31) * 0.09;
    cloud.rotation.y = (index + eased) * Math.PI * 2 + sway + smoothPointerX * 0.28;
    cloud.rotation.x = nod - smoothPointerY * 0.2;

    stars.position.y = smoothScroll * 0.0009;
    stars.rotation.z = smoothScroll * 0.00004;

    if (pointer.active && !reduceMotion) {
      uniforms.uPointer.value.set(pointer.x * viewHalfWidth, pointer.y * viewHalfHeight, 0);
    } else {
      uniforms.uPointer.value.set(99, 99, 0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

start();
