'use client';

import { useState } from 'react';
import { SheetHeader, SheetItem } from '../BottomSheet';
import { Bell, Languages, HelpCircle, ChevronRight, Home, AlertTriangle, X, Shield } from 'lucide-react';

interface SettingsSheetProps {
  onSwitchToAssistant?: () => void;
}

export function SettingsSheet({ onSwitchToAssistant }: SettingsSheetProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmStep, setConfirmStep] = useState(1);

  const handleSwitchClick = () => {
    setConfirmStep(1);
    setShowConfirmModal(true);
  };

  const handleConfirmStep1 = () => {
    setConfirmStep(2);
  };

  const handleFinalConfirm = () => {
    setShowConfirmModal(false);
    setConfirmStep(1);
    onSwitchToAssistant?.();
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setConfirmStep(1);
  };

  return (
    <>
      <SheetHeader title="Settings" />
      <div className="px-6 py-5 space-y-3">
        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <Bell className="w-6 h-6 text-[#A67C3A]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">Manage push notifications</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <Languages className="w-6 h-6 text-[#8B6428]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Language</p>
            <p className="text-xs text-gray-500 mt-0.5">English</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <SheetItem onClick={() => {}}>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30 
            flex items-center justify-center border border-[#D4AF37]/10
            group-hover:shadow-[0_0_12px_rgba(212,175,55,0.15)] transition-all duration-[250ms]">
            <HelpCircle className="w-6 h-6 text-[#B8941F]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Help & Support</p>
            <p className="text-xs text-gray-500 mt-0.5">Get help with the app</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[#D4AF37] 
            group-hover:translate-x-0.5 transition-all duration-[250ms]" />
        </SheetItem>

        <div className="pt-4 border-t border-[#D4AF37]/10 mt-4">
          <div className="px-1 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-[#B8941F]" />
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Data & Privacy</p>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              For data access requests, deletion requests, or privacy concerns:
            </p>
            <a 
              href="mailto:privacy@longviewestates.ie" 
              className="inline-block mt-1 text-xs font-semibold text-[#D4AF37] hover:text-[#B8941F] transition-colors"
            >
              privacy@longviewestates.ie
            </a>
            <p className="text-xs text-gray-400 mt-2">
              We respond to all requests within 30 days as required by GDPR.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-[#D4AF37]/10 mt-4">
          <SheetItem onClick={handleSwitchClick}>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 
              flex items-center justify-center border border-emerald-200
              group-hover:shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-all duration-[250ms]">
              <Home className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Switch to Property Assistant</p>
              <p className="text-xs text-gray-500 mt-0.5">Already received your keys?</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 
              group-hover:translate-x-0.5 transition-all duration-[250ms]" />
          </SheetItem>
        </div>

        <div className="pt-2">
          <p className="text-xs text-center text-gray-400">OpenHouse v1.0.0</p>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="p-6">
              <button 
                onClick={handleCancel}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>

              {confirmStep === 1 ? (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                    Are you sure?
                  </h3>
                  <p className="text-sm text-gray-600 text-center mb-6">
                    This will switch you to the full Property Assistant. 
                    <span className="font-semibold text-amber-700"> Only do this if you have already received your keys.</span>
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                    <p className="text-xs text-amber-800 text-center">
                      <strong>Warning:</strong> You will lose access to your pre-handover timeline and milestone tracking. This cannot be undone.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmStep1}
                      className="flex-1 py-3 px-4 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-8 h-8 text-red-600" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                    Final Confirmation
                  </h3>
                  <p className="text-sm text-gray-600 text-center mb-4">
                    Please confirm that you have:
                  </p>
                  <div className="space-y-2 mb-6">
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Received the keys to your property</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Completed the handover process</span>
                    </div>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
                    <p className="text-xs text-red-800 text-center font-medium">
                      This action is permanent and cannot be reversed.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancel}
                      className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                      Go Back
                    </button>
                    <button
                      onClick={handleFinalConfirm}
                      className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
                    >
                      Yes, Switch Now
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
