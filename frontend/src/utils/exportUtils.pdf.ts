/**
 * PDF Export Utility
 *
 * Split out of exportUtils.ts (Q20) so a PDF export doesn't also pull in
 * ExcelJS. Still needs html2canvas to rasterize embedded charts.
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Brand colors
const BRAND_COLORS = {
  red: '#e5281B',
  lime: '#F6A609',
  black: '#000000',
  white: '#ffffff',
  darkGrey: '#4d4d4f',
  lightGrey: '#bcbec0',
};

/**
 * Export report as a branded PDF.
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
    agencyName?: string;
  } = {}
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Add header
  pdf.setFillColor(BRAND_COLORS.red);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(BRAND_COLORS.white);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(options.agencyName || 'Station Manager', margin, 12);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  if (options.stationName) {
    pdf.text(options.stationName, margin, 19);
  }

  yPosition = 35;

  // Add report title
  pdf.setTextColor(BRAND_COLORS.black);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 8;

  // Add date range
  if (options.dateRange) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(BRAND_COLORS.darkGrey);
    pdf.text(`Report Period: ${options.dateRange}`, margin, yPosition);
    yPosition += 10;
  }

  // Add KPIs
  if (data.kpis && data.kpis.length > 0) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(BRAND_COLORS.black);
    pdf.text('Key Metrics', margin, yPosition);
    yPosition += 7;

    data.kpis.forEach((kpi) => {
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(BRAND_COLORS.darkGrey);
      pdf.text(`${kpi.label}:`, margin, yPosition);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(BRAND_COLORS.red);
      pdf.text(kpi.value, margin + 60, yPosition);

      yPosition += 6;
    });
    yPosition += 5;
  }

  // Add tables
  if (data.tables) {
    for (const table of data.tables) {
      if (yPosition > pageHeight - margin - 20) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(BRAND_COLORS.black);
      pdf.text(table.title, margin, yPosition);
      yPosition += 7;

      // Table headers
      const cellWidth = (pageWidth - 2 * margin) / table.headers.length;
      pdf.setFillColor(BRAND_COLORS.red);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');

      pdf.setTextColor(BRAND_COLORS.white);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      table.headers.forEach((header, i) => {
        pdf.text(header, margin + i * cellWidth + 2, yPosition);
      });
      yPosition += 7;

      // Table rows
      pdf.setTextColor(BRAND_COLORS.black);
      pdf.setFont('helvetica', 'normal');
      table.rows.forEach((row, rowIndex) => {
        if (yPosition > pageHeight - margin - 5) {
          pdf.addPage();
          yPosition = margin;
        }

        if (rowIndex % 2 === 0) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 6, 'F');
        }

        row.forEach((cell, i) => {
          pdf.text(cell, margin + i * cellWidth + 2, yPosition);
        });
        yPosition += 6;
      });
      yPosition += 10;
    }
  }

  // Add charts as images
  if (data.charts) {
    for (const chart of data.charts) {
      const element = document.getElementById(chart.elementId);
      if (element) {
        try {
          const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            scale: 2,
          });
          const imgData = canvas.toDataURL('image/png');

          if (yPosition > pageHeight - 80) {
            pdf.addPage();
            yPosition = margin;
          }

          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(BRAND_COLORS.black);
          pdf.text(chart.title, margin, yPosition);
          yPosition += 7;

          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 100));
          yPosition += Math.min(imgHeight, 100) + 10;
        } catch (error) {
          console.error('Failed to capture chart:', error);
        }
      }
    }
  }

  // Add footer
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(BRAND_COLORS.darkGrey);
    pdf.text(
      `Page ${i} of ${totalPages} | Generated ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  pdf.save(filename);
}
