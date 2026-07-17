/**
 * PNG Chart Export Utility
 *
 * Split out of exportUtils.ts (Q20) so a PNG chart export only pulls
 * html2canvas, not jsPDF/ExcelJS too.
 */

import html2canvas from 'html2canvas';

/**
 * Export chart as PNG image
 */
export async function exportChartAsPNG(
  elementId: string,
  filename: string
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2,
  });

  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  });
}

/**
 * Export all charts on page as PNG
 */
export async function exportAllChartsAsPNG(
  chartElements: Array<{ id: string; name: string }>
): Promise<void> {
  for (const chart of chartElements) {
    try {
      await exportChartAsPNG(chart.id, chart.name);
      // Add small delay between exports
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to export chart ${chart.name}:`, error);
    }
  }
}
