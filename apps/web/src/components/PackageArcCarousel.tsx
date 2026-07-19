'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

export type PackageArcItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  originalPrice: number;
  discount: number;
  popular: boolean;
  icon: LucideIcon;
};

export type PackageArcInteraction = {
  origin: { x: number; y: number };
  side: 'left' | 'right';
};

type PackageArcCarouselProps = {
  items: readonly PackageArcItem[];
  focusId?: string | null;
  selectedId?: string | null;
  onActivate: (item: PackageArcItem | null, interaction: PackageArcInteraction) => void;
};

const OVERLAP = 0.8;

export function PackageArcCarousel({
  items,
  focusId = null,
  selectedId = null,
  onActivate,
}: PackageArcCarouselProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const focusIdRef = useRef(focusId);
  const selectedIdRef = useRef(selectedId);
  const centerIndexRef = useRef<(index: number) => void>(() => {});
  const wakeRef = useRef<() => void>(() => {});
  const draggedRef = useRef(false);

  focusIdRef.current = focusId;
  selectedIdRef.current = selectedId;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || items.length === 0) return;

    const cards = Array.from(stage.querySelectorAll<HTMLButtonElement>('.arc-card'));
    const count = cards.length;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let cardW = 240;
    let spacing = cardW * OVERLAP;
    let total = spacing * count;
    let scroll = 0;
    let target = 0;
    let dragging = false;
    let dragDistance = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let settled = false;
    let visible = true;
    const dims = new Float32Array(count).fill(1);

    const wake = () => {
      settled = false;
    };
    wakeRef.current = wake;

    const resize = () => {
      const w = stage.clientWidth || 1;
      cardW = w < 720
        ? Math.min(Math.max(w * 0.56, 178), 230)
        : Math.min(Math.max(w * 0.17, 205), 260);
      spacing = cardW * OVERLAP;
      total = spacing * count;
      stage.style.setProperty('--card-w', `${Math.round(cardW)}px`);
      wake();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    const snap = (value: number) => Math.round(value / spacing) * spacing;

    const centerIndex = (index: number) => {
      const base = index * spacing;
      const cycles = Math.round((target - base) / total);
      target = base + cycles * total;
      wake();
    };
    centerIndexRef.current = centerIndex;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      dragging = true;
      draggedRef.current = false;
      dragDistance = 0;
      lastX = event.clientX;
      lastT = event.timeStamp;
      velocity = 0;
      stage.setPointerCapture?.(event.pointerId);
      stage.classList.add('is-dragging');
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dt = Math.max(event.timeStamp - lastT, 1);
      lastX = event.clientX;
      lastT = event.timeStamp;
      dragDistance += Math.abs(dx);
      if (dragDistance > 7) draggedRef.current = true;
      scroll -= dx;
      target = scroll;
      velocity = velocity * 0.75 + (-dx / dt) * 1000 * 0.25;
      wake();
    };

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove('is-dragging');
      if (stage.hasPointerCapture?.(event.pointerId)) {
        stage.releasePointerCapture(event.pointerId);
      }
      const fling = reducedMotion
        ? 0
        : Math.max(-2.4 * spacing, Math.min(2.4 * spacing, velocity * 0.14));
      target = snap(scroll + fling);
      wake();
    };

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      target = snap(target + event.deltaX * 1.4);
      wake();
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);
    stage.addEventListener('wheel', onWheel, { passive: true });

    const intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) wake();
    }, { rootMargin: '160px' });
    intersectionObserver.observe(stage);

    let raf = 0;
    let previousTime = performance.now();

    const render = (time: number) => {
      raf = requestAnimationFrame(render);
      const dt = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      if (!visible || document.hidden || settled) return;

      if (Math.abs(scroll) > total * 4) {
        const cycles = Math.trunc(scroll / total);
        scroll -= cycles * total;
        target -= cycles * total;
      }

      if (!dragging) {
        scroll += (target - scroll) * (1 - Math.exp(-(reducedMotion ? 16 : 6.5) * dt));
        if (Math.abs(target - scroll) < 0.08) scroll = target;
      }
      let done = !dragging && scroll === target;

      for (let index = 0; index < count; index += 1) {
        const card = cards[index];
        let x = index * spacing - scroll;
        x = ((x + total / 2) % total + total) % total - total / 2;
        const u = x / spacing;
        const au = Math.min(Math.abs(u), 2.6);

        const y = 0.115 * cardW * au * au;
        const z = -au * 70;
        const rz = u * 5.5;
        const ry = Math.max(-22, Math.min(22, u * 9));
        const scale = Math.max(1 - au * 0.13, 0.6);
        const arcOpacity = Math.max(1 - au * 0.1 - au * au * 0.075, 0.26);

        const item = items[index];
        const dimTarget =
          (focusIdRef.current && focusIdRef.current !== item.id ? 0.38 : 1) *
          (selectedIdRef.current && selectedIdRef.current !== item.id ? 0.55 : 1);
        dims[index] += (dimTarget - dims[index]) * (1 - Math.exp(-8 * dt));
        if (Math.abs(dimTarget - dims[index]) > 0.004) done = false;
        else dims[index] = dimTarget;

        const proximity = Math.max(0, Math.min(1, 1 - au / 0.85));
        const p = proximity * proximity * (3 - 2 * proximity);

        card.style.transform =
          `translate(-50%, -50%) translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) ` +
          `rotateZ(${rz.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
        card.style.opacity = (arcOpacity * dims[index]).toFixed(3);
        card.style.zIndex = String(60 - Math.round(au * 20));
        card.style.setProperty('--p', p.toFixed(3));
      }

      if (done) settled = true;
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', endDrag);
      stage.removeEventListener('pointercancel', endDrag);
      stage.removeEventListener('wheel', onWheel);
    };
  }, [items]);

  useEffect(() => {
    if (!focusId) return;
    const index = items.findIndex((item) => item.id === focusId);
    if (index >= 0) centerIndexRef.current(index);
  }, [focusId, items]);

  // Selection / filter changes need a repaint even when the arc is at rest.
  useEffect(() => {
    wakeRef.current();
  }, [focusId, selectedId]);

  const handleCardClick = (item: PackageArcItem, index: number, event: React.MouseEvent<HTMLButtonElement>) => {
    if (draggedRef.current) return;
    centerIndexRef.current(index);
    const rect = event.currentTarget.getBoundingClientRect();
    const interaction: PackageArcInteraction = {
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.25 },
      side: 'left',
    };
    onActivate(selectedId === item.id ? null : item, interaction);
  };

  return (
    <div ref={stageRef} dir="rtl" className="arc-stage" role="group" aria-label="عرض الباقات">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            style={{ '--i': index } as CSSProperties}
            className={`arc-card${selectedId === item.id ? ' is-selected' : ''}`}
            onClick={(event) => handleCardClick(item, index, event)}
            onFocus={() => centerIndexRef.current(index)}
            aria-label={`${item.name} — ${item.price.toLocaleString('ar-SA')} ريال`}
          >
            <span className="arc-card-inner">
              <span className="arc-card-gradient" aria-hidden="true" />
              <span className="arc-card-sheen" aria-hidden="true" />
              <span className="arc-card-body font-arabic">
                <span className="arc-card-top">
                  <span className="arc-card-category">{item.category}</span>
                  <span className="arc-card-chip">
                    <Icon size={17} />
                  </span>
                </span>
                <strong className="arc-card-name">{item.name}</strong>
                <span className="arc-card-desc">{item.description}</span>
                <span className="arc-card-divider" aria-hidden="true" />
                <span className="arc-card-price-label">السعر</span>
                <span className="arc-card-price-row">
                  <span className="arc-card-price">{item.price.toLocaleString('ar-SA')}</span>
                  <span className="arc-card-currency">ر.س</span>
                </span>
                {item.originalPrice > item.price ? (
                  <span className="arc-card-old-row">
                    <s className="arc-card-old">{item.originalPrice.toLocaleString('ar-SA')} ر.س</s>
                    {item.discount > 0 ? <span className="arc-card-save">وفر {item.discount}%</span> : null}
                  </span>
                ) : null}
                <span className="arc-card-foot font-english">
                  {item.popular ? 'OPUS / الاكثر طلبا' : 'OPUS / PACKAGE'}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
