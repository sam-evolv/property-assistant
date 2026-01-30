'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  HelpCircle, 
  Settings, 
  BookOpen, 
  Send, 
  Loader2, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X,
  Save,
  AlertCircle,
  Upload
} from 'lucide-react';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import BulkKnowledgeImport from '@/components/super/BulkKnowledgeImport';

interface Development {
  id: string;
  name: string;
  code: string;
  system_instructions?: string;
}

interface CustomQA {
  id: string;
  question: string;
  answer: string;
  active: boolean;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
  isPlatformWide?: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

type Tab = 'test' | 'qa' | 'instructions' | 'knowledge' | 'bulk';

export default function AssistantTrainingPage() {
  const [activeTab, setActiveTab] = useState<Tab>('test');
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDevelopmentId, setSelectedDevelopmentId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [includeCustomQA, setIncludeCustomQA] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [customQAs, setCustomQAs] = useState<CustomQA[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [editingQAId, setEditingQAId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);

  const [systemInstructions, setSystemInstructions] = useState('');
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [instructionsSaved, setInstructionsSaved] = useState(false);

  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');
  const [newKnowledgeCategory, setNewKnowledgeCategory] = useState('general');
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  useEffect(() => {
    fetchDevelopments();
  }, []);

  useEffect(() => {
    if (selectedDevelopmentId) {
      fetchCustomQAs();
      fetchKnowledgeItems();
      fetchSystemInstructions();
    }
  }, [selectedDevelopmentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchDevelopments = async () => {
    try {
      const res = await fetch('/api/super/developments');
      if (res.ok) {
        const data = await res.json();
        setDevelopments(data.developments || []);
        if (data.developments?.length > 0) {
          setSelectedDevelopmentId(data.developments[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch developments:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomQAs = async () => {
    try {
      const res = await fetch(`/api/super/assistant/qa?development_id=${selectedDevelopmentId}`);
      if (res.ok) {
        const data = await res.json();
        setCustomQAs(data.qas || []);
      }
    } catch (err) {
      console.error('Failed to fetch Q&As:', err);
    }
  };

  const fetchKnowledgeItems = async () => {
    try {
      const res = await fetch(`/api/super/assistant/knowledge?development_id=${selectedDevelopmentId}&include_platform_wide=true`);
      if (res.ok) {
        const data = await res.json();
        // Combine development-specific and platform-wide items, marking platform items
        const devItems = (data.items || []).map((item: any) => ({ ...item, isPlatformWide: false }));
        const platformItems = (data.platformItems || []).map((item: any) => ({ ...item, isPlatformWide: true }));
        setKnowledgeItems([...devItems, ...platformItems]);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge items:', err);
    }
  };

  const fetchSystemInstructions = async () => {
    const dev = developments.find(d => d.id === selectedDevelopmentId);
    setSystemInstructions(dev?.system_instructions || '');
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedDevelopmentId) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setSending(true);

    try {
      const res = await fetch('/api/super/assistant/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: selectedDevelopmentId,
          message: userMessage,
          include_custom_qa: includeCustomQA,
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.error || 'No response' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Failed to get response. Please try again.' }]);
    } finally {
      setSending(false);
    }
  };

  const handleAddQA = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    setQaLoading(true);
    try {
      const res = await fetch('/api/super/assistant/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: selectedDevelopmentId,
          question: newQuestion.trim(),
          answer: newAnswer.trim(),
        }),
      });

      if (res.ok) {
        setNewQuestion('');
        setNewAnswer('');
        fetchCustomQAs();
      }
    } catch (err) {
      console.error('Failed to add Q&A:', err);
    } finally {
      setQaLoading(false);
    }
  };

  const handleUpdateQA = async (id: string) => {
    setQaLoading(true);
    try {
      await fetch('/api/super/assistant/qa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          question: editQuestion,
          answer: editAnswer,
        }),
      });
      setEditingQAId(null);
      fetchCustomQAs();
    } catch (err) {
      console.error('Failed to update Q&A:', err);
    } finally {
      setQaLoading(false);
    }
  };

  const handleDeleteQA = async (id: string) => {
    if (!confirm('Delete this Q&A pair?')) return;
    
    try {
      await fetch(`/api/super/assistant/qa?id=${id}`, { method: 'DELETE' });
      fetchCustomQAs();
    } catch (err) {
      console.error('Failed to delete Q&A:', err);
    }
  };

  const handleToggleQA = async (id: string, active: boolean) => {
    try {
      await fetch('/api/super/assistant/qa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active }),
      });
      fetchCustomQAs();
    } catch (err) {
      console.error('Failed to toggle Q&A:', err);
    }
  };

  const handleSaveInstructions = async () => {
    setSavingInstructions(true);
    try {
      await fetch('/api/super/assistant/instructions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: selectedDevelopmentId,
          system_instructions: systemInstructions,
        }),
      });
      setInstructionsSaved(true);
      setTimeout(() => setInstructionsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save instructions:', err);
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleAddKnowledge = async () => {
    if (!newKnowledgeTitle.trim() || !newKnowledgeContent.trim()) return;

    setKnowledgeLoading(true);
    try {
      const res = await fetch('/api/super/assistant/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          development_id: selectedDevelopmentId,
          title: newKnowledgeTitle.trim(),
          content: newKnowledgeContent.trim(),
          category: newKnowledgeCategory,
        }),
      });

      if (res.ok) {
        setNewKnowledgeTitle('');
        setNewKnowledgeContent('');
        setNewKnowledgeCategory('general');
        fetchKnowledgeItems();
      }
    } catch (err) {
      console.error('Failed to add knowledge:', err);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    if (!confirm('Delete this knowledge item?')) return;
    
    try {
      await fetch(`/api/super/assistant/knowledge?id=${id}`, { method: 'DELETE' });
      fetchKnowledgeItems();
    } catch (err) {
      console.error('Failed to delete knowledge:', err);
    }
  };

  const tabs = [
    { id: 'test', label: 'Test Assistant', icon: MessageSquare },
    { id: 'qa', label: 'Custom Q&A', icon: HelpCircle },
    { id: 'instructions', label: 'System Instructions', icon: Settings },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'bulk', label: 'Bulk Import', icon: Upload },
  ];

