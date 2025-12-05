'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart3, PieChart, AlertTriangle, TrendingUp, 
  FileText, Clock, Sparkles, Target, Loader2
} from 'lucide-react';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { DISCIPLINES } from '@/lib/archive-constants';

interface DisciplineCoverage {
  discipline: string;
  count: number;
  percentage: number;
}

interface HouseTypeCoverage {
  house_type_code: string;
  development_name: string;
  disciplines: string[];
  missing_disciplines: string[];
  coverage_percentage: number;
}

interface ClassificationQuality {
  total_documents: number;
  ai_classified: number;
  needs_review: number;
  classification_rate: number;
  avg_confidence: number;
}

interface DocumentCurrency {
  total_documents: number;
  docs_older_than_year: number;
  docs_last_30_days: number;
  docs_last_90_days: number;
}

interface KeywordTrend {
  term: string;
  count: number;
  is_risk_term: boolean;
}

interface GapPrediction {
  house_type_code: string;
  development_name: string;
  missing: string[];
  has_count: number;
  expected_count: number;
}

interface InsightsData {
  document_coverage: {
    by_discipline: DisciplineCoverage[];
    total_documents: number;
    missing_disciplines: string[];
  };
  house_type_coverage: HouseTypeCoverage[];
  classification_quality: ClassificationQuality;
  currency: DocumentCurrency;
  keyword_trends: KeywordTrend[];
  predicted_gaps: GapPrediction[];
}

export function InsightsTab() {
  const { tenantId, developmentId, isHydrated } = useSafeCurrentContext();
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInsights() {
      if (!isHydrated || !tenantId) return;
      
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ tenantId });
        if (developmentId) params.set('developmentId', developmentId);

        const res = await fetch(`/developer/api/archive/insights?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to load insights');
        }

        setInsights(data);
      } catch (err) {
        console.error('Failed to fetch insights:', err);
        setError(err instanceof Error ? err.message : 'Failed to load insights');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInsights();
  }, [isHydrated, tenantId, developmentId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-3" />
          <p className="text-gray-600">Generating insights...</p>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">{error || 'No insights available'}</p>
      </div>
    );
  }

  const { document_coverage, house_type_coverage, classification_quality, currency, keyword_trends, predicted_gaps } = insights;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Total Documents</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{document_coverage.total_documents}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">AI Classified</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {classification_quality.classification_rate}%
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Recent (30 days)</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{currency.docs_last_30_days}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Needs Review</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{classification_quality.needs_review}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-amber-500" />
            Discipline Coverage
          </h3>
          <div className="space-y-3">
            {document_coverage.by_discipline.map((disc) => {
              const disciplineInfo = DISCIPLINES[disc.discipline as keyof typeof DISCIPLINES] || DISCIPLINES.other;
              return (
                <div key={disc.discipline} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-600 truncate">{disciplineInfo.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${disc.percentage}%`,
                        backgroundColor: disciplineInfo.color 
                      }}
                    />
                  </div>
                  <div className="w-16 text-sm text-gray-600 text-right">{disc.count} docs</div>
                </div>
              );
            })}
            {document_coverage.missing_disciplines.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  Missing: {document_coverage.missing_disciplines.map(d => 
                    DISCIPLINES[d as keyof typeof DISCIPLINES]?.label || d
                  ).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-amber-500" />
            Document Currency
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-gray-900">{currency.docs_last_90_days}</p>
                <p className="text-sm text-gray-500">Last 90 days</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-amber-600">{currency.docs_older_than_year}</p>
                <p className="text-sm text-gray-500">Older than 1 year</p>
              </div>
            </div>
            {currency.docs_older_than_year > 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                Consider reviewing {currency.docs_older_than_year} documents that may need updating
              </p>
            )}
          </div>
        </div>
      </div>

      {predicted_gaps.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-red-500" />
            Predicted Documentation Gaps
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-medium text-gray-600">House Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Development</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-600">Missing Disciplines</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-600">Coverage</th>
                </tr>
              </thead>
              <tbody>
                {predicted_gaps.map((gap, idx) => (
                  <tr key={idx} className="border-b border-gray-50">
                    <td className="py-2 px-3 font-medium">{gap.house_type_code}</td>
                    <td className="py-2 px-3 text-gray-600">{gap.development_name}</td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {gap.missing.slice(0, 4).map(m => (
                          <span key={m} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">
                            {DISCIPLINES[m as keyof typeof DISCIPLINES]?.label || m}
                          </span>
                        ))}
                        {gap.missing.length > 4 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            +{gap.missing.length - 4} more
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`font-medium ${
                        gap.has_count / gap.expected_count > 0.5 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {gap.has_count}/{gap.expected_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {house_type_coverage.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            House Type Coverage
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {house_type_coverage.slice(0, 9).map((ht, idx) => (
              <div key={idx} className="p-4 border border-gray-100 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{ht.house_type_code}</span>
                  <span className={`text-sm font-medium ${
                    ht.coverage_percentage >= 75 ? 'text-green-600' :
                    ht.coverage_percentage >= 50 ? 'text-amber-600' :
                    'text-red-600'
                  }`}>
                    {ht.coverage_percentage}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{ht.development_name}</p>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div 
                    className={`h-full rounded-full ${
                      ht.coverage_percentage >= 75 ? 'bg-green-500' :
                      ht.coverage_percentage >= 50 ? 'bg-amber-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${ht.coverage_percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {keyword_trends.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Top Terms</h3>
          <div className="flex flex-wrap gap-2">
            {keyword_trends.map((kw, idx) => (
              <span 
                key={idx}
                className={`px-3 py-1.5 rounded-full text-sm ${
                  kw.is_risk_term 
                    ? 'bg-red-100 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {kw.term}
                <span className="ml-1 text-xs opacity-60">({kw.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
