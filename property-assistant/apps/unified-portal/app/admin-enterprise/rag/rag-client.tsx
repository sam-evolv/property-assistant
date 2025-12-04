'use client';

import { useEffect, useState } from 'react';
import { Database, AlertTriangle, FileX, Package, Activity } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { LoadingSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { BarChart } from '@/components/admin-enterprise/charts/BarChart';
import { LineChart } from '@/components/admin-enterprise/charts/LineChart';

interface RAGMetrics {
  total_chunks: number;
  total_documents: number;
  avg_chunk_size: number;
  chunks_per_development: Array<{
    development_id: string;
    development_name: string;
    chunk_count: number;
    document_count: number;
  }>;
  chunks_by_doc_type: Array<{
    document_type: string;
    chunk_count: number;
  }>;
  orphaned_chunks_count: number;
  embedding_stats: {
    total_with_embeddings: number;
    total_without_embeddings: number;
    avg_embedding_age_days: number;
  };
}

export function RAGAnalytics() {
  const [data, setData] = useState<RAGMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/analytics/rag')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch RAG analytics');
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error('RAG analytics error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium">Failed to load RAG analytics</p>
          <p className="text-red-500 text-sm mt-2">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const chunksPerDevelopmentData = data.chunks_per_development.slice(0, 10).map((d) => ({
    name: d.development_name.length > 20 ? d.development_name.substring(0, 20) + '...' : d.development_name,
    chunks: d.chunk_count,
    documents: d.document_count,
  }));

  const chunksByTypeData = data.chunks_by_doc_type.map((t) => ({
    type: t.document_type.replace(/_/g, ' ').toUpperCase(),
    count: t.chunk_count,
  }));

  const embeddingCoveragePercent =
    data.total_chunks > 0
      ? Math.round((data.embedding_stats.total_with_embeddings / data.total_chunks) * 100)
      : 0;

  const avgChunksPerDoc =
    data.total_documents > 0 ? Math.round(data.total_chunks / data.total_documents) : 0;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="RAG Index Analytics"
        description="Vector embeddings and document chunks analysis"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <InsightCard
          title="Total Chunks"
          value={data.total_chunks}
          subtitle={`${avgChunksPerDoc} chunks/doc avg`}
          icon={<Package className="w-5 h-5" />}
        />
        <InsightCard
          title="Embedding Coverage"
          value={`${embeddingCoveragePercent}%`}
          subtitle={`${data.embedding_stats.total_with_embeddings.toLocaleString()}/${data.total_chunks.toLocaleString()} chunks`}
          icon={<Activity className="w-5 h-5" />}
        />
        <InsightCard
          title="Orphaned Chunks"
          value={data.orphaned_chunks_count}
          subtitle="No document link"
          icon={<FileX className="w-5 h-5" />}
        />
        <InsightCard
          title="Avg Chunk Size"
          value={`${data.avg_chunk_size}`}
          subtitle="characters per chunk"
          icon={<Database className="w-5 h-5" />}
        />
      </div>

      {/* Warnings */}
      {(data.orphaned_chunks_count > 0 || data.embedding_stats.total_without_embeddings > 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900 mb-1">Data Quality Issues Detected</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                {data.orphaned_chunks_count > 0 && (
                  <li>• {data.orphaned_chunks_count} chunks have no associated document</li>
                )}
                {data.embedding_stats.total_without_embeddings > 0 && (
                  <li>• {data.embedding_stats.total_without_embeddings} chunks missing embeddings</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Chunks Per Development */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top 10 Developments by Chunks</h3>
          </div>
          <BarChart
            data={chunksPerDevelopmentData}
            xKey="name"
            bars={[
              { key: 'chunks', color: '#D4AF37', name: 'Chunks' },
              { key: 'documents', color: '#A67C3A', name: 'Documents' },
            ]}
            height={280}
          />
        </div>

        {/* Chunks by Document Type */}
        <div className="bg-white border border-gold-100 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <FileX className="w-5 h-5 text-gold-600" />
            <h3 className="text-lg font-semibold text-gray-900">Chunks by Document Type</h3>
          </div>
          <BarChart
            data={chunksByTypeData}
            xKey="type"
            bars={[{ key: 'count', color: '#D4AF37', name: 'Chunks' }]}
            height={280}
          />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Developments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Development
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Documents
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chunks
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Chunks/Doc
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.chunks_per_development.map((dev, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-900">{dev.development_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">{dev.document_count}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {dev.chunk_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 text-right">
                    {dev.document_count > 0
                      ? Math.round(dev.chunk_count / dev.document_count)
                      : 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedding Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Chunks with Embeddings</p>
          <p className="text-3xl font-bold text-green-600">
            {data.embedding_stats.total_with_embeddings.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Chunks without Embeddings</p>
          <p className="text-3xl font-bold text-red-600">
            {data.embedding_stats.total_without_embeddings.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Avg Embedding Age</p>
          <p className="text-3xl font-bold text-gray-900">
            {data.embedding_stats.avg_embedding_age_days} days
          </p>
        </div>
      </div>
    </div>
  );
}
