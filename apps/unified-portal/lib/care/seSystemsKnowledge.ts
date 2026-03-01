/**
 * SE Systems — Installer-Specific Knowledge Base
 *
 * These entries EXTEND and OVERRIDE the generic care-knowledge entries
 * when an installation is associated with SE Systems.
 *
 * Key facts:
 * - SE Systems uses Huawei inverters (SUN2000 series) — NOT SolarEdge
 * - Battery: Huawei LUNA2000 (LiFePO4, modular)
 * - Panels: Astronergy (solar division) / Trina Solar (retrofit division)
 * - EV charger: MyEnergi Zappi
 * - Heat pumps: Mitsubishi Electric
 * - Monitoring: Huawei FusionSolar + OpenSolar
 * - One Stop Shop: SE Systems handles all SEAI grant applications
 *
 * Source: SE Systems Ireland complete research brief (February 2026)
 */

import { CareKnowledgeEntry } from './care-knowledge';

export const SE_SYSTEMS_KNOWLEDGE: CareKnowledgeEntry[] = [

  // =========================================================================
  // SE SYSTEMS — COMPANY & SUPPORT
  // =========================================================================
  {
    topics: [
      'se systems', 'who installed', 'installer', 'contact installer',
      'call installer', 'se systems contact', 'who do i call', 'who installed my system',
    ],
    systems: ['solar_pv', 'heat_pump', 'ev_charger', 'battery', 'mvhr', 'general'],
    content: `SE SYSTEMS — ABOUT YOUR INSTALLER:
Your system was installed by SE Systems (Sustainable Energy Systems), Ireland's largest deep retrofit energy upgrade provider.

Contact SE Systems:
- Phone: 021 439 7938
- Email: info@sesystems.ie
- Website: sesystems.ie
- Headquarters: Unit 6, Kilbarry Business Park, Dublin Hill, Cork

About SE Systems:
- Founded 2010 in Cork by John O'Leary (CEO) and Youenn Lowry (Managing Director)
- 14,000+ homes retrofitted; €900M+ in SEAI grants delivered
- Operates nationwide including offshore islands
- SEAI-registered One Stop Shop for all home energy upgrade grants
- ISO 9001 (quality) and ISO 14001 (environmental) certified
- Safe Electric certified; A-rated Safe-T-Cert accreditation

When you call, have ready:
- Your job reference number (on your handover documents)
- System serial number (on the inverter unit)
- Description of the issue and any error codes displayed`,
  },

  // =========================================================================
  // HUAWEI FUSIONSOLAR — MONITORING
  // =========================================================================
  {
    topics: [
      'monitoring app', 'solar app', 'check my solar', 'solar output', 'solar production',
      'how do i check', 'fusionsolar', 'huawei app', 'huawei fusionsolar',
      'opensolar', 'monitoring', 'check generation', 'solar data', 'generation data',
      'not updating', 'app not updating',
    ],
    systems: ['solar_pv'],
    content: `SOLAR MONITORING — HUAWEI FUSIONSOLAR & OPENSOLAR:
Your SE Systems installation uses two monitoring tools:

1. OpenSolar App (customer-facing dashboard):
   - Download on iOS or Android
   - Shows daily, monthly and annual generation
   - Tracks your savings and carbon offset
   - Login details are in your handover documents — contact SE Systems if you can't find them

2. Huawei FusionSolar (real-time monitoring):
   - The FusionSolar platform provides the live data behind OpenSolar
   - Accessible as a web portal at eu5.fusionsolar.huawei.com or via the FusionSolar app
   - Shows real-time power output (kW), energy totals, battery state (if fitted), and environmental impact
   - Supports Time-of-Use (TOU) and maximum self-consumption modes if you have a battery

What to look for on a clear summer day (typical Cork south-facing system):
- 3 kWp system: peaks around 2.4–2.8 kW between 11am–2pm
- 4 kWp system: peaks around 3.2–3.8 kW between 11am–2pm
- 5 kWp system: peaks around 4.0–4.8 kW between 11am–2pm

If monitoring data stops updating:
1. Check your home Wi-Fi is working
2. Restart your router (off 30 seconds, back on)
3. Check the Huawei SUN2000 inverter — it needs Wi-Fi to upload data (built-in Wi-Fi, no dongle required)
4. If no update after 1 hour of Wi-Fi being restored, contact SE Systems`,
  },

  // =========================================================================
  // HUAWEI SUN2000 — INVERTER LED & STATUS
  // =========================================================================
  {
    topics: [
      'inverter light', 'inverter status', 'huawei inverter', 'sun2000',
      'inverter led', 'red light inverter', 'green light inverter', 'inverter display',
      'inverter alarm', 'inverter beeping', 'inverter error', 'inverter not working',
      'inverter off', 'inverter blinking',
    ],
    systems: ['solar_pv'],
    content: `HUAWEI SUN2000 INVERTER — STATUS INDICATORS:
Your SE Systems installation uses a Huawei SUN2000 series inverter. Here's what the status indicators mean:

NORMAL STATES:
- Green light (solid) — System running normally, generating power ✅
- Green light (slow blink) — Standby/waiting mode (e.g. nighttime, low light, grid startup)
- No lights — Normal at night when AC power is disconnected

FAULT STATES (require action):
- Red light or fault indicator — System fault; check the inverter display for an error code
- Display shows "Isolation fault" or similar — ⚠️ Do not attempt to reset; contact SE Systems immediately

POWER CYCLE (for non-safety faults only):
1. Switch the AC isolator OFF (usually near the inverter or consumer unit)
2. Switch the DC isolator OFF (usually a red-handled switch near the solar meter)
3. Wait 5 minutes (allows DC voltage to drain safely — do NOT skip this)
4. Switch AC back ON first, then DC
5. Wait 5–10 minutes for the inverter to reconnect to the grid

⚠️ NEVER power cycle for isolation faults, earth faults, or arc faults — these are safety-critical. Call SE Systems.

If the inverter shows an error code on its display:
- Note the exact code/message displayed
- Try the power cycle above (if no isolation/earth/arc fault)
- If fault persists after restart, call SE Systems: 021 439 7938`,
  },

  // =========================================================================
  // HUAWEI LUNA2000 — BATTERY STORAGE
  // =========================================================================
  {
    topics: [
      'battery', 'luna2000', 'huawei battery', 'battery storage', 'home battery',
      'battery not charging', 'battery empty', 'battery full', 'battery percentage',
      'battery state', 'battery mode', 'battery settings', 'battery capacity',
      'how much battery', 'battery status',
    ],
    systems: ['battery'],
    content: `HUAWEI LUNA2000 — YOUR BATTERY SYSTEM:
Your SE Systems installation may include a Huawei LUNA2000 battery. Key facts:

ABOUT YOUR BATTERY:
- Chemistry: Lithium Iron Phosphate (LiFePO4) — the safest, most durable home battery chemistry
- Modular design: 5 kWh or 6.9 kWh per module, stackable from 5–21 kWh total
- Noise level: <29 dB(A) — almost silent in operation
- Operating temperature: −20°C to +55°C (well-suited to Irish climate)
- Warranty: 10 years, guaranteeing ≥60% capacity retention
- 4-layer safety protection system; VDE AR-E 2510-50 certified

HOW IT WORKS:
1. During daylight: charges from surplus solar (after your home's needs are met)
2. Evening: discharges to power your home as solar drops off
3. Overnight: continues discharging until depleted or minimum reserve reached
4. If battery runs flat: seamlessly switches to grid (you won't notice)

MONITORING YOUR BATTERY:
In FusionSolar, look for:
- State of Charge (SoC %): Should cycle between ~10–100% daily in summer
- Charge/Discharge power: Positive = charging, negative = discharging
- A battery sitting at 100% all day with no discharge suggests your schedule needs adjustment

OPERATING MODES (via FusionSolar or SE Systems portal):
- Maximum Self-Consumption (recommended): Charges from solar, discharges in evening
- Time of Use (TOU): Charges from cheap overnight grid electricity, discharges during peak hours
- Fully Fed to Grid: Exports all solar (not recommended for most homes)

BEST PRACTICE:
- Set minimum State of Charge to 10% to protect battery longevity
- In summer: use Maximum Self-Consumption
- In winter (low solar): consider TOU if you have a night-rate electricity tariff
- Avoid repeatedly running to 0% — it shortens battery life over time`,
  },

  // =========================================================================
  // ASTRONERGY / TRINA SOLAR PANELS
  // =========================================================================
  {
    topics: [
      'solar panels', 'panels', 'astronergy', 'trina solar', 'panel warranty',
      'panel damage', 'panel cleaning', 'dirty panels', 'clean panels',
      'panel degradation', 'how long do panels last', 'panel lifespan',
      'bird droppings panels', 'panels dirty',
    ],
    systems: ['solar_pv'],
    content: `YOUR SOLAR PANELS — ASTRONERGY / TRINA SOLAR:
SE Systems installs premium Tier 1 solar panels:

ASTRONERGY (Solar PV division):
- Technology: N-type TOPCon (Top Con Hot 2.0) — higher efficiency than standard panels
- Rating: Tier 1 Bloomberg BNEF; "Top Performer" Kiwa PVEL (8× award winner)
- Product warranty: 12–15 years (model dependent)
- Performance warranty: 30 YEARS — guaranteed to produce at least 87.6% of rated output after 30 years
- Annual degradation: ≤0.4% per year (better than industry average of 0.5%)

TRINA SOLAR (Retrofit division):
- Rating: Tier 1 Bloomberg BNEF
- Product warranty: 15 years
- Performance warranty: 25 years (typically ≥80% of rated output at year 25)

PANEL CLEANING GUIDE:
- How often: Every 6–12 months; coastal homes more frequently (salt spray)
- Best time: Early morning or late evening when panels are cool
- Method: Soft-bristled long-handled brush + garden hose + plain water (or biodegradable soap)
- Never use: Pressure washers, abrasive tools, harsh chemicals (voids warranty)
- Bird droppings: Targeted removal needed — rain alone won't shift them; even a small patch can reduce that string's output by up to 25%

PANEL DEGRADATION (what to expect):
- Year 1: May lose ~1–1.5% (initial settling)
- Years 2–30: ≤0.4% per year
- Year 30: Still producing ≥87.6% of original rated output
- Panels don't "stop working" suddenly — gradual, very slow decline

WHAT'S NOT NORMAL:
- Cracked or shattered glass — contact SE Systems immediately (safety hazard)
- Delamination (bubbles/peeling of the surface layer) — warranty claim, contact SE Systems
- One string performing noticeably worse than others — shading, soiling, or wiring issue`,
  },

  // =========================================================================
  // MYENERGI ZAPPI — EV CHARGER
  // =========================================================================
  {
    topics: [
      'zappi', 'myenergi', 'ev charger', 'electric car charger', 'charge my car',
      'ev charging', 'how does charger work', 'solar ev charging', 'eco mode',
      'zappi modes', 'charge from solar', 'ev charger not working', 'zappi fault',
    ],
    systems: ['ev_charger'],
    content: `MYENERGI ZAPPI — YOUR EV CHARGER:
Your SE Systems installation includes a MyEnergi Zappi smart EV charger.

CHARGING SPEEDS:
- Single-phase (7.4 kW): ~35–40 km of range per hour
- Three-phase (22 kW, if installed): ~110 km of range per hour
- Actual speed limited by your vehicle's onboard charger — most EVs accept max 7.4–11 kW AC

THREE CHARGING MODES:
1. Fast mode — charges at full grid speed regardless of solar output
2. Eco mode — uses solar surplus first, tops up from grid to maintain minimum charge rate
3. Eco+ mode — waits until there's enough solar surplus to charge entirely from solar (may delay start)

SOLAR INTEGRATION (unique Zappi feature):
The Zappi automatically detects surplus solar generation and diverts it to charging your car.
- Best used in Eco or Eco+ mode on sunny days
- In winter when solar is low, switch to Fast mode or schedule overnight on a cheaper rate
- Works with your Huawei system without any additional hardware

MYENERGI APP SETUP:
- Download "MyEnergi" from the App Store or Google Play
- Create an account and pair with your Zappi (instructions in handover documents)
- Set up charge schedules for overnight off-peak charging (e.g. 11pm–8am on SSE/Energia night rate)
- Monitor charging history and solar diversion statistics

ZAPPI WARRANTY: 3 years from installation date.

TROUBLESHOOTING:
- Zappi not starting charge: Check mode isn't set to Eco+ on a cloudy day (not enough solar)
- No lights on unit: Check MCB in consumer unit hasn't tripped
- Red/flashing light: Note any error code and contact SE Systems
- Car not connecting: Try removing and reinserting the cable at both ends; check vehicle's own charging settings`,
  },

  // =========================================================================
  // MITSUBISHI ELECTRIC HEAT PUMP
  // =========================================================================
  {
    topics: [
      'mitsubishi heat pump', 'ecodan', 'heat pump settings', 'melcloud',
      'heat pump app', 'heat pump controller', 'how to use heat pump',
      'heat pump temperature', 'heat pump schedule', 'heat pump service',
      'heat pump warranty', 'heat pump not heating',
    ],
    systems: ['heat_pump'],
    content: `MITSUBISHI ELECTRIC ECODAN — YOUR HEAT PUMP:
SE Systems installs Mitsubishi Electric heat pumps (Ecodan range) as part of deep retrofit packages.

YOUR SYSTEM:
- Type: Air-to-water heat pump (replaces your old oil/gas boiler)
- Uses electricity to extract heat from outdoor air and deliver it to your radiators/underfloor heating and hot water cylinder
- Operates efficiently even at outdoor temperatures down to −15°C
- Produces 3–4 units of heat per 1 unit of electricity consumed (COP 3–4)

REMOTE MONITORING — MELCloud:
- Mitsubishi Electric systems can be monitored and controlled via the MELCloud app
- Download "MELCloud" from the App Store or Google Play
- Login details in your handover documents
- Set heating schedules, adjust temperatures, check system status remotely

RECOMMENDED SETTINGS:
- Room thermostat: 20–21°C (every degree above 20°C adds ~6–8% to running costs)
- Hot water cylinder: 60°C, programmed to heat once per day (early morning)
  → Never set below 60°C (legionella prevention)
- Weather compensation: Keep enabled — automatically adjusts flow temperature to outdoor conditions (most efficient mode)
- Underfloor heating: Avoid large overnight setbacks — UFH has high thermal mass, costs more energy to reheat

SERVICING — IMPORTANT:
- Annual service by a qualified F-Gas certified engineer is required to maintain warranty
- SE Systems can arrange annual servicing — contact 021 439 7938
- Warranty: Typically 5 years parts, 7 years compressor (check your specific model's documents)
- Keep all service records — warranty claims require proof of annual service

WARRANTY CLAIM:
- Contact SE Systems with your job reference and fault description
- SE Systems manage warranty claims with Mitsubishi Electric on your behalf`,
  },

  // =========================================================================
  // SEAI GRANTS — UPDATED FEB 2026
  // =========================================================================
  {
    topics: [
      'seai grant', 'solar grant', 'heat pump grant', 'ev charger grant',
      'how much grant', 'did i get a grant', 'insulation grant', 'grant amount',
      'seai 2026', 'grant increase', 'how much did i get', 'what grants available',
      'apply for grant', 'grant application',
    ],
    systems: ['solar_pv', 'heat_pump', 'ev_charger', 'general'],
    content: `SEAI GRANTS — CURRENT AMOUNTS (Updated February 2026):
Ireland allocated €558 million to SEAI for residential retrofits in Budget 2026. Major increases took effect 3 February 2026.

SOLAR PV GRANT — up to €1,800:
- First 2 kWp: €700/kWp = €1,400
- Each additional kWp (2–4 kWp): €200/kWp = up to €400
- Maximum: €1,800 (at 4 kWp and above)
- Example: 3.52 kWp system = €1,704
- 0% VAT on solar panels and installation

HEAT PUMP GRANT — up to €12,500 (house):
- Heat pump unit: €6,500
- Central heating upgrades (radiators/pipework): €2,000
- Renewable Heat Bonus (replacing fossil fuel heating): €4,000
- Heat Loss Indicator (HLI) must be ≤2.3 W/(K·m²)

EV CHARGER GRANT: €300 (reduced from €600 in January 2024)

INSULATION GRANTS (detached house):
- Attic insulation: €2,000
- Cavity wall: €1,800
- Internal wall (dry lining): €4,500
- External wall: €8,000
- Windows (from 2 March 2026): up to €4,000
- External doors: €800/door, max 2

MAXIMUM COMBINED GRANTS (detached house): ~€30,650

THROUGH SE SYSTEMS (One Stop Shop):
SE Systems handles your entire grant application and deducts the grant upfront — you pay only the balance. This is the easiest route and SE Systems have delivered €900M+ in grants for customers.

IMPORTANT RULES:
- Work must NOT start before SEAI grant approval (application made first)
- Home must have been built and occupied before 31 December 2020 for solar PV
- One grant per property (per MPRN) for solar
- BER assessment (€50 grant) required before and after works for most measures`,
  },

  // =========================================================================
  // CLEAN EXPORT GUARANTEE — FEED-IN TARIFF
  // =========================================================================
  {
    topics: [
      'export tariff', 'sell electricity', 'feed in tariff', 'ceg',
      'clean export', 'micro generation', 'mss', 'sell back to grid',
      'export rate', 'how much do i get for export', 'get paid for solar',
      'smart export', 'which supplier is best for export',
    ],
    systems: ['solar_pv'],
    content: `CLEAN EXPORT GUARANTEE — CURRENT RATES (February 2026):
You can get paid for surplus solar electricity you export to the grid through the Clean Export Guarantee (CEG), part of Ireland's Micro-generation Support Scheme (MSS).

CURRENT RATES BY SUPPLIER:
| Supplier | Rate (c/kWh) |
|----------|-------------|
| SSE Airtricity (Premium CEG) | 32.0c ⭐ best rate |
| Pinergy | 25.0c |
| Community Power | 20.0c |
| Electric Ireland | 19.5c |
| SSE Airtricity (Standard) | 19.5c |
| Bord Gáis Energy | 18.5c |
| Energia | 18.5c |
| Flogas | 18.5c |
| Prepay Power | 15.89c |

KEY FACTS:
- First €400/year of CEG income is tax-free
- Requires a smart meter — request a free upgrade from ESB Networks
- Apply through your electricity supplier (they coordinate with ESB Networks)
- Payments credited on your electricity bill (usually quarterly)
- SE Systems submits the ESB NC6 form during installation, which triggers your smart meter upgrade

IMPORTANT PERSPECTIVE:
Self-consumption (using your own solar) saves ~35c/kWh — far more valuable than export (8–32c/kWh).
Prioritise using your solar electricity first; only then worry about export earnings.

HOW TO APPLY:
1. Contact your electricity supplier
2. Request to register for the Micro-generation Support Scheme / CEG
3. They arrange smart meter installation with ESB Networks (free, takes up to 4 months)
4. Once registered, export credits appear on your bills automatically`,
  },

  // =========================================================================
  // SE SYSTEMS ONE STOP SHOP — DEEP RETROFIT PROCESS
  // =========================================================================
  {
    topics: [
      'how does it work', 'installation process', 'what happens next',
      'deep retrofit', 'one stop shop', 'whole home upgrade', 'seai one stop shop',
      'how long does it take', 'retrofit process', 'survey to install',
    ],
    systems: ['solar_pv', 'heat_pump', 'general'],
    content: `SE SYSTEMS ONE STOP SHOP — HOW IT WORKS:
SE Systems is an SEAI-registered One Stop Shop, meaning they manage the entire upgrade journey for you.

THE 7-STEP PROCESS:
1. Contact — Fill in a form at sesystems.ie or call 021 439 7938. Response within 24 hours to schedule a site survey.

2. Site Survey — An SE Systems assessor visits your home. They assess roof orientation, structural condition, shading, electrical infrastructure, and heating system. This forms the basis for your design.

3. Design & Quote — Detailed system design using OpenSolar software. Clear, no-obligation quote with transparent pricing (no hidden fees).

4. SEAI Grant Application — SE Systems applies for all applicable grants on your behalf. SEAI typically approves within minutes. IMPORTANT: Works cannot start until grant approval is received.

5. ESB NC6 Form — For solar PV, SE Systems submits the NC6 form to ESB Networks. ESB has 20 working days to process. This triggers your free smart meter installation (ESB aims to install within 4 months).

6. Installation — In-house team installs your system (typically 1–2 days for residential solar). Full handover with system walkthrough. All compliance certificates provided.

7. Post-Installation — Post-works BER assessment, final grant paperwork, monitoring app setup, and ongoing support.

DOCUMENTS YOU RECEIVE AT HANDOVER:
- Safe Electric certificate
- Product warranties (panels, Huawei inverter, Huawei battery, Zappi)
- System manual
- OpenSolar / FusionSolar monitoring login
- NC6 form confirmation
- Pre- and post-works BER certificates
- SEAI grant paperwork

GRANTS ARE DEDUCTED UPFRONT — you pay only the balance (not the full cost + wait for a refund).

PLANNING PERMISSION: Not required for most residential rooftop solar (since October 2022). Exceptions: protected structures, Architectural Conservation Areas, and within 5 km of airports.`,
  },

  // =========================================================================
  // BER RATING — WHAT IT MEANS
  // =========================================================================
  {
    topics: [
      'ber rating', 'ber certificate', 'ber assessment', 'energy rating',
      'what is ber', 'my ber rating', 'improve ber', 'ber a rating', 'ber b rating',
      'building energy rating', 'a1 a2 a3', 'home energy rating',
    ],
    systems: ['general'],
    content: `BER RATING — BUILDING ENERGY RATING:
A BER (Building Energy Rating) measures how energy-efficient your home is, similar to the energy label on a fridge.

THE SCALE:
A1 (best) → A2 → A3 → B1 → B2 → B3 → C1 → C2 → C3 → D1 → D2 → E1 → E2 → F → G (worst)

WHY IT MATTERS FOR YOUR HOME:
- SEAI grants for deep retrofit (heat pumps, insulation) require a post-works BER of at least B2
- SE Systems' deep retrofit approach targets B2 minimum, with many homes achieving A1–A2
- Example: Grange Housing Association properties improved from D1 to A2 with SE Systems
- A higher BER means lower heating costs and is required for SEAI grant qualification

FOR HEAT PUMP QUALIFICATION:
- Your home's Heat Loss Indicator (HLI) must be ≤2.3 W/(K·m²) to qualify for the heat pump grant
- SE Systems' deep retrofit approach insulates the home first, then installs the heat pump — this ensures the home qualifies and the pump is sized optimally (smaller, cheaper pump for a well-insulated home)

AFTER YOUR SE SYSTEMS RETROFIT:
- A post-works BER assessment is arranged by SE Systems and is required to release the SEAI grant payment
- SEAI grant for the assessment: €50
- Keep your BER certificates — they increase your home's resale value (A-rated homes sell for up to 10% more)`,
  },

];

