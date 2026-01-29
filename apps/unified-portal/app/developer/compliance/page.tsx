'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Upload, Eye, Download, ChevronDown, Plus, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useCurrentContext } from '@/contexts/CurrentContext';

interface ComplianceFile {
  id: string;
  fileName: string;
  uploadedDate: string;
}

interface ComplianceDocument {
  id: string;
  name: string;
  category: string;
  files: ComplianceFile[];
}

interface Unit {
  id: string;
  address: string;
  type: string;
  beds: string;
  purchaser: string;
  documents: ComplianceDocument[];
}

const CategoryBadge = ({ category }: { category: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600">
    {category}
  </span>
);

const TypeBadge = ({ type }: { type: string }) => (
  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
    {type}
  </span>
);

const DocumentRow = ({ 
  doc, 
  onUpload 
}: { 
  doc: ComplianceDocument; 
  onUpload: () => void;
}) => {
  const hasFiles = doc.files.length > 0;
  
  return (
    <div className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-100 last:border-b-0">
      <div className="flex items-center gap-4 flex-1">
        {hasFiles ? (
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0 bg-white" />
        )}
        
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-900">{doc.name}</span>
            <CategoryBadge category={doc.category} />
          </div>
          {hasFiles && (
            <p className="text-sm text-gray-500 mt-0.5">
              Uploaded {doc.files[0].uploadedDate}
              {doc.files.length > 1 && <span className="text-gray-400"> · +{doc.files.length - 1} more</span>}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {hasFiles ? (
          <>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Eye className="w-4 h-4" />
              View
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={onUpload}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button 
            onClick={onUpload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        )}
      </div>
    </div>
  );
};

const UnitAccordion = ({ 
  unit, 
  isOpen, 
  onToggle, 
  onUpload 
}: { 
  unit: Unit; 
  isOpen: boolean; 
  onToggle: () => void; 
  onUpload: (doc: ComplianceDocument, unit: Unit) => void;
}) => {
  const uploadedCount = unit.documents.filter(d => d.files.length > 0).length;
  const totalDocs = unit.documents.length;
  const isComplete = uploadedCount === totalDocs && totalDocs > 0;
  const missingCount = totalDocs - uploadedCount;
  const percentage = totalDocs > 0 ? Math.round((uploadedCount / totalDocs) * 100) : 0;
  
  const sortedDocs = [...unit.documents].sort((a, b) => {
    const aHas = a.files.length > 0 ? 1 : 0;
    const bHas = b.files.length > 0 ? 1 : 0;
    return aHas - bHas;
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="#e5e7eb"
                strokeWidth="4"
                fill="none"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke={isComplete ? '#10b981' : '#D4AF37'}
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${percentage * 1.256} 125.6`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
              {percentage}%
            </span>
          </div>
          
          <div className="text-left">
            <div className="flex items-center gap-3">
              <span className="text-base font-semibold text-gray-900">{unit.address}</span>
              <TypeBadge type={unit.type} />
              <span className="text-sm text-gray-400">{unit.beds}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{unit.purchaser}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className={`text-sm font-medium ${isComplete ? 'text-emerald-600' : 'text-amber-600'}`}>
            {totalDocs === 0 ? 'No documents' : isComplete ? 'Complete' : `${missingCount} missing`}
          </span>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      {isOpen && (
        <div className="border-t border-gray-200">
          {sortedDocs.length > 0 ? (
            sortedDocs.map((doc) => (
              <DocumentRow 
                key={doc.id} 
                doc={doc} 
                onUpload={() => onUpload(doc, unit)}
              />
            ))
          ) : (
            <div className="py-8 text-center text-gray-500 text-sm">
              No document types configured for this unit
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const UploadModal = ({ 
  doc, 
  unit, 
  onClose, 
  onUpload 
}: { 
  doc: ComplianceDocument | null; 
  unit: Unit | null; 
  onClose: () => void; 
  onUpload: (file: File) => void;
}) => {
  const [dragOver, setDragOver] = useState(false);
  
  if (!doc || !unit) return null;
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{doc.name}</h2>
              <p className="text-sm text-gray-500">{unit.address}</p>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <label 
            className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver 
                ? 'border-gold-500 bg-gold-50' 
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileSelect}
            />
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
              dragOver ? 'bg-gold-100' : 'bg-gray-100'
            }`}>
              <Upload className={`w-6 h-6 ${dragOver ? 'text-gold-600' : 'text-gray-400'}`} />
            </div>
            <p className="text-sm font-medium text-gray-900">Click to upload or drag and drop</p>
            <p className="text-xs text-gray-500 mt-1">PDF, PNG, JPG up to 10MB</p>
          </label>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default function CompliancePage() {
  const { developmentId, developmentName } = useCurrentContext();
  
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [openUnits, setOpenUnits] = useState<Set<string>>(new Set());
  const [uploadModal, setUploadModal] = useState<{ doc: ComplianceDocument; unit: Unit } | null>(null);
  const [currentDevelopment, setCurrentDevelopment] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!developmentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const nameParam = developmentName ? `?name=${encodeURIComponent(developmentName)}` : '';
      const res = await fetch(`/api/compliance/${developmentId}${nameParam}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        setError('Failed to load compliance data');
        setUnits([]);
        return;
      }
      
      const data = await res.json();
      setCurrentDevelopment(data.development?.name || null);
      
      const fetchedUnits = data.units || [];
      const documentTypes = data.documentTypes || [];
      const documents = data.documents || [];
      
      const transformedUnits: Unit[] = fetchedUnits.map((unit: any) => {
        const unitDocs: ComplianceDocument[] = documentTypes.map((docType: any) => {
          const existingDoc = documents.find(
            (d: any) => d.document_type_id === docType.id && d.unit_id === unit.id
          );
          
          const files: ComplianceFile[] = existingDoc ? [{
            id: existingDoc.id,
            fileName: existingDoc.file_name || `${docType.name}.pdf`,
            uploadedDate: existingDoc.created_at 
              ? new Date(existingDoc.created_at).toLocaleDateString('en-GB')
              : '',
          }] : [];
          
          return {
            id: `${unit.id}-${docType.id}`,
            name: docType.name,
            category: docType.category,
            files,
          };
        });
        
        const addressParts = unit.address?.split(',') || [];
        const shortAddress = addressParts[0] || unit.name || `Unit ${unit.id}`;
        
        return {
          id: unit.id,
          address: shortAddress,
          type: unit.house_type || unit.type || 'N/A',
          beds: unit.bedrooms ? `${unit.bedrooms} bed` : '',
          purchaser: unit.purchaser_name || '',
          documents: unitDocs,
        };
      });
      
      setUnits(transformedUnits);
    } catch (err) {
      console.error('[Compliance] Fetch error:', err);
      setError('Failed to load compliance data');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  }, [developmentId, developmentName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleUnit = (unitId: string) => {
    setOpenUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const handleUpload = (doc: ComplianceDocument, unit: Unit) => {
    setUploadModal({ doc, unit });
  };

  const handleFileUpload = async (file: File) => {
    if (!uploadModal) return;
    
    console.log('Uploading file:', file.name, 'for', uploadModal.doc.name, 'at', uploadModal.unit.address);
    setUploadModal(null);
    fetchData();
  };

  const filteredUnits = units.filter(unit => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      unit.address.toLowerCase().includes(query) ||
      unit.purchaser.toLowerCase().includes(query) ||
      unit.type.toLowerCase().includes(query)
    );
  });

  const totalDocs = units.reduce((sum, u) => sum + u.documents.length, 0);
  const uploadedDocs = units.reduce((sum, u) => sum + u.documents.filter(d => d.files.length > 0).length, 0);
  const overallPercentage = totalDocs > 0 ? Math.round((uploadedDocs / totalDocs) * 100) : 0;
  const completeUnits = units.filter(u => {
    const total = u.documents.length;
    const uploaded = u.documents.filter(d => d.files.length > 0).length;
    return total > 0 && uploaded === total;
  }).length;

  if (loading) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
          <p className="text-gray-500">Loading compliance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-gray-700 font-medium">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
              <p className="text-sm text-gray-500 mt-1">
                {currentDevelopment || 'Select a development'} · Track certificates and regulatory documents per unit
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-sm text-gray-500">Overall Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{overallPercentage}%</p>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div>
                  <p className="text-sm text-gray-500">Units Complete</p>
                  <p className="text-2xl font-bold text-emerald-600">{completeUnits} / {units.length}</p>
                </div>
                <div className="h-10 w-px bg-gray-200" />
                <div>
                  <p className="text-sm text-gray-500">Documents Uploaded</p>
                  <p className="text-2xl font-bold text-gray-900">{uploadedDocs} / {totalDocs}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address, purchaser, or house type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
            />
          </div>

          {/* Unit List */}
          <div className="space-y-3">
            {filteredUnits.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">No units found</p>
              </div>
            ) : (
              filteredUnits.map((unit) => (
                <UnitAccordion
                  key={unit.id}
                  unit={unit}
                  isOpen={openUnits.has(unit.id)}
                  onToggle={() => toggleUnit(unit.id)}
                  onUpload={handleUpload}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {uploadModal && (
        <UploadModal
          doc={uploadModal.doc}
          unit={uploadModal.unit}
          onClose={() => setUploadModal(null)}
          onUpload={handleFileUpload}
        />
      )}
    </div>
  );
}
