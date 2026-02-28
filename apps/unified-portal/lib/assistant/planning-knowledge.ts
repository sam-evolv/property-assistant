/**
 * Planning & Development Knowledge Library
 * 
 * Regional planning regulations, development standards, and policy frameworks
 * for Irish planning authorities. Includes Cork-specific documentation.
 * 
 * Used as Tier 2 knowledge (General Best Practice) per the GLOBAL_SAFETY_CONTRACT.
 * Injected when questions relate to planning, development, or construction standards.
 */

export interface PlanningKnowledgeEntry {
  topics: string[];        // Keywords that trigger this entry
  content: string;         // The knowledge, ready to inject as context
  region?: string;         // Optional region specificity (e.g., "cork", "dublin")
  authority?: string;      // Planning authority reference
}

export const PLANNING_KNOWLEDGE: PlanningKnowledgeEntry[] = [

  // -------------------------------------------------------------------------
  // CORK CITY & COUNTY PLANNING
  // -------------------------------------------------------------------------
  {
    topics: ['cork', 'cork city', 'cork county', 'cork development', 'cork planning', 'cork city development plan', 'cork county development plan'],
    content: `CORK PLANNING FRAMEWORK — KEY DOCUMENTS:

The Cork region operates under comprehensive planning frameworks including:

• Cork City Development Plan 2022-2028 - The primary statutory planning document for Cork City
• Cork County Development Plan - Governing development across County Cork
• Design Manual for Urban Roads and Streets (DMURS) - National standards applied in Cork
• Design Manual for Quality Housing - Housing development standards
• Sustainable Residential Development Guidelines - National policy applied locally

Key Cork-specific considerations:
- Cork City has ambitious growth targets as an emerging international center
- Population over 210,000 with significant expansion planned
- Specific zoning objectives and land use policies for different city areas
- Emphasis on sustainable development and compact urban form
- Special provisions for key growth areas and neighborhood development sites

Development in Cork must comply with both national standards and Cork-specific planning objectives set out in the development plans.`,
    region: 'cork',
    authority: 'Cork City Council & Cork County Council'
  },

  {
    topics: ['cork zoning', 'cork land use', 'cork development contributions', 'cork planning permission', 'cork building standards'],
    content: `CORK DEVELOPMENT STANDARDS — KEY REQUIREMENTS:

Development Contributions (Cork):
- Adopted Development Contributions Scheme 2023-2029 outlines financial contributions
- Contributions fund infrastructure required due to development
- Rates vary based on development type and location
- Applies to residential, commercial, and industrial development

Building Standards in Cork:
- Must comply with National Building Regulations (Part A-L)
- Additional Cork-specific design standards for urban design
- Emphasis on quality materials and design excellence
- Specific requirements for flood risk management in Lee catchment area

Planning Application Process:
- Applications submitted to relevant planning authority (City or County)
- Pre-application consultations recommended
- Standard 8-week statutory decision period
- Right to appeal decisions to An Bord Pleanála`,
    region: 'cork',
    authority: 'Cork Planning Authorities'
  },

  // -------------------------------------------------------------------------
  // URBAN DESIGN & ROAD STANDARDS
  // -------------------------------------------------------------------------
  {
    topics: ['urban design', 'road design', 'street design', 'dmurs', 'design manual urban roads streets', 'transport planning'],
    content: `URBAN DESIGN STANDARDS — DMURS:

The Design Manual for Urban Roads and Streets (DMURS) provides national standards for:

• Street hierarchy and classification
• Pedestrian and cyclist priority design
• Public realm and placemaking principles
• Traffic calming and speed management
• Materials and landscaping standards

Key Principles:
- People-focused street design rather than vehicle-dominated
- Integration of sustainable transport modes
- Creation of attractive, vibrant public spaces
- Context-sensitive design solutions
- Collaborative design process between disciplines

DMURS applies to all urban road and street projects in Ireland and is referenced in Cork development plans.`,
    authority: 'Department of Transport & Department of Housing'
  },

  // -------------------------------------------------------------------------
  // HOUSING DEVELOPMENT STANDARDS
  // -------------------------------------------------------------------------
  {
    topics: ['housing design', 'quality housing', 'apartment standards', 'residential development', 'housing guidelines', 'dwelling design'],
    content: `HOUSING DEVELOPMENT STANDARDS — NATIONAL FRAMEWORK:

Design Manual for Quality Housing provides standards for:

• Site selection and sustainable community proofing
• Urban design and master planning principles
• Scheme layout and dwelling configuration
• Internal layout design and space standards
• Accessibility and universal design

Apartment Standards (2023):
- Minimum floor areas for different apartment types
- Daylight and sunlight requirements
- Storage and amenity space standards
- Private outdoor space requirements
- Dual aspect requirements for larger apartments

Key Quality Considerations:
- Orientation and solar gain optimization
- Natural ventilation and daylighting
- Acoustic separation between dwellings
- Flexible internal layouts
- High-quality materials and construction`,
    authority: 'Department of Housing, Local Government and Heritage'
  },

  // -------------------------------------------------------------------------
  // SUSTAINABLE DEVELOPMENT
  // -------------------------------------------------------------------------
  {
    topics: ['sustainable development', 'climate action', 'environmental planning', 'green infrastructure', 'biodiversity', 'climate change planning'],
    content: `SUSTAINABLE DEVELOPMENT GUIDELINES:

Sustainable Residential Development and Compact Settlements Guidelines cover:

• Climate change adaptation and mitigation
• Green and blue infrastructure integration
• Biodiversity protection and enhancement
• Water conservation and management
• Energy efficiency and renewable energy

Key Requirements:
- Development must contribute to national climate action targets
- Incorporation of sustainable drainage systems (SuDS)
- Protection and enhancement of ecological networks
- Promotion of active travel and public transport
- Use of sustainable construction materials and methods

Cork-specific applications include Lee Catchment Flood Risk Management and implementation of green infrastructure strategies.`,
    authority: 'Department of Housing and Local Authorities'
  },

  // -------------------------------------------------------------------------
  // INFRASTRUCTURE & UTILITIES
  // -------------------------------------------------------------------------
  {
    topics: ['water infrastructure', 'uisce éireann', 'irish water', 'utility connections', 'drainage', 'water standards'],
    content: `WATER INFRASTRUCTURE STANDARDS:

Uisce Éireann Developer Guide to Connections outlines:

• Water and wastewater connection requirements
• Design standards for water infrastructure
• Application process for new connections
• Technical specifications for pipes and fittings

Water Standard Details include:
- Pipe materials and installation standards
- Valve and fitting specifications
- Metering and control requirements
- Testing and commissioning procedures

Key Considerations for Cork:
- Compliance with Lee Catchment Flood Risk Management Plan
- Integration with Cork water infrastructure plans
- Coordination with Cork City/County development objectives
- Sustainable water management practices`,
    authority: 'Uisce Éireann'
  },

  // -------------------------------------------------------------------------
  // PLANNING PROCESS & COMPLIANCE
  // -------------------------------------------------------------------------
  {
    topics: ['planning process', 'planning application', 'exempted development', 'planning compliance', 'building control', 'construction regulations'],
    content: `PLANNING PROCESS & COMPLIANCE — IRELAND:

Planning Permission Requirements:
- Most development requires planning permission
- Exempted development categories exist for minor works
- Applications must include detailed plans and documentation
- Pre-application consultation recommended

Building Control Regulations:
- Compliance with Building Regulations (Parts A-L) mandatory
- Commencement notices and compliance certificates required
- Assigned certifiers oversee design and construction compliance
- Inspection and certification during construction

Enforcement & Compliance:
- Planning authorities monitor compliance with permissions
- Enforcement actions for unauthorized development
- Regularization process for unauthorized development
- Time limits for enforcement actions`,
    authority: 'Local Planning Authorities & Building Control Authorities'
  }

];

/**
 * Returns relevant planning knowledge entries for a given message.
 * Matches by topic keywords and optional region filter.
 */
export function getRelevantPlanningKnowledge(message: string, region?: string): PlanningKnowledgeEntry[] {
  const lower = message.toLowerCase();

  const scored = PLANNING_KNOWLEDGE.map(entry => {
    const topicMatches = entry.topics.filter(topic => lower.includes(topic));
    const regionMatch = !region || !entry.region || entry.region.toLowerCase() === region.toLowerCase();
    return { entry, score: topicMatches.length, regionMatch };
  }).filter(({ score, regionMatch }) => score > 0 && regionMatch);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(({ entry }) => entry);
}

/**
 * Formats planning knowledge entries into context for injection.
 */
export function formatPlanningKnowledgeContext(entries: PlanningKnowledgeEntry[]): string {
  if (entries.length === 0) return '';

  const blocks = entries.map(e => {
    const authority = e.authority ? `\n\nSource: ${e.authority}` : '';
    return `${e.content}${authority}`;
  }).join('\n\n');
  
  return `PLANNING & DEVELOPMENT GUIDANCE (Tier 2 — general planning standards; consult local authority for specific applications):\n${blocks}`;
}