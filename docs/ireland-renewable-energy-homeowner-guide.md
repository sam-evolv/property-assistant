# Residential Renewable Energy Systems for Irish Homeowners

> **Scope:** Ireland-specific guide for non-technical homeowners. Designed as source material for an aftercare customer-support AI used by installers of solar PV, batteries, heat pumps, EV chargers and MVHR.  
> **Irish context:** Grid connection via ESB Networks · Grants via SEAI · Regulation via CRU · Irish climate/usage profile (highly seasonal solar yield; heat pumps through mild-to-cold damp winters).  
> **⚠️ Volatile sections** (review on a scheduled basis): electricity import prices, Clean Export Guarantee (CEG) export rates, SEAI grant terms/amounts, supplier tariff structures, ESB Networks connection processes/forms.

---

## 1. Solar PV Fundamentals

### How Solar PV Works (Plain English)

A solar PV panel generates DC electricity when daylight hits the cells. Light energy → electrical energy. That DC power is not compatible with the 230V AC electricity used by household circuits, so an **inverter** converts DC into usable AC electricity.

In Ireland, PV generates during daylight only, with the strongest output around midday. Most generation happens when many people are out of the house — which is why **self-consumption strategies** (timers, smart plugs, EV charging, immersion diverters, batteries) matter.

---

### Inverter Types: What They Do

| Type | Description | Homeowner Impact |
|------|-------------|-----------------|
| **String inverter** | Panels wired in strings to one inverter | Output limited by lowest-performing panel in a string (shading/fault) |
| **Hybrid inverter** | String inverter + battery management | Enables battery; flexible modes (self-consumption, TOU scheduling, export control) |
| **DC Optimisers** | Small devices per panel to mitigate shading | Per-panel monitoring; reduces mismatch losses |
| **Microinverters** | One inverter per panel | Each panel independent; more resilient to shading; higher hardware cost |

From a homeowner perspective, the biggest practical differences are: whether adding a battery later is straightforward; quality of monitoring; shading resilience; and what the installer can diagnose remotely.

---

### Irish Grid Compliance

The inverter is not "just a converter" — it is also a **safety device** that must comply with Irish grid connection requirements for microgeneration, including:
- **Anti-islanding behaviour**: the inverter must disconnect during a power outage so it does not energise the grid
- Compliance with **I.S. EN 50549-1** with Irish protection settings (ESB Networks requirement)
- From **6 January 2025**: inverters, EV chargers, and heat pumps connecting to the grid should be selected from ESB Networks' Low Carbon Technology (LCT) register

---

### Solar Panel Technologies

| Technology | Status | Notes |
|------------|--------|-------|
| Mono PERC | Legacy/current mix | Widely installed, good value; increasingly displaced by N-type |
| **N-type TOPCon** | Current mainstream | Strong low-light performance, improved temperature behaviour |
| HJT/Heterojunction | Premium/current | High efficiency, good temperature coefficients; higher cost |
| Bifacial | Niche/growing | Front + rear generation; best on ground mounts; limited rear gain on typical Irish roofs |

**What to check on a quote (brand-agnostic):**
- Wattage (W) per panel and total system size (kWp)
- Efficiency (%)
- Temperature coefficient (power loss as temperature rises — Irish mild climate is favourable)
- **Product warranty** (manufacturing defects): 12–15 years typical
- **Performance warranty** (guaranteed minimum output): 25–30 years
- Degradation rate per year (used in performance warranty modelling)

**Common brands in Ireland:** Astronergy, JA Solar, Trina Solar, Canadian Solar, LONGi, JinkoSolar, Maxeon

---

### Common Inverter Brands in Ireland

Huawei (SUN2000), SolarEdge (optimiser-based), Fronius, GoodWe, Solis, Enphase (microinverters)

> ⚠️ **Aftercare note:** LED colours and error code lists are **model- and firmware-specific**. Always establish: (a) inverter brand, (b) exact model number, (c) LED state, (d) exact error text/code from app/screen, (e) whether it is daytime.

---

### Understanding Solar Performance Metrics

