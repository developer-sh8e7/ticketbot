import {
  AttachmentBuilder,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';
import type { TicketRecord } from '../database/types.js';
import { padTicketNumber } from '../utils/text.js';

async function fetchAllMessages(channel: GuildTextBasedChannel): Promise<Message[]> {
  const messages: Message[] = [];
  let before: string | undefined;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;
    const values = [...batch.values()];
    messages.push(...values);
    before = values.at(-1)?.id;
    if (batch.size < 100) break;
  }

  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function discordTimestamp(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${date} ${time}`;
}

function formatContent(raw: string): string {
  let text = esc(raw);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/__(.+?)__/g, '<u>$1</u>');
  text = text.replace(/~~(.+?)~~/g, '<del>$1</del>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  text = text.replace(/&lt;@!?(\d+)&gt;/g, '<span class="mention">@User $1</span>');
  text = text.replace(/&lt;@&amp;(\d+)&gt;/g, '<span class="mention">@Role $1</span>');
  text = text.replace(/&lt;#(\d+)&gt;/g, '<span class="mention">#channel-$1</span>');
  text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  return text;
}

function renderEmbed(embed: { title?: string | null; description?: string | null; color?: number | null; fields?: { name: string; value: string; inline?: boolean }[]; footer?: { text: string } | null; thumbnail?: { url: string } | null; image?: { url: string } | null; url?: string | null }): string {
  const borderColor = embed.color ? `#${embed.color.toString(16).padStart(6, '0')}` : '#5865f2';
  let html = `<div class="embed" style="border-left-color:${borderColor}">`;
  if (embed.title) {
    const titleText = embed.url ? `<a href="${esc(embed.url)}" target="_blank">${esc(embed.title)}</a>` : esc(embed.title);
    html += `<div class="embed-title">${titleText}</div>`;
  }
  if (embed.description) html += `<div class="embed-desc">${formatContent(embed.description)}</div>`;
  if (embed.fields && embed.fields.length > 0) {
    html += '<div class="embed-fields">';
    for (const field of embed.fields) {
      html += `<div class="embed-field${field.inline ? ' inline' : ''}"><div class="embed-field-name">${esc(field.name)}</div><div class="embed-field-value">${formatContent(field.value)}</div></div>`;
    }
    html += '</div>';
  }
  if (embed.thumbnail?.url) html += `<img class="embed-thumb" src="${esc(embed.thumbnail.url)}" />`;
  if (embed.image?.url) html += `<img class="embed-img" src="${esc(embed.image.url)}" />`;
  if (embed.footer?.text) html += `<div class="embed-footer">${esc(embed.footer.text)}</div>`;
  html += '</div>';
  return html;
}

function shouldGroup(prev: Message | null, curr: Message): boolean {
  if (!prev) return false;
  if (prev.author.id !== curr.author.id) return false;
  if (curr.createdTimestamp - prev.createdTimestamp > 7 * 60 * 1000) return false;
  return true;
}

function renderMessages(messages: Message[]): string {
  const parts: string[] = [];
  let prev: Message | null = null;

  for (const msg of messages) {
    const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 128 });
    const displayName = esc(msg.member?.displayName || msg.author.displayName || msg.author.username);
    const tag = esc(msg.author.tag);
    const userId = msg.author.id;
    const isBot = msg.author.bot;
    const botBadge = isBot ? '<span class="bot-badge">BOT</span>' : '';
    const ts = discordTimestamp(msg.createdTimestamp);
    const grouped = shouldGroup(prev, msg);

    let contentHtml = '';
    if (msg.content?.trim()) {
      contentHtml += `<div class="msg-text">${formatContent(msg.content).replaceAll('\n', '<br/>')}</div>`;
    }

    for (const att of msg.attachments.values()) {
      const isImage = att.contentType?.startsWith('image/');
      if (isImage) {
        contentHtml += `<div class="msg-attachment"><img src="${esc(att.url)}" alt="${esc(att.name ?? 'attachment')}" /></div>`;
      } else {
        contentHtml += `<div class="msg-attachment"><a href="${esc(att.url)}" target="_blank">${esc(att.name ?? 'File')}</a> (${(att.size / 1024).toFixed(1)} KB)</div>`;
      }
    }

    for (const embed of msg.embeds) {
      contentHtml += renderEmbed({
        title: embed.title,
        description: embed.description,
        color: embed.color,
        fields: embed.fields,
        footer: embed.footer,
        thumbnail: embed.thumbnail,
        image: embed.image,
        url: embed.url,
      });
    }

    if (!contentHtml) {
      contentHtml = '<div class="msg-text" style="opacity:0.4"><em>empty message</em></div>';
    }

    if (grouped) {
      parts.push(`<div class="msg grouped"><div class="msg-side"><span class="msg-ts-hover">${ts}</span></div><div class="msg-body">${contentHtml}</div></div>`);
    } else {
      parts.push(`
        <div class="msg">
          <div class="msg-side"><img class="avatar" src="${avatar}" alt="" /></div>
          <div class="msg-body">
            <div class="msg-header">
              <span class="author">${displayName}</span>${botBadge}
              <span class="user-id">${tag} (${userId})</span>
              <span class="msg-ts">${ts}</span>
            </div>
            ${contentHtml}
          </div>
        </div>`);
    }
    prev = msg;
  }

  return parts.join('\n');
}

