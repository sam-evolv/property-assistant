// Design System UI Components
// Export all UI components from a single entry point

// Activity & Feeds
export { ActivityFeed, ActivityFeedWidget } from './ActivityFeed';
export type { Activity, ActivityType } from './ActivityFeed';

// Badges & Status
export { Badge, StatusBadge, StageBadge, CountBadge } from './Badge';

// Bulk Actions
export { BulkActionModal, ConfirmModal } from './BulkActionModal';

// Command Palette
export { CommandPalette, CommandPaletteProvider } from './CommandPalette';
export type { Command, CommandGroup } from './CommandPalette';

// Data Display
export { DataTable } from './DataTable';
export type { Column, DataTableProps } from './DataTable';

// Empty States
export {
  EmptyState,
  NoResultsState,
  EmptyDevelopments,
  EmptyDocuments,
  EmptyHouses,
} from './EmptyState';

// Export Menu
export { ExportMenu } from './ExportMenu';

// Icons
export { Icon, icons } from './Icon';

// Proactive Alerts
export { ProactiveAlertsWidget } from './ProactiveAlerts';
export type { Alert, AlertPriority } from './ProactiveAlerts';

// Progress Indicators
export {
  ProgressBar,
  StageIndicator,
  UnitProgressCard,
  CircularProgress,
} from './ProgressBar';

// Quick Actions
export { QuickActionsBar, FloatingQuickActions, ContextualActions } from './QuickActions';
export type { QuickAction } from './QuickActions';

// Skeleton Loaders
export {
  Skeleton,
  TableRowSkeleton,
  TableSkeleton,
  StatCardSkeleton,
  StatCardGridSkeleton,
  CardSkeleton,
  ActivityFeedSkeleton,
  PageHeaderSkeleton,
  ChartSkeleton,
} from './Skeleton';

// Stat Cards
export { StatCard, StatCardGrid } from './StatCard';

// Toast Notifications
export { ToastProvider, EnhancedToastContainer, toast } from './Toast';
export type { ToastVariant, ToastData } from './Toast';

// Tooltips
export { Tooltip, HelpTooltip, LabelWithTooltip } from './Tooltip';

// Slide Over Panel
export { SlideOver } from './SlideOver';
export type { SlideOverProps } from './SlideOver';

// Inline Editing
export { InlineEdit, InlineNumberEdit } from './InlineEdit';
export type { InlineEditProps, InlineNumberEditProps } from './InlineEdit';

// Help Tooltip (Enhanced)
export { HelpTooltip as HelpTooltipEnhanced, SimpleTooltip } from './HelpTooltip';
export type { HelpTooltipProps } from './HelpTooltip';

// Onboarding Flow
export { OnboardingFlow, useOnboarding } from './OnboardingFlow';
export type { OnboardingStep, OnboardingFlowProps } from './OnboardingFlow';

// Notification Preferences
export { NotificationPreferences } from './NotificationPreferences';
export type { NotificationChannel, NotificationCategory, NotificationPreferencesProps } from './NotificationPreferences';

// Smart Search
export { SmartSearch } from './SmartSearch';
export type { SearchResult, SearchFilter, SmartSearchProps } from './SmartSearch';

// Drag Drop Upload
export { DragDropUpload } from './DragDropUpload';
export type { UploadFile, DragDropUploadProps } from './DragDropUpload';

// File Utilities
export { FileIcon, getFileIcon, formatFileSize } from './FileIcon';

// Chart Loading
export { ChartLoadingSkeleton } from './ChartLoadingSkeleton';

// Additional Skeleton Loaders
export { SkeletonLoader } from './SkeletonLoader';
