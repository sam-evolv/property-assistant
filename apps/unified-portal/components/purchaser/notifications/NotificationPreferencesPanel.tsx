'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Moon, X } from 'lucide-react';

interface NotificationPreferencesProps {
  unitUid: string;
  token: string | null;
  isDarkMode?: boolean;
  onClose: () => void;
}

interface Preferences {
  push_enabled: boolean;
  muted_categories: string[];
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const CATEGORY_OPTIONS = [
  { key: 'broadcast', label: 'Developer broadcasts' },
  { key: 'pipeline_update', label: 'Sale updates' },
  { key: 'document_uploaded', label: 'Document alerts' },
  { key: 'handover', label: 'Handover updates' },
  { key: 'snag_update', label: 'Snagging updates' },
  { key: 'community', label: 'Community notices' },
  { key: 'maintenance', label: 'Maintenance tips' },
];

export function NotificationPreferencesPanel({
  unitUid,
  token,
  isDarkMode,
  onClose,
}: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<Preferences>({
    push_enabled: true,
    muted_categories: [],
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!unitUid || !token) return;
    try {
      const params = new URLSearchParams({ unitUid, token });
      const res = await fetch(`/api/notifications/preferences?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPreferences({
          push_enabled: data.preferences.push_enabled ?? true,
          muted_categories: data.preferences.muted_categories || [],
          quiet_hours_enabled: data.preferences.quiet_hours_enabled ?? false,
          quiet_hours_start: data.preferences.quiet_hours_start || '22:00',
          quiet_hours_end: data.preferences.quiet_hours_end || '08:00',
        });
      }
    } catch (error) {
      console.error('[NotificationPreferences] Failed to fetch:', error);
    } finally {
      setLoaded(true);
    }
  }, [unitUid, token]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = async () => {
    if (!unitUid || !token) return;
    setSaving(true);
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          unitUid,
          ...preferences,
        }),
      });
    } catch (error) {
      console.error('[NotificationPreferences] Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (key: string) => {
    setPreferences(prev => ({
      ...prev,
      muted_categories: prev.muted_categories.includes(key)
        ? prev.muted_categories.filter(c => c !== key)
        : [...prev.muted_categories, key],
    }));
  };

  if (!loaded) return null;

  const bgClass = isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900';
  const borderClass = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const cardClass = isDarkMode ? 'bg-gray-800' : 'bg-gray-50';
  const textMuted = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`${bgClass} rounded-xl border ${borderClass} overflow-hidden`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b ${borderClass}`}>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-gold-500" />
          <h3 className="font-semibold">Notification Preferences</h3>
        </div>
        <button onClick={onClose} className={`p-1 rounded-lg hover:${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-5">
        {/* Push Toggle */}
        <div className={`p-4 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Push Notifications</p>
              <p className={`text-xs ${textMuted}`}>Receive notifications on your device</p>
            </div>
            <button
              onClick={() => setPreferences(prev => ({ ...prev, push_enabled: !prev.push_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                preferences.push_enabled ? 'bg-gold-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.push_enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>

        {/* Quiet Hours */}
        <div className={`p-4 rounded-lg ${cardClass}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-gold-500" />
              <div>
                <p className="font-medium text-sm">Quiet Hours</p>
                <p className={`text-xs ${textMuted}`}>Pause push during these hours</p>
              </div>
            </div>
            <button
              onClick={() => setPreferences(prev => ({ ...prev, quiet_hours_enabled: !prev.quiet_hours_enabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                preferences.quiet_hours_enabled ? 'bg-gold-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                preferences.quiet_hours_enabled ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {preferences.quiet_hours_enabled && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1">
                <label className={`text-xs ${textMuted}`}>From</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start || '22:00'}
                  onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                  className={`w-full mt-1 px-3 py-1.5 rounded-lg border text-sm ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'
                  }`}
                />
              </div>
              <div className="flex-1">
                <label className={`text-xs ${textMuted}`}>To</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end || '08:00'}
                  onChange={(e) => setPreferences(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                  className={`w-full mt-1 px-3 py-1.5 rounded-lg border text-sm ${
                    isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Category Toggles */}
        <div>
          <p className="font-medium text-sm mb-3">Notification Categories</p>
          <div className="space-y-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const isMuted = preferences.muted_categories.includes(cat.key);
              return (
                <div
                  key={cat.key}
                  className={`flex items-center justify-between p-3 rounded-lg ${cardClass}`}
                >
                  <span className="text-sm">{cat.label}</span>
                  <button
                    onClick={() => toggleCategory(cat.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      !isMuted ? 'bg-gold-500' : isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      !isMuted ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={savePreferences}
          disabled={saving}
          className="w-full py-2.5 bg-gold-500 text-white rounded-lg font-medium text-sm hover:bg-gold-600 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
