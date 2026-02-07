/**
 * Lazy-loaded Export Utilities Wrapper
 *
 * This file provides a lazy-loading wrapper around the heavy export utilities
 * (jsPDF, ExcelJS, html2canvas) to avoid loading them in the initial bundle.
 * The actual export functions are only loaded when the user attempts to export.
 *
 * Bundle size impact:
 * - Without lazy loading: ~1.5 MB (452 KB gzipped) loaded upfront
 * - With lazy loading: Only loaded when export features are used
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
  // Dynamically import the actual implementation only when needed
  const { exportAsPDF: exportAsPDFImpl } = await import('./exportUtils');
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
  const { exportAsExcel: exportAsExcelImpl } = await import('./exportUtils');
  return exportAsExcelImpl(filename, sheets);
}

/**
 * Lazy load and execute PNG chart export
 */
export async function exportAllChartsAsPNG(
  chartElements: Array<{ id: string; name: string }>
): Promise<void> {
  const { exportAllChartsAsPNG: exportAllChartsAsPNGImpl } = await import('./exportUtils');
  return exportAllChartsAsPNGImpl(chartElements);
}
