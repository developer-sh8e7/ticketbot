'use client';

import * as THREE from 'three';
import { useEffect, useRef, useState } from 'react';

type Step = 0 | 1 | 2;
type Target = { position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number] };

const layouts: Record<Step, { rotation: [number, number, number]; pieces: Target[] }> = {
  0: {
    rotation: [-0.08, -0.38, 0.02],
    pieces: [
      { position: [0, 0, 0], scale: [3.35, 2.08, 0.14] },
      { position: [-1.02, 0.3, 0.14], scale: [0.72, 0.72, 0.2] },
      { position: [0.48, 0.52, 0.14], scale: [1.55, 0.16, 0.2] },
      { position: [0.3, 0.08, 0.14], scale: [1.9, 0.12, 0.18] },
      { position: [-0.42, -0.58, 0.14], scale: [1.12, 0.34, 0.18] },
      { position: [0.86, -0.58, 0.14], scale: [1.12, 0.34, 0.18] },
      { position: [0, 0.94, 0.1], scale: [3.35, 0.16, 0.18] },
    ],
  },
  1: {
    rotation: [-0.54, -0.28, 0.04],
    pieces: [
      { position: [0, -0.28, 0], scale: [3.45, 0.14, 2.25] },
      { position: [-0.65, -0.13, 0.65], scale: [1.55, 0.12, 0.22] },
      { position: [-0.4, -0.12, 0.15], scale: [2.0, 0.1, 0.15] },
      { position: [-0.4, -0.12, -0.28], scale: [2.0, 0.1, 0.15] },
      { position: [1.08, -0.1, 0.15], scale: [0.28, 0.16, 0.28] },
      { position: [1.08, -0.1, -0.28], scale: [0.28, 0.16, 0.28] },
      { position: [1.18, 0.05, 0.78], scale: [0.48, 0.48, 0.48], rotation: [0.2, 0.3, 0.08] },
    ],
  },
  2: {
    rotation: [-0.36, -0.5, 0.08],
    pieces: [
      { position: [0, -1.12, 0], scale: [3.2, 0.18, 2.0] },
      { position: [-0.88, -0.62, 0.1], scale: [0.82, 0.82, 0.82] },
      { position: [0, -0.55, 0.18], scale: [0.82, 1.0, 0.82] },
      { position: [0.88, -0.45, 0.26], scale: [0.82, 1.2, 0.82] },
      { position: [-0.44, 0.28, 0.34], scale: [0.72, 0.72, 0.72] },
      { position: [0.52, 0.5, 0.44], scale: [0.78, 0.9, 0.78] },
      { position: [0.08, 1.36, 0.55], scale: [0.62, 0.62, 0.62], rotation: [0.22, 0.35, 0.08] },
    ],
  },
};

export function ProjectFormScene3D({ step }: { step: Step }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<Step>(step);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'h-full w-full';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.12, 7.2);
    const group = new THREE.Group();
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 1.45));
    const key = new THREE.DirectionalLight(0xb9f6e8, 5.6);
    key.position.set(4, 5, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x66cddd, 2.1);
    rim.position.set(-4, 0, -2);
    scene.add(rim);

    const dark = new THREE.MeshPhysicalMaterial({ color: 0x171719, metalness: 0.58, roughness: 0.34, clearcoat: 0.5 });
    const mint = new THREE.MeshPhysicalMaterial({ color: 0x0fc98f, emissive: 0x035b52, emissiveIntensity: 0.32, metalness: 0.44, roughness: 0.3, clearcoat: 0.72 });
    const edge = new THREE.LineBasicMaterial({ color: 0x686872, transparent: true, opacity: 0.62 });
    const accentEdge = new THREE.LineBasicMaterial({ color: 0x70e7c5, transparent: true, opacity: 0.62 });
    const geometries: THREE.BufferGeometry[] = [];

    const pieces = Array.from({ length: 7 }, (_, index) => {
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const edgeGeometry = new THREE.EdgesGeometry(geometry);
      geometries.push(geometry, edgeGeometry);
      const node = new THREE.Group();
      node.add(
        new THREE.Mesh(geometry, [1, 4, 6].includes(index) ? mint : dark),
        new THREE.LineSegments(edgeGeometry, [1, 4, 6].includes(index) ? accentEdge : edge)
      );
      node.position.set((index - 3) * 0.9, 3 + index * 0.28, -1.8);
      node.scale.setScalar(0.2);
      node.rotation.set(0.7, index % 2 ? -0.8 : 0.8, 0.3);
      group.add(node);
      return node;
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
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    const clock = new THREE.Clock();
    let frame = 0;
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const layout = layouts[stepRef.current];
      pieces.forEach((piece, index) => {
        const target = layout.pieces[index];
        piece.position.x = THREE.MathUtils.lerp(piece.position.x, target.position[0], 0.065);
        piece.position.y = THREE.MathUtils.lerp(piece.position.y, target.position[1], 0.065);
        piece.position.z = THREE.MathUtils.lerp(piece.position.z, target.position[2], 0.065);
        piece.scale.x = THREE.MathUtils.lerp(piece.scale.x, target.scale[0], 0.065);
        piece.scale.y = THREE.MathUtils.lerp(piece.scale.y, target.scale[1], 0.065);
        piece.scale.z = THREE.MathUtils.lerp(piece.scale.z, target.scale[2], 0.065);
        const rotation = target.rotation ?? [0, 0, 0];
        piece.rotation.x = THREE.MathUtils.lerp(piece.rotation.x, rotation[0], 0.06);
        piece.rotation.y = THREE.MathUtils.lerp(piece.rotation.y, rotation[1], 0.06);
        piece.rotation.z = THREE.MathUtils.lerp(piece.rotation.z, rotation[2], 0.06);
      });
      group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, layout.rotation[0] + pointer.y * 0.045, 0.04);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, layout.rotation[1] + pointer.x * 0.08, 0.04);
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, layout.rotation[2], 0.04);
      group.position.y = Math.sin(elapsed * 0.6) * 0.045;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      observer.disconnect();
      geometries.forEach((geometry) => geometry.dispose());
      dark.dispose();
      mint.dispose();
      edge.dispose();
      accentEdge.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  if (fallback) {
    return (
      <div className="flex h-full items-center justify-center" aria-hidden="true">
        <div className="relative h-40 w-56 rounded-2xl border border-white/20 bg-black/20">
          <span className="absolute inset-x-5 top-6 h-3 rounded-full bg-[var(--color-accent)]/60" />
          {[0, 1, 2].map((row) => <span key={row} className="absolute right-5 h-2 rounded-full bg-white/10 transition-all" style={{ top: 58 + row * 26, width: `${58 - row * 8}%` }} />)}
          <span className="absolute bottom-5 left-5 h-8 w-8 rounded-lg border border-[var(--color-accent)]/50" />
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
