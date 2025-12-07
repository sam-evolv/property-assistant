'use client';

import { useState, useEffect } from 'react';
import { FileText, Download, Folder, File, FileImage, FileSpreadsheet, Search, Home, Wrench, Shield, Truck, AlertTriangle, MapPin, FileCheck, Flame } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  file_url?: string;
  file_type?: string;
  created_at: string;
  metadata?: any;
  is_house_specific?: boolean;
  is_important?: boolean;
  important_rank?: number | null;
  source?: 'drizzle' | 'supabase';
}

interface PurchaserDocumentsTabProps {
  unitUid: string;
  houseType: string;
  isDarkMode: boolean;
  selectedLanguage: string;
}

interface CategoryInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  keywords: string[];
}

const CATEGORIES: CategoryInfo[] = [
  { id: 'all', label: 'All', icon: <Folder className="w-5 h-5" />, keywords: [] },
  { id: 'important', label: 'Important', icon: <AlertTriangle className="w-5 h-5" />, keywords: [] },
  { id: 'floorplans', label: 'Floorplans', icon: <FileImage className="w-5 h-5" />, keywords: [] },
  { id: 'fire', label: 'Fire Safety', icon: <Flame className="w-5 h-5" />, keywords: [] },
  { id: 'parking', label: 'Parking', icon: <MapPin className="w-5 h-5" />, keywords: [] },
  { id: 'handover', label: 'Handover', icon: <FileCheck className="w-5 h-5" />, keywords: [] },
  { id: 'snagging', label: 'Snagging', icon: <Wrench className="w-5 h-5" />, keywords: [] },
  { id: 'warranties', label: 'Warranties', icon: <Shield className="w-5 h-5" />, keywords: [] },
  { id: 'specifications', label: 'Specifications', icon: <FileText className="w-5 h-5" />, keywords: [] },
  { id: 'general', label: 'General', icon: <File className="w-5 h-5" />, keywords: [] },
];

export default function PurchaserDocumentsTab({
  unitUid,
  houseType,
  isDarkMode,
  selectedLanguage,
}: PurchaserDocumentsTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchDocuments();
  }, [unitUid, houseType]);

  const fetchDocuments = async () => {
    try {
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) {
        console.error('No token found for documents');
        setLoading(false);
        return;
      }

      const res = await fetch(
        `/api/purchaser/documents?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
      );
      if (res.ok) {
        const data = await res.json();
        const allDocs = data.documents || [];
        
        // Backend already filters documents correctly - just display them
        setDocuments(allDocs);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      // For Supabase documents with direct file_url, open in new tab
      if (doc.source === 'supabase' && doc.file_url) {
        window.open(doc.file_url, '_blank');
        return;
      }
      
      // For Drizzle documents, use the download API
      const token = sessionStorage.getItem(`house_token_${unitUid}`);
      if (!token) {
        alert('Session expired. Please refresh and try again.');
        return;
      }

      const downloadUrl = `/api/purchaser/documents/download?unitUid=${unitUid}&token=${encodeURIComponent(token)}&docId=${doc.id}`;
      
      // First check if the download will succeed
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        // Try to get error details
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        const errorMessage = errorData.details || errorData.error || 'Failed to download document';
        alert(errorMessage);
        return;
      }
      
      // If successful, download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.title;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Failed to download document. Please try again or contact your development administrator.');
    }
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <File className="w-5 h-5 text-gray-500" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5 text-gold-600" />;
    if (fileType.includes('doc') || fileType.includes('word')) 
      return <FileText className="w-5 h-5 text-gold-500" />;
    if (fileType.includes('image') || fileType.includes('jpg') || fileType.includes('png')) 
      return <FileImage className="w-5 h-5 text-gray-600" />;
    if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) 
      return <FileSpreadsheet className="w-5 h-5 text-gray-700" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const filterDocuments = () => {
    let filtered = documents;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(query)
      );
    }

    // Category filter
    if (selectedCategory === 'important') {
      // Filter for important documents
      filtered = filtered.filter(doc => doc.is_important);
    } else if (selectedCategory !== 'all') {
      // Use metadata.category field for other categories
      filtered = filtered.filter(doc => {
        const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
        const categoryLabel = CATEGORIES.find(c => c.id === selectedCategory)?.label.toLowerCase() || '';
        return docCategory === categoryLabel;
      });
    }

    return filtered;
  };

  const filteredDocs = filterDocuments();

  const bgColor = isDarkMode ? 'bg-gray-900' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-gray-900';
  const subtextColor = isDarkMode ? 'text-gray-400' : 'text-gray-600';
  const cardBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const inputBg = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300';

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${bgColor}`}>
        <div className={`animate-pulse ${subtextColor}`}>Loading documents...</div>
      </div>
    );
  }

  // Get document counts per category
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return documents.length;
    if (categoryId === 'important') return documents.filter(doc => doc.is_important).length;
    
    const categoryLabel = CATEGORIES.find(c => c.id === categoryId)?.label.toLowerCase() || '';
    return documents.filter(doc => {
      const docCategory = doc.metadata?.category?.toLowerCase() || 'general';
      return docCategory === categoryLabel;
    }).length;
  };

  const importantDocs = documents.filter(doc => doc.is_important).sort((a, b) => (a.important_rank || 999) - (b.important_rank || 999));

  return (
    <div className={`flex flex-col h-full ${bgColor}`}>
      {/* Search Bar */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3`}>
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 ${inputBg} border rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500 ${isDarkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 overflow-x-auto`}>
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map(cat => {
            const count = getCategoryCount(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  cat.id === 'important'
                    ? selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                      : isDarkMode
                        ? 'bg-gold-900/20 text-gold-400 hover:bg-gold-900/30 border border-gold-500/30'
                        : 'bg-gold-50 text-gold-700 hover:bg-gold-100 border border-gold-200'
                    : selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-gold-500 to-gold-600 text-white shadow-md'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${selectedCategory === cat.id ? 'bg-white/20' : (isDarkMode ? 'bg-gray-600' : 'bg-gray-200')}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Documents Grid */}
      {filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
          <div className="p-4 bg-gradient-to-br from-gold-100 to-gold-200 rounded-full mb-4">
            <Folder className="w-8 h-8 text-gold-700" />
          </div>
          <h3 className={`text-lg font-semibold ${textColor} mb-2`}>
            {searchQuery || selectedCategory !== 'all' ? 'No Matching Documents' : 'No Documents Yet'}
          </h3>
          <p className={`${subtextColor} max-w-md text-sm`}>
            {searchQuery || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.' 
              : 'Property documents, manuals, and important files will appear here.'}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className={`${doc.is_important ? (isDarkMode ? 'bg-gold-900/10 border-gold-500/30' : 'bg-gold-50 border-gold-200') : cardBg} border rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group relative`}
                onClick={() => handleDownload(doc)}
              >
                {doc.is_important && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-gold-500 text-white shadow-sm">
                      IMPORTANT
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3 mb-3">
                  <div className={`p-2 ${doc.is_important ? 'bg-gradient-to-br from-gold-200 to-gold-300' : 'bg-gradient-to-br from-gold-100 to-gold-200'} rounded-lg flex-shrink-0`}>
                    {getFileIcon(doc.file_type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-20">
                    <h3 className={`text-sm font-semibold ${textColor} line-clamp-2 ${doc.is_important ? 'group-hover:text-gold-600' : 'group-hover:text-gold-600'} transition-colors`}>
                      {doc.title}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(doc);
                    }}
                    className="p-2 rounded-lg bg-gradient-to-r from-gold-500 to-gold-600 text-white hover:from-gold-600 hover:to-gold-700 transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
