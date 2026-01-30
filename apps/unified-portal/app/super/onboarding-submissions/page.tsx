'use client';

import { useState, useEffect, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Search,
  RefreshCw,
  FileText,
  Building2,
  Mail,
  Calendar,
  MapPin,
  ExternalLink,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  Card,
  CardHeader,
  CardContent,
  Button,
  Badge,
  EmptyState,
} from '@/components/ui/premium';
import Link from 'next/link';

interface Submission {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  developer_email: string;
  developer_name?: string;
  company_name?: string;
  development_name: string;
  development_address: string;
  county: string;
  estimated_units: number;
  expected_handover_date?: string;
  planning_reference?: string;
  planning_pack_url?: string;
  master_spreadsheet_url?: string;
  supporting_documents_urls?: string[];
  notes?: string;
  status: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  total: number;
  pending: number;
  in_review: number;
  completed: number;
  rejected: number;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(dateString);
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning" size="sm">Pending</Badge>;
    case 'in_review':
      return <Badge variant="info" size="sm">In Review</Badge>;
    case 'completed':
      return <Badge variant="success" size="sm">Completed</Badge>;
    case 'rejected':
      return <Badge variant="error" size="sm">Rejected</Badge>;
    default:
      return <Badge variant="neutral" size="sm">{status}</Badge>;
  }
}

const SubmissionRow = memo(function SubmissionRow({
  submission,
  onStatusChange,
}: {
  submission: Submission;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [updating, setUpdating] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/super/onboarding-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onStatusChange(submission.id, newStatus);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-neutral-50 transition-colors group">
        <td className="px-6 py-4">
          <div>
            <p className="font-semibold text-neutral-900">{submission.development_name}</p>
            <p className="text-sm text-neutral-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />
              {submission.development_address}, {submission.county}
            </p>
          </div>
        </td>
        <td className="px-6 py-4">
          <div>
            <p className="text-sm text-neutral-900">{submission.developer_name || submission.developer_email}</p>
            {submission.company_name && (
              <p className="text-xs text-neutral-500">{submission.company_name}</p>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          <span className="font-semibold text-neutral-900">{submission.estimated_units}</span>
        </td>
        <td className="px-6 py-4">
          {getStatusBadge(submission.status)}
        </td>
        <td className="px-6 py-4 text-sm text-neutral-600">
          {formatRelativeTime(submission.created_at)}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-neutral-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            {submission.status === 'pending' && (
              <button
                onClick={() => handleStatusChange('in_review')}
                disabled={updating}
                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Review'}
              </button>
            )}
            {submission.status === 'in_review' && (
              <button
                onClick={() => handleStatusChange('completed')}
                disabled={updating}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Complete'}
              </button>
            )}
          </div>
        </td>
      </tr>
      {showDetails && (
        <tr className="bg-neutral-50">
          <td colSpan={6} className="px-6 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-neutral-500 mb-1">Email</p>
                <p className="text-neutral-900">{submission.developer_email}</p>
              </div>
              <div>
                <p className="text-neutral-500 mb-1">Expected Handover</p>
                <p className="text-neutral-900">{formatDate(submission.expected_handover_date)}</p>
              </div>
              <div>
                <p className="text-neutral-500 mb-1">Planning Reference</p>
                <p className="text-neutral-900">{submission.planning_reference || '-'}</p>
              </div>
              <div>
                <p className="text-neutral-500 mb-1">Tenant</p>
                <p className="text-neutral-900">{submission.tenant_name || submission.tenant_id?.slice(0, 8) || '-'}</p>
              </div>
              {submission.notes && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-neutral-500 mb-1">Notes</p>
                  <p className="text-neutral-900">{submission.notes}</p>
                </div>
              )}
              <div className="col-span-2 md:col-span-4 flex gap-4 flex-wrap">
                {submission.planning_pack_url && (
                  <a
                    href={submission.planning_pack_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Planning Pack
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {submission.master_spreadsheet_url && (
                  <a
                    href={submission.master_spreadsheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Master Spreadsheet
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

export default function OnboardingSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    in_review: 0,
    completed: 0,
    rejected: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchSubmissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/super/onboarding-submissions');
      if (!response.ok) throw new Error('Failed to fetch submissions');

      const data = await response.json();
      setSubmissions(data.submissions || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError('Unable to load submissions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const handleStatusChange = (id: string, newStatus: string) => {
    setSubmissions(prev =>
      prev.map(s => (s.id === id ? { ...s, status: newStatus } : s))
    );
    setStats(prev => {
      const updated = { ...prev };
      const oldSubmission = submissions.find(s => s.id === id);
      if (oldSubmission) {
        const oldStatus = oldSubmission.status as keyof Stats;
        const newStatusKey = newStatus as keyof Stats;
        if (oldStatus in updated && typeof updated[oldStatus] === 'number') {
          (updated[oldStatus] as number)--;
        }
        if (newStatusKey in updated && typeof updated[newStatusKey] === 'number') {
          (updated[newStatusKey] as number)++;
        }
      }
      return updated;
    });
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesSearch =
      sub.development_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.developer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.developer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in_review', label: 'In Review' },
    { value: 'completed', label: 'Completed' },
    { value: 'rejected', label: 'Rejected' },
  ];

  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Onboarding Submissions"
          subtitle="Review and manage development onboarding requests from developers"
          icon={ClipboardList}
          actions={
            <Button
              variant="outline"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchSubmissions}
              disabled={isLoading}
              className={cn(isLoading && '[&_svg]:animate-spin')}
            >
              Refresh
            </Button>
          }
        />

        <MetricCardGrid columns={4}>
          <MetricCard
            label="Total Submissions"
            value={stats.total}
            icon={ClipboardList}
            variant="highlighted"
          />
          <MetricCard
            label="Pending"
            value={stats.pending}
            icon={Clock}
            variant="warning"
          />
          <MetricCard
            label="In Review"
            value={stats.in_review}
            icon={Eye}
            variant="default"
          />
          <MetricCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle}
            variant="success"
          />
        </MetricCardGrid>

        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search by development, email, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              <div className="flex items-center gap-2">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStatusFilter(option.value)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      statusFilter === option.value
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                variant="error"
                title="Failed to Load"
                description={error}
                action={{ label: 'Try Again', onClick: fetchSubmissions }}
              />
            </CardContent>
          </Card>
        )}

        {!error && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">Submissions</h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {filteredSubmissions.length} {filteredSubmissions.length === 1 ? 'submission' : 'submissions'} found
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center">
                  <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-neutral-500">Loading submissions...</p>
                </div>
              ) : filteredSubmissions.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    variant={searchQuery || statusFilter !== 'all' ? 'no-results' : 'default'}
                    title={searchQuery || statusFilter !== 'all' ? 'No matches found' : 'No submissions yet'}
                    description={
                      searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria'
                        : 'Submissions will appear here when developers complete the onboarding form'
                    }
                    action={
                      searchQuery || statusFilter !== 'all'
                        ? {
                            label: 'Clear Filters',
                            onClick: () => {
                              setSearchQuery('');
                              setStatusFilter('all');
                            },
                          }
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border-y border-neutral-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Development
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Developer
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Units
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {filteredSubmissions.map((submission) => (
                        <SubmissionRow
                          key={submission.id}
                          submission={submission}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
