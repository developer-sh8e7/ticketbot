'use client';

import { useEffect, useRef } from 'react';

type Point = { x: number; y: number; vx: number; vy: number; size: number; brightness: number };
type Star = { x: number; y: number; size: number; alpha: number; speed: number };

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
    let stars: Star[] = [];
    const pointer = { x: 0, y: 0, active: false };
    let time = 0;

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvasElement.width = width * ratio;
      canvasElement.height = height * ratio;
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      
      // Glowing network particles
      const count = Math.min(72, Math.max(32, Math.floor(width / 22)));
      points = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 2.5 + 0.8,
        brightness: Math.random() * 0.5 + 0.3,
      }));
      
      // Twinkling stars
      stars = Array.from({ length: Math.min(40, Math.floor(width / 30)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height * 0.6,
        size: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.1,
        speed: Math.random() * 0.008 + 0.003,
      }));
    }

    function draw() {
      time += 0.005;
      drawingContext.clearRect(0, 0, width, height);

      // ── Draw twinkling stars ──
      for (const star of stars) {
        star.alpha += Math.sin(time * 2 + star.x * 0.01) * star.speed;
        star.alpha = Math.max(0.05, Math.min(0.8, star.alpha));
        drawingContext.beginPath();
        drawingContext.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        drawingContext.fillStyle = `rgba(255, 220, 180, ${star.alpha})`;
        drawingContext.fill();
        // Star glow
        if (star.alpha > 0.3) {
          drawingContext.beginPath();
          drawingContext.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2);
          drawingContext.fillStyle = `rgba(255, 180, 100, ${star.alpha * 0.08})`;
          drawingContext.fill();
        }
      }

      // ── Draw glowing particle network ──
      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];
        if (!reduced) {
          point.x += point.vx;
          point.y += point.vy;
          if (point.x < -20) point.x = width + 20;
          if (point.x > width + 20) point.x = -20;
          if (point.y < -20) point.y = height + 20;
          if (point.y > height + 20) point.y = -20;
          
          // Mouse interaction - gentle push
          if (pointer.active) {
            const dx = pointer.x - point.x;
            const dy = pointer.y - point.y;
            const distance = Math.hypot(dx, dy);
            if (distance < 220 && distance > 1) {
              const force = (220 - distance) / 220;
              point.x -= (dx / distance) * 0.2 * force;
              point.y -= (dy / distance) * 0.2 * force;
            }
          }
        }

        // Draw connections with gradient glow
        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          const distance = Math.hypot(point.x - other.x, point.y - other.y);
          if (distance < 160) {
            const alpha = 0.12 * (1 - distance / 160);
            const pulse = Math.sin(time * 3 + i * 0.7 + j * 0.5) * 0.3 + 0.7;
            
            // Glow line
            drawingContext.beginPath();
            drawingContext.moveTo(point.x, point.y);
            drawingContext.lineTo(other.x, other.y);
            drawingContext.strokeStyle = `rgba(255, 138, 0, ${alpha * pulse})`;
            drawingContext.lineWidth = 0.8;
            drawingContext.stroke();
            
            // Outer glow
            if (alpha > 0.05) {
              drawingContext.beginPath();
              drawingContext.moveTo(point.x, point.y);
              drawingContext.lineTo(other.x, other.y);
              drawingContext.strokeStyle = `rgba(255, 180, 100, ${alpha * 0.3 * pulse})`;
              drawingContext.lineWidth = 2.5;
              drawingContext.stroke();
            }
          }
        }

        // Draw particle with glow
        const pulse = Math.sin(time * 2 + i) * 0.2 + 0.8;
        const size = point.size * pulse;
        
        // Outer glow
        const gradient = drawingContext.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, size * 5
        );
        gradient.addColorStop(0, `rgba(255, 184, 102, ${0.35 * point.brightness * pulse})`);
        gradient.addColorStop(0.4, `rgba(255, 138, 0, ${0.12 * point.brightness * pulse})`);
        gradient.addColorStop(1, 'rgba(255, 138, 0, 0)');
        drawingContext.beginPath();
        drawingContext.arc(point.x, point.y, size * 5, 0, Math.PI * 2);
        drawingContext.fillStyle = gradient;
        drawingContext.fill();

        // Core
        drawingContext.beginPath();
        drawingContext.arc(point.x, point.y, size, 0, Math.PI * 2);
        drawingContext.fillStyle = `rgba(255, 220, 170, ${0.9 * point.brightness * pulse})`;
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
    const onResize = () => resize();

    resize();
    draw();
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
    };
  }, []);

  return (
    <div className="project-atmosphere" aria-hidden="true">
      {/* Deep space gradient layers */}
      <div className="project-deep-space" />
      
      {/* Animated aurora blobs - now with 3 layers */}
      <div className="project-aurora aurora-orange" />
      <div className="project-aurora aurora-gold" />
      <div className="project-aurora aurora-peach" />
      
      {/* Floating glowing orbs */}
      <div className="project-orb project-orb-one" />
      <div className="project-orb project-orb-two" />
      <div className="project-orb project-orb-three" />
      <div className="project-orb project-orb-four" />
      
      {/* Rotating orbit rings */}
      <div className="project-orbit project-orbit-one" />
      <div className="project-orbit project-orbit-two" />
      <div className="project-orbit project-orbit-three" />
      
      {/* Perspective grid with glow */}
      <div className="project-perspective-grid" />
      
      {/* Animated scanning line */}
      <div className="project-scan-line" />
      
      {/* Canvas with particle network */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      
      {/* Floating code symbols */}
      <div className="project-code-symbol" style={{ top: '18%', left: '8%' }}>{'</>'}</div>
      <div className="project-code-symbol" style={{ bottom: '22%', right: '12%', animationDelay: '4s' }}>{'{ }'}</div>
      <div className="project-code-symbol" style={{ top: '45%', left: '5%', animationDelay: '2s' }}>{'/**/'}</div>
      <div className="project-code-symbol" style={{ bottom: '38%', left: '85%', animationDelay: '6s' }}>{'()'}</div>
      
      {/* Vignette overlay */}
      <div className="project-vignette" />
    </div>
  );
}
