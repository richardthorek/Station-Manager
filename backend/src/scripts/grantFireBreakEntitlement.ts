/**
 * One-off backfill: grant the fireBreakEnabled suite entitlement to existing
 * organizations whose plan now includes it (Basic and AI Pro).
 *
 * Stored entitlements are a snapshot taken at org creation / plan change, so a
 * plan-catalog change alone does not reach existing subscribers. Before this
 * change no plan granted fireBreakEnabled — clampEntitlements forced it to
 * false — so a stored `false` cannot represent an owner's choice to disable
 * it. That makes re-deriving the flag from the plan default safe here.
 *
 * Usage (against prod Table Storage):
 *   DRY_RUN=false NODE_ENV=production ts-node src/scripts/grantFireBreakEntitlement.ts
 *
 * DRY_RUN defaults to true: it prints what would change without writing.
 * Requires AZURE_STORAGE_CONNECTION_STRING (+ USE_TABLE_STORAGE=true) to hit
 * the production store; otherwise it runs against the in-memory DB (no-op).
 */

import dotenv from 'dotenv';
import { ensureOrganizationDatabase } from '../services/organizationDbFactory';
import { PLANS, clampEntitlements } from '../constants/plans';

dotenv.config();

async function grantFireBreakEntitlement(): Promise<void> {
  const dryRun = (process.env.DRY_RUN || 'true').toLowerCase() !== 'false';
  console.log(`\nGrant fireBreakEnabled from plan defaults — dry run: ${dryRun}\n`);

  const orgDb = ensureOrganizationDatabase();
  const orgs = await orgDb.getAllOrganizations();

  let updated = 0;
  for (const org of orgs) {
    const planDefault = PLANS[org.planCode].entitlements.fireBreakEnabled;
    if (org.entitlements.fireBreakEnabled === planDefault) continue;

    const next = clampEntitlements(org.planCode, {
      ...org.entitlements,
      fireBreakEnabled: planDefault,
    });

    console.log(
      `- ${org.slug} (${org.planCode}): fireBreakEnabled ${org.entitlements.fireBreakEnabled} → ${next.fireBreakEnabled}`
    );

    if (!dryRun) {
      await orgDb.updateOrganization(org.id, { entitlements: next });
    }
    updated += 1;
  }

  console.log(`\n${orgs.length} organizations scanned; ${updated} ${dryRun ? 'would be' : ''} updated.`);
  if (dryRun && updated > 0) {
    console.log('Re-run with DRY_RUN=false to apply.');
  }
}

grantFireBreakEntitlement().catch((err) => {
  console.error('Backfill failed:', err);
  process.exitCode = 1;
});
