'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Check,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

interface ParsedRow {
  [key: string]: string | number | null;
}

interface UnitImportProps {
  developmentId: string;
  developmentName: string;
  tenantId: string;
  spreadsheetUrl?: string;
  onImportComplete: (count: number) => void;
}

const TARGET_FIELDS = [
  { key: 'unit_number', label: 'Unit Number', required: true },
  { key: 'address', label: 'Address', required: true },
  { key: 'unit_type', label: 'Unit Type', required: false },
  { key: 'purchaser_name', label: 'Purchaser Name', required: false },
  { key: 'purchaser_email', label: 'Purchaser Email', required: false },
  { key: 'purchaser_phone', label: 'Purchaser Phone', required: false },
  { key: 'handover_date', label: 'Handover Date', required: false },
];

const COLUMN_ALIASES: Record<string, string[]> = {
  unit_number: ['unit', 'unit no', 'unit number', 'unit #', 'house no', 'house number', 'plot', 'plot no'],
  address: ['address', 'full address', 'property address', 'street', 'location'],
  unit_type: ['type', 'unit type', 'property type', 'house type', 'style'],
  purchaser_name: ['purchaser', 'purchaser name', 'buyer', 'buyer name', 'owner', 'owner name', 'name', 'customer'],
  purchaser_email: ['email', 'purchaser email', 'buyer email', 'e-mail', 'email address'],
  purchaser_phone: ['phone', 'telephone', 'mobile', 'contact', 'phone number', 'tel', 'purchaser phone'],
  handover_date: ['handover', 'handover date', 'completion', 'completion date', 'closing date', 'move in'],
};

