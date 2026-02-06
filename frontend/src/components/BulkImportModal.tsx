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

import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import type { Member } from '../types';
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

export function BulkImportModal({ existingMembers, onClose, onImportComplete, onImport }: BulkImportModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMember[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    successful: Array<{ name: string; id: string; qrCode: string }>;
    failed: Array<{ name: string; error: string }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  }, []);

  const processFile = (file: File) => {
    setFile(file);
    setImportResult(null);

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
          
          const validated: ParsedMember[] = results.data.map((row, index) => {
            const errors: string[] = [];
            const clean = (val: unknown): string => (typeof val === 'string' ? val.trim() : '');
            
            // Handle both "First Name"/"Last Name" and "name" columns
            const firstName = clean(row['First Name'] || row['firstName'] || '');
            const lastName = clean(row['Last Name'] || row['lastName'] || '');
            const directName = clean(row['name'] || row['Name'] || '');
            const rank = clean(row['Rank'] || row['rank'] || '');
            const roles = clean(row['Roles'] || row['roles'] || '');

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
  };

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
      
      if (result.failureCount === 0) {
        // All successful, close after a short delay
        setTimeout(() => {
          onImportComplete();
        }, 2000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter(m => m.isValid && !m.isDuplicate).length;
  const invalidCount = parsedData.filter(m => !m.isValid).length;
  const duplicateCount = parsedData.filter(m => m.isDuplicate).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="bulk-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Bulk Import Members</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!file && (
            <>
              <div className="import-instructions">
                <p>Import multiple members from a CSV file exported from OneRFS Brigade Administration Report.</p>
                <button className="btn-download-sample" onClick={downloadSampleCSV}>
                  📥 Download Sample CSV
                </button>
              </div>

              <div
                className={`upload-area ${isDragging ? 'dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={handleBrowseClick}
              >
                <div className="upload-icon">📁</div>
                <p>Drag and drop a CSV file here</p>
                <p className="upload-or">or</p>
                <button className="btn-browse">Browse Files</button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </>
          )}

          {file && parsedData.length > 0 && !importResult && (
            <>
              <div className="file-info">
                <p><strong>File:</strong> {file.name}</p>
                <p>
                  <strong>Summary:</strong> {validCount} valid, {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}, {invalidCount} invalid
                </p>
                <button className="btn-change-file" onClick={() => { setFile(null); setParsedData([]); }}>
                  Change File
                </button>
              </div>

              <div className="preview-table-container">
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Name</th>
                      <th>Rank</th>
                      <th>Status</th>
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
                <button className="btn-cancel" onClick={onClose}>Cancel</button>
                <button 
                  className="btn-import" 
                  onClick={handleImport}
                  disabled={validCount === 0 || importing}
                >
                  {importing ? 'Importing...' : `Import ${validCount} Member${validCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </>
          )}

          {importResult && (
            <div className="import-result">
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

              <button className="btn-close-result" onClick={onImportComplete}>Close</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