| Term | Meaning |
|------|---------|
| **kW** | Instantaneous power (like speed) |
| **kWh** | Energy over time (like distance) — what your bill is measured in |
| **kWp** | Rated size of your array under standard test conditions |
| **Specific yield** | Annual energy per kWp installed (kWh/kWp) — useful for comparing systems |
| **Self-consumption rate** | % of solar generation used within the home |
| **Self-sufficiency rate** | % of home's total electricity demand covered by solar |
| **Export rate** | % of solar generation exported to the grid |

**Worked example (typical Irish household):**
- Household uses ~4,200 kWh/year
- 4 kWp system generates ~3,600–3,900 kWh/year
- If self-consumption rate = 45%:
  - Solar used at home = 0.45 × 3,800 = **1,710 kWh**
  - Exported = 2,090 kWh
  - Self-sufficiency = 1,710 / 4,200 = **41%**

---

### Monthly & Seasonal Performance — Ireland

SEAI: approximately **75% of annual solar PV output is produced from May to September**.

**Average daily generation (kWh/day) by month — south-facing, 35° tilt, Dublin reference:**

| Month | 3 kWp | 4 kWp | 5 kWp | 6 kWp |
|-------|------:|------:|------:|------:|
| January | 3.59 | 4.79 | 5.99 | 7.18 |
| February | 5.66 | 7.54 | 9.43 | 11.31 |
| March | 8.33 | 11.11 | 13.89 | 16.66 |
| April | 10.81 | 14.41 | 18.01 | 21.62 |
| May | 11.98 | 15.97 | 19.96 | 23.96 |
| June | 11.73 | 15.64 | 19.55 | 23.46 |
| July | 10.97 | 14.63 | 18.29 | 21.94 |
| August | 10.00 | 13.33 | 16.66 | 20.00 |
| September | 8.89 | 11.85 | 14.81 | 17.77 |
| October | 6.08 | 8.11 | 10.14 | 12.16 |
| November | 4.47 | 5.96 | 7.45 | 8.94 |
| December | 3.32 | 4.42 | 5.52 | 6.63 |

> **Honest note:** Sales pitches often say "5–8× summer vs winter". For typical *monthly averages* in Ireland, the ratio is closer to **~3–4×** (May vs December in the table above). Extreme "×8" comparisons cherry-pick unusually bright summer weeks vs very dull winter weeks.

---

### Factors Affecting Solar Output (Ireland-Specific)

| Factor | Notes |
|--------|-------|
| **Orientation** | South is best for annual yield. East–west splits improve morning/evening self-consumption but may reduce annual total |
| **Tilt** | ~30–35° commonly used in Irish modelling; many Irish roofs land in a workable range |
| **Shading** | Even partial shading disproportionately reduces output on string systems |
| **Soiling** | Irish rainfall often helps; coastal salt spray and bird activity may justify periodic cleaning |
| **Temperature** | PV output falls with heat; Ireland's mild climate is favourable |
| **Degradation** | ~0.3–0.5%/year for modern Tier 1 panels; designed into performance warranties |
| **Inverter clipping** | If inverter is smaller than DC array peak, bright cold days can clip output; usually a design trade-off, not a fault |

---

### Common Panel Problems: Visual Guide

| Issue | Classification | Homeowner Action |
|-------|---------------|-----------------|
| **Snail trails** | Performance-risk | Document with photos, note output change, escalate to installer |
| **Delamination/yellowing** | Warranty-sensitive | Document, escalate — warranty claim likely |
| **Hotspots** | Not visible without thermal imaging | Suspected if output drops locally; installer check required |
| **Junction box water ingress** | Safety-critical — **urgent** | Scorch marks/staining → contact installer immediately |
| **Bird nesting** | Performance-risk | Noise/debris at panel edges; can damage wiring over time → installer inspection |

**Homeowner rule:** Document with photos, note the date and any output change, then escalate. Roof access and DC testing are not DIY activities.

---

### Panel Cleaning — Irish Conditions

**Safety is the dominant constraint** — most PV cleaning accidents involve ladders/roofs, not electricity.