function renderHtml(ticket: TicketRecord, channelName: string, guildName: string, guildIcon: string, messages: Message[]): string {
  const padded = padTicketNumber(ticket.ticket_number, 4);
  const openedAt = ticket.opened_at ? discordTimestamp(new Date(ticket.opened_at).getTime()) : '—';
  const closedAt = ticket.closed_at ? discordTimestamp(new Date(ticket.closed_at).getTime()) : '—';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Transcript — Ticket #${padded}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{color-scheme:dark}
body{font-family:'gg sans','Noto Sans',Helvetica,Arial,sans-serif;background:#313338;color:#dbdee1;font-size:15px;line-height:1.375}
a{color:#00a8fc;text-decoration:none}a:hover{text-decoration:underline}
code{background:#2b2d31;padding:1px 4px;border-radius:3px;font-size:14px;font-family:'Consolas','Courier New',monospace}
pre{background:#2b2d31;padding:10px;border-radius:4px;overflow-x:auto;margin:4px 0}
pre code{background:none;padding:0}

.container{max-width:100%;margin:0 auto}

/* Header */
.header{background:#2b2d31;border-bottom:1px solid #1e1f22;padding:16px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.header img{width:32px;height:32px;border-radius:50%}
.header .ch-name{font-weight:600;font-size:16px;color:#f2f3f5}
.header .ch-name::before{content:'# ';color:#80848e}

/* Info panel */
.info{background:#2b2d31;margin:16px;border-radius:8px;padding:20px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.info-item{display:flex;flex-direction:column;gap:2px}
.info-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#b5bac1}
.info-value{color:#f2f3f5;font-size:14px}

/* Messages */
.messages{padding:0 16px 16px}
.msg{display:flex;gap:16px;padding:2px 8px;margin-top:16px;border-radius:4px;position:relative}
.msg:hover{background:#2e3035}
.msg.grouped{margin-top:0;padding-top:0}
.msg-side{width:40px;flex-shrink:0;display:flex;justify-content:center;align-items:flex-start}
.avatar{width:40px;height:40px;border-radius:50%;cursor:pointer}
.msg.grouped .msg-side{padding-top:2px}
.msg-ts-hover{display:none;font-size:11px;color:#949ba4;white-space:nowrap;line-height:22px}
.msg.grouped:hover .msg-ts-hover{display:block}
.msg-body{min-width:0;flex:1}
.msg-header{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:1px}
.author{font-weight:600;color:#f2f3f5;cursor:pointer;font-size:15px}
.author:hover{text-decoration:underline}
.bot-badge{background:#5865f2;color:#fff;font-size:10px;font-weight:600;padding:1px 5px;border-radius:3px;text-transform:uppercase;vertical-align:middle;margin-left:2px;letter-spacing:.02em}
.user-id{color:#949ba4;font-size:12px}
.msg-ts{color:#949ba4;font-size:12px}
.msg-text{white-space:pre-wrap;word-wrap:break-word;color:#dbdee1}
.msg-attachment{margin:4px 0}
.msg-attachment img{max-width:400px;max-height:300px;border-radius:8px;cursor:pointer}

/* Mentions */
.mention{background:rgba(88,101,242,.3);color:#c9cdfb;padding:0 3px;border-radius:3px;font-weight:500;cursor:pointer}
.mention:hover{background:rgba(88,101,242,.5)}

/* Embeds */
.embed{background:#2b2d31;border-left:4px solid #5865f2;border-radius:4px;padding:12px 16px;margin:4px 0;max-width:520px}
.embed-title{font-weight:700;color:#f2f3f5;margin-bottom:4px;font-size:15px}
.embed-title a{color:#00a8fc}
.embed-desc{font-size:14px;color:#dcddde;margin-bottom:8px;white-space:pre-wrap}
.embed-fields{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.embed-field{min-width:100%}
.embed-field.inline{min-width:0;flex:1 1 30%}
.embed-field-name{font-size:13px;font-weight:700;color:#f2f3f5;margin-bottom:2px}
.embed-field-value{font-size:14px;color:#dcddde;white-space:pre-wrap}
.embed-thumb{max-width:80px;max-height:80px;border-radius:4px;float:right;margin-left:16px}
.embed-img{max-width:100%;border-radius:4px;margin-top:8px}
.embed-footer{font-size:12px;color:#949ba4;margin-top:8px}

/* Divider */
.divider{display:flex;align-items:center;gap:8px;margin:16px 24px;color:#949ba4;font-size:12px;font-weight:600}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:#3f4147}

/* Footer */
.page-footer{text-align:center;padding:24px;color:#949ba4;font-size:12px;border-top:1px solid #3f4147;margin-top:8px}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    ${guildIcon ? `<img src="${esc(guildIcon)}" alt=""/>` : ''}
    <div class="ch-name">${esc(channelName)}</div>
  </div>

  <div class="info">
    <div class="info-item"><span class="info-label">Ticket</span><span class="info-value">#${padded}</span></div>
    <div class="info-item"><span class="info-label">Creator</span><span class="info-value">${esc(ticket.creator_tag)} (${ticket.creator_id})</span></div>
    <div class="info-item"><span class="info-label">Category</span><span class="info-value">${esc(ticket.category_label)}</span></div>
    <div class="info-item"><span class="info-label">Status</span><span class="info-value">${esc(ticket.status)}</span></div>
    <div class="info-item"><span class="info-label">Opened</span><span class="info-value">${openedAt}</span></div>
    <div class="info-item"><span class="info-label">Closed</span><span class="info-value">${closedAt}</span></div>
  </div>

  <div class="divider">${messages.length} Messages</div>

  <div class="messages">
    ${renderMessages(messages)}
  </div>

  <div class="page-footer">
    Transcript generated on ${discordTimestamp(Date.now())} — ${esc(guildName)}
  </div>
</div>
</body>
</html>`;
}

export class TranscriptService {
  public async buildAttachment(
    channel: GuildTextBasedChannel,
    ticket: TicketRecord,
    zeroPadLength: number,
  ): Promise<AttachmentBuilder> {
    const messages = await fetchAllMessages(channel);
    const paddedNumber = padTicketNumber(ticket.ticket_number, zeroPadLength);
    const guild = channel.guild;
    const guildName = guild.name;
    const guildIcon = guild.iconURL({ extension: 'png', size: 128 }) || '';
    const html = renderHtml(ticket, channel.name, guildName, guildIcon, messages);

    return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `ticket-${paddedNumber}-transcript.html`,
    });
  }
}
