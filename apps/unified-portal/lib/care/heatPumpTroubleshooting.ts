/**
 * Heat Pump Troubleshooting Knowledge Base
 *
 * Real fault codes, symptoms, and step-by-step solutions for air source heat pumps.
 * Covers Samsung EHS (SE Systems primary product), Daikin Altherma, Mitsubishi Ecodan,
 * Grant Aerona, and NIBE — with brand-agnostic steps where applicable.
 *
 * Goal: prevent unnecessary installer callouts by empowering homeowners to resolve
 * common issues themselves safely.
 */

import { TroubleshootingEntry } from './solarTroubleshooting';

export const HEAT_PUMP_TROUBLESHOOTING: TroubleshootingEntry[] = [

  /* ─────────────────────────────────────────────────────────────────────────
     E3 / HIGH PRESSURE FAULT — THE #1 PREVENTABLE CALLOUT
     Cause: blocked air filter restricting airflow → pressure spikes → safety lockout
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_001',
    symptom: 'Heat pump stopped working, red light flashing, showing E3 or high pressure fault',
    errorCode: 'E3',
    severity: 'critical',
    requiresTechnician: false,
    diagnosis: 'High pressure fault — the refrigerant pressure inside the system has exceeded the safe limit and the heat pump has shut itself off as a safety measure. The most common cause (over 70% of cases) is a blocked air filter on the indoor unit. When the filter is clogged with dust, airflow drops, the system has to work harder, and pressure builds until the safety cutout trips.',
    homeownerCanFix: true,
    steps: [
      'Locate the indoor unit (usually wall-mounted in the utility room or hot press). You\'ll see a removable panel on the front or underside.',
      'Switch the heat pump off at the unit controls, then switch it off at the isolator switch on the wall nearby. Wait 3 minutes before touching anything.',
      'Slide or clip off the front panel — no tools needed. Behind it you\'ll find one or two rectangular mesh filters.',
      'Carefully slide the filters out and hold them up to the light. If they\'re grey, furry, or visibly clogged with dust — that\'s your problem.',
      'Take the filters to a sink and rinse them under cold running water. Shake off excess water gently. Do not use a washing machine or tumble dryer.',
      'Leave the filters flat in a warm spot to dry completely — this takes around 20–30 minutes. Do not put them back in while wet.',
      'Once dry, slide the filters back in, replace the front panel, and switch the isolator back on.',
      'Turn the heat pump back on at the unit controls. It should start up within 2 minutes and the red fault light should clear.',
      'If the fault light comes back on within an hour, the filter may not be the only cause — contact your installer at that point.',
    ],
    estimatedTime: '35–45 minutes (mostly drying time)',
    calloutCost: 175,
    prevention: 'Clean the air filter every 3 months — it takes about 5 minutes and makes a significant difference to efficiency and system lifespan. A quick rinse every quarter will stop this fault from happening again.',
    relatedErrors: ['E4', 'HP', 'HIGH PRESSURE', 'H3'],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     DEFROST MODE — Most misunderstood "fault"
     Not a fault at all — completely normal in Irish weather
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_002',
    symptom: 'Heat pump making loud noise, steam or mist coming from outside unit, heating has temporarily stopped',
    errorCode: undefined,
    severity: 'info',
    requiresTechnician: false,
    diagnosis: 'Your heat pump is in defrost mode — this is completely normal and not a fault. Heat pumps extract heat from the outside air, even in cold weather. In damp Irish winters, moisture in the air can freeze on the outdoor unit\'s coils. The heat pump periodically runs a short defrost cycle (usually 5–15 minutes) to clear the ice. During this time heating pauses and you may see steam rising from the outdoor unit — this is just the ice melting.',
    homeownerCanFix: false,
    steps: [
      'No action needed. This is a normal, automatic function of your heat pump.',
      'The defrost cycle typically lasts 5–15 minutes. Heating will resume automatically afterwards.',
      'You may notice the outdoor fan slows or stops, and warm mist or steam rises from the unit — this is the ice melting. It\'s safe.',
      'If defrost cycles are happening very frequently (every 30 minutes or more) throughout the day, that could indicate reduced refrigerant — worth mentioning to your installer at the next service.',
    ],
    estimatedTime: '5–15 minutes (automatic, no action needed)',
    calloutCost: 0,
    prevention: 'No prevention needed — defrost mode is a feature, not a fault. It\'s a sign the system is working correctly in cold, damp conditions.',
    relatedErrors: [],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     HOUSE NOT HEATING UP — Hot water priority mode
     Very common complaint, zero fault, homeowner education
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_003',
    symptom: 'Heat pump is running but the house is not getting warm, underfloor heating or radiators are cold',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'Most likely cause: your heat pump is currently in hot water priority mode. When the hot water cylinder needs reheating, the system temporarily diverts all its energy to the cylinder and pauses space heating. This is normal — it usually lasts 30–60 minutes. After the cylinder reaches temperature, space heating resumes automatically. Other possible causes: flow temperature set too low for current weather, or thermostat schedule not matching your routine.',
    homeownerCanFix: true,
    steps: [
      'Check your hot water cylinder. Run a hot tap — if the water is noticeably cooler than usual, the heat pump is heating your cylinder right now. Wait 30–60 minutes and space heating should resume on its own.',
      'If hot water is fine, check your room thermostat or controller. What temperature is it set to, and what is the current room temperature? If they\'re the same, the system thinks the target is already reached and won\'t heat further.',
      'Check the time schedule on your controller. If space heating is set to "off" during certain hours, that\'s working as intended — adjust the schedule if it doesn\'t match your routine.',
      'If it\'s a particularly cold day (below 5°C), try increasing the flow temperature on the heat pump controller by 2–3°C. Heat pumps work harder in colder weather and sometimes need a small adjustment.',
      'If none of the above apply and the house is still cold after 2 hours with the heat pump running, contact your installer — there may be a flow or pressure issue.',
    ],
    estimatedTime: '5–10 minutes (checking) + up to 60 minutes waiting',
    calloutCost: 0,
    prevention: 'Set your hot water cylinder to heat overnight (e.g. 2am–5am) so it\'s ready before you wake up and doesn\'t interrupt daytime space heating. Most heat pump controllers let you set a cylinder schedule independently from space heating.',
    relatedErrors: [],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     NO HOT WATER — Cylinder schedule / timer issue
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_004',
    symptom: 'No hot water, cylinder is cold, heat pump appears to be running normally',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'The hot water cylinder schedule is likely set incorrectly, or the boost function hasn\'t been activated. Heat pump cylinders don\'t keep water hot all day like a traditional immersion — they heat it at set times and the insulation keeps it warm. If the schedule doesn\'t match your usage, you\'ll run out of hot water.',
    homeownerCanFix: true,
    steps: [
      'On your heat pump controller, find the hot water settings. Check what times the cylinder is scheduled to heat — if it\'s set for a time that has already passed today, that\'s why you have no hot water now.',
      'Use the "boost" or "once off" hot water function on your controller. This tells the heat pump to heat the cylinder immediately, regardless of the schedule. It typically takes 1–2 hours to fully heat a 200-litre cylinder.',
      'Once you have hot water again, adjust your schedule so the cylinder heats at a time that suits you — most people choose overnight or early morning.',
      'If you have an immersion heater as a backup (most Irish installations do), you can also use that for immediate hot water while the heat pump catches up — but use it sparingly as it\'s much more expensive to run than the heat pump.',
      'If the cylinder still doesn\'t heat even after a boost, check that the heat pump is not showing a fault code and contact your installer.',
    ],
    estimatedTime: '5 minutes setup + 1–2 hours heating',
    calloutCost: 0,
    prevention: 'Set your cylinder schedule to heat overnight when electricity is cheapest (especially if you\'re on a night-rate tariff). Aim for the cylinder to finish heating at least an hour before your morning routine starts.',
    relatedErrors: [],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     E1 / LOW PRESSURE FAULT — Needs technician
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_005',
    symptom: 'Heat pump showing E1, low pressure fault, or refrigerant warning',
    errorCode: 'E1',
    severity: 'critical',
    requiresTechnician: true,
    diagnosis: 'Low refrigerant pressure — this usually indicates a refrigerant leak somewhere in the system. Unlike high pressure faults, low pressure issues cannot be resolved by the homeowner. Refrigerant handling requires a certified F-Gas engineer.',
    homeownerCanFix: false,
    steps: [
      'Switch the heat pump off at the isolator switch to prevent further damage to the compressor.',
      'Do not attempt to top up refrigerant yourself — it is illegal to handle refrigerant without an F-Gas licence and can be dangerous.',
      'Contact your installer and quote the E1 fault code. This is a warranty-eligible repair if your system is within the warranty period.',
      'While waiting for the engineer, your immersion heater (if fitted) can provide hot water. Space heating will not be available until the fault is repaired.',
    ],
    estimatedTime: 'Requires technician visit (typically 1–2 hours on site)',
    calloutCost: 220,
    prevention: 'Annual service visits will catch refrigerant pressure issues early before they cause a complete shutdown. Make sure your installer checks refrigerant pressure at every annual service.',
    relatedErrors: ['E2', 'LOW PRESSURE', 'L1', 'REFRIGERANT'],
  },

  /* ─────────────────────────────────────────────────────────────────────────
     OUTDOOR UNIT NOISE — Debris / fan guard
     ───────────────────────────────────────────────────────────────────────── */
  {
    id: 'hp_006',
    symptom: 'Heat pump outdoor unit making unusual rattling, scraping or grinding noise',
    errorCode: undefined,
    severity: 'warning',
    requiresTechnician: false,
    diagnosis: 'A rattling or scraping noise from the outdoor unit is usually caused by leaves, twigs, or other debris caught in the fan guard. The outdoor unit draws a large volume of air through a fan, and anything that gets sucked in will cause noise. This is easy to check and usually easy to fix.',
    homeownerCanFix: true,
    steps: [
      'Switch the heat pump off at the isolator before approaching the outdoor unit.',
      'Look at the fan guard on the top or side of the outdoor unit. Can you see any leaves, twigs, or debris sitting on or inside the guard?',
      'Carefully remove any debris you can see without putting your hands through the fan guard. Use a stick or long tool if needed — never put fingers into the fan.',
      'Also check around the base of the unit for blocked drainage — the unit needs to be able to drain condensation and defrost water freely.',
      'Switch the unit back on and listen. If the noise continues, or if it sounds more like a grinding or high-pitched squeal rather than a rattle, that could indicate a bearing issue — contact your installer.',
    ],
    estimatedTime: '10 minutes',
    calloutCost: 0,
    prevention: 'Keep the area around the outdoor unit clear of leaves, garden furniture, bins, and anything that could obstruct airflow or be drawn into the fan. Check it after storms. Maintain at least 30cm clearance on all sides.',
    relatedErrors: [],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
   Search helpers — mirrors solarTroubleshooting.ts API exactly
   ────────────────────────────────────────────────────────────────────────── */

export function findHeatPumpByErrorCode(code: string): TroubleshootingEntry | null {
  const normalized = code.toUpperCase().trim();
  return (
    HEAT_PUMP_TROUBLESHOOTING.find((e) => {
      if (e.errorCode?.toUpperCase() === normalized) return true;
      return e.relatedErrors.some((r) => r.toUpperCase() === normalized);
    }) || null
  );
}

export function findHeatPumpBySymptom(symptom: string): TroubleshootingEntry[] {
  const lower = symptom.toLowerCase();
  const keywords = lower.split(/\s+/).filter((w) => w.length > 3);

  const scored = HEAT_PUMP_TROUBLESHOOTING.map((entry) => {
    const text = `${entry.symptom} ${entry.diagnosis} ${entry.relatedErrors.join(' ')}`.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.entry);
}

export function getHomeownerFixableHeatPumpIssues(): TroubleshootingEntry[] {
  return HEAT_PUMP_TROUBLESHOOTING.filter((e) => e.homeownerCanFix);
}
