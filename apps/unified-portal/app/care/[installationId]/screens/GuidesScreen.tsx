'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  BookOpen, Sun, Wrench, Shield, Zap, AlertTriangle,
  ChevronRight, Search, ExternalLink, FileText, Video,
} from 'lucide-react';

// ============================================================================
// Design Tokens (matching Property dashboard)
// ============================================================================

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
};

// ============================================================================
// Types
// ============================================================================

interface Guide {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: string;
  icon: typeof Sun;
  iconColor: string;
  iconBg: string;
}

interface GuideCategory {
  id: string;
  label: string;
  icon: typeof Sun;
  count: number;
}

// ============================================================================
// Mock Data
// ============================================================================

const categories: GuideCategory[] = [
  { id: 'all', label: 'All Guides', icon: BookOpen, count: 12 },
  { id: 'getting-started', label: 'Getting Started', icon: Zap, count: 3 },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench, count: 4 },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle, count: 3 },
  { id: 'warranty', label: 'Warranty', icon: Shield, count: 2 },
];

const guides: Guide[] = [
  {
    id: '1',
    title: 'Understanding Your Solar System',
    description: 'Learn how your solar PV system works, from panels to inverter to grid connection.',
    category: 'getting-started',
    readTime: '5 min read',
    icon: Sun,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
  },
  {
    id: '2',
    title: 'Reading Your Inverter Display',
    description: 'How to check your inverter status, current generation, and error codes.',
    category: 'getting-started',
    readTime: '3 min read',
    icon: Zap,
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
  },
  {
    id: '3',
    title: 'Monitoring Your Energy Production',
    description: 'Set up and use your monitoring app to track daily, weekly, and monthly generation.',
    category: 'getting-started',
    readTime: '4 min read',
    icon: Zap,
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
  },
  {
    id: '4',
    title: 'Panel Cleaning Guide',
    description: 'When and how to clean your solar panels for optimal performance.',
    category: 'maintenance',
    readTime: '3 min read',
    icon: Wrench,
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
  },
  {
    id: '5',
    title: 'Seasonal Performance Expectations',
    description: 'What to expect from your system in summer vs winter, and typical generation patterns.',
    category: 'maintenance',
    readTime: '4 min read',
    icon: Sun,
    iconColor: 'text-orange-500',
    iconBg: 'bg-orange-50',
  },
  {
    id: '6',
    title: 'Annual System Health Check',
    description: 'Your yearly maintenance checklist to keep your system running efficiently.',
    category: 'maintenance',
    readTime: '5 min read',
    icon: Wrench,
    iconColor: 'text-teal-500',
    iconBg: 'bg-teal-50',
  },
  {
    id: '7',
    title: 'Shading and Obstructions',
    description: 'How trees, chimneys, and new buildings can affect your system output.',
    category: 'maintenance',
    readTime: '3 min read',
    icon: Sun,
    iconColor: 'text-gray-500',
    iconBg: 'bg-gray-50',
  },
  {
    id: '8',
    title: 'Inverter Error Codes',
    description: 'Common inverter error codes, what they mean, and when to call your installer.',
    category: 'troubleshooting',
    readTime: '6 min read',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
    iconBg: 'bg-red-50',
  },
  {
    id: '9',
    title: 'Low Generation Troubleshooting',
    description: 'Steps to diagnose why your system may be generating less than expected.',
    category: 'troubleshooting',
    readTime: '5 min read',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    iconBg: 'bg-amber-50',
  },
  {
    id: '10',
    title: 'What To Do In a Power Cut',
    description: 'How your solar system behaves during a power outage and safety considerations.',
    category: 'troubleshooting',
    readTime: '3 min read',
    icon: Zap,
    iconColor: 'text-yellow-500',
    iconBg: 'bg-yellow-50',
  },
  {
    id: '11',
    title: 'Your Warranty Coverage',
    description: 'Understanding your panel, inverter, and workmanship warranty periods.',
    category: 'warranty',
    readTime: '4 min read',
    icon: Shield,
    iconColor: 'text-[#D4AF37]',
    iconBg: 'bg-gold-50',
  },
  {
    id: '12',
    title: 'Making a Warranty Claim',
    description: 'Step-by-step guide to submitting a warranty claim for your solar equipment.',
    category: 'warranty',
    readTime: '3 min read',
    icon: FileText,
    iconColor: 'text-[#D4AF37]',
    iconBg: 'bg-gold-50',
  },
];

// ============================================================================
// Sub-Components
// ============================================================================

function GuideCard({ guide }: { guide: Guide }) {
  const Icon = guide.icon;
  return (
    <button
      className="w-full bg-white border border-gold-100 rounded-lg shadow-sm p-4 text-left
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${guide.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${guide.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 group-hover:text-[#D4AF37] transition-colors">
            {guide.title}
          </h4>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{guide.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-400">{guide.readTime}</span>
            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-[#D4AF37] transition-colors" />
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface GuidesScreenProps {
  installationId: string;
}

export default function GuidesScreen({ installationId }: GuidesScreenProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuides = guides.filter((guide) => {
    const matchesCategory = activeCategory === 'all' || guide.category === activeCategory;
    const matchesSearch = !searchQuery ||
      guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guide.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900">Guides & Resources</h2>
          <p className="text-sm text-gray-500 mt-0.5">Everything you need to know about your solar system</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search guides..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl
              focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/20 focus:border-[#D4AF37]
              transition-all"
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                  transition-all duration-150 border ${
                  isActive
                    ? 'bg-[#D4AF37] text-white border-[#D4AF37]'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4AF37]/30'
                }`}
              >
                <cat.icon className="w-3 h-3" />
                {cat.label}
                <span className={`text-[10px] ${isActive ? 'text-white/70' : 'text-gray-400'}`}>
                  ({cat.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Guides Grid */}
        <div className="space-y-3">
          {filteredGuides.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
          {filteredGuides.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">No guides found</p>
              <p className="text-xs text-gray-500 mt-1">Try a different search or category</p>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
