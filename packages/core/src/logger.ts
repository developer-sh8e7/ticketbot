import winston from 'winston';

// Redaction patterns — never let tokens, phone numbers, JWTs or OTPs hit the logs.
const PHONE_PATTERN = /\+[1-9]\d{7,14}/g;
const DISCORD_ID_PATTERN = /\b\d{17,20}\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9._-]+\b/g;
const OTP_CONTEXT_PATTERN = /(\b(?:otp|code|رمز)\s*[:=]?\s*)\d{6}\b/gi;
// Discord bot tokens look like: <base64 id>.<base64>.<base64>
const DISCORD_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{23,28}\.[A-Za-z0-9_-]{6,7}\.[A-Za-z0-9_-]{27,}\b/g;

function maskString(value: string): string {
  return value
    .replace(DISCORD_TOKEN_PATTERN, '[bot-token-masked]')
    .replace(JWT_PATTERN, 'eyJ***[masked]')
    .replace(PHONE_PATTERN, (phone) => `${phone.slice(0, 4)}***${phone.slice(-4)}`)
    .replace(DISCORD_ID_PATTERN, (id) => `${id.slice(0, 4)}***`)
    .replace(OTP_CONTEXT_PATTERN, '$1******');
}

function sanitizeMeta(value: unknown): unknown {
  if (typeof value === 'string') return maskString(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskString(value.message),
      stack: value.stack ? maskString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) return value.map(sanitizeMeta);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        /token|secret|authorization|password|otp/i.test(key) ? '[masked]' : sanitizeMeta(entry),
      ]),
    );
  }
  return value;
}

const redactFormat = winston.format((info) => {
  info.message = maskString(String(info.message));
  for (const key of Object.keys(info)) {
    if (!['level', 'message', 'timestamp', Symbol.for('level'), Symbol.for('message')].includes(key)) {
      info[key] = sanitizeMeta(info[key]);
    }
  }
  return info;
});

function createLogger(serviceName: string) {
  const rootLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format: winston.format.combine(
      redactFormat(),
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const details = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] [${service}] ${message}${details}`;
      }),
    ),
    transports: [new winston.transports.Console()],
  });

  return {
    info(message: string, meta?: unknown): void {
      rootLogger.info(message, meta === undefined ? {} : { meta: sanitizeMeta(meta) });
    },
    warn(message: string, meta?: unknown): void {
      rootLogger.warn(message, meta === undefined ? {} : { meta: sanitizeMeta(meta) });
    },
    error(message: string, meta?: unknown): void {
      rootLogger.error(message, meta === undefined ? {} : { meta: sanitizeMeta(meta) });
    },
    debug(message: string, meta?: unknown): void {
      rootLogger.debug(message, meta === undefined ? {} : { meta: sanitizeMeta(meta) });
    },
  };
}

export type Logger = ReturnType<typeof createLogger>;
export { createLogger };

/** Default shared logger. Prefer createLogger('your-service') in each app. */
export const logger = createLogger('opus');
