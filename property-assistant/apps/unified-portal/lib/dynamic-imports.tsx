'use client';

import dynamic from 'next/dynamic';
import { ChartLoadingSkeleton, MapLoadingSkeleton, DashboardLoadingSkeleton, TableLoadingSkeleton } from '@/components/ui/ChartLoadingSkeleton';
import { StaticMapPlaceholder, StaticChartPlaceholder } from '@/lib/mobile-optimizations';

const MobileChartSkeleton = () => (
  <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center">
    <span className="text-gray-400 text-sm">Loading...</span>
  </div>
);

const MobileMapSkeleton = () => (
  <StaticMapPlaceholder height={200} />
);

export const DynamicDeveloperDashboard = dynamic(
  () => import('@/app/developer/developer-client'),
  { 
    ssr: false, 
    loading: () => <DashboardLoadingSkeleton /> 
  }
);

export const DynamicDeveloperOverviewDashboard = dynamic(
  () => import('@/components/developer/DeveloperOverviewDashboard'),
  { 
    ssr: false, 
    loading: () => <DashboardLoadingSkeleton /> 
  }
);

export const DynamicPurchaserMapsTab = dynamic(
  () => import('@/components/purchaser/MobileOptimizedMapsTab'),
  { 
    ssr: false, 
    loading: () => <MapLoadingSkeleton /> 
  }
);

export const DynamicCostTrajectory = dynamic(
  () => import('@/components/analytics/premium/CostTrajectory').then(mod => ({ default: mod.CostTrajectory })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={200} /> 
  }
);

export const DynamicContentLifecycleChart = dynamic(
  () => import('@/components/analytics/premium/ContentLifecycleChart').then(mod => ({ default: mod.ContentLifecycleChart })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={200} /> 
  }
);

export const DynamicHealthGauge = dynamic(
  () => import('@/components/analytics/premium/HealthGauge').then(mod => ({ default: mod.HealthGauge })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={150} /> 
  }
);

export const DynamicHeatMatrix = dynamic(
  () => import('@/components/analytics/premium/HeatMatrix').then(mod => ({ default: mod.HeatMatrix })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={200} /> 
  }
);

export const DynamicPersonaSplitChart = dynamic(
  () => import('@/components/analytics/premium/PersonaSplitChart').then(mod => ({ default: mod.PersonaSplitChart })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={200} /> 
  }
);

export const DynamicTrendStream = dynamic(
  () => import('@/components/analytics/premium/TrendStream').then(mod => ({ default: mod.TrendStream })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={150} /> 
  }
);

export const DynamicMetricPulseCard = dynamic(
  () => import('@/components/analytics/premium/MetricPulseCard').then(mod => ({ default: mod.MetricPulseCard })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={100} /> 
  }
);

export const DynamicInsightBanner = dynamic(
  () => import('@/components/analytics/premium/InsightBanner').then(mod => ({ default: mod.InsightBanner })),
  { 
    ssr: false, 
    loading: () => <div className="h-16 bg-gray-100 rounded-lg animate-pulse" /> 
  }
);

export const DynamicEnterpriseBarChart = dynamic(
  () => import('@/components/admin-enterprise/charts/BarChart').then(mod => ({ default: mod.BarChart })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={300} /> 
  }
);

export const DynamicEnterpriseLineChart = dynamic(
  () => import('@/components/admin-enterprise/charts/LineChart').then(mod => ({ default: mod.LineChart })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={300} /> 
  }
);

export const DynamicChatAnalyticsChart = dynamic(
  () => import('@/components/enterprise/ChatAnalyticsChart').then(mod => ({ default: mod.ChatAnalyticsChart })),
  { 
    ssr: false, 
    loading: () => <ChartLoadingSkeleton height={300} /> 
  }
);

export const DynamicPremiumDataTable = dynamic(
  () => import('@/components/analytics/PremiumDataTable').then(mod => ({ default: mod.PremiumDataTable })),
  { 
    ssr: false, 
    loading: () => <TableLoadingSkeleton rows={5} /> 
  }
);

export const DynamicSearchAnalyticsTable = dynamic(
  () => import('@/components/enterprise/SearchAnalyticsTable').then(mod => ({ default: mod.SearchAnalyticsTable })),
  { 
    ssr: false, 
    loading: () => <TableLoadingSkeleton rows={5} /> 
  }
);

export const DynamicDataTable = dynamic(
  () => import('@/components/admin-enterprise/DataTable').then(mod => ({ default: mod.DataTable })),
  { 
    ssr: false, 
    loading: () => <TableLoadingSkeleton rows={5} /> 
  }
);

export const DynamicPurchaserChatTab = dynamic(
  () => import('@/components/purchaser/PurchaserChatTab'),
  { 
    ssr: false, 
    loading: () => <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg animate-pulse"><span className="text-gray-400">Loading chat...</span></div> 
  }
);

export const DynamicPurchaserDocumentsTab = dynamic(
  () => import('@/components/purchaser/PurchaserDocumentsTab'),
  { 
    ssr: false, 
    loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> 
  }
);

export const DynamicPurchaserNoticeboardTab = dynamic(
  () => import('@/components/purchaser/PurchaserNoticeboardTab'),
  { 
    ssr: false, 
    loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> 
  }
);
