/**
 * Data Hub File Classifier
 *
 * Two-pass classification: fast rule-based matching, then AI fallback.
 * Categories: drawing, compliance, spec, commercial, other.
 */

import OpenAI from 'openai'

const EXTENSION_RULES: Record<string, string> = {
  // Drawings
  dwg: 'drawing', dxf: 'drawing', rvt: 'drawing', rfa: 'drawing', ifc: 'drawing',
  skp: 'drawing', '3dm': 'drawing', pln: 'drawing',
  // Specs (may be refined by name)
  docx: 'spec', xlsx: 'spec',
  // Images (often site photos or renders)
  png: 'other', jpg: 'other', jpeg: 'other',
}

const PATH_KEYWORDS: Record<string, string[]> = {
  drawing: ['drawing', 'plan', 'elevation', 'section', 'layout', 'cad', 'architectural', 'ga', 'floor plan'],
  compliance: ['cert', 'compliance', 'fire', 'bcms', 'building control', 'planning', 'permission', 'regulation', 'inspection'],
  spec: ['spec', 'specification', 'schedule', 'schedule of finishes', 'scope of works', 'scope'],
  commercial: ['contract', 'tender', 'pricing', 'commercial', 'invoice', 'quote', 'valuation', 'payment'],
}

export function classifyByRules(fileName: string, filePath: string): { category: string; confidence: number } | null {
  const lower = `${fileName} ${filePath}`.toLowerCase()
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  // Extension-based (moderate confidence)
  const extCategory = EXTENSION_RULES[ext]

  // Keyword-based (check path + name)
  let bestKeywordMatch: { category: string; hits: number } | null = null

  for (const [category, keywords] of Object.entries(PATH_KEYWORDS)) {
    let hits = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) hits++
    }
    if (hits > 0 && (!bestKeywordMatch || hits > bestKeywordMatch.hits)) {
      bestKeywordMatch = { category, hits }
    }
  }

  // Strong keyword match
  if (bestKeywordMatch && bestKeywordMatch.hits >= 2) {
    return { category: bestKeywordMatch.category, confidence: Math.min(0.95, 0.7 + bestKeywordMatch.hits * 0.08) }
  }

  // Extension match + at least one keyword
  if (extCategory && bestKeywordMatch) {
    return { category: bestKeywordMatch.category, confidence: 0.85 }
  }

  // Single keyword match
  if (bestKeywordMatch) {
    return { category: bestKeywordMatch.category, confidence: 0.75 }
  }

  // Extension only
  if (extCategory) {
    return { category: extCategory, confidence: 0.6 }
  }

  // PDF special: default to spec unless name suggests otherwise
  if (ext === 'pdf') {
    for (const [category, keywords] of Object.entries(PATH_KEYWORDS)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          return { category, confidence: 0.8 }
        }
      }
    }
    return { category: 'spec', confidence: 0.5 }
  }

  return null
}

export async function classifyWithAI(fileName: string, filePath: string): Promise<{ category: string; confidence: number }> {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return { category: 'other', confidence: 0.3 }
    }

    const client = new OpenAI({ apiKey })
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Classify this construction project file into one of: drawing, compliance, spec, commercial, other\nFile name: ${fileName}\nFile path: ${filePath}\nReply with just the category word.`,
      }],
      max_tokens: 10,
      temperature: 0.1,
    })

    const response = completion.choices[0]?.message?.content?.trim().toLowerCase() || 'other'
    const validCategories = ['drawing', 'compliance', 'spec', 'commercial', 'other']
    const category = validCategories.includes(response) ? response : 'other'

    return { category, confidence: 0.8 }
  } catch (error) {
    console.error('[DataHub Classifier] AI classification error:', error)
    return { category: 'other', confidence: 0.3 }
  }
}

export async function classifyFile(fileName: string, filePath: string): Promise<{ category: string; confidence: number }> {
  const ruleResult = classifyByRules(fileName, filePath)
  if (ruleResult && ruleResult.confidence >= 0.8) {
    return ruleResult
  }

  const aiResult = await classifyWithAI(fileName, filePath)

  // If rules gave a lower-confidence result, prefer it over a low-confidence AI result
  if (ruleResult && ruleResult.confidence > aiResult.confidence) {
    return ruleResult
  }

  return aiResult
}
