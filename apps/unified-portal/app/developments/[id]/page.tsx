'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDevelopment } from '@/contexts/DevelopmentContext';
import { SkeletonDashboard, SkeletonStat } from '@/components/ui/SkeletonLoader';
import { EmptyHouses, EmptyDocuments } from '@/components/ui/EmptyState';
import { toast } from 'react-hot-toast';
import Link from 'next/link';

interface Development {
  id: string;
  tenant_id: string;
  name: string;
  address: string;
  description: string | null;
  system_instructions: string | null;
  created_at: string;
}

interface Analytics {
  houses: number;
  chatMessages: number;
  documents: number;
  recentChatMessages: number;
  houseTypes: Array<{ type: string; count: number }>;
  messageVolume: Array<{ date: string; count: number }>;
  chatCosts: Array<{ date: string; cost: number }>;
}

interface House {
  id: string;
  development_id: string;
  unit_number: string;
  unit_uid: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state_province: string | null;
  postal_code: string | null;
  country: string | null;
  house_type_code: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_footage: number | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  purchase_date: string | null;
  move_in_date: string | null;
  created_at: string;
  updated_at: string | null;
}

interface TrainingJob {
  id: string;
  file_name: string;
  status: string;
  progress: number;
  created_at: string;
}

interface Document {
  id: string;
  title: string;
  original_file_name: string;
  file_url: string;
  version: number;
  is_important: boolean;
  important_rank: number | null;
  size_kb: number;
  created_at: string;
  development?: {
    name: string;
    important_docs_version: number;
  };
}

