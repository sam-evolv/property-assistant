'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { MapPin, Save, CheckCircle, AlertCircle, Building2 } from 'lucide-react';

interface SchemeProfile {
  scheme_name: string;
  scheme_address: string;
  scheme_lat: number | null;
  scheme_lng: number | null;
}

const defaultProfile: SchemeProfile = {
  scheme_name: '',
  scheme_address: '',
  scheme_lat: null,
  scheme_lng: null,
};

export default function SchemeSetupPage() {
  const { developmentId, isHydrated } = useCurrentContext();
  const [profile, setProfile] = useState<SchemeProfile>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!developmentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/schemes/${developmentId}/profile`);
      const data = await res.json();
      
      if (data.profile) {
        setProfile({
          scheme_name: data.profile.scheme_name || '',
          scheme_address: data.profile.scheme_address || '',
          scheme_lat: data.profile.scheme_lat,
          scheme_lng: data.profile.scheme_lng,
        });
      } else {
        setProfile(defaultProfile);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load scheme profile');
    } finally {
      setLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    if (isHydrated && developmentId) {
      loadProfile();
    }
  }, [isHydrated, developmentId, loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!developmentId) return;
    
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/schemes/${developmentId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save');
      }

      setSuccess('Location saved successfully. Nearby amenities are now enabled.');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof SchemeProfile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSuccess(null);
  };

  if (!isHydrated) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (!developmentId) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <AlertCircle className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">No Scheme Selected</h2>
          <p className="text-yellow-700">Please select a scheme from the dropdown above to configure its location.</p>
        </div>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500";

  const hasLocation = profile.scheme_lat !== null && profile.scheme_lng !== null;

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-gold-100 to-gold-50 rounded-xl">
            <Building2 className="w-6 h-6 text-gold-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Scheme Setup</h1>
            <p className="text-sm text-gray-500">Configure location for nearby amenities</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-700">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-gold-100 rounded-lg">
                <MapPin className="w-5 h-5 text-gold-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Scheme Location</h3>
                <p className="text-sm text-gray-500">Required for nearby amenities feature</p>
              </div>
            </div>

            {!hasLocation && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Location not set.</strong> The AI assistant cannot show nearby amenities until you set the scheme coordinates.
                </p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scheme Name
                </label>
                <input
                  type="text"
                  value={profile.scheme_name}
                  onChange={(e) => updateField('scheme_name', e.target.value)}
                  className={inputClass}
                  placeholder="e.g., Longview Park"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={profile.scheme_address}
                  onChange={(e) => updateField('scheme_address', e.target.value)}
                  className={inputClass}
                  placeholder="Full address including county/postcode"
                />
                <p className="text-xs text-gray-500 mt-1">Used for display purposes</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={profile.scheme_lat ?? ''}
                    onChange={(e) => updateField('scheme_lat', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClass}
                    placeholder="e.g., 53.3498"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={profile.scheme_lng ?? ''}
                    onChange={(e) => updateField('scheme_lng', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClass}
                    placeholder="e.g., -6.2603"
                    required
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                Tip: You can find coordinates by searching your address on Google Maps, then right-clicking on the location and selecting the coordinates.
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-gold-500 hover:bg-gold-600 text-white font-semibold py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Location
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
