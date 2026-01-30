'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Upload, Building2, FileSpreadsheet, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { DevelopmentBranding } from '@/components/super/DevelopmentBranding';
import Link from 'next/link';

interface ProjectDetails {
  name: string;
  code: string;
  address: string;
  tenant_id: string;
  image_url: string;
  sidebar_logo_url: string;
  assistant_logo_url: string;
  toolbar_logo_url: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
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

type Step = 'details' | 'branding' | 'upload' | 'review' | 'complete';

function NewProjectWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const fromSubmissionId = searchParams.get('from_submission');
  const prefillName = searchParams.get('name') || '';
  const prefillAddress = searchParams.get('address') || '';
  const prefillCounty = searchParams.get('county') || '';
  const prefillUnits = searchParams.get('units') || '';
  const prefillTenantId = searchParams.get('tenant_id') || '';
  const prefillPlanningRef = searchParams.get('planning_ref') || '';

  const [step, setStep] = useState<Step>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  
  const fullAddress = prefillAddress && prefillCounty 
    ? `${prefillAddress}, ${prefillCounty}` 
    : prefillAddress || '';
  
  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({
    name: prefillName,
    code: '',
    address: fullAddress,
    tenant_id: prefillTenantId,
    image_url: '',
    sidebar_logo_url: '',
    assistant_logo_url: '',
    toolbar_logo_url: '',
  });
  
