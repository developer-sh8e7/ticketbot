import { ActivationForm } from '@/components/ActivationForm';
import { Card, PublicFrame, SectionTitle } from '@/components/ui';

export default function LoginPage() {
  return (
    <PublicFrame>
      <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <SectionTitle
            eyebrow="دخول العميل"
            title="اربط كود التفعيل بحسابك"
            description="استخدم كود التفعيل اللي استلمته بعد الشراء للدخول إلى لوحة التحكم الخاصة بك."
          />
          <div className="rounded-2xl border border-opus-border bg-opus-panel p-4 text-sm text-opus-muted">
            بعد الربط، الدخول يكون للحساب المرتبط فقط.
          </div>
        </div>
        <Card>
          <h2 className="mb-4 text-2xl font-extrabold">تسجيل الدخول</h2>
          <ActivationForm />
        </Card>
      </div>
    </PublicFrame>
  );
}
