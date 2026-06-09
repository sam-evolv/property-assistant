// lib/dev-app/home-user-guide.ts
// Generates the auto, system-specific Home User Guide (HPI QA 8.0) from a unit's
// installed unit_systems. Matches the OpenAI usage pattern in lib/ai-classify.ts.

import OpenAI from 'openai';

// This is the headline, reasoning-heavy generation (HPI QA 8.0 deliverable), so it
// defaults to the stronger model; guides are generated once per unit, so the cost
// is bounded. Override with HOME_USER_GUIDE_MODEL to trade quality for cost.
const GUIDE_MODEL = process.env.HOME_USER_GUIDE_MODEL || 'gpt-4o';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for Home User Guide generation');
  }
  return new OpenAI({ apiKey });
}

export interface HomeUserGuideSection {
  heading: string;
  system_type?: string;
  summary?: string;
  how_to_use?: string[];
  seasonal_tips?: string[];
  maintenance?: string[];
  warranty?: string | null;
  do_not?: string[];
}

export interface HomeUserGuideContent {
  title: string;
  introduction: string;
  systems_covered: string[];
  sections: HomeUserGuideSection[];
  general_tips: string[];
  who_to_contact: string;
  generated_at: string;
  model: string;
}

export interface GuideUnitContext {
  unit_number?: string | null;
  address_line_1?: string | null;
  city?: string | null;
  eircode?: string | null;
  house_type_code?: string | null;
}

function buildPrompt(unit: GuideUnitContext, systems: any[]): string {
  const systemLines = systems.length
    ? systems
        .map((s) => {
          const bits = [s.system_type, s.make, s.model].filter(Boolean).join(' ');
          const warranty = s.warranty_end ? ` (warranty to ${s.warranty_end})` : '';
          const maint = s.maintenance_interval_months
            ? ` (service every ${s.maintenance_interval_months} months)`
            : '';
          return `- ${bits}${warranty}${maint}`;
        })
        .join('\n')
    : '(no systems recorded yet)';

  return `You are writing a Home User Guide for a new-build Irish home, read by a
non-technical homeowner. The goal is the opposite of a 60-page manual: clear,
friendly, scannable, and specific to THIS home's installed systems.

Home: ${unit.address_line_1 ?? ''} ${unit.city ?? ''} ${unit.eircode ?? ''} (type ${unit.house_type_code ?? 'n/a'}).

Installed systems:
${systemLines}

Write practical guidance for each installed system, tailored to the named
make/model where given. Use Irish context (A-rated homes, heat pumps, MVHR, SEAI).
Be accurate and general where you are unsure; NEVER invent specific spec figures,
settings values or warranty dates that were not provided. Emphasise the few things
that matter most (e.g. don't switch the heat pump off at the wall in winter; keep
MVHR running and change its filters).

Respond ONLY with valid JSON in exactly this shape:
{
  "title": "string",
  "introduction": "2-3 friendly sentences",
  "systems_covered": ["heat_pump", "mvhr", ...],
  "sections": [
    {
      "heading": "string",
      "system_type": "string",
      "summary": "one line",
      "how_to_use": ["..."],
      "seasonal_tips": ["..."],
      "maintenance": ["..."],
      "warranty": "string or null",
      "do_not": ["..."]
    }
  ],
  "general_tips": ["..."],
  "who_to_contact": "string"
}`;
}

/**
 * Generates a structured Home User Guide for a unit from its installed systems.
 * Throws if OPENAI_API_KEY is unset (handled by the route as a 503).
 */
export async function generateHomeUserGuide(
  unit: GuideUnitContext,
  systems: any[],
): Promise<HomeUserGuideContent> {
  const completion = await getOpenAIClient().chat.completions.create({
    model: GUIDE_MODEL,
    messages: [{ role: 'user', content: buildPrompt(unit, systems) }],
    response_format: { type: 'json_object' },
    max_tokens: 2000,
    temperature: 0.4,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error('No response from AI');
  const parsed = JSON.parse(text);

  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Your Home User Guide',
    introduction: typeof parsed.introduction === 'string' ? parsed.introduction : '',
    systems_covered: Array.isArray(parsed.systems_covered) ? parsed.systems_covered : [],
    sections: Array.isArray(parsed.sections) ? parsed.sections : [],
    general_tips: Array.isArray(parsed.general_tips) ? parsed.general_tips : [],
    who_to_contact:
      typeof parsed.who_to_contact === 'string'
        ? parsed.who_to_contact
        : "Contact your developer's aftercare team, or ask the in-app assistant.",
    generated_at: new Date().toISOString(),
    model: GUIDE_MODEL,
  };
}
