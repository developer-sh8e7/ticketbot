type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function format(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] ${message}`;

  if (meta === undefined) {
    return base;
  }

  return `${base} ${typeof meta === 'string' ? meta : JSON.stringify(meta)}`;
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.log(format('INFO', message, meta));
  },
  warn(message: string, meta?: unknown): void {
    console.warn(format('WARN', message, meta));
  },
  error(message: string, meta?: unknown): void {
    console.error(format('ERROR', message, meta));
  },
  debug(message: string, meta?: unknown): void {
    console.debug(format('DEBUG', message, meta));
  },
};
