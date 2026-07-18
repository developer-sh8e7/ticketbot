'use client';

import Image from 'next/image';

const RIYAL_IMAGE = 'https://i.imgur.com/rs8hC4g.png';

interface RiyalIconProps {
  size?: number;
  className?: string;
}

export function RiyalIcon({ size = 20, className = '' }: RiyalIconProps) {
  return (
    <Image
      src={RIYAL_IMAGE}
      alt="ريال"
      width={size}
      height={size}
      className={`inline-block ${className}`}
      style={{ width: size, height: size }}
      priority={size > 30}
      unoptimized
    />
  );
}

export function PriceWithRiyal({
  amount,
  size = 'base',
  className = '',
}: { amount: number; size?: 'sm' | 'base' | 'lg' | 'xl'; className?: string }) {
  const sizeMap = { sm: 'text-sm', base: 'text-base', lg: 'text-xl', xl: 'text-2xl' };
  return (
    <span className={`inline-flex items-center gap-1 font-extrabold ${sizeMap[size]} ${className}`}>
      <RiyalIcon size={size === 'xl' ? 28 : size === 'lg' ? 24 : size === 'base' ? 20 : 16} />
      <span>{amount.toLocaleString('ar-SA')}</span>
    </span>
  );
}

export function DiscountBadge({ original, current }: { original: number; current: number }) {
  const pct = Math.round(((original - current) / original) * 100);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)]/12 px-3 py-1 font-extrabold text-sm text-[var(--color-accent)]">
      <span>خصم</span>
      <span className="bg-[var(--color-accent)] text-white px-1.5 rounded">{pct}%</span>
    </span>
  );
}

export function StrikethroughPrice({ amount, size = 'base', className = '' }: { amount: number; size?: 'sm' | 'base' | 'lg'; className?: string }) {
  const sizeMap = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' };
  return (
    <span className={`inline-flex items-center gap-1 line-through opacity-60 ${sizeMap[size]} ${className}`}>
      <span className="font-medium">{amount.toLocaleString('ar-SA')}</span>
      <RiyalIcon size={size === 'lg' ? 20 : size === 'base' ? 18 : 14} className="opacity-60" />
    </span>
  );
}

export function RiyalText({ amount, size = 20, className = '', showIcon = true }: { amount: string | number; size?: number; className?: string; showIcon?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-arabic font-bold ${className}`} style={{ fontSize: size }}>
      {showIcon && <RiyalIcon size={size * 0.9} />}
      <span>{amount}</span>
      <span className="text-[var(--color-muted)] font-medium">ريال</span>
    </span>
  );
}