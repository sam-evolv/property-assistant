import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/supabase-server';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin']);
    const supabaseAdmin = getSupabaseAdmin();

    // Fetch question analytics if table exists
    let questionAnalytics: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('question_analytics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      questionAnalytics = data || [];
    } catch (e) {
      // Table may not exist yet
    }

    // Fetch units count
    let totalUnits = 1;
    try {
      const { count } = await supabaseAdmin
        .from('units')
        .select('*', { count: 'exact', head: true });
      totalUnits = count || 1;
    } catch (e) {}

    // Fetch developments for reference
    let developments: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('developments')
        .select('id, name, address');
      developments = data || [];
    } catch (e) {}

    // Fetch platform insights if table exists
    let platformInsights: any[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('platform_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      platformInsights = data || [];
    } catch (e) {}

    // Calculate metrics from actual data
    const totalQuestions = questionAnalytics.length;
    const avgPerUnit = totalUnits > 0 ? totalQuestions / totalUnits : 0;

    // Calculate satisfaction rate from actual data
    const ratedQuestions = questionAnalytics.filter(q => q.satisfaction_score != null);
    const satisfiedCount = ratedQuestions.filter(q => q.satisfaction_score >= 4).length;
    const satisfactionRate = ratedQuestions.length > 0 
      ? Math.round((satisfiedCount / ratedQuestions.length) * 100) 
      : 0;

    // Count unique users
    const uniqueUsers = new Set(questionAnalytics.filter(q => q.user_id).map(q => q.user_id)).size;

    // Calculate trend from actual data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentQuestions = questionAnalytics.filter(q => 
      new Date(q.created_at) > thirtyDaysAgo
    ).length;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    const previousPeriodQuestions = questionAnalytics.filter(q => {
      const date = new Date(q.created_at);
      return date > sixtyDaysAgo && date <= thirtyDaysAgo;
    }).length;

    const questionsTrend = previousPeriodQuestions > 0 
      ? Math.round(((recentQuestions - previousPeriodQuestions) / previousPeriodQuestions) * 100)
      : 0;

    // Aggregate topics from actual data
    const topicCounts: Record<string, { count: number; recent: number; previous: number }> = {};
    questionAnalytics.forEach(q => {
      const topic = q.topic || 'General';
      if (!topicCounts[topic]) {
        topicCounts[topic] = { count: 0, recent: 0, previous: 0 };
      }
      topicCounts[topic].count++;
      
      const date = new Date(q.created_at);
      if (date > thirtyDaysAgo) {
        topicCounts[topic].recent++;
      } else if (date > sixtyDaysAgo) {
        topicCounts[topic].previous++;
      }
    });

    const topics = Object.entries(topicCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([topic, data]) => {
        const change = data.previous > 0 
          ? Math.round(((data.recent - data.previous) / data.previous) * 100)
          : data.recent > 0 ? 100 : 0;
        return {
          topic,
          count: data.count,
          trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable' as 'up' | 'down' | 'stable',
          change: Math.abs(change),
        };
      });

    // Aggregate trending questions from actual data
    const questionCounts: Record<string, { count: number; developments: Set<string> }> = {};
    questionAnalytics.forEach(q => {
      const question = q.question?.toLowerCase().trim() || '';
      if (question.length > 10) {
        if (!questionCounts[question]) {
          questionCounts[question] = { count: 0, developments: new Set() };
        }
        questionCounts[question].count++;
        const dev = developments.find(d => d.id === q.development_id);
        if (dev) questionCounts[question].developments.add(dev.name);
      }
    });

    const trending = Object.entries(questionCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([question, data]) => ({
        question: question.charAt(0).toUpperCase() + question.slice(1),
        count: data.count,
        developments: Array.from(data.developments),
      }));

    // Aggregate regional data from actual developments
    const regionCounts: Record<string, { questions: number; developments: Set<string>; units: number }> = {};
    developments.forEach(dev => {
      // Extract county from address if available
      const address = dev.address || '';
      const countyMatch = address.match(/,\s*([^,]+)$/);
      const county = countyMatch ? countyMatch[1].trim() : 'Unknown';
      
      if (!regionCounts[county]) {
        regionCounts[county] = { questions: 0, developments: new Set(), units: 0 };
      }
      regionCounts[county].developments.add(dev.id);
    });

    // Count questions per region
    questionAnalytics.forEach(q => {
      const dev = developments.find(d => d.id === q.development_id);
      if (dev) {
        const address = dev.address || '';
        const countyMatch = address.match(/,\s*([^,]+)$/);
        const county = countyMatch ? countyMatch[1].trim() : 'Unknown';
        if (regionCounts[county]) {
          regionCounts[county].questions++;
        }
      }
    });

    const regional = Object.entries(regionCounts)
      .filter(([county]) => county !== 'Unknown')
      .map(([county, data]) => ({
        county,
        questions: data.questions,
        developments: data.developments.size,
        avgPerUnit: data.developments.size > 0 ? Math.round((data.questions / data.developments.size) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.questions - a.questions)
      .slice(0, 10);

    // Identify knowledge gaps from low-confidence responses
    const lowConfidenceTopics: Record<string, { count: number; totalConfidence: number }> = {};
    questionAnalytics.forEach(q => {
      if (q.confidence_score != null && q.confidence_score < 70) {
        const topic = q.topic || 'General';
        if (!lowConfidenceTopics[topic]) {
          lowConfidenceTopics[topic] = { count: 0, totalConfidence: 0 };
        }
        lowConfidenceTopics[topic].count++;
        lowConfidenceTopics[topic].totalConfidence += q.confidence_score;
      }
    });

    const gaps = Object.entries(lowConfidenceTopics)
      .map(([topic, data]) => ({
        topic,
        confidence: Math.round(data.totalConfidence / data.count),
        frequency: data.count,
        suggestion: `Consider adding more training data or custom Q&A pairs for ${topic.toLowerCase()} related questions.`,
      }))
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 5);

    // Format platform insights
    const insights = platformInsights.map(i => ({
      id: i.id,
      type: i.type || 'opportunity',
      title: i.title,
      description: i.description,
      created_at: i.created_at,
    }));

    return NextResponse.json({
      overview: {
        totalQuestions,
        avgPerUnit: Math.round(avgPerUnit * 10) / 10,
        satisfactionRate,
        activeUsers: uniqueUsers,
        questionsTrend,
      },
      topics,
      trending,
      regional,
      gaps,
      insights,
      hasData: totalQuestions > 0,
    });
  } catch (err) {
    console.error('Error fetching R&D analytics:', err);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
