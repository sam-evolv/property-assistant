'use client';

import { FileText, Star, AlertCircle, Sparkles, Building2, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { DISCIPLINES, type DisciplineType } from '@/lib/archive';

interface SearchResult {
  document_id: string;
  file_name: string;
  title: string;
  discipline: string | null;
  house_type_code: string | null;
  score: number;
  preview_text: string;
  tags: string[];
  important: boolean;
  must_read: boolean;
  ai_classified: boolean;
  development_id: string;
  development_name: string;
  file_url: string | null;
  created_at: string;
}

interface SearchResultCardProps {
  result: SearchResult;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const discipline = DISCIPLINES[result.discipline as DisciplineType] || DISCIPLINES.other;
  const scorePercentage = Math.round(result.score * 100);
  const formattedDate = new Date(result.created_at).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all">
      <div className="flex items-start gap-4">
        <div 
          className="p-2.5 rounded-lg shrink-0"
          style={{ backgroundColor: `${discipline.color}15` }}
        >
          <FileText className="h-5 w-5" style={{ color: discipline.color }} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                href={`/developer/archive/document/${result.document_id}`}
                className="text-base font-semibold text-gray-900 hover:text-amber-600 transition-colors line-clamp-1"
              >
                {result.title || result.file_name}
              </Link>
              
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                <Building2 className="h-3.5 w-3.5" />
                <span>{result.development_name}</span>
                <span className="text-gray-300">|</span>
                <Calendar className="h-3.5 w-3.5" />
                <span>{formattedDate}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <div 
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ 
                  backgroundColor: `${discipline.color}15`,
                  color: discipline.color 
                }}
              >
                {discipline.label}
              </div>
              
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                scorePercentage >= 70 ? 'bg-green-100 text-green-700' :
                scorePercentage >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {scorePercentage}% match
              </div>
            </div>
          </div>
          
          {result.preview_text && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {result.preview_text}
            </p>
          )}
          
          <div className="flex items-center gap-3 mt-3">
            {result.house_type_code && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {result.house_type_code}
              </span>
            )}
            
            {result.important && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                <Star className="h-3 w-3" />
                Important
              </span>
            )}
            
            {result.must_read && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                <AlertCircle className="h-3 w-3" />
                Must Read
              </span>
            )}
            
            {result.ai_classified && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                <Sparkles className="h-3 w-3" />
                AI
              </span>
            )}
            
            {result.tags.slice(0, 3).map((tag, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-3 mt-3">
            <Link
              href={`/developer/archive/document/${result.document_id}`}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1"
            >
              View Details
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            
            {result.file_url && (
              <a
                href={result.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                Open File
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