export default function DevelopmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const developmentId = params.id as string;
  const { setDevelopmentId } = useDevelopment();
  
  const [development, setDevelopment] = useState<Development | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [houses, setHouses] = useState<House[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'houses' | 'docs' | 'instructions' | 'chat'>('overview');
  const [loading, setLoading] = useState(true);
  
  const [trainingJobs, setTrainingJobs] = useState<TrainingJob[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [updatingImportance, setUpdatingImportance] = useState<string | null>(null);
  const [publishingVersion, setPublishingVersion] = useState(false);
  const [systemInstructions, setSystemInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const [chatMessage, setChatMessage] = useState('');
  const [chatResponse, setChatResponse] = useState<any>(null);
  const [chatting, setChatting] = useState(false);

  useEffect(() => {
    setDevelopmentId(developmentId);
    fetchAll();
  }, [developmentId, setDevelopmentId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const devData = await fetchDevelopment();
      await Promise.all([
        fetchAnalytics(),
        fetchHouses(),
        fetchTrainingJobs(devData?.tenant_id),
        fetchDocuments(),
      ]);
    } catch (error) {
      console.error('Error fetching development data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevelopment = async () => {
    try {
      const response = await fetch(`/api/developments/${developmentId}`);
      if (!response.ok) {
        console.error(`Failed to fetch development: ${response.status} ${response.statusText}`);
        throw new Error('Failed to fetch development');
      }
      const data = await response.json();
      if (!data.development) {
        throw new Error('Development not found in response');
      }
      setDevelopment(data.development);
      setSystemInstructions(data.development.system_instructions || '');
      return data.development;
    } catch (error) {
      console.error('Failed to fetch development:', error);
      toast.error('Failed to load development details');
      return null;
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/developments/${developmentId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  const fetchHouses = async () => {
    try {
      const response = await fetch(`/api/developments/${developmentId}/houses`);
      if (response.ok) {
        const data = await response.json();
        setHouses(data.houses || []);
      }
    } catch (error) {
      console.error('Failed to fetch houses:', error);
    }
  };

  const fetchTrainingJobs = async (tenantId?: string) => {
    try {
      const tid = tenantId || development?.tenant_id;
      if (!tid) {
        console.log('⏭️  Skipping training jobs fetch: no tenant_id available');
        return;
      }
      const response = await fetch(`/api/train/jobs?tenantId=${tid}&developmentId=${developmentId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch training jobs: ${response.status}`);
      }
      const data = await response.json();
      setTrainingJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch training jobs:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/documents?developmentId=${developmentId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const toggleImportance = async (docId: string, currentlyImportant: boolean, currentRank: number | null) => {
    const importantDocs = documents.filter(d => d.is_important);
    
    if (!currentlyImportant && importantDocs.length >= 10) {
      toast.error('Maximum 10 important documents allowed per development');
      return;
    }

    setUpdatingImportance(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/important`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_important: !currentlyImportant,
          important_rank: !currentlyImportant ? (currentRank || importantDocs.length + 1) : null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');
      
      toast.success(!currentlyImportant ? 'Marked as important' : 'Removed from important');
      fetchDocuments();
    } catch (error) {
      console.error('Failed to toggle importance:', error);
      toast.error('Failed to update document');
    } finally {
      setUpdatingImportance(null);
    }
  };

  const updateImportantRank = async (docId: string, rank: number) => {
    if (rank < 1 || rank > 10) return;
    
    setUpdatingImportance(docId);
    try {
      const res = await fetch(`/api/documents/${docId}/important`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_important: true,
          important_rank: rank,
        }),
      });

      if (!res.ok) throw new Error('Failed to update rank');
      fetchDocuments();
    } catch (error) {
      console.error('Failed to update rank:', error);
      toast.error('Failed to update rank');
    } finally {
      setUpdatingImportance(null);
    }
  };

  const publishImportantDocs = async () => {
    const importantDocs = documents.filter(doc => doc.is_important);
    if (importantDocs.length === 0) {
      toast.error('No important documents to publish');
      return;
    }

    setPublishingVersion(true);
    try {
      const res = await fetch(`/api/developments/${developmentId}/publish-important-docs`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to publish');
      const data = await res.json();
      
      toast.success(`Important docs version ${data.new_version} published! All units will require re-consent.`);
      fetchDocuments();
    } catch (error) {
      console.error('Failed to publish:', error);
      toast.error('Failed to publish important docs');
    } finally {
      setPublishingVersion(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      console.log('❌ No files selected');
      return;
    }

    console.log('🚀 Starting file upload...', {
      fileCount: files.length,
      files: Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })),
      developmentId,
      development: development ? { id: development.id, tenant_id: development.tenant_id } : null
    });

    if (!development) {
      console.error('❌ Development not loaded');
      toast.error('Development not loaded. Please refresh the page.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
        console.log(`  Adding file ${i + 1}: ${files[i].name}`);
      }
      formData.append('developmentId', developmentId);
      formData.append('tenantId', development.tenant_id);
      console.log('  ✅ FormData prepared');

      console.log('📤 Sending POST to /api/train...');
      const response = await fetch('/api/train', {
        method: 'POST',
        body: formData,
      });
      console.log('📥 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Upload error response:', errorData);
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }
      
      const result = await response.json();
      console.log('✅ Upload successful:', result);
      toast.success(`Successfully uploaded ${result.successfulFiles || 0} file(s)`);
      
      await fetchAnalytics();
      await fetchTrainingJobs();
      await fetchDocuments();
      
      e.target.value = '';
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) {
      return;
    }

    console.log('🚀 Starting drag & drop file upload...', {
      fileCount: files.length,
      files: Array.from(files).map(f => ({ name: f.name, size: f.size, type: f.type })),
    });

    if (!development) {
      console.error('❌ Development not loaded');
      toast.error('Development not loaded. Please refresh the page.');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
        console.log(`  Adding file ${i + 1}: ${files[i].name}`);
      }
      formData.append('developmentId', developmentId);
      formData.append('tenantId', development.tenant_id);

      const response = await fetch('/api/train', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }
      
      const result = await response.json();
      toast.success(`Successfully uploaded ${result.successfulFiles || 0} file(s)`);
      
      await fetchAnalytics();
      await fetchTrainingJobs();
      await fetchDocuments();
    } catch (error) {
      console.error('❌ Upload failed:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    try {
      const response = await fetch(`/api/developments/${developmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstructions }),
      });

      if (!response.ok) throw new Error('Failed to save instructions');
      toast.success('System instructions saved successfully');
      fetchDevelopment();
    } catch (error) {
      console.error('Failed to save instructions:', error);
      toast.error('Failed to save instructions');
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    setChatting(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developmentId, message: chatMessage }),
      });

      if (!response.ok) throw new Error('Chat failed');
      const data = await response.json();
      setChatResponse(data);
      setChatMessage('');
    } catch (error) {
      console.error('Chat failed:', error);
      toast.error('Failed to send message');
    } finally {
      setChatting(false);
    }
  };

  const handleDownloadQR = async () => {
    const loadingToast = toast.loading('Generating QR codes PDF...');
    
    try {
      const response = await fetch(`/api/developments/${developmentId}/qr-codes`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to generate QR codes: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${development?.code || 'development'}-qr-codes.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('QR codes PDF downloaded successfully!', { id: loadingToast });
    } catch (error) {
      console.error('Failed to download QR codes:', error);
      toast.error('Failed to generate QR codes. Please try again.', { id: loadingToast });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  if (!development) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black mb-2">Development Not Found</h2>
          <Link href="/developments" className="text-gold-500 hover:text-gold-600 transition-colors">
            ← Back to Developments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => router.push('/developer')} className="text-gold-500 hover:text-gold-600 transition-colors mb-6 flex items-center gap-2 font-medium">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        <div className="bg-white rounded-premium shadow-premium p-6 mb-6 border border-grey-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-black mb-2">{development.name}</h1>
              <p className="text-grey-600 mb-2">{development.address}</p>
              {development.description && <p className="text-grey-500">{development.description}</p>}
              <p className="text-sm text-grey-400 mt-2">Created {new Date(development.created_at).toLocaleDateString()}</p>
            </div>
            <button
              onClick={handleDownloadQR}
              className="px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow transition-all duration-premium font-medium flex items-center gap-2"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download QR Codes
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-premium shadow-card hover:shadow-card-hover transition-shadow border border-grey-200">
            <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Houses</p>
            <p className="text-3xl font-bold text-gold-500 mt-2">{analytics?.houses || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-premium shadow-card hover:shadow-card-hover transition-shadow border border-grey-200">
            <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Documents</p>
            <p className="text-3xl font-bold text-gold-600 mt-2">{analytics?.documents || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-premium shadow-card hover:shadow-card-hover transition-shadow border border-grey-200">
            <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Chat (30d)</p>
            <p className="text-3xl font-bold text-gold-700 mt-2">{analytics?.recentChatMessages || 0}</p>
          </div>
          <div className="bg-white p-5 rounded-premium shadow-card hover:shadow-card-hover transition-shadow border border-grey-200">
            <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">House Types</p>
            <p className="text-3xl font-bold text-gold-500 mt-2">{analytics?.houseTypes.length || 0}</p>
          </div>
        </div>

        <div className="bg-white rounded-premium shadow-premium border border-grey-200">
          <div className="border-b border-grey-200 bg-grey-50">
            <nav className="flex -mb-px">
              {(['overview', 'houses', 'docs', 'instructions', 'chat'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-all duration-premium ${
                    activeTab === tab
                      ? 'border-gold-500 text-gold-600 bg-white'
                      : 'border-transparent text-grey-600 hover:text-black hover:border-gold-300'
                  }`}
                >
                  {tab === 'overview' && 'Overview'}
                  {tab === 'houses' && `Houses (${houses.length})`}
                  {tab === 'docs' && 'Documents'}
                  {tab === 'instructions' && 'AI Instructions'}
                  {tab === 'chat' && 'Preview Chat'}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Development Information</h2>
                  <div className="bg-gradient-to-r from-gold-50 to-grey-50 p-6 rounded-premium border border-gold-200 shadow-card">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Name</p>
                        <p className="text-lg font-semibold text-black mt-1">{development.name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Address</p>
                        <p className="text-lg text-black mt-1">{development.address}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Total Units</p>
                        <p className="text-lg font-semibold text-gold-600 mt-1">{analytics?.houses || 0} houses</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Created</p>
                        <p className="text-lg text-black mt-1">{new Date(development.created_at).toLocaleDateString()}</p>
                      </div>
                      {development.description && (
                        <div className="md:col-span-2">
                          <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Description</p>
                          <p className="text-lg text-black mt-1">{development.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Analytics Overview</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 p-6 rounded-premium border border-gold-200 shadow-card">
                      <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Houses</p>
                      <p className="text-3xl font-bold text-gold-600 mt-2">{analytics?.houses || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 p-6 rounded-premium border border-gold-200 shadow-card">
                      <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Documents</p>
                      <p className="text-3xl font-bold text-gold-600 mt-2">{analytics?.documents || 0}</p>
                    </div>
                    <div className="bg-gradient-to-br from-gold-50 to-gold-100/50 p-6 rounded-premium border border-gold-200 shadow-card">
                      <p className="text-sm font-medium text-grey-600 uppercase tracking-wide">Chat Messages (30d)</p>
                      <p className="text-3xl font-bold text-gold-600 mt-2">{analytics?.recentChatMessages || 0}</p>
                      <p className="text-sm text-grey-600 mt-1">Total: {analytics?.chatMessages || 0}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Advanced Analytics</h2>
                  <Link 
                    href={`/developments/${developmentId}/analytics`}
                    className="block bg-gradient-to-br from-black to-gray-900 rounded-premium border border-gold-500/30 p-8 shadow-card hover:shadow-xl transition-all duration-300 motion-safe:animate-fade-in group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                          <svg className="h-8 w-8 text-gold-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          View Full Analytics Dashboard
                        </h3>
                        <p className="text-gray-300 mb-4">
                          Access comprehensive analytics including message trends, house distribution, chat costs, RAG performance, and more.
                        </p>
                        <div className="flex gap-4 text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                            Message Trends
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            House Analytics
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Cost Analysis
                          </span>
                        </div>
                      </div>
                      <svg className="h-8 w-8 text-gold-400 group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </Link>
                </div>

                <div>
                  <h2 className="text-xl font-bold text-black mb-4">Quick Actions</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                      href={`/developments/${developmentId}/houses/import`}
                      className="bg-gradient-to-r from-gold-500 to-gold-600 hover:shadow-gold-glow text-white p-4 rounded-premium transition-all duration-premium flex items-center justify-between"
                    >
                      <span className="font-medium">Add New House</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => setActiveTab('docs')}
                      className="bg-black hover:bg-grey-900 text-white p-4 rounded-premium transition-all duration-premium flex items-center justify-between"
                    >
                      <span className="font-medium">Upload Documents</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </button>
                    <button
                      onClick={handleDownloadQR}
                      className="bg-gradient-to-r from-gold-600 to-gold-700 hover:shadow-gold-glow text-white p-4 rounded-premium transition-all duration-premium flex items-center justify-between"
                    >
                      <span className="font-medium">Export QR Codes</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'houses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-black">Houses in this Development</h2>
                  <Link
                    href={`/developments/${developmentId}/houses/import`}
                    className="px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow transition-all duration-premium flex items-center gap-2 font-medium"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Import Houses
                  </Link>
                </div>

                {analytics?.houseTypes && analytics.houseTypes.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-black mb-3">House Type Summary</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {analytics.houseTypes.map((type) => (
                        <div key={type.type} className="bg-gradient-to-br from-gold-50 to-grey-50 p-4 rounded-premium border border-gold-200 hover:shadow-card transition-shadow">
                          <p className="text-sm font-medium text-grey-600">{type.type}</p>
                          <p className="text-2xl font-bold text-gold-600 mt-1">{type.count} units</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {houses.length === 0 ? (
                  <EmptyHouses />
                ) : (
                  <div className="space-y-3">
                    {houses.map((house) => (
                      <div key={house.id} className="border border-grey-200 rounded-premium p-4 hover:shadow-card transition-shadow bg-white">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-black">
                              Unit {house.unit_number} {house.purchaser_name && `- ${house.purchaser_name}`}
                            </h3>
                            <p className="text-sm text-grey-600 mt-1">{house.address_line_1 || 'No address provided'}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-grey-500">
                              <span className="bg-gold-100 text-gold-800 px-2 py-1 rounded font-medium">
                                Type: {house.house_type_code || 'No type'}
                              </span>
                              {house.bedrooms && <span>🛏️ {house.bedrooms} beds</span>}
                              {house.purchaser_email && <span>{house.purchaser_email}</span>}
                              <span className="font-mono text-grey-400">UID: {house.unit_uid}</span>
                            </div>
                          </div>
                          <Link
                            href={`/developments/${developmentId}/houses/${house.id}`}
                            className="text-gold-600 hover:text-gold-700 text-sm font-medium transition-colors"
                          >
                            Edit →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docs' && (
              <div>
                <h2 className="text-xl font-semibold text-black mb-4">Upload Training Documents</h2>
                <div
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-premium p-8 text-center transition-all duration-premium ${
                    isDragging
                      ? 'border-gold-600 bg-gold-100 scale-102'
                      : 'border-gold-300 hover:border-gold-500 hover:bg-gold-50/30 bg-grey-50'
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.csv,.json,.txt"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="file-upload"
                  />
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.csv,.json,.txt"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id="folder-upload"
                    {...({ webkitdirectory: '', directory: '' } as any)}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <svg className="mx-auto h-12 w-12 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mt-2 text-sm text-grey-700 font-medium">
                      {uploading ? 'Uploading...' : isDragging ? 'Drop files or folders here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-grey-500 mt-1">PDF, DOCX, CSV, JSON, TXT up to 50MB</p>
                  </label>
                  <div className="mt-4 flex gap-3 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="px-4 py-2 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow transition-all duration-premium font-medium cursor-pointer inline-block"
                    >
                      <svg className="inline-block h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Select Files
                    </label>
                    <label
                      htmlFor="folder-upload"
                      className="px-4 py-2 bg-black hover:bg-grey-900 text-white rounded-premium transition-all duration-premium font-medium cursor-pointer inline-block"
                    >
                      <svg className="inline-block h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      Select Folder
                    </label>
                  </div>
                </div>

                {trainingJobs.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-black mb-3">Training Jobs</h3>
                    <div className="space-y-2">
                      {trainingJobs.map((job) => (
                        <div key={job.id} className="border border-grey-200 rounded-premium p-3 bg-white shadow-card">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{job.file_name}</span>
                            <span className={`text-sm ${
                              job.status === 'completed' ? 'text-green-600' :
                              job.status === 'failed' ? 'text-red-600' :
                              'text-gold-500'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                job.status === 'completed' ? 'bg-green-600' :
                                job.status === 'failed' ? 'bg-red-600' :
                                'bg-gold-500'
                              }`}
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {documents.length > 0 && (
                  <div className="mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-black">Documents ({documents.length})</h3>
                      {documents.filter(d => d.is_important).length > 0 && (
                        <button
                          onClick={publishImportantDocs}
                          disabled={publishingVersion}
                          className="bg-gold-500 hover:bg-gold-600 text-white px-4 py-2 rounded-premium font-medium transition disabled:opacity-50 text-sm"
                        >
                          {publishingVersion ? 'Publishing...' : `Publish ${documents.filter(d => d.is_important).length} Important`}
                        </button>
                      )}
                    </div>
                    
                    <div className="bg-white rounded-premium border border-grey-200 shadow-card overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-grey-600 uppercase tracking-wider">Important</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-grey-600 uppercase tracking-wider">Document</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-grey-600 uppercase tracking-wider">Size</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-grey-600 uppercase tracking-wider">Uploaded</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-grey-600 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {documents.map((doc) => (
                              <tr key={doc.id} className={`hover:bg-gray-50 transition ${doc.is_important ? 'bg-gold-50' : ''}`}>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={doc.is_important}
                                      onChange={() => toggleImportance(doc.id, doc.is_important, doc.important_rank)}
                                      disabled={updatingImportance === doc.id}
                                      className="h-5 w-5 rounded border-gray-300 text-gold-500 focus:ring-gold-500 disabled:opacity-50"
                                    />
                                    {doc.is_important && (
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={doc.important_rank || 1}
                                        onChange={(e) => updateImportantRank(doc.id, parseInt(e.target.value))}
                                        disabled={updatingImportance === doc.id}
                                        className="w-14 px-2 py-1 text-sm border border-gold-300 rounded focus:ring-2 focus:ring-gold-500 focus:border-gold-500 disabled:opacity-50"
                                        title="Priority rank (1 = highest)"
                                      />
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium text-gray-900">{doc.title}</p>
                                    {doc.is_important && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gold-500 text-white">
                                        IMPORTANT
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-grey-600">{doc.original_file_name}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-grey-600">
                                  {doc.size_kb < 1024 ? `${doc.size_kb} KB` : `${(doc.size_kb / 1024).toFixed(2)} MB`}
                                </td>
                                <td className="px-4 py-3 text-sm text-grey-600">
                                  {new Date(doc.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 text-right text-sm">
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-gold-500 hover:text-gold-600 font-medium"
                                  >
                                    View
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {documents.filter(d => d.is_important).length > 0 && (
                      <div className="mt-4 bg-gold-50 border border-gold-200 rounded-premium p-4">
                        <div className="flex items-start gap-3">
                          <svg className="h-5 w-5 text-gold-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gold-900 mb-1">
                              {documents.filter(d => d.is_important).length} Important Document(s) Marked
                            </h4>
                            <p className="text-sm text-gold-700">
                              Click "Publish" to increment the version and require all purchasers to re-consent. Max 10 important documents per development.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'instructions' && (
              <div>
                <h2 className="text-xl font-semibold text-black mb-4">System Instructions for AI Assistant</h2>
                <textarea
                  value={systemInstructions}
                  onChange={(e) => setSystemInstructions(e.target.value)}
                  className="w-full px-4 py-3 border border-grey-300 rounded-premium focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 bg-white text-black"
                  rows={12}
                  placeholder="Enter instructions that will guide the AI assistant's responses for this development..."
                />
                <button
                  onClick={handleSaveInstructions}
                  disabled={savingInstructions}
                  className="mt-4 px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow disabled:opacity-50 transition-all duration-premium font-medium"
                >
                  {savingInstructions ? 'Saving...' : 'Save Instructions'}
                </button>
              </div>
            )}

            {activeTab === 'chat' && (
              <div>
                <h2 className="text-xl font-semibold text-black mb-4">Preview AI Assistant Chat</h2>
                <form onSubmit={handleChatSubmit} className="mb-4">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask a question to test the AI assistant..."
                    className="w-full px-4 py-3 border border-grey-300 rounded-premium focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-gold-500 bg-white text-black"
                  />
                  <button
                    type="submit"
                    disabled={chatting || !chatMessage.trim()}
                    className="mt-3 px-6 py-2.5 bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-premium hover:shadow-gold-glow disabled:opacity-50 transition-all duration-premium font-medium"
                  >
                    {chatting ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
                {chatResponse && (
                  <div className="bg-grey-50 rounded-premium p-6 border border-grey-200 shadow-card">
                    <p className="text-sm text-grey-600 mb-2 font-medium">AI Response:</p>
                    <p className="text-black leading-relaxed">{chatResponse.answer}</p>
                    <div className="mt-4 pt-4 border-t border-grey-200">
                      <p className="text-xs text-grey-400">Chunks used: {chatResponse.chunksUsed}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
