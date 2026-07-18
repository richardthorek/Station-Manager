/**
 * Bulk Import Modal Component
 * 
 * Allows importing multiple members from a CSV file.
 * Features:
 * - File upload with drag-and-drop support
 * - CSV validation and preview
 * - Duplicate detection
 * - Error highlighting
 * - Sample CSV template download
 */

import { useState, useCallback, useRef, useEffect, type KeyboardEvent, type MouseEvent } from 'react';
import Papa from 'papaparse';
import type { Member } from '../types';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { announce } from '../utils/announcer';
import './BulkImportModal.css';

interface BulkImportModalProps {
  existingMembers: Member[];
  onClose: () => void;
  onImportComplete: () => void;
  onImport: (members: Array<{
    firstName?: string;
    lastName?: string;
    name: string;
    rank?: string;
  }>) => Promise<{
    successCount: number;
    failureCount: number;
    successful: Array<{ name: string; id: string; qrCode: string }>;
    failed: Array<{ name: string; error: string }>;
  }>;
}

interface ParsedMember {
  row: number;
  data: {
    firstName?: string;
    lastName?: string;
    name: string;
    rank?: string;
    roles?: string;
  };
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

/**
 * Column mapping (found 2026-07-18, per direct user feedback): the parser
 * used to match headers by exact, case-sensitive string against a tiny fixed
 * set ("First Name"/"firstName" etc.) — a header as ordinary as "first name"
 * or "First_Name" matched nothing, so every row silently came back "Name is
 * required" with no hint the real problem was the column names, not the
 * data. Normalizes headers (lowercase, strip spaces/underscores/hyphens) and
 * matches against a small alias list per field instead.
 */
type CanonicalField = 'firstName' | 'lastName' | 'name' | 'rank' | 'roles';

const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  firstName: ['firstname', 'first', 'givenname', 'forename'],
  lastName: ['lastname', 'last', 'surname', 'familyname'],
  name: ['name', 'fullname', 'membername'],
  rank: ['rank', 'title'],
  roles: ['roles', 'role', 'duties', 'permissions'],
};

const FIELD_LABELS: Record<CanonicalField, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  name: 'Name',
  rank: 'Rank',
  roles: 'Roles',
};

function normalizeHeaderKey(header: string): string {
  return header.toLowerCase().replace(/[\s_-]+/g, '');
}

/** Maps each canonical field to the actual CSV header that matched it, if any. */
function detectColumnMap(headers: string[]): Partial<Record<CanonicalField, string>> {
  const map: Partial<Record<CanonicalField, string>> = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, normalized: normalizeHeaderKey(h) }));

  (Object.keys(FIELD_ALIASES) as CanonicalField[]).forEach((field) => {
    const aliases = FIELD_ALIASES[field];
    const match = normalizedHeaders.find((h) => aliases.includes(h.normalized));
    if (match) map[field] = match.raw;
  });

  return map;
}

