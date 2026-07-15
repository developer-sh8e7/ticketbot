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

type SceneVariant = 'welcome' | 'home' | 'project' | 'bots';

const welcomePieces = [
  { size: [3.4, 0.16, 2.25], position: [0, -1.25, 0], rotation: [0, 0, 0], accent: false },
  { size: [2.9, 0.16, 1.9], position: [0.18, -0.78, 0.08], rotation: [0, -0.08, 0], accent: false },
  { size: [2.35, 0.16, 1.55], position: [-0.12, -0.31, 0.18], rotation: [0, 0.1, 0], accent: true },
  { size: [1.8, 0.16, 1.15], position: [0.22, 0.16, 0.26], rotation: [0, -0.12, 0], accent: false },
  { size: [1.25, 0.16, 0.78], position: [-0.08, 0.63, 0.34], rotation: [0, 0.12, 0], accent: false },
  { size: [0.62, 0.62, 0.62], position: [0.34, 1.23, 0.4], rotation: [0.18, 0.35, 0.08], accent: true },
] as const;

const homePieces = [
  { size: [3.35, 2.15, 0.14], position: [0, 0, 0], rotation: [0, 0, 0], accent: false },
  { size: [3.35, 0.18, 0.2], position: [0, 0.98, 0.1], rotation: [0, 0, 0], accent: false },
  { size: [0.4, 1.48, 0.2], position: [-1.28, -0.08, 0.12], rotation: [0, 0, 0], accent: true },
  { size: [1.65, 0.3, 0.2], position: [0.32, 0.34, 0.13], rotation: [0, 0, 0], accent: true },
  { size: [0.72, 0.58, 0.2], position: [-0.05, -0.48, 0.13], rotation: [0, 0, 0], accent: false },
  { size: [0.72, 0.58, 0.2], position: [0.9, -0.48, 0.13], rotation: [0, 0, 0], accent: false },
] as const;

const projectPieces = [
  { size: [3.4, 2.2, 0.14], position: [0, 0, 0], rotation: [0, 0, 0], accent: false },
  { size: [1.86, 0.16, 0.2], position: [-0.25, 0.58, 0.13], rotation: [0, 0, 0], accent: true },
  { size: [1.72, 0.12, 0.18], position: [-0.18, 0.04, 0.13], rotation: [0, 0, 0], accent: false },
  { size: [1.72, 0.12, 0.18], position: [-0.18, -0.5, 0.13], rotation: [0, 0, 0], accent: false },
  { size: [0.25, 0.25, 0.2], position: [1.12, 0.04, 0.14], rotation: [0, 0, 0], accent: true },
  { size: [0.25, 0.25, 0.2], position: [1.12, -0.5, 0.14], rotation: [0, 0, 0], accent: false },
] as const;

const botPieces = [
  { size: [0.78, 0.78, 0.78], position: [-1.02, -0.92, 0], rotation: [0.06, 0.12, 0], accent: false },
  { size: [0.78, 0.78, 0.78], position: [0, -0.92, 0.12], rotation: [-0.04, -0.1, 0], accent: true },
  { size: [0.78, 0.78, 0.78], position: [1.02, -0.92, 0.24], rotation: [0.04, 0.1, 0], accent: false },
  { size: [0.78, 0.78, 0.78], position: [-0.52, 0.08, 0.18], rotation: [-0.04, 0.08, 0], accent: true },
  { size: [0.78, 0.78, 0.78], position: [0.52, 0.08, 0.3], rotation: [0.06, -0.12, 0], accent: false },
  { size: [0.88, 0.88, 0.88], position: [0, 1.12, 0.42], rotation: [0.14, 0.28, 0.08], accent: true },
] as const;

const scenePieces = {
  welcome: welcomePieces,
  home: homePieces,
  project: projectPieces,
  bots: botPieces,
} as const;

