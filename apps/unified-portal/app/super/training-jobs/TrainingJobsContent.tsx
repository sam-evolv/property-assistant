'use client';

import { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Database,
  FileText,
  Cpu,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Search,
  Building2,
  Zap,
  TrendingUp,
  ChevronRight,
  Activity,
  HardDrive,
  FileCode,
  Bot,
  ArrowRight,
} from 'lucide-react';
import {
  PageHeader,
  MetricCard,
  MetricCardGrid,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  EmptyState,
} from '@/components/ui/premium';
import { useProjectContext } from '@/contexts/ProjectContext';

// ============================================================================
// TYPES
// ============================================================================
interface ProcessingJob {
  id: string;
  document_id: string;
  document_title: string;
  development_id: string;
  development_name?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';
  progress: number;
  chunks_processed: number;
  chunks_total: number;
  started_at: string | null;
  completed_at: string | null;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

interface PipelineStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  totalChunks: number;
  avgProcessingTime: number; // in seconds
  throughputPerHour: number;
  errorRate: number;
}

interface PipelineStage {
  id: string;
  name: string;
  icon: any;
  status: 'idle' | 'active' | 'completed' | 'error';
  itemsProcessed: number;
  itemsTotal: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  return new Date(dateString).toLocaleDateString();
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'completed':
      return { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle2, label: 'Completed' };
    case 'processing':
      return { color: 'text-blue-600', bg: 'bg-blue-50', icon: Loader2, label: 'Processing' };
    case 'queued':
      return { color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock, label: 'Queued' };
    case 'retrying':
      return { color: 'text-orange-600', bg: 'bg-orange-50', icon: RotateCcw, label: 'Retrying' };
    case 'failed':
      return { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: 'Failed' };
    default:
      return { color: 'text-neutral-600', bg: 'bg-neutral-50', icon: Clock, label: status };
  }
}

