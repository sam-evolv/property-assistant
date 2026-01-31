/**
 * Sales Pipeline Analytics API
 * GET /api/pipeline/[developmentId]/analytics
 * Returns comprehensive analytics for sales pipeline
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

interface StageMetric {
  stage: string;
  label: string;
  avgDays: number;
  count: number;
}

interface VelocityPoint {
  month: string;
  count: number;
  revenue: number;
}

interface UnitSale {
  unitNumber: string;
  purchaserName: string | null;
  days: number;
}

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

interface AttentionUnit {
  id: string;
  unitNumber: string;
  currentStage: string;
  daysAtStage: number;
  lastActivity: string | null;
  purchaserName: string | null;
}

interface PropertyTypeMetric {
  type: string;
  typeName: string;
  beds: number;
  units: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalRevenue: number;
  avgSqFt: number | null;
  avgPricePerSqFt: number | null;
}

interface UpcomingHandover {
  period: string;
  units: number;
  projectedRevenue: number;
  unitList: { unitNumber: string; purchaserName: string | null; date: string; price: number | null }[];
}

interface CashFlowPoint {
  month: string;
  completed: number;
  projected: number;
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ developmentId: string }> }
) {
  try {
    const { developmentId } = await params;
    const session = await requireRole(['developer', 'admin', 'super_admin']);
    const { tenantId } = session;

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch all units with pipeline data for this development
    const { data: units, error: unitsError } = await supabaseAdmin
      .from('units')
      .select(`
        id,
        unit_number,
        address_line_1,
        property_type,
        bedrooms,
        square_footage,
        unit_sales_pipeline (
          id,
          sale_type,
          sale_price,
          status,
          purchaser_name,
          release_date,
          sale_agreed_date,
          deposit_date,
          contracts_issued_date,
          queries_raised_date,
          queries_replied_date,
          signed_contracts_date,
          counter_signed_date,
          kitchen_date,
          snag_date,
          drawdown_date,
          handover_date,
          estimated_close_date,
          updated_at
        )
      `)
      .eq('tenant_id', tenantId)
      .or(`development_id.eq.${developmentId},project_id.eq.${developmentId}`)
      .order('unit_number');

    if (unitsError) {
      console.error('[Analytics API] Error fetching units:', unitsError);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    // Process pipeline data
    const pipelineUnits = (units || []).map(u => ({
      id: u.id,
      unitNumber: u.unit_number,
      type: u.property_type,
      beds: u.bedrooms ? Number(u.bedrooms) : null,
      floorArea: u.square_footage ? Number(u.square_footage) : null,
      pipeline: Array.isArray(u.unit_sales_pipeline) ? u.unit_sales_pipeline[0] : u.unit_sales_pipeline,
    })).filter(u => u.pipeline);

    const privateUnits = pipelineUnits.filter(u => u.pipeline?.sale_type !== 'social');
    const socialUnits = pipelineUnits.filter(u => u.pipeline?.sale_type === 'social');
    const now = new Date();

    // ==========================================================================
    // SECTION 1: SALES VELOCITY & TIMING
    // ==========================================================================

    // Average Sales Cycle per stage
    const stageMetrics: StageMetric[] = [
      { stage: 'releaseToAgreed', label: 'Release → Agreed', avgDays: 0, count: 0 },
      { stage: 'agreedToDeposit', label: 'Agreed → Deposit', avgDays: 0, count: 0 },
      { stage: 'depositToContracts', label: 'Deposit → Contracts', avgDays: 0, count: 0 },
      { stage: 'contractsToQueries', label: 'Contracts → Queries', avgDays: 0, count: 0 },
      { stage: 'queriesToSigned', label: 'Queries → Signed', avgDays: 0, count: 0 },
      { stage: 'signedToCounter', label: 'Signed → Counter', avgDays: 0, count: 0 },
      { stage: 'counterToHandover', label: 'Counter → Handover', avgDays: 0, count: 0 },
    ];

    const stagePairs: [string, string, number][] = [
      ['release_date', 'sale_agreed_date', 0],
      ['sale_agreed_date', 'deposit_date', 1],
      ['deposit_date', 'contracts_issued_date', 2],
      ['contracts_issued_date', 'queries_raised_date', 3],
      ['queries_replied_date', 'signed_contracts_date', 4],
      ['signed_contracts_date', 'counter_signed_date', 5],
      ['counter_signed_date', 'handover_date', 6],
    ];

    const stageDurations: number[][] = stagePairs.map(() => []);

    privateUnits.forEach(u => {
      const p = u.pipeline;
      stagePairs.forEach(([start, end], idx) => {
        const days = daysBetween(p[start], p[end]);
        if (days !== null && days >= 0) {
          stageDurations[idx].push(days);
        }
      });
    });

    stageDurations.forEach((durations, idx) => {
      if (durations.length > 0) {
        stageMetrics[idx].avgDays = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
        stageMetrics[idx].count = durations.length;
      }
    });

    // Total cycle (release to handover)
    const totalCycles: number[] = [];
    privateUnits.forEach(u => {
      const days = daysBetween(u.pipeline.release_date, u.pipeline.handover_date);
      if (days !== null && days >= 0) totalCycles.push(days);
    });
    const totalCycleAvg = totalCycles.length > 0 ? Math.round(totalCycles.reduce((a, b) => a + b, 0) / totalCycles.length) : 0;

    // Helper to safely parse sale price (stored as DECIMAL string like "475000.00")
    const parsePrice = (price: any): number => {
      if (price === null || price === undefined) return 0;
      const parsed = parseFloat(String(price));
      return isNaN(parsed) ? 0 : parsed;
    };

    // Sales Velocity Trend (units agreed per month)
    const velocityByMonth: Record<string, { count: number; revenue: number }> = {};
    privateUnits.forEach(u => {
      const agreedDate = u.pipeline.sale_agreed_date;
      if (agreedDate) {
        const key = getMonthKey(agreedDate);
        if (!velocityByMonth[key]) velocityByMonth[key] = { count: 0, revenue: 0 };
        velocityByMonth[key].count++;
        velocityByMonth[key].revenue += parsePrice(u.pipeline.sale_price);
      }
    });

    const velocityTrend: VelocityPoint[] = Object.keys(velocityByMonth)
      .sort()
      .map(key => ({
        month: formatMonth(key + '-01'),
        count: velocityByMonth[key].count,
        revenue: velocityByMonth[key].revenue,
      }));

    // Fastest & Slowest Sales
    const releaseToAgreed: { unit: any; days: number }[] = [];
    const releaseToHandover: { unit: any; days: number }[] = [];

    privateUnits.forEach(u => {
      const daysToAgreed = daysBetween(u.pipeline.release_date, u.pipeline.sale_agreed_date);
      if (daysToAgreed !== null && daysToAgreed >= 0) {
        releaseToAgreed.push({ unit: u, days: daysToAgreed });
      }
      const daysToHandover = daysBetween(u.pipeline.release_date, u.pipeline.handover_date);
      if (daysToHandover !== null && daysToHandover >= 0) {
        releaseToHandover.push({ unit: u, days: daysToHandover });
      }
    });

    releaseToAgreed.sort((a, b) => a.days - b.days);
    releaseToHandover.sort((a, b) => a.days - b.days);

    const fastestSale = releaseToAgreed[0] ? { unitNumber: releaseToAgreed[0].unit.unitNumber, purchaserName: releaseToAgreed[0].unit.pipeline.purchaser_name, days: releaseToAgreed[0].days } : null;
    const slowestSale = releaseToAgreed[releaseToAgreed.length - 1] ? { unitNumber: releaseToAgreed[releaseToAgreed.length - 1].unit.unitNumber, purchaserName: releaseToAgreed[releaseToAgreed.length - 1].unit.pipeline.purchaser_name, days: releaseToAgreed[releaseToAgreed.length - 1].days } : null;
    const fastestCompletion = releaseToHandover[0] ? { unitNumber: releaseToHandover[0].unit.unitNumber, purchaserName: releaseToHandover[0].unit.pipeline.purchaser_name, days: releaseToHandover[0].days } : null;
    const slowestCompletion = releaseToHandover[releaseToHandover.length - 1] ? { unitNumber: releaseToHandover[releaseToHandover.length - 1].unit.unitNumber, purchaserName: releaseToHandover[releaseToHandover.length - 1].unit.pipeline.purchaser_name, days: releaseToHandover[releaseToHandover.length - 1].days } : null;

    // ==========================================================================
    // SECTION 2: PIPELINE HEALTH
    // ==========================================================================

    // Sales Funnel (current state)
    const funnel: FunnelStage[] = [
      { stage: 'released', label: 'Released', count: privateUnits.filter(u => u.pipeline.release_date).length, percentage: 0 },
      { stage: 'agreed', label: 'Agreed', count: privateUnits.filter(u => u.pipeline.sale_agreed_date).length, percentage: 0 },
      { stage: 'deposit', label: 'Deposit', count: privateUnits.filter(u => u.pipeline.deposit_date).length, percentage: 0 },
      { stage: 'contracts', label: 'Contracts Issued', count: privateUnits.filter(u => u.pipeline.contracts_issued_date).length, percentage: 0 },
      { stage: 'signed', label: 'Signed', count: privateUnits.filter(u => u.pipeline.signed_contracts_date).length, percentage: 0 },
      { stage: 'counter', label: 'Counter Signed', count: privateUnits.filter(u => u.pipeline.counter_signed_date).length, percentage: 0 },
      { stage: 'complete', label: 'Handover Complete', count: privateUnits.filter(u => u.pipeline.handover_date).length, percentage: 0 },
    ];

    const maxFunnel = Math.max(funnel[0].count, 1);
    funnel.forEach(f => { f.percentage = Math.round((f.count / maxFunnel) * 100); });

    // Bottleneck Analysis - which stage has longest average wait
    const bottleneck = stageMetrics.reduce((max, curr) => curr.avgDays > max.avgDays ? curr : max, stageMetrics[0]);

    // Units Needing Attention
    const attentionUnits: AttentionUnit[] = [];

    privateUnits.forEach(u => {
      const p = u.pipeline;
      let currentStage = 'Unknown';
      let stageDate: string | null = null;

      // Determine current stage
      if (p.handover_date) { currentStage = 'Complete'; stageDate = p.handover_date; }
      else if (p.counter_signed_date) { currentStage = 'Counter Signed'; stageDate = p.counter_signed_date; }
      else if (p.signed_contracts_date) { currentStage = 'Signed'; stageDate = p.signed_contracts_date; }
      else if (p.contracts_issued_date) { currentStage = 'Contracts Issued'; stageDate = p.contracts_issued_date; }
      else if (p.deposit_date) { currentStage = 'Deposit Paid'; stageDate = p.deposit_date; }
      else if (p.sale_agreed_date) { currentStage = 'Sale Agreed'; stageDate = p.sale_agreed_date; }
      else if (p.release_date) { currentStage = 'Released'; stageDate = p.release_date; }

      if (stageDate && currentStage !== 'Complete') {
        const daysAtStage = daysBetween(stageDate, now.toISOString()) || 0;
        // Flag if at stage for > 30 days, or queries not replied > 7 days
        const queriesUnreplied = p.queries_raised_date && !p.queries_replied_date;
        const queriesDays = queriesUnreplied ? daysBetween(p.queries_raised_date, now.toISOString()) : 0;

        if (daysAtStage > 30 || (queriesUnreplied && (queriesDays || 0) > 7)) {
          attentionUnits.push({
            id: u.id,
            unitNumber: u.unitNumber,
            currentStage,
            daysAtStage,
            lastActivity: p.updated_at,
            purchaserName: p.purchaser_name,
          });
        }
      }
    });

    attentionUnits.sort((a, b) => b.daysAtStage - a.daysAtStage);

    // Queries Performance
    const queriesRaised = privateUnits.filter(u => u.pipeline.queries_raised_date).length;
    const queriesResolved = privateUnits.filter(u => u.pipeline.queries_raised_date && u.pipeline.queries_replied_date).length;
    const openQueries = queriesRaised - queriesResolved;

    const responseTimes: number[] = [];
    privateUnits.forEach(u => {
      const days = daysBetween(u.pipeline.queries_raised_date, u.pipeline.queries_replied_date);
      if (days !== null && days >= 0) responseTimes.push(days);
    });

    const avgResponseTime = responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1) : null;
    const fastestResponse = responseTimes.length > 0 ? Math.min(...responseTimes) : null;
    const slowestResponse = responseTimes.length > 0 ? Math.max(...responseTimes) : null;
    const sameDayResponses = responseTimes.filter(d => d === 0).length;

    // ==========================================================================
    // SECTION 3: REVENUE & PRICING
    // ==========================================================================

    const soldUnits = privateUnits.filter(u => u.pipeline.handover_date && parsePrice(u.pipeline.sale_price) > 0);
    const agreedNotComplete = privateUnits.filter(u => u.pipeline.sale_agreed_date && !u.pipeline.handover_date && parsePrice(u.pipeline.sale_price) > 0);

    const totalRevenueSold = soldUnits.reduce((sum, u) => sum + parsePrice(u.pipeline.sale_price), 0);
    const projectedRevenue = agreedNotComplete.reduce((sum, u) => sum + parsePrice(u.pipeline.sale_price), 0);
    const totalPortfolioValue = totalRevenueSold + projectedRevenue;

    // Price by Property Type
    const typeGroups: Record<string, { units: any[]; prices: number[]; sqFts: number[] }> = {};
    privateUnits.forEach(u => {
      const price = parsePrice(u.pipeline.sale_price);
      if (price > 0) {
        const typeKey = u.type || 'Unknown';
        if (!typeGroups[typeKey]) typeGroups[typeKey] = { units: [], prices: [], sqFts: [] };
        typeGroups[typeKey].units.push(u);
        typeGroups[typeKey].prices.push(price);
        if (u.floorArea) typeGroups[typeKey].sqFts.push(u.floorArea);
      }
    });

    const priceByType: PropertyTypeMetric[] = Object.keys(typeGroups).map(type => {
      const g = typeGroups[type];
      const avgPrice = Math.round(g.prices.reduce((a, b) => a + b, 0) / g.prices.length);
      const avgSqFt = g.sqFts.length > 0 ? Math.round(g.sqFts.reduce((a, b) => a + b, 0) / g.sqFts.length) : null;
      const beds = g.units[0]?.beds || 0;
      return {
        type,
        typeName: `${beds} Bed (${type})`,
        beds,
        units: g.units.length,
        avgPrice,
        minPrice: Math.min(...g.prices),
        maxPrice: Math.max(...g.prices),
        totalRevenue: g.prices.reduce((a, b) => a + b, 0),
        avgSqFt,
        avgPricePerSqFt: avgSqFt ? Math.round(avgPrice / avgSqFt) : null,
      };
    }).sort((a, b) => b.units - a.units);

    // Overall price per sq ft
    const allPrices = privateUnits.filter(u => parsePrice(u.pipeline.sale_price) > 0).map(u => parsePrice(u.pipeline.sale_price));
    const allSqFts = privateUnits.filter(u => u.floorArea).map(u => u.floorArea);
    const overallAvgPrice = allPrices.length > 0 ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : 0;
    const overallAvgSqFt = allSqFts.length > 0 ? Math.round(allSqFts.reduce((a, b) => a + b, 0) / allSqFts.length) : null;
    const overallPricePerSqFt = overallAvgSqFt && overallAvgPrice ? Math.round(overallAvgPrice / overallAvgSqFt) : null;

    // ==========================================================================
    // SECTION 4: FORECASTING
    // ==========================================================================

    // Upcoming Handovers
    const thisMonth = new Date();
    const nextMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 1);
    const threeMonths = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 3, 1);

    const upcomingHandovers: UpcomingHandover[] = [
      { period: 'This Month', units: 0, projectedRevenue: 0, unitList: [] },
      { period: 'Next Month', units: 0, projectedRevenue: 0, unitList: [] },
      { period: 'Next 3 Months', units: 0, projectedRevenue: 0, unitList: [] },
    ];

    privateUnits.forEach(u => {
      const handoverDate = u.pipeline.estimated_close_date || u.pipeline.handover_date;
      if (!handoverDate || u.pipeline.handover_date) return; // Skip already completed

      const d = new Date(handoverDate);
      const price = parsePrice(u.pipeline.sale_price);
      const unitInfo = {
        unitNumber: u.unitNumber,
        purchaserName: u.pipeline.purchaser_name,
        date: handoverDate,
        price: price > 0 ? price : null,
      };

      if (d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear()) {
        upcomingHandovers[0].units++;
        upcomingHandovers[0].projectedRevenue += price;
        upcomingHandovers[0].unitList.push(unitInfo);
      } else if (d.getMonth() === nextMonth.getMonth() && d.getFullYear() === nextMonth.getFullYear()) {
        upcomingHandovers[1].units++;
        upcomingHandovers[1].projectedRevenue += price;
        upcomingHandovers[1].unitList.push(unitInfo);
      }
      if (d < threeMonths) {
        upcomingHandovers[2].units++;
        upcomingHandovers[2].projectedRevenue += price;
        upcomingHandovers[2].unitList.push(unitInfo);
      }
    });

    // Cash Flow Projection (by month)
    const cashFlowByMonth: Record<string, { completed: number; projected: number }> = {};

    privateUnits.forEach(u => {
      const handoverDate = u.pipeline.handover_date;
      const estDate = u.pipeline.estimated_close_date;
      const price = parsePrice(u.pipeline.sale_price);

      if (handoverDate) {
        const key = getMonthKey(handoverDate);
        if (!cashFlowByMonth[key]) cashFlowByMonth[key] = { completed: 0, projected: 0 };
        cashFlowByMonth[key].completed += price;
      } else if (estDate) {
        const key = getMonthKey(estDate);
        if (!cashFlowByMonth[key]) cashFlowByMonth[key] = { completed: 0, projected: 0 };
        cashFlowByMonth[key].projected += price;
      }
    });

    const cashFlowTrend: CashFlowPoint[] = Object.keys(cashFlowByMonth)
      .sort()
      .map(key => ({
        month: formatMonth(key + '-01'),
        completed: cashFlowByMonth[key].completed,
        projected: cashFlowByMonth[key].projected,
      }));

    // ==========================================================================
    // Build Response
    // ==========================================================================

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          totalUnits: pipelineUnits.length,
          privateUnits: privateUnits.length,
          socialUnits: socialUnits.length,
          unitsWithPrice: privateUnits.filter(u => parsePrice(u.pipeline.sale_price) > 0).length,
          completedUnits: soldUnits.length,
          inProgress: privateUnits.length - soldUnits.length,
        },
        velocity: {
          stageMetrics,
          totalCycleAvg,
          totalCycleCount: totalCycles.length,
          velocityTrend,
          fastestSale,
          slowestSale,
          fastestCompletion,
          slowestCompletion,
        },
        pipelineHealth: {
          funnel,
          bottleneck: {
            stage: bottleneck.label,
            avgDays: bottleneck.avgDays,
          },
          attentionUnits: attentionUnits.slice(0, 10),
          queries: {
            total: queriesRaised,
            resolved: queriesResolved,
            open: openQueries,
            avgResponseTime,
            fastestResponse,
            slowestResponse,
            sameDayResponses,
          },
        },
        revenue: {
          totalRevenueSold,
          projectedRevenue,
          totalPortfolioValue,
          priceByType,
          overallStats: {
            avgPrice: overallAvgPrice,
            avgSqFt: overallAvgSqFt,
            pricePerSqFt: overallPricePerSqFt,
          },
        },
        forecasting: {
          upcomingHandovers,
          cashFlowTrend,
        },
      },
    });
  } catch (error) {
    console.error('[Analytics API] Error:', error);
    return NextResponse.json({ error: 'Failed to calculate analytics' }, { status: 500 });
  }
}
