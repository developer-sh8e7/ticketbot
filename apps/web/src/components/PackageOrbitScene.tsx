'use client';

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useEffect, useRef, useState } from 'react';

export type PackageOrbitItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number;
  discount: number;
  popular: boolean;
};

export type PackageOrbitInteraction = {
  origin: { x: number; y: number };
  side: 'left' | 'right';
};

type PackageOrbitSceneProps = {
  items: readonly PackageOrbitItem[];
  focusId?: string | null;
  selectedId?: string | null;
  onActivate: (item: PackageOrbitItem | null, interaction: PackageOrbitInteraction) => void;
  onHoverChange?: (item: PackageOrbitItem | null, interaction?: PackageOrbitInteraction) => void;
};

type OrbitCard = {
  group: THREE.Group;
  body: THREE.Mesh<RoundedBoxGeometry, THREE.MeshPhysicalMaterial>;
  face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  itemIndex: number;
  copyIndex: number;
  hoverAmount: number;
  opacity: number;
};

const CARD_COPIES = 64;
const CARD_TEXTURE_WIDTH = 600;
const CARD_TEXTURE_HEIGHT = 1200;
const CURVE_SEGMENTS = 56;

const cardPalettes = [
  { glow: '#18d6a0', wash: '#e7faf4', edge: '#71e7c8' },
  { glow: '#38bfd3', wash: '#e9f8fa', edge: '#8bdde8' },
  { glow: '#cef42e', wash: '#f6fbdc', edge: '#dff67c' },
  { glow: '#14c79c', wash: '#e8f9f5', edge: '#73dfc5' },
  { glow: '#73d6e3', wash: '#edf9fb', edge: '#a6e7ee' },
] as const;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function rtlLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }

  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let finalLine = lines[maxLines - 1];
    while (finalLine.length > 1 && ctx.measureText(`${finalLine}…`).width > maxWidth) {
      finalLine = finalLine.slice(0, -1).trim();
    }
    lines[maxLines - 1] = `${finalLine}…`;
  }

  return lines;
}

