import { ActivationForm } from '@/components/ActivationForm';
import { PublicFrame } from '@/components/ui';

const errorMessages: Record<string, string> = {
  oauth_state: 'انتهت جلسة الربط أو لم تتطابق. حاول مرة أخرى.',
  oauth_failed: 'تعذّر تسجيل الدخول عبر Discord. حاول مرة أخرى.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorText = error ? errorMessages[error] || 'حدث خطأ أثناء تسجيل الدخول.' : null;

  return (
    <PublicFrame>
      <section dir="rtl" className="mx-auto max-w-lg px-2 py-10 md:py-16">
        <div className="mb-8 text-center">
          <h1 className="font-arabic text-[2.25rem] font-extrabold leading-tight tracking-tight text-opus-text">
            تسجيل الدخول
          </h1>
          <p className="mx-auto mt-3 max-w-md font-arabic text-sm leading-7 text-opus-muted">
            سجّل دخولك عبر Discord للوصول إلى لوحة التحكم وإدارة بوتاتك واشتراكاتك.
          </p>
        </div>

        {errorText ? (
          <p className="mb-6 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-center text-sm text-red-200">
            {errorText}
          </p>
        ) : null}

        <div className="rounded-2xl border border-opus-border bg-opus-surface p-6 text-center">
          <a
            href="/api/auth/discord"
            className="inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#5865F2] px-6 py-4 font-arabic text-base font-extrabold text-white transition hover:opacity-90"
          >
            <svg viewBox="0 0 127 96" width="24" height="18" fill="currentColor" aria-hidden="true">
              <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
            </svg>
            <span>تسجيل الدخول عبر Discord</span>
          </a>
          <p className="mt-4 text-xs leading-6 text-opus-muted">
            نطلب صلاحية <span className="font-bold text-opus-text">identify</span> فقط — لا نصل لرسائلك أو سيرفراتك.
          </p>
        </div>

        <details className="group mt-5 rounded-2xl border border-opus-border bg-opus-surface p-5">
          <summary className="cursor-pointer list-none font-arabic text-sm font-bold text-opus-text">
            لديك كود تفعيل؟
            <span className="mr-2 text-opus-muted transition group-open:rotate-180">▾</span>
          </summary>
          <div className="mt-4">
            <p className="mb-3 text-xs leading-6 text-opus-muted">
              استخدم كود التفعيل الذي استلمته بعد الشراء لربطه بحسابك.
            </p>
            <ActivationForm />
          </div>
        </details>
      </section>
    </PublicFrame>
  );
}
