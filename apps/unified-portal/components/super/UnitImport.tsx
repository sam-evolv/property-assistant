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
    <div className="bg-white border-2 border-gold-400 rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b-2 border-neutral-200 bg-neutral-100">
        <h3 className="text-xl font-bold text-black">Import Units</h3>
        <p className="text-base text-black mt-1 font-bold">
          Upload a spreadsheet to bulk import units for {developmentName}
        </p>
      </div>

      <div className="p-6">
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed border-gray-400 rounded-lg p-10 text-center hover:border-black hover:bg-gray-50 transition-all cursor-pointer bg-white"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
              />
              <FileSpreadsheet className="w-16 h-16 text-black mx-auto mb-4" />
              <p className="text-lg font-bold text-black">
                Drop your spreadsheet here or click to browse
              </p>
              <p className="text-sm text-black mt-2 font-bold">
                Supports Excel (.xlsx, .xls) and CSV files
              </p>
            </div>

            {spreadsheetUrl && (
              <div className="text-center">
                <span className="text-base text-black font-bold">or</span>
                <button
                  onClick={loadFromUrl}
                  className="block w-full mt-2 px-6 py-3 bg-neutral-200 text-black rounded-lg text-lg font-bold hover:bg-neutral-300 transition-colors border-2 border-gray-400"
                >
                  Load from Onboarding Submission
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-base text-red-900 font-bold">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-black">
                  {file?.name || 'Spreadsheet'}
                </p>
                <p className="text-base text-black font-bold">
                  {parsedData.length} rows found
                </p>
              </div>
              <button
                onClick={() => setStep('upload')}
                className="text-base text-black font-bold hover:text-gray-900 underline underline-offset-4"
              >
                Change file
              </button>
            </div>

            <div className="border-2 border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                    <tr>
                      {headers.slice(0, 6).map((header, i) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                      {headers.length > 6 && (
                        <th className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                          +{headers.length - 6} more
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {headers.slice(0, 6).map((header, j) => (
                          <td key={j} className="px-4 py-3 text-black font-medium truncate max-w-[200px]">
                            {String(row[header] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 10 && (
                <div className="px-4 py-2 bg-gray-100 text-sm text-black font-bold border-t border-gray-300">
                  Showing 10 of {parsedData.length} rows
                </div>
              )}
            </div>

            <button
              onClick={() => setStep('mapping')}
              className="w-full px-6 py-3 bg-brand-500 text-white rounded-lg font-bold text-lg hover:bg-brand-600 transition-all flex items-center justify-center gap-2 shadow-md"
            >
              Continue to Column Mapping
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-6">
            <p className="text-lg text-black font-bold bg-amber-50 p-3 rounded-lg border border-amber-200">
              Map your spreadsheet columns to unit fields. Required fields marked with *
            </p>

            <div className="space-y-4">
              {TARGET_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-6">
                  <div className="w-48 flex-shrink-0">
                    <span className="text-base font-bold text-black">
                      {field.label}
                      {field.required && <span className="text-red-600 ml-1 font-black text-lg">*</span>}
                    </span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-black flex-shrink-0" />
                  <select
                    value={mappings[field.key] || ''}
                    onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                    className={`flex-1 px-4 py-2.5 border-2 rounded-lg text-base font-bold focus:border-brand-500 focus:ring-4 focus:ring-brand-500/20 focus:outline-none transition-all ${
                      mappings[field.key] 
                        ? 'border-emerald-500 bg-emerald-50' 
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    <option value="">-- Select spreadsheet column --</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>{header}</option>
                    ))}
                  </select>
                  {mappings[field.key] && (
                    <Check className="w-6 h-6 text-emerald-600 flex-shrink-0 stroke-[3]" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 pt-6">
              <button
                onClick={() => setStep('preview')}
                className="px-8 py-3 border-2 border-gray-400 text-black rounded-lg text-lg font-bold hover:bg-gray-100 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={!mappings.unit_number && !mappings.address}
                className="flex-1 px-8 py-3 bg-brand-500 text-white rounded-lg font-bold text-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
              >
                Import {parsedData.length} Units
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-brand-500 animate-spin mx-auto mb-6" />
            <p className="text-2xl font-bold text-black">Importing Units...</p>
            <p className="text-lg text-black mt-2 font-bold">{importProgress}% complete</p>
            <div className="w-full max-w-md mx-auto mt-8 h-4 bg-gray-200 rounded-full overflow-hidden border border-gray-300 shadow-inner">
              <div 
                className="h-full bg-brand-500 transition-all duration-300 shadow-lg"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="space-y-6">
            <div className="text-center py-6">
              {importResult.success > 0 ? (
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="w-10 h-10 text-emerald-600 stroke-[3]" />
                </div>
              ) : (
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X className="w-10 h-10 text-red-600 stroke-[3]" />
                </div>
              )}
              <h3 className="text-2xl font-bold text-black">Import Complete</h3>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 bg-emerald-50 border-2 border-emerald-200 rounded-xl text-center shadow-sm">
                <p className="text-4xl font-black text-emerald-700">{importResult.success}</p>
                <p className="text-lg text-emerald-800 font-bold mt-1">Units Created</p>
              </div>
              <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl text-center shadow-sm">
                <p className="text-4xl font-black text-red-700">{importResult.failed}</p>
                <p className="text-lg text-red-800 font-bold mt-1">Failed</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                <p className="text-lg font-bold text-red-900 mb-3">Error Details:</p>
                <ul className="text-base text-red-900 font-bold space-y-2 max-h-48 overflow-y-auto">
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-400">•</span>
                      {err}
                    </li>
                  ))}
                  {importResult.errors.length > 20 && (
                    <li className="italic text-red-600 font-medium">...and {importResult.errors.length - 20} more errors</li>
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
              className="w-full px-8 py-4 border-2 border-gray-400 text-black rounded-lg text-xl font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <RefreshCw className="w-6 h-6" />
              Import More Units
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default UnitImport;
