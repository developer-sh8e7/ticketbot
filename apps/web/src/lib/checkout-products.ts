import { findCatalogSelection, catalogSelections, type CatalogPlan, type CatalogSelection, type CheckoutDuration } from '@/lib/product-catalog';

export type { CheckoutDuration };
export type CheckoutPlan = CatalogPlan;
export type CheckoutProductSelection = CatalogSelection;

export function checkoutProducts(): CheckoutProductSelection[] {
  return catalogSelections();
}

export function findCheckoutProductSelection(input: {
  productId?: unknown;
  productSlug?: unknown;
  planId?: unknown;
  duration?: unknown;
}): CheckoutProductSelection | null {
  return findCatalogSelection(input);
}
