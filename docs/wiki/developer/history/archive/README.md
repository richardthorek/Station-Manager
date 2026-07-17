# Archived Documentation

This directory contains historical documentation files that were created during the development and deployment process. These files are kept for reference but are no longer actively maintained.

## Purpose

The archive stores **completed implementation summaries**, **superseded technical documents**, and **historical reviews** that:
- Document the evolution of the project
- Provide context for past decisions
- Serve as reference for similar future work
- Preserve institutional knowledge

Documents are moved here when they are no longer current, have been superseded by newer documentation, or describe completed features.

## Contents

### Superseded Planning & Design Spikes (folded into MASTER_PLAN, June 2026)

These were standalone planning/design documents. Per the "one plan" policy, their
forward work was consolidated into the **Consolidation & Standardisation Roadmap**
in [`docs/MASTER_PLAN.md`](../../../../MASTER_PLAN.md). They remain here for their detailed
design content (schemas, pricing analysis, tool contracts) as reference only — they
are **not** live plans.
- **CONSOLIDATION_REVIEW.md** - cross-app coherence analysis, AI-gateway direction
- **SUITE_INTEGRATION_PLAN.md** - "Bushie Tools" suite federation/monorepo options
- **SAAS_COMMERCIALIZATION_DESIGN.md** - pricing analysis, Stripe surface, tenancy schema deltas
- **AI_MAINTENANCE_AGENT_DESIGN.md** - voice/vision truck-maintenance agent schema & tool contract
- **AAR_STUDIO_PLAN.md** - AAR Studio stage plan (architecture of record stays in `aar-studio/docs/ARCHITECTURE.md`)

### Completed Feature Implementation Summaries (2024-2026)

**Admin & User Management:**
- **ADMIN_MODERNIZATION_SUMMARY.md** - Admin interface modernization (completed)
- **ADMIN_MODERNIZATION_VISUAL_GUIDE.md** - Visual guide for admin updates
- **MEMBERSHIP_START_DATE_IMPLEMENTATION.md** - Membership date tracking feature
- **PROFILE_POLISH_CHECKLIST.md** - Profile page enhancements checklist
- **IMPLEMENTATION_SUMMARY.md** - General implementation summary

