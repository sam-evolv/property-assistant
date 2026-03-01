/**
 * OpenHouse Care — Knowledge Base
 *
 * Factual, general guidance for homeowners with renewable energy systems.
 * Covers: Solar PV, Heat Pumps, EV Chargers, Battery Storage, MVHR,
 *         Energy Management, Warranties, Maintenance.
 *
 * Each entry:
 *   - Objectively true for systems installed in Irish homes
 *   - Non-specific (no brand-specific quirks unless universal)
 *   - Safe from a liability perspective
 *   - Written in plain language for non-technical homeowners
 *
 * Injected into the Care AI prompt when relevant to the homeowner's question.
 */

export interface CareKnowledgeEntry {
  topics: string[];   // Keywords / phrases that trigger this entry
  systems: string[];  // Which system types this applies to: 'solar_pv', 'heat_pump', 'ev_charger', 'battery', 'mvhr', 'general'
  content: string;
}

export const CARE_KNOWLEDGE: CareKnowledgeEntry[] = [

  // ===========================================================================
  // SOLAR PV — HOW IT WORKS
  // ===========================================================================
  {
    topics: ['how does solar work', 'how solar works', 'what is solar pv', 'what does the solar do', 'explain solar', 'solar basics', 'how does it work'],
    systems: ['solar_pv'],
    content: `SOLAR PV — HOW IT WORKS:
Solar panels (photovoltaic or PV) convert sunlight into direct current (DC) electricity. An inverter converts this to alternating current (AC) which powers your home.

The system works as follows:
1. Panels generate electricity when light hits them — even on cloudy days, though output is lower.
2. The inverter processes this and feeds it into your home's circuits.
3. Any electricity your home doesn't immediately use can be: (a) exported to the grid, (b) stored in a battery (if fitted), or (c) used by smart devices timed to run when solar is generating.
4. When solar output is insufficient (nights, heavy overcast), electricity is automatically drawn from the grid — you won't notice any difference.

Your system generates no electricity at night. Output peaks around solar noon on clear days. Irish summers can produce 4–5 peak sun hours per day; Irish winters typically 1–2. Annual output depends on system size, panel orientation, tilt angle, and shading.`,
  },

  // ===========================================================================
  // SOLAR PV — MONITORING & APP
  // ===========================================================================
  {
    topics: ['solar app', 'monitoring app', 'solaredge app', 'fronius app', 'solarman', 'fusionsolar', 'solar monitoring', 'how do i check', 'check my solar', 'solar output', 'solar production', 'generation', 'how much am i generating', 'portal app', 'solar data'],
    systems: ['solar_pv'],
    content: `SOLAR PV — MONITORING:
Your inverter has a monitoring portal or app. Common platforms in Ireland include:
- Huawei FusionSolar (Huawei SUN2000 inverters — used by SE Systems)
- OpenSolar (customer-facing dashboard, also used by SE Systems)
- Fronius Solar.web (Fronius inverters)
- SolarEdge mySolarEdge (SolarEdge inverters)
- Sungrow iSolarCloud / SolarMan (Sungrow inverters)

These show:
- Real-time power output (kW)
- Daily, monthly and annual generation (kWh)
- Self-consumption vs export breakdown (if metered)
- Battery state of charge (if fitted)
- Alerts for faults or reduced performance

To access monitoring: the app login details should be in your handover documentation. If you don't have them, contact your installer — they can resend the invitation email.

What to look for:
- On a clear summer day, a 4 kWp system should peak at around 3.2–3.8 kW between 11am–2pm.
- If output is zero during daylight hours, check the inverter (usually a display or LED status light).
- If output seems consistently lower than expected over several days, check for shade from new growth, dirt on panels, or an inverter alert.

Production naturally drops in winter — expect roughly 60–70% less than summer peak. This is normal.`,
  },

  // ===========================================================================
  // SOLAR PV — SEASONAL VARIATION
  // ===========================================================================
  {
    topics: ['seasonal', 'winter solar', 'low generation', 'not generating much', 'less solar', 'summer solar', 'why is solar low', 'solar in winter', 'expected generation', 'how much should i generate'],
    systems: ['solar_pv'],
    content: `SOLAR PV — SEASONAL VARIATION:
Solar generation in Ireland varies significantly by season. This is completely normal.

Typical monthly generation for a 4 kWp south-facing system in Cork/Munster:
- June/July: 450–520 kWh/month (peak)
- April/May & August/September: 320–420 kWh/month
- March & October: 180–250 kWh/month
- November–February: 60–120 kWh/month (low season)

Annual total: approximately 3,200–3,600 kWh/year for a well-sited 4 kWp system.

Key points:
- In December/January, the sun is low in the sky and days are short — output will be minimal. This is expected, not a fault.
- Cloudy, overcast days still produce 10–25% of clear-sky output.
- Rain actually cleans panels slightly, which can improve performance.
- If you notice a sudden sharp drop (not gradual seasonal change), this may indicate a fault — check the inverter display or app.`,
  },

  // ===========================================================================
  // SOLAR PV — MAXIMISING SELF-CONSUMPTION
  // ===========================================================================
  {
    topics: ['self consumption', 'use my own solar', 'make the most of solar', 'save more with solar', 'when to run appliances', 'dishwasher solar', 'washing machine solar', 'timer solar', 'solar savings', 'maximise solar', 'best time to run'],
    systems: ['solar_pv'],
    content: `SOLAR PV — MAXIMISING SELF-CONSUMPTION:
Every unit of solar electricity you use yourself (rather than export) saves you the full retail rate (~€0.35/kWh). Exported electricity earns you less — typically €0.10–0.21/kWh under the Micro-generation Support Scheme (MSS).

To maximise savings:
- Run high-consumption appliances (dishwasher, washing machine, tumble dryer, EV charger) between 10am–3pm on sunny days.
- Set timers on these appliances to coincide with peak solar hours.
- If you have a smart immersion (iBoost or similar), it automatically diverts surplus solar to heat water — this is one of the most effective ways to use excess generation.
- If you have a home battery, it charges from surplus solar and discharges in the evening/night, increasing self-consumption significantly.
- Some EV chargers and appliances have solar-surplus modes that automatically adjust based on real-time generation.`,
  },

  // ===========================================================================
  // SOLAR PV — EXPORT TARIFF / MSS
  // ===========================================================================
  {
    topics: ['export tariff', 'sell back to grid', 'export electricity', 'mss', 'micro generation', 'seai export', 'smart export', 'get paid for solar', 'export rate', 'grid export', 'sell electricity', 'net metering'],
    systems: ['solar_pv'],
    content: `SOLAR PV — EXPORT TARIFF (MICRO-GENERATION SUPPORT SCHEME):
Under Ireland's Micro-generation Support Scheme (MSS), homeowners with solar PV can receive payment for surplus electricity exported to the national grid.

Key points:
- You must apply through your electricity supplier — not all suppliers offer MSS, but all licensed suppliers are obliged to accept applications.
- You need a smart meter (bidirectional) installed by ESB Networks. This is free to request.
- Export rates vary by supplier — typically €0.10–0.21/kWh. Compare offers.
- MSS is separate from any grants received for installation.
- Payments are typically credited on your electricity bill quarterly.
- Export payments are modest — the bigger financial benefit is from self-consumption (using your own solar instead of buying from the grid).

To apply: Contact your electricity supplier and request to register for the Micro-generation Support Scheme. They will coordinate with ESB Networks to upgrade your meter if needed.`,
  },

  // ===========================================================================
  // SOLAR PV — SEAI GRANT
  // ===========================================================================
  {
    topics: ['seai solar grant', 'solar grant', 'seai grant solar', 'how much grant', 'solar pv grant', 'did i get a grant', 'solar subsidy'],
    systems: ['solar_pv'],
    content: `SOLAR PV — SEAI GRANT (Updated February 2026):
SEAI (Sustainable Energy Authority of Ireland) provides grants for solar PV installation.

Current grant rates (from 3 February 2026):
- First 2 kWp: €700 per kWp = €1,400
- 2–4 kWp (each additional kWp): €200 per kWp = up to €400
- Maximum grant: €1,800 (achieved at 4 kWp and above)
- Example: 3.52 kWp = (2 × €700) + (1.52 × €200) = €1,704
- 0% VAT applies to supply and installation of residential solar panels
- No separate battery storage grant exists

Eligibility: Homeowners with a home built and occupied before 31 December 2020. Homes built after 2021 were required under building regulations to include renewables, so no SEAI grant was applicable.

Note: If your home was completed after 2021, the solar system was likely installed as part of building regulation compliance. Check with your installer or developer.

The grant is typically applied directly against the installation cost (paid to the installer) and should already be reflected in the net price you paid. Through a One Stop Shop like SE Systems, grants are deducted upfront.`,
  },

  // ===========================================================================
  // HEAT PUMP — HOW IT WORKS
  // ===========================================================================
  {
    topics: ['how does the heat pump work', 'what is a heat pump', 'heat pump basics', 'explain heat pump', 'air source heat pump', 'how heat pump works', 'heat pump explain'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — HOW IT WORKS:
An air-to-water heat pump extracts heat energy from outdoor air (even at temperatures as low as -15°C) and transfers it into your home's heating and hot water system. It works like a refrigerator in reverse.

Key points for homeowners:
- Heat pumps run on electricity and produce 3–4 units of heat for every 1 unit of electricity used (called COP — Coefficient of Performance). This makes them highly efficient.
- They deliver heat at lower temperatures (35–55°C) than gas boilers (60–80°C). Radiators will feel warm, not hot — this is correct.
- They are designed to run for long periods at low output, not short bursts. Turning them off and on repeatedly wastes energy and increases wear.
- Performance drops slightly in very cold weather (below -5°C) but modern heat pumps maintain good efficiency throughout Irish winters.
- Your home's BER rating matters — better insulation means the heat pump works less hard and running costs are lower.`,
  },

  // ===========================================================================
  // HEAT PUMP — OPTIMAL SETTINGS
  // ===========================================================================
  {
    topics: ['heat pump settings', 'what temperature', 'heat pump temperature', 'set temperature', 'room temperature', 'thermostat setting', 'heating schedule', 'heat pump schedule', 'what should i set', 'flow temperature', 'best settings'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — OPTIMAL SETTINGS:
Getting the settings right is important for both comfort and running costs.

Recommended settings for Irish A-rated homes:
- Room thermostat: 20–21°C. Every degree above 20°C adds roughly 6–8% to running costs.
- Flow temperature (the water temperature in your radiators/underfloor): 35–40°C for underfloor heating, 45–55°C for radiators. Your installer will have set this at commissioning.
- Hot water cylinder: Set to 60°C and programmed to heat once per day (usually early morning). This prevents legionella bacteria growth.
- Weather compensation: If your system has this, keep it enabled. It automatically adjusts flow temperature based on outdoor temperature — the most efficient operating mode.

For underfloor heating:
- Do NOT set large temperature setbacks at night (e.g. dropping from 20°C to 15°C). Underfloor has high thermal mass and takes 4–6 hours to recover — your heat pump works harder to reheat it.
- A small setback of 1–2°C overnight is fine.

Common mistake: Turning the heat pump off completely to save money. This is counterproductive — the system uses more energy recovering from cold than it saves while off.`,
  },

  // ===========================================================================
  // HEAT PUMP — SERVICING
  // ===========================================================================
  {
    topics: ['heat pump service', 'heat pump maintenance', 'service heat pump', 'annual service', 'heat pump check', 'when to service', 'how often service', 'heat pump filter', 'heat pump outdoor unit'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — SERVICING & MAINTENANCE:
Heat pumps require minimal maintenance but an annual service is recommended and often required to maintain warranty.

What the homeowner can do:
- Keep the outdoor unit clear — ensure at least 300mm clearance around it. Remove leaves, debris, and ice buildup (use lukewarm water, never a sharp tool).
- Check and clean any air filters (usually inside the indoor unit) every 3–6 months. Refer to your manual for location and how to remove them.
- Do not block or restrict airflow to the outdoor unit by placing objects around it or planting vegetation too close.
- Keep the condensate drain pipe (on the indoor unit) clear of blockages.

What requires a qualified engineer:
- Annual refrigerant check — only F-Gas certified engineers can work on refrigerant circuits.
- Full system service including pressure checks, electrical connections, and controls.

Your heat pump warranty (typically 5–7 years on the unit) usually requires an annual service by a qualified engineer to remain valid. Keep records of all services.`,
  },

  // ===========================================================================
  // HEAT PUMP — HOT WATER
  // ===========================================================================
  {
    topics: ['hot water', 'no hot water', 'hot water cylinder', 'dhw', 'domestic hot water', 'water temperature', 'hot water not hot', 'how long hot water', 'how hot is water', 'legionella', 'immersion'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — HOT WATER:
Your heat pump heats a hot water cylinder (typically 200–300 litres). Here's what you need to know:

Normal operation:
- The cylinder heats once or twice a day (usually early morning) to 60°C. During the day, water cools slowly.
- If you use a lot of hot water (multiple showers, baths), the cylinder may run lukewarm toward the end. This is normal — it will reheat on the next scheduled cycle.
- Hot water at the tap feels slightly different to gas-heated water — it's consistent rather than the fluctuating pressure of a combi boiler.

Legionella prevention (important):
- Your cylinder should reach 60°C at least once per day. This is set at commissioning but check your controller.
- Never lower the cylinder setpoint below 60°C.

If you have no hot water:
1. Check the heat pump controller — is there a fault code displayed?
2. Check the immersion heater (backup) — your cylinder likely has a 3kW immersion as backup. Switching it on manually will restore hot water while you diagnose the issue.
3. Check that the heat pump is running (listen for the fan on the outdoor unit, check the controller).
4. If the system shows a fault code, note it and contact your installer.`,
  },

  // ===========================================================================
  // HEAT PUMP — RUNNING COSTS
  // ===========================================================================
  {
    topics: ['heat pump cost', 'heat pump bills', 'electricity bill heat pump', 'running cost', 'how much does it cost', 'expensive to run', 'cheaper than gas', 'heat pump vs gas', 'cop', 'scop', 'efficiency heat pump'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — RUNNING COSTS:
Heat pumps are significantly cheaper to run than gas boilers for well-insulated homes, despite using electricity (which costs more per unit than gas).

Why: A heat pump produces 3–4 kWh of heat per 1 kWh of electricity (COP of 3–4). A gas boiler produces roughly 0.9 kWh of heat per 1 kWh of gas (90% efficiency).

Rough annual running cost comparison for a 3-bed A-rated Irish home:
- Heat pump: approximately €700–1,200/year (electricity at ~€0.35/kWh, SCOP of 3.0–3.5)
- Gas boiler (same home): approximately €900–1,400/year (gas at ~€0.065/kWh)

Factors that affect running costs:
- How well-insulated your home is (BER rating)
- The outdoor temperature in your area
- Your heating schedule and thermostat settings
- Whether you have solar PV (can significantly offset daytime heating costs)
- Electricity tariff — night rate (e.g. Energia Night Rate, Electric Ireland NightSaver) is worth considering as heat pumps can run at lower cost on cheaper overnight electricity.

If your bills seem higher than expected: Check thermostat settings, ensure the outdoor unit is clear, and verify the hot water cylinder setpoint is not set unnecessarily high (above 60°C).`,
  },

  // ===========================================================================
  // HEAT PUMP — WINTER OPERATION
  // ===========================================================================
  {
    topics: ['heat pump winter', 'cold weather heat pump', 'defrost', 'ice on heat pump', 'heat pump freezing', 'frost on heat pump', 'heat pump not warming house', 'cold house', 'not enough heat'],
    systems: ['heat_pump'],
    content: `HEAT PUMP — WINTER OPERATION:
Heat pumps work throughout Irish winters, including during cold snaps. Here's what to expect:

Defrost cycles:
- The outdoor unit will periodically enter a defrost cycle in cold, humid weather. During this (usually 5–15 minutes), you may notice steam from the unit, reduced heating output, or the system appearing to pause. This is completely normal — it's melting frost that has built up on the heat exchanger coils.
- Do not be alarmed by steam or water dripping from the outdoor unit in cold weather.

Performance in the cold:
- Your system will still heat your home effectively, even at outdoor temperatures of -5°C to -10°C. However, efficiency (COP) drops — expect higher electricity consumption in very cold weather.
- If your home feels cooler than usual during an extended cold spell, check: (a) the thermostat setting, (b) that the outdoor unit is clear of ice or debris, (c) that no windows or doors are being left open.

Ice on the outdoor unit:
- Light frost or ice on the top of the unit is normal in cold weather.
- Heavy ice buildup that doesn't clear (after a defrost cycle) may indicate a fault — contact your installer.

Backup heating:
- Most systems have an electric backup element that activates automatically when outdoor temperatures are very low. This uses more electricity but maintains comfort.`,
  },

  // ===========================================================================
  // EV CHARGER — HOW IT WORKS
  // ===========================================================================
  {
    topics: ['ev charger', 'electric car charger', 'how to charge car', 'charge my car', 'ev charging', 'how does charger work', 'ohme', 'zappi', 'myenergi', 'easee', 'wallbox', 'home charger'],
    systems: ['ev_charger'],
    content: `EV CHARGER — HOW IT WORKS:
Your home EV charger (EVSE — Electric Vehicle Supply Equipment) provides AC charging to your electric or plug-in hybrid vehicle.

Types installed in Irish homes:
- 7.4 kW single-phase (most common): charges a typical EV at ~35–40 km of range per hour.
- 22 kW three-phase (less common in homes): charges at ~110 km of range per hour where supported by the vehicle.

Note: Charging speed is limited by whichever is lower — the charger output or your vehicle's onboard charger. Many EVs accept a maximum of 7.4 kW or 11 kW AC regardless of what the home unit provides.

Smart chargers (Ohme, Zappi, Myenergi, Wallbox Pulsar Plus):
- Connect to your home Wi-Fi and can be controlled via app.
- Can schedule charging to off-peak electricity tariff hours (typically 11pm–8am) for significant cost savings.
- Zappi/Myenergi models can charge from excess solar PV — maximising self-consumption.
- Ohme integrates with Octopus Energy and Energia for automatic smart tariff charging.

Charging cable: Keep it coiled and dry when not in use. Check the connector for damage before use.`,
  },

  // ===========================================================================
  // EV CHARGER — SMART CHARGING / OFF-PEAK
  // ===========================================================================
  {
    topics: ['smart charging', 'off peak charging', 'cheap electricity ev', 'night rate ev', 'schedule ev charging', 'best time to charge', 'ev tariff', 'overnight charging', 'smart tariff ev'],
    systems: ['ev_charger'],
    content: `EV CHARGER — SMART CHARGING & TARIFFS:
Charging your EV overnight on a cheaper electricity tariff is one of the easiest ways to reduce running costs.

Irish EV-friendly tariffs (2024/2025):
- Electric Ireland SmartElec EV: Night rate ~€0.07/kWh (11pm–8am)
- Energia EV Rate: Night rate available
- Bord Gáis Energy Smart EV: Variable overnight rate
- Octopus Energy Agile / Go: Dynamic low-rate periods

How to set up scheduled charging:
1. In your charger's app, set a charge schedule to start at 11pm (or whenever your cheap rate starts) and end by 7–8am.
2. Alternatively, set the schedule on your vehicle's infotainment system — most EVs have a built-in charging scheduler.
3. With Ohme chargers, connect your electricity supplier account and the charger automatically charges during the cheapest periods.

If you also have solar PV:
- Zappi and Myenergi chargers can prioritise solar surplus charging during the day — using free solar instead of grid electricity.
- This works best in summer when solar output is higher.`,
  },

  // ===========================================================================
  // EV CHARGER — TROUBLESHOOTING
  // ===========================================================================
  {
    topics: ['charger not working', 'ev charger fault', 'car not charging', 'charger light flashing', 'error on charger', 'charger stopped', 'ev wont charge', 'charger red light', 'charging problem'],
    systems: ['ev_charger'],
    content: `EV CHARGER — TROUBLESHOOTING:
If your EV charger isn't working:

1. Check the charger display/app for an error code. Note it down — it will help your installer diagnose remotely.

2. Check the mains power:
   - Look at your consumer unit (fuse board) — has the breaker for the EV charger tripped? Reset if so.
   - If it trips again immediately, do not keep resetting — contact your installer.

3. Try a soft reset: Many chargers have a reset button or can be restarted via the app.

4. Check the cable: Ensure it's fully inserted at both the charger and vehicle ends. Try removing and reinserting.

5. Check the vehicle:
   - Is the charging port locked? Some vehicles won't charge if a schedule is set on the car.
   - Try unlocking the vehicle and starting a manual charge.

6. Check for app/firmware update notifications: Some chargers pause charging if a firmware update is pending.

Common error meanings:
- Red flashing light: Usually indicates a ground fault, wiring issue, or communication error — contact installer.
- Yellow/amber: Often a warning (schedule active, vehicle not accepting charge, pause mode).
- No lights at all: Check mains power to the unit.

If the issue persists after basic checks, contact your installer with the error code.`,
  },

  // ===========================================================================
  // BATTERY STORAGE — HOW IT WORKS
  // ===========================================================================
  {
    topics: ['battery storage', 'home battery', 'battery system', 'energy storage', 'battery pack', 'how does battery work', 'givenergy', 'solis', 'solax', 'pylontech', 'tesla powerwall', 'battery backup'],
    systems: ['battery'],
    content: `BATTERY STORAGE — HOW IT WORKS:
A home battery stores surplus solar electricity (or cheap grid electricity) for use later — typically in the evening and overnight when solar isn't generating.

How it works:
1. During the day, excess solar (more than your home is using) charges the battery instead of exporting to the grid.
2. In the evening, as solar drops off, the battery discharges to power your home.
3. If the battery runs flat overnight, the system automatically switches to grid power.
4. The cycle repeats daily.

Key specs to understand:
- Capacity (kWh): Total energy stored. A typical Irish home battery is 5–10 kWh. A 10 kWh battery can power ~4 kWh of daily loads not covered by solar.
- Power output (kW): How quickly it can discharge. A 3.6 kW output is sufficient for most household loads.
- Depth of discharge (DoD): Most lithium batteries can be used to 90–95% of capacity safely.
- Cycles: A lithium battery typically lasts 4,000–6,000 charge/discharge cycles (~10–15 years).

What battery storage does NOT do:
- It is not a backup power system (UPS) in most installations. If the grid goes down, most battery systems also shut down for safety reasons (anti-islanding protection). Some systems have backup mode — check with your installer.`,
  },

  // ===========================================================================
  // BATTERY STORAGE — SETTINGS & OPTIMISATION
  // ===========================================================================
  {
    topics: ['battery settings', 'battery schedule', 'charge battery overnight', 'battery off peak', 'battery optimisation', 'battery mode', 'time of use battery', 'battery discharge', 'battery charge rate', 'maximise battery'],
    systems: ['battery'],
    content: `BATTERY STORAGE — SETTINGS & OPTIMISATION:
Most home batteries can be set to different operating modes via an app or inverter display:

Modes:
- Solar Self-Consumption (recommended): Charges from solar surplus, discharges in evenings. Best for maximising solar savings.
- Time of Use (TOU): Charges from cheap grid electricity overnight (e.g. 11pm–8am), discharges during peak rate hours. Best if you have a time-of-use tariff and limited solar.
- Backup Reserve: Keeps a percentage of charge reserved for power outages (if your system supports this).
- Export Mode: Discharges to grid during high export rate periods (requires smart export tariff).

Optimisation tips:
- In summer, prioritise Solar Self-Consumption — the battery will charge and discharge from solar daily.
- In winter when solar is low, switch to TOU mode — charge cheaply overnight and use that stored energy during the day.
- Set a minimum state of charge (e.g. 10–20%) to extend battery lifespan.
- Avoid regularly running the battery completely flat — most manufacturers recommend keeping it above 10%.

Check the battery state in your app regularly — it should be cycling (not sitting at 0% or 100% for extended periods). A battery permanently at 100% with no discharge suggests the schedule may need adjusting.`,
  },

  // ===========================================================================
  // MVHR — WHAT IT IS
  // ===========================================================================
  {
    topics: ['mvhr', 'ventilation', 'mechanical ventilation', 'heat recovery ventilation', 'hrv', 'what is mvhr', 'ventilation system', 'air quality', 'stale air', 'fresh air', 'ventilation unit', 'air handling unit', 'aereco', 'zehnder', 'paul', 'duco'],
    systems: ['mvhr'],
    content: `MVHR — WHAT IT IS:
MVHR (Mechanical Ventilation with Heat Recovery) is the ventilation system in your energy-efficient home. It is a mandatory feature of modern high-performance homes in Ireland.

What it does:
- Continuously extracts stale, moist air from "wet rooms" (kitchen, bathrooms, utility) and exhausts it outside.
- Simultaneously draws in fresh filtered air from outside and supplies it to "dry rooms" (living room, bedrooms, home office).
- A heat exchanger in the central unit transfers up to 85–95% of the heat from the outgoing stale air to the incoming fresh air — so you get fresh air without losing heat.

Why it matters:
- Modern homes are built airtight (required by building regulations). Without mechanical ventilation, CO₂ levels rise, moisture builds up, and mould can develop.
- MVHR maintains healthy air quality silently and efficiently.
- Do NOT block or cover any supply or extract vents — this disrupts the system and can cause moisture problems.
- Do NOT turn the MVHR off — it should run continuously. Turning it off causes condensation and air quality issues, especially in winter.

The unit is typically located in an attic, utility room, or hot press. You will rarely need to interact with it except for filter changes.`,
  },

  // ===========================================================================
  // MVHR — FILTERS & MAINTENANCE
  // ===========================================================================
  {
    topics: ['mvhr filter', 'ventilation filter', 'change filter', 'filter change', 'mvhr maintenance', 'filter clogged', 'filter dirty', 'how often filter', 'mvhr service', 'ventilation maintenance', 'filter replacement'],
    systems: ['mvhr'],
    content: `MVHR — FILTERS & MAINTENANCE:
The main homeowner task for MVHR is regular filter replacement. This is simple and important.

How often: Every 6–12 months, depending on the manufacturer and local air quality. In dusty environments or near busy roads, check filters every 6 months.

How to check:
1. Locate the MVHR unit (usually in the attic, hot press, or utility room).
2. Open the access panel (usually clips or a sliding cover).
3. Remove the filters — there are usually two (supply and extract), typically G4 class foam or pleated paper.
4. If visibly dark/blocked, replace them.

Where to get filters: Use filters recommended by your unit's manufacturer (Zehnder, Paul, Duco, Aereco, etc.). Order by unit model. Using the wrong filter size or class reduces efficiency.

Signs you need a filter change:
- Reduced airflow from supply vents
- Musty or stale smell inside the home
- Increased noise from the unit
- Condensation on windows (sign of reduced ventilation)

Other maintenance (for qualified engineers):
- Cleaning the heat exchanger core (every 2–3 years)
- Balancing airflows (usually done at commissioning, may need adjustment if rooms are added)
- Duct cleaning (every 5–10 years)`,
  },

  // ===========================================================================
  // MVHR — CONDENSATION & HUMIDITY
  // ===========================================================================
  {
    topics: ['condensation', 'moisture', 'damp windows', 'humid house', 'humidity', 'wet windows', 'mould risk', 'moisture buildup', 'steam', 'cooking steam', 'bathroom steam'],
    systems: ['mvhr', 'general'],
    content: `MVHR — CONDENSATION & HUMIDITY:
If you're seeing condensation on windows or excessive moisture in your home, the MVHR system needs attention.

Common causes:
- MVHR filters are clogged: Restricts airflow, moisture builds up. Replace filters.
- MVHR set too low: In very cold or wet weather, increase ventilation to the next speed setting.
- Cooking and showering: During heavy steam production, boost the ventilation manually (most MVHR units have a boost button/switch). Don't just turn on an extractor fan — this disrupts the MVHR balance.
- Airtight home with MVHR off: Never turn the MVHR off. If someone has switched it off, this will cause condensation quickly in a well-sealed home.

Normal vs. concerning condensation:
- Some morning condensation on the very edge of double-glazed units is normal in cold weather. It's a sign your home is well insulated.
- Heavy condensation across the whole window pane, especially inner surfaces, or condensation on walls suggests inadequate ventilation — check filters and MVHR operation.
- Black mould on window frames or walls is not normal and requires action — increase ventilation, check filters, and if persistent, contact your management company or developer.`,
  },

  // ===========================================================================
  // ENERGY — UNDERSTANDING YOUR BILL
  // ===========================================================================
  {
    topics: ['electricity bill', 'bill too high', 'understand bill', 'why is bill high', 'electricity usage', 'kwh usage', 'how much energy', 'energy cost', 'reduce bills', 'lower bills', 'meter reading', 'smart meter'],
    systems: ['general'],
    content: `ENERGY — UNDERSTANDING YOUR BILL:
With solar PV and a heat pump, your energy use pattern is different from traditional homes.

Reading your bill:
- Electricity bills in Ireland show kWh consumed from the grid. This is your import — it does not include solar electricity you used yourself (self-consumption is not counted by the meter).
- If you have a smart meter, your bill may also show export kWh (electricity sent back to the grid).
- Grid import in winter will be higher than summer — this is expected because solar generates less and heating demand is higher.

Typical annual grid import for a 3-bed A-rated home in Ireland:
- Without solar: 4,500–6,000 kWh/year
- With 4 kWp solar: 2,500–4,000 kWh/year (depends on battery, EV, occupancy)
- With 4 kWp solar + battery: 1,800–3,000 kWh/year

If your bill seems unexpectedly high:
1. Check if the MVHR, heat pump, and EV charger are all running on the same meter (they should be).
2. Check that EV charging isn't happening during peak rate hours.
3. Verify your heat pump's schedule and thermostat settings.
4. Check that no appliances are running unnecessarily (immersion heater left on, old fridge/freezer consuming heavily).
5. Request a meter reading from ESB Networks to verify your smart meter is accurate.`,
  },

  // ===========================================================================
  // WARRANTIES — GENERAL
  // ===========================================================================
  {
    topics: ['warranty', 'guarantee', 'how long warranty', 'what is covered', 'warranty claim', 'system warranty', 'inverter warranty', 'panel warranty', 'heat pump warranty', 'charger warranty'],
    systems: ['general'],
    content: `WARRANTIES — TYPICAL COVERAGE:
Renewable energy systems come with multiple warranties:

Solar Panels:
- Product warranty (materials/workmanship): 12–15 years (varies by brand)
- Performance warranty: 25–30 years (guaranteeing panels produce at least 80–87.6% of rated output)
- Most reputable Tier 1 panel brands (Astronergy, Trina Solar, JA Solar, LONGi, REC) honour these globally.
- Astronergy (used by SE Systems): 30-year performance warranty with ≤0.4% annual degradation

Solar Inverters:
- Standard warranty: 5–10 years (varies by brand)
- Extended warranty can often be purchased up to 20–25 years
- Brands: Huawei SUN2000 (10 years standard, extendable to 15/20 years), SolarEdge (12 years standard), Fronius (5 years, extendable), Solis (5 years)

Heat Pumps:
- Typical warranty: 2–5 years parts and labour; 7–10 years on the compressor
- Annual servicing by a qualified engineer is usually required to keep the warranty valid

EV Chargers:
- Typically 3–5 years

Batteries:
- Typically 10 years or a specified number of cycles (whichever comes first)
- Tesla Powerwall: 10 years
- GivEnergy: 10 years

To make a warranty claim:
1. Document the fault with photos/video.
2. Note any error codes from the system display or app.
3. Contact your original installer first — they manage warranty claims with the manufacturer.
4. Keep all documentation: installation date, commissioning report, service records.

Warranty is typically voided by: unauthorized modifications, non-compliant installation, failure to service the system annually.`,
  },

  // ===========================================================================
  // MAINTENANCE SCHEDULE
  // ===========================================================================
  {
    topics: ['maintenance', 'annual maintenance', 'service schedule', 'what maintenance needed', 'yearly check', 'what to check', 'maintenance schedule', 'keep system working', 'look after system'],
    systems: ['general'],
    content: `MAINTENANCE SCHEDULE — ANNUAL CHECKLIST:

EVERY 6 MONTHS (homeowner):
- Check MVHR filters — replace if dirty or discoloured
- Check solar panels for heavy soiling or debris (birds, leaves) — hose down if accessible and safe
- Check EV charger cable for damage — inspect plug, connector, and cable body
- Check outdoor heat pump unit — clear leaves/debris from around and behind the unit

ANNUALLY:
- Heat pump: Book a service with a qualified F-Gas engineer (required for warranty)
- Solar inverter: Check app for any performance alerts; log annual generation figure
- Battery: Check cycle count in app; note any significant capacity reduction
- MVHR: Replace filters regardless; clean the unit's exterior

EVERY 3–5 YEARS:
- MVHR heat exchanger cleaning by a qualified ventilation engineer
- Solar panel cleaning by a professional (optional but improves output by 3–5%)
- EV charger firmware update — check app or manufacturer website

KEEP ON FILE:
- Installation date and commissioning report for each system
- Annual service records
- Serial numbers of all major components
- Installer contact details and warranty certificates

Note: Systems installed in new homes typically come with a first-year defect remedy period covered by the developer. Report any issues within the first 12 months.`,
  },

  // ===========================================================================
  // SMART HOME INTEGRATION
  // ===========================================================================
  {
    topics: ['smart home', 'home automation', 'google home', 'alexa', 'home assistant', 'smart controls', 'app control', 'integrate solar', 'smart thermostat', 'nest', 'hive', 'tado', 'connect systems'],
    systems: ['general'],
    content: `SMART HOME INTEGRATION:
Modern renewable energy systems can integrate with smart home platforms, though capability varies by brand.

Heat pump controls:
- Most heat pumps use proprietary controllers (Daikin Online Controller, Mitsubishi MELCloud, Nibe Uplink)
- Tado and Hive smart thermostats can control heat pump systems in some configurations
- Check with your installer before adding third-party thermostats — incompatible devices can disable weather compensation

Solar monitoring:
- SolarEdge, Fronius, and most modern inverters have their own apps
- GivEnergy, SolarEdge, and some Solis/Solax inverters integrate with Home Assistant (open-source)
- Google Home / Amazon Alexa integration is limited for solar — mostly limited to displaying generation data

EV chargers:
- Ohme: integrates with Octopus Energy, Alexa voice control
- Zappi: MyenergiApp, some Home Assistant integration
- Wallbox Pulsar: full Alexa and Google Assistant integration

Battery systems:
- GivEnergy: comprehensive API, Home Assistant integration
- Tesla Powerwall: Tesla app, limited third-party integration
- Solax/Solis: some Home Assistant community integrations

The most practical "smart integration" for most homeowners is ensuring your EV charger is connected to your Wi-Fi and set up for scheduled charging on a cheap overnight tariff — this saves the most money with the least complexity.`,
  },

  // ===========================================================================
  // SYSTEM NOT WORKING / GENERAL FAULT
  // ===========================================================================
  {
    topics: ['system not working', 'something is wrong', 'fault', 'error', 'alarm', 'red light', 'not working', 'broken', 'problem with system', 'stopped working'],
    systems: ['general'],
    content: `WHEN YOUR SYSTEM ISN'T WORKING — FIRST STEPS:
Before calling your installer, check the following:

1. Check for an error code:
   - Look at the system controller, inverter display, or app. Note the exact code.
   - Error codes speed up diagnosis significantly — have it ready when you call.

2. Check mains power:
   - Go to your consumer unit (fuse board). Has any breaker tripped?
   - A tripped breaker looks different from the others — it will be in a half-position or fully off.
   - If a breaker has tripped: switch it off fully then back on. If it trips again immediately, do not keep resetting — call your installer.

3. Check for simple causes:
   - Has power been out recently? Many systems need a manual restart after a power cut.
   - Is the outdoor heat pump unit frozen or blocked?
   - Has anyone switched anything off (holiday mode, boost, isolation switches)?

4. Soft reset:
   - Most systems can be restarted by powering off the main isolation switch (usually a red-handled switch near the unit) for 2 minutes, then switching back on.
   - Only do this if the system is not showing an active fault — a hard reset on a running fault can sometimes cause further issues.

5. Contact your installer:
   - Have the system model, serial number, installation date, and error code ready.
   - If the system is under warranty (check your documents), the call-out may be free.
   - Most installers have an out-of-hours emergency line for heating failures.`,
  },

];

// ---------------------------------------------------------------------------
// Helper: Find relevant knowledge entries for a given message
// ---------------------------------------------------------------------------

export function getRelevantCareKnowledge(
  message: string,
  systemType?: string
): CareKnowledgeEntry[] {
  const lower = message.toLowerCase();
  const matched: CareKnowledgeEntry[] = [];

  for (const entry of CARE_KNOWLEDGE) {
    // Topic match
    const topicMatch = entry.topics.some(
      topic => lower.includes(topic.toLowerCase())
    );

    if (!topicMatch) continue;

    // If we know the system type, prefer entries for that system (but also include 'general')
    if (systemType) {
      const normalised = systemType.replace('-', '_').toLowerCase();
      const systemMatch =
        entry.systems.includes(normalised) || entry.systems.includes('general');
      if (!systemMatch) continue;
    }

    matched.push(entry);
  }

  // Cap at 3 entries to avoid overloading the prompt
  return matched.slice(0, 3);
}

export function formatCareKnowledge(entries: CareKnowledgeEntry[]): string {
  if (entries.length === 0) return '';

  const blocks = entries.map(e => e.content.trim()).join('\n\n---\n\n');
  return `CARE KNOWLEDGE BASE:\n---\n${blocks}\n---`;
}