// ============================================================================
// PIPELINE VISUALIZATION COMPONENT
// ============================================================================
const PipelineVisualization = memo(function PipelineVisualization({
  stages,
  isActive,
}: {
  stages: PipelineStage[];
  isActive: boolean;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              isActive ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"
            )} />
            <h3 className="text-lg font-semibold text-neutral-900">
              Document Ingestion Pipeline
            </h3>
          </div>
          <Badge variant={isActive ? "success" : "default"} size="sm">
            {isActive ? "Active" : "Idle"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center">
              {/* Stage */}
              <div className={cn(
                "flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-colors min-w-[120px]",
                stage.status === 'active' && "bg-blue-50",
                stage.status === 'completed' && "bg-emerald-50",
                stage.status === 'error' && "bg-red-50",
                stage.status === 'idle' && "bg-neutral-50"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  stage.status === 'active' && "bg-blue-100 text-blue-600",
                  stage.status === 'completed' && "bg-emerald-100 text-emerald-600",
                  stage.status === 'error' && "bg-red-100 text-red-600",
                  stage.status === 'idle' && "bg-neutral-100 text-neutral-400"
                )}>
                  <stage.icon className={cn(
                    "w-6 h-6",
                    stage.status === 'active' && "animate-pulse"
                  )} />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "text-sm font-medium",
                    stage.status === 'idle' ? "text-neutral-400" : "text-neutral-900"
                  )}>
                    {stage.name}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {stage.itemsProcessed} / {stage.itemsTotal}
                  </p>
                </div>
              </div>

              {/* Arrow between stages */}
              {index < stages.length - 1 && (
                <ArrowRight className={cn(
                  "w-5 h-5 mx-2",
                  stage.status === 'completed' ? "text-emerald-400" : "text-neutral-300"
                )} />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// ============================================================================
// JOB ROW COMPONENT
// ============================================================================
const JobRow = memo(function JobRow({
  job,
  onRetry,
}: {
  job: ProcessingJob;
  onRetry?: (jobId: string) => void;
}) {
  const statusConfig = getStatusConfig(job.status);
  const Icon = statusConfig.icon;
  const progress = job.chunks_total > 0 ? (job.chunks_processed / job.chunks_total) * 100 : 0;

  return (
    <tr className="hover:bg-neutral-50 transition-colors group">
      {/* Document */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
            <FileText className="w-5 h-5 text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate max-w-[200px]">
              {job.document_title}
            </p>
            <p className="text-xs text-neutral-500">
              {job.development_name || 'Unknown Development'}
            </p>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <Icon className={cn(
            "w-4 h-4",
            statusConfig.color,
            job.status === 'processing' && "animate-spin"
          )} />
          <Badge
            variant={
              job.status === 'completed' ? 'success' :
              job.status === 'failed' ? 'error' :
              job.status === 'processing' ? 'info' :
              'warning'
            }
            size="sm"
          >
            {statusConfig.label}
          </Badge>
        </div>
      </td>

      {/* Progress */}
      <td className="px-6 py-4">
        <div className="w-32">
          <div className="flex items-center justify-between text-xs text-neutral-600 mb-1">
            <span>{job.chunks_processed}</span>
            <span>{job.chunks_total}</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                job.status === 'completed' && "bg-emerald-500",
                job.status === 'processing' && "bg-blue-500",
                job.status === 'failed' && "bg-red-500",
                job.status === 'queued' && "bg-neutral-300",
                job.status === 'retrying' && "bg-orange-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </td>

      {/* Time */}
      <td className="px-6 py-4 text-sm text-neutral-600">
        {job.started_at ? formatRelativeTime(job.started_at) : 'Pending'}
      </td>

      {/* Retry Count */}
      <td className="px-6 py-4">
        {job.retry_count > 0 ? (
          <Badge variant="warning" size="xs">
            {job.retry_count} {job.retry_count === 1 ? 'retry' : 'retries'}
          </Badge>
        ) : (
          <span className="text-neutral-400 text-sm">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 text-right">
        {job.status === 'failed' && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={RotateCcw}
            onClick={() => onRetry(job.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Retry
          </Button>
        )}
        {job.error_message && (
          <span className="text-xs text-red-500 block mt-1 max-w-[150px] truncate" title={job.error_message}>
            {job.error_message}
          </span>
        )}
      </td>
    </tr>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const TrainingJobsContent = memo(function TrainingJobsContent() {
  const { selectedProjectId } = useProjectContext();
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [stats, setStats] = useState<PipelineStats>({
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalChunks: 0,
    avgProcessingTime: 0,
    throughputPerHour: 0,
    errorRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pipeline stages based on actual processing steps
  const pipelineStages: PipelineStage[] = useMemo(() => [
    {
      id: 'upload',
      name: 'Upload',
      icon: FileText,
      status: stats.queued > 0 ? 'active' : 'idle',
      itemsProcessed: stats.completed + stats.processing,
      itemsTotal: stats.queued + stats.processing + stats.completed + stats.failed,
    },
    {
      id: 'parsing',
      name: 'Parsing',
      icon: FileCode,
      status: stats.processing > 0 ? 'active' : (stats.completed > 0 ? 'completed' : 'idle'),
      itemsProcessed: stats.completed,
      itemsTotal: stats.processing + stats.completed,
    },
    {
      id: 'chunking',
      name: 'Chunking',
      icon: Database,
      status: stats.processing > 0 ? 'active' : (stats.completed > 0 ? 'completed' : 'idle'),
      itemsProcessed: stats.totalChunks,
      itemsTotal: stats.totalChunks,
    },
    {
      id: 'embedding',
      name: 'Embedding',
      icon: Bot,
      status: stats.processing > 0 ? 'active' : (stats.completed > 0 ? 'completed' : 'idle'),
      itemsProcessed: stats.completed,
      itemsTotal: stats.processing + stats.completed,
    },
    {
      id: 'indexing',
      name: 'Indexed',
      icon: HardDrive,
      status: stats.completed > 0 ? 'completed' : 'idle',
      itemsProcessed: stats.completed,
      itemsTotal: stats.completed,
    },
  ], [stats]);

  const fetchJobs = useCallback(async () => {
    setIsRefreshing(true);

    try {
      // Fetch documents and their processing status
      const projectParam = selectedProjectId ? `?projectId=${selectedProjectId}` : '';
      const response = await fetch(`/api/documents${projectParam}`);

      if (response.ok) {
        const data = await response.json();
        const documents = data.documents || data || [];

        // Transform documents into job-like objects
        const transformedJobs: ProcessingJob[] = documents.map((doc: any) => ({
          id: doc.id,
          document_id: doc.id,
          document_title: doc.title || doc.filename || 'Untitled',
          development_id: doc.development_id,
          development_name: doc.development_name,
          status: doc.status === 'indexed' ? 'completed' :
                  doc.status === 'failed' ? 'failed' :
                  doc.status === 'processing' ? 'processing' : 'queued',
          progress: doc.status === 'indexed' ? 100 :
                   doc.status === 'processing' ? 50 : 0,
          chunks_processed: doc.chunk_count || 0,
          chunks_total: doc.chunk_count || (doc.status === 'indexed' ? 1 : 10),
          started_at: doc.created_at,
          completed_at: doc.status === 'indexed' ? doc.updated_at : null,
          error_message: doc.error_message,
          retry_count: doc.retry_count || 0,
          created_at: doc.created_at,
        }));

        setJobs(transformedJobs);

        // Calculate stats
        const newStats: PipelineStats = {
          queued: transformedJobs.filter(j => j.status === 'queued').length,
          processing: transformedJobs.filter(j => j.status === 'processing').length,
          completed: transformedJobs.filter(j => j.status === 'completed').length,
          failed: transformedJobs.filter(j => j.status === 'failed').length,
          totalChunks: transformedJobs.reduce((acc, j) => acc + j.chunks_processed, 0),
          avgProcessingTime: 45, // Placeholder - would need actual timing data
          throughputPerHour: Math.round(transformedJobs.filter(j => j.status === 'completed').length * 2.5),
          errorRate: transformedJobs.length > 0
            ? Math.round((transformedJobs.filter(j => j.status === 'failed').length / transformedJobs.length) * 100)
            : 0,
        };
        setStats(newStats);
        setError(null);
      } else {
        throw new Error('Failed to fetch processing jobs');
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load processing jobs');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchJobs();
    // Auto-refresh every 10 seconds when there are active jobs
    const interval = setInterval(() => {
      if (stats.processing > 0 || stats.queued > 0) {
        fetchJobs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchJobs, stats.processing, stats.queued]);

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.document_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job.development_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchQuery, statusFilter]);

  // Sort by most recent first
  const sortedJobs = useMemo(() => {
    return [...filteredJobs].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredJobs]);

  const isPipelineActive = stats.processing > 0 || stats.queued > 0;

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'queued', label: 'Queued' },
    { value: 'processing', label: 'Processing' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  if (isLoading) {
    return null; // Skeleton shown by parent
  }

  return (
    <div className="p-6 lg:p-8 bg-neutral-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <PageHeader
          title="Document Processing"
          subtitle="Monitor document ingestion pipeline and processing jobs"
          icon={Cpu}
          actions={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={RefreshCw}
                onClick={fetchJobs}
                disabled={isRefreshing}
                className={cn(isRefreshing && '[&_svg]:animate-spin')}
              >
                Refresh
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <MetricCardGrid columns={4}>
          <MetricCard
            label="Queued"
            value={stats.queued}
            icon={Clock}
            variant="warning"
            description="Documents waiting"
          />
          <MetricCard
            label="Processing"
            value={stats.processing}
            icon={Loader2}
            variant="highlighted"
            description="Currently processing"
            trend={stats.processing > 0 ? 100 : undefined}
          />
          <MetricCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            variant="success"
            description={`${stats.totalChunks.toLocaleString()} total chunks`}
          />
          <MetricCard
            label="Failed"
            value={stats.failed}
            icon={XCircle}
            variant={stats.failed > 0 ? "error" : "default"}
            description={`${stats.errorRate}% error rate`}
          />
        </MetricCardGrid>

        {/* Pipeline Visualization */}
        <PipelineVisualization stages={pipelineStages} isActive={isPipelineActive} />

        {/* Performance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Avg Processing Time</p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {formatDuration(stats.avgProcessingTime)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Throughput</p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {stats.throughputPerHour}/hour
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Total Chunks Indexed</p>
                  <p className="text-lg font-semibold text-neutral-900">
                    {stats.totalChunks.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
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
                    {option.value !== 'all' && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({stats[option.value as keyof PipelineStats] || 0})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card>
            <CardContent className="py-8">
              <EmptyState
                variant="error"
                title="Failed to Load"
                description={error}
                action={{
                  label: 'Try Again',
                  onClick: fetchJobs,
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Jobs Table */}
        {!error && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Processing Jobs
                  </h3>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {sortedJobs.length} {sortedJobs.length === 1 ? 'job' : 'jobs'} found
                  </p>
                </div>
                {isPipelineActive && (
                  <Badge variant="success" dot>
                    Pipeline Active
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {sortedJobs.length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    variant={searchQuery || statusFilter !== 'all' ? 'no-results' : 'default'}
                    title={searchQuery || statusFilter !== 'all' ? 'No matching jobs' : 'No processing jobs'}
                    description={
                      searchQuery || statusFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria'
                        : 'Documents will appear here when uploaded for processing'
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
                          Document
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Progress
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Started
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Retries
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {sortedJobs.map((job) => (
                        <JobRow key={job.id} job={job} />
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
});

export default TrainingJobsContent;
