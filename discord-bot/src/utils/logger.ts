// ══════════════════════════════════════════════════════════════
//  Opus System Bot V2 — Console Logger
//  Clean text-based symbols, no Unicode emojis
// ══════════════════════════════════════════════════════════════

const timestamp = () => new Date().toLocaleTimeString("en-US", { hour12: false });

export const Logger = {
  info: (msg: string) => console.log(`\x1b[36m[${timestamp()}] [INFO]  ${msg}\x1b[0m`),
  success: (msg: string) => console.log(`\x1b[32m[${timestamp()}] [OK]    ${msg}\x1b[0m`),
  warn: (msg: string) => console.log(`\x1b[33m[${timestamp()}] [WARN]  ${msg}\x1b[0m`),
  error: (msg: string) => console.log(`\x1b[31m[${timestamp()}] [ERR]   ${msg}\x1b[0m`),
  command: (msg: string) => console.log(`\x1b[35m[${timestamp()}] [CMD]   ${msg}\x1b[0m`),
  event: (msg: string) => console.log(`\x1b[34m[${timestamp()}] [EVT]   ${msg}\x1b[0m`),
  filter: (msg: string) => console.log(`\x1b[91m[${timestamp()}] [FLT]   ${msg}\x1b[0m`),
  divider: () => console.log(`\x1b[90m${"=".repeat(55)}\x1b[0m`),
};
