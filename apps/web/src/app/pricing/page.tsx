import { permanentRedirect } from 'next/navigation';

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const current = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value) query.set(key, value);
  }

  permanentRedirect(`/bots${query.size ? `?${query.toString()}` : ''}#prices`);
}
