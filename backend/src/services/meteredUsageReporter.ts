/**
 * Stripe metered-usage reporter.
 *
 * Batches AI usage and reports it to Stripe metered billing on a timer (hourly,
 * not per-call) so the user-facing AI path never blocks on a Stripe round-trip.
 *
 * This is intentionally conservative: it only sends usage when BOTH a Stripe
 * key and a metered price/meter are configured. Until the metered price is wired
 * up (see docs/wiki/developer/history/archive/SAAS_COMMERCIALIZATION_DESIGN.md §7b), it is a safe no-op that
 * leaves rows unreported so nothing is lost.
 */

import { logger } from './logger';
import { ensureUsageDatabase } from './usageDbFactory';
import { isStripeConfigured } from './stripeClient';

const HOUR_MS = 60 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;

function meteredEnabled(): boolean {
  // Requires explicit opt-in AND a configured Stripe meter event name.
  return (
    process.env.STRIPE_METERED_USAGE_ENABLED === 'true' &&
    isStripeConfigured() &&
    Boolean(process.env.STRIPE_AI_METER_EVENT)
  );
}

/**
 * Report one batch of unreported usage to Stripe metered billing.
 * Returns the number of rows reported. Exposed for tests/manual runs.
 */
export async function reportMeteredUsageOnce(): Promise<number> {
  if (!meteredEnabled()) {
    logger.debug('Metered usage reporting is disabled or unconfigured; skipping');
    return 0;
  }

  const db = ensureUsageDatabase();
  const rows = await db.listUnreported();
  if (!rows.length) return 0;

  // Aggregate billable sessions per org (speech == one session).
  const sessionsByOrg = new Map<string, number>();
  const reportedIds: string[] = [];
  for (const row of rows) {
    if (row.type === 'speech') {
      sessionsByOrg.set(row.organizationId, (sessionsByOrg.get(row.organizationId) ?? 0) + row.units);
    }
    reportedIds.push(row.id);
  }

  try {
    const { getStripeClient } = await import('./stripeClient');
    const stripe = getStripeClient();
    const eventName = process.env.STRIPE_AI_METER_EVENT as string;
    for (const [organizationId, sessions] of sessionsByOrg) {
      if (sessions <= 0) continue;
      await stripe.billing.meterEvents.create({
        event_name: eventName,
        payload: { value: String(sessions), stripe_customer_id: organizationId },
      });
    }
    await db.markReported(reportedIds);
    logger.info('Reported AI usage to Stripe metered billing', {
      orgs: sessionsByOrg.size,
      rows: reportedIds.length,
    });
    return reportedIds.length;
  } catch (error) {
    // Leave rows unreported so the next tick retries.
    logger.error('Failed to report metered usage to Stripe', { error });
    return 0;
  }
}

/** Start the hourly reporter. No-op in tests and when metered billing is off. */
export function startMeteredUsageReporter(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (timer) return;
  if (!meteredEnabled()) {
    logger.info('Metered usage reporter not started (disabled or unconfigured)');
    return;
  }
  timer = setInterval(() => {
    reportMeteredUsageOnce().catch((error) => logger.error('Metered usage tick failed', { error }));
  }, HOUR_MS);
  // Don't keep the event loop alive solely for this timer.
  timer.unref?.();
  logger.info('Metered usage reporter started (hourly)');
}

/** Stop the reporter (used by graceful shutdown / tests). */
export function stopMeteredUsageReporter(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
