'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Project {
  id: string;
  name: string;
}

interface UnitType {
  id: string;
  name: string;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: string[];
  error?: string;
}

interface ImportUnitsClientProps {
  projectId: string;
}

export function ImportUnitsClient({ projectId }: ImportUnitsClientProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  async function fetchData() {
    setIsLoading(true);
    try {
      const [projectRes, typesRes] = await Promise.all([
        fetch(`/api/developments/${projectId}`),
        fetch(`/api/projects/${projectId}/unit-types`),
      ]);

      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProject({
          id: projectData.development?.id || projectId,
          name: projectData.development?.name || 'Project',
        });
      }

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setUnitTypes(typesData.unitTypes || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/projects/${projectId}/import-units`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast.success(`Imported ${data.inserted} units`);
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch (error) {
      toast.error('Upload failed');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gold-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/super/developments"
          className="p-2 hover:bg-grey-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-grey-900">Import Units</h1>
          <p className="text-grey-600">{project?.name || 'Project'}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-grey-200 p-6">
          <h2 className="text-lg font-semibold text-grey-900 mb-4">Available Unit Types</h2>
          {unitTypes.length === 0 ? (
            <div className="text-center py-8">
              <FileSpreadsheet className="w-12 h-12 text-grey-300 mx-auto mb-4" />
              <p className="text-grey-700 font-medium mb-2">No unit types defined yet</p>
              <p className="text-grey-500 text-sm">
                Unit types will be created automatically from your Excel file during import.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {unitTypes.map((ut) => (
                  <span
                    key={ut.id}
                    className="px-3 py-1 bg-grey-100 text-grey-700 rounded-full text-sm font-medium"
                  >
                    {ut.name}
                  </span>
                ))}
              </div>
              <p className="text-grey-500 text-sm">
                New unit types in your file will be created automatically.
              </p>
            </>
          )}
        </div>

        <div className="bg-white rounded-lg border border-grey-200 p-6">
          <h2 className="text-lg font-semibold text-grey-900 mb-4">Upload File</h2>
          
          {unitTypes.length === 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-700">
                Unit types will be created automatically from your Excel file during import.
              </p>
            </div>
          )}

          <div className="border-2 border-dashed border-grey-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer flex flex-col items-center ${
                isUploading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-12 h-12 text-gold-500 animate-spin mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-grey-400 mb-4" />
              )}
              <span className="text-grey-700 font-medium">
                {isUploading ? 'Uploading...' : 'Click to upload CSV or Excel file'}
              </span>
              <span className="text-grey-500 text-sm mt-1">
                Required: unit identifier and unit type columns
              </span>
            </label>
          </div>

          <div className="mt-4 p-4 bg-grey-50 rounded-lg">
            <h3 className="text-sm font-semibold text-grey-700 mb-2">File Format</h3>
            <p className="text-sm text-grey-600 mb-2">
              Your file should have these columns:
            </p>
            <ul className="text-sm text-grey-600 space-y-1">
              <li><strong>Unit identifier:</strong> <code className="bg-grey-200 px-1 rounded">unit_number</code>, <code className="bg-grey-200 px-1 rounded">unit</code>, <code className="bg-grey-200 px-1 rounded">unit_no</code>, or <code className="bg-grey-200 px-1 rounded">address</code></li>
              <li><strong>Unit type:</strong> <code className="bg-grey-200 px-1 rounded">unit_type</code>, <code className="bg-grey-200 px-1 rounded">house_type_code</code>, <code className="bg-grey-200 px-1 rounded">house_type</code>, or <code className="bg-grey-200 px-1 rounded">type</code></li>
            </ul>
            <p className="text-sm text-grey-500 mt-2">
              Unit identifier will be stored as the unit address. Extra columns are ignored.
            </p>
          </div>
        </div>
      </div>

      {result && (
        <div className={`rounded-lg border p-6 ${
          result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-4">
            {result.success ? (
              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                {result.success ? 'Import Complete' : 'Import Failed'}
              </h3>
              
              {result.success ? (
                <div className="mt-2 text-green-700">
                  <p>Total rows: {result.totalRows}</p>
                  <p>Inserted: {result.inserted}</p>
                  <p>Skipped: {result.skipped}</p>
                </div>
              ) : (
                <p className="mt-2 text-red-700">{result.error}</p>
              )}

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-grey-800 mb-2">Details:</h4>
                  <ul className="text-sm space-y-1 max-h-40 overflow-y-auto">
                    {result.errors.map((err, idx) => (
                      <li key={idx} className="text-grey-700">{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
