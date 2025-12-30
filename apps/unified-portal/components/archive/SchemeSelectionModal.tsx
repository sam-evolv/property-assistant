'use client';

import { useState } from 'react';
import { X, Building2, ArrowRight } from 'lucide-react';

interface Development {
  id: string;
  name: string;
}

interface SchemeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchemeSelected: (schemeId: string) => void;
  developments: Development[];
  title?: string;
  description?: string;
}

export function SchemeSelectionModal({
  isOpen,
  onClose,
  onSchemeSelected,
  developments,
  title = 'Select Scheme',
  description = 'Choose a scheme to continue',
}: SchemeSelectionModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedId) {
      onSchemeSelected(selectedId);
      setSelectedId(null);
    }
  };

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={handleClose}
      />
      
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="text-gray-400 text-sm mt-1">{description}</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {developments.map((dev) => (
              <button
                key={dev.id}
                onClick={() => setSelectedId(dev.id)}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  selectedId === dev.id
                    ? 'bg-gold-500/10 border-gold-500/50 text-white'
                    : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedId === dev.id ? 'bg-gold-500/20' : 'bg-gray-700'
                }`}>
                  <Building2 className={`w-5 h-5 ${
                    selectedId === dev.id ? 'text-gold-400' : 'text-gray-400'
                  }`} />
                </div>
                <span className="flex-1 text-left font-medium">{dev.name}</span>
                {selectedId === dev.id && (
                  <div className="w-5 h-5 rounded-full bg-gold-500 flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {developments.length === 0 && (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No schemes available</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3 p-6 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