- If no obvious build-up: **Irish rainfall often sufficient**
- If cleaning needed: clean from ground level with soft brush; plain water or biodegradable soap
- **Never use pressure washers** (risk of seal damage and water ingress)
- Consider professional cleaning if roof-level access is required
- Coastal properties: more frequent cleaning due to salt spray
- Clean in early morning or evening when panels are cool

---

### What Homeowners Can and Cannot Do

| Homeowner-Safe ✅ | Requires Qualified Professional ❌ |
|------------------|----------------------------------|
| Monitor app yields and alarms | Any DC-side work, isolators, rewiring |
| Visual inspection from ground level | Inverter internal access |
| Check labelled breakers (do not open covers) | Roof access inspection |
| Confirm Wi-Fi/router is working | Electrical testing (insulation resistance, earthing, protection settings) |

---

### Maximising Self-Consumption Without a Battery

Core idea: match flexible loads to solar hours (midday-weighted in Ireland).

- Run dishwasher, washing machine, tumble dryer during **late morning/early afternoon**
- Use smart plugs/timers for dehumidifiers and discretionary loads
- Install an **immersion diverter** to store surplus solar as hot water (very common in Irish installs)
- If you have an EV: schedule charging to coincide with peak PV output (or use solar-aware charging modes)

---

### Understanding Your Electricity Bill With Solar

With solar, your bill splits into two flows:
- **Import**: kWh you buy from your supplier
- **Export**: kWh you send to the grid

To be paid for export via the **Clean Export Guarantee (CEG)**:
- An export reading mechanism is typically required (smart meter in most cases)
- Your installer must submit the appropriate ESB Networks form (NC6 for microgeneration)
- Apply through your electricity supplier

**Key principle:** Self-consumption (saving ~35c/kWh on imports) is almost always more valuable than export income (8–32c/kWh). Prioritise using your solar first.

---

## 2. Battery Storage

### How Home Batteries Work

A home battery stores electricity as chemical energy and releases it later:
- During daylight: if solar exceeds household demand, battery charges
- Evening/night: battery discharges to cover household loads
- If battery runs flat: seamlessly switches to grid

**Key terms:**

| Term | Meaning |
|------|---------|
| **Usable capacity (kWh)** | What you can realistically use — may differ from "nominal" |
| **Round-trip efficiency** | Energy lost storing and retrieving — losses are normal |
| **Depth of Discharge (DoD)** | How deep the battery is allowed to cycle; deeper cycles can reduce life |
| **C-rate** | How fast it charges/discharges relative to capacity |
| **State of Charge (SOC)** | Current charge level as a percentage |

---

### Battery Chemistry: LFP vs NMC

| Chemistry | Full Name | Key Properties |
|-----------|-----------|---------------|
| **LFP** | Lithium Iron Phosphate | Thermally stable; longer cycle life; physically larger per kWh; **preferred for home use** |
| **NMC** | Nickel Manganese Cobalt | Higher energy density (more compact); thermal risk management depends heavily on pack design/protection |

---

### Battery Brands in Ireland

Tesla (Powerwall), GivEnergy, Pylontech, BYD, FoxESS, SolarEdge ecosystem batteries, Huawei LUNA2000. Exact compatibility is inverter/model-specific.

---

### Battery Sizing Guide (Honest Approach)

Size based on **overnight/evening consumption you want to shift**, not total annual use.

**Practical method:**
1. Identify typical evening + night usage window (e.g., 5pm–8am)
2. Subtract loads you won't run on battery (electric shower, large EV charging unless specifically designed)
3. The remainder is your "battery target kWh"

**Rule of thumb:**
- **5 kWh usable:** Good for modest evening loads (lighting, TV, router, cooking basics) — not "whole house" coverage
- **10 kWh usable:** Often covers most evening/night loads for families in shoulder seasons
- **15 kWh+:** Only rational for high evening loads, high export you want to soak up, or time-of-use arbitrage — accept longer payback

---

### Battery Operating Modes

