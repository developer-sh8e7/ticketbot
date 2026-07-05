import { products, type Product } from '@/lib/site-content';

export type CatalogProductType = 'ticket' | 'voice_rooms' | 'general' | 'broadcast' | 'humanguard' | 'custom';
export type CheckoutDuration = 'monthly' | '3_months';

export type CatalogPlan = {
  id: string;
  dbPlanId: string | null;
  duration: CheckoutDuration;
  label: string;
  amount: string;
  amountCents: number;
  currency: 'USD';
  durationDays: number;
};

export type CatalogSelection = {
  product: Product;
  productType: CatalogProductType;
  plan: CatalogPlan;
};

export function dbPlanIdFor(productType: string, duration: CheckoutDuration): string | null {
  if (productType === 'custom') return null;
  const suffix = duration === 'monthly' ? 'monthly' : 'quarterly';
  if (productType === 'ticket') return `ticket-${suffix}`;
  if (productType === 'voice_rooms') return `voice-rooms-${suffix}`;
  if (productType === 'general') return `general-${suffix}`;
  if (productType === 'broadcast') return `broadcast-${suffix}`;
  if (productType === 'humanguard') return `humanguard-${suffix}`;
  return null;
}

function moneyToPlan(input: { product: Product; duration: CheckoutDuration; price: number; label: string; days: number }): CatalogPlan | null {
  if (!Number.isFinite(input.price) || input.price <= 0) return null;
  const amountCents = Math.round(input.price * 100);
  return {
    id: input.duration,
    dbPlanId: dbPlanIdFor(input.product.productType, input.duration),
    duration: input.duration,
    label: input.label,
    amount: (amountCents / 100).toFixed(2),
    amountCents,
    currency: 'USD',
    durationDays: input.days,
  };
}

export function catalogSelections(): CatalogSelection[] {
  return products().flatMap((product) => {
    const productType = product.productType as CatalogProductType;
    if (productType === 'custom') return [];
    const monthly = moneyToPlan({ product, duration: 'monthly', price: product.price_monthly, label: 'Monthly', days: 30 });
    const quarterly = moneyToPlan({ product, duration: '3_months', price: product.price_quarterly, label: '3 Months', days: 90 });
    return [monthly, quarterly].filter((plan): plan is CatalogPlan => Boolean(plan)).map((plan) => ({ product, productType, plan }));
  });
}

export function findCatalogSelection(input: { productId?: unknown; productSlug?: unknown; planId?: unknown; duration?: unknown }): CatalogSelection | null {
  const productId = typeof input.productId === 'string' ? input.productId.trim() : '';
  const productSlug = typeof input.productSlug === 'string' ? input.productSlug.trim() : '';
  const planId = typeof input.planId === 'string' ? input.planId.trim() : '';
  const duration = typeof input.duration === 'string' ? input.duration.trim() : '';
  if (!productId || !productSlug) return null;
  return catalogSelections().find(({ product, plan }) =>
    product.id === productId &&
    (product.key === productSlug || product.productType === productSlug || product.id === productSlug) &&
    (!planId || plan.id === planId || plan.dbPlanId === planId) &&
    (!duration || plan.duration === duration)
  ) ?? null;
}