export function BulkImportModal({ existingMembers, onClose, onImportComplete, onImport }: BulkImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMember[]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<CanonicalField, string>>>({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    successful: Array<{ name: string; id: string; qrCode: string }>;
    failed: Array<{ name: string; error: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(true);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (event: Event) => {
      if ((event as globalThis.KeyboardEvent).key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const processFile = useCallback((file: File) => {
    setFile(file);
    setImportResult(null);
    setColumnMap({});

    // Parse CSV
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target?.result as string;
      
      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          // Validate data
          const existingNames = new Set(existingMembers.map(m => m.name.toLowerCase()));
          const detectedColumns = detectColumnMap(results.meta.fields ?? []);
          setColumnMap(detectedColumns);

          const validated: ParsedMember[] = results.data.map((row, index) => {
            const errors: string[] = [];
            const clean = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
            const at = (field: CanonicalField): string =>
              detectedColumns[field] ? clean(row[detectedColumns[field]!]) : '';

            const firstName = at('firstName');
            const lastName = at('lastName');
            const directName = at('name');
            const rank = at('rank');
            const roles = at('roles');

            // Construct the full name
            let name = '';
            if (firstName || lastName) {
              name = `${firstName}${lastName ? ` ${lastName}` : ''}`.trim();
            } else if (directName) {
              name = directName;
            }

            // Validation
            if (!name) {
              errors.push('Name is required');
            }

            const isDuplicate = name ? existingNames.has(name.toLowerCase()) : false;
            if (isDuplicate) {
              errors.push('Duplicate member');
            }

            return {
              row: index + 2, // +2 for 1-indexed + header row
              data: {
                firstName: firstName || undefined,
                lastName: lastName || undefined,
                name,
                rank: rank || undefined,
                roles: roles || undefined,
              },
              isValid: errors.length === 0,
              isDuplicate,
              errors,
            };
          });

          setParsedData(validated);
        },
      });
    };
    reader.readAsText(file);
  }, [existingMembers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      processFile(droppedFile);
    } else {
      alert('Please upload a CSV file');
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, [processFile]);

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const downloadSampleCSV = () => {
    const sampleCSV = `First Name,Last Name,Rank,Roles
Hayden,Johnson,,
Callum,Ceglinski,,
Samuel,Clements,,"Permit Officer, Driver, SMT Member"
Robin,Allard,Captain,"OneAdmin, Permit Officer, Callout Officer"`;

    const blob = new Blob([sampleCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'member-import-sample.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    const validMembers = parsedData.filter(m => m.isValid && !m.isDuplicate);
    
    if (validMembers.length === 0) {
      alert('No valid members to import');
      announce('Error: No valid members to import', 'assertive');
      return;
    }

    setImporting(true);
    try {
      const membersToImport = validMembers.map(m => ({
        firstName: m.data.firstName,
        lastName: m.data.lastName,
        name: m.data.name,
        rank: m.data.rank,
      }));

      const result = await onImport(membersToImport);
      setImportResult(result);
      
      // Announce import results to screen readers
      if (result.successCount > 0 && result.failureCount === 0) {
        announce(`Success: ${result.successCount} member${result.successCount !== 1 ? 's' : ''} imported successfully`, 'assertive');
      } else if (result.successCount > 0 && result.failureCount > 0) {
        announce(`Import complete: ${result.successCount} succeeded, ${result.failureCount} failed`, 'assertive');
      } else {
        announce(`Error: Import failed for all ${result.failureCount} members`, 'assertive');
      }
      
      if (result.failureCount === 0) {
        // All successful, close after a short delay
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      const errorMsg = 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error');
      announce(`Error: ${errorMsg}`, 'assertive');
      alert(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter(m => m.isValid && !m.isDuplicate).length;
  const invalidCount = parsedData.filter(m => !m.isValid).length;
  const duplicateCount = parsedData.filter(m => m.isDuplicate).length;

  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClose();
    }
  };

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Close bulk import dialog"
    >
      <div 
        ref={modalRef}
        className="bulk-import-modal" 
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-import-title"
      >
        <div className="modal-header">
          <h2 id="bulk-import-title">Bulk Import Members</h2>
          <button 
            type="button"
            className="btn-close" 
            onClick={onClose}
            aria-label="Close import dialog"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {!file && (
            <>
              <div className="import-instructions">
                <p>
                  Import multiple members from a CSV file. Include a "First Name"/"Last Name"
                  pair or a single "Name" column — an optional "Rank" column is also
                  recognized. Column names don't need to match exactly (capitalization,
                  spaces, and underscores are all fine).
                </p>
                <button 
                  type="button"
                  className="btn-download-sample" 
                  onClick={downloadSampleCSV}
                  aria-label="Download sample CSV template"
                >
                  <span aria-hidden="true">📥</span> Download Sample CSV
                </button>
              </div>

              <div
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleBrowseClick();
                  }
                }}
                aria-label="Upload CSV file: drag and drop or click to browse"
              >
                <div className="upload-icon" aria-hidden="true">📁</div>
                <p>Drag and drop a CSV file here</p>
                <p className="upload-or">or</p>
                <button type="button" className="btn-browse">Browse Files</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  aria-label="CSV file input"
                />
              </div>
            </>
          )}

          {file && parsedData.length > 0 && !importResult && (
            <>
              <div className="file-info">
                <p><strong>File:</strong> {file.name}</p>
                <p role="status">
                  <strong>Summary:</strong> {validCount} valid, {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}, {invalidCount} invalid
                </p>
                <p className="detected-columns">
                  <strong>Detected columns:</strong>{' '}
                  {(['firstName', 'lastName', 'name', 'rank', 'roles'] as const)
                    .filter((field) => columnMap[field])
                    .map((field) => `${FIELD_LABELS[field]} → "${columnMap[field]}"`)
                    .join(', ') || 'none recognized'}
                </p>
                {!columnMap.name && !columnMap.firstName && !columnMap.lastName && (
                  <p className="detected-columns-warning" role="alert">
                    ⚠ No name column found — expected a "First Name"/"Last Name" pair or a
                    single "Name" column. Every row below will fail until the file has one.
                  </p>
                )}
                <button
                  type="button"
                  className="btn-change-file"
                  onClick={() => { setFile(null); setParsedData([]); setColumnMap({}); }}
                  aria-label="Change selected file"
                >
                  Change File
                </button>
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
                  <caption className="sr-only">Member import preview with validation status</caption>
                  <thead>
                    <tr>
                      <th scope="col">Row</th>
                      <th scope="col">Name</th>
                      <th scope="col">Rank</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((member, index) => (
                      <tr key={index} className={member.isDuplicate ? 'duplicate' : member.isValid ? 'valid' : 'invalid'}>
                        <td>{member.row}</td>
                        <td>{member.data.name || '—'}</td>
                        <td>{member.data.rank || '—'}</td>
                        <td>
                          {member.isValid && !member.isDuplicate && <span className="status-valid">✓ Valid</span>}
                          {member.isDuplicate && <span className="status-duplicate">⚠ Duplicate</span>}
                          {!member.isValid && <span className="status-invalid">✗ {member.errors.join(', ')}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
                <button 
                  type="button"
                  className="btn-import" 
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                  aria-disabled={validCount === 0 || importing}
                  aria-label={`Import ${validCount} member${validCount !== 1 ? 's' : ''}`}
                >
                  {importing ? 'Importing...' : `Import ${validCount} Member${validCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {importResult && (
            <div className="import-result" role="status" aria-live="assertive" aria-atomic="true">
              <h3>Import Complete</h3>
              <p className="result-summary">
                <strong>{importResult.successCount}</strong> member{importResult.successCount !== 1 ? 's' : ''} imported successfully
                {importResult.failureCount > 0 && (
                  <>, <strong>{importResult.failureCount}</strong> failed</>
                )}
              </p>

              {importResult.failed.length > 0 && (
                <div className="failed-imports">
                  <h4>Failed Imports:</h4>
                  <ul>
                    {importResult.failed.map((f, i) => (
                      <li key={i}>{f.name}: {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button 
                type="button"
                className="btn-close-result" 
                onClick={onImportComplete}
                aria-label="Close import results"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