  const selectedDev = developments.find(d => d.id === selectedDevelopmentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <SectionHeader
        title="Assistant Training Portal"
        description="Test, train, and customize the AI assistant for each development"
      />

      <div className="mb-6">
        <label className="block text-sm font-bold text-black mb-2">Select Development</label>
        <select
          value={selectedDevelopmentId}
          onChange={(e) => {
            setSelectedDevelopmentId(e.target.value);
            setMessages([]);
          }}
          className="w-full max-w-md px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-bold focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        >
          {developments.map((dev) => (
            <option key={dev.id} value={dev.id}>
              {dev.name} ({dev.code})
            </option>
          ))}
        </select>
      </div>

      <div className="flex border-b-2 border-gray-200 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-colors border-b-2 -mb-0.5 ${
                activeTab === tab.id
                  ? 'text-amber-600 border-amber-500'
                  : 'text-black border-transparent hover:text-amber-600 hover:border-amber-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'test' && (
        <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-black">Test Chat - {selectedDev?.name}</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeCustomQA}
                  onChange={(e) => setIncludeCustomQA(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="font-bold text-black">Include Custom Q&A</span>
              </label>
            </div>
          </div>

          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 py-12">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-black">Start a conversation to test the assistant</p>
                <p className="text-sm text-black mt-1">Ask questions about the development to see how the AI responds</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-amber-500 text-white' 
                    : 'bg-white border-2 border-gray-200 text-black'
                }`}>
                  <p className="text-sm font-medium whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-gray-200 px-4 py-3 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Type a message to test the assistant..."
                className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !inputMessage.trim()}
                className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qa' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold text-black mb-4">Add New Q&A Pair</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black mb-1">Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="What question should trigger this answer?"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black mb-1">Answer</label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="The exact answer to provide..."
                  rows={3}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500 resize-none"
                />
              </div>
              <button
                onClick={handleAddQA}
                disabled={qaLoading || !newQuestion.trim() || !newAnswer.trim()}
                className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Q&A Pair
              </button>
            </div>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-black">Custom Q&A Pairs ({customQAs.length})</h3>
              <p className="text-sm text-black mt-1">These answers take priority over AI-generated responses</p>
            </div>
            
            {customQAs.length === 0 ? (
              <div className="p-8 text-center">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-black">No custom Q&A pairs yet</p>
                <p className="text-sm text-black mt-1">Add Q&A pairs to override AI responses for specific questions</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {customQAs.map((qa) => (
                  <div key={qa.id} className="p-4">
                    {editingQAId === qa.id ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editQuestion}
                          onChange={(e) => setEditQuestion(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-black font-medium"
                        />
                        <textarea
                          value={editAnswer}
                          onChange={(e) => setEditAnswer(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-black font-medium resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateQA(qa.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center gap-1"
                          >
                            <Check className="w-4 h-4" /> Save
                          </button>
                          <button
                            onClick={() => setEditingQAId(null)}
                            className="px-4 py-2 border-2 border-gray-300 text-black rounded-lg font-bold hover:bg-gray-100 flex items-center gap-1"
                          >
                            <X className="w-4 h-4" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-bold text-black">Q: {qa.question}</p>
                          <p className="text-black mt-1">A: {qa.answer}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleQA(qa.id, qa.active)}
                            className={`px-3 py-1 rounded-lg text-sm font-bold ${
                              qa.active 
                                ? 'bg-green-100 text-green-700 border border-green-300' 
                                : 'bg-gray-100 text-gray-500 border border-gray-300'
                            }`}
                          >
                            {qa.active ? 'Active' : 'Inactive'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingQAId(qa.id);
                              setEditQuestion(qa.question);
                              setEditAnswer(qa.answer);
                            }}
                            className="p-2 text-black hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteQA(qa.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'instructions' && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-black mb-4">System Instructions for {selectedDev?.name}</h3>
          <p className="text-sm text-black mb-4">
            These instructions are prepended to every AI prompt. Use them to customize the assistant's behavior, 
            tone, and knowledge specific to this development.
          </p>
          
          <textarea
            value={systemInstructions}
            onChange={(e) => setSystemInstructions(e.target.value)}
            placeholder="Enter custom system instructions for this development's assistant...

Example:
- Always greet users warmly and mention the development name
- The management company is ABC Management, contact: manager@abc.com
- Construction warranty expires 24 months from handover
- Common area maintenance is handled by XYZ Services"
            rows={12}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500 resize-none"
          />
          
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleSaveInstructions}
              disabled={savingInstructions}
              className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
            >
              {savingInstructions ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Instructions
            </button>
            {instructionsSaved && (
              <span className="text-green-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Saved!
              </span>
            )}
          </div>
        </div>
      )}

      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold text-black mb-4">Add Knowledge Item</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-black mb-1">Title</label>
                <input
                  type="text"
                  value={newKnowledgeTitle}
                  onChange={(e) => setNewKnowledgeTitle(e.target.value)}
                  placeholder="e.g., Warranty Information"
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-black mb-1">Category</label>
                <select
                  value={newKnowledgeCategory}
                  onChange={(e) => setNewKnowledgeCategory(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-bold focus:ring-2 focus:ring-amber-500"
                >
                  <option value="general">General</option>
                  <option value="warranty">Warranty</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="contacts">Contacts</option>
                  <option value="amenities">Amenities</option>
                  <option value="policies">Policies</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-bold text-black mb-1">Content</label>
              <textarea
                value={newKnowledgeContent}
                onChange={(e) => setNewKnowledgeContent(e.target.value)}
                placeholder="Enter the information the AI should know..."
                rows={4}
                className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg text-black font-medium focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <button
              onClick={handleAddKnowledge}
              disabled={knowledgeLoading || !newKnowledgeTitle.trim() || !newKnowledgeContent.trim()}
              className="mt-4 px-6 py-2.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Knowledge
            </button>
          </div>

          <div className="bg-white border-2 border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-black">Knowledge Base ({knowledgeItems.length})</h3>
              <p className="text-sm text-black mt-1">Facts and information the AI can reference</p>
            </div>
            
            {knowledgeItems.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-bold text-black">No knowledge items yet</p>
                <p className="text-sm text-black mt-1">Add facts and info for the AI to reference</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {knowledgeItems.map((item) => (
                  <div key={item.id} className={`p-4 ${item.isPlatformWide ? 'bg-blue-50' : ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-black">{item.title}</span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium border border-gray-200">
                            {item.category}
                          </span>
                          {item.isPlatformWide && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold border border-blue-200">
                              Platform-wide
                            </span>
                          )}
                        </div>
                        <p className="text-black text-sm">{item.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteKnowledge(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bulk' && selectedDev && (
        <div className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-sm">
          <h3 className="text-lg font-bold text-black mb-4">Bulk Knowledge Import</h3>
          <BulkKnowledgeImport
            developmentId={selectedDevelopmentId}
            developmentName={selectedDev.name}
            onImportComplete={() => {
              fetchKnowledgeItems();
              setActiveTab('knowledge');
            }}
          />
        </div>
      )}
    </div>
  );
}
