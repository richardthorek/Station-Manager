/**
 * Shared CORS/origin allowlist, parsed once from FRONTEND_URLS/FRONTEND_URL.
 *
 * Lives in its own zero-dependency module so both `index.ts` (Express CORS +
 * Socket.io) and `routes/agentCheck.ts` (the raw WS upgrade handler) can apply
 * the same origin policy without a circular import between them — `index.ts`
 * calls `attachAgentCheckWs()` synchronously at its own module top level, so
 * agentCheck.ts importing anything back from `../index` risks a
 * temporal-dead-zone error on whichever of the two modules loads first.
 */
export const allowedOriginsList = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim())
  .filter((url) => url.length > 0);
