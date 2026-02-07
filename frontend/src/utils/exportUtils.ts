/**
 * Export Utilities
 *
 * Functions for exporting reports in various formats:
 * - PDF with RFS branding
 * - Excel spreadsheet
 * - PNG chart images
 */

import jsPDF from 'jspdf';
import ExcelJS, { type FillPattern, type Row } from 'exceljs';
import html2canvas from 'html2canvas';

// RFS brand colors
const RFS_COLORS = {
  red: '#e5281B',
  lime: '#cbdb2a',
  black: '#000000',
  white: '#ffffff',
  darkGrey: '#4d4d4f',
  lightGrey: '#bcbec0',
};

/**
 * Export report as PDF with RFS branding
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
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  // Add RFS header
  pdf.setFillColor(RFS_COLORS.red);
  pdf.rect(0, 0, pageWidth, 25, 'F');

  pdf.setTextColor(RFS_COLORS.white);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('NSW Rural Fire Service', margin, 12);

  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'normal');
  if (options.stationName) {
    pdf.text(options.stationName, margin, 19);
  }

  yPosition = 35;

  // Add report title
  pdf.setTextColor(RFS_COLORS.black);
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, margin, yPosition);
  yPosition += 8;

  // Add date range
  if (options.dateRange) {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(RFS_COLORS.darkGrey);
    pdf.text(`Report Period: ${options.dateRange}`, margin, yPosition);
    yPosition += 10;
  }

  // Add KPIs
  if (data.kpis && data.kpis.length > 0) {
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(RFS_COLORS.black);
    pdf.text('Key Metrics', margin, yPosition);
    yPosition += 7;

    data.kpis.forEach((kpi) => {
      if (yPosition > pageHeight - margin - 10) {
        pdf.addPage();
        yPosition = margin;
      }

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(RFS_COLORS.darkGrey);
      pdf.text(`${kpi.label}:`, margin, yPosition);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(RFS_COLORS.red);
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
      pdf.setTextColor(RFS_COLORS.black);
      pdf.text(table.title, margin, yPosition);
      yPosition += 7;

      // Table headers
      const cellWidth = (pageWidth - 2 * margin) / table.headers.length;
      pdf.setFillColor(RFS_COLORS.red);
      pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, 'F');

      pdf.setTextColor(RFS_COLORS.white);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      table.headers.forEach((header, i) => {
        pdf.text(header, margin + i * cellWidth + 2, yPosition);
      });
      yPosition += 7;

      // Table rows
      pdf.setTextColor(RFS_COLORS.black);
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
          pdf.setTextColor(RFS_COLORS.black);
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
    pdf.setTextColor(RFS_COLORS.darkGrey);
    pdf.text(
      `Page ${i} of ${totalPages} | Generated ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const filename = `RFS_${title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
  pdf.save(filename);
}

/**
 * Export data as Excel spreadsheet
 */
export async function exportAsExcel(
  filename: string,
  sheets: Array<{
    name: string;
    data: Array<Record<string, string | number | boolean | null | undefined>>;
  }>
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // Set workbook properties
  workbook.creator = 'RFS Station Manager';
  workbook.created = new Date();

  sheets.forEach((sheet) => {
    const worksheet = workbook.addWorksheet(sheet.name);

    if (sheet.data.length === 0) return;

    // Get column headers from first row
    const headers = Object.keys(sheet.data[0]);

    // Set up columns with headers and width
    worksheet.columns = headers.map((header) => ({
      header: header,
      key: header,
      width: 20,
    }));

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5281B' }, // RFS red
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' };

    // Add data rows
    sheet.data.forEach((row) => {
      worksheet.addRow(row);
    });

    // Add alternating row colors
    worksheet.eachRow((row: Row, rowNumber: number) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        const fill: FillPattern = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F5' }, // Light gray
        };
        row.fill = fill;
      }
    });

    // Freeze header row
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  });

  // Generate Excel file and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${Date.now()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
