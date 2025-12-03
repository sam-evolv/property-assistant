'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface ThemeConfig {
  id?: string;
  tenant_id: string;
  primary_color: string;
  secondary_color: string | null;
  accent_color: string | null;
  background_color: string | null;
  button_radius: number | null;
  heading_font_weight: number | null;
  logo_url: string | null;
  dark_mode: boolean;
}

interface ThemeEditorProps {
  tenantId: string;
  tenantName: string;
  initialConfig: ThemeConfig | null;
}

export function ThemeEditor({ tenantId, tenantName, initialConfig }: ThemeEditorProps) {
  const [primaryColor, setPrimaryColor] = useState(initialConfig?.primary_color || '#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState(initialConfig?.secondary_color || '#8b5cf6');
  const [accentColor, setAccentColor] = useState(initialConfig?.accent_color || '#06b6d4');
  const [backgroundColor, setBackgroundColor] = useState(initialConfig?.background_color || '#ffffff');
  const [buttonRadius, setButtonRadius] = useState(initialConfig?.button_radius || 6);
  const [headingFontWeight, setHeadingFontWeight] = useState(initialConfig?.heading_font_weight || 700);
  const [logoUrl, setLogoUrl] = useState(initialConfig?.logo_url || '');
  const [darkMode, setDarkMode] = useState(initialConfig?.dark_mode || false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPreviewUrl(`${window.location.protocol}//${window.location.hostname}:5000?preview=true&tenantId=${tenantId}`);
    }
  }, [tenantId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/theme/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primary_color: primaryColor,
          secondary_color: secondaryColor,
          accent_color: accentColor,
          background_color: backgroundColor,
          button_radius: buttonRadius,
          heading_font_weight: headingFontWeight,
          logo_url: logoUrl || null,
          dark_mode: darkMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save theme');
      }

      const data = await response.json();
      toast.success('Theme saved successfully!');
      
      if (showPreview) {
        const previewWindow = document.getElementById('preview-iframe') as HTMLIFrameElement;
        if (previewWindow?.contentWindow) {
          previewWindow.contentWindow.postMessage({ type: 'refresh_theme' }, '*');
        }
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error('Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gold-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-4">Brand Colors</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="#3b82f6"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Main brand color used for buttons, links, and accents
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Secondary Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor || '#8b5cf6'}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={secondaryColor || ''}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="#8b5cf6"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Secondary brand color for supporting elements
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor || '#06b6d4'}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor || ''}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="#06b6d4"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Accent color for highlights and special elements
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={backgroundColor || '#ffffff'}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-16 h-10 rounded border border-gray-300 cursor-pointer"
                />
                <input
                  type="text"
                  value={backgroundColor || ''}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
                  placeholder="#ffffff"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Main background color for the tenant portal
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gold-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-4">Typography & Styling</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Button Border Radius (px)
              </label>
              <input
                type="range"
                min="0"
                max="24"
                step="2"
                value={buttonRadius || 6}
                onChange={(e) => setButtonRadius(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Square (0px)</span>
                <span className="font-semibold text-gold-600">{buttonRadius}px</span>
                <span>Rounded (24px)</span>
              </div>
              <div className="mt-3 flex gap-2">
                <div
                  className="flex-1 bg-gold-500 text-white text-center py-2 text-sm font-medium"
                  style={{ borderRadius: `${buttonRadius}px` }}
                >
                  Button Preview
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heading Font Weight
              </label>
              <select
                value={headingFontWeight || 700}
                onChange={(e) => setHeadingFontWeight(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gold-500"
              >
                <option value="400">Normal (400)</option>
                <option value="500">Medium (500)</option>
                <option value="600">Semibold (600)</option>
                <option value="700">Bold (700)</option>
                <option value="800">Extra Bold (800)</option>
                <option value="900">Black (900)</option>
              </select>
              <div className="mt-3 border border-gray-200 rounded p-3">
                <h3
                  className="text-lg"
                  style={{ fontWeight: headingFontWeight || 700 }}
                >
                  Heading Preview Text
                </h3>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gold-100 hover:shadow-md transition-shadow">
          <h2 className="text-xl font-semibold mb-4">Additional Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Logo URL (Optional)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-gray-500 mt-1">
                Custom logo for the tenant portal header
              </p>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="dark-mode"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                className="w-4 h-4 text-gold-600 rounded border-gray-300 focus:ring-gold-500"
              />
              <label htmlFor="dark-mode" className="ml-2 text-sm font-medium text-gray-700">
                Enable Dark Mode
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-gold-500 text-white rounded-md hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md transition-all duration-premium"
          >
            {isSaving ? 'Saving...' : 'Save Theme'}
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-6 py-2 bg-white border border-gold-200 text-gray-700 rounded-md hover:bg-gold-50 hover:border-gold-300 font-medium transition-all duration-premium"
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 h-fit">
        {showPreview ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700">Live Preview - {tenantName}</h3>
              <p className="text-xs text-gray-500 mt-1">Preview how your theme looks to homeowners</p>
            </div>
            <div className="relative" style={{ height: '600px' }}>
              <iframe
                id="preview-iframe"
                src={previewUrl}
                className="w-full h-full border-0"
                title="Theme Preview"
              />
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No Preview Active</h3>
            <p className="mt-2 text-sm text-gray-500">
              Click "Show Preview" to see how your theme looks
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
