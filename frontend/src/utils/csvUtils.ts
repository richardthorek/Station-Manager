/**
 * Utility function to trigger CSV file download from a Blob
 * @param blob The CSV data as a Blob
 * @param filename The desired filename for the download
 */
export function downloadCSV(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Format a date as YYYY-MM-DD for CSV filename
 * @param date Date object
 * @returns Formatted date string
 */
export function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get today's date formatted as YYYY-MM-DD
 * @returns Formatted date string
 */
export function getTodayFormatted(): string {
  return formatDateForFilename(new Date());
}
