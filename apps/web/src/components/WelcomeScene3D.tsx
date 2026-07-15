'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';

type Piece = {
  group: THREE.Group;
  start: THREE.Vector3;
  target: THREE.Vector3;
  targetRotation: THREE.Euler;
  phase: number;
};

const pieceConfigs = [
  { size: [3.4, 0.16, 2.25], position: [0, -1.25, 0], rotation: [0, 0, 0], accent: false },
  { size: [2.9, 0.16, 1.9], position: [0.18, -0.78, 0.08], rotation: [0, -0.08, 0], accent: false },
  { size: [2.35, 0.16, 1.55], position: [-0.12, -0.31, 0.18], rotation: [0, 0.1, 0], accent: true },
  { size: [1.8, 0.16, 1.15], position: [0.22, 0.16, 0.26], rotation: [0, -0.12, 0], accent: false },
  { size: [1.25, 0.16, 0.78], position: [-0.08, 0.63, 0.34], rotation: [0, 0.12, 0], accent: false },
  { size: [0.62, 0.62, 0.62], position: [0.34, 1.23, 0.4], rotation: [0.18, 0.35, 0.08], accent: true },
] as const;

export function WelcomeScene3D() {
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
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7.2);

    const assembly = new THREE.Group();
    assembly.rotation.set(-0.42, -0.52, 0.1);
    scene.add(assembly);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffb45c, 5.5);
    keyLight.position.set(3, 5, 5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x6f7787, 2.2);
    rimLight.position.set(-4, 1, -3);
    scene.add(rimLight);

    const darkMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x171719,
      metalness: 0.62,
      roughness: 0.32,
      clearcoat: 0.55,
      clearcoatRoughness: 0.35,
    });
    const accentMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff8a00,
      emissive: 0x5a2100,
      emissiveIntensity: 0.35,
      metalness: 0.48,
      roughness: 0.3,
      clearcoat: 0.75,
    });
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xffa433, transparent: true, opacity: 0.48 });
    const mutedEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x5b5b62, transparent: true, opacity: 0.65 });
    const geometries: THREE.BufferGeometry[] = [];

    const pieces: Piece[] = pieceConfigs.map((config, index) => {
      const geometry = new THREE.BoxGeometry(...config.size);
      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      geometries.push(geometry, edgeGeometry);

      const group = new THREE.Group();
      const mesh = new THREE.Mesh(geometry, config.accent ? accentMaterial : darkMaterial);
      const edges = new THREE.LineSegments(edgeGeometry, config.accent ? edgeMaterial : mutedEdgeMaterial);
      group.add(mesh, edges);

      const target = new THREE.Vector3(...config.position);
      const start = new THREE.Vector3(
        target.x + (index % 2 === 0 ? -2.8 : 2.8),
        target.y + 2.5 + index * 0.35,
        target.z - 1.4
      );
      group.position.copy(start);
      group.rotation.set(config.rotation[0] + 0.7, config.rotation[1] + (index % 2 ? -0.9 : 0.9), config.rotation[2] + 0.35);
      assembly.add(group);

      return {
        group,
        start,
        target,
        targetRotation: new THREE.Euler(...config.rotation),
        phase: index * 0.72,
      };
    });

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 2;
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
    let frame = 0;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const rawEntrance = Math.min(1, elapsed / 1.7);
      const entrance = 1 - Math.pow(1 - rawEntrance, 3);

      pieces.forEach((piece, index) => {
        piece.group.position.lerpVectors(piece.start, piece.target, entrance);
        if (entrance >= 0.995) piece.group.position.y += Math.sin(elapsed * 0.85 + piece.phase) * 0.035;
        piece.group.rotation.x = THREE.MathUtils.lerp(piece.group.rotation.x, piece.targetRotation.x, 0.055);
        piece.group.rotation.y = THREE.MathUtils.lerp(piece.group.rotation.y, piece.targetRotation.y, 0.055);
        piece.group.rotation.z = THREE.MathUtils.lerp(piece.group.rotation.z, piece.targetRotation.z, 0.055);
        if (index === pieces.length - 1) piece.group.rotation.y += Math.sin(elapsed * 0.7) * 0.0018;
      });

      assembly.rotation.y = THREE.MathUtils.lerp(assembly.rotation.y, -0.52 + pointer.x * 0.14, 0.035);
      assembly.rotation.x = THREE.MathUtils.lerp(assembly.rotation.x, -0.42 + pointer.y * 0.08, 0.035);
      assembly.position.y = Math.sin(elapsed * 0.55) * 0.055;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      resizeObserver.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      darkMaterial.dispose();
      accentMaterial.dispose();
      edgeMaterial.dispose();
      mutedEdgeMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (fallback) {
    return (
      <div className="relative flex h-full min-h-64 items-center justify-center" aria-hidden="true">
        {[0, 1, 2, 3].map((layer) => (
          <span
            key={layer}
            className="absolute h-24 w-44 rounded-xl border border-[var(--color-accent)]/50 bg-[var(--color-surface)]"
            style={{ transform: `translate(${layer * 12 - 18}px, ${layer * -22 + 32}px) rotate(${layer * -2}deg)` }}
          />
        ))}
        <span className="relative z-10 h-14 w-14 rounded-xl bg-[var(--color-accent)] shadow-[0_18px_70px_rgba(255,138,0,0.24)]" />
      </div>
    );
  }

  return <div ref={mountRef} className="h-full min-h-64 w-full" aria-hidden="true" />;
}
