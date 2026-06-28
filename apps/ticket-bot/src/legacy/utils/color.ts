export function hexToDecimal(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}
