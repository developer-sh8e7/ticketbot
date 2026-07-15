'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, MessageCircle, Plus, Send, Trash2, UserRound } from 'lucide-react';
import { ProjectFormScene3D } from '@/components/ProjectFormScene3D';
import { trackMarketingEvent } from '@/lib/client-analytics';

type RequestItem = {
  id: string;
  requesterDiscordId: string | null;
  requesterName: string | null;
  phone: string | null;
  status: 'new' | 'open' | 'closed';
  ownerUnread: boolean;
  customerUnread: boolean;
  createdAt: string;
  lastMessageAt: string;
};

type Message = { id: string; senderType: 'customer' | 'owner'; content: string; createdAt: string };
type ApiResult<T> = { success: boolean; data?: T; error?: { message?: string } };

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)opus_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}

const statusLabels = { new: 'جديد', open: 'قيد التواصل', closed: 'مغلق' } as const;
const featureOptions = [
  ['login', 'تسجيل دخول'],
  ['dashboard', 'لوحة تحكم'],
  ['payments', 'دفع إلكتروني'],
  ['mobile', 'تطبيق جوال'],
  ['unsure', 'غير متأكد'],
] as const;
const budgetOptions = [
  ['needs_estimate', 'أحتاج تقدير منكم'],
  ['flexible', 'مرنة حسب الحل المناسب'],
  ['has_budget', 'عندي ميزانية محددة'],
  ['discuss_later', 'نناقشها بعد مراجعة الفكرة'],
] as const;

