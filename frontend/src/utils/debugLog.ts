/**
 * Dev-only diagnostic logging (Q18). `import.meta.env.DEV` is statically
 * inlined to `false` in production builds, so Vite/Rolldown dead-code-
 * eliminates the branch entirely — these calls ship in dev but not in the
 * production bundle (kiosk consoles no longer fill with socket-join/offline-
 * sync chatter). `console.warn`/`console.error` are unaffected — call them
 * directly, they should always ship.
 */
export function debugLog(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
