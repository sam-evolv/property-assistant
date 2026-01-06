import { NextRequest, NextResponse } from 'next/server';
import { runTestSuite, getTestSuite, runSingleTest } from '@/scripts/run-assistant-tests';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'suite';
    
    if (action === 'suite') {
      const suite = getTestSuite();
      return NextResponse.json(suite);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API] Error fetching test suite:', error);
    return NextResponse.json({ error: 'Failed to fetch test suite' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { schemeId, action, categories, testIds, unitId } = body;
    
    if (!schemeId) {
      return NextResponse.json({ error: 'schemeId is required' }, { status: 400 });
    }
    
    if (action === 'run_single' && testIds?.length === 1) {
      const suite = getTestSuite();
      const testCase = suite.tests.find(t => t.id === testIds[0]);
      
      if (!testCase) {
        return NextResponse.json({ error: 'Test case not found' }, { status: 404 });
      }
      
      const result = await runSingleTest(schemeId, testCase, unitId);
      return NextResponse.json({ result });
    }
    
    const scorecard = await runTestSuite(schemeId, {
      categories,
      testIds,
      unitId,
      concurrency: 2,
    });
    
    return NextResponse.json({ scorecard });
  } catch (error) {
    console.error('[API] Error running tests:', error);
    return NextResponse.json({ error: 'Failed to run tests' }, { status: 500 });
  }
}
