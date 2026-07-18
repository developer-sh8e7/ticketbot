'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';

type SceneVariant = 'welcome' | 'home' | 'project' | 'bots';

/**
 * An evolving glowing orb made of an icosahedron wireframe shell plus an inner
 * luminous core and orbiting accent particles. Replaces the old stacked-cubes
 * scene — cleaner, less boxy, reads well on the light theme.
 */
export function WelcomeScene3D({ variant = 'welcome' }: { variant?: SceneVariant }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setFallback(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      setFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    // Lights — warm key + cool rim for depth on a light backdrop.
    scene.add(new THREE.AmbientLight(0xffffff, 1.8));
    const keyLight = new THREE.DirectionalLight(0xffb45c, 4.5);
    keyLight.position.set(3.5, 4, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x9aa6c8, 1.6);
    rimLight.position.set(-4, -1, -3);
    scene.add(rimLight);
    const fillLight = new THREE.PointLight(0xff8a00, 2.4, 14, 1.4);
    fillLight.position.set(0, 0, 2.2);
    scene.add(fillLight);

    const root = new THREE.Group();
    scene.add(root);

    const disposeBag: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(obj: T): T => {
      disposeBag.push(obj);
      return obj;
    };

    const accent = 0xff7a00;

    // Inner glowing core — small emissive sphere.
    const coreGeo = track(new THREE.IcosahedronGeometry(0.55, 2));
    const coreMat = track(new THREE.MeshPhysicalMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.9,
      metalness: 0.2,
      roughness: 0.35,
      clearcoat: 0.6,
    }));
    const core = new THREE.Mesh(coreGeo, coreMat);
    root.add(core);

    // Outer wireframe shell — feels like a forming structure.
    const shellGeo = track(new THREE.IcosahedronGeometry(1.65, 1));
    const shellMat = track(new THREE.MeshBasicMaterial({
      color: accent,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    }));
    const shell = new THREE.Mesh(shellGeo, shellMat);
    root.add(shell);

    // Secondary translucent solid for depth.
    const haloGeo = track(new THREE.IcosahedronGeometry(1.05, 3));
    const haloMat = track(new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.2,
      transparent: true,
      opacity: 0.12,
      clearcoat: 0.9,
      transmission: 0.7,
    }));
    const halo = new THREE.Mesh(haloGeo, haloMat);
    root.add(halo);

    // Orbiting accent particles — three dotted rings.
    const rings: { mesh: THREE.Points; tilt: THREE.Vector3; speed: number }[] = [];
    const ringCount = 3;
    for (let i = 0; i < ringCount; i++) {
      const count = 90;
      const positions = new Float32Array(count * 3);
      const radius = 2.05 + i * 0.18;
      for (let p = 0; p < count; p++) {
        const theta = (p / count) * Math.PI * 2;
        positions[p * 3] = Math.cos(theta) * radius;
        positions[p * 3 + 1] = Math.sin(theta) * radius;
        positions[p * 3 + 2] = (Math.sin(theta * 3) * 0.05);
      }
      const pointsGeo = track(new THREE.BufferGeometry());
      pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const pointsMat = track(new THREE.PointsMaterial({
        color: i % 2 ? 0xff9a33 : accent,
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
      }));
      const points = new THREE.Points(pointsGeo, pointsMat);
      const tilt = new THREE.Vector3(
        (i - 1) * 0.6,
        (Math.PI / 2) - i * 0.5,
        (i - 1) * 0.9,
      );
      points.rotation.set(tilt.x, tilt.y, tilt.z);
      root.add(points);
      rings.push({ mesh: points, tilt, speed: 0.18 + i * 0.07 });
    }

    // Floating spark cubes near the orb for the "building blocks" feel.
    const sparks: { group: THREE.Group; phase: number; orbit: number; radius: number }[] = [];
    const sparkGeo = track(new THREE.BoxGeometry(0.14, 0.14, 0.14));
    const sparkMat = track(new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.4, metalness: 0.5, roughness: 0.3 }));
    const sparkCount = variant === 'bots' ? 5 : 4;
    for (let i = 0; i < sparkCount; i++) {
      const group = new THREE.Group();
      const cube = new THREE.Mesh(sparkGeo, sparkMat);
      group.add(cube);
      const orbit = (i / sparkCount) * Math.PI * 2;
      const radius = 2.3 + (i % 2) * 0.35;
      group.position.set(Math.cos(orbit) * radius, Math.sin(orbit * 1.4) * 0.7, Math.sin(orbit) * radius);
      root.add(group);
      sparks.push({ group, phase: i * 0.9, orbit, radius });
    }

    // Pointer parallax.
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    const clock = new THREE.Clock();
    const entranceDur = 1.6;
    let frame = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const rawEntrance = Math.min(1, elapsed / entranceDur);
      const entrance = 1 - Math.pow(1 - rawEntrance, 3);

      // Smooth pointer follow.
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;

      const scale = 0.35 + entrance * 0.65;
      root.scale.setScalar(scale);

      core.rotation.y = elapsed * 0.45;
      core.rotation.x = elapsed * 0.22;
      core.material.emissiveIntensity = 0.7 + Math.sin(elapsed * 2.2) * 0.18;

      shell.rotation.y = elapsed * 0.12;
      shell.rotation.x = elapsed * 0.06;
      shell.material.opacity = 0.4 + Math.sin(elapsed * 1.3) * 0.12;

      halo.rotation.y = -elapsed * 0.18;
      halo.rotation.z = elapsed * 0.05;

      rings.forEach((ring, i) => {
        ring.mesh.rotation.x = ring.tilt.x + elapsed * ring.speed * (i % 2 ? 1 : -1);
        ring.mesh.rotation.y = ring.tilt.y + elapsed * ring.speed * 0.6;
        ring.mesh.rotation.z = ring.tilt.z + Math.sin(elapsed * 0.5 + i) * 0.2;
      });

      sparks.forEach((spark) => {
        const angle = spark.orbit + elapsed * 0.4;
        spark.group.position.x = Math.cos(angle) * spark.radius;
        spark.group.position.z = Math.sin(angle) * spark.radius;
        spark.group.position.y = Math.sin(elapsed * 0.9 + spark.phase) * 0.55;
        spark.group.rotation.x = elapsed * (0.6 + spark.phase * 0.1);
        spark.group.rotation.y = elapsed * (0.4 + spark.phase * 0.1);
      });

      root.rotation.y = pointer.x * 0.28;
      root.rotation.x = pointer.y * 0.16;
      root.position.y = Math.sin(elapsed * 0.55) * 0.06;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      shellGeo.dispose();
      shellMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      haloGeo.dispose();
      haloMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
      rings.forEach((r) => { r.mesh.geometry.dispose(); (r.mesh.material as THREE.Material).dispose(); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  if (fallback) {
    return (
      <div className="relative flex h-full min-h-64 items-center justify-center" aria-hidden="true">
        <div className="relative h-44 w-44">
          <span className="absolute inset-0 rounded-full border border-[var(--color-accent)]/40" />
          <span className="absolute inset-4 rounded-full border border-[var(--color-accent)]/60" />
          <span className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] shadow-[0_18px_70px_rgba(255,122,0,0.35)]" />
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="h-full min-h-64 w-full" aria-hidden="true" />;
}
