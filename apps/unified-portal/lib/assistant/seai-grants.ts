/**
 * SEAI Grants Knowledge Base
 *
 * Structured data on Sustainable Energy Authority of Ireland (SEAI)
 * home energy grants available to homeowners. Covers EV chargers,
 * solar PV, insulation, and heat pumps.
 */

export interface SEAIGrant {
  id: string;
  name: string;
  category: 'ev_charger' | 'solar_pv' | 'insulation' | 'heat_pump';
  grantAmount: string;
  maxAmount: number;
  eligibility: string[];
  process: string[];
  importantNotes: string[];
  link: string;
  icon: string;
}

const SEAI_GRANTS: SEAIGrant[] = [
  {
    id: 'ev-charger',
    name: 'EV Home Charger Grant',
    category: 'ev_charger',
    grantAmount: 'Up to €300',
    maxAmount: 300,
    eligibility: [
      'You own or have purchased an electric or plug-in hybrid vehicle',
      'The charger is installed at your home (not rented — unless landlord applies)',
      'The property was built and occupied before 2011, OR you purchased an EV',
      'Charger must be installed by a Safe Electric registered contractor',
      'Only one grant per household',
    ],
    process: [
      'Purchase or order your electric vehicle',
      'Choose a Safe Electric registered installer',
      'Get your charger installed',
      'Apply online at seai.ie within 6 months of installation',
      'Upload proof of EV ownership and installer invoice',
      'Grant is paid directly to your bank account',
    ],
    importantNotes: [
      'You must apply within 6 months of installation',
      'The charger must meet minimum technical standards',
      'The grant covers installation costs — not the vehicle',
      'Smart chargers are recommended for off-peak charging savings',
    ],
    link: 'https://www.seai.ie/grants/electric-vehicle-grants/electric-vehicle-home-charger-grant/',
    icon: '🔌',
  },
  {
    id: 'solar-pv',
    name: 'Solar PV Grant',
    category: 'solar_pv',
    grantAmount: 'Up to €2,100',
    maxAmount: 2100,
    eligibility: [
      'Your home was built and occupied before 2021',
      'You have not previously received an SEAI solar PV grant',
      'The system must be installed by an SEAI registered contractor',
      'Panels must be new and meet technical standards',
      'A Battery Energy Storage System (BESS) can be included',
    ],
    process: [
      'Get a BER assessment of your home (if you don\'t have one)',
      'Choose an SEAI registered solar PV installer',
      'Get quotes and agree on the system size',
      'The installer applies to SEAI on your behalf',
      'Once approved, installation proceeds',
      'SEAI pays the grant — you pay the installer the balance',
    ],
    importantNotes: [
      'Grant is €900 per kWp up to 2 kWp (€1,800), plus €300 for battery storage',
      'Typical 3-4 bedroom home suits a 3-4 kWp system',
      'You can sell excess electricity back to the grid via a micro-generation tariff',
      'Solar PV works even on cloudy Irish days — panels need daylight, not direct sun',
      'Planning permission is generally not required for roof-mounted panels',
    ],
    link: 'https://www.seai.ie/grants/home-energy-grants/solar-electricity-grant/',
    icon: '☀️',
  },
  {
    id: 'insulation',
    name: 'Home Insulation Grants',
    category: 'insulation',
    grantAmount: 'Up to €6,500',
    maxAmount: 6500,
    eligibility: [
      'Your home was built and occupied before 2011',
      'You have not previously received an SEAI grant for the same measure',
      'Work must be done by an SEAI registered contractor',
      'A post-works BER is required',
    ],
    process: [
      'Get a BER assessment to identify insulation opportunities',
      'Choose an SEAI registered insulation contractor',
      'The contractor applies to SEAI on your behalf',
      'Once approved, work can proceed',
      'A post-works BER assessment is completed',
      'SEAI pays the grant — you pay the contractor the balance',
    ],
    importantNotes: [
      'Attic insulation: up to €1,500',
      'Cavity wall insulation: up to €1,700',
      'Internal wall insulation (dry lining): up to €4,500',
      'External wall insulation: up to €6,500',
      'Grants can be combined — e.g. attic + wall insulation',
      'Newer A-rated homes likely don\'t need additional insulation',
    ],
    link: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
    icon: '🏠',
  },
  {
    id: 'heat-pump',
    name: 'Heat Pump Grant',
    category: 'heat_pump',
    grantAmount: 'Up to €6,500',
    maxAmount: 6500,
    eligibility: [
      'Your home was built and occupied before 2011',
      'A pre-works BER assessment has been done',
      'Your home must reach a minimum BER of B2 after the works',
      'The heat pump must be installed by an SEAI registered contractor',
      'You have not previously received a heat pump grant from SEAI',
    ],
    process: [
      'Get a BER assessment — your home must be suitable for a heat pump',
      'Ensure your home is well-insulated (may need insulation first)',
      'Choose an SEAI registered heat pump installer',
      'The contractor applies to SEAI on your behalf',
      'Once approved, installation proceeds',
      'Post-works BER must show B2 or better',
      'SEAI pays the grant — you pay the installer the balance',
    ],
    importantNotes: [
      'Air-to-water heat pumps are most common in Ireland',
      'Your home must be well-insulated for a heat pump to work efficiently',
      'If you already have a heat pump in a new build, you likely won\'t qualify',
      'Heat pumps cost €8,000–€14,000 installed — the grant covers a significant portion',
      'Heat pumps can reduce heating costs by 30–50% compared to oil/gas',
      'Consider combining with insulation grants for maximum savings',
    ],
    link: 'https://www.seai.ie/grants/home-energy-grants/heat-pump-systems/',
    icon: '♨️',
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

// IMPORTANT: Patterns must require explicit grant/SEAI context.
// Bare appliance names (ev charger, solar, heat pump) must NOT match here —
// those are property-specific questions that need the RAG pipeline.
const GRANT_PATTERNS = [
  /\bgrants?\b/i,
  /\bseai\b/i,
  /\binsulation\s*grant\b/i,
  /\bheat\s*pump\s*grant\b/i,
  /\benergy\s*grant\b/i,
  /\bhome\s*energy\s*upgrade\b/i,
  /\bretrofit\s*grant\b/i,
];

export function isGrantQuery(message: string): boolean {
  return GRANT_PATTERNS.some((p) => p.test(message));
}

export function detectGrantCategory(message: string): SEAIGrant['category'] | null {
  const lower = message.toLowerCase();
  if (/ev\s*charger|electric\s*vehicle\s*charger|car\s*charger|home\s*charger/i.test(lower)) return 'ev_charger';
  if (/solar|pv|panel|photovoltaic/i.test(lower)) return 'solar_pv';
  if (/insulation|cavity\s*wall|attic\s*insulation|dry\s*lin/i.test(lower)) return 'insulation';
  if (/heat\s*pump|air.to.water|ground\s*source/i.test(lower)) return 'heat_pump';
  return null;
}

// ---------------------------------------------------------------------------
// Response formatting
// ---------------------------------------------------------------------------

function formatSingleGrant(grant: SEAIGrant): string {
  const lines: string[] = [];
  lines.push(`## ${grant.icon} ${grant.name}`);
  lines.push('');
  lines.push(`**Grant Amount:** ${grant.grantAmount}`);
  lines.push('');

  lines.push('### ✅ Eligibility');
  for (const item of grant.eligibility) {
    lines.push(`- ${item}`);
  }
  lines.push('');

  lines.push('### 📋 How to Apply');
  for (let i = 0; i < grant.process.length; i++) {
    lines.push(`${i + 1}. ${grant.process[i]}`);
  }
  lines.push('');

  lines.push('### 💡 Good to Know');
  for (const note of grant.importantNotes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push(`🔗 **Full details:** [SEAI — ${grant.name}](${grant.link})`);

  return lines.join('\n');
}

function formatAllGrants(): string {
  const lines: string[] = [];
  lines.push('# 🇮🇪 SEAI Home Energy Grants');
  lines.push('');
  lines.push('Here\'s a complete overview of the grants available to homeowners in Ireland:');
  lines.push('');

  // Summary table
  lines.push('| Grant | Amount | Best For |');
  lines.push('|-------|--------|----------|');
  lines.push('| ☀️ Solar PV | Up to €2,100 | Reducing electricity bills |');
  lines.push('| 🔌 EV Charger | Up to €300 | Electric vehicle owners |');
  lines.push('| 🏠 Insulation | Up to €6,500 | Older homes (pre-2011) |');
  lines.push('| ♨️ Heat Pump | Up to €6,500 | Replacing oil/gas boilers |');
  lines.push('');

  for (const grant of SEAI_GRANTS) {
    lines.push('---');
    lines.push('');
    lines.push(formatSingleGrant(grant));
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('> 💡 **Tip:** Many of these grants can be combined. For example, you could insulate your home *and* install a heat pump to maximise your savings. Your SEAI registered contractor can advise on the best combination for your home.');
  lines.push('');
  lines.push('> ⚠️ **New Build Note:** If your home has an A-rated BER (common in new builds), you likely already have excellent insulation and a heat pump — but you may still qualify for the Solar PV or EV Charger grants.');

  return lines.join('\n');
}

export function getSEAIGrantsResponse(message: string): string {
  const category = detectGrantCategory(message);

  if (category) {
    const grant = SEAI_GRANTS.find((g) => g.category === category);
    if (grant) {
      return formatSingleGrant(grant);
    }
  }

  // No specific category detected — return full overview
  return formatAllGrants();
}
