'use client';

import { useState } from 'react';
import { X, Shield, CheckCircle, AlertTriangle } from 'lucide-react';

interface NoticeboardTermsModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onClose: () => void;
  isDarkMode: boolean;
  isSubmitting: boolean;
}

const COMMUNITY_GUIDELINES = [
  {
    icon: '',
    title: 'Be Respectful',
    description: 'Treat all community members with courtesy and respect. Personal attacks, harassment, or discriminatory language will not be tolerated.',
  },
  {
    icon: '',
    title: 'Protect Privacy',
    description: 'Do not share personal information about other residents. This includes names, addresses, contact details, or any identifying information.',
  },
  {
    icon: '',
    title: 'Stay On Topic',
    description: 'Keep posts relevant to the community. Use appropriate categories and avoid spam or repetitive content.',
  },
  {
    icon: '',
    title: 'No False Information',
    description: 'Do not post misleading or false information. If you are unsure about something, clearly state it as an opinion or question.',
  },
  {
    icon: '',
    title: 'No Commercial Posts',
    description: 'The noticeboard is for community communications only. Commercial advertising or solicitation is not permitted.',
  },
  {
    icon: '',
    title: 'Use Official Channels for Issues',
    description: 'For maintenance requests, complaints, or urgent matters, please contact your property management directly rather than posting publicly.',
  },
];

export default function NoticeboardTermsModal({
  isOpen,
  onAccept,
  onClose,
  isDarkMode,
  isSubmitting,
}: NoticeboardTermsModalProps) {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (agreed) {
      onAccept();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      />
      
      <div className={`relative z-[101] w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl shadow-2xl ${
        isDarkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white'
      }`}>
        <div className={`flex-shrink-0 px-6 py-4 border-b ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isDarkMode ? 'bg-amber-900/30' : 'bg-amber-100'}`}>
                <Shield className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
              </div>
              <div>
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Community Guidelines
                </h2>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Please read before posting
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Welcome to the community noticeboard! To keep this a helpful and respectful space for all residents,
            please follow these guidelines:
          </p>

          <div className="space-y-3">
            {COMMUNITY_GUIDELINES.map((guideline, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg ${
                  isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl flex-shrink-0">{guideline.icon}</span>
                  <div>
                    <h3 className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {guideline.title}
                    </h3>
                    <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {guideline.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-4 p-3 rounded-lg ${
            isDarkMode ? 'bg-amber-900/20 border border-amber-800/30' : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-start gap-2">
              <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                isDarkMode ? 'text-amber-400' : 'text-amber-600'
              }`} />
              <p className={`text-xs ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                <strong>Note:</strong> Posts that violate these guidelines may be removed by the management team.
                Repeated violations may result in posting restrictions.
              </p>
            </div>
          </div>
        </div>

        <div className={`flex-shrink-0 px-6 py-4 border-t ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'
        }`}>
          <label className="flex items-start gap-3 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              I have read and agree to follow the community guidelines. I understand that my posts 
              may be removed if they violate these rules.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
                isDarkMode 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleAccept}
              disabled={!agreed || isSubmitting}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                agreed && !isSubmitting
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  I Agree
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
