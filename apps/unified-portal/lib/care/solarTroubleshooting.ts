/**
 * Solar System Troubleshooting Knowledge Base
 *
 * Real error codes, symptoms, and solutions for solar PV systems.
 * Used to prevent unnecessary installer callouts.
 *
 * Based on common Irish installer experiences:
 * - SolarEdge systems (most common in Ireland)
 * - Fronius systems (secondary)
 * - String inverters (general troubleshooting)
 */

export interface TroubleshootingEntry {
  id: string;
  symptom: string;           // What homeowner reports
  errorCode?: string;        // Inverter error code if applicable
  severity: 'info' | 'warning' | 'critical';
  requiresTechnician: boolean;
  
  diagnosis: string;         // What's actually wrong
  homeownerCanFix: boolean;
  
  steps: string[];           // Step-by-step instructions
  estimatedTime: string;     // How long the fix takes
  
  calloutCost: number;       // €, if technician needed
  prevention: string;        // How to avoid this in future
  
  relatedErrors: string[];   // Other error codes that might be related
}

export const SOLAR_TROUBLESHOOTING: TroubleshootingEntry[] = [
  {
    id: 'sol_001',
    symptom: 'Inverter display shows error code F32',
    errorCode: 'F32',
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'Firmware update available. This is a notice, not a failure. System continues to work.',
    homeownerCanFix: false,
    steps: [
      "This error appears when a firmware update is available for your SolarEdge inverter.",
      "Your system is still working normally and generating power.",
      "Firmware updates improve performance and stability. Schedule an installer visit for the update (usually 20-30 minutes).",
      "Do not attempt to update firmware yourself.",
    ],
    estimatedTime: '20-30 minutes (installer)',
    calloutCost: 150,
    prevention: 'Firmware updates are non-critical. You can schedule during regular maintenance.',
    relatedErrors: ['F31', 'F33'],
  },

  {
    id: 'sol_002',
    symptom: 'Inverter beeping and showing red error light',
    errorCode: 'F21',
    severity: 'critical',
    requiresTechnician: false,
    diagnosis: 'DC disconnect switch is OFF. This cuts power from the solar panels. Usually happens accidentally.',
    homeownerCanFix: true,
    steps: [
      "Locate your electrical consumer unit (fuse board), usually near the main entrance or utility room.",
      "Look for a red-labeled switch marked 'PV DC Disconnect' or 'Solar DC Isolator'.",
      "Check if this switch is in the OFF position (typically pointing down).",
      "If OFF, flip it to ON (pointing up).",
      "Your inverter should stop beeping within 30 seconds. The display will return to normal.",
      "If it doesn't reset, wait 2 minutes then unplug the AC cable and plug it back in.",
    ],
    estimatedTime: '2 minutes',
    calloutCost: 0,
    prevention: 'The DC disconnect switch should always be ON during operation. Label it clearly to avoid accidental switching.',
    relatedErrors: ['F22', 'FAULT_DC'],
  },

  {
    id: 'sol_003',
    symptom: 'Solar system not generating, even though it is sunny',
    errorCode: undefined,
    severity: 'critical',
    requiresTechnician: false,
    diagnosis: 'Could be: 1) System in startup sequence (takes 10-15 min after power-up), 2) AC isolator OFF, 3) Grid connection issue.',
    homeownerCanFix: true,
    steps: [
      "Step 1: Check the inverter display. If it shows 'Waiting for grid' or 'Initializing', wait 10-15 minutes. This is normal after power-up.",
      "Step 2: Locate your AC isolator switch (usually near the inverter or in the consumer unit). Make sure it is ON.",
      "Step 3: Check if there are any error codes on the inverter display. (See other troubleshooting guides if there are.)",
      "Step 4: If still not generating after 20 minutes of sunshine, try this: Unplug the AC cable from the inverter and wait 30 seconds, then plug it back in. Wait another 10 minutes.",
      "Step 5: If the system still isn't generating after these steps, contact your installer.",
    ],
    estimatedTime: '15 minutes (mostly waiting)',
    calloutCost: 180,
    prevention: `Never switch off the AC isolator unless you are performing maintenance. A 'DO NOT SWITCH' label is strongly recommended.`,
    relatedErrors: ['FAULT_AC', 'F25'],
  },

  {
    id: 'sol_004',
    symptom: 'Solar panels not generating even though inverter shows OK',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'Likely: 1) Panel shading (tree growth, leaves), 2) Panel dirt/bird droppings, 3) Cloud cover (weather-dependent).',
    homeownerCanFix: true,
    steps: [
      "Step 1: Check the weather. If it is heavily overcast or raining, generation will be very low. This is normal.",
      "Step 2: Walk around your roof and look at the panels. Do you see shadows from trees, chimneys, or wires falling on the panels? Even partial shading can reduce output by 50%.",
      "Step 3: Look for visible dirt, leaves, or bird droppings on the panels. If present, you can clean them with a soft brush and water (do not use pressure washers).",
      "Step 4: Check the inverter display. Does it show the same power output it did on clear days a few weeks ago? If yes, the weather is the cause.",
      "Step 5: If performance is consistently 30%+ lower than 3 months ago and the weather was similar, contact your installer to investigate further.",
    ],
    estimatedTime: '30 minutes (inspection + light cleaning)',
    calloutCost: 0,
    prevention: 'Trim back tree branches that might grow toward panels. Clean panels 2-3 times per year, or after heavy storms.',
    relatedErrors: [],
  },

  {
    id: 'sol_005',
    symptom: 'Inverter display shows "Waiting for Grid" or "Initializing"',
    errorCode: undefined,
    severity: 'info',
    requiresTechnician: false,
    diagnosis: 'Normal startup sequence. System is synchronizing with the electricity grid. No action needed.',
    homeownerCanFix: false,
    steps: [
      "This is a normal state. Your system is powering up and communicating with the grid.",
      "Wait 10-15 minutes. The display will change to 'OK' or show active power.",
      "During this time, no power is being exported to the grid. This is intentional for safety.",
      "If the system remains in 'Waiting for Grid' for more than 20 minutes, proceed to the troubleshooting for 'not generating' above.",
    ],
    estimatedTime: '10-15 minutes (passive)',
    calloutCost: 0,
    prevention: 'This is normal. No prevention needed.',
    relatedErrors: [],
  },

  {
    id: 'sol_006',
    symptom: 'Inverter showing error F24 or F25',
    errorCode: 'F24/F25',
    severity: 'warning',
    requiresTechnician: true,
    diagnosis: 'Communication error with grid or internal fault. Not a user-fixable issue.',
    homeownerCanFix: false,
    steps: [
      "This error indicates a communication problem between the inverter and the grid, or an internal inverter fault.",
      "Try this: Unplug the AC cable from the inverter and wait 30 seconds. Plug it back in.",
      "If the error persists after 10 minutes, contact your installer immediately.",
      "Do not attempt to reset or troubleshoot further yourself.",
    ],
    estimatedTime: '30 seconds reset + waiting',
    calloutCost: 200,
    prevention: 'Ensure the AC isolator switch is rated correctly for your system. Have your installer check during annual maintenance.',
    relatedErrors: ['F23', 'F26', 'FAULT_AC'],
  },

  {
    id: 'sol_007',
    symptom: 'Solar app shows much lower generation than expected',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: '1) Weather is cloudier than you expect, 2) Performance monitoring has a lag (data updates every 15 mins), 3) Seasonal variation.',
    homeownerCanFix: false,
    steps: [
      "Step 1: Check weather conditions. Even light cloud cover reduces solar generation significantly.",
      "Step 2: Remember that solar generation data updates every 15 minutes. The number you see might be from 15 minutes ago, not right now.",
      "Step 3: Compare today's generation to the same day last month. If last month was also cloudy, you're doing fine.",
      "Step 4: Compare to the same day last year if possible. Seasonal variation is huge: June generation is 2-3x higher than December.",
      "Step 5: If performance is consistently 30%+ below historical average on clear days, contact your installer.",
    ],
    estimatedTime: '5-10 minutes (understanding)',
    calloutCost: 0,
    prevention: 'Understand seasonal variation. Winter generates 60% less than summer. This is normal.',
    relatedErrors: [],
  },

  {
    id: 'sol_008',
    symptom: 'Inverter alarm/beeping every few minutes',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'Usually a reminder for maintenance (e.g., filter change, firmware update, or annual health check).',
    homeownerCanFix: false,
    steps: [
      "Check the inverter display for any message. Common alarms: 'Filter change due', 'Firmware update available', 'Maintenance due'.",
      "If it says 'Filter change due': Your system has an air filter that needs replacement. This is usually a 5-minute DIY job (check your manual).",
      "If it says 'Firmware update available': Schedule an installer visit to update (see error F32 guide above).",
      "If it says 'Annual service due': This is a reminder to schedule your yearly system check. Contact your installer to book.",
      "The beeping will stop after the reminder period expires or after you address the issue.",
    ],
    estimatedTime: '5 minutes (DIY) or 20 minutes (installer)',
    calloutCost: 0,
    prevention: 'Keep up with annual maintenance. Replace filters as recommended (usually once per year).',
    relatedErrors: [],
  },

  {
    id: 'sol_009',
    symptom: 'One panel in the array looks damaged (broken glass, delamination)',
    errorCode: undefined,
    severity: 'critical',
    requiresTechnician: true,
    diagnosis: 'Physical damage to solar panel. Must be replaced. Safety hazard if not addressed.',
    homeownerCanFix: false,
    steps: [
      "Do not attempt to repair or remove the panel yourself.",
      "Contact your installer immediately with a photo of the damage.",
      "Until the panel is replaced, the entire string containing that panel will be underperforming.",
      "Replacement typically takes 1-2 hours and costs €200-400 depending on access.",
    ],
    estimatedTime: '1-2 hours (installer)',
    calloutCost: 250,
    prevention: 'Avoid placing ladders or objects against panels. Trim tree branches that might hit them.',
    relatedErrors: [],
  },

  {
    id: 'sol_010',
    symptom: 'Inverter display is blank or off',
    errorCode: undefined,
    severity: 'critical',
    requiresTechnician: false,
    diagnosis: 'Power is cut to the inverter. Check AC isolator, consumer unit, or inverter power cable.',
    homeownerCanFix: true,
    steps: [
      "Step 1: Check the AC isolator switch (usually near the inverter). Is it ON?",
      "Step 2: Check your consumer unit (fuse board). Look for a tripped breaker labeled 'Solar' or 'PV'. If tripped (switch pointing down), flip it back ON.",
      "Step 3: Check the power cable connected to the back of the inverter. Is it firmly plugged in?",
      "Step 4: If all switches are ON and cable is connected, wait 2 minutes and unplug the AC cable. Wait 30 seconds. Plug it back in.",
      "Step 5: The display should light up within 30 seconds. If it doesn't, contact your installer.",
    ],
    estimatedTime: '5 minutes',
    calloutCost: 0,
    prevention: 'Keep the AC isolator switch clearly labeled. Do not unplug the inverter for cleaning or maintenance.',
    relatedErrors: [],
  },

  {
    id: 'sol_011',
    symptom: 'Generation data is old or not updating in the app',
    errorCode: undefined,
    severity: 'info',
    requiresTechnician: false,
    diagnosis: 'WiFi connection between inverter and monitoring server is unstable.',
    homeownerCanFix: true,
    steps: [
      "Step 1: Check that your home WiFi is working. Can you browse the internet on your phone?",
      "Step 2: Restart your home WiFi router (turn it off, wait 30 seconds, turn it back on).",
      "Step 3: If the inverter is far from your router, try moving the router closer or installing a WiFi extender.",
      "Step 4: Check the inverter display. If it shows an error code, see the relevant troubleshooting guide.",
      "Step 5: If data is still not updating after 30 minutes, contact your installer to check the inverter's WiFi connection.",
    ],
    estimatedTime: '10 minutes',
    calloutCost: 0,
    prevention: 'Ensure your WiFi router is in a central location. Restart router monthly for optimal performance.',
    relatedErrors: [],
  },

  {
    id: 'sol_012',
    symptom: 'System generates less power than it did last summer',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'Most likely: 1) Seasonal change (it is winter), 2) Panel degradation (normal, ~0.5% per year), 3) Dirt/shading, 4) Panel efficiency loss from heat.',
    homeownerCanFix: false,
    steps: [
      "Step 1: Check the date. If last summer was June-August and now it is December-February, lower generation is completely normal. Winter generates 60% less.",
      "Step 2: Look at the panels. Are they dirtier or shadier than last summer? Tree growth, leaves, or dirt will reduce output.",
      "Step 3: Compare generation on a clear day this winter to a clear day last winter. If they are similar, your system is aging normally.",
      "Step 4: Solar panels degrade ~0.5% per year. After 5 years, expect ~2.5% lower output than new. This is normal.",
      "Step 5: If output is 20%+ lower than expected on clear winter days, contact your installer for a full system check.",
    ],
    estimatedTime: '5-10 minutes (analysis)',
    calloutCost: 0,
    prevention: 'Clean panels 2-3 times per year. Trim trees regularly to prevent new shading.',
    relatedErrors: [],
  },
];

