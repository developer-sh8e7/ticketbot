import { logger } from '@opus/core';

export function padTicketNumber(ticketNumber: number, length: number): string {
  return String(ticketNumber).padStart(length, '0');
}

export function replaceTokens(template: string, tokens: Record<string, string | number>): string {
  let output = template;

  for (const [key, value] of Object.entries(tokens)) {
    output = output.replaceAll(`{${key}}`, String(value));
  }

  return output;
}

export function normalizeChannelName(input: string, maxLength: number): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_・-]+/gu, '')
    .replace(/\s*・\s*/g, '・')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[・-]+|[・-]+$/g, '');

  const safe = normalized || 'ticket';
  return safe.slice(0, maxLength);
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function formatRoleMentions(roleIds: string[]): string {
  return uniqueStrings(roleIds)
    .map((roleId) => `<@&${roleId}>`)
    .join(' ')
    .trim();
}

export function normalizeSnowflake(input: string): string | null {
  const trimmed = input.trim();
  const matched = trimmed.match(/^<@!?(\d+)>$/) ?? trimmed.match(/^(\d{16,20})$/);
  return matched?.[1] ?? null;
}

export function toCodeBlock(value: string): string {
  return `\`\`\`${value.replace(/\`\`\`/g, '```')}\`\`\``;
}

export function parseTradeAmount(input: string): number | null {
  if (!input) return null;
  const cleaned = input.replace(/\s+/g, '');
  const matches = cleaned.match(/\d+(\.\d+)?/g);
  if (!matches) return null;

  const amount = parseFloat(matches[0]);
  return isNaN(amount) ? null : amount;
}

export async function parseTradeAmountSmartly(input: string): Promise<number | null> {
  const localParsed = parseTradeAmount(input);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    logger.debug(`No API key found, using local regex parser: ${localParsed}`);
    return localParsed;
  }

  const provider = process.env.AI_PROVIDER || 'gemini';
  const model = process.env.AI_MODEL || 'gemini-2.5-flash';
  const baseUrl = process.env.AI_BASE_URL || 'https://opencode.ai/zen/v1';

  try {
    let responseText = '';
    let ok = false;

    const prompt = `Extract the trade amount in USD from this user input. If the input contains a text representation of a number (like "مئة وخمسين" or "fifty"), convert it to a number. Return ONLY a JSON object in this format: {"amount": number | null}. Do not include markdown code block formatting. Just return the raw JSON string.\n\nInput: "${input}"`;

    if (provider === 'gemini') {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ]
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json() as any;
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        ok = true;
      }
    } else {
      const modelsToTry = [model];
      const fallbackList = [
        'deepseek-v4-flash-free',
        'minimax-m2.5-free',
        'nemotron-3-super-free',
        'qwen3.6-plus-free'
      ];
      for (const fb of fallbackList) {
        if (!modelsToTry.includes(fb)) {
          modelsToTry.push(fb);
        }
      }

      for (const modelName of modelsToTry) {
        try {
          logger.info(`Attempting trade amount extraction with model: ${modelName}`);
          const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: modelName,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                }
              ]
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (response.ok) {
            const data = await response.json() as any;
            responseText = data.choices?.[0]?.message?.content?.trim() || '';
            if (responseText) {
              logger.info(`Trade amount extraction succeeded using model: ${modelName}`);
              ok = true;
              break;
            }
          } else {
            logger.warn(`Model ${modelName} returned status ${response.status} for extraction`);
          }
        } catch (err: any) {
          logger.error(`Model ${modelName} extraction failed or timed out: ${err.message || err}`);
        }
      }
    }

    if (ok && responseText) {
      const jsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const result = JSON.parse(jsonText);
      if (typeof result.amount === 'number') {
        logger.info(`AI extracted trade amount: ${result.amount} (from: "${input}")`);
        return result.amount;
      }
    }
  } catch (error) {
    logger.error('Failed to parse trade amount with AI, falling back to local regex', error);
  }

  return localParsed;
}
