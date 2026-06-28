'use client';

import { useMemo, useState } from 'react';
import { commands, commandCategories, type CommandCategory } from '@/lib/site-content';
import { Card } from './ui';

export function CommandExplorer() {
  const [category, setCategory] = useState<CommandCategory>('الكل');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return commands.filter((cmd) => {
      const categoryMatch = category === 'الكل' || cmd.category === category;
      const queryMatch = !q || cmd.name.toLowerCase().includes(q) || cmd.description.includes(q);
      return categoryMatch && queryMatch;
    });
  }, [category, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside>
        <label className="mb-4 grid gap-2">
          <span className="text-sm text-opus-muted">ابحث عن أمر</span>
          <input className="input" dir="ltr" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="/panel_send" />
        </label>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {commandCategories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`rounded-lg border px-4 py-2.5 text-start text-sm font-medium transition ${
                category === item
                  ? 'border-opus-accent bg-opus-accent/10 text-opus-text'
                  : 'border-opus-border/50 bg-transparent text-opus-muted hover:border-opus-border hover:text-opus-text'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </aside>

      <div className="grid gap-3">
        {filtered.length > 0 ? (
          filtered.map((cmd) => (
            <Card key={cmd.name} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <code className="text-base font-bold text-opus-text" dir="ltr">{cmd.name}</code>
                <span className="rounded-md border border-opus-border/30 bg-opus-panel px-2 py-0.5 text-xs text-opus-muted">{cmd.category}</span>
              </div>
              <p className="mt-2 text-sm leading-7 text-opus-muted">{cmd.description}</p>
            </Card>
          ))
        ) : (
          <Card>
            <p className="text-sm text-opus-muted">لا توجد أوامر تطابق بحثك.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
