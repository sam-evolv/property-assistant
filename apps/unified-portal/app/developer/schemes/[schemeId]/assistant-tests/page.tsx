'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface TestCase {
  id: string;
  category: string;
  question: string;
  expected_source: string;
  hallucination_risk: string;
  notes: string;
}

interface TestResult {
  test_id: string;
  question: string;
  category: string;
  passed: boolean;
  response_summary: string;
  actual_source: string | null;
  expected_source: string;
  confidence_score: number | null;
  hallucination_detected: boolean;
  escalation_correct: boolean;
  doc_usage_correct: boolean;
  safety_flag: boolean;
  response_time_ms: number;
  error?: string;
}

interface Scorecard {
  run_id: string;
  scheme_id: string;
  run_at: string;
  total_tests: number;
  passed: number;
  failed: number;
  pass_rate: number;
  metrics: {
    hallucination_risk_score: number;
    usefulness_score: number;
    escalation_correctness: number;
    doc_usage_correctness: number;
    safety_score: number;
    avg_response_time_ms: number;
  };
  by_category: Record<string, { total: number; passed: number; pass_rate: number }>;
  results: TestResult[];
}

export default function AssistantTestsPage() {
  const params = useParams();
  const schemeId = params.schemeId as string;
  
  const [suite, setSuite] = useState<{ tests: TestCase[]; categories: Record<string, string> } | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  
  useEffect(() => {
    fetchSuite();
  }, []);
  
  async function fetchSuite() {
    try {
      const res = await fetch('/developer/api/assistant-tests?action=suite');
      const data = await res.json();
      setSuite(data);
    } catch (error) {
      console.error('Failed to fetch test suite:', error);
    }
  }
  
  async function runTests() {
    setRunning(true);
    setScorecard(null);
    
    try {
      const res = await fetch('/developer/api/assistant-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId,
          categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        }),
      });
      
      const data = await res.json();
      setScorecard(data.scorecard);
    } catch (error) {
      console.error('Failed to run tests:', error);
    }
    
    setRunning(false);
  }
  
  function toggleCategory(category: string) {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  }
  
  function getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-yellow-500';
    if (score >= 50) return 'text-orange-500';
    return 'text-red-500';
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Assistant QA Test Suite</h1>
        <button
          onClick={runTests}
          disabled={running}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? 'Running Tests...' : 'Run Test Suite'}
        </button>
      </div>
      
      {suite && (
        <div className="bg-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Test Categories</h2>
          <p className="text-sm text-zinc-400 mb-3">
            Select categories to filter, or run all {suite.tests.length} tests.
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(suite.categories).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedCategories.includes(key)
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {scorecard && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Pass Rate</div>
              <div className={`text-2xl font-bold ${getScoreColor(scorecard.pass_rate)}`}>
                {scorecard.pass_rate.toFixed(1)}%
              </div>
              <div className="text-xs text-zinc-500">
                {scorecard.passed}/{scorecard.total_tests} passed
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Hallucination Safety</div>
              <div className={`text-2xl font-bold ${getScoreColor(scorecard.metrics.hallucination_risk_score)}`}>
                {scorecard.metrics.hallucination_risk_score.toFixed(1)}%
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Escalation</div>
              <div className={`text-2xl font-bold ${getScoreColor(scorecard.metrics.escalation_correctness)}`}>
                {scorecard.metrics.escalation_correctness.toFixed(1)}%
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Doc Usage</div>
              <div className={`text-2xl font-bold ${getScoreColor(scorecard.metrics.doc_usage_correctness)}`}>
                {scorecard.metrics.doc_usage_correctness.toFixed(1)}%
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Safety</div>
              <div className={`text-2xl font-bold ${getScoreColor(scorecard.metrics.safety_score)}`}>
                {scorecard.metrics.safety_score.toFixed(1)}%
              </div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="text-zinc-400 text-sm">Avg Response</div>
              <div className="text-2xl font-bold text-white">
                {(scorecard.metrics.avg_response_time_ms / 1000).toFixed(2)}s
              </div>
            </div>
          </div>
          
          <div className="bg-zinc-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-white mb-3">Results by Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(scorecard.by_category).map(([category, stats]) => (
                <div key={category} className="bg-zinc-700 rounded-lg p-3">
                  <div className="text-sm text-zinc-300 truncate">
                    {suite?.categories[category] || category}
                  </div>
                  <div className={`text-xl font-bold ${getScoreColor(stats.pass_rate)}`}>
                    {stats.pass_rate.toFixed(0)}%
                  </div>
                  <div className="text-xs text-zinc-500">
                    {stats.passed}/{stats.total} passed
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-700">
              <h2 className="text-lg font-semibold text-white">Test Results</h2>
            </div>
            <div className="divide-y divide-zinc-700">
              {scorecard.results.map((result) => (
                <div key={result.test_id} className="hover:bg-zinc-700/50">
                  <button
                    onClick={() => setExpandedResult(expandedResult === result.test_id ? null : result.test_id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                        result.passed ? 'bg-green-600' : 'bg-red-600'
                      }`}>
                        {result.passed ? '✓' : '✗'}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-zinc-700 rounded text-zinc-400">
                        {result.test_id}
                      </span>
                      <span className="flex-1 text-white truncate">{result.question}</span>
                      <span className="text-xs text-zinc-500">{result.response_time_ms}ms</span>
                    </div>
                  </button>
                  
                  {expandedResult === result.test_id && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="bg-zinc-900 rounded-lg p-3">
                        <div className="text-sm text-zinc-400 mb-1">Response:</div>
                        <div className="text-white text-sm">{result.response_summary}</div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className={`p-2 rounded ${result.hallucination_detected ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                          Hallucination: {result.hallucination_detected ? 'Detected' : 'None'}
                        </div>
                        <div className={`p-2 rounded ${result.escalation_correct ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          Escalation: {result.escalation_correct ? 'Correct' : 'Incorrect'}
                        </div>
                        <div className={`p-2 rounded ${result.doc_usage_correct ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          Doc Usage: {result.doc_usage_correct ? 'Correct' : 'Incorrect'}
                        </div>
                        <div className={`p-2 rounded ${result.safety_flag ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                          Safety: {result.safety_flag ? 'Passed' : 'Failed'}
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-zinc-400">
                        <span>Expected: {result.expected_source}</span>
                        <span>Actual: {result.actual_source || 'unknown'}</span>
                        {result.confidence_score && (
                          <span>Confidence: {(result.confidence_score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      {result.error && (
                        <div className="text-red-400 text-sm">Error: {result.error}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      
      {!scorecard && !running && (
        <div className="bg-zinc-800 rounded-lg p-8 text-center text-zinc-400">
          <p className="mb-4">Click "Run Test Suite" to evaluate the assistant against {suite?.tests.length || 50} test questions.</p>
          <p className="text-sm">The test will check for hallucination safety, correct escalation, document usage, and safety compliance.</p>
        </div>
      )}
      
      {running && (
        <div className="bg-zinc-800 rounded-lg p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Running test suite... This may take a few minutes.</p>
        </div>
      )}
    </div>
  );
}