/**
 * Get SE Systems-specific knowledge entries relevant to a message.
 * These supplement (or override) the generic care-knowledge entries.
 */
export function getSeSystemsKnowledge(
  message: string,
  systemType?: string
): CareKnowledgeEntry[] {
  const lower = message.toLowerCase();
  const matched: CareKnowledgeEntry[] = [];

  for (const entry of SE_SYSTEMS_KNOWLEDGE) {
    const topicMatch = entry.topics.some(
      (topic) => lower.includes(topic.toLowerCase())
    );
    if (!topicMatch) continue;

    if (systemType) {
      const normalised = systemType.replace('-', '_').toLowerCase();
      const systemMatch =
        entry.systems.includes(normalised) || entry.systems.includes('general');
      if (!systemMatch) continue;
    }

    matched.push(entry);
  }

  return matched.slice(0, 3);
}

/**
 * Returns the SE Systems installer context block for the system prompt.
 * Always included when an SE Systems installation is detected.
 */
export function getSeSystemsInstallerContext(): string {
  return `INSTALLER: SE Systems (Sustainable Energy Systems)
- Ireland's largest deep retrofit energy upgrade provider
- Technology stack: Huawei SUN2000 inverters | Huawei LUNA2000 batteries | Huawei FusionSolar monitoring | Astronergy / Trina Solar panels | MyEnergi Zappi EV chargers | Mitsubishi Electric heat pumps
- ⚠️ This installer uses HUAWEI inverters — not SolarEdge. All troubleshooting must reference Huawei FusionSolar and SUN2000 series.
- Contact: 021 439 7938 | info@sesystems.ie | sesystems.ie
- SEAI One Stop Shop: handles all grant applications; grants deducted upfront`;
}

/**
 * Detect if an installation is from SE Systems based on component specs
 * or installer metadata in the installation record.
 */
export function isSeSystemsInstallation(installation: Record<string, any>): boolean {
  if (!installation) return false;

  // Check installer name fields
  const installerFields = [
    installation.installer_name,
    installation.installer_slug,
    installation.tenant_name,
  ];
  if (installerFields.some(f => f && f.toLowerCase().includes('se systems'))) {
    return true;
  }

  // Check inverter model for Huawei (strong signal)
  const inverterModel = (installation.inverter_model || installation.system_model || '').toLowerCase();
  if (inverterModel.includes('huawei') || inverterModel.includes('sun2000')) {
    return true;
  }

  // Check component specs
  const specs = installation.component_specs || installation.system_specs || {};
  const inverter = (specs.inverter || '').toLowerCase();
  if (inverter.includes('huawei') || inverter.includes('sun2000')) {
    return true;
  }

  // Check for Astronergy panels (SE Systems-specific brand)
  const panels = (specs.panels || installation.panel_model || '').toLowerCase();
  if (panels.includes('astronergy')) {
    return true;
  }

  return false;
}
