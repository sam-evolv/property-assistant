'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface ImportResult {
  rowIndex: number;
  status: 'inserted' | 'updated' | 'skipped' | 'error';
  unitNumber?: string;
  unitUid?: string;
  error?: string;
  details?: string;
}

interface ImportResponse {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  results: ImportResult[];
  error?: string;
}

export default function HousesImportPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.id as string;
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);

  // RFC 4180 compliant CSV parser (handles quoted fields with commas)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator (not inside quotes)
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setResult(null);
    
    const fileName = selectedFile.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      // Parse CSV preview with proper quote handling
      const text = await selectedFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = parseCSVLine(lines[0]);
      const rows = lines.slice(1, 6).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header] = values[i] || '';
        });
        return obj;
      });
      
      setPreview(rows);
    } else {
      // For XLSX, just show file info
      setPreview([]);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    
    setImporting(true);
    setResult(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('developmentId', developmentId);
      
      const res = await fetch('/api/houses/import', {
        method: 'POST',
        body: formData,
      });
      
      const data = await res.json();
      setResult(data);
      
      // Only redirect if completely successful
      if (data.success && data.summary.errors === 0) {
        setTimeout(() => {
          router.push(`/developments/${developmentId}`);
        }, 3000);
      }
    } catch (error: any) {
      setResult({
        success: false,
        summary: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 1 },
        results: [],
        error: error.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleBack = () => {
    router.push(`/developments/${developmentId}`);
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Import Houses from CSV/XLSX</h1>
        <p className="mt-2 text-gray-600">Upload a CSV or Excel file containing house data for this development</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 mb-2 block">
            Select File (CSV or XLSX)
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gold-500 file:text-white hover:file:bg-gold-600 cursor-pointer"
          />
          <p className="mt-2 text-xs text-gray-500">
            Supported formats: CSV, XLSX. Required fields: house_number, address, house_type_code
          </p>
        </label>
        
        {preview.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-900">Preview (First 5 rows)</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0]).map(key => (
                      <th key={key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.values(row).map((value: any, j) => (
                        <td key={j} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {file && (
          <div className="mt-8 flex gap-4 border-t border-gray-200 pt-6">
            <button
              onClick={handleImport}
              disabled={importing}
              type="button"
              className="px-8 py-3 bg-gold-500 text-white font-semibold rounded-lg hover:bg-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all duration-200"
            >
              {importing ? 'Importing...' : 'Confirm & Import Houses'}
            </button>
            <button
              onClick={handleBack}
              disabled={importing}
              type="button"
              className="px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      
      {result && (
        <div className="space-y-6">
          {/* Summary Card */}
          <div className={`p-6 rounded-lg border-2 ${
            result.success && result.summary.errors === 0
              ? 'bg-green-50 border-green-200' 
              : result.summary.errors > 0
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold mb-4 text-gray-900">
                  {result.success && result.summary.errors === 0 ? 'Import Completed Successfully!' :
                   result.summary.errors > 0 ? 'Import Completed with Errors' :
                   'Import Failed'}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-white bg-opacity-60 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gray-900">{result.summary.total}</div>
                    <div className="text-xs text-gray-600 uppercase">Total Rows</div>
                  </div>
                  
                  <div className="bg-white bg-opacity-60 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{result.summary.inserted}</div>
                    <div className="text-xs text-gray-600 uppercase">Inserted</div>
                  </div>
                  
                  <div className="bg-white bg-opacity-60 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gold-500">{result.summary.updated}</div>
                    <div className="text-xs text-gray-600 uppercase">Updated</div>
                  </div>
                  
                  <div className="bg-white bg-opacity-60 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-gray-600">{result.summary.skipped}</div>
                    <div className="text-xs text-gray-600 uppercase">Skipped</div>
                  </div>
                  
                  <div className="bg-white bg-opacity-60 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{result.summary.errors}</div>
                    <div className="text-xs text-gray-600 uppercase">Errors</div>
                  </div>
                </div>
                
                {result.error && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded text-sm text-red-800">
                    <strong>Fatal Error:</strong> {result.error}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Detailed Results */}
          {result.results && result.results.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Detailed Results</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Number</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit UID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {result.results.map((row, i) => (
                      <tr key={i} className={
                        row.status === 'error' ? 'bg-red-50' :
                        row.status === 'inserted' ? 'bg-green-50' :
                        row.status === 'updated' ? 'bg-gold-50' :
                        'bg-gray-50'
                      }>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.rowIndex}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            row.status === 'inserted' ? 'bg-green-100 text-green-800' :
                            row.status === 'updated' ? 'bg-gold-50 text-gold-700' :
                            row.status === 'skipped' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {row.status === 'inserted' ? 'Inserted' :
                             row.status === 'updated' ? 'Updated' :
                             row.status === 'skipped' ? 'Skipped' :
                             'Error'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{row.unitNumber || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{row.unitUid || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          {row.error ? (
                            <div>
                              <div className="text-red-800 font-medium">{row.error}</div>
                              {row.details && <div className="text-red-600 text-xs mt-1">{row.details}</div>}
                            </div>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {result.success && result.summary.errors === 0 && (
            <div className="text-center text-sm text-gray-600">
              Redirecting to development page in 3 seconds...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