export function ProjectRequestsClient({ ownerMode = false }: { ownerMode?: boolean }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showForm, setShowForm] = useState(!ownerMode);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [contactMethod, setContactMethod] = useState<'whatsapp' | 'email'>('whatsapp');
  const [contact, setContact] = useState('');
  const [idea, setIdea] = useState('');
  const [mainGoal, setMainGoal] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [budget, setBudget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reply, setReply] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSentAt = useRef(0);
  const formStartedTracked = useRef(false);

  useEffect(() => {
    if (ownerMode || !showForm) return;
    const audience = new URLSearchParams(window.location.search).get('for') || 'general';
    try {
      if (sessionStorage.getItem('opus_project_form_viewed')) return;
      sessionStorage.setItem('opus_project_form_viewed', '1');
    } catch {}
    trackMarketingEvent('project_form_viewed', { path: window.location.pathname, audience });
  }, [ownerMode, showForm]);

  function trackFormStarted() {
    if (formStartedTracked.current) return;
    formStartedTracked.current = true;
    const audience = new URLSearchParams(window.location.search).get('for') || 'general';
    trackMarketingEvent('project_form_started', { path: window.location.pathname, audience });
  }

  const loadRequests = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/project-requests', { cache: 'no-store' });
      const json = (await res.json()) as ApiResult<{ requests: RequestItem[] }>;
      if (!json.success) throw new Error(json.error?.message || 'تعذّر جلب الطلبات.');
      const rows = json.data?.requests ?? [];
      setRequests(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
      if (!ownerMode) setShowForm(rows.length === 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر جلب الطلبات.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [ownerMode]);

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setThreadLoading(true);
    try {
      const res = await fetch(`/api/project-requests/${id}/messages`, { cache: 'no-store' });
      const json = (await res.json()) as ApiResult<{ request: RequestItem; messages: Message[]; otherTyping: boolean }>;
      if (!json.success) throw new Error(json.error?.message || 'تعذّر فتح المحادثة.');
      setMessages(json.data?.messages ?? []);
      setOtherTyping(Boolean(json.data?.otherTyping));
      if (json.data?.request) {
        setRequests((rows) => rows.map((row) => row.id === id ? json.data!.request : row));
      }
      if (!quiet) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) {
      if (!quiet) setError(e instanceof Error ? e.message : 'تعذّر فتح المحادثة.');
    } finally {
      if (!quiet) setThreadLoading(false);
    }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);
  useEffect(() => {
    if (!selectedId || showForm) return;
    void loadThread(selectedId);
    const timer = window.setInterval(() => {
      void loadThread(selectedId, true);
      void loadRequests(true);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [selectedId, showForm, loadThread, loadRequests]);

  async function createRequest(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/project-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
        body: JSON.stringify({ name, contactMethod, contact, idea, mainGoal, features, budget, deadline }),
      });
      const json = (await res.json()) as ApiResult<{ request: RequestItem }>;
      if (!json.success || !json.data?.request) throw new Error(json.error?.message || 'تعذّر إرسال الطلب.');
      setRequests((rows) => [json.data!.request, ...rows]);
      setSelectedId(json.data.request.id);
      setSubmittedId(json.data.request.id);
      setName('');
      setContact('');
      setIdea('');
      setMainGoal('');
      setFeatures([]);
      setBudget('');
      setDeadline('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر إرسال الطلب.');
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/project-requests/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken() },
        body: JSON.stringify({ content: reply }),
      });
      const json = (await res.json()) as ApiResult<{ message: Message }>;
      if (!json.success || !json.data?.message) throw new Error(json.error?.message || 'تعذّر إرسال الرسالة.');
      setMessages((rows) => [...rows, json.data!.message]);
      setOtherTyping(false);
      setReply('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      void loadRequests(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  }

  async function deleteProject() {
    if (!ownerMode || !selectedId || !window.confirm('متأكد أنك تريد حذف هذا المشروع وكل محادثته؟ لا يمكن التراجع عن الحذف.')) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/project-requests/${selectedId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken() },
      });
      const json = (await res.json()) as ApiResult<{ deleted: boolean }>;
      if (!json.success) throw new Error(json.error?.message || 'تعذّر حذف المشروع.');
      const remaining = requests.filter((item) => item.id !== selectedId);
      setRequests(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setMessages([]);
      setOtherTyping(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذّر حذف المشروع.');
    } finally {
      setDeleting(false);
    }
  }

  function signalTyping(value: string) {
    setReply(value);
    if (!selectedId || !value.trim() || Date.now() - lastTypingSentAt.current < 1800) return;
    lastTypingSentAt.current = Date.now();
    void fetch(`/api/project-requests/${selectedId}/typing`, {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken() },
    }).catch(() => {});
  }

  const selected = requests.find((row) => row.id === selectedId) ?? null;
  const showSidebar = ownerMode || (requests.length > 0 && !submittedId);

  if (loading && ownerMode) {
    return <div className="opus-card flex min-h-72 items-center justify-center gap-2 font-arabic text-sm text-[var(--color-muted)]"><Loader2 size={18} className="animate-spin" /> جاري تحميل المحادثات...</div>;
  }

  return (
    <div dir="rtl" className={showSidebar ? 'grid gap-4 lg:grid-cols-[310px_1fr]' : showForm && !ownerMode ? 'mx-auto max-w-5xl' : 'mx-auto max-w-3xl'}>
      {showSidebar ? <aside className="opus-card h-fit p-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-3">
          <div>
            <h2 className="font-arabic text-base font-extrabold text-[var(--color-text)]">{ownerMode ? 'طلبات المشاريع' : 'مشاريعك'}</h2>
            <p className="font-arabic text-[11px] text-[var(--color-muted)]">{requests.length} محادثة</p>
          </div>
          {!ownerMode ? (
            <button type="button" onClick={() => { setSubmittedId(null); setError(''); setShowForm(true); }} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent)] text-black" aria-label="طلب مشروع جديد"><Plus size={17} /></button>
          ) : null}
        </div>
        <div className="grid max-h-[520px] gap-1 overflow-y-auto">
          {requests.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--color-border)] p-5 text-center font-arabic text-xs text-[var(--color-muted)]">لا توجد طلبات حتى الآن.</p> : null}
          {requests.map((item) => {
            const unread = ownerMode ? item.ownerUnread : item.customerUnread;
            return (
              <button key={item.id} type="button" onClick={() => { setSubmittedId(null); setSelectedId(item.id); setShowForm(false); }} className={`rounded-xl border p-3 text-right transition ${selectedId === item.id && !showForm ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-bg)]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-arabic text-sm font-bold text-[var(--color-text)]">{ownerMode ? item.requesterName || 'عميل Discord' : `طلب #${item.id.slice(0, 8)}`}</span>
                  {unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-accent)]" title="رسالة جديدة" /> : null}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-arabic text-[10px] text-[var(--color-muted)]">
                  <span>{statusLabels[item.status]}</span><span>{formatDate(item.lastMessageAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside> : null}

      <section className="opus-card min-h-[590px] overflow-hidden p-0">
        {submittedId && !ownerMode ? (
          <div className="flex min-h-[590px] items-center justify-center p-6 sm:p-12">
            <div className="max-w-xl text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/8 text-emerald-300">
                <CheckCircle2 size={32} />
              </span>
              <h2 className="mt-6 font-arabic text-2xl font-extrabold text-[var(--color-text)]">تم استلام فكرتك ✅</h2>
              <p className="mt-3 font-arabic text-sm leading-7 text-[var(--color-muted)]">سنراجع الطلب ونتواصل معك قريباً بالتفاصيل والتكلفة قبل بدء العمل.</p>
              <div className="mt-6">
                <button type="button" onClick={() => { setSubmittedId(null); setShowForm(false); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5"><MessageCircle size={17} /> متابعة المحادثة</button>
              </div>
              <p className="mt-3 font-arabic text-xs text-[var(--color-muted)]">يمكنك متابعة المحادثة من هذا الجهاز في أي وقت.</p>
            </div>
          </div>
        ) : showForm && !ownerMode ? (
          <form onSubmit={createRequest} onFocusCapture={trackFormStarted} className="grid lg:grid-cols-[300px_1fr]">
            <aside className="relative overflow-hidden border-b border-[var(--color-border)] bg-[var(--color-bg)]/55 p-5 lg:border-b-0 lg:border-l lg:p-6">
              <div className="pointer-events-none h-52 sm:h-60 lg:h-72" aria-hidden="true">
                <ProjectFormScene3D step={1} />
              </div>
              <div className="mt-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4">
                <p className="font-arabic text-base font-extrabold text-[var(--color-text)]">كل شيء قدامك</p>
                <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)]">عبّ الحقول اللي تعرفها، وإذا شيء مو واضح اختر «غير متأكد» ونرتّبه معك.</p>
                <ul className="mt-4 grid gap-2 font-arabic text-xs text-[var(--color-muted)]">
                  {['ما يحتاج حساب', 'ما يحتاج معرفة تقنية', 'نراجع الطلب قبل أي اتفاق'].map((point) => <li key={point} className="flex items-center gap-2"><CheckCircle2 size={13} className="text-[var(--color-accent)]" />{point}</li>)}
                </ul>
              </div>
            </aside>

            <div className="min-w-0 p-6 sm:p-9">
              <div className="mb-8">
                <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">طلب مشروع جديد</p>
                <h2 className="mt-2 font-arabic text-2xl font-extrabold text-[var(--color-text)] sm:text-3xl">اكتب لنا فكرة مشروعك</h2>
                <p className="mt-2 font-arabic text-sm leading-7 text-[var(--color-muted)]">كل المعلومات في نفس الصفحة، وما يحتاج تكتب بصياغة رسمية.</p>
              </div>

              <div className="grid gap-7">
                <section className="grid gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-5">
                  <div><p className="font-english text-[10px] font-bold tracking-[0.18em] text-[var(--color-accent)]">01</p><h3 className="mt-1 font-arabic text-lg font-extrabold text-[var(--color-text)]">بيانات التواصل</h3></div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="grid gap-1.5">
                      <span className="font-arabic text-sm font-bold text-[var(--color-text)]">اسمك</span>
                      <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="كيف نناديك؟" autoComplete="name" className="input font-arabic" />
                    </label>
                    <div className="grid gap-1.5">
                      <span className="font-arabic text-sm font-bold text-[var(--color-text)]">طريقة التواصل</span>
                      <div className="grid grid-cols-2 gap-2">
                        {([['whatsapp', 'واتساب'], ['email', 'البريد الإلكتروني']] as const).map(([value, label]) => (
                          <button key={value} type="button" onClick={() => { setContact(''); setContactMethod(value); }} className={`rounded-xl border px-3 py-3 font-arabic text-sm font-bold transition ${contactMethod === value ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent-2)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/50'}`}>{label}</button>
                        ))}
                      </div>
                    </div>
                    <label className="grid gap-1.5 sm:col-span-2">
                      <span className="font-arabic text-sm font-bold text-[var(--color-text)]">{contactMethod === 'whatsapp' ? 'رقم واتساب' : 'البريد الإلكتروني'}</span>
                      <input required minLength={3} maxLength={100} type={contactMethod === 'email' ? 'email' : 'text'} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={contactMethod === 'whatsapp' ? 'مثال: 05xxxxxxxx' : 'name@example.com'} autoComplete={contactMethod === 'email' ? 'email' : 'tel'} dir="ltr" className="input font-english text-left" />
                    </label>
                  </div>
                </section>

                <section className="grid gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-5">
                  <div><p className="font-english text-[10px] font-bold tracking-[0.18em] text-[var(--color-accent)]">02</p><h3 className="mt-1 font-arabic text-lg font-extrabold text-[var(--color-text)]">فكرة المشروع</h3></div>
                  <label className="grid gap-1.5">
                    <span className="font-arabic text-sm font-bold text-[var(--color-text)]">وش فكرة مشروعك؟</span>
                    <textarea required minLength={10} maxLength={2500} rows={6} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="مثال: أبي منصة خدمات يختار فيها العميل طلبه ويدفع ويوصلني إشعار..." className="input resize-y font-arabic leading-7" />
                    <span dir="ltr" className="text-left font-english text-[11px] text-[var(--color-muted)]">{idea.length} / 2500</span>
                  </label>
                  <label className="grid gap-1.5">
                    <span className="font-arabic text-sm font-bold text-[var(--color-text)]">وش أهم نتيجة لازم يحققها؟</span>
                    <textarea required minLength={5} maxLength={1500} rows={4} value={mainGoal} onChange={(e) => setMainGoal(e.target.value)} placeholder="مثال: العميل يطلب ويدفع بسهولة وأنا أتابع كل الطلبات من مكان واحد." className="input resize-y font-arabic leading-7" />
                  </label>
                </section>

                <section className="grid gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/35 p-5">
                  <div><p className="font-english text-[10px] font-bold tracking-[0.18em] text-[var(--color-accent)]">03</p><h3 className="mt-1 font-arabic text-lg font-extrabold text-[var(--color-text)]">تفاصيل تساعدنا</h3></div>
                  <fieldset className="grid gap-3">
                    <legend className="font-arabic text-sm font-bold text-[var(--color-text)]">هل تحتاج أيًا من التالي؟</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {featureOptions.map(([value, label]) => {
                        const checked = features.includes(value);
                        return <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-arabic text-sm transition ${checked ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/40'}`}><input type="checkbox" checked={checked} onChange={() => setFeatures((items) => checked ? items.filter((item) => item !== value) : [...items, value])} className="h-4 w-4 accent-[var(--color-accent)]" />{label}</label>;
                      })}
                    </div>
                  </fieldset>
                  <fieldset className="grid gap-3">
                    <legend className="font-arabic text-sm font-bold text-[var(--color-text)]">ميزانيتك التقريبية</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {budgetOptions.map(([value, label]) => (
                        <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-arabic text-sm transition ${budget === value ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]' : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]/40'}`}><input required type="radio" name="budget" value={value} checked={budget === value} onChange={() => setBudget(value)} className="h-4 w-4 accent-[var(--color-accent)]" />{label}</label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="grid gap-1.5">
                    <span className="font-arabic text-sm font-bold text-[var(--color-text)]">عندك موعد محدد؟ <span className="font-normal text-[var(--color-muted)]">(اختياري)</span></span>
                    <input maxLength={100} value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="مثال: خلال شهر" className="input font-arabic" />
                  </label>
                </section>
              </div>

              {error ? <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 font-arabic text-xs leading-6 text-red-200">{error}</div> : null}
              <button disabled={creating} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-3.5 font-arabic text-base font-extrabold text-black transition hover:-translate-y-0.5 disabled:opacity-50">
                {creating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                أرسل فكرة مشروعك
              </button>
            </div>
          </form>
        ) : selected ? (
          <div className="flex min-h-[590px] flex-col">
            <header className="border-b border-[var(--color-border)] p-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-arabic text-base font-extrabold text-[var(--color-text)]"><UserRound size={17} className="text-[var(--color-accent)]" /> {ownerMode ? selected.requesterName || 'عميل Discord' : `طلب مشروع #${selected.id.slice(0, 8)}`}</h2>
                  <p className="mt-1 font-arabic text-[11px] text-[var(--color-muted)]">بدأت {formatDate(selected.createdAt)} · {statusLabels[selected.status]}</p>
                </div>
                {ownerMode ? (
                  <button type="button" disabled={deleting} onClick={deleteProject} className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 px-3 py-2 font-arabic text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} حذف المشروع
                  </button>
                ) : null}
              </div>
              {ownerMode ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-3">
                  <div>
                    <p className="font-arabic text-[10px] font-bold text-[var(--color-muted)]">الشخص</p>
                    <p className="mt-1 font-arabic text-sm font-bold text-[var(--color-text)]">{selected.requesterName || 'بدون اسم'}</p>
                    <p className="mt-1 font-english text-[10px] text-[var(--color-muted)]">{selected.requesterDiscordId ? `Discord: ${selected.requesterDiscordId}` : 'زائر بدون تسجيل دخول'}</p>
                  </div>
                  <div>
                    <p className="font-arabic text-[10px] font-bold text-[var(--color-muted)]">بيانات التواصل</p>
                    <p className="mt-1 break-all font-english text-sm text-[var(--color-text)]">{selected.phone || 'لم يُضف رقماً'}</p>
                  </div>
                  <div className="sm:col-span-1">
                    <p className="font-arabic text-[10px] font-bold text-[var(--color-muted)]">فكرة المشروع</p>
                    <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap font-arabic text-sm leading-6 text-[var(--color-text)]">{messages[0]?.content || (threadLoading ? 'جاري التحميل...' : '—')}</p>
                  </div>
                </div>
              ) : null}
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-bg)]/40 p-4 sm:p-6">
              {threadLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--color-accent)]" /></div> : messages.map((message) => {
                const mine = ownerMode ? message.senderType === 'owner' : message.senderType === 'customer';
                return <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${mine ? 'rounded-tr-sm bg-[var(--color-accent)] text-black' : 'rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'}`}><p className="whitespace-pre-wrap break-words font-arabic text-sm leading-7">{message.content}</p><p className={`mt-1 font-english text-[9px] ${mine ? 'text-black/60' : 'text-[var(--color-muted)]'}`}>{formatDate(message.createdAt)}</p></div></div>;
              })}
              {otherTyping ? (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3" aria-label="الطرف الآخر يكتب الآن">
                    {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-[var(--color-muted)]" style={{ animationDelay: `${dot * 140}ms`, animationDuration: '850ms' }} />)}
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-[var(--color-border)] p-3 sm:p-4">
              <textarea rows={2} maxLength={5000} value={reply} onChange={(e) => signalTyping(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={ownerMode ? 'اكتب ردك للعميل...' : 'اكتب رسالتك...'} className="input min-h-[48px] flex-1 resize-none font-arabic" />
              <button disabled={sending || !reply.trim()} className="inline-flex w-12 items-center justify-center rounded-xl bg-[var(--color-accent)] text-black disabled:opacity-40" aria-label="إرسال الرسالة">{sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={20} />}</button>
            </form>
          </div>
        ) : <div className="flex min-h-[590px] flex-col items-center justify-center p-8 text-center"><MessageCircle size={34} className="text-[var(--color-muted)]" /><p className="mt-4 font-arabic text-sm text-[var(--color-muted)]">اختر محادثة لعرضها.</p></div>}
        {error && !(showForm && !ownerMode) ? <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-3 font-arabic text-xs text-red-200">{error}</div> : null}
      </section>
    </div>
  );
}
