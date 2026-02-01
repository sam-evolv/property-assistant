/**
 * Portfolio Analytics API
 * GET /api/pipeline/portfolio/analytics
 * Returns comprehensive analytics aggregated across ALL developments
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate.getTime() - startDate.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function formatMonth(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IE', { month: 'short', year: 'numeric' });
}

function getMonthKey(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const parsePrice = (price: any): number => {
  if (price === null || price === undefined) return 0;
  const parsed = parseFloat(String(price));
  return isNaN(parsed) ? 0 : parsed;
};

interface PCsumConfig {
  kitchen4Bed: number;
  kitchen3Bed: number;
  kitchen2Bed: number;
  wardrobes: number;
}

function calculatePCSum(
  bedrooms: number,
  hasKitchen: boolean | null,
  hasWardrobe: boolean | null,
  config: PCsumConfig
): { pcSumKitchen: number; pcSumWardrobes: number; pcSumTotal: number } {
  let pcSumKitchen = 0;
  let pcSumWardrobes = 0;

  // Kitchen PC Sum: deduct if NOT taking developer kitchen
  if (hasKitchen === false) {
    if (bedrooms >= 4) pcSumKitchen = -config.kitchen4Bed;
    else if (bedrooms === 3) pcSumKitchen = -config.kitchen3Bed;
    else pcSumKitchen = -config.kitchen2Bed;
  }

  // Wardrobe PC Sum: deduct if NOT taking developer wardrobes
  if (hasWardrobe === false) {
    pcSumWardrobes = -config.wardrobes;
  }

  return {
    pcSumKitchen,
    pcSumWardrobes,
    pcSumTotal: pcSumKitchen + pcSumWardrobes,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId } = session;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch all developments for this tenant
    const { data: developments, error: devError } = await supabaseAdmin
      .from('developments')
      .select('id, name, code, address')
      .eq('tenant_id', tenantId)
      .order('name');

    if (devError) {
      console.error('[Portfolio Analytics] Error fetching developments:', devError);
      return NextResponse.json({ error: 'Failed to fetch developments' }, { status: 500 });
    }

    // Fetch all units with pipeline data for this tenant
    const { data: allUnits, error: unitsError } = await supabaseAdmin
      .from('units')
      .select(`
        *,
        unit_sales_pipeline (
          id,
          sale_type,
          sale_price,
          status,
          purchaser_name,
          housing_agency,
          release_date,
          sale_agreed_date,
          deposit_date,
          contracts_issued_date,
          queries_raised_date,
          queries_replied_date,
          signed_contracts_date,
          counter_signed_date,
          kitchen_date,
          kitchen_selected,
          kitchen_wardrobes,
          snag_date,
          drawdown_date,
          handover_date,
          updated_at
        )
      `)
      .eq('tenant_id', tenantId)
      .order('unit_number');
    
    // Fetch kitchen selection options for PC Sum allowances
    const { data: kitchenOptions } = await supabaseAdmin
      .from('kitchen_selection_options')
      .select('development_id, pc_sum_kitchen_4bed, pc_sum_kitchen_3bed, pc_sum_kitchen_2bed, pc_sum_wardrobes')
      .eq('tenant_id', tenantId);
    
    const kitchenOptionsMap = new Map(
      (kitchenOptions || []).map(opt => [opt.development_id, opt])
    );

    if (unitsError) {
      console.error('[Portfolio Analytics] Error fetching units:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    // Map development IDs
    const developmentMap = new Map(developments?.map(d => [d.id, d]) || []);

    // Process pipeline data
    const pipelineUnits = (allUnits || []).map((u: any) => ({
      id: u.id,
      unitNumber: u.unit_number || '',
      developmentId: u.development_id || u.project_id,
      type: u.property_type || u.house_type_code || u.property_designation || 'Unknown',
      beds: u.bedrooms ? Number(u.bedrooms) : null,
      floorArea: u.square_footage ? Number(u.square_footage) : (u.floor_area_m2 ? Number(u.floor_area_m2) : null),
      pipeline: Array.isArray(u.unit_sales_pipeline) ? u.unit_sales_pipeline[0] : u.unit_sales_pipeline,
    })).filter(u => u.pipeline);

    const now = new Date();

    // ==========================================================================
    // SECTION 1: PORTFOLIO OVERVIEW
    // ==========================================================================
    
    const privateUnits = pipelineUnits.filter(u => u.pipeline?.sale_type !== 'social');
    const socialUnits = pipelineUnits.filter(u => u.pipeline?.sale_type === 'social');
    
    const totalRevenue = privateUnits.reduce((sum, u) => sum + parsePrice(u.pipeline?.sale_price), 0);
    const soldUnits = privateUnits.filter(u => u.pipeline?.handover_date);
    const avgPrice = privateUnits.length > 0 ? totalRevenue / privateUnits.length : 0;

    // Calculate total PC Sum across all developments (will be calculated after developmentStats)
    let totalPcSumDeductions = 0;
    let totalPcSumKitchen = 0;
    let totalPcSumWardrobes = 0;
    let totalDecided = 0;
    let totalTakingOwnKitchen = 0;
    let totalTakingOwnWardrobes = 0;

    const portfolioOverview = {
      totalDevelopments: developments?.length || 0,
      totalUnits: pipelineUnits.length,
      privateUnits: privateUnits.length,
      socialUnits: socialUnits.length,
      totalRevenue,
      avgPrice,
      soldUnits: soldUnits.length,
      inProgress: privateUnits.filter(u => u.pipeline?.release_date && !u.pipeline?.handover_date).length,
      // PC Sum fields will be added after development stats calculation
      totalPcSumDeductions: 0,
      totalPcSumKitchen: 0,
      totalPcSumWardrobes: 0,
      adjustedRevenue: 0,
      totalDecided: 0,
      totalTakingOwnKitchen: 0,
      totalTakingOwnWardrobes: 0,
    };

    // ==========================================================================
    // SECTION 2: DEVELOPMENT COMPARISON
    // ==========================================================================
    
    const developmentStats: any[] = [];
    const developmentColors: Record<string, string> = {};
    const colorPalette = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];

    developments?.forEach((dev, idx) => {
      const devUnits = pipelineUnits.filter(u => u.developmentId === dev.id);
      const devPrivate = devUnits.filter(u => u.pipeline?.sale_type !== 'social');
      const devSocial = devUnits.filter(u => u.pipeline?.sale_type === 'social');
      
      const sold = devPrivate.filter(u => u.pipeline?.handover_date).length;
      const inProgress = devPrivate.filter(u => u.pipeline?.release_date && !u.pipeline?.handover_date).length;
      const available = devPrivate.filter(u => !u.pipeline?.release_date).length;
      const revenue = devPrivate.reduce((sum, u) => sum + parsePrice(u.pipeline?.sale_price), 0);
      const avgPriceForDev = devPrivate.length > 0 ? revenue / devPrivate.length : 0;
      
      // Calculate average cycle
      const cycles: number[] = [];
      devPrivate.forEach(u => {
        const days = daysBetween(u.pipeline?.release_date, u.pipeline?.handover_date);
        if (days !== null && days >= 0) cycles.push(days);
      });
      const avgCycle = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : 0;

      // Calculate PC Sum for this development
      const devKitchenOptions = kitchenOptionsMap.get(dev.id);
      const pcSumConfig: PCsumConfig = {
        kitchen4Bed: devKitchenOptions?.pc_sum_kitchen_4bed ?? 7500,
        kitchen3Bed: devKitchenOptions?.pc_sum_kitchen_3bed ?? 6500,
        kitchen2Bed: devKitchenOptions?.pc_sum_kitchen_2bed ?? 5000,
        wardrobes: devKitchenOptions?.pc_sum_wardrobes ?? 1000,
      };

      let devPcSumTotal = 0;
      let devPcSumKitchen = 0;
      let devPcSumWardrobes = 0;
      let decidedCount = 0;
      let takingOwnKitchen = 0;
      let takingOwnWardrobes = 0;

      devPrivate.forEach(u => {
        const bedrooms = u.beds || 3;
        const hasKitchen = u.pipeline?.kitchen_selected;
        const hasWardrobe = u.pipeline?.kitchen_wardrobes;
        
        if (hasKitchen !== null || hasWardrobe !== null) {
          decidedCount++;
        }
        if (hasKitchen === false) takingOwnKitchen++;
        if (hasWardrobe === false) takingOwnWardrobes++;
        
        const pcSum = calculatePCSum(bedrooms, hasKitchen, hasWardrobe, pcSumConfig);
        devPcSumKitchen += pcSum.pcSumKitchen;
        devPcSumWardrobes += pcSum.pcSumWardrobes;
        devPcSumTotal += pcSum.pcSumTotal;
      });

      developmentColors[dev.id] = colorPalette[idx % colorPalette.length];

      if (devUnits.length > 0) {
        developmentStats.push({
          id: dev.id,
          name: dev.name,
          code: dev.code,
          color: developmentColors[dev.id],
          totalUnits: devUnits.length,
          privateUnits: devPrivate.length,
          socialUnits: devSocial.length,
          sold,
          inProgress,
          available,
          revenue,
          avgPrice: avgPriceForDev,
          avgCycle,
          pcSumTotal: devPcSumTotal,
          pcSumKitchen: devPcSumKitchen,
          pcSumWardrobes: devPcSumWardrobes,
          adjustedRevenue: revenue + devPcSumTotal,
          decidedCount,
          takingOwnKitchen,
          takingOwnWardrobes,
        });
      }
    });

    // Accumulate PC Sum totals from all developments
    developmentStats.forEach(d => {
      totalPcSumDeductions += d.pcSumTotal;
      totalPcSumKitchen += d.pcSumKitchen;
      totalPcSumWardrobes += d.pcSumWardrobes;
      totalDecided += d.decidedCount;
      totalTakingOwnKitchen += d.takingOwnKitchen;
      totalTakingOwnWardrobes += d.takingOwnWardrobes;
    });

    // Update portfolio overview with PC Sum data
    portfolioOverview.totalPcSumDeductions = totalPcSumDeductions;
    portfolioOverview.totalPcSumKitchen = totalPcSumKitchen;
    portfolioOverview.totalPcSumWardrobes = totalPcSumWardrobes;
    portfolioOverview.adjustedRevenue = totalRevenue + totalPcSumDeductions;
    portfolioOverview.totalDecided = totalDecided;
    portfolioOverview.totalTakingOwnKitchen = totalTakingOwnKitchen;
    portfolioOverview.totalTakingOwnWardrobes = totalTakingOwnWardrobes;

    // ==========================================================================
    // SECTION 3: COMBINED SALES VELOCITY (by development per month)
    // ==========================================================================
    
    const velocityByDevMonth: Record<string, Record<string, number>> = {};
    
    pipelineUnits.forEach(u => {
      if (u.pipeline?.sale_type === 'social') return;
      const agreedDate = u.pipeline?.sale_agreed_date;
      if (agreedDate) {
        const monthKey = getMonthKey(agreedDate);
        const devId = u.developmentId;
        if (!velocityByDevMonth[monthKey]) velocityByDevMonth[monthKey] = {};
        if (!velocityByDevMonth[monthKey][devId]) velocityByDevMonth[monthKey][devId] = 0;
        velocityByDevMonth[monthKey][devId]++;
      }
    });

    const velocityTrend = Object.keys(velocityByDevMonth)
      .sort()
      .map(monthKey => {
        const entry: any = { month: formatMonth(monthKey + '-01') };
        let total = 0;
        developments?.forEach(dev => {
          entry[dev.id] = velocityByDevMonth[monthKey][dev.id] || 0;
          total += entry[dev.id];
        });
        entry.total = total;
        return entry;
      });

    // ==========================================================================
    // SECTION 4: COMBINED PIPELINE FUNNEL
    // ==========================================================================
    
    const stages = [
      { key: 'release_date', label: 'Released' },
      { key: 'sale_agreed_date', label: 'Sale Agreed' },
      { key: 'deposit_date', label: 'Deposit' },
      { key: 'contracts_issued_date', label: 'Contracts Issued' },
      { key: 'signed_contracts_date', label: 'Contracts Signed' },
      { key: 'handover_date', label: 'Complete' },
    ];

    const funnel = stages.map(s => {
      const count = privateUnits.filter(u => u.pipeline?.[s.key]).length;
      return {
        stage: s.key,
        label: s.label,
        count,
        percentage: privateUnits.length > 0 ? Math.round((count / privateUnits.length) * 100) : 0,
      };
    });

    // ==========================================================================
    // SECTION 5: REVENUE BY DEVELOPMENT (for pie chart)
    // ==========================================================================
    
    const revenueByDevelopment = developmentStats.map(d => ({
      id: d.id,
      name: d.name,
      revenue: d.revenue,
      color: d.color,
      percentage: totalRevenue > 0 ? Math.round((d.revenue / totalRevenue) * 100) : 0,
    }));

    // ==========================================================================
    // SECTION 6: PRICE COMPARISON BY HOUSE TYPE
    // ==========================================================================
    
    const priceByTypeAndDev: Record<string, Record<string, number[]>> = {};
    
    privateUnits.forEach(u => {
      const typeKey = u.beds ? `${u.beds} Bed` : u.type;
      const devId = u.developmentId;
      const price = parsePrice(u.pipeline?.sale_price);
      if (price > 0) {
        if (!priceByTypeAndDev[typeKey]) priceByTypeAndDev[typeKey] = {};
        if (!priceByTypeAndDev[typeKey][devId]) priceByTypeAndDev[typeKey][devId] = [];
        priceByTypeAndDev[typeKey][devId].push(price);
      }
    });

    const priceComparison = Object.entries(priceByTypeAndDev).map(([type, devPrices]) => {
      const row: any = { type };
      let allPrices: number[] = [];
      developments?.forEach(dev => {
        const prices = devPrices[dev.id] || [];
        row[dev.id] = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
        allPrices = allPrices.concat(prices);
      });
      row.overallAvg = allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : null;
      return row;
    }).sort((a, b) => {
      const aNum = parseInt(a.type) || 99;
      const bNum = parseInt(b.type) || 99;
      return aNum - bNum;
    });

    // ==========================================================================
    // SECTION 7: CASH FLOW PROJECTION (combined)
    // ==========================================================================
    
    const cashFlowByMonth: Record<string, Record<string, number>> = {};
    
    privateUnits.forEach(u => {
      const handoverDate = u.pipeline?.handover_date;
      const drawdownDate = u.pipeline?.drawdown_date;
      const price = parsePrice(u.pipeline?.sale_price);
      
      if (price > 0) {
        const dateToUse = handoverDate || drawdownDate;
        if (dateToUse) {
          const monthKey = getMonthKey(dateToUse);
          const devId = u.developmentId;
          if (!cashFlowByMonth[monthKey]) cashFlowByMonth[monthKey] = {};
          if (!cashFlowByMonth[monthKey][devId]) cashFlowByMonth[monthKey][devId] = 0;
          cashFlowByMonth[monthKey][devId] += price;
        }
      }
    });

    const cashFlowProjection = Object.keys(cashFlowByMonth)
      .sort()
      .map(monthKey => {
        const entry: any = { month: formatMonth(monthKey + '-01') };
        let total = 0;
        developments?.forEach(dev => {
          entry[dev.id] = cashFlowByMonth[monthKey][dev.id] || 0;
          total += entry[dev.id];
        });
        entry.total = total;
        return entry;
      });

    // ==========================================================================
    // SECTION 8: SOCIAL HOUSING SUMMARY
    // ==========================================================================
    
    const socialSummary: any[] = [];
    
    developments?.forEach(dev => {
      const devSocialUnits = socialUnits.filter(u => u.developmentId === dev.id);
      if (devSocialUnits.length > 0) {
        const agencies = Array.from(new Set(devSocialUnits.map(u => u.pipeline?.housing_agency).filter(Boolean)));
        const complete = devSocialUnits.filter(u => u.pipeline?.handover_date).length;
        
        socialSummary.push({
          developmentId: dev.id,
          developmentName: dev.name,
          socialUnits: devSocialUnits.length,
          housingAgency: agencies.join(', ') || 'Not specified',
          complete,
          status: complete === devSocialUnits.length ? 'Complete' : 'In Progress',
        });
      }
    });

    // ==========================================================================
    // SECTION 9: ALERTS & ATTENTION ITEMS
    // ==========================================================================
    
    const stuckUnits: any[] = [];
    const openQueries: any[] = [];
    const upcomingHandovers: any[] = [];
    
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    privateUnits.forEach(u => {
      const dev = developmentMap.get(u.developmentId);
      const p = u.pipeline;
      
      // Stuck units (no progress in 30+ days)
      if (p?.updated_at) {
        const daysSinceUpdate = daysBetween(p.updated_at, now.toISOString());
        if (daysSinceUpdate && daysSinceUpdate > 30 && !p.handover_date) {
          stuckUnits.push({
            id: u.id,
            unitNumber: u.unitNumber,
            developmentName: dev?.name || 'Unknown',
            daysStuck: daysSinceUpdate,
            currentStage: getCurrentStage(p),
            purchaserName: p.purchaser_name,
          });
        }
      }

      // Open queries
      if (p?.queries_raised_date && !p?.queries_replied_date) {
        const daysOpen = daysBetween(p.queries_raised_date, now.toISOString());
        openQueries.push({
          id: u.id,
          unitNumber: u.unitNumber,
          developmentName: dev?.name || 'Unknown',
          daysOpen,
          purchaserName: p.purchaser_name,
        });
      }

      // Upcoming handovers
      if (p?.drawdown_date && !p?.handover_date) {
        const drawdownDate = new Date(p.drawdown_date);
        if (drawdownDate >= now && drawdownDate <= thirtyDaysFromNow) {
          upcomingHandovers.push({
            id: u.id,
            unitNumber: u.unitNumber,
            developmentName: dev?.name || 'Unknown',
            expectedDate: p.drawdown_date,
            purchaserName: p.purchaser_name,
            price: parsePrice(p.sale_price),
          });
        }
      }
    });

    // Sort alerts
    stuckUnits.sort((a, b) => b.daysStuck - a.daysStuck);
    openQueries.sort((a, b) => (b.daysOpen || 0) - (a.daysOpen || 0));
    upcomingHandovers.sort((a, b) => new Date(a.expectedDate).getTime() - new Date(b.expectedDate).getTime());

    const alerts = {
      stuckUnits: stuckUnits.slice(0, 10),
      openQueries: openQueries.slice(0, 10),
      upcomingHandovers: upcomingHandovers.slice(0, 10),
      totalStuck: stuckUnits.length,
      totalOpenQueries: openQueries.length,
      totalUpcoming: upcomingHandovers.length,
    };

    // ==========================================================================
    // SECTION 10: PERFORMANCE BENCHMARKS
    // ==========================================================================
    
    const benchmarks: any[] = [];
    const metricKeys = ['avgDaysToAgreed', 'avgDaysToComplete', 'queryResponseTime', 'completionRate'];
    const metricLabels: Record<string, string> = {
      avgDaysToAgreed: 'Avg Days to Agreed',
      avgDaysToComplete: 'Avg Days to Complete',
      queryResponseTime: 'Query Response Time',
      completionRate: 'Completion Rate',
    };

    const devMetrics: Record<string, Record<string, number>> = {};

    developments?.forEach(dev => {
      const devUnits = privateUnits.filter(u => u.developmentId === dev.id);
      devMetrics[dev.id] = {};

      // Avg days to agreed
      const daysToAgreed: number[] = [];
      devUnits.forEach(u => {
        const days = daysBetween(u.pipeline?.release_date, u.pipeline?.sale_agreed_date);
        if (days !== null && days >= 0) daysToAgreed.push(days);
      });
      devMetrics[dev.id].avgDaysToAgreed = daysToAgreed.length > 0 
        ? Math.round(daysToAgreed.reduce((a, b) => a + b, 0) / daysToAgreed.length) 
        : 0;

      // Avg days to complete
      const daysToComplete: number[] = [];
      devUnits.forEach(u => {
        const days = daysBetween(u.pipeline?.release_date, u.pipeline?.handover_date);
        if (days !== null && days >= 0) daysToComplete.push(days);
      });
      devMetrics[dev.id].avgDaysToComplete = daysToComplete.length > 0 
        ? Math.round(daysToComplete.reduce((a, b) => a + b, 0) / daysToComplete.length) 
        : 0;

      // Query response time
      const queryTimes: number[] = [];
      devUnits.forEach(u => {
        const days = daysBetween(u.pipeline?.queries_raised_date, u.pipeline?.queries_replied_date);
        if (days !== null && days >= 0) queryTimes.push(days);
      });
      devMetrics[dev.id].queryResponseTime = queryTimes.length > 0 
        ? Math.round((queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length) * 10) / 10 
        : 0;

      // Completion rate
      const completed = devUnits.filter(u => u.pipeline?.handover_date).length;
      devMetrics[dev.id].completionRate = devUnits.length > 0 
        ? Math.round((completed / devUnits.length) * 100) 
        : 0;
    });

    metricKeys.forEach(metricKey => {
      const row: any = { metric: metricLabels[metricKey] };
      let bestValue = metricKey === 'completionRate' ? 0 : Infinity;
      let bestDev = '';

      developments?.forEach(dev => {
        const value = devMetrics[dev.id][metricKey];
        row[dev.id] = value;

        if (metricKey === 'completionRate') {
          if (value > bestValue) {
            bestValue = value;
            bestDev = dev.name;
          }
        } else {
          if (value > 0 && value < bestValue) {
            bestValue = value;
            bestDev = dev.name;
          }
        }
      });

      row.best = bestDev;
      benchmarks.push(row);
    });

    return NextResponse.json({
      portfolioOverview,
      developments: developmentStats,
      developmentColors,
      velocityTrend,
      funnel,
      revenueByDevelopment,
      priceComparison,
      cashFlowProjection,
      socialSummary,
      alerts,
      benchmarks,
    });

  } catch (error) {
    console.error('[Portfolio Analytics API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function getCurrentStage(pipeline: any): string {
  const stages = [
    { key: 'handover_date', label: 'Complete' },
    { key: 'drawdown_date', label: 'Drawdown' },
    { key: 'snag_date', label: 'Snag' },
    { key: 'kitchen_date', label: 'Kitchen' },
    { key: 'counter_signed_date', label: 'Counter-Signed' },
    { key: 'signed_contracts_date', label: 'Contracts Signed' },
    { key: 'contracts_issued_date', label: 'Contracts Issued' },
    { key: 'deposit_date', label: 'Deposit' },
    { key: 'sale_agreed_date', label: 'Sale Agreed' },
    { key: 'release_date', label: 'Released' },
  ];

  for (const stage of stages) {
    if (pipeline[stage.key]) return stage.label;
  }
  return 'Not Started';
}