| Mode | Description | Best Use |
|------|-------------|----------|
| **Maximise self-consumption** | Charge from solar; discharge to cover loads; export only when full | Recommended for most Irish homes |
| **Time-of-use arbitrage** | Charge from grid at night/off-peak; discharge at peak | Depends on tariff — volatile; savings change as tariffs change |
| **Backup power** | Powers home during outages | Only if installed with backup hardware and grid isolation — not default |
| **Forced charge** | Charges from grid regardless of solar | Use before forecast bad weather or before peak pricing |

> **Irish grid safety:** Backup power is not always included by default. Check with your installer if this is important to you.

---

### Battery Maintenance

**Homeowner-safe:**
- Keep vents/space around the unit clear — do not cover with coats/boxes
- Watch for persistent over-temperature alarms or repeated shutdowns
- Keep monitoring app updated; ensure battery stays online

**Installer-only:**
- Firmware updates affecting grid settings/safety
- Internal inspection, torque checks, DC connection tests

---

### Understanding Battery Warranties ("10 Years at 60%")

This means the manufacturer warrants that at the end of the warranty period the battery will retain at least the stated percentage of original usable capacity *under defined operating conditions*.

It does **not** mean the battery becomes unusable at year 10 — it means you should expect reduced runtime and reduced shifting capability over time.

**Practical lifespan strategies:**
- Avoid routinely sitting at 100% SOC for long periods (if system supports adaptive control)
- Keep installation location within the manufacturer's specified temperature range
- Prefer moderate cycling over aggressive forced cycling unless economically justified

---

## 3. Heat Pumps

### How Air-to-Water Heat Pumps Work

A heat pump **moves heat** from outdoor air into your home's water-based heating system using a refrigeration cycle (compressor + refrigerant). It does not "create" heat like a resistive electric heater.

**COP and SCOP:**
- **COP** (Coefficient of Performance): instantaneous efficiency at a specific test condition. COP 3.5 = 3.5 units of heat output for 1 unit of electricity input
- **SCOP** (Seasonal COP): efficiency across a full heating season — more representative of Irish real-world performance

---

### Heat Pump Brands in Ireland

Mitsubishi Electric (Ecodan), Daikin (Altherma), Grant (Aerona), Samsung (EHS), Vaillant (aroTHERM), Panasonic (Aquarea), Hitachi (Yutaki)

---

### Sizing: The Root of Most Aftercare Issues

Most "my bill is too high" complaints are **not equipment defects** — they are design and settings issues:
- Heat loss calculation and emitter sizing must be correct for the home
- Flow temperatures must be kept as low as practical
- Weather compensation must be tuned

**Heat Loss Indicator (HLI):** Irish retrofit guidance uses HLI to express how quickly a home loses heat per m². SEAI references an HLI threshold of **≤2.3 W/K·m²** for certain upgrade eligibility (including the windows/doors grant). If a home is not "heat pump ready", expect cycling, high flow temperatures, comfort issues, and bill shock.

---

### Radiator Compatibility: Why 45°C Feels "Different"

Heat pumps are most efficient at **lower flow temperatures** (~35–45°C). A gas/oil boiler typically runs at 60–75°C. At lower temperatures, radiators produce less heat **unless they were sized accordingly**.

- **Underfloor heating:** Inherently well-matched to low-temperature operation (large surface area)
- **Radiators:** May need upsizing if original sizing was for a boiler system

If rooms are cold: often because emitters are undersized for low-temperature operation, or because controls are set incorrectly (wrong compensation curve, zones, poor balancing).

---

### Optimal Settings (Set-and-Forget Model for Ireland)

- **Enable weather compensation** and tune it gradually — this adjusts flow temperature based on outdoor temperature
- Maintain **stable indoor setpoints** (20–21°C) rather than large daily swings — heat pumps are most efficient running steadily
- **Defrost cycles:** Outdoor units periodically defrost in damp cold Irish conditions; short-term dips in output are **normal, not a fault**. Wait 10–15 minutes
- **Hot water:** Schedule cylinder heating to align with solar PV generation where possible. Run a **legionella cycle** (high-temperature: typically 60°C+) weekly
- **Immersion boost:** Normal for peak demand; overuse undermines efficiency and increases bills
- **TRVs:** Keep radiator valves open (not closed) in well-used rooms — closing all TRVs reduces efficiency and causes short-cycling

