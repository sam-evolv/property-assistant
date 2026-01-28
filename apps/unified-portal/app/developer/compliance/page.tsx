'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  Search,
  Download,
  Eye,
  Plus,
  ChevronDown,
  Building2,
  X,
  Trash2,
  History,
  RefreshCw,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  File,
  FolderOpen,
  Loader2,
} from 'lucide-react';

import { useCurrentContext } from '@/contexts/CurrentContext';
import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { SlideOver } from '@/components/ui/SlideOver';
import { DragDropUpload } from '@/components/ui/DragDropUpload';
import { EmptyState } from '@/components/ui/EmptyState';

// Types
type DocumentStatus = 'missing' | 'uploaded' | 'verified' | 'expired';

interface DocumentVersion {
  version: number;
  uploadedDate: Date;
  uploadedBy: string;
  fileSize: string;
  fileName: string;
}

interface ComplianceDocument {
  id: string;
  name: string;
  category: string;
  houseType: string;
  status: DocumentStatus;
  uploadedDate?: Date;
  expiryDate?: Date;
  uploadedBy?: string;
  fileSize?: string;
  version?: number;
  fileName?: string;
  description?: string;
  versions?: DocumentVersion[];
  notes?: string;
}

interface HouseTypeCompliance {
  houseType: string;
  totalDocuments: number;
  uploaded: number;
  verified: number;
  missing: number;
  expired: number;
  compliancePercent: number;
}

