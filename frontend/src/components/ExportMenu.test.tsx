/**
 * ExportMenu Component Tests
 *
 * Tests for the export menu with:
 * - PDF export
 * - Excel export
 * - PNG export
 * - Loading states
 * - Success notifications
 */

import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ExportMenu } from './ExportMenu';

describe('ExportMenu', () => {
  const mockExportPDF = vi.fn();
  const mockExportExcel = vi.fn();
  const mockExportPNG = vi.fn();

  const renderMenu = async (props: Partial<ComponentProps<typeof ExportMenu>> = {}) => {
    let utils: ReturnType<typeof render> | undefined
    await act(async () => {
      utils = render(
        <ExportMenu
          onExportPDF={mockExportPDF}
          onExportExcel={mockExportExcel}
          onExportPNG={mockExportPNG}
          {...props}
        />
      )
    })
    return utils as ReturnType<typeof render>
  }

  const openPdfOption = async () => {
    const exportButton = screen.getByText('Export');
    await act(async () => {
      fireEvent.click(exportButton);
    });
    return screen.findByText('Export as PDF');
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders export button', async () => {
    await renderMenu();

    expect(screen.getByText('Export')).toBeInTheDocument();
  });

  it('opens dropdown when export button clicked', async () => {
    await renderMenu();

    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('Export as PDF')).toBeInTheDocument();
    expect(screen.getByText('Export as Excel')).toBeInTheDocument();
    expect(screen.getByText('Export Charts as PNG')).toBeInTheDocument();
  });

  it('closes dropdown when clicking outside', async () => {
    await renderMenu();

    // Open dropdown
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);
    expect(screen.getByText('Export as PDF')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText('Export as PDF')).not.toBeInTheDocument();
    });
  });

  it('calls onExportPDF when PDF option clicked', async () => {
    mockExportPDF.mockResolvedValue(undefined);

    await renderMenu();

    // Open dropdown
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    // Click PDF option
    const pdfOption = screen.getByText('Export as PDF');
    fireEvent.click(pdfOption);

    await waitFor(() => {
      expect(mockExportPDF).toHaveBeenCalled();
    });
  });

  it('calls onExportExcel when Excel option clicked', async () => {
    mockExportExcel.mockResolvedValue(undefined);

    await renderMenu();

    // Open dropdown
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    // Click Excel option
    const excelOption = screen.getByText('Export as Excel');
    fireEvent.click(excelOption);

    await waitFor(() => {
      expect(mockExportExcel).toHaveBeenCalled();
    });
  });

  it('calls onExportPNG when PNG option clicked', async () => {
    mockExportPNG.mockResolvedValue(undefined);

    await renderMenu();

    // Open dropdown
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    // Click PNG option
    const pngOption = screen.getByText('Export Charts as PNG');
    fireEvent.click(pngOption);

    await waitFor(() => {
      expect(mockExportPNG).toHaveBeenCalled();
    });
  });

  it('shows loading state during export', async () => {
    // Create a promise that we control
    let resolveExport: () => void;
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve;
    });
    mockExportPDF.mockReturnValue(exportPromise);

    await renderMenu();

    // Open dropdown and click PDF
    const pdfOption = await openPdfOption();
    await act(async () => {
      fireEvent.click(pdfOption);
    });

    // Should show loading
    await waitFor(() => {
      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });

    // Resolve the export
    await act(async () => {
      resolveExport!();
    });
  });

  it('shows success message after export completes', async () => {
    mockExportPDF.mockResolvedValue(undefined);

    await renderMenu();

    // Open dropdown and click PDF
    const pdfOption = await openPdfOption();
    await act(async () => {
      fireEvent.click(pdfOption);
    });

    await waitFor(() => {
      expect(screen.getByText(/Exported as PDF successfully/)).toBeInTheDocument();
    });
  });

  it('closes dropdown after successful export', async () => {
    mockExportPDF.mockResolvedValue(undefined);

    await renderMenu();

    // Open dropdown and click PDF
    const pdfOption = await openPdfOption();
    await act(async () => {
      fireEvent.click(pdfOption);
    });

    await waitFor(() => {
      expect(screen.queryByText('Export as Excel')).not.toBeInTheDocument();
    });
  });

  it('disables export button when disabled prop is true', async () => {
    await renderMenu({ disabled: true });

    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeDisabled();
  });

  it('shows error alert when export fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockExportPDF.mockRejectedValue(new Error('Export failed'));

    await renderMenu();

    // Open dropdown and click PDF
    const pdfOption = await openPdfOption();
    await act(async () => {
      fireEvent.click(pdfOption);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to export'));
    });

    alertSpy.mockRestore();
  });

  it('displays dropdown descriptions', () => {
    render(
      <ExportMenu
        onExportPDF={mockExportPDF}
        onExportExcel={mockExportExcel}
        onExportPNG={mockExportPNG}
      />
    );

    // Open dropdown
    const exportButton = screen.getByText('Export');
    fireEvent.click(exportButton);

    expect(screen.getByText('Formatted report with RFS branding')).toBeInTheDocument();
    expect(screen.getByText('Spreadsheet with formatted data')).toBeInTheDocument();
    expect(screen.getByText('High-resolution chart images')).toBeInTheDocument();
  });
});
