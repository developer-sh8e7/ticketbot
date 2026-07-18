/**
 * Infinite scrolling text band — the classic award-site divider.
 * Pure CSS animation, duplicated track for a seamless loop.
 */
export function Marquee({ items }: { items: string[] }) {
  const track = (
    <div className="marquee-track flex shrink-0 items-center" aria-hidden="true">
      {items.map((item, i) => (
        <span key={i} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-arabic text-2xl font-extrabold text-[var(--color-text)] md:px-8 md:text-4xl">
            {item}
          </span>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-accent)] md:h-3 md:w-3" />
        </span>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="relative -rotate-1 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-5 md:py-7">
      <div className="flex overflow-hidden">
        {track}
        {track}
        {track}
      </div>
    </div>
  );
}
