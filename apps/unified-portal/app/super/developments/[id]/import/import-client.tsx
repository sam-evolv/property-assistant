'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';

interface ImportResult {
  success: boolean;
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: string[];
  development?: { id: string; name: string };
  error?: string;
}

export default function ImportUnitsClient({
  developmentId,
  developmentName,
}: {
  developmentId: string;
  developmentName: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const validateAndSetFile = (f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      alert('Please upload a CSV or Excel file (.csv, .xlsx, .xls)');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/developments/${developmentId}/import-units`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          totalRows: 0,
          inserted: 0,
          skipped: 0,
          errors: [],
          error: data.error || 'Import failed',
        });
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setResult({
        success: false,
        totalRows: 0,
        inserted: 0,
        skipped: 0,
        errors: [],
        error: err.message || 'Network error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = `address_line_1,house_type_code,bedrooms_raw,property_designation,property_type_raw,eircode
1 Main Street,TYPE-A,3 Bed,Unit 1,Semi-Detached,D01AB12
2 Main Street,TYPE-B,4 Bed,Unit 2,Detached,D01AB13
3 Main Street,TYPE-A,3 Bed,Unit 3,Semi-Detached,D01AB14`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `units-template-${developmentName.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gold-900/20 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">CSV Format</h2>
        <p className="text-gray-400 text-sm mb-4">
          Your CSV/Excel file should have the following columns:
        </p>
        <div className="bg-gray-800 rounded-lg p-4 overflow-x-auto">
          <table className="text-sm text-gray-300 w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-3 font-medium">Column</th>
                <th className="text-left py-2 px-3 font-medium">Required</th>
                <th className="text-left py-2 px-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-700/50">
                <td className="py-2 px-3 font-mono text-gold-400">address_line_1</td>
                <td className="py-2 px-3 text-green-400">Yes</td>
                <td className="py-2 px-3">Full address (e.g., &quot;1 Main Street&quot;)</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2 px-3 font-mono text-gold-400">house_type_code</td>
                <td className="py-2 px-3 text-green-400">Yes</td>
                <td className="py-2 px-3">House type code (e.g., &quot;TYPE-A&quot;)</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2 px-3 font-mono text-gray-400">bedrooms_raw</td>
                <td className="py-2 px-3 text-gray-500">No</td>
                <td className="py-2 px-3">Number of bedrooms (e.g., &quot;3 Bed&quot; or &quot;3&quot;)</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2 px-3 font-mono text-gray-400">property_designation</td>
                <td className="py-2 px-3 text-gray-500">No</td>
                <td className="py-2 px-3">Property designation (e.g., &quot;Unit 1&quot;)</td>
              </tr>
              <tr className="border-b border-gray-700/50">
                <td className="py-2 px-3 font-mono text-gray-400">property_type_raw</td>
                <td className="py-2 px-3 text-gray-500">No</td>
                <td className="py-2 px-3">Property type (e.g., &quot;Semi-Detached&quot;)</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-mono text-gray-400">eircode</td>
                <td className="py-2 px-3 text-gray-500">No</td>
                <td className="py-2 px-3">Irish Eircode (e.g., &quot;D01AB12&quot;)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <button
          onClick={downloadTemplate}
          className="mt-4 flex items-center gap-2 text-gold-400 hover:text-gold-300 text-sm"
        >
          <Download className="w-4 h-4" />
          Download CSV Template
        </button>
      </div>

      <div
        className={`bg-gray-900 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-gold-400 bg-gold-500/5'
            : 'border-gold-900/30 hover:border-gold-900/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          className="hidden"
        />

        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-gold-400" />
            <div className="text-left">
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-gray-500 text-sm">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              onClick={() => {
                setFile(null);
                setResult(null);
              }}
              className="ml-4 text-gray-400 hover:text-red-400"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <Upload className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">
              Drag and drop your CSV or Excel file here
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gold-400 hover:text-gold-300 font-medium"
            >
              or click to browse
            </button>
          </div>
        )}
      </div>

      {file && (
        <div className="flex justify-end">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex items-center gap-2 px-6 py-3 bg-gold-500 hover:bg-gold-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Import Units
              </>
            )}
          </button>
        </div>
      )}

      {result && (
        <div
          className={`rounded-lg p-6 ${
            result.success
              ? 'bg-green-900/20 border border-green-500/30'
              : 'bg-red-900/20 border border-red-500/30'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3
                className={`font-semibold ${
                  result.success ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {result.success ? 'Import Complete' : 'Import Failed'}
              </h3>

              {result.success ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-4">
                    <div className="text-gray-400">
                      Total rows: <span className="text-white font-medium">{result.totalRows}</span>
                    </div>
                    <div className="text-gray-400">
                      Inserted: <span className="text-green-400 font-medium">{result.inserted}</span>
                    </div>
                    <div className="text-gray-400">
                      Skipped (duplicates): <span className="text-yellow-400 font-medium">{result.skipped}</span>
                    </div>
                  </div>

                  {result.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-yellow-400 font-medium mb-2">
                        {result.errors.length} row(s) had issues:
                      </p>
                      <ul className="list-disc list-inside text-gray-400 space-y-1">
                        {result.errors.slice(0, 10).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {result.errors.length > 10 && (
                          <li className="text-gray-500">
                            ...and {result.errors.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-red-300">{result.error}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
