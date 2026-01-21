'use client';

import { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Clock,
  AlertCircle,
  CheckCircle,
  User,
  Search,
  Filter,
  Plus,
  Upload,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Wrench,
  Building2,
  X,
  Phone,
  Mail,
  MapPin,
  FileText,
  Send,
  Camera,
  Download,
  Trash2,
  Edit2,
  ZoomIn,
  MoreVertical,
  UserPlus,
  History,
  MessageSquare,
} from 'lucide-react';

import { DataTable, Column } from '@/components/ui/DataTable';
import { StatCard, StatCardGrid } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { ProactiveAlertsWidget } from '@/components/ui/ProactiveAlerts';
import type { Alert } from '@/components/ui/ProactiveAlerts';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { EmptyState } from '@/components/ui/EmptyState';
import { SlideOver } from '@/components/ui/SlideOver';
import { DragDropUpload } from '@/components/ui/DragDropUpload';

// Types
type SnagStatus = 'submitted' | 'acknowledged' | 'in-progress' | 'resolved' | 'verified';
type SnagPriority = 'low' | 'medium' | 'high' | 'urgent';
type SnagCategory = 'kitchen' | 'bathroom' | 'painting' | 'carpentry' | 'electrical' | 'plumbing' | 'other';

interface Photo {
  id: string;
  url: string;
  thumbnail: string;
  caption?: string;
  uploadedBy: string;
  uploadedAt: Date;
  type: 'before' | 'during' | 'after';
}

interface Contractor {
  id: string;
  name: string;
  company: string;
  specialty: SnagCategory[];
  phone: string;
  email: string;
  rating: number;
  jobsCompleted: number;
  available: boolean;
}

interface ActivityLog {
  id: string;
  action: string;
  user: string;
  timestamp: Date;
  details?: string;
}

interface Snag {
  id: string;
  unitNumber: string;
  title: string;
  description: string;
  category: SnagCategory;
  priority: SnagPriority;
  status: SnagStatus;
  daysOpen: number;
  submittedDate: Date;
  contractor?: Contractor;
  photos: Photo[];
  location?: string;
  reportedBy?: string;
  activity: ActivityLog[];
  notes?: string;
}

// Mock contractors
const mockContractors: Contractor[] = [
  {
    id: 'c1',
    name: 'John Murphy',
    company: 'ABC Kitchens',
    specialty: ['kitchen', 'carpentry'],
    phone: '+353 87 123 4567',
    email: 'john@abckitchens.ie',
    rating: 4.8,
    jobsCompleted: 156,
    available: true,
  },
  {
    id: 'c2',
    name: 'Sarah O\'Brien',
    company: 'Spark Electric',
    specialty: ['electrical'],
    phone: '+353 86 234 5678',
    email: 'sarah@sparkelectric.ie',
    rating: 4.9,
    jobsCompleted: 203,
    available: true,
  },
  {
    id: 'c3',
    name: 'Mike Reilly',
    company: 'Reliable Plumbing',
    specialty: ['plumbing', 'bathroom'],
    phone: '+353 85 345 6789',
    email: 'mike@reliableplumbing.ie',
    rating: 4.7,
    jobsCompleted: 178,
    available: false,
  },
  {
    id: 'c4',
    name: 'Emma Walsh',
    company: 'Perfect Paint Co',
    specialty: ['painting'],
    phone: '+353 87 456 7890',
    email: 'emma@perfectpaint.ie',
    rating: 4.6,
    jobsCompleted: 89,
    available: true,
  },
  {
    id: 'c5',
    name: 'Tom Collins',
    company: 'Murphy Carpentry',
    specialty: ['carpentry', 'other'],
    phone: '+353 86 567 8901',
    email: 'tom@murphycarpentry.ie',
    rating: 4.8,
    jobsCompleted: 134,
    available: true,
  },
];

