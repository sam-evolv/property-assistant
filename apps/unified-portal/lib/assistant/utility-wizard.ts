/**
 * Utility Setup Wizard
 *
 * Interactive multi-step flow that guides new homeowners through setting up
 * electricity, gas, broadband, water, and bins for their new home.
 *
 * State is tracked per-session via a simple in-memory map keyed by
 * a session identifier (unit_uid or userId).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UtilityType = 'electricity' | 'gas' | 'broadband' | 'water' | 'bins';

export interface UtilityStep {
  stepNumber: number;
  totalSteps: number;
  utilityType: UtilityType;
  title: string;
  content: string;
  isComplete: boolean;
}

export interface WizardState {
  currentUtilityIndex: number;
  completedUtilities: UtilityType[];
  startedAt: number;
}

// ---------------------------------------------------------------------------
// In-memory session store (TTL: 30 minutes)
// ---------------------------------------------------------------------------

const WIZARD_TTL_MS = 30 * 60 * 1000;
const wizardSessions = new Map<string, WizardState>();

function cleanExpiredSessions(): void {
  const now = Date.now();
  for (const [key, state] of wizardSessions) {
    if (now - state.startedAt > WIZARD_TTL_MS) {
      wizardSessions.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility content
// ---------------------------------------------------------------------------

interface UtilityInfo {
  type: UtilityType;
  icon: string;
  name: string;
  providers: string[];
  steps: string[];
  tips: string[];
  links: { label: string; url: string }[];
  timeEstimate: string;
}

const UTILITIES: UtilityInfo[] = [
  {
    type: 'electricity',
    icon: '⚡',
    name: 'Electricity',
    providers: ['Electric Ireland', 'Bord Gáis Energy', 'SSE Airtricity', 'Energia', 'Flogas', 'Community Power', 'Pinergy'],
    steps: [
      'Find your MPRN (Meter Point Reference Number) — this is on your ESB Networks meter or in your closing documents',
      'Choose an electricity supplier — compare prices on switcher.ie or bonkers.ie',
      'Contact your chosen supplier to register your MPRN',
      'They\'ll handle the switch — you don\'t need to contact ESB Networks',
      'Set up a direct debit for easy payments',
      'Submit your first meter reading through the supplier\'s app or website',
    ],
    tips: [
      '💡 Your MPRN is usually 11 digits and starts with "10"',
      '💰 Many suppliers offer new customer discounts — check comparison sites',
      '🌱 Some suppliers offer 100% green energy plans at competitive rates',
      '📱 Most suppliers have apps for easy meter reading submissions and bill tracking',
      '⏰ This is usually the first utility to set up — do it on moving day if possible',
    ],
    links: [
      { label: 'Compare Suppliers — Switcher.ie', url: 'https://switcher.ie/electricity/' },
      { label: 'Compare Suppliers — Bonkers.ie', url: 'https://www.bonkers.ie/compare-electricity-prices/' },
      { label: 'ESB Networks — Find Your MPRN', url: 'https://www.esbnetworks.ie/' },
    ],
    timeEstimate: '10–15 minutes to sign up, 1–2 working days to activate',
  },
  {
    type: 'gas',
    icon: '🔥',
    name: 'Natural Gas',
    providers: ['Bord Gáis Energy', 'Electric Ireland', 'SSE Airtricity', 'Energia', 'Flogas'],
    steps: [
      'Find your GPRN (Gas Point Reference Number) — this is on your gas meter or in your closing documents',
      'Choose a gas supplier — compare prices on switcher.ie or bonkers.ie',
      'Contact your chosen supplier to register your GPRN',
      'Set up a direct debit for payments',
      'Submit your first meter reading',
    ],
    tips: [
      '🔢 Your GPRN is usually 7 digits',
      '💡 Many suppliers offer dual fuel discounts if you bundle electricity and gas',
      '🏠 If your home has a heat pump and no gas boiler, you may not need gas at all!',
      '📋 Get your boiler serviced annually — required for warranty and safety',
    ],
    links: [
      { label: 'Compare Gas Suppliers — Switcher.ie', url: 'https://switcher.ie/gas/' },
      { label: 'Gas Networks Ireland', url: 'https://www.gasnetworks.ie/' },
    ],
    timeEstimate: '10 minutes to sign up, 1–2 working days to activate',
  },
  {
    type: 'broadband',
    icon: '📡',
    name: 'Broadband & Internet',
    providers: ['Virgin Media', 'Sky Ireland', 'Eir', 'Vodafone', 'Pure Telecom', 'Digiweb', 'National Broadband Ireland'],
    steps: [
      'Check what broadband types are available at your Eircode — fibre, cable, or fixed wireless',
      'Compare providers and plans on comparison websites',
      'Order your preferred plan online or by phone',
      'Schedule installation — an engineer visit may be required',
      'Connect your devices and set up your Wi-Fi password',
    ],
    tips: [
      '🏠 Check your Eircode on comreg.ie to see all available providers',
      '📺 Bundle deals (broadband + TV + phone) can save money',
      '⚡ Fibre to the home (FTTH) is the fastest option — up to 1Gbps',
      '📍 New developments may have specific infrastructure — check with your developer',
      '⏳ Installation can take 1–2 weeks — order early!',
    ],
    links: [
      { label: 'Check Your Eircode — ComReg', url: 'https://www.comreg.ie/compare/#/broadband' },
      { label: 'Compare Broadband — Switcher.ie', url: 'https://switcher.ie/broadband/' },
    ],
    timeEstimate: '10 minutes to order, 1–2 weeks for installation',
  },
  {
    type: 'water',
    icon: '💧',
    name: 'Water (Irish Water / Uisce Éireann)',
    providers: ['Uisce Éireann (Irish Water)'],
    steps: [
      'Contact Uisce Éireann to register as the new occupant of your property',
      'Provide your Eircode and property details',
      'Note: Domestic water charges are currently waived in Ireland',
      'Register your property to ensure you receive water supply notifications',
      'Report any leaks or water quality issues through the Uisce Éireann website',
    ],
    tips: [
      '🆓 Domestic water charges are not currently applied — but registration is still recommended',
      '🔧 Report supply issues on 1800 278 278 (24/7)',
      '📍 Your water meter is usually at the front boundary of your property',
      '💡 Even though water is free, conserving water is good for the environment',
    ],
    links: [
      { label: 'Uisce Éireann — Register', url: 'https://www.water.ie/' },
      { label: 'Report a Leak', url: 'https://www.water.ie/help/supply/report-a-leak/' },
    ],
    timeEstimate: '5 minutes to register online',
  },
  {
    type: 'bins',
    icon: '🗑️',
    name: 'Waste Collection (Bins)',
    providers: ['Panda', 'Country Clean', 'Greenstar', 'Mr. Binman', 'City Bin Co.', 'Clean Ireland'],
    steps: [
      'Check which waste collection companies service your area',
      'Contact your chosen provider to order bins (general, recycling, and compost)',
      'Select a plan — pay-by-weight or pay-by-lift',
      'Schedule your bin delivery',
      'Check your local council website for collection day schedules',
      'Set up an account and payment method',
    ],
    tips: [
      '♻️ Ireland has three bins: Black/grey (general), Green (recycling), Brown (food/garden waste)',
      '💰 Pay-by-weight is usually cheaper if you recycle well',
      '📅 Check mywaste.ie for your collection schedule and recycling guidelines',
      '🏘️ Your estate management company may organise communal collection — check first',
      '🌍 Brown bin composting significantly reduces your waste charges',
    ],
    links: [
      { label: 'MyWaste.ie — Collection Schedules', url: 'https://www.mywaste.ie/' },
      { label: 'Find a Waste Collector', url: 'https://www.mywaste.ie/find-my-nearest-recycling-centre/' },
    ],
    timeEstimate: '10 minutes to sign up, 2–5 working days for bin delivery',
  },
];

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const UTILITY_PATTERNS = [
  /\butilities\b/i,
  /\bset\s*up\s*(electricity|gas|broadband|water|bins|internet|wifi|wi-fi)\b/i,
  /\b(just\s*got|getting)\s*(my\s*)?(keys|house|home)\b/i,
  /\bmov(e|ing)\s*(in|into)\b/i,
  /\bnew\s*home\s*(set\s*up|checklist|guide)\b/i,
  /\bsetup\s*wizard\b/i,
  /\bhow\s*do\s*i\s*(set\s*up|get|register|connect)\s*(electricity|gas|broadband|water|bins|internet)\b/i,
  /\b(electricity|gas|broadband|internet|wifi|bins|waste)\s*(provider|supplier|company|setup|connection)\b/i,
  /\bfirst\s*time\s*buyer\s*(checklist|guide|help)\b/i,
  /\bnew\s*homeowner\b/i,
];

export function isUtilityQuery(message: string): boolean {
  return UTILITY_PATTERNS.some((p) => p.test(message));
}

function detectSpecificUtility(message: string): UtilityType | null {
  const lower = message.toLowerCase();
  if (/\belectricity|mprn|esb\b/i.test(lower)) return 'electricity';
  if (/\bgas\b|gprn|bord\s*g[aá]is\b/i.test(lower)) return 'gas';
  if (/\bbroadband|internet|wifi|wi-fi|fibre\b/i.test(lower)) return 'broadband';
  if (/\bwater|irish\s*water|uisce\b/i.test(lower)) return 'water';
  if (/\bbins?\b|waste|recycling|panda|greenstar\b/i.test(lower)) return 'bins';
  return null;
}

// ---------------------------------------------------------------------------
// Wizard lifecycle
// ---------------------------------------------------------------------------

export function startUtilitySetupWizard(sessionId: string): string {
  cleanExpiredSessions();

  wizardSessions.set(sessionId, {
    currentUtilityIndex: 0,
    completedUtilities: [],
    startedAt: Date.now(),
  });

  return formatWizardIntro();
}

export function processUtilityStep(sessionId: string, message: string): string | null {
  cleanExpiredSessions();

  const state = wizardSessions.get(sessionId);
  if (!state) return null; // no active wizard

  const lower = message.toLowerCase();

  // Navigation commands
  if (/\b(skip|next)\b/i.test(lower)) {
    return advanceWizard(sessionId, state);
  }

  if (/\b(back|previous|prev)\b/i.test(lower)) {
    if (state.currentUtilityIndex > 0) {
      state.currentUtilityIndex--;
      wizardSessions.set(sessionId, state);
      return formatUtilityStep(UTILITIES[state.currentUtilityIndex], state);
    }
    return '⬅️ You\'re already at the first step. Type **"next"** to continue or ask me a question about this utility.';
  }

  if (/\b(done|finish|exit|quit|stop\s*wizard|end)\b/i.test(lower)) {
    wizardSessions.delete(sessionId);
    return formatWizardComplete(state);
  }

  // If user asks about a specific utility, jump to it
  const specificUtility = detectSpecificUtility(message);
  if (specificUtility) {
    const idx = UTILITIES.findIndex((u) => u.type === specificUtility);
    if (idx !== -1) {
      state.currentUtilityIndex = idx;
      wizardSessions.set(sessionId, state);
      return formatUtilityStep(UTILITIES[idx], state);
    }
  }

  // "Yes" / affirmative → show current step detail
  if (/\b(yes|yeah|sure|ok|okay|go|start|ready|let'?s\s*go|please)\b/i.test(lower)) {
    return formatUtilityStep(UTILITIES[state.currentUtilityIndex], state);
  }

  // "Done" with this utility / mark complete
  if (/\b(completed|i'?ve\s*done|sorted|set\s*up|registered|signed\s*up)\b/i.test(lower)) {
    const currentType = UTILITIES[state.currentUtilityIndex].type;
    if (!state.completedUtilities.includes(currentType)) {
      state.completedUtilities.push(currentType);
    }
    return advanceWizard(sessionId, state);
  }

  // Default: show current utility step
  return formatUtilityStep(UTILITIES[state.currentUtilityIndex], state);
}

export function hasActiveWizard(sessionId: string): boolean {
  cleanExpiredSessions();
  return wizardSessions.has(sessionId);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function advanceWizard(sessionId: string, state: WizardState): string {
  const currentType = UTILITIES[state.currentUtilityIndex].type;
  if (!state.completedUtilities.includes(currentType)) {
    state.completedUtilities.push(currentType);
  }

  if (state.currentUtilityIndex >= UTILITIES.length - 1) {
    wizardSessions.delete(sessionId);
    return formatWizardComplete(state);
  }

  state.currentUtilityIndex++;
  wizardSessions.set(sessionId, state);
  return formatUtilityStep(UTILITIES[state.currentUtilityIndex], state);
}

function formatWizardIntro(): string {
  const lines: string[] = [];
  lines.push('# 🏠 New Home Utility Setup Wizard');
  lines.push('');
  lines.push('Congratulations on your new home! Let me guide you through setting up all your essential services. I\'ll walk you through each one step by step.');
  lines.push('');
  lines.push('### Here\'s what we\'ll cover:');
  lines.push('');

  for (let i = 0; i < UTILITIES.length; i++) {
    const u = UTILITIES[i];
    lines.push(`${i + 1}. ${u.icon} **${u.name}** — ${u.timeEstimate}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**Ready to start?** Say **"yes"** to begin with electricity, or name a specific utility (e.g. *"broadband"*) to jump straight to it.');
  lines.push('');
  lines.push('You can say **"next"** to skip, **"back"** to go back, or **"done"** to finish at any time.');

  return lines.join('\n');
}

function formatUtilityStep(utility: UtilityInfo, state: WizardState): string {
  const stepNum = state.currentUtilityIndex + 1;
  const totalSteps = UTILITIES.length;
  const progress = UTILITIES.map((u, i) => {
    if (state.completedUtilities.includes(u.type)) return '✅';
    if (i === state.currentUtilityIndex) return '🔵';
    return '⬜';
  }).join(' ');

  const lines: string[] = [];
  lines.push(`## ${utility.icon} ${utility.name} — Step ${stepNum} of ${totalSteps}`);
  lines.push('');
  lines.push(`Progress: ${progress}`);
  lines.push('');

  // Providers
  lines.push('### Available Providers');
  lines.push(utility.providers.join(' · '));
  lines.push('');

  // Steps
  lines.push('### 📋 How to Set Up');
  for (let i = 0; i < utility.steps.length; i++) {
    lines.push(`${i + 1}. ${utility.steps[i]}`);
  }
  lines.push('');

  // Tips
  lines.push('### 💡 Tips');
  for (const tip of utility.tips) {
    lines.push(`- ${tip}`);
  }
  lines.push('');

  // Links
  lines.push('### 🔗 Useful Links');
  for (const link of utility.links) {
    lines.push(`- [${link.label}](${link.url})`);
  }
  lines.push('');
  lines.push(`⏱️ **Estimated time:** ${utility.timeEstimate}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  if (state.currentUtilityIndex < UTILITIES.length - 1) {
    const next = UTILITIES[state.currentUtilityIndex + 1];
    lines.push(`Say **"next"** to continue to ${next.icon} ${next.name}, or **"done"** to finish the wizard.`);
  } else {
    lines.push('This is the last utility! Say **"done"** to see your summary.');
  }

  return lines.join('\n');
}

function formatWizardComplete(state: WizardState): string {
  const lines: string[] = [];
  lines.push('# ✅ Utility Setup Complete!');
  lines.push('');
  lines.push('Great work! Here\'s a summary of what we covered:');
  lines.push('');

  for (const u of UTILITIES) {
    const done = state.completedUtilities.includes(u.type);
    lines.push(`${done ? '✅' : '⬜'} ${u.icon} **${u.name}** — ${done ? 'Covered' : 'Skipped'}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### 📌 Quick Reference Bookmarks');
  lines.push('');
  lines.push('- [Switcher.ie — Compare All Utilities](https://switcher.ie/)');
  lines.push('- [MyWaste.ie — Bin Schedules](https://www.mywaste.ie/)');
  lines.push('- [Uisce Éireann — Water](https://www.water.ie/)');
  lines.push('- [ComReg — Broadband Checker](https://www.comreg.ie/compare/#/broadband)');
  lines.push('');
  lines.push('> 💬 You can restart this wizard anytime by asking *"help me set up my utilities"* or asking about a specific utility like *"how do I set up broadband?"*');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Single-utility response (no wizard, just quick info)
// ---------------------------------------------------------------------------

export function getUtilityInfoResponse(message: string): string {
  const specific = detectSpecificUtility(message);
  if (specific) {
    const utility = UTILITIES.find((u) => u.type === specific);
    if (utility) {
      return formatSingleUtility(utility);
    }
  }
  // Couldn't detect a specific utility — this shouldn't happen if called correctly
  return formatWizardIntro();
}

function formatSingleUtility(utility: UtilityInfo): string {
  const lines: string[] = [];
  lines.push(`## ${utility.icon} Setting Up ${utility.name}`);
  lines.push('');

  lines.push('### Available Providers');
  lines.push(utility.providers.join(' · '));
  lines.push('');

  lines.push('### 📋 How to Set Up');
  for (let i = 0; i < utility.steps.length; i++) {
    lines.push(`${i + 1}. ${utility.steps[i]}`);
  }
  lines.push('');

  lines.push('### 💡 Tips');
  for (const tip of utility.tips) {
    lines.push(`- ${tip}`);
  }
  lines.push('');

  lines.push('### 🔗 Useful Links');
  for (const link of utility.links) {
    lines.push(`- [${link.label}](${link.url})`);
  }
  lines.push('');
  lines.push(`⏱️ **Estimated time:** ${utility.timeEstimate}`);
  lines.push('');
  lines.push('> 💬 Want help setting up all your utilities? Just ask *"help me set up my utilities"* to start the full setup wizard.');

  return lines.join('\n');
}
