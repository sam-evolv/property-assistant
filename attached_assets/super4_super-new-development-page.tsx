'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  FileText,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  Upload,
  Link as LinkIcon
} from 'lucide-react';
import { UnitImport } from '@/components/super/UnitImport';
import { DevelopmentBranding } from '@/components/super/DevelopmentBranding';

interface FormData {
  name: string;
  address: string;
  county: string;
  description: string;
  estimated_units: number;
  tenant_id: string;
  planning_reference: string;
  expected_handover: string;
  status: 'active' | 'inactive' | 'draft';
  // Branding
  sidebar_logo_url: string;
  assistant_logo_url: string;
  toolbar_logo_url: string;
  // AI
  system_instructions: string;
}

interface Tenant {
  id: string;
  name: string;
}

export default function NewDevelopmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check if coming from submission
  const fromSubmission = searchParams.get('from_submission');
  const submissionName = searchParams.get('name');
  const submissionAddress = searchParams.get('address');
  const submissionCounty = searchParams.get('county');
  const submissionUnits = searchParams.get('units');
  const submissionTenant = searchParams.get('tenant_id');
  const submissionPlanningRef = searchParams.get('planning_ref');
  const submissionHandover = searchParams.get('handover_date');
  const submissionSpreadsheet = searchParams.get('spreadsheet_url');

  const [step, setStep] = useState(1);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDevelopmentId, setCreatedDevelopmentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    name: submissionName || '',
    address: submissionAddress || '',
    county: submissionCounty || '',
    description: '',
    estimated_units: parseInt(submissionUnits || '0') || 0,
    tenant_id: submissionTenant || '',
    planning_reference: submissionPlanningRef || '',
    expected_handover: submissionHandover || '',
    status: 'active',
    sidebar_logo_url: '',
    assistant_logo_url: '',
    toolbar_logo_url: '',
    system_instructions: ''
  });

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await fetch('/api/super/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch {}
  };

  const handleChange = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBrandingUpload = async (file: File, type: 'sidebar' | 'assistant' | 'toolbar') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const res = await fetch('/api/super/branding/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
  };

  const createDevelopment = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/super/developments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          from_submission_id: fromSubmission || null
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create development');
      }

      const data = await res.json();
      setCreatedDevelopmentId(data.development.id);

      // Mark submission as completed if from submission
      if (fromSubmission) {
        await fetch(`/api/super/onboarding-submissions/${fromSubmission}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' })
        });
      }

      setStep(4); // Go to unit import step
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create development');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Details' },
    { number: 2, title: 'Branding' },
    { number: 3, title: 'AI Config' },
    { number: 4, title: 'Import Units' },
    { number: 5, title: 'Complete' }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Create Development</h1>
          {fromSubmission && (
            <p className="text-sm text-brand-600 mt-1">
              Creating from onboarding submission
            </p>
          )}
        </div>
      </div>

      {/* From Submission Banner */}
      {fromSubmission && submissionName && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-600" />
            <div>
              <p className="font-medium text-brand-900">Pre-filled from submission: {submissionName}</p>
              <p className="text-sm text-brand-700">Review and adjust details below, then import units</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="bg-white border border-gold-100 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <div className={`flex items-center gap-2 ${step >= s.number ? 'text-brand-600' : 'text-neutral-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.number 
                    ? 'bg-brand-500 text-white' 
                    : step === s.number 
                      ? 'bg-brand-100 text-brand-700 border-2 border-brand-500' 
                      : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {step > s.number ? <Check className="w-4 h-4" /> : s.number}
                </div>
                <span className="hidden sm:block text-sm font-medium">{s.title}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`w-12 lg:w-24 h-0.5 mx-2 ${step > s.number ? 'bg-brand-500' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-neutral-900">Development Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Development Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g., Longview Park"
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="e.g., Main Street, Mallow"
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                County *
              </label>
              <select
                value={formData.county}
                onChange={(e) => handleChange('county', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              >
                <option value="">Select county</option>
                {['Cork', 'Dublin', 'Galway', 'Limerick', 'Kerry', 'Waterford', 'Tipperary', 'Clare', 'Mayo', 'Wexford', 'Kilkenny', 'Wicklow', 'Kildare', 'Meath', 'Louth', 'Donegal', 'Sligo', 'Offaly', 'Laois', 'Westmeath', 'Longford', 'Roscommon', 'Leitrim', 'Cavan', 'Monaghan', 'Carlow'].sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Developer *
              </label>
              <select
                value={formData.tenant_id}
                onChange={(e) => handleChange('tenant_id', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              >
                <option value="">Select developer</option>
                {tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Estimated Units
              </label>
              <input
                type="number"
                value={formData.estimated_units || ''}
                onChange={(e) => handleChange('estimated_units', parseInt(e.target.value) || 0)}
                placeholder="e.g., 75"
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Planning Reference
              </label>
              <input
                type="text"
                value={formData.planning_reference}
                onChange={(e) => handleChange('planning_reference', e.target.value)}
                placeholder="e.g., 22/12345"
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Expected Handover Date
              </label>
              <input
                type="date"
                value={formData.expected_handover}
                onChange={(e) => handleChange('expected_handover', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all"
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              disabled={!formData.name || !formData.address || !formData.tenant_id}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              Next: Branding
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Branding */}
      {step === 2 && (
        <div className="space-y-6">
          <DevelopmentBranding
            sidebarLogo={formData.sidebar_logo_url}
            assistantLogo={formData.assistant_logo_url}
            toolbarLogo={formData.toolbar_logo_url}
            onSidebarLogoChange={(url) => handleChange('sidebar_logo_url', url || '')}
            onAssistantLogoChange={(url) => handleChange('assistant_logo_url', url || '')}
            onToolbarLogoChange={(url) => handleChange('toolbar_logo_url', url || '')}
            onUpload={handleBrandingUpload}
          />

          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors flex items-center gap-2"
            >
              Next: AI Config
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: AI Configuration */}
      {step === 3 && (
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-semibold text-neutral-900">AI Assistant Configuration</h2>
          
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Custom Instructions (Optional)
            </label>
            <p className="text-xs text-neutral-500 mb-2">
              Add specific instructions for how the AI should respond for this development
            </p>
            <textarea
              value={formData.system_instructions}
              onChange={(e) => handleChange('system_instructions', e.target.value)}
              rows={6}
              placeholder="e.g., Always mention that the management company is ABC Management. The warranty period is 2 years from handover..."
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none transition-all resize-none"
            />
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={createDevelopment}
              disabled={loading}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create Development
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Unit Import */}
      {step === 4 && createdDevelopmentId && (
        <div className="space-y-6">
          <UnitImport
            developmentId={createdDevelopmentId}
            developmentName={formData.name}
            tenantId={formData.tenant_id}
            spreadsheetUrl={submissionSpreadsheet || undefined}
            onImportComplete={(count) => {
              console.log(`Imported ${count} units`);
            }}
          />

          <div className="flex justify-between">
            <button
              onClick={() => setStep(5)}
              className="px-6 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
            >
              Skip for Now
            </button>
            <button
              onClick={() => setStep(5)}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 5 && (
        <div className="bg-white border border-gold-100 rounded-lg p-8 shadow-sm text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Development Created!</h2>
          <p className="text-neutral-500 mt-2">
            {formData.name} has been set up successfully.
          </p>

          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => router.push('/super/developments')}
              className="px-6 py-2.5 border border-neutral-200 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
            >
              View All Developments
            </button>
            <button
              onClick={() => router.push(`/super/developments/${createdDevelopmentId}`)}
              className="px-6 py-2.5 bg-brand-500 text-white rounded-lg font-medium hover:bg-brand-600 transition-colors"
            >
              Manage Development
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
