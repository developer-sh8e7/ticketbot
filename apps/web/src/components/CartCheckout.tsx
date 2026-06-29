'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart, type CartDuration, type CartItem } from '@/components/cart/CartProvider';
import { ServerSelect } from '@/components/ServerSelect';

type SessionUser = { discord_user_id: string; username: string | null };
type ApiResponse<T> = { success: true; data: T } | { success: false; error?: { message?: string } };

type PayPalButtons = { render: (el: HTMLElement) => Promise<void>; close?: () => void; isEligible?: () => boolean };
type PayPalNamespace = { Buttons: (o: Record<string, unknown>) => PayPalButtons; FUNDING?: { PAYPAL?: string; CARD?: string } };

function getPayPal(): PayPalNamespace | undefined {
  return (window as unknown as { paypal?: PayPalNamespace }).paypal;
}

const durationLabel: Record<CartDuration, string> = { monthly: 'شهري', '3_months': '3 شهور' };
const PAYPAL_ME = 'https://paypal.me/AAlamri381';

let sdkPromise: Promise<void> | null = null;
function loadPayPalSdk(clientId: string) {
  if (sdkPromise) return sdkPromise;
  const params = new URLSearchParams({ 'client-id': clientId, currency: 'USD', intent: 'capture', 'enable-funding': 'card' });
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('تعذر تحميل PayPal.'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

function itemPayload(item: CartItem) {
  return { productId: item.id, productSlug: item.key, planId: item.duration, duration: item.duration };
}

export function CartCheckout() {
  const { items, removeItem, setDuration, total, totalLabel, clear } = useCart();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [guildId, setGuildId] = useState('');
  const [guildName, setGuildName] = useState('');
  const [method, setMethod] = useState<'paypal' | 'manual'>('paypal');

  useEffect(() => {
    fetch('/api/dashboard/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: ApiResponse<SessionUser> | null) => {
        if (j && j.success) setUser(j.data);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const noteText = useMemo(() => `Opus Solutions - ${items.length} منتج - ${totalLabel}`, [items.length, totalLabel]);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-opus-border bg-opus-surface p-10 text-center">
        <ShoppingCart size={48} className="mx-auto text-opus-muted/50" />
        <p className="mt-4 font-arabic text-lg font-bold text-opus-text">سلتك فارغة</p>
        <p className="mt-2 text-sm text-opus-muted">أضف منتجاً للبدء بعملية الشراء.</p>
        <Link
          href="/pricing"
          className="mt-5 inline-flex rounded-xl bg-opus-accent px-5 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
        >
          تصفّح المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {/* Cart items */}
      <section className="rounded-2xl border border-opus-border bg-opus-surface p-5">
        <h2 className="mb-4 font-arabic text-lg font-extrabold text-opus-text">سلتك ({items.length})</h2>
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.key} className="rounded-xl border border-opus-border bg-opus-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-arabic font-bold text-opus-text">{item.name}</p>
                  <p className="mt-1 font-english text-sm font-bold text-opus-accent-2">
                    ${item.amount.toFixed(2)} <span className="text-opus-muted">/ {durationLabel[item.duration]}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.key)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-opus-border text-opus-muted transition hover:border-red-500/60 hover:text-red-400"
                  aria-label="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['monthly', '3_months'] as CartDuration[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(item.key, d)}
                    className={`rounded-lg border px-3 py-1.5 font-arabic text-xs font-bold transition ${
                      item.duration === d
                        ? 'border-opus-accent bg-opus-accent/10 text-opus-text'
                        : 'border-opus-border text-opus-muted hover:border-opus-accent/60'
                    }`}
                  >
                    {durationLabel[d]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between border-t border-opus-border pt-4">
          <span className="font-arabic text-sm text-opus-muted">الإجمالي</span>
          <span className="font-english text-2xl font-extrabold text-opus-text">{totalLabel}</span>
        </div>
      </section>

      {/* Auth gate */}
      {!authChecked ? (
        <div className="flex items-center justify-center rounded-2xl border border-opus-border bg-opus-surface p-8 text-opus-muted">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : !user ? (
        <section className="rounded-2xl border border-opus-border bg-opus-surface p-6 text-center">
          <p className="font-arabic text-base font-bold text-opus-text">سجّل دخولك أولاً</p>
          <p className="mt-2 text-sm leading-7 text-opus-muted">
            اربط حساب Discord الخاص بك لإتمام الشراء وتفعيل البوت على سيرفرك.
          </p>
          <a
            href="/api/auth/discord"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-6 py-3 font-arabic text-sm font-extrabold text-white transition hover:opacity-90"
          >
            تسجيل الدخول عبر Discord
          </a>
        </section>
      ) : (
        <>
          {/* Server selector — pulled live from the user's Discord (admin guilds only) */}
          <section className="rounded-2xl border border-opus-border bg-opus-surface p-5">
            <div className="mb-3">
              <h3 className="font-arabic text-sm font-bold text-opus-text">اختر السيرفر</h3>
              <p className="mt-1 text-xs leading-6 text-opus-muted">
                نعرض فقط السيرفرات التي تملك فيها صلاحية <span className="font-bold text-opus-text">Administrator</span> لضمان تفعيل البوت بنجاح.
              </p>
            </div>
            <ServerSelect
              value={guildId}
              onSelect={(id, name) => {
                setGuildId(id);
                setGuildName(name);
              }}
            />
          </section>

          {/* Payment method tabs */}
          <section className="rounded-2xl border border-opus-border bg-opus-surface p-5">
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('paypal')}
                className={`rounded-xl border px-4 py-2.5 font-arabic text-sm font-bold transition ${
                  method === 'paypal' ? 'border-opus-accent bg-opus-accent/10 text-opus-text' : 'border-opus-border text-opus-muted'
                }`}
              >
                PayPal / بطاقة
              </button>
              <button
                type="button"
                onClick={() => setMethod('manual')}
                className={`rounded-xl border px-4 py-2.5 font-arabic text-sm font-bold transition ${
                  method === 'manual' ? 'border-opus-accent bg-opus-accent/10 text-opus-text' : 'border-opus-border text-opus-muted'
                }`}
              >
                تحويل يدوي
              </button>
            </div>

            {method === 'paypal' ? (
              <PayPalCart items={items} guildId={guildId} guildName={guildName} onSuccess={clear} />
            ) : (
              <ManualTransfer total={total} noteText={noteText} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function PayPalCart({ items, guildId, guildName, onSuccess }: { items: CartItem[]; guildId: string; guildName: string; onSuccess: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const guildRef = useRef(guildId);
  const guildNameRef = useRef(guildName);
  const itemsRef = useRef(items);
  const [status, setStatus] = useState<'loading' | 'ready' | 'capturing' | 'success' | 'error' | 'unconfigured'>('loading');
  const [message, setMessage] = useState('');

  guildRef.current = guildId;
  guildNameRef.current = guildName;
  itemsRef.current = items;

  const createOrder = useCallback(async () => {
    if (!guildRef.current) {
      setStatus('error');
      setMessage('اختر السيرفر أولاً.');
      throw new Error('missing guild');
    }
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemsRef.current.map(itemPayload) }),
    });
    const json = (await res.json()) as ApiResponse<{ orderID: string }>;
    if (!json.success) throw new Error(json.error?.message || 'تعذر إنشاء الطلب.');
    return json.data.orderID;
  }, []);

  const captureOrder = useCallback(
    async (orderID: string) => {
      setStatus('capturing');
      setMessage('جاري تأكيد الدفع...');
      const res = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID, guildId: guildRef.current, guildName: guildNameRef.current, items: itemsRef.current.map(itemPayload) }),
      });
      const json = (await res.json()) as ApiResponse<unknown>;
      if (!json.success) throw new Error(json.error?.message || 'تعذر تأكيد الدفع.');
      setStatus('success');
      setMessage('تم الدفع والتفعيل بنجاح! تفقّد لوحة التحكم.');
      onSuccess();
    },
    [onSuccess],
  );

  useEffect(() => {
    let cancelled = false;
    let buttons: PayPalButtons | null = null;

    (async () => {
      try {
        setStatus('loading');
        const cfgRes = await fetch('/api/paypal/config', { cache: 'no-store' });
        const cfg = (await cfgRes.json()) as ApiResponse<{ clientId: string }>;
        if (!cfg.success || !cfg.data.clientId) {
          setStatus('unconfigured');
          return;
        }
        await loadPayPalSdk(cfg.data.clientId);
        const paypal = getPayPal();
        if (cancelled || !paypal || !containerRef.current) return;
        containerRef.current.innerHTML = '';
        buttons = paypal.Buttons({
          style: { layout: 'vertical', shape: 'rect', label: 'pay' },
          createOrder,
          onApprove: (data: { orderID?: string }) => captureOrder(data.orderID || ''),
          onCancel: () => {
            setStatus('ready');
            setMessage('تم إلغاء الدفع.');
          },
          onError: () => {
            setStatus('error');
            setMessage('تعذر إكمال الدفع عبر PayPal. جرّب التحويل اليدوي.');
          },
        });
        if (buttons.isEligible?.() !== false) await buttons.render(containerRef.current);
        if (!cancelled) setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('تعذر تحميل PayPal. جرّب التحويل اليدوي.');
        }
      }
    })();

    return () => {
      cancelled = true;
      buttons?.close?.();
    };
  }, [createOrder, captureOrder]);

  if (status === 'unconfigured') {
    return (
      <p className="rounded-xl border border-opus-border bg-opus-bg p-4 text-sm leading-7 text-opus-muted">
        الدفع التلقائي عبر PayPal غير مهيأ حالياً. استخدم خيار <strong className="text-opus-text">التحويل اليدوي</strong>.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {!guildId ? (
        <p className="rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-4 py-2.5 text-sm text-[#f59e0b]">
          اختر السيرفر بالأعلى لتفعيل الدفع.
        </p>
      ) : null}
      <div ref={containerRef} className={!guildId ? 'pointer-events-none opacity-40' : ''} />
      {status === 'loading' || status === 'capturing' ? (
        <div className="flex items-center justify-center gap-2 text-sm text-opus-muted">
          <Loader2 className="animate-spin" size={16} /> {message || 'جاري التحميل...'}
        </div>
      ) : null}
      {message && status !== 'loading' && status !== 'capturing' ? (
        <p
          className={`rounded-xl border px-4 py-2.5 text-sm leading-7 ${
            status === 'success' ? 'border-opus-accent-2 text-opus-accent-2' : status === 'error' ? 'border-[#f59e0b] text-[#f59e0b]' : 'border-opus-border text-opus-muted'
          }`}
        >
          {message}
        </p>
      ) : null}
      <p className="text-center text-xs font-semibold text-opus-muted">Powered by PayPal</p>
    </div>
  );
}

function ManualTransfer({ total, noteText }: { total: number; noteText: string }) {
  const steps = [
    'حوّل المبلغ عبر الرابط أدناه',
    `اكتب في ملاحظة الدفع: "${noteText}"`,
    'احفظ رقم العملية (Transaction ID)',
    'افتح تكت في سيرفرنا وأرسل رقم العملية لتفعيل بوتاتك',
  ];
  return (
    <div className="grid gap-4">
      <a
        href={`${PAYPAL_ME}/${total.toFixed(2)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0070ba] px-5 py-3 font-arabic text-sm font-extrabold text-[#0070ba] transition hover:bg-white"
      >
        <Send size={17} />
        <span>ادفع {total.toFixed(2)}$ عبر PayPal.me</span>
      </a>
      <div className="rounded-xl border border-opus-border bg-opus-bg p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#60a5fa]" />
          <p className="font-arabic text-sm font-extrabold text-opus-text">بعد الدفع</p>
        </div>
        <ol className="mt-3 grid gap-2 text-sm leading-7 text-opus-muted">
          {steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#60a5fa] font-english text-[11px] font-bold text-white">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
