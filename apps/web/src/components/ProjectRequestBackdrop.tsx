'use client';

import { useEffect, useRef } from 'react';

type Point = { x: number; y: number; vx: number; vy: number; size: number };

export function ProjectRequestBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasNode = canvasRef.current;
    if (!canvasNode) return;
    const contextNode = canvasNode.getContext('2d');
    if (!contextNode) return;
    const canvasElement: HTMLCanvasElement = canvasNode;
    const drawingContext: CanvasRenderingContext2D = contextNode;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let points: Point[] = [];
    const pointer = { x: 0, y: 0, active: false };

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvasElement.width = width * ratio;
      canvasElement.height = height * ratio;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(52, Math.max(24, Math.floor(width / 30)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        size: Math.random() * 1.5 + 0.6,
      }));
    }

    function draw() {
      drawingContext.clearRect(0, 0, width, height);
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        if (!reduced) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < -20) point.x = width + 20;
          if (point.x > width + 20) point.x = -20;
          if (point.y < -20) point.y = height + 20;
          if (point.y > height + 20) point.y = -20;
          if (pointer.active) {
            const dx = pointer.x - point.x;
            const dy = pointer.y - point.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 170 && distance > 1) {
              point.x -= (dx / distance) * 0.12;
              point.y -= (dy / distance) * 0.12;
            }
          }
        }

        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 135) {
            drawingContext.beginPath();
            drawingContext.moveTo(point.x, point.y);
            drawingContext.lineTo(other.x, other.y);
            drawingContext.strokeStyle = `rgba(255, 138, 0, ${0.075 * (1 - distance / 135)})`;
            drawingContext.lineWidth = 0.7;
            drawingContext.stroke();
          }
        }

        drawingContext.beginPath();
        drawingContext.arc(point.x, point.y, point.size, 0, Math.PI * 2);
        drawingContext.fillStyle = 'rgba(255, 184, 102, 0.28)';
        drawingContext.fill();
      }
      if (!reduced) frame = requestAnimationFrame(draw);
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => { pointer.active = false; };

    resize();
    draw();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <div className="project-atmosphere" aria-hidden="true">
      <div className="project-aurora project-aurora-one" />
      <div className="project-aurora project-aurora-two" />
      <div className="project-orbit project-orbit-one" />
      <div className="project-orbit project-orbit-two" />
      <div className="project-perspective-grid" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="project-vignette" />
    </div>
  );
}
