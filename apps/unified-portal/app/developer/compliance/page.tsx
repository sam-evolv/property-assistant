'use client';

import { useState, useMemo } from 'react';
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
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar, CircularProgress } from '@/components/ui/ProgressBar';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ExportMenu } from '@/components/ui/ExportMenu';

// Types
type DocumentStatus = 'missing' | 'uploaded' | 'verified' | 'expired';

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

// Mock data
const mockDocuments: ComplianceDocument[] = [
  // Type A Documents
  { id: '1', name: 'BCMS Certificate', category: 'Certification', houseType: 'Type A', status: 'verified', uploadedDate: new Date('2025-01-10'), expiryDate: new Date('2026-01-10'), uploadedBy: 'J. Murphy', fileSize: '2.4 MB', version: 1 },
  { id: '2', name: 'HomeBond Registration', category: 'Registration', houseType: 'Type A', status: 'verified', uploadedDate: new Date('2025-01-08'), uploadedBy: 'J. Murphy', fileSize: '1.2 MB', version: 1 },
  { id: '3', name: 'Energy Performance Certificate', category: 'Certification', houseType: 'Type A', status: 'uploaded', uploadedDate: new Date('2025-01-15'), uploadedBy: 'S. Walsh', fileSize: '856 KB', version: 2 },
  { id: '4', name: 'Fire Safety Certificate', category: 'Safety', houseType: 'Type A', status: 'missing' },
  { id: '5', name: 'Structural Warranty', category: 'Warranty', houseType: 'Type A', status: 'expired', uploadedDate: new Date('2024-01-01'), expiryDate: new Date('2025-01-01'), uploadedBy: 'J. Murphy', fileSize: '3.1 MB', version: 1 },

  // Type B Documents
  { id: '6', name: 'BCMS Certificate', category: 'Certification', houseType: 'Type B', status: 'verified', uploadedDate: new Date('2025-01-10'), expiryDate: new Date('2026-01-10'), uploadedBy: 'J. Murphy', fileSize: '2.4 MB', version: 1 },
  { id: '7', name: 'HomeBond Registration', category: 'Registration', houseType: 'Type B', status: 'uploaded', uploadedDate: new Date('2025-01-12'), uploadedBy: 'S. Walsh', fileSize: '1.3 MB', version: 1 },
  { id: '8', name: 'Energy Performance Certificate', category: 'Certification', houseType: 'Type B', status: 'missing' },
  { id: '9', name: 'Fire Safety Certificate', category: 'Safety', houseType: 'Type B', status: 'verified', uploadedDate: new Date('2025-01-05'), uploadedBy: 'J. Murphy', fileSize: '945 KB', version: 1 },
  { id: '10', name: 'Structural Warranty', category: 'Warranty', houseType: 'Type B', status: 'uploaded', uploadedDate: new Date('2025-01-08'), expiryDate: new Date('2026-01-08'), uploadedBy: 'S. Walsh', fileSize: '2.9 MB', version: 1 },

  // Type C Documents
  { id: '11', name: 'BCMS Certificate', category: 'Certification', houseType: 'Type C', status: 'uploaded', uploadedDate: new Date('2025-01-14'), expiryDate: new Date('2026-01-14'), uploadedBy: 'K. Dolan', fileSize: '2.6 MB', version: 1 },
  { id: '12', name: 'HomeBond Registration', category: 'Registration', houseType: 'Type C', status: 'missing' },
  { id: '13', name: 'Energy Performance Certificate', category: 'Certification', houseType: 'Type C', status: 'missing' },
  { id: '14', name: 'Fire Safety Certificate', category: 'Safety', houseType: 'Type C', status: 'missing' },
  { id: '15', name: 'Structural Warranty', category: 'Warranty', houseType: 'Type C', status: 'missing' },
];

const statusConfig: Record<DocumentStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  missing: { label: 'Missing', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  uploaded: { label: 'Uploaded', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  verified: { label: 'Verified', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  expired: { label: 'Expired', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
};

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
        'flex items-center justify-between p-4 rounded-lg border',
        status.bgColor,
        status.borderColor
      )}
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

      <div className="flex items-center gap-2">
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
  const [selectedHouseType, setSelectedHouseType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | 'all'>('all');

  // Calculate compliance by house type
  const houseTypeCompliance = useMemo(() => {
    const houseTypes = [...new Set(mockDocuments.map((d) => d.houseType))];
    return houseTypes.map((houseType) => {
      const docs = mockDocuments.filter((d) => d.houseType === houseType);
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
  }, []);

  // Filter documents
  const filteredDocuments = useMemo(() => {
    return mockDocuments.filter((doc) => {
      const matchesHouseType = !selectedHouseType || doc.houseType === selectedHouseType;
      const matchesSearch =
        !searchQuery || doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;

      return matchesHouseType && matchesSearch && matchesStatus;
    });
  }, [selectedHouseType, searchQuery, selectedStatus]);

  // Overall stats
  const stats = useMemo(() => {
    const total = mockDocuments.length;
    const verified = mockDocuments.filter((d) => d.status === 'verified').length;
    const uploaded = mockDocuments.filter((d) => d.status === 'uploaded').length;
    const missing = mockDocuments.filter((d) => d.status === 'missing').length;
    const expired = mockDocuments.filter((d) => d.status === 'expired').length;
    const expiringSoon = mockDocuments.filter(
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
  }, []);

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

  const handleUpload = (doc: ComplianceDocument) => {
    console.log('Upload document:', doc.name);
    // TODO: Implement upload
  };

  const handleView = (doc: ComplianceDocument) => {
    console.log('View document:', doc.name);
    // TODO: Implement view
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track BCMS, HomeBond, and regulatory documents
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu onExport={handleExport} />
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
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

            <p className="text-sm text-gray-500 ml-auto">
              {filteredDocuments.length} documents
            </p>
          </div>

          {/* Document List */}
          <div className="space-y-3">
            {filteredDocuments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No documents match your filters</p>
              </div>
            ) : (
              filteredDocuments.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  document={doc}
                  onUpload={() => handleUpload(doc)}
                  onView={() => handleView(doc)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
