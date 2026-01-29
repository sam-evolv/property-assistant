'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const IRISH_COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal',
  'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny',
  'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath',
  'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Tyrone',
  'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
];

interface FormData {
  developmentName: string;
  developmentAddress: string;
  county: string;
  estimatedUnits: string;
  expectedHandoverDate: string;
  planningReference: string;
  planningPackUrl: string;
  notes: string;
}

export default function CreateDevelopmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterSpreadsheet, setMasterSpreadsheet] = useState<File | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<File[]>([]);
  
  const [formData, setFormData] = useState<FormData>({
    developmentName: '',
    developmentAddress: '',
    county: '',
    estimatedUnits: '',
    expectedHandoverDate: '',
    planningReference: '',
    planningPackUrl: '',
    notes: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMasterSpreadsheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setMasterSpreadsheet(e.target.files[0]);
    }
  };

  const handleSupportingDocsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSupportingDocs(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formPayload = new FormData();
      formPayload.append('developmentName', formData.developmentName);
      formPayload.append('developmentAddress', formData.developmentAddress);
      formPayload.append('county', formData.county);
      formPayload.append('estimatedUnits', formData.estimatedUnits);
      formPayload.append('expectedHandoverDate', formData.expectedHandoverDate);
      formPayload.append('planningReference', formData.planningReference);
      formPayload.append('planningPackUrl', formData.planningPackUrl);
      formPayload.append('notes', formData.notes);

      if (masterSpreadsheet) {
        formPayload.append('masterSpreadsheet', masterSpreadsheet);
      }

      supportingDocs.forEach((doc, index) => {
        formPayload.append(`supportingDoc_${index}`, doc);
      });

      const response = await fetch('/api/onboarding/submit', {
        method: 'POST',
        body: formPayload,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit');
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/developer');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-grey-50/50 to-gold-50/20 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl border border-grey-200 shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-black mb-3">Thank You!</h1>
          <p className="text-grey-600 mb-6">
            We've received your development submission. Our team will be in touch within 48 hours to schedule your onboarding call.
          </p>
          <p className="text-sm text-grey-500">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-grey-50/50 to-gold-50/20 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-grey-200 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-black to-grey-900 px-8 py-6">
            <h1 className="text-2xl font-bold text-gold-500">Create Your First Development</h1>
            <p className="text-gold-200/80 mt-1">Tell us about your development to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Development Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="developmentName"
                value={formData.developmentName}
                onChange={handleInputChange}
                required
                placeholder="e.g., Riverside Manor"
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Development Address <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="developmentAddress"
                value={formData.developmentAddress}
                onChange={handleInputChange}
                required
                placeholder="e.g., Main Street, Swords"
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                County <span className="text-red-500">*</span>
              </label>
              <select
                name="county"
                value={formData.county}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all bg-white text-neutral-900"
              >
                <option value="">Select county...</option>
                {IRISH_COUNTIES.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Estimated Number of Units <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="estimatedUnits"
                value={formData.estimatedUnits}
                onChange={handleInputChange}
                required
                min="1"
                placeholder="e.g., 50"
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Expected First Handovers
              </label>
              <input
                type="date"
                name="expectedHandoverDate"
                value={formData.expectedHandoverDate}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Planning Reference
              </label>
              <input
                type="text"
                name="planningReference"
                value={formData.planningReference}
                onChange={handleInputChange}
                placeholder="e.g., 22/12345"
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Planning Pack URL
              </label>
              <input
                type="url"
                name="planningPackUrl"
                value={formData.planningPackUrl}
                onChange={handleInputChange}
                placeholder="Link to your public planning documents website"
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Master Spreadsheet
              </label>
              <div className="border-2 border-dashed border-grey-300 rounded-lg p-4 hover:border-gold-500 transition-colors">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={handleMasterSpreadsheetChange}
                  className="w-full text-sm text-neutral-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                />
                <p className="mt-2 text-xs text-grey-500">Accepted formats: .xlsx, .csv</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Supporting Documents
              </label>
              <div className="border-2 border-dashed border-grey-300 rounded-lg p-4 hover:border-gold-500 transition-colors">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  multiple
                  onChange={handleSupportingDocsChange}
                  className="w-full text-sm text-neutral-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gold-50 file:text-gold-700 hover:file:bg-gold-100"
                />
                <p className="mt-2 text-xs text-grey-500">Accepted formats: .pdf, .docx (multiple files allowed)</p>
                {supportingDocs.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {supportingDocs.map((file, index) => (
                      <div key={index} className="text-sm text-neutral-700 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {file.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-900 mb-2">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                placeholder="Any additional information about your development..."
                className="w-full px-4 py-3 border border-grey-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500 outline-none transition-all resize-none text-neutral-900 placeholder:text-grey-400"
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Development'
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-grey-500">
            Need help? Contact{' '}
            <a href="mailto:sam@openhouseai.ie" className="text-gold-600 hover:text-gold-700 font-medium">
              sam@openhouseai.ie
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
