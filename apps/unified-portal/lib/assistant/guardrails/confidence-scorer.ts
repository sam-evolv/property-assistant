/**
 * Confidence Scorer — per-response risk assessment
 *
 * Scores a model response across 5 dimensions and produces
 * an overall confidence score with a recommendation.
 *
 * Designed to run AFTER the existing hallucination firewall.
 * The firewall handles hard blocks; this scorer handles gradation.
 */

import { GuardrailContext, DocumentChunk } from './types';

export interface ConfidenceScore {
  overall: number;
  dimensions: {
    grounding: number;
    specificity: number;
    consistency: number;
    completeness: number;
    safety: number;
  };
  riskFactors: string[];
  recommendation: 'pass' | 'pass_with_warning' | 'review' | 'block';
}

const STOP_WORDS = new Set([
  'what', 'where', 'when', 'which', 'does', 'have', 'this', 'that',
  'with', 'from', 'about', 'could', 'would', 'should', 'will', 'can',
  'the', 'and', 'but', 'for', 'are', 'was', 'were', 'been', 'being',
]);

export function scoreConfidence(
  response: string,
  context: GuardrailContext
): ConfidenceScore {
  const dimensions = {
    grounding: scoreGrounding(response, context.retrievedChunks),
    specificity: scoreSpecificity(response, context.retrievedChunks),
    consistency: scoreConsistency(response, context.schemeFacts),
    completeness: scoreCompleteness(response, context.query),
    safety: scoreSafety(response),
  };

  const riskFactors: string[] = [];

  if (dimensions.grounding < 0.5) {
    riskFactors.push('low_grounding');
  }
  if (dimensions.grounding < 0.3) {
    riskFactors.push('critical_grounding');
  }
  if (dimensions.specificity < 0.5) {
    riskFactors.push('unverified_specifics');
  }
  if (dimensions.consistency < 0.7) {
    riskFactors.push('scheme_facts_mismatch');
  }
  if (dimensions.completeness < 0.4) {
    riskFactors.push('incomplete_answer');
  }
  if (dimensions.safety < 0.8) {
    riskFactors.push('safety_concern');
  }

  const weights = {
    grounding: 0.30,
    specificity: 0.20,
    consistency: 0.20,
    completeness: 0.10,
    safety: 0.20,
  };

  const overall =
    dimensions.grounding * weights.grounding +
    dimensions.specificity * weights.specificity +
    dimensions.consistency * weights.consistency +
    dimensions.completeness * weights.completeness +
    dimensions.safety * weights.safety;

  let recommendation: ConfidenceScore['recommendation'];
  if (overall >= 0.85 && riskFactors.length === 0) {
    recommendation = 'pass';
  } else if (overall >= 0.7 && riskFactors.length <= 1) {
    recommendation = 'pass_with_warning';
  } else if (overall >= 0.5) {
    recommendation = 'review';
  } else {
    recommendation = 'block';
  }

  return { overall, dimensions, riskFactors, recommendation };
}

function scoreGrounding(response: string, chunks: DocumentChunk[]): number {
  if (!chunks || chunks.length === 0) {
    const hasFactualClaims = /\b\d+\s*(sq|bedroom|bathroom|€|BER)\b/i.test(response);
    return hasFactualClaims ? 0.2 : 0.6;
  }

  const responseWords = new Set(
    response.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  );

  const responseWordArray = Array.from(responseWords);

  let maxOverlap = 0;
  for (const chunk of chunks) {
    const chunkWords = new Set(
      chunk.content.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    );
    const overlap = responseWordArray.filter(w => chunkWords.has(w)).length;
    maxOverlap = Math.max(maxOverlap, overlap / Math.max(responseWordArray.length, 1));
  }

  return Math.min(1, maxOverlap * 2.5);
}

function scoreSpecificity(response: string, chunks: DocumentChunk[]): number {
  const specificityPatterns = [
    { pattern: /\b\d{4}\b/, weight: 0.25 },
    { pattern: /€\d[\d,]*/, weight: 0.25 },
    { pattern: /\d+\s*(km|mile|min|minute)/i, weight: 0.2 },
    { pattern: /BER\s*[A-G]\d?/i, weight: 0.15 },
    { pattern: /\d+\s*(sqm|sq\s*ft|square\s*met)/i, weight: 0.15 },
  ];

  let riskScore = 0;
  for (const { pattern, weight } of specificityPatterns) {
    if (pattern.test(response)) riskScore += weight;
  }

  const hasGoodGrounding = chunks && chunks.length > 0 && chunks[0].similarity && chunks[0].similarity > 0.65;
  const groundingBonus = hasGoodGrounding ? 0.3 : 0;

  return Math.max(0, Math.min(1, 1 - riskScore + groundingBonus));
}

function scoreConsistency(response: string, schemeFacts: string): number {
  if (!schemeFacts || schemeFacts.trim().length === 0) return 0.85;

  const contradictions: string[] = [];

  const factPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /(\d+)\s*units?/i, label: 'unit_count' },
    { pattern: /bedroom[s]?\s*(\d+)/i, label: 'bedroom_count' },
    { pattern: /bathroom[s]?\s*(\d+)/i, label: 'bathroom_count' },
    { pattern: /BER\s*([A-G]\d?)/i, label: 'ber_rating' },
    { pattern: /(apartment|house|duplex|townhouse)/i, label: 'property_type' },
  ];

  for (const { pattern, label } of factPatterns) {
    const schemeMatch = pattern.exec(schemeFacts);
    const responseMatch = pattern.exec(response);
    if (schemeMatch && responseMatch) {
      if (schemeMatch[1].toLowerCase() !== responseMatch[1].toLowerCase()) {
        contradictions.push(`${label}:"${schemeMatch[1]}" vs "${responseMatch[1]}"`);
      }
    }
  }

  if (contradictions.length === 0) return 0.95;
  return Math.max(0, 1 - contradictions.length * 0.3);
}

function scoreCompleteness(response: string, query: string): number {
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
  );

  if (queryWords.size === 0) return 0.7;

  const queryWordArray = Array.from(queryWords);
  const responseWordSet = new Set(response.toLowerCase().split(/\s+/));
  const overlap = queryWordArray.filter(w => responseWordSet.has(w)).length;
  const queryCoverage = overlap / queryWords.size;

  const questionCount = (query.match(/\?/g) || []).length;
  const answerSections = response.split(/\n\n+/).length;
  const multiPartScore = questionCount > 1 ? Math.min(1, answerSections / questionCount) : 1;

  return Math.min(1, queryCoverage * 0.6 + multiPartScore * 0.4);
}

function scoreSafety(response: string): number {
  let score = 1.0;

  const hardStopPatterns: Array<{ pattern: RegExp; penalty: number }> = [
    { pattern: /I (recommend|suggest) (hiring|using|contacting)/i, penalty: 0.4 },
    { pattern: /you should (use|hire|call|buy)/i, penalty: 0.2 },
    { pattern: /I (can|will) (guarantee|promise|ensure)/i, penalty: 0.3 },
    { pattern: /your (warranty|guarantee) (covers|includes)/i, penalty: 0.3 },
    { pattern: /\b(legal|lawyer|solicitor|attorney)\b/i, penalty: 0.15 },
    { pattern: /I (remember|recall|know) (you|your)/i, penalty: 0.3 },
    { pattern: /I am (monitoring|watching|tracking)/i, penalty: 0.5 },
  ];

  for (const { pattern, penalty } of hardStopPatterns) {
    if (pattern.test(response)) score -= penalty;
  }

  return Math.max(0, score);
}