export function UnitImport({ developmentId, developmentName, tenantId, spreadsheetUrl, onImportComplete }: UnitImportProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateAccessCode = (devPrefix: string, index: number) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let random = '';
    for (let i = 0; i < 4; i++) {
      random += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${devPrefix}-${String(index + 1).padStart(3, '0')}-${random}`;
  };

  const getDevPrefix = (name: string) => {
    return name
      .split(' ')
      .map(word => word.substring(0, 1).toUpperCase())
      .join('')
      .substring(0, 3)
      .padEnd(3, 'X');
  };

  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setError(null);
    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { header: 1 });
      
      if (jsonData.length < 2) {
        setError('Spreadsheet must have at least a header row and one data row');
        return;
      }

      const headerRow = jsonData[0] as unknown as (string | number | null)[];
      const cleanHeaders = headerRow.map(h => String(h || '').trim());
      setHeaders(cleanHeaders);

      const dataRows = jsonData.slice(1).map(row => {
        const obj: ParsedRow = {};
        cleanHeaders.forEach((header, i) => {
          obj[header] = (row as any)[i] ?? null;
        });
        return obj;
      }).filter(row => Object.values(row).some(v => v !== null && v !== ''));

      setParsedData(dataRows);

      const autoMappings: Record<string, string> = {};
      cleanHeaders.forEach(header => {
        const lowerHeader = header.toLowerCase();
        for (const [target, aliases] of Object.entries(COLUMN_ALIASES)) {
          if (aliases.some(alias => lowerHeader.includes(alias) || alias.includes(lowerHeader))) {
            if (!autoMappings[target]) {
              autoMappings[target] = header;
            }
          }
        }
      });
      setMappings(autoMappings);

      setStep('preview');
    } catch (err) {
      setError('Failed to parse spreadsheet. Please ensure it\'s a valid Excel or CSV file.');
      console.error('Parse error:', err);
    }
  }, []);

  const loadFromUrl = useCallback(async () => {
    if (!spreadsheetUrl) return;
    
    setError(null);
    try {
      const response = await fetch(spreadsheetUrl);
      if (!response.ok) throw new Error('Failed to fetch file');
      
      const blob = await response.blob();
      const file = new File([blob], 'spreadsheet.xlsx', { type: blob.type });
      await handleFileUpload(file);
    } catch (err) {
      setError('Failed to load spreadsheet from URL. The file may have been moved or deleted.');
    }
  }, [spreadsheetUrl, handleFileUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileUpload(droppedFile);
    }
  }, [handleFileUpload]);

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    setImportProgress(0);
    setImportResult(null);

    const devPrefix = getDevPrefix(developmentName);
    const results = { success: 0, failed: 0, errors: [] as string[] };

    let startIndex = 0;
    try {
      const countRes = await fetch(`/api/super/units/count?development_id=${developmentId}`);
      if (countRes.ok) {
        const { count } = await countRes.json();
        startIndex = count || 0;
      }
    } catch {}

    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      
      try {
        const unitData: Record<string, any> = {
          development_id: developmentId,
          tenant_id: tenantId,
          access_code: generateAccessCode(devPrefix, startIndex + i),
        };

        for (const [target, source] of Object.entries(mappings)) {
          if (source && row[source] !== null && row[source] !== undefined && row[source] !== '') {
            let value = row[source];
            
            if (target === 'handover_date' && value) {
              const parsed = new Date(value as string);
              if (!isNaN(parsed.getTime())) {
                unitData[target] = parsed.toISOString().split('T')[0];
              }
            } else {
              unitData[target] = value;
            }
          }
        }

        if (!unitData.unit_number && !unitData.address) {
          throw new Error(`Row ${i + 1}: Missing unit number or address`);
        }

        if (!unitData.address && unitData.unit_number) {
          unitData.address = `${unitData.unit_number} ${developmentName}`;
        }

        const res = await fetch('/api/super/units/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(unitData)
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to create unit');
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(err instanceof Error ? err.message : `Row ${i + 1} failed`);
      }

      setImportProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setImportResult(results);
    setImporting(false);
    setStep('complete');
    
    if (results.success > 0) {
      onImportComplete(results.success);
    }
  };

  return (
    <div className="bg-white border border-gold-100 rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
        <h3 className="font-semibold text-neutral-900">Import Units</h3>
        <p className="text-sm text-gray-900 mt-1">
          Upload a spreadsheet to bulk import units for {developmentName}
        </p>
      </div>

      <div className="p-6">
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-brand-400 hover:bg-brand-50/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <FileSpreadsheet className="w-12 h-12 text-neutral-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">
                Drop your spreadsheet here or click to browse
              </p>
              <p className="text-xs text-gray-900 mt-1">
                Supports Excel (.xlsx, .xls) and CSV files
              </p>
            </div>

            {spreadsheetUrl && (
              <div className="text-center">
                <span className="text-sm text-gray-900">or</span>
                <button
                  onClick={loadFromUrl}
                  className="block w-full mt-2 px-4 py-2 bg-neutral-100 text-gray-900 rounded-lg text-sm font-medium hover:bg-neutral-200 transition-colors"
                >
                  Load from Onboarding Submission
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {file?.name || 'Spreadsheet'}
                </p>
                <p className="text-xs text-gray-900">
                  {parsedData.length} rows found
                </p>
              </div>
              <button
                onClick={() => setStep('upload')}
                className="text-sm text-gray-900 hover:text-gray-900"
              >
                Change file
              </button>
            </div>

            <div className="border border-neutral-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr>
                      {headers.slice(0, 6).map((header, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-neutral-500 uppercase">
                          {header}
                        </th>
                      ))}
                      {headers.length > 6 && (
                        <th className="px-3 py-2 text-left text-xs font-semibold text-neutral-500">
                          +{headers.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {parsedData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-neutral-50">
                        {headers.slice(0, 6).map((header, j) => (
                          <td key={j} className="px-3 py-2 text-neutral-700 truncate max-w-[150px]">
                            {String(row[header] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 5 && (
                <div className="px-3 py-2 bg-neutral-50 text-xs text-neutral-500 border-t border-neutral-200">
                  Showing 5 of {parsedData.length} rows
                </div>
              )}
            </div>

            <button
              onClick={() => setStep('mapping')}
              className="w-full px-4 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
            >
              Continue to Column Mapping
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-900">
              Map your spreadsheet columns to unit fields. We've auto-detected some mappings.
            </p>

            <div className="space-y-3">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <span className="text-sm font-medium text-neutral-700">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <select
                    value={mappings[field.key] || ''}
                    onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                    className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none ${
                      mappings[field.key] 
                        ? 'border-emerald-300 bg-emerald-50' 
                        : 'border-neutral-200 bg-white'
                    }`}
                  >
                    <option value="">-- Select column --</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                  {mappings[field.key] && (
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setStep('preview')}
                className="px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!mappings.unit_number && !mappings.address}
                className="flex-1 px-4 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                Import {parsedData.length} Units
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
            <p className="text-lg font-medium text-neutral-900">Importing Units...</p>
            <p className="text-sm text-gray-900 mt-1">{importProgress}% complete</p>
            <div className="w-full max-w-xs mx-auto mt-4 h-2 bg-neutral-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-500 transition-all duration-300"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="text-center py-4">
              {importResult.success > 0 ? (
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-emerald-600" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-neutral-900">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-emerald-700">{importResult.success}</p>
                <p className="text-sm text-emerald-600">Units Created</p>
              </div>
              <div className="p-4 bg-neutral-100 rounded-lg text-center">
                <p className="text-2xl font-bold text-neutral-700">{importResult.failed}</p>
                <p className="text-sm text-gray-900">Failed</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
                <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li>...and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <button
              onClick={() => {
                setStep('upload');
                setFile(null);
                setParsedData([]);
                setHeaders([]);
                setMappings({});
                setImportResult(null);
              }}
              className="w-full px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Import More Units
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnitImport;