/**
 * Find troubleshooting entry by error code
 */
export function findByErrorCode(code: string): TroubleshootingEntry | undefined {
  return SOLAR_TROUBLESHOOTING.find(
    (entry) => entry.errorCode === code || entry.relatedErrors.includes(code)
  );
}

/**
 * Find troubleshooting entries by symptom (fuzzy match)
 */
export function findBySymptom(symptom: string): TroubleshootingEntry[] {
  const lower = symptom.toLowerCase();
  return SOLAR_TROUBLESHOOTING.filter((entry) =>
    entry.symptom.toLowerCase().includes(lower) ||
    entry.diagnosis.toLowerCase().includes(lower)
  );
}

/**
 * Get all homeowner-fixable issues
 */
export function getHomeownerFixable(): TroubleshootingEntry[] {
  return SOLAR_TROUBLESHOOTING.filter((entry) => entry.homeownerCanFix);
}

/**
 * Get all issues that require a technician
 */
export function getTechnicianRequired(): TroubleshootingEntry[] {
  return SOLAR_TROUBLESHOOTING.filter((entry) => entry.requiresTechnician);
}

/**
 * Calculate total potential callout savings
 * (assuming this KB prevents X% of common issues)
 */
export function calculatePotentialSavings(): {
  totalCallouts: number;
  preventableCallouts: number;
  potentialSavings: number;
} {
  const homeownerFixable = getHomeownerFixable().length;
  const totalIssues = SOLAR_TROUBLESHOOTING.length;
  const avgCalloutCost = SOLAR_TROUBLESHOOTING.reduce((sum, e) => sum + e.calloutCost, 0) / totalIssues;

  return {
    totalCallouts: totalIssues,
    preventableCallouts: homeownerFixable,
    potentialSavings: homeownerFixable * avgCalloutCost,
  };
}
