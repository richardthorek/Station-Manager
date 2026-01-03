# Machine-Readable API and Function Registries

This directory contains machine-readable JSON files that provide structured, programmatically-accessible definitions of the RFS Station Manager's APIs and backend functions.

## Files

### `api_register.json`
**Purpose**: Complete registry of REST API endpoints and WebSocket events

**Contents**:
- All REST API endpoints with full request/response schemas
- HTTP methods, paths, and parameters
- Request body schemas and validation rules
- Response status codes and schemas
- WebSocket event definitions and payloads
- TypeScript interface definitions
- Implementation file locations (file paths and line numbers)
- Authentication requirements
- Cross-references to related endpoints

**Use Cases**:
- Automated API documentation generation
- API client generation
- Integration testing automation
- API contract validation
- AI-assisted development (Copilot, autogen, etc.)
- API versioning and change tracking

### `function_register.json`
**Purpose**: Complete registry of backend functions, services, and business logic

**Contents**:
- Service method signatures with parameter types
- Database operation functions
- Business logic implementations
- Route handlers
- Utility functions
- Return types and descriptions
- Implementation file locations (file paths and line numbers)
- Complexity analysis (Big O notation)
- Side effects documentation
- Test coverage information

**Use Cases**:
- Automated function documentation generation
- Code navigation and IntelliSense enhancement
- Refactoring assistance
- Dependency analysis
- AI-assisted development
- API compatibility checking

## Validation

Run the validation script to ensure JSON files are valid and properly structured:

```bash
# From repository root
./scripts/validate-registries.sh
```

The script validates:
- JSON syntax correctness
- Required field presence
- Schema structure compliance

## Update Requirements

These files **MUST be updated** when:

### `api_register.json`:
- Adding, modifying, or removing REST API endpoints
- Changing request/response schemas
- Adding or modifying WebSocket events
- Updating endpoint authentication
- Changing HTTP methods or paths
- Modifying parameters or validation rules

### `function_register.json`:
- Adding new backend service methods or functions
- Modifying function signatures or parameters
- Changing return types
- Refactoring business logic organization
- Adding new database methods
- Moving functions to different files

## JSON Schema Format

Both files follow JSON Schema Draft 7 format for maximum compatibility and tooling support.

### Example: API Endpoint Definition
```json
{
  "endpoints": {
    "members": {
      "GET /api/members": {
        "method": "GET",
        "path": "/api/members",
        "description": "Get all members",
        "authentication": "none",
        "parameters": {},
        "responses": {
          "200": {
            "description": "Array of members",
            "schema": { 
              "type": "array", 
              "items": { "$ref": "#/definitions/Member" } 
            }
          }
        },
        "implementation": "backend/src/routes/members.ts:18"
      }
    }
  }
}
```

### Example: Function Definition
```json
{
  "services": {
    "database": {
      "methods": {
        "createMember": {
          "signature": "createMember(name: string): Member",
          "line": 219,
          "parameters": [
            { "name": "name", "type": "string", "description": "Member full name" }
          ],
          "returns": "Member",
          "complexity": "O(1)",
          "sideEffects": "Adds member to database, generates UUID and QR code"
        }
      }
    }
  }
}
```

## Integration with Documentation

These machine-readable registries are cross-referenced by:
- `AS_BUILT.md` - Links to registries for implementation details
- `MASTER_PLAN.md` - References for tracking API/function changes
- `.github/copilot-instructions.md` - AI development guidelines
- `API_DOCUMENTATION.md` - Human-readable API reference (derived from api_register.json)
- `FUNCTION_REGISTER.md` - Human-readable function reference (derived from function_register.json)

## CI/CD Integration

The validation script (`scripts/validate-registries.sh`) should be integrated into the CI/CD pipeline to ensure registry files are always valid before merging PRs.

**Recommended GitHub Actions workflow step**:
```yaml
- name: Validate Machine-Readable Registries
  run: ./scripts/validate-registries.sh
```

## Tools and Libraries

**For validation**:
- `jsonlint` - JSON syntax validation
- `ajv-cli` - JSON Schema validation
- Node.js built-in `JSON.parse()` - Quick validation

**For generation** (future enhancement):
- TypeScript AST parsers for automatic function extraction
- OpenAPI tools for API specification generation
- Custom scripts for syncing with implementation

## Versioning

Both files include a `version` field that follows semantic versioning:
- **Major version**: Breaking changes to API or function signatures
- **Minor version**: New endpoints or functions added
- **Patch version**: Documentation updates, fixes, or clarifications

Current versions:
- `api_register.json`: 1.0.0
- `function_register.json`: 1.0.0

## Best Practices

1. **Always validate** before committing changes
2. **Keep synchronized** with actual implementation
3. **Update line numbers** when moving code
4. **Document breaking changes** in version history
5. **Reference from human-readable docs** for discoverability
6. **Use $ref for shared definitions** to avoid duplication
7. **Include examples** in schema definitions when helpful
8. **Maintain backward compatibility** when possible

## Support

For questions or issues with machine-readable registries:
- Review `.github/copilot-instructions.md` for documentation discipline guidelines
- Check `MASTER_PLAN.md` for strategic direction
- Consult `AS_BUILT.md` for implementation details

---

**Last Updated**: January 2026  
**Maintained By**: Development team and AI assistants (Copilot, etc.)
