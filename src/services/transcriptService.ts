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
    const batch = await channel.messages.fetch({
      limit: 100,
      before,
    });

    if (batch.size === 0) {
      break;
    }

    const values = [...batch.values()];
    messages.push(...values);
    before = values.at(-1)?.id;

    if (batch.size < 100) {
      break;
    }
  }

  return messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMessageContent(message: Message): string {
  const content = message.content?.trim() || '';
  const attachments = [...message.attachments.values()].map((attachment) => attachment.url);
  const embeds = message.embeds.map((embed) => embed.url || embed.title || embed.description || 'Embed');
  const fragments = [content, ...attachments, ...embeds].filter(Boolean);

  return escapeHtml(fragments.join('\n')) || '<em>Empty message</em>';
}

function renderMessages(messages: Message[]): string {
  return messages
    .map((message) => {
      const avatar = message.author.displayAvatarURL({ extension: 'png', size: 128 });
      const author = escapeHtml(message.author.tag);
      const timestamp = new Date(message.createdTimestamp).toLocaleString('en-GB', {
        hour12: false,
      });
      const content = formatMessageContent(message);

      return `
        <article class="message">
          <img class="avatar" src="${avatar}" alt="${author}" />
          <div class="body">
            <header>
              <span class="author">${author}</span>
              <span class="timestamp">${timestamp}</span>
            </header>
            <div class="content">${content.replaceAll('\n', '<br/>')}</div>
          </div>
        </article>
      `;
    })
    .join('\n');
}

function renderHtml(ticket: TicketRecord, channelName: string, messages: Message[]): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Ticket #${ticket.ticket_number}</title>
<style>
  :root {
    color-scheme: dark;
  }
  body {
    margin: 0;
    font-family: Inter, Arial, sans-serif;
    background: #0b0f14;
    color: #f8fafc;
  }
  .page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
  }
  .hero {
    background: linear-gradient(135deg, #07131d 0%, #102334 100%);
    border: 1px solid rgba(34, 211, 238, 0.25);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .hero h1 {
    margin: 0 0 8px;
    font-size: 28px;
  }
  .hero p {
    margin: 6px 0;
    color: #cbd5e1;
  }
  .message {
    display: flex;
    gap: 14px;
    padding: 16px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  }
  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .body {
    flex: 1;
    min-width: 0;
  }
  .body header {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 8px;
  }
  .author {
    font-weight: 700;
  }
  .timestamp {
    color: #94a3b8;
    font-size: 13px;
  }
  .content {
    white-space: normal;
    word-wrap: break-word;
    line-height: 1.6;
    color: #e2e8f0;
  }
</style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <h1>Ticket #${ticket.ticket_number}</h1>
      <p>Channel: ${escapeHtml(channelName)}</p>
      <p>Creator: ${escapeHtml(ticket.creator_tag)} (${ticket.creator_id})</p>
      <p>Category: ${escapeHtml(ticket.category_label)}</p>
      <p>Status: ${escapeHtml(ticket.status)}</p>
    </section>
    <section>
      ${renderMessages(messages)}
    </section>
  </main>
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
    const html = renderHtml(ticket, channel.name, messages);

    return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
      name: `ticket-${paddedNumber}-transcript.html`,
    });
  }
}