---

### Common Heat Pump Problems

| Problem | Likely Causes | Homeowner Action |
|---------|--------------|-----------------|
| High bills / low COP | High flow temps, wrong compensation curve, immersion overuse, heat loss exceeds design | Check settings; review with installer |
| Cold rooms | Emitter sizing; TRVs closed; zone configuration | Open TRVs; check zone settings; contact installer |
| Short cycling | Oversized unit, poor buffering, control issues | Installer review |
| Noise | Siting, anti-vibration mounts, airflow obstruction | Contact installer |

**DIY boundaries:** Homeowners should **not** open refrigeration circuits or electrical covers. They can: change user-facing schedules and setpoints, clean accessible filters, keep outdoor airflow clear.

---

## 4. EV Charging

### Charger Types

| Type | Speed | Use |
|------|-------|-----|
| **Mode 2** (3-pin "granny" cable) | Slow (~2.3 kW) | Temporary/emergency use only |
| **Mode 3** (dedicated wallbox) | 7.4 kW (32A single-phase) or 22 kW (three-phase) | Normal home solution — faster, safer, controllable |

SEAI notes typical home charger sizes: 16A (~3.7 kW) and 32A (~7.4 kW) single-phase.

---

### EV Charger Brands in Ireland

MyEnergi (Zappi), Ohme, Easee, Wallbox, EVBox, ABB

---

### Smart Charging Features

| Feature | Plain-English Meaning |
|---------|----------------------|
| **Scheduled charging** | Charge when electricity is cheapest (off-peak/night rate) |
| **Solar surplus charging** | Charge only when PV has spare capacity — reduces export, increases self-consumption |
| **Dynamic load balancing** | Reduces charger power when other high loads are running to avoid tripping breakers |
| **kWh tracking** | Measures energy delivered to the car |

---

### Installation Requirements (Ireland)

- A home charger must be on a **dedicated circuit** with appropriate protection
- Must be certified by a **Registered Electrical Contractor (REC)**
- Cable sizing, RCD type, earthing, and load assessment depend on existing electrical infrastructure — must be designed by the installer
- ESB Networks: EV charger products should be selected from the **LCT register** from January 2025 onward

---

### EV Charger Troubleshooting (Homeowner-Safe)

1. Check charger's **breaker/RCD** has not tripped
2. Try a different start method (app vs plug-and-charge vs RFID if fitted)
3. Check **Wi-Fi/mobile signal** if the unit relies on connectivity
4. Check if the **car itself** has a delayed charging schedule — vehicle-side schedules often override charger settings

**Escalate immediately if:** Repeated RCD trips, "earth fault" indication, overheating, or melted connectors/cables.

---

## 5. Ventilation (MVHR)

### Why Ventilation Matters More After Retrofit

As homes become more airtight (new windows, doors, insulation, draught-proofing), natural leakage drops. Without planned ventilation, moisture and indoor pollutants accumulate — increasing risks of condensation, mould, and poor indoor air quality. Covered under Ireland's **Technical Guidance Document Part F (Ventilation)**.

---

### How MVHR Works

MVHR (Mechanical Ventilation with Heat Recovery):
- **Extracts** stale air from "wet rooms" (kitchen, bathrooms)
- **Supplies** fresh air to living spaces/bedrooms
- **Transfers heat** from outgoing air to incoming air via heat exchanger — reducing heat loss
- Uses **filters** that need periodic replacement

**Brands in Ireland:** Vent-Axia, Zehnder Group, Mitsubishi Lossnay (in some specifications)

---

### MVHR Homeowner Maintenance

