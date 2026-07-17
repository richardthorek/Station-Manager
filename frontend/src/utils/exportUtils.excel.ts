/**
 * Excel Export Utility
 *
 * Split out of exportUtils.ts (Q20) so an Excel export only pulls ExcelJS,
 * not jsPDF/html2canvas too.
 */

import ExcelJS, { type FillPattern, type Row } from 'exceljs';

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
