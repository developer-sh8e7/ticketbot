'use client';

import { usePathname } from 'next/navigation';
import { trackMarketingEvent } from '@/lib/client-analytics';

const message = encodeURIComponent('هلا، دخلت موقع Opus وأبي أستفسر عن تصميم موقع أو تطبيق.');
const whatsappUrl = `https://wa.me/966597232969?text=${message}`;

export function WhatsAppButton() {
  const pathname = usePathname();
  const visible = pathname === '/' || pathname.startsWith('/project-request');
  if (!visible) return null;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackMarketingEvent('whatsapp_click', { path: pathname, source: 'floating_button' })}
      className="fixed bottom-5 left-4 z-40 inline-flex items-center gap-2 rounded-full border border-[#2acb70]/35 bg-[#103d27] px-4 py-3 font-arabic text-sm font-extrabold text-[#d9ffe8] shadow-[0_18px_55px_rgba(0,0,0,0.38)] transition hover:-translate-y-1 hover:border-[#2acb70] hover:bg-[#145332] focus:outline-none focus:ring-2 focus:ring-[#2acb70] sm:left-6"
      aria-label="تواصل معنا عبر واتساب"
    >
      <svg viewBox="0 0 32 32" width="20" height="20" fill="currentColor" aria-hidden="true">
        <path d="M16.04 3A12.8 12.8 0 0 0 5.02 22.3L3.2 29l6.86-1.8A12.8 12.8 0 1 0 16.04 3Zm0 23.35c-1.9 0-3.76-.51-5.38-1.48l-.38-.22-4.07 1.07 1.09-3.97-.25-.41a10.55 10.55 0 1 1 8.99 5.01Zm5.8-7.9c-.32-.16-1.88-.93-2.17-1.03-.29-.11-.5-.16-.71.16-.21.31-.82 1.03-1 1.24-.19.21-.37.24-.69.08-.32-.16-1.34-.49-2.55-1.58a9.57 9.57 0 0 1-1.77-2.2c-.18-.32-.02-.49.14-.65.14-.14.32-.37.48-.56.16-.18.21-.31.32-.52.1-.21.05-.4-.03-.56-.08-.16-.71-1.72-.98-2.36-.25-.61-.52-.53-.71-.54h-.61c-.21 0-.56.08-.85.4-.29.31-1.11 1.08-1.11 2.64 0 1.56 1.14 3.07 1.3 3.28.16.21 2.24 3.42 5.42 4.8.76.33 1.35.52 1.81.67.76.24 1.45.21 2 .13.61-.09 1.88-.77 2.14-1.51.26-.74.26-1.37.18-1.5-.08-.14-.29-.22-.61-.38Z" />
      </svg>
      <span className="hidden sm:inline">تواصل واتساب</span>
    </a>
  );
}
