# Pull Request

## Description
<!-- Provide a clear and concise description of the changes in this PR -->


## Type of Change
<!-- Mark the relevant option with an [x] -->
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement
- [ ] CI/CD or build configuration change

## Related Issues
<!-- Link to related issues, e.g., "Fixes #123" or "Relates to #456" -->


## Changes Made
<!-- List the specific changes made in this PR -->
- 
- 
- 

## Testing Performed
<!-- Describe the testing you've done -->
- [ ] Manual testing completed
- [ ] Existing tests pass
- [ ] New tests added (if applicable)
- [ ] Tested on multiple devices/browsers (if UI change)

### Test Details:
<!-- Provide specifics about your testing -->


## Screenshots (if applicable)
<!-- Add screenshots for UI changes -->


## Documentation Updates Checklist

**REQUIRED**: All PRs must update relevant documentation. Check all that apply:

### Planning & Roadmap
- [ ] **Updated `/docs/MASTER_PLAN.md`** (if this PR affects roadmap, features, technical debt, or strategic direction)
  - [ ] Marked feature as complete in backlog
  - [ ] Updated technical debt register
  - [ ] Added new items to enhancement backlog
  - [ ] Modified priority or timeline
  - [ ] N/A - No planning changes

### Implementation Documentation
- [ ] **Updated `/docs/AS_BUILT.md`** and related docs (if this PR changes architecture, APIs, database, or deployment)
  - [ ] Updated architecture diagrams/descriptions
  - [ ] Updated API endpoint counts and summaries
  - [ ] Updated database schema documentation
  - [ ] Updated deployment configuration docs
  - [ ] N/A - No implementation documentation changes

### Machine-Readable Registries
- [ ] **Updated `/docs/api_register.json`** (if this PR adds/modifies/removes REST endpoints or WebSocket events)
  - [ ] Added new endpoint definitions with full schema
  - [ ] Updated existing endpoint parameters/responses
  - [ ] Removed deprecated endpoints
  - [ ] Updated Socket.io event definitions
  - [ ] Validated JSON syntax with `jsonlint`
  - [ ] N/A - No API changes

- [ ] **Updated `/docs/function_register.json`** (if this PR adds/modifies backend functions or services)
  - [ ] Added new function signatures
  - [ ] Updated existing method parameters/return types
  - [ ] Updated implementation file locations
  - [ ] Documented new service methods
  - [ ] Validated JSON syntax with `jsonlint`
  - [ ] N/A - No function signature changes

### Development Guidelines
- [ ] **Updated `.github/copilot-instructions.md`** (if this PR introduces new conventions, workflows, or standards)
  - [ ] Documented new coding conventions
  - [ ] Updated project structure rules
  - [ ] Modified development workflow
  - [ ] Changed deployment procedures
  - [ ] Added new tooling requirements
  - [ ] N/A - No procedural changes

### Feature Documentation
- [ ] **Updated feature-specific docs** (if applicable)
  - [ ] Updated `docs/API_DOCUMENTATION.md`
  - [ ] Updated `docs/FEATURE_DEVELOPMENT_GUIDE.md`
  - [ ] Updated `docs/GETTING_STARTED.md`
  - [ ] Updated other relevant markdown docs
  - [ ] N/A - No feature documentation changes

## Cross-Reference Validation
- [ ] All documentation cross-references are valid and up-to-date
- [ ] Machine-readable JSON files reference correct implementation locations
- [ ] Links between MASTER_PLAN.md, AS_BUILT.md, and copilot-instructions.md are maintained

## Code Quality Checklist
- [ ] Code follows the project's style guidelines (see `.github/copilot-instructions.md`)
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] Proper error handling implemented
- [ ] No console.log statements in production code (use proper logging)
- [ ] Component and function names follow naming conventions
- [ ] CSS follows BEM-like naming conventions
- [ ] Comments added where necessary (complex logic only)

## NSW RFS Branding Compliance (for UI changes)
- [ ] Uses official RFS colors from CSS variables
- [ ] Touch targets are minimum 60px (kiosk-friendly)
- [ ] Responsive design (mobile-first)
- [ ] High contrast for visibility
- [ ] Accessibility requirements met (ARIA labels, keyboard navigation)
- [ ] N/A - No UI changes

## Security Checklist
- [ ] No sensitive data exposed in code or logs
- [ ] Input validation implemented
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities
- [ ] Dependencies checked for vulnerabilities (`npm audit`)
- [ ] Authentication/authorization respected (if applicable)

## Performance Checklist (for relevant changes)
- [ ] No unnecessary re-renders (React.memo, useMemo, useCallback used appropriately)
- [ ] Database queries optimized
- [ ] Large lists use virtual scrolling or pagination
- [ ] Images optimized and compressed
- [ ] Bundle size impact considered

## Deployment Checklist
- [ ] Changes work in both development and production environments
- [ ] Environment variables documented (if new ones added)
- [ ] Database migrations documented (if schema changed)
- [ ] Backward compatibility maintained (or breaking changes documented)
- [ ] CI/CD pipeline passes

## Reviewer Guidance
<!-- Any specific areas you'd like reviewers to focus on? -->


## Post-Merge Actions
<!-- Any actions required after merging? -->
- [ ] Update staging environment
- [ ] Notify team of changes
- [ ] Monitor production for issues
- [ ] Other: _______________

---

## For AI/Copilot Generated PRs

If this PR was generated or assisted by AI tools:
- [ ] All generated code has been reviewed by a human
- [ ] AI suggestions align with project conventions in `.github/copilot-instructions.md`
- [ ] Documentation updates were completed as required
- [ ] Machine-readable registries were validated
- [ ] Cross-references were checked

---

**By submitting this PR, I confirm that:**
- I have followed the documentation discipline outlined in `.github/copilot-instructions.md`
- I have updated all required documentation files
- I have validated machine-readable JSON files
- I have maintained cross-references between documentation files
- This PR respects the single source of truth principle for planning and as-built docs
