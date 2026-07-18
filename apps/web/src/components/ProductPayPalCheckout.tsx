'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientLog } from '@/lib/client-log';

type CheckoutDuration = 'monthly' | '3_months' | 'lifetime';

type ProductPayPalCheckoutProps = {
  productId: string;
  productSlug: string;
  productName: string;
  priceLabel: string;
  planId?: string;
  duration?: CheckoutDuration;
  /** Discord server the bot will be provisioned to — required before paying. */
  guildId?: string;
  guildName?: string;
};

type BotInvite = { productType: string; name: string; url: string };

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error?: { message?: string } };

type PayPalButtonInstance = {
  render: (container: HTMLElement) => Promise<void>;
  close?: () => void;
  isEligible?: () => boolean;
};

type PayPalHostedField = {
  render: (container: HTMLElement | string) => Promise<void>;
};

type PayPalCardFieldsInstance = {
  isEligible: () => boolean;
  NameField: (options?: Record<string, unknown>) => PayPalHostedField;
  NumberField: (options?: Record<string, unknown>) => PayPalHostedField;
  ExpiryField: (options?: Record<string, unknown>) => PayPalHostedField;
  CVVField: (options?: Record<string, unknown>) => PayPalHostedField;
  submit: () => Promise<void>;
  close?: () => void;
};

type PayPalApplePayInstance = {
  isEligible: () => boolean;
  config: () => Promise<{
    countryCode?: string;
    currencyCode?: string;
    merchantCapabilities?: string[];
    supportedNetworks?: string[];
  }>;
  validateMerchant: (input: { validationUrl: string }) => Promise<{ merchantSession?: unknown } | unknown>;
  confirmOrder: (input: {
    orderId: string;
    token: unknown;
    billingContact?: unknown;
    shippingContact?: unknown;
  }) => Promise<void>;
};

type PayPalNamespace = {
  FUNDING?: {
    PAYPAL?: string;
    CARD?: string;
  };
  Buttons: (options: Record<string, unknown>) => PayPalButtonInstance;
  CardFields?: (options: Record<string, unknown>) => PayPalCardFieldsInstance;
  Applepay?: () => PayPalApplePayInstance;
};

type ApplePaySessionInstance = {
  onvalidatemerchant: ((event: { validationURL: string }) => void | Promise<void>) | null;
  onpaymentauthorized: ((event: { payment: { token: unknown; billingContact?: unknown; shippingContact?: unknown } }) => void | Promise<void>) | null;
  oncancel: (() => void) | null;
  completeMerchantValidation: (merchantSession: unknown) => void;
  completePayment: (status: number) => void;
  begin: () => void;
};

type ApplePayPaymentRequest = {
  countryCode: string;
  currencyCode: string;
  merchantCapabilities: string[];
  supportedNetworks: string[];
  total: {
    label: string;
    amount: string;
    type: 'final';
  };
};

type ApplePaySessionConstructor = {
  new (version: number, paymentRequest: ApplePayPaymentRequest): ApplePaySessionInstance;
  canMakePayments?: () => boolean;
  supportsVersion?: (version: number) => boolean;
  STATUS_SUCCESS: number;
  STATUS_FAILURE: number;
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
    ApplePaySession?: ApplePaySessionConstructor;
  }
}

let paypalSdkPromise: Promise<void> | null = null;
let paypalSdkSrc = '';

function amountFromPriceLabel(priceLabel: string) {
  const price = priceLabel.match(/(\d+(?:[.,]\d+)?)/)?.[1]?.replace(',', '.');
  const amount = Number.parseFloat(price || '');
  return Number.isFinite(amount) && amount > 0 ? amount.toFixed(2) : '0.00';
}

function currencyFromPriceLabel(priceLabel: string) {
  return priceLabel.includes('$') ? 'USD' : 'USD';
}

function labelFromDuration(duration: CheckoutDuration) {
  if (duration === 'lifetime') return 'Lifetime';
  if (duration === '3_months') return '3 months';
  return 'Monthly';
}

