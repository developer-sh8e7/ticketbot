'use client';

import * as THREE from 'three';
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

type PackageOrbitSceneProps = {
  items: readonly PackageOrbitItem[];
  focusId?: string | null;
  onActivate: (item: PackageOrbitItem, origin: { x: number; y: number }) => void;
  onHoverChange?: (item: PackageOrbitItem | null) => void;
};

type OrbitMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: {
    itemIndex: number;
    copyIndex: number;
    hoverAmount: number;
    opacity: number;
  };
};

const CARD_COPIES = 64;
const CARD_TEXTURE_WIDTH = 600;
const CARD_TEXTURE_HEIGHT = 1200;

const cardPalettes = [
  { glow: '#18d6a0', wash: '#dff9f1', edge: '#71e7c8' },
  { glow: '#38bfd3', wash: '#e2f7fa', edge: '#8bdde8' },
  { glow: '#cef42e', wash: '#f3fad8', edge: '#dff67c' },
  { glow: '#14c79c', wash: '#e3f8f3', edge: '#73dfc5' },
  { glow: '#73d6e3', wash: '#e8f8fa', edge: '#a6e7ee' },
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

  roundedRect(ctx, 18, 18, 564, 1164, 52);
  ctx.fillStyle = 'rgba(250, 254, 253, 0.975)';
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 18, 18, 564, 1164, 52);
  ctx.clip();

  const wash = ctx.createLinearGradient(40, 30, 560, 1160);
  wash.addColorStop(0, palette.wash);
  wash.addColorStop(0.46, 'rgba(251, 254, 253, 0.28)');
  wash.addColorStop(1, palette.wash);
  ctx.fillStyle = wash;
  ctx.globalAlpha = 0.72;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lowerGlow = ctx.createRadialGradient(112, 1090, 10, 112, 1090, 420);
  lowerGlow.addColorStop(0, palette.glow);
  lowerGlow.addColorStop(0.48, `${palette.edge}cc`);
  lowerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = item.popular ? 0.84 : 0.52;
  ctx.fillStyle = lowerGlow;
  ctx.fillRect(0, 650, canvas.width, 550);

  const sideGlow = ctx.createRadialGradient(570, 115, 0, 570, 115, 330);
  sideGlow.addColorStop(0, palette.edge);
  sideGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = sideGlow;
  ctx.fillRect(280, 0, 320, 440);
  ctx.restore();
  ctx.globalAlpha = 1;

  roundedRect(ctx, 18, 18, 564, 1164, 52);
  ctx.strokeStyle = item.popular ? `${palette.glow}c4` : 'rgba(255,255,255,0.94)';
  ctx.lineWidth = item.popular ? 5 : 3;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#0b8d78';
  ctx.font = '700 25px "Cairo", sans-serif';
  ctx.fillText(item.category, 522, 105);

  if (item.popular) {
    roundedRect(ctx, 54, 66, 150, 50, 25);
    ctx.fillStyle = '#d8f75a';
    ctx.fill();
    ctx.fillStyle = '#07332e';
    ctx.textAlign = 'center';
    ctx.font = '800 22px "Cairo", sans-serif';
    ctx.fillText('الأكثر طلبا', 129, 100);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#07332e';
  ctx.font = '800 50px "Cairo", sans-serif';
  const nameLines = rtlLines(ctx, item.name, 462, 2);
  nameLines.forEach((line, lineIndex) => ctx.fillText(line, 522, 255 + lineIndex * 70));

  ctx.fillStyle = '#517069';
  ctx.font = '500 27px "Cairo", sans-serif';
  const descriptionLines = rtlLines(ctx, item.description, 462, 3);
  descriptionLines.forEach((line, lineIndex) => ctx.fillText(line, 522, 440 + lineIndex * 48));

  ctx.strokeStyle = 'rgba(7, 51, 46, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(58, 650);
  ctx.lineTo(522, 650);
  ctx.stroke();

  ctx.fillStyle = '#0b8d78';
  ctx.font = '700 24px "Cairo", sans-serif';
  ctx.fillText('السعر بعد الخصم', 522, 725);

  const currentPrice = item.price.toLocaleString('ar-SA');
  ctx.fillStyle = '#07332e';
  ctx.font = '800 76px "Cairo", sans-serif';
  ctx.fillText(currentPrice, 522, 820);
  const priceWidth = ctx.measureText(currentPrice).width;
  ctx.fillStyle = '#0b8d78';
  ctx.font = '800 26px "Cairo", sans-serif';
  ctx.fillText('ر.س', 505 - priceWidth, 816);

  if (item.originalPrice > item.price) {
    const oldPrice = `بدلا من ${item.originalPrice.toLocaleString('ar-SA')} ر.س`;
    ctx.fillStyle = '#6c8580';
    ctx.font = '600 24px "Cairo", sans-serif';
    ctx.fillText(oldPrice, 522, 875);
    const oldWidth = ctx.measureText(oldPrice).width;
    ctx.strokeStyle = '#6c8580';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(522 - oldWidth, 866);
    ctx.lineTo(522, 866);
    ctx.stroke();
  }

  ctx.fillStyle = '#517069';
  ctx.font = '600 23px "Cairo", sans-serif';
  ctx.fillText('تصميم وبرمجة وتسليم ودعم فني', 522, 948);

  roundedRect(ctx, 58, 1032, 484, 90, 45);
  const buttonGradient = ctx.createLinearGradient(58, 1032, 542, 1122);
  buttonGradient.addColorStop(0, '#bdf04f');
  buttonGradient.addColorStop(0.52, '#39d9a2');
  buttonGradient.addColorStop(1, '#5bcad9');
  ctx.fillStyle = buttonGradient;
  ctx.fill();
  ctx.fillStyle = '#07332e';
  ctx.textAlign = 'center';
  ctx.font = '800 27px "Cairo", sans-serif';
  ctx.fillText('اضغط وشوف التفاصيل', 300, 1089);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

export function PackageOrbitScene({ items, focusId = null, onActivate, onHoverChange }: PackageOrbitSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const focusIdRef = useRef(focusId);
  const activateRef = useRef(onActivate);
  const hoverChangeRef = useRef(onHoverChange);
  const [fallback, setFallback] = useState(false);
  const [ready, setReady] = useState(false);

  focusIdRef.current = focusId;
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.25 : 1.6));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.className = 'package-orbit-canvas';
      renderer.domElement.setAttribute('aria-hidden', 'true');
      mount.appendChild(renderer.domElement);

      const onContextLost = (event: Event) => {
        event.preventDefault();
        setFallback(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2200);
      camera.position.set(0, 0, 1200);
      camera.lookAt(0, 0, 0);

      const textures = items.map((item, index) => makeCardTexture(item, index, renderer));
      const geometry = new THREE.PlaneGeometry(1, 1);
      const meshes: OrbitMesh[] = [];

      for (let index = 0; index < CARD_COPIES; index += 1) {
        const itemIndex = index % items.length;
        const material = new THREE.MeshBasicMaterial({
          map: textures[itemIndex],
          transparent: true,
          alphaTest: 0.025,
          depthTest: true,
          depthWrite: true,
          opacity: 1,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geometry, material) as OrbitMesh;
        mesh.userData = { itemIndex, copyIndex: index, hoverAmount: 0, opacity: 1 };
        meshes.push(mesh);
        scene.add(mesh);
      }

      let width = 1;
      let height = 1;
      let cardWidth = 190;
      let cardHeight = 422;
      let stride = 127;
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
        cardWidth = Math.min(220, Math.max(width < 720 ? 90 : 145, width * (width < 720 ? 0.25 : 0.115)));
        cardHeight = cardWidth / 0.45;
        stride = cardHeight * 0.3;
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      const pointer = new THREE.Vector2(4, 4);
      const projected = new THREE.Vector3();
      let pointerInside = false;
      let pointerDown = false;
      let dragged = false;
      let dragDistance = 0;
      let lastPointerX = 0;
      let lastPointerY = 0;
      let hovered: OrbitMesh | null = null;
      let notifiedHoverId: string | null = null;
      let targetTravel = 0;
      let travel = 0;

      const updatePointer = (event: PointerEvent | MouseEvent) => {
        const rect = mount.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        pointerInside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      };

      const hoverStrength = (mesh: OrbitMesh) => {
        if (!pointerInside || !mesh.visible) return 0;
        projected.copy(mesh.position);
        projected.y = baseY[mesh.userData.copyIndex];
        projected.project(camera);
        const dx = (pointer.x - projected.x) * (width / height);
        const dy = (pointer.y - projected.y) * 0.1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const t = THREE.MathUtils.clamp(1 - distance / 0.3, 0, 1);
        return t * t * (3 - 2 * t);
      };

      const closestCard = () => {
        let closest: OrbitMesh | null = null;
        let strongest = 0;
        for (const mesh of meshes) {
          const strength = hoverStrength(mesh);
          if (strength > strongest) {
            strongest = strength;
            closest = mesh;
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
        const selected = !dragged ? closestCard() : null;
        pointerDown = false;
        if (renderer.domElement.hasPointerCapture?.(event.pointerId)) {
          renderer.domElement.releasePointerCapture(event.pointerId);
        }
        if (!selected) return;
        const item = items[selected.userData.itemIndex];
        activateRef.current(item, { x: event.clientX, y: event.clientY });
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

      let previousTime = performance.now();
      let raf = 0;

      const render = (time: number) => {
        raf = requestAnimationFrame(render);
        const dt = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        if (!visible || document.hidden) return;

        targetTravel += (reducedMotion ? 0 : stride * 0.64) * dt;
        const totalWidth = CARD_COPIES * stride;
        if (Math.abs(targetTravel) > totalWidth * 3) {
          const cycles = Math.trunc(targetTravel / totalWidth);
          targetTravel -= cycles * totalWidth;
          travel -= cycles * totalWidth;
        }
        travel = THREE.MathUtils.damp(travel, targetTravel, 5, dt);

        const mobileLayout = width < 720 || isCoarse;
        for (let index = 0; index < meshes.length; index += 1) {
          const mesh = meshes[index];
          let x = index * stride - travel;
          x = ((x + totalWidth / 2) % totalWidth + totalWidth) % totalWidth - totalWidth / 2;
          const normalized = THREE.MathUtils.clamp(x / Math.max(width * 0.5, 1), -1.35, 1.35);

          let y = -height * 0.08 - 0.1 * x * x / cardHeight;
          if (mobileLayout) {
            const centerDistance = THREE.MathUtils.clamp(Math.abs(x) / (cardHeight * 0.35), 0, 1);
            const centerLift = 1 - centerDistance * centerDistance * (3 - 2 * centerDistance);
            y = -height * 0.02 + centerLift * cardHeight * 0.5 - 0.1 * x * x / cardHeight;
          }
          baseY[index] = y;

          mesh.position.set(x, y, 150 - Math.abs(normalized) * 54);
          mesh.rotation.set(0, 0, 0);
          mesh.scale.set(cardWidth, cardHeight, 1);
          mesh.visible = Math.abs(x) < width / 2 + cardWidth;

          const item = items[mesh.userData.itemIndex];
          const focusOpacity = focusIdRef.current && focusIdRef.current !== item.id ? 0.47 : 1;
          mesh.userData.opacity = THREE.MathUtils.damp(mesh.userData.opacity, focusOpacity, 5, dt);
          mesh.material.opacity = mesh.userData.opacity;
        }

        scene.updateMatrixWorld(true);
        hovered = null;
        let strongestHover = 0;
        for (const mesh of meshes) {
          const strength = mobileLayout ? 0 : hoverStrength(mesh);
          mesh.userData.hoverAmount = THREE.MathUtils.damp(mesh.userData.hoverAmount, strength, 5, dt);
          mesh.position.y += mesh.userData.hoverAmount * cardHeight * 0.55;
          if (strength > strongestHover) {
            strongestHover = strength;
            hovered = mesh;
          }
        }
        if (strongestHover <= 0.025) hovered = null;

        const hoverId = hovered ? items[hovered.userData.itemIndex].id : null;
        if (hoverId !== notifiedHoverId) {
          notifiedHoverId = hoverId;
          hoverChangeRef.current?.(hovered ? items[hovered.userData.itemIndex] : null);
        }
        renderer.domElement.style.cursor = pointerDown ? 'grabbing' : hovered ? 'pointer' : 'grab';

        scene.updateMatrixWorld(true);
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
        meshes.forEach((mesh) => mesh.material.dispose());
        textures.forEach((texture) => texture.dispose());
        geometry.dispose();
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
              onActivate(item, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }}
            className="package-orbit-fallback min-w-[78vw] snap-center text-right sm:min-w-[320px]"
          >
            <span className="text-xs font-bold text-[var(--color-accent-2)]">{item.category}</span>
            <strong className="mt-4 block text-2xl font-extrabold text-[var(--color-text)]">{item.name}</strong>
            <span className="mt-3 block text-sm leading-7 text-[var(--color-muted)]">{item.description}</span>
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
