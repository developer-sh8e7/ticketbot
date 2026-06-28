export const logger = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] [INFO] ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] [ERROR] ${msg}`),
  warn: (msg: string) => console.warn(`[${new Date().toISOString()}] [WARN] ${msg}`),
  success: (msg: string) => console.log(`[${new Date().toISOString()}] [SUCCESS] ${msg}`),
};