| Task | Frequency | Notes |
|------|-----------|-------|
| Replace/clean filters | Every 3–6 months (environment-dependent) | Most important regular task |
| Use boost mode | During showers/cooking | Prevents moisture build-up |
| Keep vents unobstructed | Ongoing | Check supply/extract grilles are not blocked |
| Report unusual noise or persistent condensation | As needed | System balancing or commissioning issue |

---

## 6. Irish Grants, Regulations & Financial

> ⚠️ **This section is volatile.** Grant amounts, export rates, electricity prices, and tax treatments change. Verify on SEAI's website for current figures.

### Key Irish Bodies

| Body | Role |
|------|------|
| **ESB Networks** | Grid connection rules, smart meter roll-out, microgeneration forms (NC6), technical standards |
| **SEAI** | Grants, contractor registers, retrofit schemes |
| **CRU** | Energy regulator (network charges, market rules, consumer frameworks) |
| **Revenue** | VAT and tax treatment (including microgeneration tax exemption) |

---

### SEAI Grant Landscape (2026)

**Key 2026 changes (official SEAI position):**
- Increased grants for attic and cavity wall insulation (effective early February 2026)
- Restructured heat pump support package "up to €12,500" via stacked components
- New **windows and doors grant** opening **2 March 2026**
- Expanded eligibility (second wall measure, supports for first-time buyers and welfare recipients)

#### Solar PV Grant
**Maximum: €1,800** (unchanged in 2026)
- First 2 kWp: €700/kWp = €1,400
- 2–4 kWp (additional): €200/kWp = up to €400
- **0% VAT** on supply and installation of residential solar panels

#### Heat Pump Grant (from 3 February 2026)
| Component | Amount |
|-----------|--------|
| Heat pump unit (house) | €6,500 |
| Central heating upgrades (radiators/pipework) | €2,000 |
| Renewable Heat Bonus (replacing fossil fuel/electric storage) | €4,000 |
| **Maximum total (house)** | **€12,500** |

- HLI must be ≤2.3 W/K·m²
- VAT on heat pumps reduced to **9%** from 1 January 2025

#### Windows and Doors Grant (from 2 March 2026)
| Dwelling Type | Windows | External Doors |
|--------------|---------|---------------|
| Apartment | €1,500 | €800/door (max 2) |
| Mid-terrace | €1,800 | €800/door (max 2) |
| Semi-D/end-terrace | €3,000 | €800/door (max 2) |
| Detached | **€4,000** | €800/door (max 2) |

Technical requirements: U-value ≤1.4 W/m²K; post-works BER; HLI ≤2.3 W/K·m² (or insulation rated "Good/Very Good").

#### Wall Insulation Grants
| Type | Apartment | Mid-terrace | Semi-D | Detached |
|------|-----------|-------------|--------|----------|
| Cavity wall | €700 | €850 | €1,300 | €1,800 |
| Internal dry lining | €1,500 | €2,000 | €3,500 | €4,500 |
| External wall | €3,000 | €3,500 | €6,000 | €8,000 |

#### Attic Insulation Grants
- Standard: up to €2,000 (detached)
- From 2 March 2026: **first-time buyers** can access a higher fixed grant up to **€2,500**

#### EV Charger Grant
**€300** (reduced from €600 on 1 January 2024)

#### Other Grants
| Measure | Grant |
|---------|-------|
| Heating controls upgrade | €700 |
| Solar water heating | €1,200 |
| BER assessment | €50 |

---

### One Stop Shop vs Individual Grants

| Route | How It Works | Best For |
|-------|-------------|----------|
| **Individual grants** | Homeowner applies, hires SEAI-registered contractors, pays upfront, claims grant afterwards | Single-measure upgrades |
| **One Stop Shop** | SEAI-registered provider manages everything; grant typically deducted upfront | Multi-measure deep retrofits |

> ⚠️ **Critical rule for all SEAI grants:** Work must NOT start before SEAI grant approval. Purchases or works before approval date = application ineligible.

---

### Clean Export Guarantee (CEG) Rates — Early 2026 Snapshot

> ⚠️ **Volatile.** Supplier rates change; treat all figures as "as of" data with an update date.

