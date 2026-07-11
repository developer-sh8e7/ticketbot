'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Phone, Plus, Send, UserRound } from 'lucide-react';

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

export function ProjectRequestsClient({ ownerMode = false }: { ownerMode?: boolean }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [phone, setPhone] = useState('');
  const [reply, setReply] = useState('');
  const [otherTyping, setOtherTyping] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastTypingSentAt = useRef(0);

  const loadRequests = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch('/api/project-requests', { cache: 'no-store' });
      const json = (await res.json()) as ApiResult<{ requests: RequestItem[] }>;
      if (!json.success) throw new Error(json.error?.message || 'تعذّر جلب الطلبات.');
      const rows = json.data?.requests ?? [];
      setRequests(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
      if (!ownerMode && rows.length === 0) setShowForm(true);
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
        body: JSON.stringify({ name, idea, phone }),
      });
      const json = (await res.json()) as ApiResult<{ request: RequestItem }>;
      if (!json.success || !json.data?.request) throw new Error(json.error?.message || 'تعذّر إرسال الطلب.');
      setRequests((rows) => [json.data!.request, ...rows]);
      setSelectedId(json.data.request.id);
      setName('');
      setIdea('');
      setPhone('');
      setShowForm(false);
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

  if (loading) {
    return <div className="opus-card flex min-h-72 items-center justify-center gap-2 font-arabic text-sm text-opus-muted"><Loader2 size={18} className="animate-spin" /> جاري تحميل المحادثات...</div>;
  }

  return (
    <div dir="rtl" className="grid gap-4 lg:grid-cols-[310px_1fr]">
      <aside className="opus-card h-fit p-3">
        <div className="flex items-center justify-between gap-2 px-2 pb-3">
          <div>
            <h2 className="font-arabic text-base font-extrabold text-opus-text">{ownerMode ? 'طلبات المشاريع' : 'مشاريعك'}</h2>
            <p className="font-arabic text-[11px] text-opus-muted">{requests.length} محادثة</p>
          </div>
          {!ownerMode ? (
            <button type="button" onClick={() => setShowForm(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-opus-accent text-black" aria-label="طلب مشروع جديد"><Plus size={17} /></button>
          ) : null}
        </div>
        <div className="grid max-h-[520px] gap-1 overflow-y-auto">
          {requests.length === 0 ? <p className="rounded-xl border border-dashed border-opus-border p-5 text-center font-arabic text-xs text-opus-muted">لا توجد طلبات حتى الآن.</p> : null}
          {requests.map((item) => {
            const unread = ownerMode ? item.ownerUnread : item.customerUnread;
            return (
              <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setShowForm(false); }} className={`rounded-xl border p-3 text-right transition ${selectedId === item.id && !showForm ? 'border-opus-accent bg-opus-accent/10' : 'border-transparent hover:border-opus-border hover:bg-opus-bg'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-arabic text-sm font-bold text-opus-text">{ownerMode ? item.requesterName || 'عميل Discord' : `طلب #${item.id.slice(0, 8)}`}</span>
                  {unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-opus-accent" title="رسالة جديدة" /> : null}
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 font-arabic text-[10px] text-opus-muted">
                  <span>{statusLabels[item.status]}</span><span>{formatDate(item.lastMessageAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="opus-card min-h-[590px] overflow-hidden p-0">
        {showForm && !ownerMode ? (
          <form onSubmit={createRequest} className="mx-auto grid max-w-2xl gap-6 p-6 sm:p-10">
            <div>
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-opus-accent/15 text-opus-accent"><MessageCircle size={23} /></span>
              <h1 className="font-arabic text-2xl font-extrabold text-opus-text">اطلب مشروعك</h1>
              <p className="mt-2 font-arabic text-sm leading-7 text-opus-muted">اكتب فكرتك وما الذي تريد تنفيذه، وسنفتح لك محادثة خاصة لمتابعة التفاصيل مباشرة.</p>
            </div>
            <label className="grid gap-2">
              <span className="font-arabic text-sm font-bold text-opus-text">اسمك</span>
              <input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك" className="input font-arabic" />
            </label>
            <label className="grid gap-2">
              <span className="font-arabic text-sm font-bold text-opus-text">فكرة المشروع</span>
              <textarea required minLength={10} maxLength={5000} rows={8} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="اشرح فكرة مشروعك، أهم المميزات، والنتيجة التي تتوقعها..." className="input resize-y font-arabic leading-7" />
              <span className="text-left font-english text-[11px] text-opus-muted">{idea.length} / 5000</span>
            </label>
            <label className="grid gap-2">
              <span className="flex items-center gap-2 font-arabic text-sm font-bold text-opus-text"><Phone size={15} className="text-opus-accent" /> الرقم (اختياري)</span>
              <input maxLength={100} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال أو وسيلة تواصل أخرى" dir="ltr" className="input font-english text-left" />
              <span className="font-arabic text-xs leading-6 text-opus-muted">الرقم اختياري، ولكن يُفضّل إضافته في حال احتجنا التواصل معك مستقبلاً.</span>
            </label>
            <div className="flex justify-end">
              <button disabled={creating} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-opus-accent px-6 py-3 font-arabic text-sm font-extrabold text-black disabled:opacity-50">{creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} إرسال الطلب</button>
            </div>
          </form>
        ) : selected ? (
          <div className="flex min-h-[590px] flex-col">
            <header className="border-b border-opus-border p-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-arabic text-base font-extrabold text-opus-text"><UserRound size={17} className="text-opus-accent" /> {ownerMode ? selected.requesterName || 'عميل Discord' : `طلب مشروع #${selected.id.slice(0, 8)}`}</h2>
                  <p className="mt-1 font-arabic text-[11px] text-opus-muted">بدأت {formatDate(selected.createdAt)} · {statusLabels[selected.status]}</p>
                </div>
              </div>
              {ownerMode ? (
                <div className="mt-4 grid gap-3 rounded-xl border border-opus-border bg-opus-bg p-4 sm:grid-cols-3">
                  <div>
                    <p className="font-arabic text-[10px] font-bold text-opus-muted">الشخص</p>
                    <p className="mt-1 font-arabic text-sm font-bold text-opus-text">{selected.requesterName || 'بدون اسم'}</p>
                    <p className="mt-1 font-english text-[10px] text-opus-muted">{selected.requesterDiscordId ? `Discord: ${selected.requesterDiscordId}` : 'زائر بدون تسجيل دخول'}</p>
                  </div>
                  <div>
                    <p className="font-arabic text-[10px] font-bold text-opus-muted">رقم التواصل</p>
                    <p className="mt-1 break-all font-english text-sm text-opus-text">{selected.phone || 'لم يُضف رقماً'}</p>
                  </div>
                  <div className="sm:col-span-1">
                    <p className="font-arabic text-[10px] font-bold text-opus-muted">فكرة المشروع</p>
                    <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap font-arabic text-sm leading-6 text-opus-text">{messages[0]?.content || (threadLoading ? 'جاري التحميل...' : '—')}</p>
                  </div>
                </div>
              ) : null}
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto bg-opus-bg/40 p-4 sm:p-6">
              {threadLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-opus-accent" /></div> : messages.map((message) => {
                const mine = ownerMode ? message.senderType === 'owner' : message.senderType === 'customer';
                return <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${mine ? 'rounded-tr-sm bg-opus-accent text-black' : 'rounded-tl-sm border border-opus-border bg-opus-surface text-opus-text'}`}><p className="whitespace-pre-wrap break-words font-arabic text-sm leading-7">{message.content}</p><p className={`mt-1 font-english text-[9px] ${mine ? 'text-black/60' : 'text-opus-muted'}`}>{formatDate(message.createdAt)}</p></div></div>;
              })}
              {otherTyping ? (
                <div className="flex justify-end">
                  <div className="inline-flex items-center gap-1 rounded-2xl rounded-tl-sm border border-opus-border bg-opus-surface px-4 py-3" aria-label="الطرف الآخر يكتب الآن">
                    {[0, 1, 2].map((dot) => <span key={dot} className="h-2 w-2 animate-bounce rounded-full bg-opus-muted" style={{ animationDelay: `${dot * 140}ms`, animationDuration: '850ms' }} />)}
                  </div>
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={sendMessage} className="flex gap-2 border-t border-opus-border p-3 sm:p-4">
              <textarea rows={2} maxLength={5000} value={reply} onChange={(e) => signalTyping(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={ownerMode ? 'اكتب ردك للعميل...' : 'اكتب رسالتك...'} className="input min-h-[48px] flex-1 resize-none font-arabic" />
              <button disabled={sending || !reply.trim()} className="inline-flex w-12 items-center justify-center rounded-xl bg-opus-accent text-black disabled:opacity-40" aria-label="إرسال الرسالة">{sending ? <Loader2 size={18} className="animate-spin" /> : <ArrowLeft size={20} />}</button>
            </form>
          </div>
        ) : <div className="flex min-h-[590px] flex-col items-center justify-center p-8 text-center"><MessageCircle size={34} className="text-opus-muted" /><p className="mt-4 font-arabic text-sm text-opus-muted">اختر محادثة لعرضها.</p></div>}
        {error ? <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-3 font-arabic text-xs text-red-200">{error}</div> : null}
      </section>
    </div>
  );
}
