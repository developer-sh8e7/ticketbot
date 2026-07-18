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
    hoverAmount: number;
    opacity: number;
  };
};

type OrbitHitMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: { visualIndex: number };
};

const CARD_COPIES = 35;
const CARD_TEXTURE_WIDTH = 640;
const CARD_TEXTURE_HEIGHT = 960;

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

  roundedRect(ctx, 18, 18, 604, 924, 54);
  ctx.fillStyle = 'rgba(250, 254, 253, 0.965)';
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 18, 18, 604, 924, 54);
  ctx.clip();

  const topWash = ctx.createLinearGradient(0, 0, CARD_TEXTURE_WIDTH, CARD_TEXTURE_HEIGHT);
  topWash.addColorStop(0, palette.wash);
  topWash.addColorStop(0.42, 'rgba(251, 254, 253, 0.1)');
  topWash.addColorStop(1, palette.wash);
  ctx.fillStyle = topWash;
  ctx.globalAlpha = 0.72;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const lowerGlow = ctx.createRadialGradient(116, 850, 10, 116, 850, 360);
  lowerGlow.addColorStop(0, palette.glow);
  lowerGlow.addColorStop(0.48, `${palette.edge}cc`);
  lowerGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = item.popular ? 0.82 : 0.48;
  ctx.fillStyle = lowerGlow;
  ctx.fillRect(0, 500, canvas.width, 460);

  const sideGlow = ctx.createRadialGradient(610, 110, 0, 610, 110, 320);
  sideGlow.addColorStop(0, palette.edge);
  sideGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = sideGlow;
  ctx.fillRect(300, 0, 340, 420);
  ctx.restore();
  ctx.globalAlpha = 1;

  roundedRect(ctx, 18, 18, 604, 924, 54);
  ctx.strokeStyle = item.popular ? `${palette.glow}b8` : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = item.popular ? 5 : 3;
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#0b8d78';
  ctx.font = '700 25px "Cairo", sans-serif';
  ctx.fillText(item.category, 554, 102);

  if (item.popular) {
    roundedRect(ctx, 64, 67, 145, 50, 25);
    ctx.fillStyle = '#d8f75a';
    ctx.fill();
    ctx.fillStyle = '#07332e';
    ctx.textAlign = 'center';
    ctx.font = '800 22px "Cairo", sans-serif';
    ctx.fillText('الأكثر طلبا', 136, 101);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#07332e';
  ctx.font = '800 49px "Cairo", sans-serif';
  const nameLines = rtlLines(ctx, item.name, 490, 2);
  nameLines.forEach((line, lineIndex) => ctx.fillText(line, 554, 225 + lineIndex * 68));

  ctx.fillStyle = '#517069';
  ctx.font = '500 27px "Cairo", sans-serif';
  const descriptionLines = rtlLines(ctx, item.description, 490, 3);
  descriptionLines.forEach((line, lineIndex) => ctx.fillText(line, 554, 395 + lineIndex * 47));

  ctx.strokeStyle = 'rgba(7, 51, 46, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(68, 570);
  ctx.lineTo(554, 570);
  ctx.stroke();

  ctx.fillStyle = '#07332e';
  ctx.font = '800 72px "Cairo", sans-serif';
  ctx.fillText(item.price.toLocaleString('ar-SA'), 554, 685);
  const priceWidth = ctx.measureText(item.price.toLocaleString('ar-SA')).width;
  ctx.fillStyle = '#0b8d78';
  ctx.font = '800 27px "Cairo", sans-serif';
  ctx.fillText('ر.س', 535 - priceWidth, 682);

  if (item.originalPrice > item.price) {
    ctx.fillStyle = '#6c8580';
    ctx.font = '600 25px "Cairo", sans-serif';
    ctx.fillText(`بدلا من ${item.originalPrice.toLocaleString('ar-SA')} ر.س`, 554, 743);
    const oldWidth = ctx.measureText(`بدلا من ${item.originalPrice.toLocaleString('ar-SA')} ر.س`).width;
    ctx.strokeStyle = '#6c8580';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(554 - oldWidth, 733);
    ctx.lineTo(554, 733);
    ctx.stroke();
  }

  roundedRect(ctx, 68, 808, 486, 82, 41);
  const buttonGradient = ctx.createLinearGradient(68, 808, 554, 890);
  buttonGradient.addColorStop(0, '#bdf04f');
  buttonGradient.addColorStop(0.52, '#39d9a2');
  buttonGradient.addColorStop(1, '#5bcad9');
  ctx.fillStyle = buttonGradient;
  ctx.fill();
  ctx.fillStyle = '#07332e';
  ctx.textAlign = 'center';
  ctx.font = '800 28px "Cairo", sans-serif';
  ctx.fillText('اضغط وشوف التفاصيل', 311, 860);

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
      const hitMeshes: OrbitHitMesh[] = [];
      const hitMaterial = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        colorWrite: false,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

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
        mesh.userData = { itemIndex, hoverAmount: 0, opacity: 1 };
        meshes.push(mesh);
        scene.add(mesh);

        const hitMesh = new THREE.Mesh(geometry, hitMaterial) as OrbitHitMesh;
        hitMesh.userData = { visualIndex: index };
        hitMeshes.push(hitMesh);
        scene.add(hitMesh);
      }

      let width = 1;
      let height = 1;
      let cardWidth = 210;
      let cardHeight = 330;
      let stride = 150;

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
        cardWidth = Math.min(226, Math.max(154, width * 0.395));
        cardHeight = cardWidth * 1.5;
        stride = cardWidth * (width < 640 ? 0.65 : 0.72);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(4, 4);
      let pointerInside = false;
      let hovered: OrbitMesh | null = null;
      let notifiedHoverId: string | null = null;

      const updatePointer = (event: PointerEvent | MouseEvent) => {
        const rect = mount.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        pointerInside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      };

      const pickHovered = () => {
        if (!pointerInside) return null;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObjects(hitMeshes, false)[0]?.object as OrbitHitMesh | undefined;
        return hit ? meshes[hit.userData.visualIndex] : null;
      };

      const onPointerMove = (event: PointerEvent) => {
        updatePointer(event);
      };
      const onPointerLeave = () => {
        pointerInside = false;
        pointer.set(4, 4);
      };
      const onClick = (event: MouseEvent) => {
        updatePointer(event);
        const picked = pickHovered();
        if (!picked) return;
        const item = items[picked.userData.itemIndex];
        activateRef.current(item, { x: event.clientX, y: event.clientY });
      };

      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('click', onClick);

      let visible = true;
      const intersectionObserver = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      }, { rootMargin: '180px' });
      intersectionObserver.observe(mount);

      let travel = 0;
      let previousTime = performance.now();
      let raf = 0;

      const render = (time: number) => {
        raf = requestAnimationFrame(render);
        const dt = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        if (!visible || document.hidden) return;

        const speed = reducedMotion ? 0 : width < 640 ? 52 : 92;
        travel += dt * speed;
        const totalWidth = CARD_COPIES * stride;
        if (travel >= totalWidth) travel %= totalWidth;

        for (let index = 0; index < meshes.length; index += 1) {
          const mesh = meshes[index];
          const hitMesh = hitMeshes[index];
          let x = index * stride - travel;
          x = ((x + totalWidth / 2) % totalWidth + totalWidth) % totalWidth - totalWidth / 2;
          const normalized = THREE.MathUtils.clamp(x / Math.max(width * 0.5, 1), -1.25, 1.25);
          const curve = Math.pow(Math.abs(normalized), 1.72);
          const baseY = 18 - curve * Math.min(118, height * 0.23);
          const baseZ = 150 - Math.abs(normalized) * 54;

          mesh.position.x = x;
          mesh.position.y = baseY + mesh.userData.hoverAmount * Math.min(138, height * 0.28);
          mesh.position.z = baseZ + mesh.userData.hoverAmount * 260;
          mesh.rotation.z = -normalized * 0.105 * (1 - mesh.userData.hoverAmount * 0.75);
          mesh.rotation.y = normalized * 0.16 * (1 - mesh.userData.hoverAmount);

          const hoverScale = 1 + mesh.userData.hoverAmount * 0.075;
          mesh.scale.set(cardWidth * hoverScale, cardHeight * hoverScale, 1);
          mesh.visible = Math.abs(x) < width / 2 + cardWidth;

          // Cover the union of the resting and lifted card positions. The hit
          // target never follows hover, so the visible card cannot escape the
          // pointer and oscillate between raised and resting states.
          const maxLift = Math.min(138, height * 0.28);
          hitMesh.position.set(x, baseY + maxLift / 2, baseZ);
          hitMesh.rotation.set(0, normalized * 0.16, -normalized * 0.105);
          hitMesh.scale.set(cardWidth * 1.1, cardHeight + maxLift, 1);
          hitMesh.visible = mesh.visible;

          const item = items[mesh.userData.itemIndex];
          const focusOpacity = focusIdRef.current && focusIdRef.current !== item.id ? 0.47 : 1;
          mesh.userData.opacity += (focusOpacity - mesh.userData.opacity) * Math.min(1, dt * 7);
          mesh.material.opacity = mesh.userData.opacity;
        }

        scene.updateMatrixWorld(true);
        const nextHovered = pickHovered();
        hovered = nextHovered?.visible ? nextHovered : null;
        for (const mesh of meshes) {
          const target = mesh === hovered ? 1 : 0;
          mesh.userData.hoverAmount += (target - mesh.userData.hoverAmount) * Math.min(1, dt * 12);
        }

        const hoverId = hovered ? items[hovered.userData.itemIndex].id : null;
        if (hoverId !== notifiedHoverId) {
          notifiedHoverId = hoverId;
          hoverChangeRef.current?.(hovered ? items[hovered.userData.itemIndex] : null);
        }
        renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';

        renderer.render(scene, camera);
      };

      raf = requestAnimationFrame(render);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        intersectionObserver.disconnect();
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        renderer.domElement.removeEventListener('click', onClick);
        meshes.forEach((mesh) => mesh.material.dispose());
        hitMaterial.dispose();
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
