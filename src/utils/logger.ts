/**
 * Minimal logger wrapper. Swap for pino/winston later if you want structured logs.
 */
export const logger = {
  info: (...args: unknown[]) => console.log('[job-discovery]', ...args),
  warn: (...args: unknown[]) => console.warn('[job-discovery]', ...args),
  error: (...args: unknown[]) => console.error('[job-discovery]', ...args),
};
