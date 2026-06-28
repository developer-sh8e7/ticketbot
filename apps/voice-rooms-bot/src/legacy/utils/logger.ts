import winston from 'winston';

const PHONE_PATTERN = /\+[1-9]\d{7,14}/g;
const DISCORD_ID_PATTERN = /\b\d{17,20}\b/g;
const JWT_PATTERN = /\beyJ[A-Za-z0-9._-]+\b/g;
const OTP_CONTEXT_PATTERN = /(\b(?:otp|code|رمز)\s*[:=]?\s*)\d{6}\b/gi;

function maskString(value: string): string {
  return value
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

const rootLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    redactFormat(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const details = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
      return `[${timestamp}] [${level.toUpperCase()}] ${message}${details}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export const logger = {
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
  httpStream: {
    write(message: string): void {
      rootLogger.info(maskString(message.trim()));
    },
  },
};
