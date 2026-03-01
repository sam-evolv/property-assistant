/**
 * Ireland Renewable Energy — Homeowner Knowledge Base
 *
 * Generic Irish homeowner knowledge applicable across all installers.
 * This supplements (and is supplemented by) installer-specific knowledge
 * (e.g. seSystemsKnowledge.ts).
 *
 * Source: "Residential Renewable Energy Systems for Irish Homeowners"
 * research brief (March 2026) — grounded in SEAI, ESB Networks, Revenue,
 * CRU, and CSO primary sources.
 *
 * ⚠️ Volatile sections (flag for periodic review):
 *   - Electricity import prices
 *   - CEG export rates
 *   - SEAI grant amounts/terms
 *   - Supplier tariff structures
 *   - ESB Networks connection processes
 */

import { CareKnowledgeEntry } from './care-knowledge';

export const IRELAND_RENEWABLE_KNOWLEDGE: CareKnowledgeEntry[] = [

  // =========================================================================
  // SOLAR PV — HOW IT WORKS
  // =========================================================================
  {
    topics: [
      'how does solar work', 'how does solar pv work', 'how do solar panels work',
      'what does an inverter do', 'dc ac solar', 'why do i need an inverter',
      'explain solar', 'solar basics', 'how does it work',
    ],
    systems: ['solar_pv'],
    content: `HOW SOLAR PV WORKS:
Solar panels generate DC (direct current) electricity when daylight hits the cells. An inverter converts that DC into 230V AC electricity — the same type used by all your normal appliances and circuits.

Key points for Irish homeowners:
- Generation happens during daylight only, with peak output around midday
- Most generation occurs when many people are out of the house
- Ireland gets enough daylight year-round for solar to make financial sense — it's not just about sunny days

INVERTER TYPES (what you might have):
- String inverter: panels wired in strings to one central inverter (most common)
- Hybrid inverter: string inverter + battery management built in (needed if you add a battery)
- Microinverters: one small inverter per panel (more resilient to shading; higher cost)
- DC optimisers: small devices per panel to reduce shading losses on a string system

From a homeowner perspective the biggest differences are: whether adding a battery later is easy; how good the monitoring is; and how the system handles shading.

ANTI-ISLANDING (important Irish safety rule):
Your inverter must disconnect automatically during a power cut — this is a legal requirement under Irish grid connection rules (I.S. EN 50549-1). This means solar will not power your home during an outage unless your system was specifically designed with backup hardware.`,
  },

  // =========================================================================
  // SOLAR PERFORMANCE — SEASONAL EXPECTATIONS
  // =========================================================================
  {
    topics: [
      'how much solar will i generate', 'solar output', 'solar production',
      'expected generation', 'solar in winter', 'solar in summer', 'seasonal solar',
      'monthly solar output', 'how much will my panels produce', 'solar yield',
      'kWp', 'kwp explained', 'specific yield', 'performance expectations',
      'why is my solar low in winter', 'winter solar output',
    ],
    systems: ['solar_pv'],
    content: `SOLAR PERFORMANCE IN IRELAND — WHAT TO EXPECT:

SEAI confirms approximately 75% of annual solar output is produced between May and September. Winter months are predictably and significantly lower — this is normal, not a fault.

Average daily generation by month (south-facing, 35° tilt, Dublin reference):
| Month     | 3 kWp | 4 kWp | 5 kWp | 6 kWp |
|-----------|-------|-------|-------|-------|
| January   |  3.6  |  4.8  |  6.0  |  7.2  |
| February  |  5.7  |  7.5  |  9.4  | 11.3  |
| March     |  8.3  | 11.1  | 13.9  | 16.7  |
| April     | 10.8  | 14.4  | 18.0  | 21.6  |
| May       | 12.0  | 16.0  | 20.0  | 24.0  |
| June      | 11.7  | 15.6  | 19.6  | 23.5  |
| July      | 11.0  | 14.6  | 18.3  | 21.9  |
| August    | 10.0  | 13.3  | 16.7  | 20.0  |
| September |  8.9  | 11.9  | 14.8  | 17.8  |
| October   |  6.1  |  8.1  | 10.1  | 12.2  |
| November  |  4.5  |  6.0  |  7.5  |  8.9  |
| December  |  3.3  |  4.4  |  5.5  |  6.6  |

HONEST NOTE: Sales pitches often say "5–8× summer vs winter". For typical monthly averages in Ireland, the ratio is closer to 3–4× (May vs December above). The "×8" figure cherry-picks extremely bright summer weeks vs very dull winter weeks — not representative of real month-to-month performance.

FACTORS THAT AFFECT YOUR OUTPUT:
- Orientation: South is best for annual yield. East–west splits improve morning/evening but may reduce annual total
- Tilt: ~30–35° is commonly used in Irish modelling
- Shading: even small patches of shade can significantly reduce output on string systems
- Soiling: rain helps, but coastal salt spray or bird activity may justify periodic cleaning
- Temperature: output actually falls slightly in very hot conditions — Ireland's mild climate is an advantage here
- Degradation: ~0.3–0.5% per year — very gradual, by design`,
  },

  // =========================================================================
  // SELF-CONSUMPTION — MAXIMISING WITHOUT A BATTERY
  // =========================================================================
  {
    topics: [
      'self consumption', 'self-consumption', 'maximise solar use',
      'use more of my solar', 'make the most of solar', 'solar without battery',
      'immersion diverter', 'solar diverter', 'best time to use appliances',
      'when to use washing machine solar', 'solar tips', 'save more with solar',
    ],
    systems: ['solar_pv'],
    content: `MAXIMISING SELF-CONSUMPTION (WITHOUT A BATTERY):
The more solar electricity you use yourself (instead of exporting), the more you save — because you're displacing imports at ~35c/kWh rather than earning export rates of 15–25c/kWh.

Core idea: match flexible loads to when your solar peaks (late morning through early afternoon in Ireland).

PRACTICAL ACTIONS:
1. Washing machine & dishwasher: run during late morning or early afternoon on sunny/partly cloudy days
2. Tumble dryer: same — only when unavoidable and during solar hours
3. Dehumidifiers: put on smart plugs/timers for daytime operation
4. Immersion diverter (very common in Irish installs): automatically diverts surplus solar into your hot water tank — often the best investment alongside panels. Popular brands: myenergi Eddi, iBoost
5. EV charging: if you have an EV, schedule or use a solar-aware charging mode (e.g., Zappi Eco/Eco+ mode) to charge during solar generation hours

SELF-CONSUMPTION vs SELF-SUFFICIENCY:
- Self-consumption rate: % of your solar that you use (aim high — 40–60% is good without a battery)
- Self-sufficiency rate: % of your total electricity that comes from solar (depends on system size and usage)

SEASONAL STRATEGY:
- Summer: prioritise daytime loads; accept some export (bonus income)
- Winter: generation is too low to rely on; focus on heat pump efficiency and tariff optimisation`,
  },

  // =========================================================================
  // ELECTRICITY BILL WITH SOLAR — UNDERSTANDING IMPORT/EXPORT
  // =========================================================================
  {
    topics: [
      'electricity bill solar', 'bill with solar', 'import export',
      'how does my bill work with solar', 'export payment', 'selling electricity',
      'clean export guarantee', 'ceg', 'feed in tariff', 'microgeneration scheme',
      'mss', 'nc6', 'smart meter solar', 'export meter',
    ],
    systems: ['solar_pv', 'general'],
    content: `UNDERSTANDING YOUR ELECTRICITY BILL WITH SOLAR:
Your bill now has two flows:
- IMPORT: kWh you buy from your supplier (at the standard unit rate, ~36c/kWh in early 2026)
- EXPORT: surplus kWh sent to the grid — you earn the Clean Export Guarantee (CEG) rate

HOW TO GET PAID FOR EXPORT (Clean Export Guarantee):
1. Your installer must submit an NC6 form to ESB Networks — this is the microgeneration connection notification
2. ESB Networks processes this within 20 working days and triggers a smart meter upgrade (free; ESB aims to install within 4 months)
3. Contact your electricity supplier and register for the Micro-generation Support Scheme / CEG
4. Export credits then appear on your electricity bills (typically quarterly or every 2 months)
5. First €400/year of CEG income is tax-free (Revenue guidance)

THE MOST IMPORTANT PRINCIPLE:
Self-consumption (saving imports at ~35c/kWh) is almost always more valuable than export earnings (15–25c/kWh depending on your supplier). Prioritise using solar at home first; export is a bonus.

MPRN (Meter Point Reference Number):
Find this on your electricity bill — you'll need it for SEAI grant applications and supplier processes.

METER TYPES:
- Standard 24-hour: one rate all day
- Day/night: lower rate overnight (can be combined with EV charging strategy)
- Smart meter: enables real-time data, export measurement, and time-of-use tariffs`,
  },

  // =========================================================================
  // BATTERY STORAGE — HOW IT WORKS AND SIZING
  // =========================================================================
  {
    topics: [
      'how does a battery work', 'home battery', 'battery storage explained',
      'do i need a battery', 'should i get a battery', 'battery sizing',
      'how big a battery', 'what size battery', 'lfp lithium', 'battery chemistry',
      'battery degradation', 'battery warranty explained', '10 year battery warranty',
      'battery capacity',
    ],
    systems: ['battery'],
    content: `HOME BATTERY STORAGE — HOW IT WORKS:
A battery stores surplus solar electricity as chemical energy and releases it when you need it.

Typical daily cycle:
1. Morning: battery may have some charge from overnight (TOU) or be at minimum reserve
2. During solar peak: surplus beyond what your home uses charges the battery
3. Evening: battery discharges to cover your home as solar drops off
4. Night: battery continues discharging until empty or minimum reserve level
5. If battery runs flat: your home seamlessly switches to grid import (no disruption)

BATTERY CHEMISTRY — WHAT YOU'LL SEE ON SPEC SHEETS:
- LFP (Lithium Iron Phosphate): thermally stable, longer cycle life, physically larger per kWh — the preferred choice for home installations (Huawei LUNA2000, Pylontech, GivEnergy)
- NMC (Nickel Manganese Cobalt): more compact/energy-dense; thermal management is critical — used in some home products and most EV batteries

HONEST SIZING GUIDE:
Size based on the evening/overnight consumption you want to shift — not total annual use.

- 5 kWh usable: covers modest evening loads (lighting, TV, router, basic cooking). Not "whole house".
- 10 kWh usable: covers most evening/night loads for a family in shoulder seasons
- 15 kWh+: only rational for high evening loads, large PV systems with significant export, or time-of-use arbitrage — accept longer payback

UNDERSTANDING "10-YEAR WARRANTY AT 60%":
This means the manufacturer guarantees the battery retains at least 60% of its original usable capacity after 10 years under defined conditions. It does NOT mean the battery stops working at year 10 — it means you'll have reduced runtime. Batteries typically remain usable at lower capacity for many more years.

MAXIMISING BATTERY LIFE:
- Avoid routinely sitting at 100% SOC for extended periods if your system has adaptive control
- Keep the installation environment within the manufacturer's specified temperature range
- Prefer moderate cycling over aggressive forced grid-charging unless economically justified`,
  },

  // =========================================================================
  // BATTERY OPERATING MODES
  // =========================================================================
  {
    topics: [
      'battery modes', 'battery settings', 'self consumption mode',
      'time of use battery', 'tou battery', 'battery schedule',
      'battery backup', 'power cut battery', 'backup mode battery',
      'forced charge', 'battery not working correctly', 'battery mode explained',
    ],
    systems: ['battery'],
    content: `BATTERY OPERATING MODES — EXPLAINED:

MAXIMISE SELF-CONSUMPTION (recommended for most Irish homes):
- Charges from solar surplus first
- Discharges in the evening to cover your home
- Only exports to grid after battery is full
- Best for: most Irish homeowners who want simple, efficient operation

TIME-OF-USE (TOU) ARBITRAGE:
- Charges from the grid at cheap overnight rates (e.g., night rate or EV tariff)
- Discharges during peak/standard rate hours
- Savings are real but volatile — they depend on tariff structure which changes
- Best for: homes on night-rate or smart tariffs with significant spread between peak and off-peak

BACKUP POWER:
- Designed to power your home during a grid outage
- Important: NOT automatically included in every battery installation
- Requires specific hardware and grid isolation configuration
- Your standard solar/battery system will shut down during a power cut (anti-islanding) unless backup was specifically included
- Ask your installer if backup capability was part of your installation

FORCED CHARGE:
- Battery charges from grid regardless of solar
- Use case: before a forecast period of very low solar (bad weather), or before a known peak pricing period

WINTER STRATEGY:
- With low solar generation, TOU charging (overnight off-peak rates) often makes more sense than waiting for solar that may not come
- Align battery charging to your heating schedule if you have a heat pump`,
  },

  // =========================================================================
  // HEAT PUMP — OPERATION AND SETTINGS
  // =========================================================================
  {
    topics: [
      'how does a heat pump work', 'heat pump explained', 'cop scop',
      'heat pump efficiency', 'heat pump settings', 'weather compensation',
      'heat pump temperature', 'flow temperature', 'heat pump schedule',
      'heat pump in winter', 'heat pump defrost', 'heat pump cold weather',
      'heat pump not working properly',
    ],
    systems: ['heat_pump'],
    content: `HOW AIR-TO-WATER HEAT PUMPS WORK:
A heat pump moves heat from outdoor air into your home's water-based heating system (radiators or underfloor heating) using a refrigeration cycle — like a fridge in reverse. It moves heat rather than creating it, which is why it's so efficient.

COP and SCOP:
- COP (Coefficient of Performance): e.g. COP 3.5 = 3.5 units of heat for 1 unit of electricity consumed
- SCOP (Seasonal COP): efficiency across the full heating season — more representative for Irish conditions

OPTIMAL SETTINGS FOR IRELAND:
1. Weather compensation: Keep this ENABLED. It automatically adjusts the flow temperature based on outdoor temperature — the most important efficiency setting. Most heat pump problems trace back to this being misconfigured.

2. Indoor setpoint: 20–21°C. Every degree above 20°C adds roughly 6–8% to running costs. Avoid large daily temperature swings — heat pumps run most efficiently at stable setpoints.

3. Hot water cylinder: Set to 55–60°C. Programme to heat once per day (typically early morning). Never set permanently below 60°C (legionella risk). Align with solar generation where possible.

4. Avoid overusing the immersion boost: The immersion is 100% efficient (1 kW in = 1 kW of heat). The heat pump is 300–400% efficient. Use immersion only when the heat pump cannot meet demand, not as a convenience habit.

5. TRVs (thermostatic radiator valves): Keep these OPEN in rooms you use. Closing too many TRVs forces high pressure in the system and causes short cycling (the pump keeps turning on and off). If you want a cooler room, reduce slightly — don't fully close.

DEFROST CYCLES (NORMAL — NOT A FAULT):
In damp, cold Irish conditions (below ~5°C), the outdoor unit will periodically defrost. You may notice a brief pause in heating (10–15 minutes) and possibly some steam or noise from the outdoor unit. This is completely normal.

HEAT LOSS INDICATOR (HLI):
SEAI uses HLI to measure how quickly a home loses heat (lower is better). Threshold for certain grants: ≤2.3 W/K·m². If your home's HLI is too high, a heat pump will run inefficiently, with high flow temperatures and higher bills — this is a design/fabric issue, not a pump fault.`,
  },

  // =========================================================================
  // HEAT PUMP — HIGH BILLS / COLD ROOMS
  // =========================================================================
  {
    topics: [
      'heat pump high bills', 'heat pump expensive', 'heat pump bills too high',
      'heat pump not heating room', 'cold rooms heat pump', 'radiators not warm',
      'heat pump underperforming', 'heat pump not efficient',
      'heat pump running costs', 'why is my heat pump costing so much',
    ],
    systems: ['heat_pump'],
    content: `HIGH BILLS OR COLD ROOMS WITH A HEAT PUMP — DIAGNOSIS GUIDE:
Most heat pump performance issues are settings and design issues, not equipment faults.

COMMON CAUSES OF HIGH BILLS:
1. Flow temperature too high: If the flow temperature is set too high (above what weather compensation recommends), the system works harder and the COP drops. Check what flow temp your system is running at and compare to the compensation curve.
2. Immersion overuse: The immersion uses ~3× more electricity for the same heat output vs the pump. If someone is pressing "boost" regularly, this drives bills up significantly.
3. Incorrect weather compensation curve: If the curve is set too steep, the system runs higher temperatures than needed. Your installer should tune this during a winter visit.
4. Home not meeting the design heat loss: If insulation improvements weren't done before the heat pump was installed, the home may lose heat faster than the design assumed.
5. Tariff mismatch: A heat pump on a single-rate day tariff (~36c/kWh) costs more to run than one on a night-rate tariff for heating periods — check your tariff structure.

COMMON CAUSES OF COLD ROOMS:
1. Radiators undersized for low-temperature operation: Heat pumps run at ~35–45°C flow temperature vs a boiler at 60–75°C. If radiators weren't upsized when the pump was installed, some rooms may feel cooler.
2. TRVs closed or turned down too far: Check all thermostatic radiator valves in cold rooms — they may be too restrictive.
3. Zone issues: If the house is zoned, check the schedule for that zone is set correctly.
4. Underfloor heating (UFH): UFH heats slowly and retains heat well — it shouldn't be dropped overnight and then reheated (takes much longer than radiators, costs more energy).

IF STILL ABNORMAL AFTER CHECKING SETTINGS:
Request an installer commissioning review — controls calibration and system balancing often resolve issues that look like equipment faults.`,
  },

  // =========================================================================
  // EV CHARGING — SMART FEATURES AND SOLAR INTEGRATION
  // =========================================================================
  {
    topics: [
      'ev charger solar', 'charge ev from solar', 'solar ev charging',
      'smart ev charging', 'ev charger schedule', 'night rate ev charging',
      'ev charger modes', 'eco mode ev', 'ev charging cheapest time',
      'how does ev charger work', 'wallbox solar', 'zappi solar modes',
      'ev charger tips',
    ],
    systems: ['ev_charger'],
    content: `EV CHARGING — SMART FEATURES EXPLAINED:

CHARGING MODES (your charger will have some or all of these):
- Fast/Boost mode: charges at full speed from the grid — ignores solar output. Use when you need a quick charge.
- Eco mode: uses solar surplus first, tops up from the grid when needed — maintains a minimum charge rate.
- Eco+ / Solar only mode (e.g., Zappi Eco+): waits until there is enough solar surplus to charge entirely from solar. May delay the start significantly on cloudy days.

SOLAR SURPLUS CHARGING (the smart approach):
When you have a solar diverting charger (like the Zappi), the charger talks to your solar system and automatically uses surplus generation. In Eco mode:
- On a sunny day: may charge at 3–7 kW from solar, topping up with minimal grid import
- On a cloudy day: mostly charges from the grid at the minimum available current
- In Eco+ mode on a cloudy day: may not charge at all (waiting for solar)

NIGHT-RATE CHARGING (alternative/complementary strategy):
If you're on a day/night tariff or smart tariff:
- Schedule overnight charging for the cheap rate window (e.g., 11pm–8am depending on your supplier)
- Best for: homes that need a reliable full charge by morning regardless of solar

COMBINING SOLAR + NIGHT RATE:
- Summer: prioritise Eco mode during the day to maximise solar self-consumption
- Winter: solar contribution is minimal; schedule overnight charging as primary strategy

VEHICLE-SIDE SCHEDULES:
Many EVs have their own built-in charging schedules set via the car's infotainment or app. These can override your charger's schedule — always check the vehicle settings if the car isn't charging when expected.

ESB NETWORKS NOTE:
EV chargers should be selected from the ESB Networks LCT register (from January 2025) to ensure grid compliance.`,
  },

  // =========================================================================
  // MVHR — MAINTENANCE AND TROUBLESHOOTING
  // =========================================================================
  {
    topics: [
      'mvhr', 'mvhr filter', 'mvhr maintenance', 'ventilation system',
      'mechanical ventilation', 'heat recovery ventilation', 'mvhr noise',
      'mvhr boost mode', 'how to clean mvhr', 'mvhr condensation',
      'mvhr not working', 'ventilation Ireland', 'why is ventilation important',
      'mvhr grille', 'fresh air system',
    ],
    systems: ['mvhr', 'general'],
    content: `MVHR (MECHANICAL VENTILATION WITH HEAT RECOVERY) — HOMEOWNER GUIDE:

WHY MVHR MATTERS:
Modern well-insulated homes are airtight — which is great for energy efficiency but means natural ventilation (draughts, window gaps) no longer removes moisture and pollutants automatically. MVHR replaces this with controlled, efficient ventilation. Covered under Ireland's Building Regulations Part F (Ventilation).

HOW YOUR SYSTEM WORKS:
1. EXTRACTS stale, humid air from kitchens and bathrooms (wet rooms)
2. SUPPLIES fresh air to living rooms and bedrooms
3. TRANSFERS heat from the warm extracted air to the incoming cold fresh air (via a heat exchanger) — recovering 70–85% of the heat that would otherwise be lost
4. Result: fresh air throughout the house without losing the heat you've paid for

YOUR MOST IMPORTANT MAINTENANCE TASK — FILTERS:
Filters are the single biggest maintenance item. Blocked filters reduce airflow, increase energy use, and can cause condensation issues.

- Replace or clean filters: every 3–6 months depending on your environment (pets, dusty area, or near building sites = more frequent)
- Most units have two filter locations: extract side and supply side — check both
- Replacement filters are available from your installer or directly from the manufacturer (Vent-Axia, Zehnder, etc.)
- Signs of overdue filter change: reduced airflow from supply vents, increased condensation on windows, or the unit working harder/louder

OTHER REGULAR CHECKS:
- Keep all supply and extract grilles unobstructed — don't block them with furniture or clothes
- Use BOOST mode during cooking and showers (often a button on the wall controller)
- Listen for unusual noise — banging or grinding suggests a fan issue; contact installer
- Persistent condensation on windows despite MVHR running = possible filter blockage, balancing issue, or system fault — contact installer

DO NOT:
- Turn the MVHR unit completely off for extended periods (the house needs ventilation)
- Block vents or grilles
- Attempt to access the unit internals or fans yourself`,
  },

  // =========================================================================
  // SEAI GRANTS — GENERIC IRELAND (2026)
  // =========================================================================
  {
    topics: [
      'seai grants', 'government grants', 'retrofit grants', 'energy grants ireland',
      'what grants am i entitled to', 'how much grant', 'insulation grant',
      'attic insulation grant', 'wall insulation grant', 'windows grant',
      'doors grant', 'seai 2026', 'grant eligibility', 'one stop shop seai',
    ],
    systems: ['general', 'solar_pv', 'heat_pump'],
    content: `SEAI GRANTS — 2026 GUIDE (Updated February/March 2026):
Ireland allocated €558 million to SEAI for residential retrofits in Budget 2026. Major increases took effect 3 February 2026.

SOLAR PV GRANT: up to €1,800
- First 2 kWp: €700/kWp = €1,400
- Each additional kWp (2–4 kWp): €200/kWp = up to €400
- 0% VAT on solar panel supply and installation
- Home must be built and occupied before 31 December 2020

HEAT PUMP GRANTS: up to €12,500 (house)
- Heat pump unit: €6,500
- Central heating upgrades (radiators/pipework): €2,000
- Renewable Heat Bonus (replacing fossil fuel/electric storage heating): €4,000
- Heat Loss Indicator must be ≤2.3 W/K·m² to qualify
- VAT on heat pumps: 9% (reduced from 23% on 1 January 2025)

WINDOWS & DOORS GRANT (applications open 2 March 2026):
- Windows: Apartment €1,500 | Mid-terrace €1,800 | Semi-D €3,000 | Detached €4,000
- External doors: €800 per door, maximum 2 doors
- Technical requirement: U-value ≤1.4 W/m²K; post-works BER required

WALL INSULATION GRANTS:
- Cavity wall: Apartment €700 | Mid-terrace €850 | Semi-D €1,300 | Detached €1,800
- Internal wall (dry lining): Apartment €1,500 | Mid-terrace €2,000 | Semi-D €3,500 | Detached €4,500
- External wall: Apartment €3,000 | Mid-terrace €3,500 | Semi-D €6,000 | Detached €8,000

ATTIC INSULATION: up to €2,000 (detached); first-time buyers up to €2,500 from 2 March 2026

EV CHARGER GRANT: €300 (reduced from €600 on 1 January 2024)

OTHER:
- Heating controls upgrade: €700
- BER assessment: €50

⚠️ CRITICAL RULE: Work must NOT begin before SEAI grant approval. Any works or purchases before the approval date make the application ineligible.

HOW TO APPLY:
- Through a One Stop Shop (like SE Systems): they manage everything; grant deducted upfront
- Self-managed: apply at seai.ie → receive approval → hire contractors → complete works within 8 months → submit claim → receive payment (2–6 weeks via EFT)`,
  },

  // =========================================================================
  // CLEAN EXPORT GUARANTEE — RATES
  // =========================================================================
  {
    topics: [
      'export rate', 'export tariff', 'ceg rate', 'clean export guarantee rate',
      'best export rate', 'which supplier pays most for export', 'solar export ireland',
      'how much will i get for export', 'sell electricity ireland',
      'microgeneration payment',
    ],
    systems: ['solar_pv'],
    content: `CLEAN EXPORT GUARANTEE (CEG) — RATES (early 2026 snapshot):
⚠️ Export rates are volatile — suppliers change them with notice periods. Always verify directly with your supplier.

CURRENT RATES (early 2026):
| Supplier       | Export Rate (c/kWh) |
|----------------|---------------------|
| Pinergy        | 25.0c               |
| Community Power| 20.0c               |
| Electric Ireland | 19.5c             |
| SSE Airtricity | 19.5c               |
| Bord Gáis Energy | 18.5c            |
| Energia        | 18.5c               |
| Flogas         | 18.5c               |
| PrepayPower    | 15.89c              |

HOW PAYMENTS WORK:
- Export income is credited on your electricity bill (quarterly for most, bimonthly for some)
- You need a smart meter — your installer's NC6 submission triggers this process
- First €400/year of CEG income is tax-free (Revenue guidance)
- Export income is secondary to the value of self-consumption — saving imports at ~36c/kWh beats earning 15–25c/kWh for export

TO REGISTER:
Contact your electricity supplier and ask to be registered for the Micro-generation Support Scheme / Clean Export Guarantee.`,
  },

  // =========================================================================
  // POWER CUTS — ANTI-ISLANDING
  // =========================================================================
  {
    topics: [
      'power cut solar', 'power outage solar', 'does solar work in power cut',
      'solar power cut ireland', 'anti islanding', 'grid down solar',
      'power restored solar', 'restart after power cut', 'inverter power cut',
      'blackout solar',
    ],
    systems: ['solar_pv', 'battery'],
    content: `POWER CUTS AND SOLAR — WHAT HAPPENS:
Standard grid-connected solar PV WILL SHUT DOWN during a power cut. This is not a fault — it is a legal safety requirement under Irish grid connection rules (anti-islanding). The inverter must disconnect from the grid to prevent it energising cables that ESB Networks workers may be working on.

What this means in practice:
- During a power cut: your solar panels stop generating, your inverter goes offline, and your home runs on nothing (or battery backup if installed)
- Standard solar + battery: the battery will also shut down unless the system was specifically designed with approved backup hardware and grid isolation (a "backup mode" or "off-grid" configuration)
- Ask your installer if your system was set up with backup capability — it is not automatic

WHEN POWER RETURNS:
1. Wait 2–5 minutes for the grid to stabilise
2. Your inverter should reconnect automatically and begin generating again
3. Check the monitoring app — it should show power coming back online
4. If the inverter shows a fault code after power is restored: record the code and contact your installer

AFTER A SEVERE STORM:
- Visually inspect panels from ground level for obvious damage
- Check that mounting brackets and structure look undamaged
- If generation is noticeably lower than expected in the days after, contact your installer for an inspection`,
  },

  // =========================================================================
  // UNIVERSAL TROUBLESHOOTING — DECISION TREES
  // =========================================================================
  {
    topics: [
      'solar not working', 'system not generating', 'panels not producing',
      'zero generation', 'no solar output', 'solar stopped working',
      'system fault', 'troubleshoot solar', 'solar problem',
    ],
    systems: ['solar_pv'],
    content: `SOLAR NOT GENERATING — STEP-BY-STEP:

Step 1: Is it daytime (not dusk, night, or heavily overcast)?
→ Night or very overcast: normal. PV generates from daylight — even overcast skies produce some output, but near-zero output on a very dull day is expected.

Step 2: Check your monitoring app
→ Does it show any "today's yield" or "current power" above zero?
→ If yes: system is generating. The issue may be less than expected — compare to the monthly table for your system size and this time of year.
→ If completely zero on a reasonable daylight day: continue.

Step 3: Is the issue only monitoring (no data in app), or truly zero generation?
→ If only monitoring is missing: follow the "monitoring no data" guide. Generation may still be happening.
→ If generation itself is zero: continue.

Step 4: Check your inverter (do not open any covers or touch wiring)
→ Is there any fault code or error message on the display or in the app?
→ Record the EXACT code and message. Contact your installer.
→ If the display shows "waiting" or "standby" on a bright day: the grid may not be present or the system may be in startup mode — wait 15 minutes.

Step 5: Check the consumer unit (fuse board)
→ Look for a breaker labelled "Solar", "PV", or "Inverter"
→ If tripped (middle or OFF position): reset it ONCE. If it trips again immediately, stop — call your installer.

Step 6: If inverter has no lights/display at all and the breaker is on
→ Call your installer. This indicates a possible supply fault or internal inverter fault.

⚠️ ESCALATE IMMEDIATELY (do not attempt to fix yourself):
- Burning smell, discoloration, or arcing sounds near any equipment
- Water ingress into electrical equipment
- Repeated breaker tripping
- "Isolation fault" or "Earth fault" alarm
- Inverter dead with all breakers on`,
  },

  {
    topics: [
      'high electricity bill solar', 'solar not saving money', 'bills not going down',
      'bill shock solar heat pump', 'expensive electricity despite solar',
      'why is my bill still high', 'solar not working for bills',
    ],
    systems: ['solar_pv', 'heat_pump', 'general'],
    content: `HIGH ELECTRICITY BILL DESPITE SOLAR OR HEAT PUMP — DIAGNOSIS:

Step 1: Is this an estimated bill or an actual meter read?
→ Estimated bills can be significantly wrong. Check when the meter was last actually read.

Step 2: Compare solar generation to seasonal expectations
→ Winter (November–February): generation is genuinely low — 3–6 kWh/day for a 4 kWp system. This is normal, not a fault. You will import more in winter.
→ If it's summer and generation looks low: check the monitoring app for trends and contact your installer if consistently below the monthly table benchmarks.

Step 3: Check your self-consumption rate
→ If you're generating good solar output but still importing heavily, you may be generating during the day while nobody is home — and importing for evening/night loads. Solutions: battery, immersion diverter, or running appliances during solar hours.

Step 4: If you have a heat pump — check these first
→ Is the immersion boost being used regularly? Switch to heat pump-only for hot water except for the weekly legionella cycle.
→ What is the flow temperature set to? If above 45°C, this significantly reduces efficiency.
→ Is weather compensation enabled and tuned?
→ Has a commissioning review been done since installation?

Step 5: Consider your electricity tariff
→ A time-of-use or day/night tariff can help significantly for heat pump users and EV owners — but the savings depend on your usage pattern.

Step 6: If everything above looks correct and bills are still abnormal
→ Request a commissioning review from your installer — control settings, system balancing, and design assumptions are the most common root cause.`,
  },

  // =========================================================================
  // SELLING A HOME WITH RENEWABLES
  // =========================================================================
  {
    topics: [
      'selling house solar', 'selling home heat pump', 'moving house solar',
      'transfer solar panels', 'new owner solar', 'handover documents solar',
      'documents when selling', 'what documents for solar', 'insurance solar',
      'home insurance renewable energy',
    ],
    systems: ['general'],
    content: `SELLING A HOME WITH RENEWABLE ENERGY SYSTEMS:
A good handover pack protects the buyer and demonstrates the value of what's installed.

MINIMUM DOCUMENTATION PACK FOR BUYERS:
1. SEAI grant documentation — the grant reference numbers and any post-works BER certificates (required under some SEAI grants)
2. Equipment warranties — panels (performance warranty valid for 25–30 years), inverter, battery, heat pump, EV charger
3. Equipment datasheets for all installed systems
4. Monitoring platform: login credentials transfer instructions for the new owner (OpenSolar, Huawei FusionSolar, etc.)
5. NC6 confirmation — the ESB Networks microgeneration connection notification (proof the system is grid-registered)
6. Installer commissioning sheets — particularly for microgeneration compliance and heat pump settings
7. BER certificates — pre- and post-works copies

MONITORING APP TRANSFER:
Contact your monitoring platform provider to transfer the account to the new owner. For Huawei FusionSolar: the new owner creates an account and the installer can reassign the plant. For OpenSolar: contact your installer.

INSURANCE:
If you haven't done so already, notify your home insurer about all installed renewable systems before listing the property. Your insurer may require proof of professional installation/certification. The new owner should similarly notify their insurer.

CESG EXPORT REGISTRATION:
The new owner will need to register with their electricity supplier for the Clean Export Guarantee if they wish to receive export payments. This is a straightforward process through the supplier.`,
  },

  // =========================================================================
  // COMMON MYTHS — IRELAND
  // =========================================================================
  {
    topics: [
      'solar myth', 'does solar work in ireland', 'solar cloudy weather',
      'planning permission solar ireland', 'solar facts', 'solar payback ireland',
      'is solar worth it ireland', 'misconceptions solar', 'export income solar',
    ],
    systems: ['solar_pv', 'general'],
    content: `COMMON MYTHS ABOUT SOLAR IN IRELAND — CORRECTED:

Myth: "Solar doesn't work in Ireland because it's too cloudy."
Reality: Solar panels generate from daylight, not direct sunshine. Ireland receives enough daylight for solar to be financially worthwhile year-round. Yes, output is lower than Spain — but Irish systems consistently achieve payback in 5–8 years. Approximately 75% of annual output comes from May to September.

Myth: "You always need planning permission for solar panels."
Reality: Domestic houses can install solar panels on most rooftops without planning permission under post-2022 Irish regulations. Exceptions: protected structures, Architectural Conservation Areas, and within 5 km of airports. Always verify if your home has a protected structure status.

Myth: "Export payments make solar a quick payback investment."
Reality: Export rates (15–25c/kWh) are lower than the import rate you're saving (≈36c/kWh). Self-consumption — using your solar electricity at home — is the primary financial driver. SEAI explicitly reflects this in their guidance around daytime generation and use. Export income is a helpful bonus, not the core case.

Myth: "Summer output is 8× winter."
Reality: For typical Irish monthly averages, the ratio is closer to 3–4× (e.g., May vs December). The "×8" figures cherry-pick unusually bright summer weeks against very dull winter weeks — not representative of real monthly averages.

Myth: "If the power goes out, solar will keep my home running."
Reality: Standard grid-connected solar automatically shuts down during a power cut (anti-islanding — a legal safety requirement). Backup power requires specific additional hardware configured at installation.

Myth: "The battery is fully usable at its rated capacity."
Reality: "Usable capacity" can differ from the nominal capacity on spec sheets. Warranty terms like "10 years at 60%" refer to a minimum capacity retention guarantee — the battery continues to function but with reduced runtime.`,
  },

  // =========================================================================
  // INVERTER LED MEANINGS & ERROR CODES — PER BRAND
  // =========================================================================
  {
    topics: [
      'inverter error code', 'inverter fault code', 'huawei error', 'fronius error',
      'solaredge error', 'inverter led', 'red light inverter', 'green light inverter',
      'blinking red inverter', '2032', '2062', '2064', 'state 107', 'state 307',
      'state 509', 'isolation fault solaredge', 'inverter alarm code',
      'what does the inverter light mean',
    ],
    systems: ['solar_pv'],
    content: `INVERTER ERROR CODES AND LED MEANINGS — BY BRAND:

HUAWEI SUN2000 (most common in Ireland):
LED states:
- Steady green → operating normally, feeding the grid ✅
- Blinking green (1s on/1s off) → standby/sleep mode — normal at dawn/dusk
- Steady red → hardware fault — contact installer
- Blinking red (fast) → environmental alarm: grid voltage issue or DC insulation fault

Key error codes:
- 2032 (Grid Loss): Inverter cannot detect the ESB grid. Check main AC isolator; check for power cut.
- 2062 (Low Insulation Resistance): Often triggered by moisture in DC connectors after heavy rain. If it persists in dry weather → wiring fault; call installer.
- 2064 (Device Fault): Internal circuit error — contact installer; cannot be resolved by homeowner reset.

SOLAREDGE (optimiser-based systems):
LED states:
- Green → production active
- Blue → communicating with SolarEdge monitoring portal
- Red → system error

⚠️ ISOLATION FAULT (Code 03x9a): Do NOT attempt to reset. This signals a grounding issue — potential fire risk. Requires professional inspection.

FusionSolar (Huawei monitoring) tip: The real-time energy flow diagram shows arrows indicating whether power is moving panels → battery, panels → home, or panels → grid. "Self-consumption ratio" is the key metric for Irish users.

mySolarEdge tip: The "Layout" view shows every individual panel's performance. A panel showing black or significantly lower yield than neighbours may indicate shading or a hotspot.

FRONIUS PRIMO / GEN24:
Key error states:
- State 107: Grid parameters outside limits — system waiting to stabilise; usually self-resolves.
- State 307: DC input voltage too low — normal at night or if panels covered with snow/heavy debris.
- State 509: No energy fed to grid for 24 hours — check all AC and DC breakers/isolators.

UNIVERSAL RULE: Never reset after an isolation fault, earth fault, or arc fault. These are safety-critical and require a qualified installer.`,
  },

  // =========================================================================
  // PANEL TECHNOLOGY COMPARISON
  // =========================================================================
  {
    topics: [
      'panel technology', 'solar panel types', 'topcon vs perc', 'hjt panels',
      'n-type solar', 'p-type solar', 'best solar panels', 'panel efficiency',
      'temperature coefficient', 'bifacial panels', 'monocrystalline', 'perc panels',
      'which solar panels are best', 'panel brands ireland',
    ],
    systems: ['solar_pv'],
    content: `SOLAR PANEL TECHNOLOGIES — 2026 IRISH MARKET:

TECHNOLOGY COMPARISON:
| Technology     | Efficiency | Temp Coefficient | Best For |
|----------------|-----------|-----------------|----------|
| Mono PERC      | 20–22%    | −0.35%/°C       | Budget/large roofs; being superseded |
| N-type TOPCon  | 22–24%    | −0.30%/°C       | Current Irish residential standard |
| HJT            | 24–26%    | −0.26%/°C       | High performance, limited roof space |
| Bifacial       | Variable  | N/A             | Ground mounts, light-coloured roofs |

THE 2026 STANDARD: N-type TOPCon has largely replaced P-type PERC in Irish residential installs. Better low-light performance and lower annual degradation than PERC.

TEMPERATURE COEFFICIENT EXPLAINED:
Lower (less negative) is better. A panel with −0.26%/°C loses less output as temperature rises. In Ireland's mild climate, this matters less than in southern Europe — but N-type still has the edge on dull, slightly warm days.

BIFACIAL IN IRELAND:
On a typical rooftop, bifacial gain is modest (the back of the panel faces the roof — limited reflectivity). Most beneficial on ground-mounted systems over light gravel or white membranes, where bifacial gain of 15–20% is achievable. Don't pay a significant premium for bifacial on a standard pitched roof.

WHAT TO CHECK ON A QUOTE:
- Wattage (W) per panel — current standard: 430–450W per module
- Brand tier (Tier 1 Bloomberg BNEF is the benchmark)
- Product warranty: 12–15 years
- Performance warranty: 25–30 years
- Annual degradation: ≤0.4% for premium N-type TOPCon

COMMON BRANDS IN IRELAND: JinkoSolar, LONGi, JA Solar, Trina Solar, Canadian Solar, Astronergy`,
  },

  // =========================================================================
  // BATTERY BRAND SPECS AND BACKUP GATEWAY
  // =========================================================================
  {
    topics: [
      'tesla powerwall', 'huawei luna2000', 'givEnergy battery', 'pylontech',
      'byd battery', 'battery brands', 'which battery is best', 'battery comparison',
      'round trip efficiency', 'battery backup box', 'backup gateway',
      'lfp cycle life', 'battery lifespan cycles',
    ],
    systems: ['battery'],
    content: `BATTERY BRANDS — 2026 SPECIFICATION REFERENCE:

| Brand     | Model           | Usable Capacity        | Notes |
|-----------|-----------------|------------------------|-------|
| Huawei    | LUNA2000-S1     | 6.9/13.8/20.7 kWh      | Modular; 15-year warranty |
| Tesla     | Powerwall 3     | 13.5 kWh               | Integrated hybrid inverter (20 kW solar input); 97.5% round-trip efficiency |
| GivEnergy | All-in-One      | 13.5 kWh               | Whole-home backup capable; silent (<30 dB) |
| Pylontech | US5000          | 4.8 kWh (per module)   | Modular rack-mount; stackable |
| BYD       | Premium HVS     | 5.1–12.8 kWh           | High-voltage modular stacking |

TESLA POWERWALL 3 (2026):
The Powerwall 3 is significant — it integrates a full hybrid inverter and accepts up to 20 kW of solar input. Its 97.5% round-trip efficiency means only 2.5% of energy is lost in the charge/discharge cycle. One of the highest efficiencies currently available for home batteries.

LFP vs NMC — THE KEY DIFFERENCE:
- LFP (used by all brands above): 6,000+ charge cycles; thermally stable; non-toxic
- NMC: 2,000–3,000 cycles; more compact; used in some EVs but less favoured for home storage
- In 2026, LFP is the correct chemistry for all new Irish home battery installations

BACKUP POWER — CRITICAL DISTINCTION:
Standard grid-tied batteries shut down during a power cut (anti-islanding). To have backup power:
1. You need a specific "Backup Box", "Gateway", or "Smart Energy Box" — installed at the time of setup
2. The system must be configured to isolate from the grid and power a backup circuit
3. This is NOT automatic and NOT included in standard battery installations
4. Ask your installer: "Does my system have backup capability?" before assuming it does.

If backup was not included, your battery will be offline during a power cut along with your solar panels.`,
  },

  // =========================================================================
  // HEAT PUMP REFRIGERANTS — R290 VS R32
  // =========================================================================
  {
    topics: [
      'r290', 'r32', 'heat pump refrigerant', 'heat pump radiators',
      'can heat pump work with existing radiators', 'radiator upgrade heat pump',
      'flow temperature heat pump', 'high temperature heat pump',
      'heat pump older home', 'retrofit heat pump radiators',
      'mitsubishi ecodan r290', 'vaillant arotherm r290',
    ],
    systems: ['heat_pump'],
    content: `HEAT PUMP REFRIGERANTS — R290 vs R32 (IMPORTANT FOR OLDER IRISH HOMES):

The 2026 transition to R290 (Propane) refrigerant is a major development for retrofit projects in older Irish homes.

WHY IT MATTERS FOR YOUR RADIATORS:
| Refrigerant | Max Flow Temperature | Radiator Implication |
|-------------|----------------------|----------------------|
| R290 (Propane) | Up to 75°C | Can often RETAIN existing radiators in older homes |
| R32 | Up to 55°C | Usually requires UPSIZED radiators to compensate |

BACKGROUND:
Older Irish homes typically have radiators sized for a gas/oil boiler running at 60–75°C. A heat pump running at 35–45°C (R32) delivers less heat through the same radiator — making rooms feel cooler unless radiators are replaced with larger ones.

R290 units (e.g., Mitsubishi Ecodan R290, Vaillant aroTHERM Plus, Panasonic Aquarea T-CAP) can reach 75°C — meaning the existing radiator system can often be retained.

2026 R290-CAPABLE BRANDS:
- Mitsubishi Ecodan R290 — up to 75°C, ideal for radiator retrofits
- Vaillant aroTHERM Plus — up to 75°C, very quiet
- Panasonic Aquarea T-CAP — up to 75°C, maintains full capacity at −20°C

R32-ONLY NOTE (e.g., Grant Aerona3, some Daikin Altherma 3 models):
Still excellent units with high SCOP (Grant Aerona3: SCOP 5.4), but maximum 55°C means a radiator assessment and likely upgrade programme is needed for pre-2000 homes.

PRACTICAL GUIDANCE:
- New builds and well-insulated homes with underfloor heating: R32 is fine
- Older homes with existing radiators being retained: ask specifically about R290 units
- Always get a room-by-room heat loss calculation before committing to any unit`,
  },

  // =========================================================================
  // HEAT PUMP PRESSURE CHECK
  // =========================================================================
  {
    topics: [
      'heat pump pressure', 'heating system pressure', 'pressure gauge heat pump',
      'low pressure heat pump', 'heat pump pressure bar', 'repressurise heat pump',
      'heat pump pressure drop', 'pressure 1 bar', 'boiler pressure heat pump',
    ],
    systems: ['heat_pump'],
    content: `HEAT PUMP SYSTEM PRESSURE — WHAT TO CHECK:
Your heat pump has a pressure gauge on the indoor unit or header. Correct operating pressure is between 1.0 and 2.0 bar.

READING THE GAUGE:
- 1.0–2.0 bar: Normal operating range ✅
- Below 1.0 bar: System is low on pressure — heating performance will be affected
- Above 3.0 bar: Overpressure — potential safety concern

IF PRESSURE IS LOW (below 1.0 bar):
- Do NOT attempt to repressurise a sealed heat pump system yourself
- A heat pump system uses a fully sealed pressurised circuit — different from a simple combi boiler
- Contact your installer — they will repressurise and check for the cause of the pressure loss
- A recurring pressure drop indicates a slow leak somewhere in the system

IF PRESSURE IS ABOVE 3.0 BAR:
- The expansion vessel may need attention
- Contact your installer

COMMON CAUSE OF PRESSURE LOSS:
- Minor leaks at radiator connections or system joints (more common in older systems connected to a new heat pump)
- Installer note: a small annual top-up is normal in some systems; repeated large pressure drops are not

NOTE FOR HEAT PUMP VS OLD BOILER:
Some older combi boilers had a manual filling loop that homeowners used regularly. Heat pump systems should NOT need regular re-pressurising — if you're losing pressure frequently, there is a leak that needs finding and fixing.`,
  },

  // =========================================================================
  // EV DYNAMIC LOAD BALANCING
  // =========================================================================
  {
    topics: [
      'dynamic load balancing', 'ev charger tripping fuse', 'ev charger overload',
      'ct clamp ev', '63 amp fuse', 'main fuse ev charger', 'shower ev charger',
      'ev charger reduce power', 'load management ev', 'easee load balancing',
      'ohme load balancing', 'ev charger and shower',
    ],
    systems: ['ev_charger'],
    content: `DYNAMIC LOAD BALANCING — HOW YOUR EV CHARGER PROTECTS YOUR MAIN FUSE:

Most Irish homes have a 63A main fuse (approximately 14.5 kW on single phase). Running an EV charger at full power (7.4 kW) alongside other large appliances can trip this fuse.

HOW DYNAMIC LOAD BALANCING WORKS:
1. A CT clamp (Current Transformer) is installed at your main ESB meter
2. The CT clamp monitors your total household electrical draw in real time
3. When other large loads switch on, the charger automatically reduces car charging speed
4. When those loads switch off, the charger ramps back up

WORKED EXAMPLE:
- EV charging at 7.4 kW + electric shower at 9 kW = 16.4 kW → would trip 63A fuse
- With load balancing: shower detected → car charger drops to ~5 kW → total = 14 kW → no trip
- When shower ends → car charger returns to 7.4 kW automatically

CHARGERS WITH DYNAMIC LOAD BALANCING:
- Easee One: specifically designed for this; allows multiple units on one circuit
- Ohme Home Pro: integrates with smart tariffs and load management
- Most modern smart chargers support this via a CT clamp accessory

WHY IT MATTERS FOR IRELAND:
Many Irish homes have electric showers (9 kW). Without load balancing, running the shower while charging an EV would regularly trip the main fuse. Load balancing eliminates this problem entirely — no need to "remember" not to shower while the car charges.

NOTE: If your charger was installed without a CT clamp, it may be operating at a fixed current limit rather than dynamic load balancing. Ask your installer if dynamic load balancing was set up.`,
  },

  // =========================================================================
  // SMART METER AND DEEMED EXPORT
  // =========================================================================
  {
    topics: [
      'smart meter', 'mprn', 'smart meter registers', 'deemed export',
      'export without smart meter', 'smart meter solar ireland', 'export meter ireland',
      'how do i get paid for solar without smart meter', 'smart meter installed',
      'esb smart meter', 'when will i get smart meter',
    ],
    systems: ['solar_pv', 'general'],
    content: `SMART METERS AND EXPORT PAYMENTS — IRISH HOMEOWNERS:

YOUR MPRN:
The MPRN (Meter Point Reference Number) is the 11-digit number on your electricity bill that uniquely identifies your ESB connection. You need it for SEAI grant applications and to register for export payments.

SMART METER REGISTERS:
When a smart meter is installed, it records:
- Import (Cumulative): Total electricity bought from the grid
- Export (Cumulative): Total electricity sent to the grid
- Active (Current): Real-time demand or generation at this moment

WHY YOU NEED A SMART METER FOR SOLAR:
A smart meter enables accurate measurement of your exported electricity so you can receive Clean Export Guarantee (CEG) payments. ESB Networks installs smart meters free of charge — your installer's NC6 form triggers this process. ESB aims to install within 4 months of the NC6 being processed.

DEEMED EXPORT — GETTING PAID BEFORE YOUR SMART METER ARRIVES:
You don't have to wait for a smart meter to start receiving CEG payments. If a smart meter has not yet been installed:
- Payments are made based on a "Deemed Export" calculation — SEAI's estimate of what a typical home in your situation would export
- Once your smart meter is installed, payments switch to actual meter readings
- Register with your electricity supplier for CEG as soon as your NC6 is confirmed — don't wait for the meter

SMART METER INSTALLATION TIMELINE:
1. Your installer submits NC6 to ESB Networks (up to 20 working days to process)
2. ESB Networks notifies your electricity supplier
3. ESB Networks schedules smart meter installation (target: within 4 months)
4. In the interim: contact your supplier to start Deemed Export payments

HOW TO REGISTER FOR CEG:
Simply contact your current electricity supplier and ask to register for the Micro-generation Support Scheme / Clean Export Guarantee. The process is straightforward and they handle the rest.`,
  },

];

/**
 * Get generic Irish renewable energy knowledge entries relevant to a message.
 * These supplement installer-specific and generic care-knowledge entries.
 */
export function getIrelandRenewableKnowledge(
  message: string,
  systemType?: string
): CareKnowledgeEntry[] {
  const lower = message.toLowerCase();
  const matched: CareKnowledgeEntry[] = [];

  for (const entry of IRELAND_RENEWABLE_KNOWLEDGE) {
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
