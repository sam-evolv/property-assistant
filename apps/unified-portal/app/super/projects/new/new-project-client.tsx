'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Upload, Building2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import Link from 'next/link';

interface ProjectDetails {
  name: string;
  address: string;
  image_url: string;
}

interface UnitType {
  name: string;
  floor_plan_pdf_url: string;
}

interface Unit {
  address: string;
  unit_type_name: string;
  purchaser_name: string;
  handover_date: string;
}

interface ParsedData {
  unitTypes: UnitType[];
  units: Unit[];
  errors: string[];
}

type Step = 'details' | 'upload' | 'review' | 'complete';

export default function NewProjectWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    name: '',
    address: '',
    image_url: '',
  });
  
  const [parsedData, setParsedData] = useState<ParsedData>({
    unitTypes: [],
    units: [],
    errors: [],
  });
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const res = await fetch('/api/projects/parse-excel', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to parse file');
      }
      
      const data = await res.json();
      setParsedData({
        unitTypes: data.unitTypes || [],
        units: data.units || [],
        errors: data.errors || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: projectDetails,
          unitTypes: parsedData.unitTypes,
          units: parsedData.units,
        }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }
      
      const data = await res.json();
      setCreatedProjectId(data.projectId);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToUpload = projectDetails.name.trim().length > 0;
  const canProceedToReview = parsedData.unitTypes.length > 0 || parsedData.units.length > 0;
  const canSubmit = canProceedToReview && parsedData.errors.length === 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Link href="/super" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        
        <SectionHeader
          title="Create New Project"
          description="Set up a new development project with unit types and units"
        />
        
        <div className="flex items-center gap-4 mb-8">
          {(['details', 'upload', 'review', 'complete'] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-gold-500 text-white' : 
                (['details', 'upload', 'review', 'complete'].indexOf(step) > idx) ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {(['details', 'upload', 'review', 'complete'].indexOf(step) > idx) ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                {s === 'details' ? 'Details' : s === 'upload' ? 'Upload' : s === 'review' ? 'Review' : 'Complete'}
              </span>
              {idx < 3 && <div className="w-12 h-px bg-gray-300" />}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {step === 'details' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-6 h-6 text-gold-600" />
              <h2 className="text-lg font-semibold text-gray-900">Project Details</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={projectDetails.name}
                  onChange={(e) => setProjectDetails({ ...projectDetails, name: e.target.value })}
                  placeholder="e.g., Longview Park"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={projectDetails.address}
                  onChange={(e) => setProjectDetails({ ...projectDetails, address: e.target.value })}
                  placeholder="e.g., 123 Main Street, Dublin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={projectDetails.image_url}
                  onChange={(e) => setProjectDetails({ ...projectDetails, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep('upload')}
                disabled={!canProceedToUpload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Upload Data
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <FileSpreadsheet className="w-6 h-6 text-gold-600" />
              <h2 className="text-lg font-semibold text-gray-900">Upload Excel File</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              Upload an Excel file with two sheets: <strong>unit_types</strong> and <strong>units</strong>.
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-gold-600 hover:text-gold-700 font-medium">Choose file</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {file && <p className="mt-2 text-sm text-gray-600">{file.name}</p>}
            </div>
            
            {parsedData.unitTypes.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm font-medium">
                  Found {parsedData.unitTypes.length} unit types and {parsedData.units.length} units
                </p>
              </div>
            )}
            
            {parsedData.errors.length > 0 && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm font-medium mb-2">Validation errors:</p>
                <ul className="list-disc list-inside text-sm text-red-600">
                  {parsedData.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </div>
            )}
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('details')}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!canProceedToReview}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Review
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Review & Confirm</h2>
            
            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Project</h3>
                <p className="text-gray-700">{projectDetails.name}</p>
                {projectDetails.address && <p className="text-sm text-gray-500">{projectDetails.address}</p>}
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Unit Types ({parsedData.unitTypes.length})</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {parsedData.unitTypes.slice(0, 5).map((ut, i) => (
                    <li key={i}>{ut.name}</li>
                  ))}
                  {parsedData.unitTypes.length > 5 && (
                    <li className="text-gray-400">...and {parsedData.unitTypes.length - 5} more</li>
                  )}
                </ul>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Units ({parsedData.units.length})</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  {parsedData.units.slice(0, 5).map((u, i) => (
                    <li key={i}>{u.address} - {u.unit_type_name}</li>
                  ))}
                  {parsedData.units.length > 5 && (
                    <li className="text-gray-400">...and {parsedData.units.length - 5} more</li>
                  )}
                </ul>
              </div>
            </div>
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Project'}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Project Created Successfully!</h2>
            <p className="text-gray-600 mb-6">Your project has been set up with all unit types and units.</p>
            
            <div className="flex justify-center gap-4">
              <Link
                href="/super"
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back to Overview
              </Link>
              {createdProjectId && (
                <Link
                  href={`/super/projects/${createdProjectId}/unit-types`}
                  className="px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600"
                >
                  View Unit Types
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
