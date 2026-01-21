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
