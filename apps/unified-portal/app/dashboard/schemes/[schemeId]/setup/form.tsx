'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, CheckCircle, AlertCircle, ChevronDown, ChevronUp, FileText, Building2, Phone, Flame, Trash2, Car, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { MapLocationPicker } from '@/components/common/MapLocationPicker';

type AuthoritySource = 'form' | 'documents' | 'unknown';
type SchemeStatus = 'under_construction' | 'partially_occupied' | 'fully_occupied';
type SnagMethod = 'email' | 'portal' | 'form' | 'developer_contact' | 'unknown';
type HeatingType = 'air_to_water' | 'gas_boiler' | 'district' | 'mixed' | 'unknown';
type HeatingControls = 'central_controller' | 'zoned_thermostats' | 'unknown';
type BroadbandType = 'siro' | 'openeir' | 'other' | 'unknown';
type WaterBilling = 'direct' | 'via_management' | 'unknown';
type WasteSetup = 'individual_bins' | 'communal_store' | 'mixed' | 'unknown';
type ParkingType = 'allocated' | 'unallocated' | 'permit' | 'mixed' | 'unknown';
type VisitorParking = 'yes_designated' | 'limited' | 'none' | 'unknown';
type ApprovalRequired = 'yes' | 'no' | 'case_by_case' | 'unknown';

interface SchemeProfile {
  id?: string;
  developer_org_id?: string;
  scheme_name: string;
  scheme_address: string;
  scheme_lat: number | null;
  scheme_lng: number | null;
  scheme_status: SchemeStatus;
  homes_count: number | null;
  managing_agent_name: string;
  contact_email: string;
  contact_phone: string;
  emergency_contact_phone: string;
  emergency_contact_notes: string;
  snag_reporting_method: SnagMethod;
  snag_reporting_details: string;
  heating_type: HeatingType;
  heating_controls: HeatingControls;
  broadband_type: BroadbandType;
  water_billing: WaterBilling;
  waste_setup: WasteSetup;
  bin_storage_notes: string;
  waste_provider: string;
  parking_type: ParkingType;
  visitor_parking: VisitorParking;
  parking_notes: string;
  has_house_rules: boolean;
  exterior_changes_require_approval: ApprovalRequired;
  rules_notes: string;
  authority_contacts: AuthoritySource;
  authority_core_facts: AuthoritySource;
  authority_waste_parking: AuthoritySource;
  authority_rules: AuthoritySource;
  authority_snagging: AuthoritySource;
}

const defaultProfile: SchemeProfile = {
  scheme_name: '',
  scheme_address: '',
  scheme_lat: null,
  scheme_lng: null,
  scheme_status: 'under_construction',
  homes_count: null,
  managing_agent_name: '',
  contact_email: '',
  contact_phone: '',
  emergency_contact_phone: '',
  emergency_contact_notes: '',
  snag_reporting_method: 'unknown',
  snag_reporting_details: '',
  heating_type: 'unknown',
  heating_controls: 'unknown',
  broadband_type: 'unknown',
  water_billing: 'unknown',
  waste_setup: 'unknown',
  bin_storage_notes: '',
  waste_provider: '',
  parking_type: 'unknown',
  visitor_parking: 'unknown',
  parking_notes: '',
  has_house_rules: false,
  exterior_changes_require_approval: 'unknown',
  rules_notes: '',
  authority_contacts: 'form',
  authority_core_facts: 'form',
  authority_waste_parking: 'form',
  authority_rules: 'form',
  authority_snagging: 'form',
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  authorityFlag: AuthoritySource;
  onAuthorityChange: (value: AuthoritySource) => void;
  children: React.ReactNode;
  description?: string;
}

