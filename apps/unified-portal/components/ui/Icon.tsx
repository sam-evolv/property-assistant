'use client';

import {
  AlertCircle,
  CheckCircle,
  Clock,
  Info,
  Building,
  Building2,
  DollarSign,
  Key,
  Layers,
  ClipboardList,
  ShieldCheck,
  Users,
  Plus,
  Mail,
  Upload,
  Download,
  Search,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Home,
  FileText,
  Folder,
  Calendar,
  Bell,
  X,
  Check,
  MoreHorizontal,
  MoreVertical,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  Link,
  Send,
  MessageSquare,
  Phone,
  MapPin,
  Globe,
  Activity,
  TrendingUp,
  TrendingDown,
  PieChart,
  LineChart,
  Target,
  Zap,
  Star,
  Heart,
  Bookmark,
  Flag,
  Tag,
  Hash,
  AtSign,
  Percent,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Map of all available icons
const iconMap = {
  // Status/Alerts
  alertCircle: AlertCircle,
  checkCircle: CheckCircle,
  clock: Clock,
  info: Info,
  alertTriangle: AlertTriangle,
  xCircle: XCircle,
  helpCircle: HelpCircle,

  // Domain-Specific
  building: Building,
  building2: Building2,
  dollarSign: DollarSign,
  key: Key,
  layers: Layers,
  clipboard: ClipboardList,
  shieldCheck: ShieldCheck,
  users: Users,
  home: Home,
  fileText: FileText,
  folder: Folder,
  calendar: Calendar,
  mapPin: MapPin,
  globe: Globe,

  // Actions
  plus: Plus,
  mail: Mail,
  upload: Upload,
  download: Download,
  search: Search,
  barChart: BarChart3,
  settings: Settings,
  bell: Bell,
  x: X,
  check: Check,
  moreHorizontal: MoreHorizontal,
  moreVertical: MoreVertical,
  filter: Filter,
  sortAsc: SortAsc,
  sortDesc: SortDesc,
  refresh: RefreshCw,
  eye: Eye,
  eyeOff: EyeOff,
  edit: Edit,
  trash: Trash2,
  copy: Copy,
  link: Link,
  send: Send,
  messageSquare: MessageSquare,
  phone: Phone,

  // Navigation
  chevronDown: ChevronDown,
  chevronUp: ChevronUp,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  externalLink: ExternalLink,

  // Analytics/Stats
  activity: Activity,
  trendingUp: TrendingUp,
  trendingDown: TrendingDown,
  pieChart: PieChart,
  lineChart: LineChart,
  target: Target,
  zap: Zap,
  percent: Percent,

  // Engagement
  star: Star,
  heart: Heart,
  bookmark: Bookmark,
  flag: Flag,
  tag: Tag,
  hash: Hash,
  atSign: AtSign,

  // Loading
  loader: Loader2,
} as const;

export type IconName = keyof typeof iconMap;

interface IconProps {
  name: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  strokeWidth?: number;
}

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

/**
 * Icon component using Lucide icons
 *
 * @example
 * <Icon name="alertCircle" size="md" className="text-amber-500" />
 * <Icon name="checkCircle" size="lg" className="text-green-500" />
 */
export function Icon({
  name,
  size = 'md',
  className,
  strokeWidth = 2,
}: IconProps) {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon "${name}" not found in icon map`);
    return null;
  }

  return (
    <IconComponent
      className={cn(sizeMap[size], className)}
      strokeWidth={strokeWidth}
    />
  );
}

// Export individual icons for direct import when needed
export {
  AlertCircle,
  CheckCircle,
  Clock,
  Info,
  Building,
  Building2,
  DollarSign,
  Key,
  Layers,
  ClipboardList,
  ShieldCheck,
  Users,
  Plus,
  Mail,
  Upload,
  Download,
  Search,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Home,
  FileText,
  Folder,
  Calendar,
  Bell,
  X,
  Check,
  MoreHorizontal,
  MoreVertical,
  Filter,
  SortAsc,
  SortDesc,
  RefreshCw,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Copy,
  Link,
  Send,
  MessageSquare,
  Phone,
  MapPin,
  Globe,
  Activity,
  TrendingUp,
  TrendingDown,
  PieChart,
  LineChart,
  Target,
  Zap,
  Star,
  Heart,
  Bookmark,
  Flag,
  Tag,
  Hash,
  AtSign,
  Percent,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Loader2,
};

// Helper to get icon by name (useful for dynamic rendering)
export function getIcon(name: IconName): LucideIcon | null {
  return iconMap[name] || null;
}

export default Icon;