const sceneRotations: Record<SceneVariant, [number, number, number]> = {
  welcome: [-0.42, -0.52, 0.1],
  home: [-0.08, -0.42, 0.02],
  project: [-0.1, -0.36, 0.03],
  bots: [-0.16, -0.48, 0.04],
};

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
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7.2);

    const baseRotation = sceneRotations[variant];
    const assembly = new THREE.Group();
    assembly.rotation.set(...baseRotation);
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

    const pieces: Piece[] = scenePieces[variant].map((config, index) => {
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

    let connectionGeometry: THREE.BufferGeometry | null = null;
    let connectionMaterial: THREE.LineBasicMaterial | null = null;
    if (variant === 'bots') {
      const links = [[0, 3], [1, 3], [1, 4], [2, 4], [3, 5], [4, 5]];
      const points = links.flatMap(([from, to]) => [pieces[from].target, pieces[to].target]);
      connectionGeometry = new THREE.BufferGeometry().setFromPoints(points);
      connectionMaterial = new THREE.LineBasicMaterial({ color: 0xff8a00, transparent: true, opacity: 0 });
      assembly.add(new THREE.LineSegments(connectionGeometry, connectionMaterial));
    }

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
      if (connectionMaterial) connectionMaterial.opacity = Math.max(0, entrance - 0.58) * 0.52;

      assembly.rotation.y = THREE.MathUtils.lerp(assembly.rotation.y, baseRotation[1] + pointer.x * 0.14, 0.035);
      assembly.rotation.x = THREE.MathUtils.lerp(assembly.rotation.x, baseRotation[0] + pointer.y * 0.08, 0.035);
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
      connectionGeometry?.dispose();
      connectionMaterial?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  if (fallback) {
    const staticArt = variant === 'home' ? (
      <div className="relative h-44 w-64 rotate-[-3deg] rounded-xl border border-white/25 bg-[var(--color-surface)]">
        <span className="absolute inset-x-0 top-0 h-5 rounded-t-xl border-b border-white/15" />
        <span className="absolute bottom-4 right-4 top-9 w-8 rounded-md bg-[var(--color-accent)]/70" />
        <span className="absolute left-5 right-16 top-10 h-7 rounded-md border border-[var(--color-accent)]/55" />
        <span className="absolute bottom-5 left-5 h-14 w-16 rounded-md border border-white/15" />
        <span className="absolute bottom-5 left-24 h-14 w-16 rounded-md border border-white/15" />
      </div>
    ) : variant === 'project' ? (
      <div className="relative h-44 w-64 rotate-2 rounded-xl border border-white/25 bg-[var(--color-surface)]">
        <span className="absolute right-6 top-8 h-3 w-36 rounded-full bg-[var(--color-accent)]/70" />
        <span className="absolute right-6 top-[76px] h-2 w-32 rounded-full bg-white/10" />
        <span className="absolute left-6 top-[70px] h-5 w-5 rounded border border-[var(--color-accent)]/60" />
        <span className="absolute right-6 top-[116px] h-2 w-32 rounded-full bg-white/10" />
        <span className="absolute left-6 top-[108px] h-5 w-5 rounded border border-white/20" />
      </div>
    ) : variant === 'bots' ? (
      <div className="grid grid-cols-3 gap-3 rotate-[-4deg]">
        {[0, 1, 2, 3, 4, 5].map((cube) => <span key={cube} className={`h-16 w-16 rounded-lg border ${cube % 2 ? 'border-[var(--color-accent)]/55 bg-[var(--color-accent)]/12' : 'border-white/20 bg-[var(--color-surface)]'}`} />)}
      </div>
    ) : (
      <div className="relative h-full min-h-64 w-full">
        {[0, 1, 2, 3].map((layer) => (
          <span key={layer} className="absolute left-1/2 top-1/2 h-24 w-44 rounded-xl border border-[var(--color-accent)]/50 bg-[var(--color-surface)]" style={{ transform: `translate(calc(-50% + ${layer * 12 - 18}px), calc(-50% + ${layer * -22 + 32}px)) rotate(${layer * -2}deg)` }} />
        ))}
        <span className="absolute left-1/2 top-1/2 z-10 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-[var(--color-accent)] shadow-[0_18px_70px_rgba(255,138,0,0.24)]" />
      </div>
    );

    return (
      <div className="relative flex h-full min-h-64 items-center justify-center" aria-hidden="true">
        {staticArt}
      </div>
    );
  }

  return <div ref={mountRef} className="h-full min-h-64 w-full" aria-hidden="true" />;
}