// Mock data with enhanced detail
const mockDocuments: ComplianceDocument[] = [
  // Type A Documents
  {
    id: '1',
    name: 'BCMS Certificate',
    category: 'Certification',
    houseType: 'Type A',
    status: 'verified',
    uploadedDate: new Date('2025-01-10'),
    expiryDate: new Date('2026-01-10'),
    uploadedBy: 'J. Murphy',
    fileSize: '2.4 MB',
    version: 1,
    fileName: 'bcms_cert_type_a.pdf',
    description: 'Building Control Management System certificate confirming compliance with building regulations.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-10'), uploadedBy: 'J. Murphy', fileSize: '2.4 MB', fileName: 'bcms_cert_type_a.pdf' },
    ],
  },
  {
    id: '2',
    name: 'HomeBond Registration',
    category: 'Registration',
    houseType: 'Type A',
    status: 'verified',
    uploadedDate: new Date('2025-01-08'),
    uploadedBy: 'J. Murphy',
    fileSize: '1.2 MB',
    version: 1,
    fileName: 'homebond_reg_type_a.pdf',
    description: 'HomeBond structural defects insurance registration document.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-08'), uploadedBy: 'J. Murphy', fileSize: '1.2 MB', fileName: 'homebond_reg_type_a.pdf' },
    ],
  },
  {
    id: '3',
    name: 'Energy Performance Certificate',
    category: 'Certification',
    houseType: 'Type A',
    status: 'uploaded',
    uploadedDate: new Date('2025-01-15'),
    uploadedBy: 'S. Walsh',
    fileSize: '856 KB',
    version: 2,
    fileName: 'ber_cert_type_a_v2.pdf',
    description: 'Building Energy Rating certificate showing energy efficiency rating.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-05'), uploadedBy: 'J. Murphy', fileSize: '812 KB', fileName: 'ber_cert_type_a_v1.pdf' },
      { version: 2, uploadedDate: new Date('2025-01-15'), uploadedBy: 'S. Walsh', fileSize: '856 KB', fileName: 'ber_cert_type_a_v2.pdf' },
    ],
  },
  {
    id: '4',
    name: 'Fire Safety Certificate',
    category: 'Safety',
    houseType: 'Type A',
    status: 'missing',
    description: 'Fire safety compliance certificate from local authority.',
  },
  {
    id: '5',
    name: 'Structural Warranty',
    category: 'Warranty',
    houseType: 'Type A',
    status: 'expired',
    uploadedDate: new Date('2024-01-01'),
    expiryDate: new Date('2025-01-01'),
    uploadedBy: 'J. Murphy',
    fileSize: '3.1 MB',
    version: 1,
    fileName: 'structural_warranty_type_a.pdf',
    description: '10-year structural warranty documentation.',
    versions: [
      { version: 1, uploadedDate: new Date('2024-01-01'), uploadedBy: 'J. Murphy', fileSize: '3.1 MB', fileName: 'structural_warranty_type_a.pdf' },
    ],
  },

  // Type B Documents
  {
    id: '6',
    name: 'BCMS Certificate',
    category: 'Certification',
    houseType: 'Type B',
    status: 'verified',
    uploadedDate: new Date('2025-01-10'),
    expiryDate: new Date('2026-01-10'),
    uploadedBy: 'J. Murphy',
    fileSize: '2.4 MB',
    version: 1,
    fileName: 'bcms_cert_type_b.pdf',
    description: 'Building Control Management System certificate.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-10'), uploadedBy: 'J. Murphy', fileSize: '2.4 MB', fileName: 'bcms_cert_type_b.pdf' },
    ],
  },
  {
    id: '7',
    name: 'HomeBond Registration',
    category: 'Registration',
    houseType: 'Type B',
    status: 'uploaded',
    uploadedDate: new Date('2025-01-12'),
    uploadedBy: 'S. Walsh',
    fileSize: '1.3 MB',
    version: 1,
    fileName: 'homebond_reg_type_b.pdf',
    description: 'HomeBond structural defects insurance registration.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-12'), uploadedBy: 'S. Walsh', fileSize: '1.3 MB', fileName: 'homebond_reg_type_b.pdf' },
    ],
  },
  {
    id: '8',
    name: 'Energy Performance Certificate',
    category: 'Certification',
    houseType: 'Type B',
    status: 'missing',
    description: 'Building Energy Rating certificate.',
  },
  {
    id: '9',
    name: 'Fire Safety Certificate',
    category: 'Safety',
    houseType: 'Type B',
    status: 'verified',
    uploadedDate: new Date('2025-01-05'),
    uploadedBy: 'J. Murphy',
    fileSize: '945 KB',
    version: 1,
    fileName: 'fire_safety_type_b.pdf',
    description: 'Fire safety compliance certificate.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-05'), uploadedBy: 'J. Murphy', fileSize: '945 KB', fileName: 'fire_safety_type_b.pdf' },
    ],
  },
  {
    id: '10',
    name: 'Structural Warranty',
    category: 'Warranty',
    houseType: 'Type B',
    status: 'uploaded',
    uploadedDate: new Date('2025-01-08'),
    expiryDate: new Date('2026-01-08'),
    uploadedBy: 'S. Walsh',
    fileSize: '2.9 MB',
    version: 1,
    fileName: 'structural_warranty_type_b.pdf',
    description: '10-year structural warranty documentation.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-08'), uploadedBy: 'S. Walsh', fileSize: '2.9 MB', fileName: 'structural_warranty_type_b.pdf' },
    ],
  },

  // Type C Documents
  {
    id: '11',
    name: 'BCMS Certificate',
    category: 'Certification',
    houseType: 'Type C',
    status: 'uploaded',
    uploadedDate: new Date('2025-01-14'),
    expiryDate: new Date('2026-01-14'),
    uploadedBy: 'K. Dolan',
    fileSize: '2.6 MB',
    version: 1,
    fileName: 'bcms_cert_type_c.pdf',
    description: 'Building Control Management System certificate.',
    versions: [
      { version: 1, uploadedDate: new Date('2025-01-14'), uploadedBy: 'K. Dolan', fileSize: '2.6 MB', fileName: 'bcms_cert_type_c.pdf' },
    ],
  },
  { id: '12', name: 'HomeBond Registration', category: 'Registration', houseType: 'Type C', status: 'missing', description: 'HomeBond registration document.' },
  { id: '13', name: 'Energy Performance Certificate', category: 'Certification', houseType: 'Type C', status: 'missing', description: 'BER certificate.' },
  { id: '14', name: 'Fire Safety Certificate', category: 'Safety', houseType: 'Type C', status: 'missing', description: 'Fire safety certificate.' },
  { id: '15', name: 'Structural Warranty', category: 'Warranty', houseType: 'Type C', status: 'missing', description: 'Structural warranty.' },
];

