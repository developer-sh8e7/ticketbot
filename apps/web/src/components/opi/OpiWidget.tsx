'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { OpiCharacter } from './OpiCharacter';
import styles from './opi.module.css';

const GREETING = 'هلا والله! أنا أوبي، روبوت Opus Solutions. أي سؤال عن بوتاتنا أنا حاضر.';
const NETWORK_MESSAGE = 'يبدو إن الشبكة متعبة شوي… جرّب ترسل سؤالك مرة ثانية.';
const CLIENT_TIMEOUT_MS = 25_000;
const GREETED_KEY = 'opi_greeted';

const PAGE_LINES: { match: (p: string) => boolean; text: string }[] = [
  { match: (p) => p.startsWith('/pricing'), text: 'وصلت صفحة الأسعار! لو محتار أي باقة تناسب سيرفرك، اسألني.' },
  { match: (p) => p.startsWith('/product/ticket'), text: 'بوت التذاكر — الأكثر طلباً عندنا. تبي أشرح لك مميزاته؟' },
  { match: (p) => p.startsWith('/product/humanguard'), text: 'HumanGuard AI يحمي سيرفرك بالذكاء الاصطناعي. اسألني عنه!' },
  { match: (p) => p.startsWith('/product/'), text: 'اختيار موفق! لو عندك سؤال عن هذا البوت أنا حاضر.' },
  { match: (p) => p.startsWith('/commands'), text: 'هنا تلقى كل أوامر البوتات. تدور أمر معين؟' },
];

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function OpiWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [waving, setWaving] = useState(false);
  const [bubble, setBubble] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const firstPath = useRef(true);

  const showBubble = useCallback((text: string, ms = 7000) => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  }, []);

  // Greeting + wave, once per browser session
  useEffect(() => {
    let greeted = false;
    try {
      greeted = !!sessionStorage.getItem(GREETED_KEY);
      if (!greeted) sessionStorage.setItem(GREETED_KEY, '1');
    } catch {
      // sessionStorage unavailable — greet anyway
    }
    if (greeted) return;
    setWaving(true);
    showBubble(GREETING, 8000);
    const t = setTimeout(() => setWaving(false), 3200);
    return () => clearTimeout(t);
  }, [showBubble]);

  // React to page changes (pricing / products / commands)
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (open || !pathname) return;
    const line = PAGE_LINES.find((l) => l.match(pathname));
    if (line) showBubble(line.text);
  }, [pathname, open, showBubble]);

  // Eye tracking + head tilt toward the mouse (rAF-throttled, no re-renders)
  useEffect(() => {
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (pendingRef.current) return; // thinking pose owns the gaze
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const nx = Math.max(-1, Math.min(1, dx / 240));
        const ny = Math.max(-1, Math.min(1, dy / 240));
        pupilsRef.current?.setAttribute('transform', `translate(${(nx * 2.4).toFixed(2)} ${(ny * 1.8).toFixed(2)})`);
        if (headRef.current) headRef.current.style.transform = `rotate(${(nx * 5).toFixed(2)}deg)`;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-scroll chat to latest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);

  useEffect(() => () => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
  }, []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || pending) return;
    setInput('');
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next.slice(-20));
    setPending(true);
    pendingRef.current = true;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
    let reply = NETWORK_MESSAGE;
    try {
      const res = await fetch('/api/opi/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-8), path: pathname || '/' }),
        signal: controller.signal,
      });
      const json = (await res.json()) as
        | { success: true; data: { reply: string } }
        | { success: false; error: { message: string } };
      reply = json.success ? json.data.reply : json.error.message;
    } catch {
      // network failure or client timeout → keep friendly fallback
    } finally {
      clearTimeout(timer);
      pendingRef.current = false;
      setPending(false);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }].slice(-20));
    }
  };

  return (
    <div
      ref={rootRef}
      dir="rtl"
      className={`${styles.root} font-arabic`}
      style={{ '--opi': '#ff8a00', '--opi-soft': 'rgba(255,138,0,0.14)' } as CSSProperties}
    >
      {/* ambient speech bubble */}
      <AnimatePresence>
        {bubble && !open ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full right-0 mb-3 w-60 rounded-2xl rounded-br-md border border-[var(--opi)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-7 text-[var(--color-text)] shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
          >
            {bubble}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* chat panel */}
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full right-0 mb-3 flex max-h-[420px] w-[min(320px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_18px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--opi)]">أوبي</p>
                <p className="text-[11px] text-[var(--color-muted)]">مساعد Opus Solutions</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق المحادثة"
                className="rounded-lg p-1 text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <X size={18} />
              </button>
            </div>

            <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
              {messages.length === 0 ? (
                <p className="px-1 text-xs leading-6 text-[var(--color-muted)]">
                  اسألني عن أي بوت، الأسعار، أو كيف تفعّل اشتراكك.
                </p>
              ) : null}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-7 ${
                    m.role === 'user'
                      ? 'me-auto rounded-bl-md bg-[var(--opi-soft)] text-[var(--color-text)]'
                      : 'ms-auto rounded-br-md border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)]'
                  }`}
                >
                  {m.content}
                </div>
              ))}
              {pending ? (
                <div className="ms-auto flex w-fit items-center gap-1.5 rounded-2xl rounded-br-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                  <span className={styles.dot} />
                </div>
              ) : null}
            </div>

            <form onSubmit={send} className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={500}
                placeholder="اكتب سؤالك لأوبي…"
                aria-label="رسالتك لأوبي"
                className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] outline-none transition-colors placeholder:text-[var(--color-muted)] focus:border-[var(--opi)]"
              />
              <button
                type="submit"
                disabled={pending || !input.trim()}
                aria-label="إرسال"
                className="rounded-xl bg-[var(--opi)] p-2 text-black transition-opacity disabled:opacity-40"
              >
                <Send size={16} className="-scale-x-100" />
              </button>
            </form>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* the mascot itself */}
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setBubble(null);
        }}
        aria-label={open ? 'إغلاق محادثة أوبي' : 'تكلم مع أوبي'}
        className="block cursor-pointer rounded-2xl transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--opi)]"
      >
        <OpiCharacter mode={pending ? 'thinking' : 'idle'} waving={waving} headRef={headRef} pupilsRef={pupilsRef} />
      </button>
    </div>
  );
}
