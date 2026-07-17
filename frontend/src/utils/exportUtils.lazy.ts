/**
 * Lazy-loaded Export Utilities Wrapper
 *
 * This file provides a lazy-loading wrapper around the heavy export utilities
 * (jsPDF, ExcelJS, html2canvas) to avoid loading them in the initial bundle.
 * The actual export functions are only loaded when the user attempts to export.
 *
 * Q20 (2026-07-17): each format is dynamically imported from its own module
 * (exportUtils.pdf/.excel/.png.ts, each with only that format's static
 * imports) so choosing one export format doesn't also pull the other two
 * formats' libraries — previously all three lived in one exportUtils.ts,
 * so a CSV/PDF/PNG export downloaded all of jsPDF+ExcelJS+html2canvas
 * together regardless of which one was actually used.
 *
 * Bundle size impact:
 * - Without lazy loading: ~1.5 MB (452 KB gzipped) loaded upfront
 * - With lazy loading + per-format split: only the chosen format's library
 *   (plus html2canvas, shared by PDF/PNG) loads when that export is used
 */

/**
 * Lazy load and execute PDF export
 */
export async function exportAsPDF(
  title: string,
  data: {
    kpis?: Array<{ label: string; value: string }>;
    tables?: Array<{ title: string; headers: string[]; rows: string[][] }>;
    charts?: Array<{ title: string; elementId: string }>;
  },
  options: {
    dateRange?: string;
    stationName?: string;
  } = {}
): Promise<void> {
  const { exportAsPDF: exportAsPDFImpl } = await import('./exportUtils.pdf');
  return exportAsPDFImpl(title, data, options);
}

/**
 * Lazy load and execute Excel export
 */
export async function exportAsExcel(
  filename: string,
  sheets: Array<{
    name: string;
    data: Array<Record<string, string | number | boolean | null | undefined>>;
  }>
): Promise<void> {
  const { exportAsExcel: exportAsExcelImpl } = await import('./exportUtils.excel');
  return exportAsExcelImpl(filename, sheets);
}

/**
 * Lazy load and execute PNG chart export
 */
export async function exportAllChartsAsPNG(
  chartElements: Array<{ id: string; name: string }>
): Promise<void> {
  const { exportAllChartsAsPNG: exportAllChartsAsPNGImpl } = await import('./exportUtils.png');
  return exportAllChartsAsPNGImpl(chartElements);
}
