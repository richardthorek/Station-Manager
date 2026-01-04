# Changelog

All notable changes to the RFS Station Manager project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Migrated from Azure Cosmos DB (MongoDB API) to Azure Table Storage for production database
  - 70-95% cost savings achieved ($6-34/year per station)
  - All MongoDB/Cosmos DB code and dependencies removed from codebase
  - `MONGODB_URI` environment variable no longer used
  - Database now selected via `USE_TABLE_STORAGE=true` + `AZURE_STORAGE_CONNECTION_STRING`
  - In-memory database used for development when no Azure connection string provided
  - GitHub Actions CI now uses `copilot` environment for accessing Table Storage secrets

### Removed
- MongoDB driver dependency (`mongodb@6.10.0`)
- MongoDB database service implementations (`mongoDatabase.ts`, `mongoTruckChecksDatabase.ts`)
- All references to Cosmos DB and MongoDB from documentation
- `MONGODB_URI` configuration from environment examples

### Fixed
- TypeScript compilation errors related to database type enums (added `'table-storage'` type)
- Database factory logic to prevent Table Storage instantiation without connection string

### Documentation
- Updated all architecture diagrams to reflect Table Storage as sole persistent database
- Marked Table Storage migration as complete in MASTER_PLAN.md
- Updated AS_BUILT.md with current production architecture
- Updated API and function registries to remove MongoDB references
- Added completion summary to TABLE_STORAGE_MIGRATION_PLAN.md

## [1.0.0] - 2026-01-01

### Added
- Initial production release
- Member check-in/check-out system
- Activity tracking
- Event management
- Truck checks feature
- Achievement system
- Real-time synchronization via WebSockets
- QR code support
- Azure deployment configuration
- Comprehensive API testing (45 tests)

### Technical
- React 19 + TypeScript frontend
- Node.js 22 + Express 5 backend
- Socket.io for real-time updates
- Azure Table Storage database (production)
- Azure Blob Storage for images
- In-memory database (development)