const statusConfig: Record<DocumentStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  missing: { label: 'Missing', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  uploaded: { label: 'Uploaded', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  verified: { label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  expired: { label: 'Expired', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
};

// Upload Modal Component
function UploadModal({
  isOpen,
  onClose,
  document,
  onUploadComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  document: ComplianceDocument | null;
  onUploadComplete: (docId: string, files: File[]) => void;
}) {
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  if (!isOpen || !document) return null;

  const handleUpload = async (files: File[]) => {
    setUploadedFiles(files);
  };

  const handleSubmit = () => {
    if (uploadedFiles.length > 0) {
      onUploadComplete(document.id, uploadedFiles);
      onClose();
      setUploadedFiles([]);
      setNotes('');
      setExpiryDate('');
    }
  };

  return (
    <SlideOver
      open={isOpen}
      onClose={onClose}
      title={`Upload ${document.name}`}
      subtitle={`${document.houseType} - ${document.category}`}
      width="md"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadedFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Upload Document
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Document info */}
        {document.description && (
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">{document.description}</p>
          </div>
        )}

        {/* Drag-drop upload zone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document File
          </label>
          <DragDropUpload
            onUpload={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            maxSize={10 * 1024 * 1024}
            maxFiles={1}
            multiple={false}
            title="Drop your document here"
            description="PDF, Word, or image files up to 10MB"
          />
        </div>

        {/* Expiry date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date (if applicable)
          </label>
          <input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this document..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
          />
        </div>

        {/* Previous version warning */}
        {document.status === 'expired' && document.version && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Replacing Expired Document</p>
                <p className="text-sm text-amber-700 mt-1">
                  This will create version {(document.version || 0) + 1} and archive the previous version.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </SlideOver>
  );
}

// Document Detail/View Modal
function DocumentDetailModal({
  isOpen,
  onClose,
  document,
  onVerify,
  onReupload,
}: {
  isOpen: boolean;
  onClose: () => void;
  document: ComplianceDocument | null;
  onVerify: (docId: string) => void;
  onReupload: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'preview' | 'versions' | 'history'>('preview');

  if (!isOpen || !document) return null;

  const status = statusConfig[document.status];

  return (
    <SlideOver
      open={isOpen}
      onClose={onClose}
      title={document.name}
      subtitle={`${document.houseType} - ${document.category}`}
      width="lg"
      footer={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {document.status === 'uploaded' && (
              <button
                onClick={() => onVerify(document.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Mark as Verified
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReupload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload New Version
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      }
    >
      {/* Status Banner */}
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg mb-6',
          status.bgColor,
          'border',
          status.borderColor
        )}
      >
        {document.status === 'verified' ? (
          <CheckCircle className={cn('w-5 h-5', status.color)} />
        ) : document.status === 'uploaded' ? (
          <FileText className={cn('w-5 h-5', status.color)} />
        ) : document.status === 'expired' ? (
          <Clock className={cn('w-5 h-5', status.color)} />
        ) : (
          <AlertCircle className={cn('w-5 h-5', status.color)} />
        )}
        <div>
          <p className={cn('text-sm font-medium', status.color)}>{status.label}</p>
          {document.uploadedDate && (
            <p className="text-xs text-gray-600">
              Uploaded on {document.uploadedDate.toLocaleDateString('en-IE')} by {document.uploadedBy}
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {[
            { id: 'preview', label: 'Preview', icon: Eye },
            { id: 'versions', label: 'Version History', icon: History },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 pb-3 border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-gold-500 text-gold-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          {/* Document preview placeholder */}
          <div className="bg-gray-100 rounded-lg aspect-[4/3] flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500 font-medium">
                {document.fileName || 'Document Preview'}
              </p>
              {document.fileSize && (
                <p className="text-xs text-gray-400 mt-1">{document.fileSize}</p>
              )}
              <button className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium text-gold-600 bg-white border border-gold-200 rounded-lg hover:bg-gold-50 transition-colors mx-auto">
                <ExternalLink className="w-4 h-4" />
                Open in New Tab
              </button>
            </div>
          </div>

          {/* Document info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Category</p>
              <Badge variant="outline">{document.category}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">House Type</p>
              <p className="text-sm font-medium text-gray-900">{document.houseType}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Version</p>
              <p className="text-sm font-medium text-gray-900">v{document.version || 1}</p>
            </div>
            {document.expiryDate && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Expiry Date</p>
                <p
                  className={cn(
                    'text-sm font-medium',
                    document.expiryDate < new Date() ? 'text-red-600' : 'text-gray-900'
                  )}
                >
                  {document.expiryDate.toLocaleDateString('en-IE')}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {document.description && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Description</p>
              <p className="text-sm text-gray-600">{document.description}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="space-y-4">
          {document.versions && document.versions.length > 0 ? (
            document.versions
              .sort((a, b) => b.version - a.version)
              .map((version, index) => (
                <div
                  key={version.version}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border',
                    index === 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      index === 0 ? 'bg-green-100' : 'bg-gray-100'
                    )}
                  >
                    <File
                      className={cn('w-5 h-5', index === 0 ? 'text-green-600' : 'text-gray-500')}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">Version {version.version}</p>
                      {index === 0 && (
                        <Badge variant="success" size="sm">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {version.uploadedBy} - {version.uploadedDate.toLocaleDateString('en-IE')}
                    </p>
                    <p className="text-xs text-gray-400">{version.fileSize}</p>
                  </div>
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))
          ) : (
            <EmptyState
              title="No version history"
              description="Version history will appear here after uploads"
              icon={History}
            />
          )}
        </div>
      )}
    </SlideOver>
  );
}

// Bulk Upload Modal
function BulkUploadModal({
  isOpen,
  onClose,
  houseTypes,
  onUploadComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  houseTypes: string[];
  onUploadComplete: (files: File[], houseType: string) => void;
}) {
  const [selectedHouseType, setSelectedHouseType] = useState(houseTypes[0] || '');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  if (!isOpen) return null;

  const handleUpload = async (files: File[]) => {
    setUploadedFiles((prev) => [...prev, ...files]);
  };

  const handleSubmit = () => {
    if (uploadedFiles.length > 0 && selectedHouseType) {
      onUploadComplete(uploadedFiles, selectedHouseType);
      onClose();
      setUploadedFiles([]);
    }
  };

  return (
    <SlideOver
      open={isOpen}
      onClose={onClose}
      title="Bulk Upload Documents"
      subtitle="Upload multiple compliance documents at once"
      width="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploadedFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Upload {uploadedFiles.length} Document{uploadedFiles.length !== 1 ? 's' : ''}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* House type selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select House Type
          </label>
          <select
            value={selectedHouseType}
            onChange={(e) => setSelectedHouseType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
          >
            {houseTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* Drag-drop upload zone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Document Files
          </label>
          <DragDropUpload
            onUpload={handleUpload}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            maxSize={10 * 1024 * 1024}
            maxFiles={20}
            multiple={true}
            title="Drop your documents here"
            description="Upload multiple PDF, Word, or image files (up to 20 files)"
          />
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Naming Convention</h4>
          <p className="text-sm text-blue-700">
            For automatic matching, name your files using the document type. For example:
          </p>
          <ul className="mt-2 text-sm text-blue-700 space-y-1">
            <li>bcms_certificate.pdf</li>
            <li>homebond_registration.pdf</li>
            <li>ber_certificate.pdf</li>
            <li>fire_safety_certificate.pdf</li>
          </ul>
        </div>
      </div>
    </SlideOver>
  );
}

// House Type Compliance Card
function HouseTypeCard({
  compliance,
  isSelected,
  onClick,
}: {
  compliance: HouseTypeCompliance;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left bg-white rounded-xl border p-5 transition-all',
        'hover:shadow-md',
        isSelected ? 'border-gold-500 ring-2 ring-gold-500/20' : 'border-gray-200'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{compliance.houseType}</h3>
          <p className="text-xs text-gray-500">{compliance.totalDocuments} documents required</p>
        </div>
        <CircularProgress value={compliance.compliancePercent} size="md" />
      </div>

      <ProgressBar
        value={compliance.compliancePercent}
        variant={
          compliance.compliancePercent >= 100
            ? 'success'
            : compliance.compliancePercent >= 60
            ? 'warning'
            : 'error'
        }
        size="sm"
        className="mb-3"
      />

      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-green-600">{compliance.verified}</p>
          <p className="text-xs text-gray-500">Verified</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-blue-600">{compliance.uploaded}</p>
          <p className="text-xs text-gray-500">Uploaded</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-red-600">{compliance.missing}</p>
          <p className="text-xs text-gray-500">Missing</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-amber-600">{compliance.expired}</p>
          <p className="text-xs text-gray-500">Expired</p>
        </div>
      </div>
    </button>
  );
}

// Document Row Component
function DocumentRow({
  document,
  onUpload,
  onView,
}: {
  document: ComplianceDocument;
  onUpload: () => void;
  onView: () => void;
}) {
  const status = statusConfig[document.status];

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
        status.bgColor,
        status.borderColor
      )}
      onClick={document.status !== 'missing' ? onView : undefined}
    >
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            document.status === 'verified'
              ? 'bg-green-100'
              : document.status === 'uploaded'
              ? 'bg-blue-100'
              : document.status === 'expired'
              ? 'bg-amber-100'
              : 'bg-gray-100'
          )}
        >
          {document.status === 'verified' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : document.status === 'uploaded' ? (
            <FileText className="w-5 h-5 text-blue-600" />
          ) : document.status === 'expired' ? (
            <Clock className="w-5 h-5 text-amber-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{document.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" size="sm">
              {document.category}
            </Badge>
            {document.uploadedDate && (
              <span className="text-xs text-gray-500">
                Uploaded {document.uploadedDate.toLocaleDateString('en-IE')}
              </span>
            )}
            {document.version && document.version > 1 && (
              <span className="text-xs text-gray-400">v{document.version}</span>
            )}
            {document.expiryDate && (
              <span
                className={cn(
                  'text-xs',
                  document.expiryDate < new Date() ? 'text-red-600' : 'text-gray-500'
                )}
              >
                Expires {document.expiryDate.toLocaleDateString('en-IE')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {(document.status === 'missing' || document.status === 'expired') && (
          <button
            onClick={onUpload}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        )}
        {(document.status === 'uploaded' || document.status === 'verified') && (
          <>
            <button
              onClick={onView}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600">
              <Download className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Main Compliance Page
export default function CompliancePage() {
  const { developmentId, developmentName } = useCurrentContext();
  
  const [selectedHouseType, setSelectedHouseType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | 'all'>('all');
  const [documents, setDocuments] = useState<ComplianceDocument[]>(mockDocuments);
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<ComplianceDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentDevelopment, setCurrentDevelopment] = useState<string | null>(null);

  const fetchComplianceData = useCallback(async () => {
    if (!developmentId) return;
    
    try {
      setLoading(true);
      const nameParam = developmentName ? `?name=${encodeURIComponent(developmentName)}` : '';
      const res = await fetch(`/api/compliance/${developmentId}${nameParam}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        console.error('[Compliance] API error:', res.status);
        return;
      }
      
      const data = await res.json();
      setCurrentDevelopment(data.development?.name || null);
      
      if (data.documentTypes?.length > 0 && data.units?.length > 0) {
        const transformedDocs: ComplianceDocument[] = [];
        
        data.documentTypes.forEach((docType: any) => {
          const houseType = docType.house_type || 'All Types';
          
          const existingDoc = data.documents?.find((d: any) => d.document_type_id === docType.id);
          
          transformedDocs.push({
            id: existingDoc?.id || `${docType.id}-pending`,
            name: docType.name,
            category: docType.category,
            houseType,
            status: existingDoc?.status || 'missing',
            uploadedDate: existingDoc?.created_at ? new Date(existingDoc.created_at) : undefined,
            expiryDate: existingDoc?.expiry_date ? new Date(existingDoc.expiry_date) : undefined,
            uploadedBy: existingDoc?.uploaded_by,
            version: existingDoc?.version,
            notes: existingDoc?.notes,
            description: docType.description,
          });
        });
        
        if (transformedDocs.length > 0) {
          setDocuments(transformedDocs);
        }
      }
    } catch (err) {
      console.error('[Compliance] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [developmentId, developmentName]);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

  // Calculate compliance by house type
  const houseTypeCompliance = useMemo(() => {
    const houseTypes = [...new Set(documents.map((d) => d.houseType))];
    return houseTypes.map((houseType) => {
      const docs = documents.filter((d) => d.houseType === houseType);
      const verified = docs.filter((d) => d.status === 'verified').length;
      const uploaded = docs.filter((d) => d.status === 'uploaded').length;
      const missing = docs.filter((d) => d.status === 'missing').length;
      const expired = docs.filter((d) => d.status === 'expired').length;

      return {
        houseType,
        totalDocuments: docs.length,
        verified,
        uploaded,
        missing,
        expired,
        compliancePercent: Math.round(((verified + uploaded) / docs.length) * 100),
      };
    });
  }, [documents]);

  const houseTypes = useMemo(() => [...new Set(documents.map((d) => d.houseType))], [documents]);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesHouseType = !selectedHouseType || doc.houseType === selectedHouseType;
      const matchesSearch =
        !searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;

      return matchesHouseType && matchesSearch && matchesStatus;
    });
  }, [documents, selectedHouseType, searchQuery, selectedStatus]);

  // Overall stats
  const stats = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter((d) => d.status === 'verified').length;
    const uploaded = documents.filter((d) => d.status === 'uploaded').length;
    const missing = documents.filter((d) => d.status === 'missing').length;
    const expired = documents.filter((d) => d.status === 'expired').length;
    const expiringSoon = documents.filter(
      (d) =>
        d.expiryDate &&
        d.expiryDate > new Date() &&
        d.expiryDate < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ).length;

    return {
      total,
      verified,
      uploaded,
      missing,
      expired,
      expiringSoon,
      overallCompliance: Math.round(((verified + uploaded) / total) * 100),
    };
  }, [documents]);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.missing > 0) {
      alerts.push({
        id: 'missing',
        title: `${stats.missing} documents missing`,
        description: 'Required compliance documents have not been uploaded',
        priority: 'critical',
        count: stats.missing,
      });
    }

    if (stats.expired > 0) {
      alerts.push({
        id: 'expired',
        title: `${stats.expired} documents expired`,
        description: 'Documents need to be renewed',
        priority: 'warning',
        count: stats.expired,
      });
    }

    if (stats.expiringSoon > 0) {
      alerts.push({
        id: 'expiring',
        title: `${stats.expiringSoon} documents expiring soon`,
        description: 'Within the next 30 days',
        priority: 'info',
        count: stats.expiringSoon,
      });
    }

    return alerts;
  }, [stats]);

  const handleExport = async (format: string) => {
    console.log('Exporting as', format);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const handleUploadClick = useCallback((doc: ComplianceDocument) => {
    setUploadTarget(doc);
    setShowUploadModal(true);
  }, []);

  const handleViewClick = useCallback((doc: ComplianceDocument) => {
    setSelectedDocument(doc);
    setShowDetailModal(true);
  }, []);

  const handleUploadComplete = useCallback((docId: string, files: File[]) => {
    // Simulate upload completion
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              status: 'uploaded' as DocumentStatus,
              uploadedDate: new Date(),
              uploadedBy: 'Current User',
              fileSize: `${(files[0]?.size / 1024 / 1024).toFixed(1)} MB`,
              fileName: files[0]?.name,
              version: (doc.version || 0) + 1,
              versions: [
                ...(doc.versions || []),
                {
                  version: (doc.version || 0) + 1,
                  uploadedDate: new Date(),
                  uploadedBy: 'Current User',
                  fileSize: `${(files[0]?.size / 1024 / 1024).toFixed(1)} MB`,
                  fileName: files[0]?.name || '',
                },
              ],
            }
          : doc
      )
    );
  }, []);

  const handleVerify = useCallback((docId: string) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === docId ? { ...doc, status: 'verified' as DocumentStatus } : doc
      )
    );
    setShowDetailModal(false);
  }, []);

  const handleBulkUploadComplete = useCallback((files: File[], houseType: string) => {
    console.log('Bulk upload:', files.length, 'files for', houseType);
    // In real app, would process files and match to documents
  }, []);

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

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
              <p className="text-sm text-gray-500 mt-1">
                {currentDevelopment ? `${currentDevelopment} - ` : ''}Track BCMS, HomeBond, and regulatory documents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu onExport={handleExport} />
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Bulk Upload
              </button>
            </div>
          </div>

          {/* Overall Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Overall Compliance</h3>
                <p className="text-xs text-gray-500">
                  {stats.verified + stats.uploaded} of {stats.total} documents uploaded
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CircularProgress value={stats.overallCompliance} size="lg" />
              </div>
            </div>

            <ProgressBar
              value={stats.overallCompliance}
              variant={
                stats.overallCompliance >= 100
                  ? 'success'
                  : stats.overallCompliance >= 60
                  ? 'warning'
                  : 'error'
              }
              size="lg"
              className="mb-4"
            />

            <StatCardGrid columns={5}>
              <StatCard
                label="Verified"
                value={stats.verified}
                icon={CheckCircle}
                iconColor="text-green-500"
                size="sm"
              />
              <StatCard
                label="Uploaded"
                value={stats.uploaded}
                icon={FileText}
                iconColor="text-blue-500"
                size="sm"
              />
              <StatCard
                label="Missing"
                value={stats.missing}
                icon={AlertCircle}
                iconColor="text-red-500"
                size="sm"
              />
              <StatCard
                label="Expired"
                value={stats.expired}
                icon={Clock}
                iconColor="text-amber-500"
                size="sm"
              />
              <StatCard
                label="Expiring Soon"
                value={stats.expiringSoon}
                icon={Calendar}
                iconColor="text-purple-500"
                size="sm"
              />
            </StatCardGrid>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* House Type Cards */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Compliance by House Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {houseTypeCompliance.map((compliance) => (
                <HouseTypeCard
                  key={compliance.houseType}
                  compliance={compliance}
                  isSelected={selectedHouseType === compliance.houseType}
                  onClick={() =>
                    setSelectedHouseType(
                      selectedHouseType === compliance.houseType ? null : compliance.houseType
                    )
                  }
                />
              ))}
            </div>
          </div>

          {/* Document Filters */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as DocumentStatus | 'all')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Status</option>
              {Object.entries(statusConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>

            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              />
            </div>

            {selectedHouseType && (
              <button
                onClick={() => setSelectedHouseType(null)}
                className="text-sm text-gold-600 hover:text-gold-700"
              >
                Clear filter
              </button>
            )}

            <p className="text-sm text-gray-500 ml-auto">{filteredDocuments.length} documents</p>
          </div>

          {/* Document List */}
          <div className="space-y-3">
            {filteredDocuments.length === 0 ? (
              <EmptyState
                title="No documents found"
                description="No documents match your current filters"
                icon={FolderOpen}
              />
            ) : (
              filteredDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onUpload={() => handleUploadClick(doc)}
                  onView={() => handleViewClick(doc)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadTarget(null);
        }}
        document={uploadTarget}
        onUploadComplete={handleUploadComplete}
      />

      {/* Document Detail Modal */}
      <DocumentDetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDocument(null);
        }}
        document={selectedDocument}
        onVerify={handleVerify}
        onReupload={() => {
          setShowDetailModal(false);
          if (selectedDocument) {
            setUploadTarget(selectedDocument);
            setShowUploadModal(true);
          }
        }}
      />

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUploadModal}
        onClose={() => setShowBulkUploadModal(false)}
        houseTypes={houseTypes}
        onUploadComplete={handleBulkUploadComplete}
      />
    </div>
  );
}