  const [parsedData, setParsedData] = useState<ParsedData>({
    unitTypes: [],
    units: [],
    errors: [],
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (projectDetails.name && !projectDetails.code) {
      const generatedCode = projectDetails.name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20);
      setProjectDetails(prev => ({ ...prev, code: generatedCode }));
    }
  }, [projectDetails.name]);

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/super/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    } finally {
      setTenantsLoading(false);
    }
  };

  const handleBrandingUpload = async (file: File, type: 'sidebar' | 'assistant' | 'toolbar'): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const res = await fetch('/api/super/branding/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Upload failed');
    }
    
    const data = await res.json();
    return data.url;
  };

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
      const payload = {
        name: projectDetails.name.trim(),
        code: projectDetails.code.trim().toUpperCase(),
        tenant_id: projectDetails.tenant_id,
        address: projectDetails.address.trim() || null,
        sidebar_logo_url: projectDetails.sidebar_logo_url || null,
        assistant_logo_url: projectDetails.assistant_logo_url || null,
        toolbar_logo_url: projectDetails.toolbar_logo_url || null,
        from_submission_id: fromSubmissionId || null,
        unitTypes: parsedData.unitTypes,
        units: parsedData.units,
      };

      const res = await fetch('/api/super/developments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }
      
      const data = await res.json();
      setCreatedProjectId(data.id || data.projectId);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceedToUpload = projectDetails.name.trim().length > 0 && projectDetails.tenant_id;
  const canProceedToReview = true;
  const canSubmit = projectDetails.name.trim().length > 0 && projectDetails.tenant_id && parsedData.errors.length === 0;

  const stepOrder: Step[] = ['details', 'branding', 'upload', 'review', 'complete'];
  const stepLabels: Record<Step, string> = {
    details: 'Details',
    branding: 'Branding',
    upload: 'Upload',
    review: 'Review',
    complete: 'Complete',
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Link href="/super/developments" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Developments
        </Link>
        
        <SectionHeader
          title="Create New Development"
          description="Set up a new development project with branding and unit data"
        />

        {fromSubmissionId && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900">Creating from Onboarding Submission</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Development: <strong>{prefillName}</strong>
                  {prefillAddress && ` | ${prefillAddress}`}
                  {prefillCounty && `, ${prefillCounty}`}
                </p>
                {prefillUnits && (
                  <p className="text-xs text-amber-600 mt-1">
                    Estimated Units: {prefillUnits} | Planning Ref: {prefillPlanningRef || 'N/A'}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-2 mb-8 flex-wrap">
          {stepOrder.map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-amber-500 text-white' : 
                stepOrder.indexOf(step) > idx ? 'bg-green-500 text-white' :
                'bg-gray-200 text-gray-600'
              }`}>
                {stepOrder.indexOf(step) > idx ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-900'}`}>
                {stepLabels[s]}
              </span>
              {idx < stepOrder.length - 1 && <div className="w-8 h-px bg-gray-300" />}
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
              <Building2 className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Development Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Development Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectDetails.name}
                    onChange={(e) => setProjectDetails({ ...projectDetails, name: e.target.value })}
                    placeholder="e.g., Parkview Gardens"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Development Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={projectDetails.code}
                    onChange={(e) => setProjectDetails({ ...projectDetails, code: e.target.value.toUpperCase() })}
                    placeholder="e.g., PVG-001"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tenant <span className="text-red-500">*</span>
                </label>
                <select
                  value={projectDetails.tenant_id}
                  onChange={(e) => setProjectDetails({ ...projectDetails, tenant_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  disabled={tenantsLoading}
                >
                  <option value="">Select a tenant...</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.slug})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={projectDetails.address}
                  onChange={(e) => setProjectDetails({ ...projectDetails, address: e.target.value })}
                  placeholder="e.g., 123 Main Street, Dublin"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep('branding')}
                disabled={!canProceedToUpload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Branding
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'branding' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <ImageIcon className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Development Branding</h2>
            </div>
            
            <p className="text-sm text-gray-900 mb-6">
              Upload logos for different areas of the purchaser portal. You can skip this step and add logos later.
            </p>
            
            <DevelopmentBranding
              sidebarLogo={projectDetails.sidebar_logo_url}
              assistantLogo={projectDetails.assistant_logo_url}
              toolbarLogo={projectDetails.toolbar_logo_url}
              onSidebarLogoChange={(url) => setProjectDetails({ ...projectDetails, sidebar_logo_url: url })}
              onAssistantLogoChange={(url) => setProjectDetails({ ...projectDetails, assistant_logo_url: url })}
              onToolbarLogoChange={(url) => setProjectDetails({ ...projectDetails, toolbar_logo_url: url })}
              onUpload={handleBrandingUpload}
            />
            
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep('details')}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
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
              <FileSpreadsheet className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-semibold text-gray-900">Upload Excel File (Optional)</h2>
            </div>
            
            <p className="text-sm text-gray-900 mb-4">
              This step is optional. You can skip it and add units later through the development management interface.
              If you have a prepared Excel file with <strong>unit_types</strong> and <strong>units</strong> sheets, you can upload it for validation preview.
            </p>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-4" />
              <label className="cursor-pointer">
                <span className="text-amber-600 hover:text-amber-700 font-medium">Choose file</span>
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
                onClick={() => setStep('branding')}
                className="inline-flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setStep('review')}
                disabled={!canProceedToReview}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
            
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Development</h3>
                <p className="text-gray-700">{projectDetails.name}</p>
                <p className="text-sm text-gray-500">Code: {projectDetails.code}</p>
                {projectDetails.address && <p className="text-sm text-gray-500">{projectDetails.address}</p>}
                <p className="text-sm text-gray-500">
                  Tenant: {tenants.find(t => t.id === projectDetails.tenant_id)?.name || 'N/A'}
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-2">Branding</h3>
                <div className="flex gap-4">
                  {projectDetails.sidebar_logo_url ? (
                    <img src={projectDetails.sidebar_logo_url} alt="Sidebar" className="h-10 object-contain" />
                  ) : <span className="text-sm text-gray-400">No sidebar logo</span>}
                  {projectDetails.assistant_logo_url ? (
                    <img src={projectDetails.assistant_logo_url} alt="Assistant" className="h-10 object-contain" />
                  ) : <span className="text-sm text-gray-400">No assistant logo</span>}
                  {projectDetails.toolbar_logo_url ? (
                    <img src={projectDetails.toolbar_logo_url} alt="Toolbar" className="h-10 object-contain" />
                  ) : <span className="text-sm text-gray-400">No toolbar logo</span>}
                </div>
              </div>
              
              {(parsedData.unitTypes.length > 0 || parsedData.units.length > 0) && (
                <>
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
                </>
              )}
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
                {isSubmitting ? 'Creating...' : 'Create Development'}
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
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Development Created Successfully!</h2>
            <p className="text-gray-600 mb-6">
              {fromSubmissionId 
                ? 'The development has been created and the onboarding submission has been marked as completed.'
                : 'Your development has been set up with all configurations.'
              }
            </p>
            
            <div className="flex justify-center gap-4">
              <Link
                href="/super/developments"
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Back to Developments
              </Link>
              {createdProjectId && (
                <Link
                  href={`/super/projects/${createdProjectId}/unit-types`}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600"
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

export default function NewProjectWizard() {
  return (
    <Suspense fallback={
      <div className="p-8 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <NewProjectWizardContent />
    </Suspense>
  );
}
