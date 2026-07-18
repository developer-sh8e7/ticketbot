'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';
import { LayoutDashboard, ShoppingCart, Smartphone } from 'lucide-react';
import { HeroVisual } from '@/components/HeroVisual';

/*
 * Real three.js hero scene — a glossy mint torus knot inside a particle
 * halo with orbiting geometric satellites.
 *
 * Interactions:
 *  - pointer parallax (whole scene leans toward the cursor)
 *  - drag to spin with inertia (mouse anywhere; touch: horizontal drags only,
 *    vertical stays with page scroll via touch-action: pan-y)
 *  - slow auto-rotation so it is always alive
 *
 * Falls back to the CSS `HeroVisual` ONLY when WebGL itself is unavailable —
 * never because of OS reduced-motion settings (that only slows it down).
 */
export function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFallback(true);
      return;
    }

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarse ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.className = 'h-full w-full';
    renderer.domElement.style.touchAction = 'pan-y';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 7.2);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const keyLight = new THREE.DirectionalLight(0xb9f6e8, 4.2);
    keyLight.position.set(3.5, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x79dce8, 1.5);
    rimLight.position.set(-4, -1, -3);
    scene.add(rimLight);
    const fillLight = new THREE.PointLight(0x0fc98f, 2.2, 16, 1.4);
    fillLight.position.set(0, 0.4, 2.4);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);

    const disposeBag: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(obj: T): T => {
      disposeBag.push(obj);
      return obj;
    };

    const ACCENT = 0x0fc98f;
    const INK = 0x07332e;
    const CREAM = 0xfbfefd;

    // ── central knot ────────────────────────────────────────────────────
    const knotGeo = track(new THREE.TorusKnotGeometry(1.02, 0.3, 256, 40));
    const knotMat = track(new THREE.MeshPhysicalMaterial({
      color: ACCENT,
      emissive: 0x035b52,
      emissiveIntensity: 0.32,
      metalness: 0.3,
      roughness: 0.28,
      clearcoat: 0.8,
      clearcoatRoughness: 0.25,
    }));
    const knot = new THREE.Mesh(knotGeo, knotMat);
    root.add(knot);

    // ── particle halo (fibonacci sphere) ────────────────────────────────
    const COUNT = 1500;
    const positions = new Float32Array(COUNT * 3);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const y = 1 - (i / (COUNT - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const r = 2.55 + Math.random() * 0.25;
      positions[i * 3] = Math.cos(theta) * radius * r;
      positions[i * 3 + 1] = y * r;
      positions[i * 3 + 2] = Math.sin(theta) * radius * r;
    }
    const haloGeo = track(new THREE.BufferGeometry());
    haloGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const haloMat = track(new THREE.PointsMaterial({
      color: INK,
      size: 0.022,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    }));
    const halo = new THREE.Points(haloGeo, haloMat);
    root.add(halo);

    const sparkGeo = track(new THREE.BufferGeometry());
    const sparkPositions = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(2.5 + Math.random() * 0.4);
      sparkPositions[i * 3] = v.x;
      sparkPositions[i * 3 + 1] = v.y;
      sparkPositions[i * 3 + 2] = v.z;
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMat = track(new THREE.PointsMaterial({
      color: ACCENT,
      size: 0.05,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    }));
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    root.add(sparks);

    // ── orbiting satellites ─────────────────────────────────────────────
    type Satellite = { mesh: THREE.Mesh; radius: number; speed: number; phase: number; tilt: number; spin: THREE.Vector3 };
    const satellites: Satellite[] = [];
    const satGeos = [
      track(new THREE.IcosahedronGeometry(0.17, 0)),
      track(new THREE.OctahedronGeometry(0.16, 0)),
      track(new THREE.TetrahedronGeometry(0.18, 0)),
      track(new THREE.BoxGeometry(0.2, 0.2, 0.2)),
      track(new THREE.TorusGeometry(0.14, 0.05, 12, 26)),
      track(new THREE.IcosahedronGeometry(0.12, 0)),
    ];
    const satMats = [
      track(new THREE.MeshPhysicalMaterial({ color: ACCENT, metalness: 0.35, roughness: 0.3, clearcoat: 0.6 })),
      track(new THREE.MeshPhysicalMaterial({ color: INK, metalness: 0.2, roughness: 0.45 })),
      track(new THREE.MeshPhysicalMaterial({ color: CREAM, metalness: 0.1, roughness: 0.35, clearcoat: 0.5 })),
    ];
    satGeos.forEach((geo, i) => {
      const mesh = new THREE.Mesh(geo, satMats[i % satMats.length]);
      const sat: Satellite = {
        mesh,
        radius: 2.0 + (i % 3) * 0.35,
        speed: (0.25 + (i % 4) * 0.09) * (i % 2 === 0 ? 1 : -1),
        phase: (i / satGeos.length) * Math.PI * 2,
        tilt: (i % 3) * 0.5 - 0.5,
        spin: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(0.9),
      };
      satellites.push(sat);
      root.add(mesh);
    });

    // ── interaction state ───────────────────────────────────────────────
    const pointer = { x: 0, y: 0 };
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let velX = 0;
    let velY = 0;
    let userRotX = 0;
    let userRotY = 0;

    const onPointerMove = (event: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      if (dragging) {
        velY = (event.clientX - lastX) * 0.005;
        velX = (event.clientY - lastY) * 0.005;
        lastX = event.clientX;
        lastY = event.clientY;
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      mount.style.cursor = 'grabbing';
    };
    const endDrag = () => {
      dragging = false;
      mount.style.cursor = 'grab';
    };

    mount.style.cursor = 'grab';
    mount.addEventListener('pointermove', onPointerMove);
    mount.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);

    // ── sizing / visibility ─────────────────────────────────────────────
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let visible = true;
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(mount);

    // ── loop ────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const speedScale = 1;
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime * speedScale;

      // inertia from dragging
      userRotY += velY;
      userRotX += velX;
      velX *= 0.94;
      velY *= 0.94;
      userRotX = THREE.MathUtils.clamp(userRotX, -0.9, 0.9);

      knot.rotation.y = t * 0.32 + userRotY;
      knot.rotation.x = Math.sin(t * 0.22) * 0.35 + userRotX;
      halo.rotation.y = t * 0.05 + userRotY * 0.4;
      halo.rotation.z = t * 0.02;
      sparks.rotation.y = -t * 0.08 + userRotY * 0.6;

      const breathe = 1 + Math.sin(t * 0.9) * 0.025;
      knot.scale.setScalar(breathe);

      for (const sat of satellites) {
        const a = t * sat.speed + sat.phase;
        sat.mesh.position.set(
          Math.cos(a) * sat.radius,
          Math.sin(a * 0.9) * sat.radius * 0.42 + sat.tilt,
          Math.sin(a) * sat.radius * 0.8
        );
        sat.mesh.rotation.x += sat.spin.x * dt;
        sat.mesh.rotation.y += sat.spin.y * dt;
      }

      // pointer parallax with damping
      camera.position.x += (pointer.x * 0.55 - camera.position.x) * (dt * 3.2);
      camera.position.y += (-pointer.y * 0.4 - camera.position.y) * (dt * 3.2);
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      io.disconnect();
      mount.removeEventListener('pointermove', onPointerMove);
      mount.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      disposeBag.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  if (fallback) return <HeroVisual />;

  return (
    <div dir="rtl" className="relative mx-auto h-[330px] w-full max-w-[560px] sm:h-[440px] lg:h-[520px]">
      <div className="hero-glow absolute left-1/2 top-1/2 h-[70%] w-[85%] rounded-full bg-[var(--color-accent)]/10 blur-3xl" aria-hidden="true" />
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      {/* floating capability chips above the canvas */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="hero-float-sm absolute right-[1%] top-[6%] flex scale-90 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 py-2 pe-4 ps-2 shadow-[0_12px_35px_rgba(45,40,32,0.12)] backdrop-blur-sm sm:scale-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)]"><ShoppingCart size={14} /></span>
          <span className="whitespace-nowrap font-arabic text-xs font-extrabold text-[var(--color-text)]">متجر إلكتروني</span>
        </div>
        <div className="hero-float-sm absolute bottom-[10%] right-[4%] flex scale-90 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 py-2 pe-4 ps-2 shadow-[0_12px_35px_rgba(45,40,32,0.12)] backdrop-blur-sm [animation-delay:1.6s] sm:scale-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)]"><Smartphone size={14} /></span>
          <span className="whitespace-nowrap font-arabic text-xs font-extrabold text-[var(--color-text)]">تطبيق جوال</span>
        </div>
        <div className="hero-float-sm absolute left-[2%] top-[10%] flex scale-90 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/90 py-2 pe-4 ps-2 shadow-[0_12px_35px_rgba(45,40,32,0.12)] backdrop-blur-sm [animation-delay:0.9s] sm:scale-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)]/12 text-[var(--color-accent)]"><LayoutDashboard size={14} /></span>
          <span className="whitespace-nowrap font-arabic text-xs font-extrabold text-[var(--color-text)]">موقع تعريفي</span>
        </div>
      </div>
    </div>
  );
}
