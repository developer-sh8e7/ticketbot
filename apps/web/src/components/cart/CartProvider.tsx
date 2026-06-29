'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type CartDuration = 'monthly' | '3_months';

export type CartItem = {
  key: string;
  id: string;
  name: string;
  productType: string;
  duration: CartDuration;
  amount: number;
  priceMonthly: number;
  priceQuarterly: number;
  currency: 'USD';
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  totalLabel: string;
  isOpen: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (key: string) => void;
  setDuration: (key: string, duration: CartDuration) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
};

const STORAGE_KEY = 'opus_cart_v1';

const CartContext = createContext<CartContextValue | null>(null);

function loadItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setItems(loadItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota errors */
    }
  }, [items, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      // One line per product — re-adding updates the duration/amount instead of duplicating.
      const existing = prev.find((i) => i.key === item.key);
      if (existing) return prev.map((i) => (i.key === item.key ? item : i));
      return [...prev, item];
    });
    setOpen(true);
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const setDuration = (key: string, duration: CartDuration) =>
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, duration, amount: duration === 'monthly' ? i.priceMonthly : i.priceQuarterly }
          : i,
      ),
    );

  const clear = () => setItems([]);

  const total = useMemo(() => items.reduce((sum, i) => sum + i.amount, 0), [items]);
  const totalLabel = useMemo(() => `$${total.toFixed(2)}`, [total]);

  const value: CartContextValue = {
    items,
    count: items.length,
    total,
    totalLabel,
    isOpen,
    addItem,
    removeItem,
    setDuration,
    clear,
    openCart: () => setOpen(true),
    closeCart: () => setOpen(false),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

/** Build a cart item from a catalog product + chosen duration. */
export function buildCartItem(
  product: { key: string; id: string; name: string; productType: string; price_monthly: number; price_quarterly: number },
  duration: CartDuration,
): CartItem {
  return {
    key: product.key,
    id: product.id,
    name: product.name,
    productType: product.productType,
    duration,
    amount: duration === 'monthly' ? product.price_monthly : product.price_quarterly,
    priceMonthly: product.price_monthly,
    priceQuarterly: product.price_quarterly,
    currency: 'USD',
  };
}
