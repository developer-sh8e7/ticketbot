'use client';

import { useState } from 'react';

function cookie(name: string) {
  return document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))?.split('=')[1] || '';
}

export function ActivationForm() {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await fetch('/api/activation/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': cookie('opus_csrf') },
      body: JSON.stringify({ activation_code: code }),
    });
    const payload = await res.json();
    setLoading(false);
    if (!res.ok || !payload.success) {
      setMessage(payload.error?.message || 'Activation failed');
      return;
    }
    window.location.href = payload.data.redirect;
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <label className="grid gap-2">
        <span>Activation code</span>
        <input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="OPUS-XXXXXX-XXXX-XXXX" dir="ltr" autoComplete="one-time-code" />
      </label>
      <button disabled={loading} className="rounded-2xl border border-opus-silver bg-opus-text px-5 py-3 font-semibold text-black disabled:opacity-60">{loading ? 'Checking…' : 'Continue'}</button>
      {message ? <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{message}</p> : null}
    </form>
  );
}