function CollapsibleSection({ title, icon, authorityFlag, onAuthorityChange, children, description }: CollapsibleSectionProps) {
  const isDocuments = authorityFlag === 'documents';
  const [isExpanded, setIsExpanded] = useState(!isDocuments);
  
  useEffect(() => {
    setIsExpanded(!isDocuments);
  }, [isDocuments]);
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold-100 rounded-lg">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>
        </div>
        
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isDocuments}
            onChange={(e) => onAuthorityChange(e.target.checked ? 'documents' : 'form')}
            className="w-4 h-4 text-gold-600 border-gray-300 rounded focus:ring-gold-500"
          />
          <span className="text-sm text-gray-600">
            <FileText className="w-4 h-4 inline mr-1" />
            This section is covered by uploaded documents
          </span>
        </label>
      </div>
      
      {isExpanded && (
        <div className={`p-4 space-y-4 ${isDocuments ? 'opacity-50' : ''}`}>
          {isDocuments && (
            <div className="text-sm text-gray-500 italic mb-4">
              Fields are optional when section is covered by documents.
            </div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function SchemeSetupForm({ schemeId }: { schemeId: string }) {
  const [profile, setProfile] = useState<SchemeProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch(`/api/schemes/${schemeId}/profile`);
        const data = await res.json();
        
        if (data.profile) {
          setProfile({ ...defaultProfile, ...data.profile });
        } else {
          setIsNew(true);
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    }
    
    loadProfile();
  }, [schemeId]);
  
  const updateField = useCallback((field: keyof SchemeProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSuccess(null);
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    
    try {
      const res = await fetch(`/api/schemes/${schemeId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }
      
      setProfile({ ...defaultProfile, ...data.profile });
      setSuccess(data.message || 'Saved successfully');
      setIsNew(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
      </div>
    );
  }
  
  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500";
  const selectClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500 bg-white";
  
  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-gold-500 hover:text-gold-600 flex items-center gap-1 mb-3 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-gold-100 to-gold-50 rounded-xl">
            <Building2 className="w-6 h-6 text-gold-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheme Setup</h1>
            <p className="text-sm text-gray-500">Configure your development profile for the AI assistant</p>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-700">{success}</p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Development Identity */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-gold-100 rounded-lg">
              <Building2 className="w-5 h-5 text-gold-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Development Identity</h3>
              <p className="text-sm text-gray-500">Basic information about the scheme</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Scheme Name" required>
              <input
                type="text"
                value={profile.scheme_name}
                onChange={(e) => updateField('scheme_name', e.target.value)}
                className={inputClass}
                placeholder="e.g., Longview Park"
                required
              />
            </FormField>
            
            <FormField label="Number of Homes">
              <input
                type="number"
                value={profile.homes_count ?? ''}
                onChange={(e) => updateField('homes_count', e.target.value ? parseInt(e.target.value) : null)}
                className={inputClass}
                placeholder="e.g., 120"
                min="1"
              />
            </FormField>
            
            <div className="md:col-span-2">
              <FormField label="Scheme Address">
                <input
                  type="text"
                  value={profile.scheme_address}
                  onChange={(e) => updateField('scheme_address', e.target.value)}
                  className={inputClass}
                  placeholder="Full address including postcode"
                />
              </FormField>
            </div>
            
            <FormField label="Scheme Status">
              <select
                value={profile.scheme_status}
                onChange={(e) => updateField('scheme_status', e.target.value)}
                className={selectClass}
              >
                <option value="under_construction">Under Construction</option>
                <option value="partially_occupied">Partially Occupied</option>
                <option value="fully_occupied">Fully Occupied</option>
              </select>
            </FormField>
            
            <div className="md:col-span-2">
              <FormField label="Location (for nearby places)">
                <MapLocationPicker
                  latitude={profile.scheme_lat}
                  longitude={profile.scheme_lng}
                  address={profile.scheme_address}
                  onLocationChange={(lat, lng) => {
                    updateField('scheme_lat', lat);
                    updateField('scheme_lng', lng);
                  }}
                />
              </FormField>
            </div>
          </div>
        </div>
        
        {/* Section 2: Management & Contacts */}
        <CollapsibleSection
          title="Management & Contacts"
          icon={<Phone className="w-5 h-5 text-gold-600" />}
          description="Contact details for management and emergencies"
          authorityFlag={profile.authority_contacts}
          onAuthorityChange={(v) => updateField('authority_contacts', v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Managing Agent Name" required={profile.authority_contacts === 'form'}>
              <input
                type="text"
                value={profile.managing_agent_name}
                onChange={(e) => updateField('managing_agent_name', e.target.value)}
                className={inputClass}
                placeholder="Property Management Co."
                required={profile.authority_contacts === 'form'}
              />
            </FormField>
            
            <FormField label="Contact Email" required={profile.authority_contacts === 'form'}>
              <input
                type="email"
                value={profile.contact_email}
                onChange={(e) => updateField('contact_email', e.target.value)}
                className={inputClass}
                placeholder="contact@example.com"
                required={profile.authority_contacts === 'form'}
              />
            </FormField>
            
            <FormField label="Contact Phone" required={profile.authority_contacts === 'form'}>
              <input
                type="tel"
                value={profile.contact_phone}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                className={inputClass}
                placeholder="+353 1 234 5678"
                required={profile.authority_contacts === 'form'}
              />
            </FormField>
            
            <FormField label="Emergency Contact Phone">
              <input
                type="tel"
                value={profile.emergency_contact_phone}
                onChange={(e) => updateField('emergency_contact_phone', e.target.value)}
                className={inputClass}
                placeholder="24/7 emergency number"
              />
            </FormField>
            
            <div className="md:col-span-2">
              <FormField label="Emergency Contact Notes">
                <textarea
                  value={profile.emergency_contact_notes}
                  onChange={(e) => updateField('emergency_contact_notes', e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="When to use the emergency contact, available hours, etc."
                />
              </FormField>
            </div>
            
            <FormField label="Snag Reporting Method">
              <select
                value={profile.snag_reporting_method}
                onChange={(e) => updateField('snag_reporting_method', e.target.value)}
                className={selectClass}
              >
                <option value="unknown">Not specified</option>
                <option value="email">Email</option>
                <option value="portal">Online Portal</option>
                <option value="form">Form</option>
                <option value="developer_contact">Contact Developer Directly</option>
              </select>
            </FormField>
            
            <FormField label="Snag Reporting Details">
              <input
                type="text"
                value={profile.snag_reporting_details}
                onChange={(e) => updateField('snag_reporting_details', e.target.value)}
                className={inputClass}
                placeholder="URL or email for snag reporting"
              />
            </FormField>
          </div>
        </CollapsibleSection>
        
        {/* Section 3: Core Property Facts */}
        <CollapsibleSection
          title="Core Property Facts"
          icon={<Flame className="w-5 h-5 text-gold-600" />}
          description="Heating, broadband, and utilities"
          authorityFlag={profile.authority_core_facts}
          onAuthorityChange={(v) => updateField('authority_core_facts', v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Heating Type" required={profile.authority_core_facts === 'form'}>
              <select
                value={profile.heating_type}
                onChange={(e) => updateField('heating_type', e.target.value)}
                className={selectClass}
                required={profile.authority_core_facts === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="air_to_water">Air to Water Heat Pump</option>
                <option value="gas_boiler">Gas Boiler</option>
                <option value="district">District Heating</option>
                <option value="mixed">Mixed (varies by unit)</option>
              </select>
            </FormField>
            
            <FormField label="Heating Controls" required={profile.authority_core_facts === 'form'}>
              <select
                value={profile.heating_controls}
                onChange={(e) => updateField('heating_controls', e.target.value)}
                className={selectClass}
                required={profile.authority_core_facts === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="central_controller">Central Controller</option>
                <option value="zoned_thermostats">Zoned Thermostats</option>
              </select>
            </FormField>
            
            <FormField label="Broadband Type" required={profile.authority_core_facts === 'form'}>
              <select
                value={profile.broadband_type}
                onChange={(e) => updateField('broadband_type', e.target.value)}
                className={selectClass}
                required={profile.authority_core_facts === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="siro">SIRO (Fibre)</option>
                <option value="openeir">Open Eir</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            
            <FormField label="Water Billing" required={profile.authority_core_facts === 'form'}>
              <select
                value={profile.water_billing}
                onChange={(e) => updateField('water_billing', e.target.value)}
                className={selectClass}
                required={profile.authority_core_facts === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="direct">Direct to Irish Water</option>
                <option value="via_management">Via Management Company</option>
              </select>
            </FormField>
          </div>
        </CollapsibleSection>
        
        {/* Section 4: Waste & Parking */}
        <CollapsibleSection
          title="Waste & Parking"
          icon={<Car className="w-5 h-5 text-gold-600" />}
          description="Bin collection and parking arrangements"
          authorityFlag={profile.authority_waste_parking}
          onAuthorityChange={(v) => updateField('authority_waste_parking', v)}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Waste Setup" required={profile.authority_waste_parking === 'form'}>
              <select
                value={profile.waste_setup}
                onChange={(e) => updateField('waste_setup', e.target.value)}
                className={selectClass}
                required={profile.authority_waste_parking === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="individual_bins">Individual Bins</option>
                <option value="communal_store">Communal Bin Store</option>
                <option value="mixed">Mixed</option>
              </select>
            </FormField>
            
            <FormField label="Waste Provider">
              <input
                type="text"
                value={profile.waste_provider}
                onChange={(e) => updateField('waste_provider', e.target.value)}
                className={inputClass}
                placeholder="e.g., Panda, Greyhound"
              />
            </FormField>
            
            <div className="md:col-span-2">
              <FormField label="Bin Storage Notes">
                <textarea
                  value={profile.bin_storage_notes}
                  onChange={(e) => updateField('bin_storage_notes', e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="Location of bin stores, collection days, sorting instructions..."
                />
              </FormField>
            </div>
            
            <FormField label="Parking Type" required={profile.authority_waste_parking === 'form'}>
              <select
                value={profile.parking_type}
                onChange={(e) => updateField('parking_type', e.target.value)}
                className={selectClass}
                required={profile.authority_waste_parking === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="allocated">Allocated Spaces</option>
                <option value="unallocated">Unallocated</option>
                <option value="permit">Permit Required</option>
                <option value="mixed">Mixed</option>
              </select>
            </FormField>
            
            <FormField label="Visitor Parking" required={profile.authority_waste_parking === 'form'}>
              <select
                value={profile.visitor_parking}
                onChange={(e) => updateField('visitor_parking', e.target.value)}
                className={selectClass}
                required={profile.authority_waste_parking === 'form'}
              >
                <option value="unknown">Not specified</option>
                <option value="yes_designated">Yes, designated spaces</option>
                <option value="limited">Limited availability</option>
                <option value="none">No visitor parking</option>
              </select>
            </FormField>
            
            <div className="md:col-span-2">
              <FormField label="Parking Notes">
                <textarea
                  value={profile.parking_notes}
                  onChange={(e) => updateField('parking_notes', e.target.value)}
                  className={inputClass}
                  rows={2}
                  placeholder="Additional parking information, permit details, etc."
                />
              </FormField>
            </div>
          </div>
        </CollapsibleSection>
        
        {/* Section 5: Rules & Permissions */}
        <CollapsibleSection
          title="Rules & Permissions"
          icon={<ClipboardList className="w-5 h-5 text-gold-600" />}
          description="House rules and approval requirements"
          authorityFlag={profile.authority_rules}
          onAuthorityChange={(v) => updateField('authority_rules', v)}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.has_house_rules}
                onChange={(e) => updateField('has_house_rules', e.target.checked)}
                className="w-4 h-4 text-gold-600 border-gray-300 rounded focus:ring-gold-500"
              />
              <span className="text-sm text-gray-700">This scheme has house rules document</span>
            </label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Exterior Changes Require Approval">
                <select
                  value={profile.exterior_changes_require_approval}
                  onChange={(e) => updateField('exterior_changes_require_approval', e.target.value)}
                  className={selectClass}
                >
                  <option value="unknown">Not specified</option>
                  <option value="yes">Yes, always</option>
                  <option value="no">No</option>
                  <option value="case_by_case">Case by case</option>
                </select>
              </FormField>
            </div>
            
            <FormField label="Rules Notes">
              <textarea
                value={profile.rules_notes}
                onChange={(e) => updateField('rules_notes', e.target.value)}
                className={inputClass}
                rows={3}
                placeholder="Additional information about rules, permissions, and restrictions..."
              />
            </FormField>
          </div>
        </CollapsibleSection>
        
        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4">
          <Link
            href="/dashboard"
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? 'Create Profile' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
