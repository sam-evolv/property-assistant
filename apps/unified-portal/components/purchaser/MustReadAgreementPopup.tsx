'use client';

import { useState, useEffect } from 'react';
import { FileCheck, AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ImportantDoc {
  id: string;
  title: string;
  file_url?: string;
}

interface MustReadAgreementPopupProps {
  unitUid: string;
  isDarkMode: boolean;
  importantDocs: ImportantDoc[];
  onAgreementComplete: () => void;
}

export default function MustReadAgreementPopup({
  unitUid,
  isDarkMode,
  importantDocs,
  onAgreementComplete,
}: MustReadAgreementPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasCheckedAgreement, setHasCheckedAgreement] = useState(false);
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());
  const [purchaserName, setPurchaserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    checkExistingAgreement();
  }, [unitUid]);

  const checkExistingAgreement = async () => {
    try {
      const res = await fetch(`/api/purchaser/agreements?unitId=${unitUid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.hasAgreed) {
          setIsVisible(false);
          onAgreementComplete();
        } else if (importantDocs.length > 0) {
          setIsVisible(true);
        }
      }
    } catch (error) {
      console.error('Failed to check agreement:', error);
    } finally {
      setHasCheckedAgreement(true);
    }
  };

  const handleDocCheck = (docId: string) => {
    const newChecked = new Set(checkedDocs);
    if (newChecked.has(docId)) {
      newChecked.delete(docId);
    } else {
      newChecked.add(docId);
    }
    setCheckedDocs(newChecked);
  };

  const handleOpenDoc = (doc: ImportantDoc) => {
    if (doc.file_url) {
      window.open(doc.file_url, '_blank');
    }
  };

  const allDocsChecked = importantDocs.length > 0 && checkedDocs.size === importantDocs.length;

  const handleSubmit = async () => {
    if (!allDocsChecked || !purchaserName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/purchaser/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitId: unitUid,
          purchaserName: purchaserName.trim(),
          acknowledgedDocs: importantDocs.map(d => ({ id: d.id, title: d.title })),
        }),
      });

      if (res.ok) {
        setIsVisible(false);
        onAgreementComplete();
      }
    } catch (error) {
      console.error('Failed to save agreement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isVisible || !hasCheckedAgreement || importantDocs.length === 0) {
    return null;
  }

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-300' : 'text-gray-600';
  const borderColor = isDarkMode ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`${bgColor} rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden border-2 border-gold-500/50`}>
        <div className="bg-gradient-to-r from-gold-500 to-gold-600 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Important Documents</h2>
              <p className="text-white/80 text-sm">Please review before continuing</p>
            </div>
          </div>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh]">
          <p className={`${subtextColor} mb-4 text-sm`}>
            Before you can access your property assistant, please confirm that you have read 
            and understood the following important documents:
          </p>

          <div className="space-y-3 mb-5">
            {importantDocs.map((doc) => (
              <div
                key={doc.id}
                className={`p-4 rounded-lg border ${borderColor} ${checkedDocs.has(doc.id) ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleDocCheck(doc.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checkedDocs.has(doc.id) 
                        ? 'bg-green-500 border-green-500 text-white' 
                        : 'border-gray-400 hover:border-gold-500'
                    }`}
                  >
                    {checkedDocs.has(doc.id) && <CheckCircle className="w-4 h-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${textColor} text-sm`}>{doc.title}</p>
                    <button
                      onClick={() => handleOpenDoc(doc)}
                      className="text-gold-600 hover:text-gold-700 text-xs underline mt-1"
                    >
                      View Document
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-5">
            <label className={`block text-sm font-medium ${textColor} mb-2`}>
              Your Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={purchaserName}
              onChange={(e) => setPurchaserName(e.target.value)}
              placeholder="Enter your full name"
              className={`w-full px-4 py-3 rounded-lg border ${inputBg} ${textColor} focus:ring-2 focus:ring-gold-500 focus:border-gold-500`}
            />
          </div>

          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} border ${borderColor}`}>
            <p className={`text-xs ${subtextColor}`}>
              By clicking "I Agree & Continue", I confirm that I have read and understood 
              the above documents. This acknowledgment will be recorded for your records 
              and the developer's records.
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSubmit}
            disabled={!allDocsChecked || !purchaserName.trim() || isSubmitting}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              allDocsChecked && purchaserName.trim() && !isSubmitting
                ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <FileCheck className="w-5 h-5" />
            {isSubmitting ? 'Saving...' : 'I Agree & Continue'}
          </button>
          <p className={`text-center text-xs ${subtextColor} mt-3`}>
            {checkedDocs.size} of {importantDocs.length} documents acknowledged
          </p>
        </div>
      </div>
    </div>
  );
}
