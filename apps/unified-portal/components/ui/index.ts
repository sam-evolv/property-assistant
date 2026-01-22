// Design System UI Components
// Export all UI components from a single entry point

// Activity & Feeds
export { ActivityFeed, ActivityFeedWidget } from './ActivityFeed';
export type { Activity, ActivityType, ActivityItem } from './ActivityFeed';

// Badges & Status
export { Badge, StatusBadge, StageBadge, CountBadge } from './Badge';

// Bulk Actions
export { BulkActionModal, ConfirmModal } from './BulkActionModal';
export { BulkActionToolbar, getCommonBulkActions } from './BulkActionToolbar';
export type { BulkAction } from './BulkActionToolbar';

// Command Palette
export { CommandPalette, useCommandPalette } from './CommandPalette';
export type { CommandItem } from './CommandPalette';

// Data Display
export { DataTable } from './DataTable';

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
export { Icon } from './Icon';

// Proactive Alerts
export { ProactiveAlertsWidget } from './ProactiveAlerts';
export type { Alert, AlertPriority, AlertItem } from './ProactiveAlerts';

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
export { StatCard, StatCardGrid, StatSparkline } from './StatCard';

// Toast Notifications
export { ToastProvider, EnhancedToastContainer, toast } from './Toast';
export type { ToastVariant, ToastData } from './Toast';

// Tooltips
export { Tooltip, HelpTooltip, LabelWithTooltip } from './Tooltip';

// Slide Over Panel
export { SlideOver } from './SlideOver';

// Inline Editing
export { InlineEdit, InlineNumberEdit } from './InlineEdit';

// Help Tooltip (Enhanced)
export { HelpTooltip as HelpTooltipEnhanced, SimpleTooltip } from './HelpTooltip';

// Onboarding Flow
export { OnboardingFlow, useOnboarding } from './OnboardingFlow';
export type { OnboardingStep } from './OnboardingFlow';

// Notification Preferences
export { NotificationPreferences } from './NotificationPreferences';

// Smart Search
export { SmartSearch } from './SmartSearch';

// Drag Drop Upload
export { DragDropUpload } from './DragDropUpload';

// File Utilities
export { FileIcon } from './FileIcon';

// Chart Loading
export { ChartLoadingSkeleton } from './ChartLoadingSkeleton';