function makeCardTexture(item: PackageOrbitItem, index: number, renderer: THREE.WebGLRenderer) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_TEXTURE_WIDTH;
  canvas.height = CARD_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable');

  const palette = cardPalettes[index % cardPalettes.length];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  roundedRect(ctx, 18, 18, 564, 1164, 54);
  ctx.clip();

  const wash = ctx.createLinearGradient(55, 35, 545, 1140);
  wash.addColorStop(0, 'rgba(255,255,255,0.94)');
  wash.addColorStop(0.48, palette.wash);
  wash.addColorStop(1, 'rgba(255,255,255,0.9)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lowerGlow = ctx.createRadialGradient(116, 1075, 12, 116, 1075, 430);
  lowerGlow.addColorStop(0, palette.glow);
  lowerGlow.addColorStop(0.42, `${palette.edge}d9`);
  lowerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = item.popular ? 0.9 : 0.62;
  ctx.fillStyle = lowerGlow;
  ctx.fillRect(0, 620, canvas.width, 580);

  const topGlow = ctx.createRadialGradient(570, 50, 0, 570, 50, 330);
  topGlow.addColorStop(0, palette.edge);
  topGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = topGlow;
  ctx.fillRect(250, 0, 350, 430);
  ctx.restore();
  ctx.globalAlpha = 1;

  roundedRect(ctx, 18, 18, 564, 1164, 54);
  ctx.strokeStyle = item.popular ? `${palette.glow}d6` : 'rgba(255,255,255,0.96)';
  ctx.lineWidth = item.popular ? 5 : 3;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#0b8d78';
  ctx.font = '800 25px "Cairo", sans-serif';
  ctx.fillText(item.category, 522, 112);

  ctx.fillStyle = '#07332e';
  ctx.font = '800 54px "Cairo", sans-serif';
  const nameLines = rtlLines(ctx, item.name, 462, 2);
  nameLines.forEach((line, lineIndex) => ctx.fillText(line, 522, 300 + lineIndex * 76));

  ctx.strokeStyle = 'rgba(7, 51, 46, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(58, 590);
  ctx.lineTo(522, 590);
  ctx.stroke();

  ctx.fillStyle = '#0b8d78';
  ctx.font = '700 25px "Cairo", sans-serif';
  ctx.fillText('السعر', 522, 685);

  const currentPrice = item.price.toLocaleString('ar-SA');
  ctx.fillStyle = '#07332e';
  ctx.font = '800 86px "Cairo", sans-serif';
  ctx.fillText(currentPrice, 522, 805);
  const priceWidth = ctx.measureText(currentPrice).width;
  ctx.fillStyle = '#0b8d78';
  ctx.font = '800 27px "Cairo", sans-serif';
  ctx.fillText('ر.س', 500 - priceWidth, 801);

  if (item.originalPrice > item.price) {
    const oldPrice = `${item.originalPrice.toLocaleString('ar-SA')} ر.س`;
    ctx.fillStyle = '#66817a';
    ctx.font = '600 24px "Cairo", sans-serif';
    ctx.fillText(oldPrice, 522, 860);
    const oldWidth = ctx.measureText(oldPrice).width;
    ctx.strokeStyle = '#66817a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(522 - oldWidth, 852);
    ctx.lineTo(522, 852);
    ctx.stroke();
  }

  ctx.fillStyle = '#0b8d78';
  ctx.font = '800 22px "Cairo", sans-serif';
  ctx.fillText(item.popular ? 'OPUS / الاكثر طلبا' : 'OPUS / PACKAGE', 522, 1082);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function makeConnector() {
  const positions = new Float32Array((CURVE_SEGMENTS + 1) * 2 * 3);
  const uvs = new Float32Array((CURVE_SEGMENTS + 1) * 2 * 2);
  const indices: number[] = [];

  for (let index = 0; index <= CURVE_SEGMENTS; index += 1) {
    const t = index / CURVE_SEGMENTS;
    const vertex = index * 2;
    uvs[(vertex + 0) * 2 + 0] = t;
    uvs[(vertex + 0) * 2 + 1] = 0;
    uvs[(vertex + 1) * 2 + 0] = t;
    uvs[(vertex + 1) * 2 + 1] = 1;
    if (index < CURVE_SEGMENTS) {
      indices.push(vertex, vertex + 1, vertex + 2, vertex + 1, vertex + 3, vertex + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uMint: { value: new THREE.Color('#16d9a1') },
      uLime: { value: new THREE.Color('#cef42e') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uMint;
      uniform vec3 uLime;
      void main() {
        float center = 1.0 - abs(vUv.y * 2.0 - 1.0);
        float feather = smoothstep(0.0, 0.78, center);
        float reveal = smoothstep(0.0, 0.13, vUv.x);
        float tail = 1.0 - smoothstep(0.94, 1.0, vUv.x);
        vec3 color = mix(uMint, uLime, smoothstep(0.25, 1.0, vUv.x));
        gl_FragColor = vec4(color, feather * reveal * max(tail, 0.35) * uOpacity);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  return { mesh, geometry, material };
}

function cubicPoint(target: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, p3: THREE.Vector3, t: number) {
  const inv = 1 - t;
  target.set(0, 0, 0)
    .addScaledVector(p0, inv * inv * inv)
    .addScaledVector(p1, 3 * inv * inv * t)
    .addScaledVector(p2, 3 * inv * t * t)
    .addScaledVector(p3, t * t * t);
}

export function PackageOrbitScene({
  items,
  focusId = null,
  selectedId = null,
  onActivate,
  onHoverChange,
}: PackageOrbitSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const focusIdRef = useRef(focusId);
  const selectedIdRef = useRef(selectedId);
  const activateRef = useRef(onActivate);
  const hoverChangeRef = useRef(onHoverChange);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);

  focusIdRef.current = focusId;
  selectedIdRef.current = selectedId;
  activateRef.current = onActivate;
  hoverChangeRef.current = onHoverChange;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || items.length === 0) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const initialize = async () => {
      await document.fonts.ready;
      if (disposed) return;

      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch {
        setFallback(true);
        return;
      }

      const isCoarse = window.matchMedia('(pointer: coarse)').matches;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.2 : 1.55));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.domElement.className = 'package-orbit-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      mount.appendChild(renderer.domElement);

      const onContextLost = (event: Event) => {
        event.preventDefault();
        setFallback(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2400);
      camera.position.set(0, 0, 1200);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0xb8e8df, 2.15));
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
      keyLight.position.set(-3, 6, 8);
      scene.add(keyLight);
      const mintLight = new THREE.DirectionalLight(0x67f1c6, 1.1);
      mintLight.position.set(5, -2, 5);
      scene.add(mintLight);

      const textures = items.map((item, index) => makeCardTexture(item, index, renderer));
      const bodyGeometry = new RoundedBoxGeometry(0.45, 1, 0.04, 5, 0.028);
      const faceGeometry = new THREE.PlaneGeometry(0.438, 0.988);
      const cards: OrbitCard[] = [];

      for (let index = 0; index < CARD_COPIES; index += 1) {
        const itemIndex = index % items.length;
        const palette = cardPalettes[itemIndex % cardPalettes.length];
        const group = new THREE.Group();
        const body = new THREE.Mesh(
          bodyGeometry,
          new THREE.MeshPhysicalMaterial({
            color: palette.wash,
            roughness: 0.5,
            metalness: 0,
            clearcoat: 0.42,
            clearcoatRoughness: 0.38,
            transparent: true,
            opacity: 0.97,
          })
        );
        const face = new THREE.Mesh(
          faceGeometry,
          new THREE.MeshBasicMaterial({
            map: textures[itemIndex],
            transparent: true,
            alphaTest: 0.018,
            depthTest: true,
            depthWrite: true,
            opacity: 1,
            side: THREE.DoubleSide,
          })
        );
        face.position.z = 0.0206;
        group.add(body, face);
        scene.add(group);
        cards.push({ group, body, face, itemIndex, copyIndex: index, hoverAmount: 0, opacity: 1 });
      }

      const connector = makeConnector();
      scene.add(connector.mesh);
      const sourceDotMaterial = new THREE.MeshBasicMaterial({ color: '#16d9a1', transparent: true, opacity: 0, depthTest: false });
      const targetDotMaterial = new THREE.MeshBasicMaterial({ color: '#cef42e', transparent: true, opacity: 0, depthTest: false });
      const sourceDot = new THREE.Mesh(new THREE.CircleGeometry(5, 24), sourceDotMaterial);
      const targetDot = new THREE.Mesh(new THREE.RingGeometry(4, 8, 28), targetDotMaterial);
      sourceDot.renderOrder = 1001;
      targetDot.renderOrder = 1001;
      scene.add(sourceDot, targetDot);

      let width = 1;
      let height = 1;
      let cardHeight = 422;
      let stride = cardHeight * 0.3;
      const baseY = new Float32Array(CARD_COPIES);

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        renderer.setSize(width, height, false);
        camera.left = -width / 2;
        camera.right = width / 2;
        camera.top = height / 2;
        camera.bottom = -height / 2;
        camera.updateProjectionMatrix();
        const cardWidth = Math.min(220, Math.max(width < 720 ? 90 : 145, width * (width < 720 ? 0.25 : 0.115)));
        cardHeight = cardWidth / 0.45;
        stride = cardHeight * 0.3;
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      const pointer = new THREE.Vector2(4, 4);
      const projected = new THREE.Vector3();
      const source = new THREE.Vector3();
      const target = new THREE.Vector3();
      const controlA = new THREE.Vector3();
      const controlB = new THREE.Vector3();
      const curvePoint = new THREE.Vector3();
      const previousCurvePoint = new THREE.Vector3();
      let pointerInside = false;
      let pointerDown = false;
      let dragged = false;
      let dragDistance = 0;
      let lastPointerX = 0;
      let lastPointerY = 0;
      let hovered: OrbitCard | null = null;
      let selected: OrbitCard | null = null;
      let hoverSide: 'left' | 'right' = 'right';
      let selectedSide: 'left' | 'right' = 'right';
      let notifiedHoverCopy = -1;
      let targetTravel = 0;
      let travel = 0;
      let connectorOpacity = 0;

      const interactionFor = (card: OrbitCard, side: 'left' | 'right'): PackageOrbitInteraction => {
        projected.set(0, 0.14, 0.03);
        card.group.localToWorld(projected);
        projected.project(camera);
        return {
          origin: {
            x: (projected.x * 0.5 + 0.5) * width,
            y: (-projected.y * 0.5 + 0.5) * height,
          },
          side,
        };
      };

      const updatePointer = (event: PointerEvent | MouseEvent) => {
        const rect = mount.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        pointerInside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      };

      const hoverStrength = (card: OrbitCard) => {
        if (!pointerInside || !card.group.visible) return 0;
        projected.copy(card.group.position);
        projected.y = baseY[card.copyIndex];
        projected.project(camera);
        const dx = (pointer.x - projected.x) * (width / height);
        const dy = (pointer.y - projected.y) * 0.1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const t = THREE.MathUtils.clamp(1 - distance / 0.18, 0, 1);
        return t * t * (3 - 2 * t);
      };

      const closestCard = () => {
        let closest: OrbitCard | null = null;
        let strongest = 0;
        for (const card of cards) {
          const strength = hoverStrength(card);
          if (strength > strongest) {
            strongest = strength;
            closest = card;
          }
        }
        return strongest > 0.025 ? closest : null;
      };

      const onPointerMove = (event: PointerEvent) => {
        updatePointer(event);
        if (!pointerDown) return;
        const dx = event.clientX - lastPointerX;
        const dy = event.clientY - lastPointerY;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        if (dragDistance > 7) dragged = true;
        if (Math.abs(dx) > Math.abs(dy) * 0.55) {
          targetTravel -= dx * (0.2 * CARD_COPIES * stride / height);
        }
      };

      const onPointerDown = (event: PointerEvent) => {
        updatePointer(event);
        pointerDown = true;
        dragged = false;
        dragDistance = 0;
        lastPointerX = event.clientX;
        lastPointerY = event.clientY;
        renderer.domElement.setPointerCapture?.(event.pointerId);
      };

      const onPointerUp = (event: PointerEvent) => {
        updatePointer(event);
        const picked = !dragged ? closestCard() : null;
        pointerDown = false;
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        if (!picked) return;

        if (selected === picked) {
          const side = selectedSide;
          selected = null;
          activateRef.current(null, interactionFor(picked, side));
          return;
        }

        selected = picked;
        selectedSide = picked.group.position.x < 0 ? 'right' : 'left';
        activateRef.current(items[picked.itemIndex], interactionFor(picked, selectedSide));
      };

      const onPointerCancel = (event: PointerEvent) => {
        pointerDown = false;
        dragged = true;
        pointerInside = false;
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
      };

      const onPointerLeave = () => {
        if (pointerDown) return;
        pointerInside = false;
        pointer.set(4, 4);
      };

      const onWheel = (event: WheelEvent) => {
        if (event.deltaY === 0) return;
        targetTravel += stride * 0.32;
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerCancel);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

      let visible = true;
      const intersectionObserver = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      }, { rootMargin: '180px' });
      intersectionObserver.observe(mount);

      const updateConnector = (active: OrbitCard | null, side: 'left' | 'right', dt: number) => {
        const targetOpacity = active?.group.visible ? 1 : 0;
        connectorOpacity = THREE.MathUtils.damp(connectorOpacity, targetOpacity, 7, dt);
        connector.material.uniforms.uOpacity.value = connectorOpacity;
        sourceDotMaterial.opacity = connectorOpacity;
        targetDotMaterial.opacity = connectorOpacity;
        connector.mesh.visible = connectorOpacity > 0.003;
        sourceDot.visible = connector.mesh.visible;
        targetDot.visible = connector.mesh.visible;
        if (!active || connectorOpacity <= 0.003) return;

        source.set(0, width < 720 ? -0.18 : 0.12, 0.035);
        active.group.localToWorld(source);

        const panelWidth = Math.min(390, width - 24);
        const anchorX = width < 720
          ? 0
          : side === 'right'
            ? width / 2 - panelWidth - 22
            : -width / 2 + panelWidth + 22;
        target.set(anchorX, height / 2 - (width < 720 ? 54 : 52), 310);
        const mobileBend = width < 720 ? cardHeight * 0.18 : 0;
        controlA.copy(source).add(new THREE.Vector3(side === 'right' ? mobileBend : -mobileBend, cardHeight * 0.27, 90));
        controlB.copy(target).add(new THREE.Vector3(side === 'right' ? -cardHeight * (width < 720 ? 0.3 : 0.12) : cardHeight * (width < 720 ? 0.3 : 0.12), -cardHeight * 0.1, -45));

        const position = connector.geometry.getAttribute('position') as THREE.BufferAttribute;
        const lineWidth = width < 720 ? 5 : 7;
        for (let index = 0; index <= CURVE_SEGMENTS; index += 1) {
          const t = index / CURVE_SEGMENTS;
          cubicPoint(curvePoint, source, controlA, controlB, target, t);
          const nextT = Math.min(1, t + 1 / CURVE_SEGMENTS);
          cubicPoint(previousCurvePoint, source, controlA, controlB, target, nextT);
          const tangentX = previousCurvePoint.x - curvePoint.x;
          const tangentY = previousCurvePoint.y - curvePoint.y;
          const tangentLength = Math.max(0.001, Math.hypot(tangentX, tangentY));
          const offsetX = (-tangentY / tangentLength) * lineWidth * 0.5;
          const offsetY = (tangentX / tangentLength) * lineWidth * 0.5;
          position.setXYZ(index * 2, curvePoint.x + offsetX, curvePoint.y + offsetY, curvePoint.z);
          position.setXYZ(index * 2 + 1, curvePoint.x - offsetX, curvePoint.y - offsetY, curvePoint.z);
        }
        position.needsUpdate = true;

        sourceDot.position.copy(source).setZ(315);
        targetDot.position.copy(target).setZ(315);
        const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.12;
        sourceDot.scale.setScalar(pulse);
        targetDot.scale.setScalar(0.9 + connectorOpacity * 0.25);
      };

      let previousTime = performance.now();
      let raf = 0;

      const render = (time: number) => {
        raf = requestAnimationFrame(render);
        const dt = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        if (!visible || document.hidden) return;

        if (!selectedIdRef.current) selected = null;
        else if (selected && items[selected.itemIndex].id !== selectedIdRef.current) selected = null;

        targetTravel += (reducedMotion ? 0 : stride * 0.64) * dt;
        const totalWidth = CARD_COPIES * stride;
        if (Math.abs(targetTravel) > totalWidth * 3) {
          const cycles = Math.trunc(targetTravel / totalWidth);
          targetTravel -= cycles * totalWidth;
          travel -= cycles * totalWidth;
        }
        travel = THREE.MathUtils.damp(travel, targetTravel, 5, dt);

        const mobileLayout = width < 720 || isCoarse;
        for (let index = 0; index < cards.length; index += 1) {
          const card = cards[index];
          let x = index * stride - travel;
          x = ((x + totalWidth / 2) % totalWidth + totalWidth) % totalWidth - totalWidth / 2;
          const normalized = THREE.MathUtils.clamp(x / Math.max(width * 0.5, 1), -1.35, 1.35);

          let y = -height * 0.08 - 0.1 * x * x / cardHeight;
          if (mobileLayout) {
            const centerDistance = THREE.MathUtils.clamp(Math.abs(x) / (cardHeight * 0.35), 0, 1);
            const centerLift = 1 - centerDistance * centerDistance * (3 - 2 * centerDistance);
            y = -height * 0.12 + centerLift * cardHeight * 0.22 - 0.1 * x * x / cardHeight;
          }
          baseY[index] = y;

          card.group.position.set(x, y, 145 - Math.abs(normalized) * 34);
          card.group.rotation.set(-0.035, normalized * -0.042, 0);
          card.group.scale.setScalar(cardHeight);
          card.group.visible = Math.abs(x) < width / 2 + cardHeight * 0.45;

          const item = items[card.itemIndex];
          const filterOpacity = focusIdRef.current && focusIdRef.current !== item.id ? 0.42 : 1;
          card.opacity = THREE.MathUtils.damp(card.opacity, filterOpacity, 5, dt);
          card.body.material.opacity = 0.97 * card.opacity;
          card.face.material.opacity = card.opacity;
        }

        scene.updateMatrixWorld(true);
        hovered = null;
        let strongestHover = 0;
        for (const card of cards) {
          const strength = mobileLayout ? 0 : hoverStrength(card);
          const selectedStrength = card === selected && !mobileLayout ? 1 : 0;
          const targetStrength = Math.max(strength, selectedStrength);
          card.hoverAmount = THREE.MathUtils.damp(card.hoverAmount, targetStrength, 5, dt);
          card.group.position.y += card.hoverAmount * cardHeight * 0.55;
          card.group.position.z += card.hoverAmount * 70;
          if (strength > strongestHover) {
            strongestHover = strength;
            hovered = card;
          }
        }
        if (strongestHover <= 0.025) hovered = null;

        if (hovered?.copyIndex !== notifiedHoverCopy) {
          notifiedHoverCopy = hovered?.copyIndex ?? -1;
          if (hovered) {
            hoverSide = hovered.group.position.x < 0 ? 'right' : 'left';
            hoverChangeRef.current?.(items[hovered.itemIndex], interactionFor(hovered, hoverSide));
          } else {
            hoverChangeRef.current?.(null);
          }
        }

        const active = hovered ?? selected;
        const activeSide = hovered ? hoverSide : selectedSide;
        scene.updateMatrixWorld(true);
        updateConnector(active, activeSide, dt);
        renderer.domElement.style.cursor = pointerDown ? 'grabbing' : hovered ? 'pointer' : 'grab';
        renderer.render(scene, camera);
      };

      raf = requestAnimationFrame(render);
      setReady(true);

      let cleaned = false;
      cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        cancelAnimationFrame(raf);
        intersectionObserver.disconnect();
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        renderer.domElement.removeEventListener('wheel', onWheel);
        cards.forEach((card) => {
          card.body.material.dispose();
          card.face.material.dispose();
        });
        textures.forEach((texture) => texture.dispose());
        bodyGeometry.dispose();
        faceGeometry.dispose();
        connector.geometry.dispose();
        connector.material.dispose();
        sourceDot.geometry.dispose();
        sourceDotMaterial.dispose();
        targetDot.geometry.dispose();
        targetDotMaterial.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      };
    };

    initialize().catch(() => setFallback(true));

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [items]);

  if (fallback) {
    return (
      <div className="opus-horizontal-track flex snap-x gap-4 overflow-x-auto px-4 pb-5" aria-label="الباقات المتاحة">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              onActivate(item, {
                origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
                side: rect.left + rect.width / 2 < window.innerWidth / 2 ? 'right' : 'left',
              });
            }}
            className="package-orbit-fallback min-w-[78vw] snap-center text-right sm:min-w-[320px]"
          >
            <span className="text-xs font-bold text-[var(--color-accent-2)]">{item.category}</span>
            <strong className="mt-4 block text-2xl font-extrabold text-[var(--color-text)]">{item.name}</strong>
            <span className="mt-8 block text-3xl font-extrabold text-[var(--color-text)]">{item.price.toLocaleString('ar-SA')} ر.س</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`package-orbit-mount ${ready ? 'is-ready' : ''}`} ref={mountRef}>
      <div className="package-orbit-loading" aria-hidden="true" />
    </div>
  );
}