**Cross-Station Features (Issue #19):**
- **ISSUE_19H_IMPLEMENTATION_SUMMARY.md** - Cross-Station Reporting Dashboard (completed Jan 2026)
- **ISSUE_19I_IMPLEMENTATION_SUMMARY.md** - Demo Station Features (completed Jan 2026)
- **ISSUE_19E_COMPLETION_SUMMARY.md** - Station Selection Feature (completed)
- **STATION_SELECTION_IMPLEMENTATION.md** - Detailed station selection implementation

**Performance & Mobile Optimization:**
- **PWA_IMPLEMENTATION_SUMMARY.md** - Progressive Web App with offline support (completed Feb 6, 2026)
- **BUNDLE_OPTIMIZATION.md** - Bundle size optimization implementation
- **BUNDLE_OPTIMIZATION_SUMMARY.md** - Bundle optimization summary
- **bundle-optimization-summary.md** - Duplicate of above (lowercase variant)
- **COMPRESSION_IMPLEMENTATION_SUMMARY.md** - Response compression implementation (completed Feb 6, 2026)
- **MOBILE_TOUCH_IMPLEMENTATION.md** - Mobile touch interactions (completed Feb 2026)

**UI/UX Enhancements:**
- **UI_REFACTOR_MEMBER_FILTER_SORT.md** - Member list filtering and sorting (completed Feb 6, 2026)
- **IMPLEMENTATION_USER_FRIENDLY_ERRORS.md** - User-friendly error messages (completed Feb 7, 2026)
- **REPORTS_PAGE_ENHANCEMENTS.md** - Reports page improvements (completed Feb 2026)

**Vehicle Checks:**
- **TRUCK_CHECKS_IMPLEMENTATION.md** - Truck checks feature implementation (completed)
- **ONBOARDING_WIZARD_TESTING.md** - Testing guide for onboarding wizard

### Historical Storage Analysis & Migration (Superseded - Migration Completed Jan 2026)

**Storage Analysis Documents:**
- **STORAGE_ANALYSIS.md** - Initial storage solution analysis
- **STORAGE_ANALYSIS_NO_FREE_TIER.md** - Analysis variant without free tier consideration
- **STORAGE_ANALYSIS_README.md** - Index for storage analysis documents
- **STORAGE_RECOMMENDATION_NO_FREE_TIER.md** - Storage recommendation (superseded)
- **STORAGE_RECOMMENDATION_SUMMARY.md** - Recommendation summary (superseded)
- **STORAGE_DECISION_AZURE_COSTS_ONLY.md** - Detailed cost analysis (superseded)
- **FINAL_STORAGE_DECISION.md** - Final decision document (superseded by completion)

**Migration Documents:**
- **TABLE_STORAGE_MIGRATION_PLAN.md** - Azure Table Storage migration plan (completed Jan 2026)
- **TABLE_STORAGE_MIGRATION_PROGRESS.md** - Historical progress tracking
- **TABLE_STORAGE_DEPLOYMENT_CHECKLIST.md** - Cosmos→Table Storage cutover checklist (completed; archived June 2026)
- **COSMOS_DB_OPTIMIZATION_GUIDE.md** - Cosmos DB RU/cost optimization (superseded by the Table Storage migration; archived June 2026)

**Note:** These documents describe analysis and planning for migrating to Azure Table Storage. The migration was successfully completed in January 2026. For current storage implementation, see [architecture.md](../../architecture.md).

### Historical Deployment Guides (Superseded)

- **DEPLOYMENT_SUMMARY.md** - Initial Azure deployment implementation (Nov 2024)
- **DEPLOYMENT_FIX.md** - Deployment workflow fixes
- **PRODUCTION_DATABASE_FIX.md** - Production database connectivity fixes
- **AZURE_RESOURCE_CONFIGURATION.md** - Initial Azure resource configuration
- **deployment-optimization.md** - v2.0 "pre-install node_modules" deploy strategy, written when prod was still Windows/IIS (archived 2026-07-17, Q6 — the strategy and OS it describes are both superseded)

**Note:** For current deployment procedures, see [deployment.md](../../deployment.md).

### Project Reviews & Summaries

**Point-in-Time Reports:**
- **PROJECT_REVIEW_EXECUTIVE_SUMMARY.md** - Executive summary of February 2026 review
- **PROJECT_REVIEW_FEBRUARY_2026.md** - Comprehensive project review (Feb 2026)
- **AUDIT_SUMMARY.md** - Audit summary from Feb 7, 2026
- **FINAL_SUMMARY.md** - Final summary report from current_state
- **audit-20260207.md** - Detailed audit from Feb 7, 2026
- **VALIDATION_REPORT.md** - Validation report from current_state
- **REPRODUCTION_TESTS.md** - Test reproduction documentation

**Historical Planning:**
- **PROJECT_PLAN.md** - Historical project plan (superseded by MASTER_PLAN.md)
- **REVIEW_REPORT.md** - Historical review report

### Resolved Fixes & Code Audits (archived June 2026)

Point-in-time fix write-ups and code audits whose work is complete and merged:
- **ADMIN_LOGIN_FIX_DEPLOYMENT_GUIDE.md** - Admin login 401 fix (resolved)
- **AZURE_DEPLOYMENT_FIX_SUMMARY.md** - Azure deployment startup fixes (resolved)
- **CI_FIX_SUMMARY.md** - CI/CD pipeline timeout fix (resolved)
- **VISUAL_FEEDBACK_SUMMARY.md** - Sign in/out visual feedback implementation (completed)
- **CODE_HYGIENE_REVIEW_2025-11.md** - Point-in-time code hygiene review (Nov 2025)
- **CODE_QUALITY_AUDIT_SUMMARY.md** - Code quality audit completion report (Jan 2026)

## Current Documentation

For current, up-to-date documentation, please refer to:

### Core Documents
- [MASTER_PLAN.md](../../../../MASTER_PLAN.md) - **Single source of truth** for planning and roadmap
- [architecture.md](../../architecture.md) - Current system architecture and implementation
- [api-reference.md](../../api-reference.md) - API reference documentation

### Guides
- [getting-started.md](../../getting-started.md) - Local development setup
- [feature-development.md](../../feature-development.md) - How to add features
- [deployment.md](../../deployment.md) - Current deployment guide

### Implementation Notes
- [implementation-notes/](../implementation-notes/) - Detailed technical references and configuration guides

### Active Features
- [achievements.md](../../../user-guide/achievements.md) - Gamification system documentation
- [keyboard-shortcuts.md](../../../user-guide/keyboard-shortcuts.md) - User keyboard shortcuts
- [screen-reader-guide.md](../../../user-guide/screen-reader-guide.md) - Accessibility user guide

## Why Are These Archived?

These documents served their purpose during development but:
- Describe **completed features** - implementation work is done, summary preserved for reference
- Contain **superseded information** - newer documentation or implementation has replaced them
- Document **resolved issues** - problems that have been fixed
- Represent **historical decisions** - decisions made, implementation completed
- Are **point-in-time snapshots** - captured state at a specific date, not continuously updated

## Archive Policy

Documents are moved to archive when:
1. **Feature implementation is complete** (within 1 week of completion)
2. **Analysis or planning is superseded** (e.g., migration completed, analysis no longer needed)
3. **Review reports are older than 3 months** (moved quarterly)
4. **Deployment guides are replaced** by newer versions in root docs

Documents should **NOT** be deleted from archive unless they are exact duplicates or contain no useful information.

## When to Reference Archived Documents

Reference archived documents when:
- Researching how a feature was originally implemented
- Understanding the rationale behind past technical decisions
- Looking for implementation patterns for similar new features
- Investigating historical issues or bugs
- Training new team members on project evolution

## Restoring Documents from Archive

If an archived document becomes relevant again:
1. **Update the document** with current information
2. **Move it back to root `/docs/`** or appropriate subdirectory
3. **Update MASTER_PLAN.md** to reflect the document's active status
4. **Update this README** to remove the entry

Do not restore documents without updating them first - archived documents may contain outdated information.

---

**Last Updated:** June 20, 2026  
**Archive Established:** November 2025  
**Maintained By:** Development team via AI-assisted development process