function loadPayPalSdk(clientId: string, currency: string) {
  const params = new URLSearchParams({
    'client-id': clientId,
    currency,
    intent: 'capture',
    components: 'buttons,card-fields,applepay,funding-eligibility',
    'enable-funding': 'card,applepay',
  });
  const src = `https://www.paypal.com/sdk/js?${params.toString()}`;

  if (paypalSdkPromise && paypalSdkSrc === src) return paypalSdkPromise;

  const existing = document.querySelector<HTMLScriptElement>('script[data-opus-paypal-sdk="true"]');
  if (existing && existing.src === src && window.paypal) {
    paypalSdkSrc = src;
    paypalSdkPromise = Promise.resolve();
    return paypalSdkPromise;
  }

  if (existing) existing.remove();
  paypalSdkSrc = src;
  paypalSdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.opusPaypalSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load PayPal Checkout.'));
    document.body.appendChild(script);
  });

  return paypalSdkPromise;
}

async function readJson<T>(response: Response): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

export function ProductPayPalCheckout({
  productId,
  productSlug,
  productName,
  priceLabel,
  planId = 'monthly',
  duration = 'monthly',
  guildId = '',
  guildName = '',
}: ProductPayPalCheckoutProps) {
  const paypalRef = useRef<HTMLDivElement>(null);
  // PayPal SDK callbacks capture their closure once at render time, so the
  // freshest guild selection has to travel through refs (same as the cart).
  const guildRef = useRef(guildId);
  const guildNameRef = useRef(guildName);
  guildRef.current = guildId;
  guildNameRef.current = guildName;
  const cardButtonRef = useRef<HTMLDivElement>(null);
  const cardNameRef = useRef<HTMLDivElement>(null);
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvvRef = useRef<HTMLDivElement>(null);
  const cardFieldsRef = useRef<PayPalCardFieldsInstance | null>(null);
  const applePayRef = useRef<PayPalApplePayInstance | null>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'capturing' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [cardAvailable, setCardAvailable] = useState(false);
  const [cardButtonAvailable, setCardButtonAvailable] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [applePayDevNote, setApplePayDevNote] = useState('');
  const [submittingCard, setSubmittingCard] = useState(false);
  const [submittingApplePay, setSubmittingApplePay] = useState(false);
  const [invites, setInvites] = useState<BotInvite[]>([]);

  const amount = useMemo(() => amountFromPriceLabel(priceLabel), [priceLabel]);
  const currency = useMemo(() => currencyFromPriceLabel(priceLabel), [priceLabel]);
  const planLabel = useMemo(() => labelFromDuration(duration), [duration]);
  const selectionPayload = useMemo(
    () => ({ productId, productSlug, planId, duration }),
    [duration, planId, productId, productSlug]
  );

  const createOrder = useCallback(async () => {
    if (!guildRef.current) {
      setStatus('error');
      setMessage('اختر السيرفر أولاً ليُفعّل البوت عليه تلقائياً.');
      throw new Error('missing guild');
    }
    setStatus('loading');
    setMessage('');
    const response = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectionPayload),
    });
    const json = await readJson<{ orderID: string }>(response);
    if (!json.success) {
      throw new Error(json.error?.message || 'Unable to create order.');
    }
    if (!response.ok) {
      throw new Error('Unable to create order.');
    }
    return json.data.orderID;
  }, [selectionPayload]);

  const captureOrder = useCallback(
    async (orderID: string) => {
      if (!orderID) throw new Error('Missing PayPal order ID.');

      setStatus('capturing');
      setMessage('جاري تأكيد الدفع عبر PayPal...');
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderID, guildId: guildRef.current, guildName: guildNameRef.current, ...selectionPayload }),
      });
      const json = await readJson<{
        orderID: string;
        captureID: string | null;
        paymentStatus: string;
        provisioning?: string;
        invites?: BotInvite[];
      }>(response);
      if (!json.success) {
        const errMsg = json.error?.message || 'Unable to capture order.';
        clientLog({
          eventType: 'capture_failed',
          title: '❌ فشل تأكيد الدفع',
          color: 0xef4444,
          fields: [
            { name: '📦 المنتج', value: productName, inline: true },
            { name: '🔖 الطلب', value: orderID.slice(0, 20), inline: true },
            { name: '⚠️ الخطأ', value: errMsg, inline: false },
          ],
          footer: 'Opus Tracker',
        });
        throw new Error(errMsg);
      }
      if (!response.ok) {
        throw new Error('Unable to capture order.');
      }
      setStatus('success');
      setInvites(json.data.invites ?? []);
      setMessage(
        json.data.provisioning === 'pending'
          ? 'تم الدفع بنجاح! بوتك قيد التجهيز وسيُفعّل خلال دقائق — ستجده في لوحة التحكم.'
          : 'تم الدفع والتفعيل بنجاح! أضف بوتك لسيرفرك من الزر بالأسفل.',
      );
    },
    [selectionPayload, productName, priceLabel]
  );

  useEffect(() => {
    let cancelled = false;
    let paypalButtons: PayPalButtonInstance | null = null;
    let cardButtons: PayPalButtonInstance | null = null;

    async function renderCheckout() {
      try {
        setStatus('loading');
        setMessage('جاري تجهيز خيارات PayPal...');
        setApplePayAvailable(false);
        setApplePayDevNote('');
        setCardAvailable(false);
        setCardButtonAvailable(false);

        const configResponse = await fetch('/api/paypal/config', { cache: 'no-store' });
        const config = await readJson<{ clientId: string; env: 'sandbox' | 'live' }>(configResponse);
        if (!config.success) {
          throw new Error(config.error?.message || 'PayPal Checkout is not configured.');
        }
        if (!configResponse.ok || !config.data.clientId) {
          throw new Error('PayPal Checkout is not configured.');
        }

        await loadPayPalSdk(config.data.clientId, currency);
        if (cancelled || !window.paypal || !paypalRef.current) return;

        paypalRef.current.innerHTML = '';
        if (cardButtonRef.current) cardButtonRef.current.innerHTML = '';
        [cardNameRef, cardNumberRef, cardExpiryRef, cardCvvRef].forEach((ref) => {
          if (ref.current) ref.current.innerHTML = '';
        });

        const baseOptions = {
          createOrder,
          onApprove: (data: { orderID?: string }) => captureOrder(data.orderID || ''),
          onCancel: () => {
            setStatus('idle');
            setMessage('تم إلغاء الدفع قبل الإكمال.');
            clientLog({
              eventType: 'payment_cancelled',
              title: '🚫 إلغاء الدفع',
              color: 0xf59e0b,
              fields: [{ name: '📦 المنتج', value: productName, inline: true }],
              footer: 'Opus Tracker',
            });
          },
          onError: () => {
            setStatus('error');
            setMessage('تعذر إكمال الدفع عبر PayPal. حاول مرة أخرى أو استخدم PayPal.Me.');
            clientLog({
              eventType: 'payment_error',
              title: '⚠️ خطأ في الدفع',
              color: 0xef4444,
              fields: [{ name: '📦 المنتج', value: productName, inline: true }],
              footer: 'Opus Tracker',
            });
          },
          style: { layout: 'vertical', shape: 'rect', label: 'pay' },
        };

        paypalButtons = window.paypal.Buttons({
          ...baseOptions,
          fundingSource: window.paypal.FUNDING?.PAYPAL,
        });
        if (paypalButtons.isEligible?.() !== false) await paypalButtons.render(paypalRef.current);

        const cardFields = window.paypal.CardFields?.({
          createOrder,
          onApprove: (data: { orderID?: string }) => captureOrder(data.orderID || ''),
          onError: () => {
            setStatus('error');
            setMessage('تعذر إكمال الدفع بالبطاقة عبر PayPal. تأكد من البيانات أو جرب PayPal.Me.');
          },
          style: {
            input: { color: '#f0f0f5', 'font-size': '14px' },
            '.invalid': { color: '#f59e0b' },
          },
        });
        const hostedCardEligible = !!cardFields?.isEligible();
        setCardAvailable(hostedCardEligible);
        if (hostedCardEligible && cardFields && cardNameRef.current && cardNumberRef.current && cardExpiryRef.current && cardCvvRef.current) {
          cardFieldsRef.current = cardFields;
          await cardFields.NameField().render(cardNameRef.current);
          await cardFields.NumberField().render(cardNumberRef.current);
          await cardFields.ExpiryField().render(cardExpiryRef.current);
          await cardFields.CVVField().render(cardCvvRef.current);
        }

        if (!hostedCardEligible && window.paypal.FUNDING?.CARD && cardButtonRef.current) {
          cardButtons = window.paypal.Buttons({ ...baseOptions, fundingSource: window.paypal.FUNDING.CARD });
          const cardButtonEligible = cardButtons.isEligible?.() !== false;
          setCardButtonAvailable(cardButtonEligible);
          if (cardButtonEligible) await cardButtons.render(cardButtonRef.current);
        }

        const nativeApplePaySupported =
          !!window.ApplePaySession &&
          window.ApplePaySession.canMakePayments?.() !== false &&
          window.ApplePaySession.supportsVersion?.(4) !== false;
        const applePay = window.paypal.Applepay?.();
        const applePayEligible = !!applePay && nativeApplePaySupported && applePay.isEligible();
        applePayRef.current = applePayEligible ? applePay : null;
        setApplePayAvailable(applePayEligible);
        if (!applePayEligible && config.data.env !== 'live') {
          setApplePayDevNote('Apple Pay يظهر فقط على Safari/أجهزة مؤهلة ودومين HTTPS مفعل لدى PayPal.');
        }

        setStatus('idle');
        setMessage('');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'PayPal Checkout is unavailable.');
      }
    }

    renderCheckout();

    return () => {
      cancelled = true;
      paypalButtons?.close?.();
      cardButtons?.close?.();
      cardFieldsRef.current?.close?.();
      cardFieldsRef.current = null;
      applePayRef.current = null;
    };
  }, [captureOrder, createOrder, currency]);

  async function submitCard() {
    if (!cardFieldsRef.current) return;
    try {
      setSubmittingCard(true);
      setMessage('');
      await cardFieldsRef.current.submit();
    } catch {
      setStatus('error');
      setMessage('تعذر إرسال بيانات البطاقة عبر PayPal. لم نستلم أي بيانات بطاقة، حاول مرة أخرى.');
    } finally {
      setSubmittingCard(false);
    }
  }

  async function startApplePay() {
    const ApplePaySession = window.ApplePaySession;
    const applePay = applePayRef.current;
    if (!ApplePaySession || !applePay) return;

    try {
      setSubmittingApplePay(true);
      setStatus('loading');
      setMessage('جاري فتح Apple Pay...');
      const appleConfig = await applePay.config();
      const paymentRequest: ApplePayPaymentRequest = {
        countryCode: appleConfig.countryCode || 'US',
        currencyCode: currency,
        merchantCapabilities: appleConfig.merchantCapabilities || ['supports3DS'],
        supportedNetworks: appleConfig.supportedNetworks || ['visa', 'masterCard', 'amex', 'discover'],
        total: {
          label: productName,
          amount,
          type: 'final',
        },
      };

      const session = new ApplePaySession(4, paymentRequest);
      session.onvalidatemerchant = async (event) => {
        try {
          const validation = await applePay.validateMerchant({ validationUrl: event.validationURL });
          const merchantSession =
            validation && typeof validation === 'object' && 'merchantSession' in validation
              ? (validation as { merchantSession: unknown }).merchantSession
              : validation;
          session.completeMerchantValidation(merchantSession);
        } catch {
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          setStatus('error');
          setMessage('تعذر التحقق من Apple Pay لهذا الدومين. استخدم PayPal أو البطاقة.');
        }
      };

      session.onpaymentauthorized = async (event) => {
        try {
          const orderID = await createOrder();
          await applePay.confirmOrder({
            orderId: orderID,
            token: event.payment.token,
            billingContact: event.payment.billingContact,
            shippingContact: event.payment.shippingContact,
          });
          await captureOrder(orderID);
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
        } catch {
          session.completePayment(ApplePaySession.STATUS_FAILURE);
          setStatus('error');
          setMessage('تعذر إكمال Apple Pay. لم يتم تأكيد الدفع.');
        }
      };

      session.oncancel = () => {
        setStatus('idle');
        setMessage('تم إلغاء Apple Pay قبل الإكمال.');
      };

      session.begin();
    } finally {
      setSubmittingApplePay(false);
    }
  }

  const loading = status === 'loading' || status === 'capturing';

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.02)] p-4">
      <div className="mb-4">
        <p className="font-arabic text-lg font-extrabold text-[var(--color-text)]">PayPal أو بطاقة بنكية</p>
        <p className="mt-1 text-sm leading-7 text-[var(--color-muted)]">
          ادفع بحسابك أو بطاقتك مباشرة
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-3 sm:items-center">
          <span className="font-arabic font-bold text-[var(--color-text)]">{productName}</span>
          <span className="font-arabic text-[var(--color-muted)]">{planLabel}</span>
          <span className="font-english font-bold text-[var(--color-accent-2)] sm:text-end">{priceLabel}</span>
        </div>
      </div>

      {!guildId ? (
        <p className="mb-4 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-4 py-2.5 font-arabic text-sm text-[#f59e0b]">
          اختر السيرفر بالأعلى لتفعيل الدفع.
        </p>
      ) : null}

      <div className={`grid gap-4 ${!guildId ? 'pointer-events-none opacity-40' : ''}`}>
        <div>
          <p className="mb-2 text-xs font-bold text-[var(--color-muted)]">PayPal Checkout</p>
          <div ref={paypalRef} />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <p className="mb-3 text-xs font-bold text-[var(--color-muted)]">Debit/Credit Card</p>
          {cardAvailable ? (
            <div className="grid gap-3">
              <div ref={cardNameRef} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2" />
              <div ref={cardNumberRef} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div ref={cardExpiryRef} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2" />
                <div ref={cardCvvRef} className="min-h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2" />
              </div>
              <button
                type="button"
                onClick={submitCard}
                disabled={loading || submittingCard}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingCard ? 'جاري المعالجة...' : 'ادفع بالبطاقة عبر PayPal'}
              </button>
              <p className="text-xs leading-6 text-[var(--color-muted)]">
                حقول البطاقة مستضافة من PayPal. الموقع لا يستلم رقم البطاقة أو CVV أو تاريخ الانتهاء.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              <div ref={cardButtonRef} />
              {!cardButtonAvailable ? (
                <p className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs leading-6 text-[var(--color-muted)]">
                  يتم تجهيز خيار البطاقة من PayPal. إذا لم يظهر، استخدم زر PayPal Checkout وسيعرض PayPal طرق الدفع المتاحة لحسابك.
                </p>
              ) : (
                <p className="text-xs leading-6 text-[var(--color-muted)]">
                  يتم إدخال بيانات البطاقة داخل واجهة PayPal الرسمية فقط، وليس داخل كود الموقع.
                </p>
              )}
            </div>
          )}
        </div>

        {applePayAvailable ? (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <p className="mb-3 text-xs font-bold text-[var(--color-muted)]">Apple Pay</p>
            <button
              type="button"
              onClick={startApplePay}
              disabled={loading || submittingApplePay}
              className="inline-flex w-full items-center justify-center rounded-xl bg-black px-5 py-3 font-english text-sm font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingApplePay ? 'Processing...' : 'Apple Pay'}
            </button>
          </div>
        ) : applePayDevNote ? (
          <p className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-xs leading-6 text-[var(--color-muted)]">
            {applePayDevNote}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-center text-xs font-semibold text-[var(--color-muted)]">Powered by PayPal</p>

      {message ? (
        <p
          className={`mt-3 rounded-xl border px-3 py-2 text-sm leading-7 ${
            status === 'success'
              ? 'border-[var(--color-accent-2)] text-[var(--color-accent-2)]'
              : status === 'error'
                ? 'border-[#f59e0b] text-[#f59e0b]'
                : 'border-[var(--color-border)] text-[var(--color-muted)]'
          }`}
        >
          {message}
        </p>
      ) : null}

      {status === 'success' && invites.length > 0 ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-[var(--color-accent-2)] bg-[var(--color-bg)] p-4">
          <p className="font-arabic text-sm font-extrabold text-[var(--color-text)]">أضف بوتك لسيرفرك الآن</p>
          <p className="font-arabic text-xs leading-6 text-[var(--color-muted)]">
            افتح الرابط، وافق على الإضافة — البوت يدخل سيرفرك ويشتغل تلقائياً. (لا حاجة لأي توكن)
          </p>
          {invites.map((inv) => (
            <a
              key={inv.productType}
              href={inv.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
            >
              إضافة {inv.name} إلى السيرفر
            </a>
          ))}
          <a href="/dashboard" className="mt-1 text-center font-arabic text-xs font-bold text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-text)]">
            أو من لوحة التحكم
          </a>
        </div>
      ) : null}
    </div>
  );
}