| Supplier | Export Rate |
|----------|------------|
| Pinergy | 25.0c/kWh |
| Electric Ireland | 19.5c/kWh |
| SSE Airtricity | 19.5c/kWh |
| Community Power | 20.0c/kWh |
| Bord Gáis Energy | 18.5c/kWh |
| Energia | 18.5c/kWh |
| Flogas | 18.5c/kWh |
| PrepayPower | 15.89c/kWh |

- First **€400/year** of CEG income is **tax-free** (Revenue guidance)
- Export requires a **smart meter** and the installer must have submitted the NC6 form
- Payments typically credited quarterly or bimonthly on electricity bills

---

### Tax and VAT Summary

| Item | Treatment |
|------|-----------|
| Solar panels (supply + installation) | **0% VAT** |
| Heat pumps | **9% VAT** (from 1 January 2025) |
| Gas and electricity | 9% VAT (volatile; extended by policy) |
| CEG export income | **€400/year tax-free** threshold (conditions apply) |

---

### Electricity Pricing — March 2026 Snapshot

> ⚠️ **Highly volatile.** Verify via SEAI price datasets or comparison sites.

- Average unit price (standard 24-hour urban meter): approximately **36.34c/kWh** (incl. VAT, February 2026 — Selectra data)
- **Why bills don't perfectly track wholesale prices:** Network charges, standing charges, supplier hedging, and policy costs all contribute separately to the retail bill

---

### ESB Networks Grid Connection (NC6 Form)

- The installer submits the **NC6** (Notification of Electrical Installation) to ESB Networks for microgeneration systems
- ESB Networks has **20 working days** to process; no charge
- This triggers the **smart meter installation** process (ESB Networks aims to install within 4 months)
- Homeowners must keep copies of all ESB Networks and SEAI paperwork

---

### Planning Permission for Solar Panels (Ireland)

- **Domestic houses:** Can install solar panels on rooftops **without planning permission** under post-2022 rules, subject to conditions
- **Exceptions:** Protected structures, Architectural Conservation Areas, Solar Safeguarding Zones (within 5 km of airports)
- **Ground-mounted:** Exempt up to 25 m²

---

## 7. Practical Homeowner Guides

### Seasonal Operating Strategy

**Summer (May–September):**
- Prioritise daytime loads (EV charging, hot water, appliances)
- Keep battery capacity available for evening
- Accept higher export — export income is a bonus, but self-consumption is still the primary value

**Winter (October–April):**
- Generation is low — focus on **heat pump efficiency** (low flow temps), tariff optimisation, and load management
- Expect higher imports; ensure battery strategy doesn't force expensive cycling

---

### Power Cuts: What Works and What Doesn't

Standard grid-connected solar PV **shuts down during a power cut** (anti-islanding — legally required under Irish grid standards). Your solar will not power your home during an outage unless the system was specifically designed with an approved backup/islanding function.

**After power returns:**
1. Wait a few minutes for the grid to stabilise
2. Check inverter returns to normal state (solid green / normal display)
3. If stuck in fault: record alarm code, contact installer

---

### Understanding Your Meter (MPRN)

- Locate your **MPRN** (Meter Point Reference Number) on your electricity bill — needed for SEAI grants and supplier processes
- Meter types: standard 24-hour, day/night, or smart (interval metering)
- Export metering may be separate; export payment eligibility depends on supplier and metering configuration
- Smart meters are required for most CEG export payment arrangements

---

### Selling a Home with Renewable Systems

**Minimum documentation pack for buyers:**
- SEAI grant documentation and **BER certificates** (post-works BER explicitly required under some SEAI grants)
- Equipment datasheets and warranties for all systems
- Monitoring platform login transfer instructions
- Installer commissioning sheets (especially for microgeneration grid compliance)
- NC6 confirmation from ESB Networks

**Insurance:** Notify your insurer when installing PV, batteries, heat pumps, and EV chargers. The insurer may require proof of professional installation/certification.

---

### Common Myths — Ireland-Specific Corrections