// Mock photos for demo
const mockPhotos: Photo[] = [
  {
    id: 'p1',
    url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
    thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200',
    caption: 'Kitchen cabinet misalignment - left side',
    uploadedBy: 'Site Manager',
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    type: 'before',
  },
  {
    id: 'p2',
    url: 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=800',
    thumbnail: 'https://images.unsplash.com/photo-1556909114-44e3e70034e2?w=200',
    caption: 'Close-up of hinge issue',
    uploadedBy: 'Site Manager',
    uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    type: 'before',
  },
];

// Mock data
const mockSnags: Snag[] = [
  {
    id: '1',
    unitNumber: '46',
    title: 'Kitchen cabinet door misaligned',
    description: 'Upper cabinet door on left side does not close properly. The hinge appears to be loose and needs adjustment or replacement.',
    category: 'kitchen',
    priority: 'medium',
    status: 'in-progress',
    daysOpen: 3,
    submittedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    contractor: mockContractors[0],
    photos: mockPhotos,
    location: 'Kitchen - Upper cabinets',
    reportedBy: 'James McCarthy',
    activity: [
      { id: 'a1', action: 'Snag submitted', user: 'James McCarthy', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { id: 'a2', action: 'Assigned to contractor', user: 'Site Manager', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), details: 'Assigned to ABC Kitchens' },
      { id: 'a3', action: 'Status changed to In Progress', user: 'John Murphy', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ],
    notes: 'Contractor scheduled to visit tomorrow morning.',
  },
  {
    id: '2',
    unitNumber: '46',
    title: 'Bathroom tile crack',
    description: 'Hairline crack in floor tile near shower entrance',
    category: 'bathroom',
    priority: 'low',
    status: 'submitted',
    daysOpen: 5,
    submittedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    photos: [
      {
        id: 'p3',
        url: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800',
        thumbnail: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=200',
        caption: 'Cracked tile',
        uploadedBy: 'Homeowner',
        uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        type: 'before',
      },
    ],
    location: 'Bathroom - Floor',
    reportedBy: 'Mary O\'Sullivan',
    activity: [
      { id: 'a4', action: 'Snag submitted', user: 'Mary O\'Sullivan', timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '3',
    unitNumber: '51',
    title: 'Paint touch-up needed',
    description: 'Scuff marks on hallway wall near entrance',
    category: 'painting',
    priority: 'low',
    status: 'submitted',
    daysOpen: 2,
    submittedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    photos: [],
    location: 'Hallway',
    reportedBy: 'Site Inspector',
    activity: [
      { id: 'a5', action: 'Snag submitted', user: 'Site Inspector', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '4',
    unitNumber: '51',
    title: 'Door alignment issue',
    description: 'Bedroom door sticks when closing',
    category: 'carpentry',
    priority: 'medium',
    status: 'resolved',
    daysOpen: 0,
    submittedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    contractor: mockContractors[4],
    photos: [
      {
        id: 'p4',
        url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
        thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
        caption: 'Door after repair',
        uploadedBy: 'Tom Collins',
        uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        type: 'after',
      },
    ],
    location: 'Master Bedroom',
    reportedBy: 'Site Manager',
    activity: [
      { id: 'a6', action: 'Snag submitted', user: 'Site Manager', timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { id: 'a7', action: 'Status changed to Resolved', user: 'Tom Collins', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '5',
    unitNumber: '33',
    title: 'Electrical outlet not working',
    description: 'Double outlet in living room has no power',
    category: 'electrical',
    priority: 'high',
    status: 'acknowledged',
    daysOpen: 1,
    submittedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    contractor: mockContractors[1],
    photos: [],
    location: 'Living Room - East wall',
    reportedBy: 'Homeowner',
    activity: [
      { id: 'a8', action: 'Snag submitted', user: 'Homeowner', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { id: 'a9', action: 'Status changed to Acknowledged', user: 'Sarah O\'Brien', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '6',
    unitNumber: '34',
    title: 'Kitchen tap dripping',
    description: 'Slow drip from kitchen mixer tap',
    category: 'plumbing',
    priority: 'urgent',
    status: 'in-progress',
    daysOpen: 4,
    submittedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    contractor: mockContractors[2],
    photos: [],
    location: 'Kitchen - Sink',
    reportedBy: 'Homeowner',
    activity: [
      { id: 'a10', action: 'Snag submitted', user: 'Homeowner', timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
    ],
  },
  {
    id: '7',
    unitNumber: '47',
    title: 'Window seal gap',
    description: 'Small gap visible in window seal, potential draft',
    category: 'other',
    priority: 'medium',
    status: 'verified',
    daysOpen: 0,
    submittedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    photos: [],
    location: 'Living Room - Window',
    reportedBy: 'Site Inspector',
    activity: [
      { id: 'a11', action: 'Snag submitted', user: 'Site Inspector', timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { id: 'a12', action: 'Status changed to Verified', user: 'Quality Team', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  },
];

const statusConfig: Record<SnagStatus, { label: string; color: string; bgColor: string }> = {
  submitted: { label: 'Submitted', color: 'text-red-600', bgColor: 'bg-red-50' },
  acknowledged: { label: 'Acknowledged', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  'in-progress': { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  resolved: { label: 'Resolved', color: 'text-green-600', bgColor: 'bg-green-50' },
  verified: { label: 'Verified', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
};

const priorityConfig: Record<SnagPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-gray-600' },
  medium: { label: 'Medium', color: 'text-amber-600' },
  high: { label: 'High', color: 'text-orange-600' },
  urgent: { label: 'Urgent', color: 'text-red-600' },
};

const categoryConfig: Record<SnagCategory, { label: string; icon: typeof ClipboardList }> = {
  kitchen: { label: 'Kitchen', icon: ClipboardList },
  bathroom: { label: 'Bathroom', icon: ClipboardList },
  painting: { label: 'Painting', icon: ClipboardList },
  carpentry: { label: 'Carpentry', icon: Wrench },
  electrical: { label: 'Electrical', icon: ClipboardList },
  plumbing: { label: 'Plumbing', icon: ClipboardList },
  other: { label: 'Other', icon: ClipboardList },
};

// Photo Gallery Modal Component
function PhotoGallery({
  photos,
  isOpen,
  onClose,
  initialIndex = 0,
}: {
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [mounted, setMounted] = useState(false);

  useState(() => {
    setMounted(true);
  });

  if (!isOpen || !mounted) return null;

  const currentPhoto = photos[currentIndex];
  if (!currentPhoto) return null;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/90" onClick={onClose} />

      <div className="relative z-10 max-w-5xl w-full mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Main image */}
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
          <img
            src={currentPhoto.url}
            alt={currentPhoto.caption || 'Snag photo'}
            className="w-full h-full object-contain"
          />

          {/* Navigation arrows */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Photo type badge */}
          <div className="absolute top-4 left-4">
            <Badge
              variant={
                currentPhoto.type === 'before'
                  ? 'error'
                  : currentPhoto.type === 'after'
                  ? 'success'
                  : 'info'
              }
            >
              {currentPhoto.type.charAt(0).toUpperCase() + currentPhoto.type.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Caption and metadata */}
        <div className="mt-4 text-center">
          {currentPhoto.caption && (
            <p className="text-white text-lg mb-2">{currentPhoto.caption}</p>
          )}
          <p className="text-white/60 text-sm">
            Uploaded by {currentPhoto.uploadedBy} on{' '}
            {currentPhoto.uploadedAt.toLocaleDateString()}
          </p>
          <p className="text-white/40 text-sm mt-1">
            {currentIndex + 1} of {photos.length}
          </p>
        </div>

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <div className="flex justify-center gap-2 mt-4 overflow-x-auto pb-2">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'w-16 h-16 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                  index === currentIndex
                    ? 'border-gold-500 opacity-100'
                    : 'border-transparent opacity-50 hover:opacity-75'
                )}
              >
                <img
                  src={photo.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Contractor Assignment Modal
function ContractorAssignmentModal({
  isOpen,
  onClose,
  snag,
  contractors,
  onAssign,
}: {
  isOpen: boolean;
  onClose: () => void;
  snag: Snag;
  contractors: Contractor[];
  onAssign: (contractorId: string) => void;
}) {
  const [selectedContractor, setSelectedContractor] = useState<string | null>(
    snag.contractor?.id || null
  );
  const [filterSpecialty, setFilterSpecialty] = useState<SnagCategory | 'all'>('all');

  // Filter contractors by specialty
  const filteredContractors = contractors.filter((c) => {
    if (filterSpecialty === 'all') return true;
    return c.specialty.includes(filterSpecialty);
  });

  // Sort by relevance (matching specialty first, then by rating)
  const sortedContractors = [...filteredContractors].sort((a, b) => {
    const aMatches = a.specialty.includes(snag.category);
    const bMatches = b.specialty.includes(snag.category);
    if (aMatches && !bMatches) return -1;
    if (!aMatches && bMatches) return 1;
    return b.rating - a.rating;
  });

  if (!isOpen) return null;

  return (
    <SlideOver
      open={isOpen}
      onClose={onClose}
      title="Assign Contractor"
      subtitle={`For: ${snag.title}`}
      width="lg"
      footer={
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedContractor) {
                onAssign(selectedContractor);
                onClose();
              }
            }}
            disabled={!selectedContractor}
            className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Assign Contractor
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Current assignment */}
        {snag.contractor && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              Currently assigned to: <strong>{snag.contractor.name}</strong> ({snag.contractor.company})
            </p>
          </div>
        )}

        {/* Filter by specialty */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filter by Specialty
          </label>
          <select
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value as SnagCategory | 'all')}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
          >
            <option value="all">All Specialties</option>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <option key={key} value={key}>
                {config.label}
              </option>
            ))}
          </select>
        </div>

        {/* Contractor list */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Available Contractors ({sortedContractors.length})
          </p>

          {sortedContractors.map((contractor) => {
            const matchesCategory = contractor.specialty.includes(snag.category);

            return (
              <button
                key={contractor.id}
                onClick={() => setSelectedContractor(contractor.id)}
                className={cn(
                  'w-full p-4 rounded-lg border text-left transition-all',
                  selectedContractor === contractor.id
                    ? 'border-gold-500 bg-gold-50 ring-2 ring-gold-500/20'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{contractor.name}</span>
                        {matchesCategory && (
                          <Badge variant="success" size="sm">
                            Recommended
                          </Badge>
                        )}
                        {!contractor.available && (
                          <Badge variant="outline" size="sm">
                            Busy
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{contractor.company}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400">
                          {contractor.specialty.map((s) => categoryConfig[s].label).join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-amber-500">
                        {contractor.rating.toFixed(1)}
                      </span>
                      <span className="text-amber-500">★</span>
                    </div>
                    <p className="text-xs text-gray-400">{contractor.jobsCompleted} jobs</p>
                  </div>
                </div>

                {selectedContractor === contractor.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {contractor.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {contractor.email}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </SlideOver>
  );
}

// Snag Detail Slide-Over
function SnagDetailSlideOver({
  snag,
  isOpen,
  onClose,
  onAssignContractor,
  onUpdateStatus,
}: {
  snag: Snag | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignContractor: () => void;
  onUpdateStatus: (status: SnagStatus) => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'activity'>('details');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  if (!snag) return null;

  const status = statusConfig[snag.status];
  const priority = priorityConfig[snag.priority];
  const category = categoryConfig[snag.category];

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <>
      <SlideOver
        open={isOpen}
        onClose={onClose}
        title={`Unit ${snag.unitNumber} - ${snag.title}`}
        width="lg"
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={snag.status}
                onChange={(e) => onUpdateStatus(e.target.value as SnagStatus)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              >
                {Object.entries(statusConfig).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onAssignContractor}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {snag.contractor ? 'Reassign' : 'Assign'} Contractor
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition-colors">
                <Send className="w-4 h-4" />
                Send Update
              </button>
            </div>
          </div>
        }
      >
        {/* Status & Priority */}
        <div className="flex items-center gap-3 mb-6">
          <Badge
            variant={
              snag.status === 'verified' || snag.status === 'resolved'
                ? 'success'
                : snag.status === 'in-progress'
                ? 'info'
                : snag.status === 'acknowledged'
                ? 'warning'
                : 'error'
            }
          >
            {status.label}
          </Badge>
          <Badge variant="outline">{category.label}</Badge>
          <span className={cn('text-sm font-medium', priority.color)}>
            {priority.label} Priority
          </span>
          {snag.daysOpen > 0 && (
            <span className="text-sm text-gray-500">
              Open {snag.daysOpen} day{snag.daysOpen !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <div className="flex gap-6">
            {[
              { id: 'details', label: 'Details', icon: FileText },
              { id: 'photos', label: `Photos (${snag.photos.length})`, icon: Camera },
              { id: 'activity', label: 'Activity', icon: History },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  'flex items-center gap-2 pb-3 border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-gold-500 text-gold-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
              <p className="text-sm text-gray-600">{snag.description}</p>
            </div>

            {/* Location */}
            {snag.location && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Location</h4>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {snag.location}
                </div>
              </div>
            )}

            {/* Reported By */}
            {snag.reportedBy && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Reported By</h4>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  {snag.reportedBy}
                  <span className="text-gray-400">
                    on {snag.submittedDate.toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            {/* Assigned Contractor */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Contractor</h4>
              {snag.contractor ? (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                      <User className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{snag.contractor.name}</p>
                      <p className="text-sm text-gray-500">{snag.contractor.company}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <a
                          href={`tel:${snag.contractor.phone}`}
                          className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700"
                        >
                          <Phone className="w-3 h-3" />
                          {snag.contractor.phone}
                        </a>
                        <a
                          href={`mailto:${snag.contractor.email}`}
                          className="flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700"
                        >
                          <Mail className="w-3 h-3" />
                          Email
                        </a>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-amber-500">
                          {snag.contractor.rating.toFixed(1)}
                        </span>
                        <span className="text-amber-500">★</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onAssignContractor}
                  className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gold-600 bg-gold-50 hover:bg-gold-100 rounded-lg transition-colors w-full justify-center"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign a Contractor
                </button>
              )}
            </div>

            {/* Notes */}
            {snag.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  {snag.notes}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-6">
            {/* Photo Grid */}
            {snag.photos.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {snag.photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      onClick={() => openGallery(index)}
                      className="relative aspect-square rounded-lg overflow-hidden group"
                    >
                      <img
                        src={photo.thumbnail}
                        alt={photo.caption || 'Snag photo'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute top-2 left-2">
                        <Badge
                          variant={
                            photo.type === 'before'
                              ? 'error'
                              : photo.type === 'after'
                              ? 'success'
                              : 'info'
                          }
                          size="sm"
                        >
                          {photo.type}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Photo list */}
                <div className="space-y-2">
                  {snag.photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <img
                        src={photo.thumbnail}
                        alt=""
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {photo.caption || 'No caption'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {photo.uploadedBy} - {photo.uploadedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="No photos yet"
                description="Upload photos to document this snag"
                icon={Camera}
              />
            )}

            {/* Upload section */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add Photos</h4>
              <DragDropUpload
                onUpload={async (files) => {
                  console.log('Uploading', files);
                }}
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                title="Upload snag photos"
                description="Drag photos here or click to browse"
              />
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-4">
            {snag.activity.map((item, index) => (
              <div key={item.id} className="flex gap-3">
                <div className="relative">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <History className="w-4 h-4 text-gray-500" />
                  </div>
                  {index < snag.activity.length - 1 && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-8 bg-gray-200" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <p className="text-sm font-medium text-gray-900">{item.action}</p>
                  {item.details && (
                    <p className="text-sm text-gray-600 mt-0.5">{item.details}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {item.user} - {item.timestamp.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}

            {/* Add comment */}
            <div className="pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Add Comment</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a comment..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
                />
                <button className="px-4 py-2 text-sm font-medium text-white bg-gold-500 hover:bg-gold-600 rounded-lg transition-colors">
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
      </SlideOver>

      {/* Photo Gallery Modal */}
      <PhotoGallery
        photos={snag.photos}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialIndex={galleryIndex}
      />
    </>
  );
}

// Snag Card for grid view
function SnagCard({ snag, onClick }: { snag: Snag; onClick?: () => void }) {
  const status = statusConfig[snag.status];
  const priority = priorityConfig[snag.priority];
  const category = categoryConfig[snag.category];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border p-4 cursor-pointer transition-all',
        'hover:shadow-md hover:border-gray-300',
        snag.priority === 'urgent' && 'border-red-200'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Unit {snag.unitNumber}</span>
          <Badge
            variant={
              snag.status === 'verified' || snag.status === 'resolved'
                ? 'success'
                : snag.status === 'in-progress'
                ? 'info'
                : snag.status === 'acknowledged'
                ? 'warning'
                : 'error'
            }
            size="sm"
          >
            {status.label}
          </Badge>
        </div>
        {snag.photos && snag.photos.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <ImageIcon className="w-3 h-3" />
            {snag.photos.length}
          </div>
        )}
      </div>

      <p className="text-sm text-gray-900 font-medium mb-1 line-clamp-1">{snag.title}</p>
      <p className="text-xs text-gray-500 line-clamp-2 mb-3">{snag.description}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" size="sm">
            {category.label}
          </Badge>
          <span className={cn('text-xs font-medium', priority.color)}>
            {priority.label}
          </span>
        </div>

        {snag.daysOpen > 0 && (
          <span className="text-xs text-gray-400">{snag.daysOpen} days</span>
        )}
      </div>

      {snag.contractor && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <User className="w-3 h-3" />
          {snag.contractor.name}
        </div>
      )}
    </div>
  );
}

// Main Snagging Page
export default function SnaggingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<SnagStatus | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<SnagCategory | 'all'>('all');
  const [selectedUnit, setSelectedUnit] = useState<string | 'all'>('all');
  const [selectedSnag, setSelectedSnag] = useState<Snag | null>(null);
  const [showContractorModal, setShowContractorModal] = useState(false);
  const [snags, setSnags] = useState<Snag[]>(mockSnags);

  // Filter snags
  const filteredSnags = useMemo(() => {
    return snags.filter((snag) => {
      const matchesSearch =
        !searchQuery ||
        snag.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snag.unitNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snag.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = selectedStatus === 'all' || snag.status === selectedStatus;
      const matchesCategory = selectedCategory === 'all' || snag.category === selectedCategory;
      const matchesUnit = selectedUnit === 'all' || snag.unitNumber === selectedUnit;

      return matchesSearch && matchesStatus && matchesCategory && matchesUnit;
    });
  }, [snags, searchQuery, selectedStatus, selectedCategory, selectedUnit]);

  // Stats
  const stats = useMemo(() => {
    const open = snags.filter((s) => !['resolved', 'verified'].includes(s.status));
    const resolved = snags.filter((s) => ['resolved', 'verified'].includes(s.status));
    const avgResolutionTime =
      resolved.reduce((acc, s) => acc + s.daysOpen, 0) / Math.max(1, resolved.length);

    return {
      open: open.length,
      inProgress: snags.filter((s) => s.status === 'in-progress').length,
      resolved: resolved.length,
      avgResolutionTime: avgResolutionTime.toFixed(1),
      overdue: snags.filter((s) => s.daysOpen > 5 && !['resolved', 'verified'].includes(s.status)).length,
    };
  }, [snags]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    snags.forEach((snag) => {
      if (!['resolved', 'verified'].includes(snag.status)) {
        breakdown[snag.category] = (breakdown[snag.category] || 0) + 1;
      }
    });
    return breakdown;
  }, [snags]);

  // Unique units for filter
  const uniqueUnits = useMemo(() => {
    return [...new Set(snags.map((s) => s.unitNumber))].sort();
  }, [snags]);

  // Alerts
  const alerts: Alert[] = useMemo(() => {
    const alerts: Alert[] = [];

    if (stats.overdue > 0) {
      alerts.push({
        id: 'overdue',
        title: `${stats.overdue} snags overdue`,
        description: 'Open for more than 5 days without resolution',
        priority: 'critical',
        count: stats.overdue,
      });
    }

    const urgent = snags.filter((s) => s.priority === 'urgent' && !['resolved', 'verified'].includes(s.status));
    if (urgent.length > 0) {
      alerts.push({
        id: 'urgent',
        title: `${urgent.length} urgent items`,
        description: 'High priority snags requiring immediate attention',
        priority: 'warning',
        count: urgent.length,
      });
    }

    return alerts;
  }, [snags, stats.overdue]);

  // Handle contractor assignment
  const handleAssignContractor = useCallback((contractorId: string) => {
    if (!selectedSnag) return;

    const contractor = mockContractors.find((c) => c.id === contractorId);
    if (!contractor) return;

    setSnags((prev) =>
      prev.map((s) =>
        s.id === selectedSnag.id
          ? {
              ...s,
              contractor,
              activity: [
                ...s.activity,
                {
                  id: `a${Date.now()}`,
                  action: 'Assigned to contractor',
                  user: 'Site Manager',
                  timestamp: new Date(),
                  details: `Assigned to ${contractor.name} (${contractor.company})`,
                },
              ],
            }
          : s
      )
    );

    setSelectedSnag((prev) =>
      prev
        ? {
            ...prev,
            contractor,
          }
        : null
    );
  }, [selectedSnag]);

  // Handle status update
  const handleUpdateStatus = useCallback((newStatus: SnagStatus) => {
    if (!selectedSnag) return;

    setSnags((prev) =>
      prev.map((s) =>
        s.id === selectedSnag.id
          ? {
              ...s,
              status: newStatus,
              daysOpen: ['resolved', 'verified'].includes(newStatus) ? 0 : s.daysOpen,
              activity: [
                ...s.activity,
                {
                  id: `a${Date.now()}`,
                  action: `Status changed to ${statusConfig[newStatus].label}`,
                  user: 'Site Manager',
                  timestamp: new Date(),
                },
              ],
            }
          : s
      )
    );

    setSelectedSnag((prev) =>
      prev
        ? {
            ...prev,
            status: newStatus,
          }
        : null
    );
  }, [selectedSnag]);

  // Table columns
  const columns: Column<Snag>[] = [
    {
      id: 'unit',
      header: 'Unit',
      accessor: 'unitNumber',
      sortable: true,
      cell: (_, row) => (
        <span className="font-medium text-gray-900">Unit {row.unitNumber}</span>
      ),
    },
    {
      id: 'title',
      header: 'Item',
      accessor: 'title',
      sortable: true,
      cell: (value, row) => (
        <div className="flex items-center gap-2">
          <span className="text-gray-900 line-clamp-1">{value as string}</span>
          {row.photos.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <ImageIcon className="w-3 h-3" />
              {row.photos.length}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      accessor: 'category',
      sortable: true,
      cell: (value) => (
        <Badge variant="outline" size="sm">
          {categoryConfig[value as SnagCategory].label}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (value) => {
        const config = statusConfig[value as SnagStatus];
        return (
          <Badge
            variant={
              value === 'verified' || value === 'resolved'
                ? 'success'
                : value === 'in-progress'
                ? 'info'
                : value === 'acknowledged'
                ? 'warning'
                : 'error'
            }
            size="sm"
          >
            {config.label}
          </Badge>
        );
      },
    },
    {
      id: 'contractor',
      header: 'Contractor',
      accessor: (row) => row.contractor?.name || '',
      sortable: true,
      cell: (_, row) =>
        row.contractor ? (
          <span className="text-sm text-gray-600">{row.contractor.name}</span>
        ) : (
          <span className="text-sm text-gray-400">Unassigned</span>
        ),
    },
    {
      id: 'priority',
      header: 'Priority',
      accessor: 'priority',
      sortable: true,
      cell: (value) => {
        const config = priorityConfig[value as SnagPriority];
        return (
          <span className={cn('text-sm font-medium', config.color)}>
            {config.label}
          </span>
        );
      },
    },
    {
      id: 'days',
      header: 'Days',
      accessor: 'daysOpen',
      sortable: true,
      align: 'right',
      cell: (value, row) => (
        <span
          className={cn(
            'text-sm',
            (value as number) > 5 && !['resolved', 'verified'].includes(row.status)
              ? 'text-red-600 font-medium'
              : 'text-gray-600'
          )}
        >
          {value as number}
        </span>
      ),
    },
  ];

  const handleExport = async (format: string) => {
    console.log('Exporting as', format);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Snagging</h1>
              <p className="text-sm text-gray-500 mt-1">
                {stats.open} open items across {uniqueUnits.length} units
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ExportMenu onExport={handleExport} />
              <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gold-500 rounded-lg hover:bg-gold-600 transition-colors">
                <Plus className="w-4 h-4" />
                Add Snag
              </button>
            </div>
          </div>

          {/* Stats */}
          <StatCardGrid columns={5}>
            <StatCard
              label="Open"
              value={stats.open}
              icon={AlertCircle}
              iconColor="text-red-500"
            />
            <StatCard
              label="In Progress"
              value={stats.inProgress}
              icon={Clock}
              iconColor="text-blue-500"
            />
            <StatCard
              label="Resolved"
              value={stats.resolved}
              icon={CheckCircle}
              iconColor="text-green-500"
            />
            <StatCard
              label="Avg Resolution"
              value={stats.avgResolutionTime}
              suffix=" days"
              icon={Calendar}
              iconColor="text-purple-500"
            />
            <StatCard
              label="Overdue"
              value={stats.overdue}
              icon={AlertCircle}
              iconColor="text-amber-500"
              description="> 5 days open"
            />
          </StatCardGrid>

          {/* Alerts */}
          {alerts.length > 0 && <ProactiveAlertsWidget alerts={alerts} />}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-200 p-4">
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Units</option>
              {uniqueUnits.map((unit) => (
                <option key={unit} value={unit}>
                  Unit {unit}
                </option>
              ))}
            </select>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as SnagCategory | 'all')}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as SnagStatus | 'all')}
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
                placeholder="Search snags..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500"
              />
            </div>

            <p className="text-sm text-gray-500 ml-auto">
              {filteredSnags.length} of {snags.length} items
            </p>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Open Items by Category</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(categoryBreakdown).map(([category, count]) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category as SnagCategory)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                    selectedCategory === category
                      ? 'border-gold-500 bg-gold-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {categoryConfig[category as SnagCategory].label}
                  </span>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
          <DataTable
            data={filteredSnags}
            columns={columns}
            selectable
            onRowClick={(row) => setSelectedSnag(row)}
            bulkActions={[
              {
                label: 'Assign Contractor',
                icon: User,
                onClick: (ids) => console.log('Assign contractor to', ids),
              },
              {
                label: 'Mark Resolved',
                icon: CheckCircle,
                onClick: (ids) => console.log('Mark resolved', ids),
              },
            ]}
            emptyMessage="No snags match your filters"
          />
        </div>
      </div>

      {/* Detail Slide-Over */}
      <SnagDetailSlideOver
        snag={selectedSnag}
        isOpen={!!selectedSnag}
        onClose={() => setSelectedSnag(null)}
        onAssignContractor={() => setShowContractorModal(true)}
        onUpdateStatus={handleUpdateStatus}
      />

      {/* Contractor Assignment Modal */}
      {selectedSnag && (
        <ContractorAssignmentModal
          isOpen={showContractorModal}
          onClose={() => setShowContractorModal(false)}
          snag={selectedSnag}
          contractors={mockContractors}
          onAssign={handleAssignContractor}
        />
      )}
    </div>
  );
}
