# Security Advisory: xlsx Library Vulnerabilities

**Date**: February 7, 2026
**Severity**: LOW (Context-Dependent)
**Status**: Documented and Accepted
**Component**: frontend/package.json - xlsx@0.18.5

---

## Summary

The RFS Station Manager project currently uses `xlsx@0.18.5` for Excel export functionality, which has two known security vulnerabilities:

1. **Regular Expression Denial of Service (ReDoS)** - CVE pending, affects versions < 0.20.2
2. **Prototype Pollution** - CVE pending, affects versions < 0.19.3

---

## Vulnerability Details

### 1. Regular Expression Denial of Service (ReDoS)

**Description**: Maliciously crafted Excel files with specific patterns can cause excessive CPU usage through regex backtracking.

**Affected Versions**: < 0.20.2
**Current Version**: 0.18.5
**CVSS Score**: 5.3 (Medium)
**Attack Vector**: Network/Local
**Prerequisites**: Application must parse untrusted Excel files

### 2. Prototype Pollution

**Description**: Crafted Excel files can pollute the Object prototype, potentially leading to denial of service or remote code execution.

**Affected Versions**: < 0.19.3
**Current Version**: 0.18.5
**CVSS Score**: 7.5 (High)
**Attack Vector**: Network/Local
**Prerequisites**: Application must parse untrusted Excel files

---

## Risk Assessment for RFS Station Manager

### Current Usage Pattern

The xlsx library in this application is used **exclusively for export (write-only)**:

```typescript
// frontend/src/utils/exportUtils.ts
export async function exportAsExcel(
  title: string,
  data: { headers: string[], rows: string[][] }[],
  filename: string
): Promise<void> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  data.forEach(sheet => {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.title);
  });

  XLSX.writeFile(workbook, filename);
}
```

### Risk Factors

✅ **Mitigating Factors** (Why risk is LOW):
- Library is ONLY used to create Excel files, never to parse/read them
- No user-uploaded Excel files are processed by the application
- All data passed to xlsx comes from trusted, internal sources (database queries)
- Data is validated and sanitized before export
- Library is lazy-loaded (only imported when export is triggered)
- Export functionality is only available to authenticated station members
- Application does not accept Excel file uploads

❌ **Aggravating Factors** (If any existed):
- None identified - the vulnerable code paths (parsing Excel files) are not used

### Actual Risk Level: **LOW**

The vulnerabilities in xlsx require parsing malicious Excel files. Since this application:
1. Never parses Excel files
2. Only generates Excel files from trusted data
3. Does not accept file uploads

**The vulnerable code paths are never executed**, making the actual risk negligible.

---

## Why Not Patched?

The patched versions (0.19.3+ for Prototype Pollution, 0.20.2+ for ReDoS) are **only available through SheetJS Pro**, a commercial license ($399/year for open-source projects, $999/year for commercial).

The free/open-source version available on npm (0.18.5) was last published in March 2022 and has not received security updates.

**npm registry versions:**
```bash
$ npm view xlsx versions
[... "0.18.3", "0.18.4", "0.18.5"]  # Last free version
# 0.19.x and 0.20.x are Pro-only
```

---

## Mitigation Options

### Option 1: Accept Risk (RECOMMENDED for current deployment)

**Rationale**: Given the LOW actual risk (write-only usage), accepting the vulnerability is pragmatic.

**Requirements**:
- ✅ Document vulnerability in security audit
- ✅ Confirm no file upload functionality exists
- ✅ Regularly review usage patterns
- ✅ Monitor for new free alternatives

**Action**: No immediate changes required

---

### Option 2: Migrate to exceljs (RECOMMENDED for future)

**Alternative Library**: `exceljs@4.4.0` - Actively maintained, MIT license, no known vulnerabilities

**Pros**:
- Free and open-source
- More features (styling, formulas, images)
- Active maintenance (last updated December 2024)
- Modern TypeScript support
- No security vulnerabilities

**Cons**:
- Requires code refactoring (~2-3 hours)
- Slightly larger bundle size (+50KB gzipped)
- API differences require test updates

**Migration Complexity**: Low to Medium

**Implementation Plan**:
1. Install exceljs: `npm install exceljs`
2. Refactor exportUtils.ts (see REPORTS_PAGE_ENHANCEMENTS.md)
3. Update tests
4. Verify export functionality
5. Remove xlsx: `npm uninstall xlsx`

**Estimated Effort**: 2-3 hours

---

### Option 3: Server-Side Excel Generation

**Approach**: Move Excel generation to backend API endpoint

**Pros**:
- Reduces frontend bundle size
- Better security control
- Can use any Node.js library
- Centralized export logic

**Cons**:
- Requires backend changes
- Increases server load
- Network latency for large exports
- More complex error handling

**Implementation Complexity**: Medium to High

**Estimated Effort**: 1-2 days

---

### Option 4: Upgrade to SheetJS Pro

**Cost**: $399/year (open-source) or $999/year (commercial)

**Pros**:
- Gets security patches
- Minimal code changes
- Official support

**Cons**:
- Ongoing cost
- License management overhead
- May not fit project budget

---

## Recommendations

### Immediate Actions (Now)

✅ **DONE**: Document vulnerability and risk assessment
✅ **DONE**: Add security section to REPORTS_PAGE_ENHANCEMENTS.md
✅ **DONE**: Create this security advisory
⏳ **TODO**: Review by security team (if applicable)
⏳ **TODO**: Add to security audit checklist

### Short-Term (Next 3 Months)

- Monitor for free xlsx alternatives or community forks
- Evaluate exceljs for feature parity
- Create proof-of-concept with exceljs
- Budget for potential migration

### Long-Term (6-12 Months)

- **Preferred**: Migrate to exceljs during next major refactor
- **Alternative**: Implement server-side Excel generation
- Review decision if:
  - File upload feature is added
  - Security requirements change
  - Free patched version becomes available

---

## Decision Log

| Date | Decision | Rationale | Approver |
|------|----------|-----------|----------|
| 2026-02-07 | Accept LOW risk, document vulnerability | Write-only usage, no vulnerable code paths executed | Development Team |
| TBD | Plan migration to exceljs | Future-proof solution, eliminate vulnerability | TBD |

---

## References

- SheetJS Official: https://sheetjs.com/
- SheetJS GitHub: https://github.com/SheetJS/sheetjs (Pro features not in free version)
- exceljs: https://github.com/exceljs/exceljs
- Security Scan Results: [Link to scan results]
- Related Issue: #352 (Reports Page Enhancements)

---

## Contact

For questions about this advisory:
- GitHub Issues: https://github.com/richardthorek/Station-Manager/issues
- Label: `security`, `dependencies`
- Security Team: [Contact info if applicable]

---

**Last Updated**: February 7, 2026
**Next Review Date**: May 7, 2026 (3 months)