| Myth | Reality |
|------|---------|
| "Solar doesn't work in Ireland" | Daylight still produces power. Strong seasonality, but 75% of annual output May–September. |
| "You always need planning permission for solar" | Generally not for domestic rooftops under current rules (with conditions) |
| "Export payments guarantee quick payback" | Export rates and import prices are volatile. Self-consumption (saving imports) is the primary value driver. |
| "Summer is 8× winter output" | Monthly averages in Ireland are typically 3–4× (May vs December). The ×8 figure cherry-picks extreme weeks. |
| "The battery is fully usable" | Usable capacity may differ from nominal; warranties cover a minimum capacity retention, not a binary on/off |

---

## 8. Troubleshooting Decision Trees

> These trees are written to be safe for homeowners. Anything involving covers off, DC wiring, or internal electrical work is excluded.

### Solar System Not Generating

1. **Is it daytime?** → If no: normal. PV does not generate at night.
2. **Does the app show today's yield increasing?** → If yes: system generating; check self-consumption/export and loads.
3. **Is the issue only "no data" (monitoring), or "zero power" (generation)?** → If monitoring only: follow "Monitoring no data" tree below.
4. **Check inverter status** (LEDs/screen/app alarm list)
   - Fault/alarm present → record exact code; call installer. Do not attempt repeated resets.
   - "Waiting" or "standby" → check if grid is present.
5. **Check consumer unit** for tripped breaker labelled PV/solar/inverter
   - If tripped → reset once. If it trips again: stop, call installer.
6. **Inverter dead/no lights and breaker is on** → call installer (possible supply or internal fault).

---

### Battery Not Charging/Discharging

1. Check battery SOC on the app
2. Check operating mode (self-consumption / time-of-use / backup)
3. Check whether a tariff schedule or grid export limit is blocking charge/discharge
4. Check for temperature warnings (too hot/too cold)
5. Check for alarms — record code; contact installer if persistent

---

### Heat Pump Not Heating

1. Confirm controller is calling for heat (correct mode, schedule, setpoint)
2. Check outdoor unit clearance and whether it is in defrost — wait 10–15 minutes if suspected
3. Check breakers (do not open covers)
4. If error code displayed → record and contact installer

---

### High Electricity Bill Despite Solar/Heat Pump

1. Is the bill **estimated or actual**? (Meter read timing matters)
2. Compare solar generation vs seasonal expectation — winter is low
3. Check **self-consumption rate**: are you exporting most solar while still importing heavily?
4. If heat pump: check flow temperatures and schedule; avoid immersion overuse
5. Consider **tariff mismatch**: a time-of-use or day/night tariff can help or hurt depending on behaviour
6. If still abnormal: request **installer commissioning review** (controls and design)

---

### Monitoring App Showing No Data

1. Check home **Wi-Fi/router** power and internet connection
2. Check whether inverter is online locally (LEDs or screen)
3. Power cycle router **once** (not repeatedly)
4. If still offline >24 hours: contact installer (may require re-pairing, firmware update, or network reconfiguration)

---

### EV Charger Not Starting

1. Check **breaker/RCD status**
2. Check vehicle charge port; check if car is set to **delayed charging**
3. Try alternate initiation method (app vs plug-and-charge)
4. If repeated faults, overheating, or persistent trips: **stop and contact installer**

---

### Escalate to Installer Immediately If:

- **Burning smell**, discoloration, arcing sounds
- Water ingress into any electrical equipment
- Repeated breaker tripping
- "Isolation/earth" alarm on inverter
- Inverter indicates persistent grid fault or insulation fault
- Inverter completely dead (no lights) and PV breaker is on
- EV charger: repeated RCD trips, earth fault indication, overheating, or melted connectors
- Any visual sign of fire, scorch marks, or smoke

---

*Note on model-specific content: LED colour meanings, per-model error code tables, and platform-specific step sequences are best maintained as separate per-manufacturer knowledge packs within the aftercare portal, as they change with firmware and model revisions. The Ireland-specific compliance, grant, and financial layers above are grounded in primary Irish sources (SEAI, ESB Networks, Revenue, CSO) and should be reviewed on an explicit update cadence.*
