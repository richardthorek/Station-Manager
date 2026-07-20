/**
 * Export Menu Component
 *
 * Provides export functionality for reports:
 * - Export as PDF, branded
 * - Export as Excel (.xlsx)
 * - Export charts as PNG images
 *
 * Props:
 * - onExportPDF: Handler for PDF export
 * - onExportExcel: Handler for Excel export
 * - onExportPNG: Handler for PNG export
 * - disabled: Disable all export options
 */

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, BarChart3, ImageIcon, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useClampMenuToViewport } from '../hooks/useClampMenuToViewport';
import './ExportMenu.css';

interface ExportMenuProps {
  onExportPDF: () => Promise<void>;
  onExportExcel: () => Promise<void>;
  onExportPNG: () => Promise<void>;
  disabled?: boolean;
}

export function ExportMenu({
  onExportPDF,
  onExportExcel,
  onExportPNG,
  disabled = false,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useClampMenuToViewport(dropdownRef, isOpen);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = async (type: 'pdf' | 'excel' | 'png', handler: () => Promise<void>) => {
    try {
      setIsExporting(true);
      setExportSuccess(null);
      await handler();
      setExportSuccess(`Exported as ${type.toUpperCase()} successfully!`);
      setTimeout(() => setExportSuccess(null), 3000);
      setIsOpen(false);
    } catch (error) {
      console.error(`Export ${type} failed:`, error);
      alert(`Failed to export as ${type.toUpperCase()}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className="export-menu__button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        aria-label="Export options"
        aria-expanded={isOpen}
      >
        <span className="export-menu__icon"><Download size={18} strokeWidth={2} aria-hidden /></span>
        <span>Export</span>
        <span className="export-menu__arrow">{isOpen ? <ChevronUp size={16} strokeWidth={2} aria-hidden /> : <ChevronDown size={16} strokeWidth={2} aria-hidden />}</span>
      </button>

      {isOpen && (
        <div className="export-menu__dropdown" ref={dropdownRef}>
          <button
            className="export-menu__option"
            onClick={() => handleExport('pdf', onExportPDF)}
            disabled={isExporting}
          >
            <span className="export-menu__option-icon"><FileText size={20} strokeWidth={2} aria-hidden /></span>
            <div className="export-menu__option-content">
              <span className="export-menu__option-title">Export as PDF</span>
              <span className="export-menu__option-description">
                Formatted, branded report
              </span>
            </div>
          </button>

          <button
            className="export-menu__option"
            onClick={() => handleExport('excel', onExportExcel)}
            disabled={isExporting}
          >
            <span className="export-menu__option-icon"><BarChart3 size={20} strokeWidth={2} aria-hidden /></span>
            <div className="export-menu__option-content">
              <span className="export-menu__option-title">Export as Excel</span>
              <span className="export-menu__option-description">
                Spreadsheet with formatted data
              </span>
            </div>
          </button>

          <button
            className="export-menu__option"
            onClick={() => handleExport('png', onExportPNG)}
            disabled={isExporting}
          >
            <span className="export-menu__option-icon"><ImageIcon size={20} strokeWidth={2} aria-hidden /></span>
            <div className="export-menu__option-content">
              <span className="export-menu__option-title">Export Charts as PNG</span>
              <span className="export-menu__option-description">
                High-resolution chart images
              </span>
            </div>
          </button>
        </div>
      )}

      {isExporting && (
        <div className="export-menu__loading">
          <div className="export-menu__spinner"></div>
          <span>Exporting...</span>
        </div>
      )}

      {exportSuccess && (
        <div className="export-menu__success">
          <span className="export-menu__success-icon"><Check size={16} strokeWidth={2} aria-hidden /></span>
          <span>{exportSuccess}</span>
        </div>
      )}
    </div>
  );
}
