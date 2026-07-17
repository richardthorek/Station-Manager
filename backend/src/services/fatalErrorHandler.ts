/**
 * Process-level crash handling (review F3 / MASTER_PLAN Q30).
 *
 * Without `process.on('uncaughtException'|'unhandledRejection')`, a single
 * un-awaited rejection in an async socket/route handler crashes the one App
 * Service instance with no logged reason and no telemetry flush — a full
 * outage with a silent cause. Node's post-exception process state is
 * undefined, so the correct response is to log, flush pending telemetry, and
 * exit — never attempt to keep serving requests — so the platform restarts a
 * known-good process. Exit code 1 (a crash), distinct from SIGTERM/SIGINT's
 * graceful exit 0 in index.ts.
 *
 * Extracted into its own module (rather than inlined in index.ts, which
 * self-executes on import and isn't otherwise unit-testable) so the actual
 * log/flush/exit behaviour can be exercised directly.
 */

import { logger } from './logger';

export type FatalErrorSource = 'uncaughtException' | 'unhandledRejection';

/**
 * Handle a fatal process-level error: log it, flush Application Insights,
 * then exit. `exit` and `flushAppInsights` are injected so tests can observe
 * the behaviour without actually terminating the process.
 */
export function handleFatalProcessError(
  source: FatalErrorSource,
  error: unknown,
  flushAppInsights: (callback?: () => void) => void,
  exit: (code: number) => void
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;

  logger.error(`Fatal ${source} — exiting for restart`, { source, error: message, stack });

  flushAppInsights(() => {
    exit(1);
  });
}
