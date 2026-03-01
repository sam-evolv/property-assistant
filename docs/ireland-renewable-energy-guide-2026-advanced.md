# The Definitive Guide to Residential Renewable Energy in Ireland (2026)

> **Scope:** Advanced technical and practical repository for homeowners, installers, and aftercare specialists. Covers solar PV, battery storage, heat pumps, and EV infrastructure within the Irish climatic and regulatory context.  
> **Context:** The modern Irish home is no longer a passive grid consumer — it is an active participant in a decentralised energy ecosystem, driven by the National Residential Retrofit Plan, advanced semiconductor solar technologies, and a restructured 2026 SEAI grant framework.

---

## Part 1 — Solar PV Fundamentals

### How Solar Generation Works

Solar PV operates via the **photovoltaic effect**: photons from sunlight strike silicon cells, dislodging electrons and creating a flow of direct current (DC). In Ireland, where diffuse light (overcast conditions) is more common than direct high-intensity sunlight, cell efficiency in low-light conditions is particularly important.

Because household appliances and the national grid operate on alternating current (AC), a system requires an **inverter** to transform DC power into usable AC at 230V and 50Hz.

---

### System Architectures

| Architecture | How It Works | Shading Impact | Best For |
|---|---|---|---|
| **String inverter** | All panels wired in series to one inverter | Entire string drops to worst panel | Simple roofs, no shading |
| **String + power optimisers** | Optimiser on each panel feeds a string inverter | Each panel operates independently | Partial shading (dormers, chimneys) |
| **Microinverters** | One inverter per panel on the roof | Zero cross-panel shading impact | Complex roof, maximum flexibility |
| **Hybrid inverter** | String inverter + integrated battery management | Same as string | Standard in 2026 for battery-ready installs |

**2026 Irish market:** Hybrid inverters have become the standard — integrated electronics manage both the solar array and battery simultaneously, reducing conversion losses and hardware footprint.

---

### Solar Panel Technologies (2026)

| Technology | Efficiency | Temperature Coefficient | Bifaciality | Use Case |
|---|---|---|---|---|
| Mono PERC | 20–22% | −0.35%/°C | 70–75% | Budget, large roofs |
| **N-type TOPCon** | 22–24% | −0.30%/°C | 75–80% | **Current Irish residential standard** |
| HJT (Heterojunction) | 24–26% | −0.26%/°C | 85–95% | High-performance, limited space |
| Bifacial | Variable | N/A | High | Ground mounts, light-coloured roofs |

**Key points:**
- N-type TOPCon has largely superseded legacy P-type PERC in the Irish market
- Lower temperature coefficient = less power loss on warm days (Ireland's mild climate is inherently favourable)
- TOPCon panels (JinkoSolar, LONGi, JA Solar) at 430–450W per module represent the price/performance sweet spot for Irish residential
- **Bifacial gain on rooftops:** typically modest; most beneficial on ground-mounted systems over reflective surfaces (light gravel: 15–20% additional yield)

---

### Inverter Brand Guide and Diagnostic Protocols

#### Huawei SUN2000 Series (L1, M1) — Most Common in Ireland

Fanless design, natural convection cooling, built-in Wi-Fi.

**LED Status:**
| LED State | Meaning |
|---|---|
| Steady green | Operating normally — feeding the grid |
| Blinking green (1s on/1s off) | Standby/sleep mode — normal at dawn/dusk |
| Steady red | Hardware fault — contact installer |
| Blinking red (fast) | Environmental alarm: grid voltage issue or DC insulation fault |

**Key Error Codes:**
| Code | Description | Action |
|---|---|---|
| **2032** | Grid loss — inverter cannot detect the ESB grid | Check main AC isolator; check for local power cut |
| **2062** | Low insulation resistance — often moisture in DC connectors after heavy rain | If persists in dry weather = wiring fault; call installer |
| **2064** | Device fault — internal circuit error | Contact installer; unrecoverable internally |

---

#### SolarEdge SE Series — DC-Optimised Architecture

Requires power optimisers on every panel. Each panel operates independently.

**LED Status:**
| LED State | Meaning |
|---|---|
| Green | Production active |
| Blue | Communicating with SolarEdge monitoring portal |
| Red | System error |

**Key Issue:**
- **"Isolation Fault" (Code 03x9a):** Do NOT attempt to reset. This signals a grounding issue that requires professional inspection — fire risk if ignored.

**mySolarEdge App:** Unique "Layout" view shows performance of every individual panel. A panel showing black or significantly lower yield than neighbours may indicate localised shading or a hotspot.

---

#### Fronius Primo and Gen24 — Active Cooling Fan Design

**Key Error States:**
| State | Description | Action |
|---|---|---|
| **State 107** | Grid parameters outside limits | System waiting for grid to stabilise — usually self-resolves |
| **State 307** | DC input voltage too low | Normal at night or if panels covered in snow/debris |
| **State 509** | No energy fed to grid for 24 hours | Check all breakers (AC and DC isolators) |

---

### Irish Performance Expectations

1 kWp well-installed in Ireland: **850–1,100 kWh/year** depending on location.

**Monthly yield reference — 4 kWp system:**
| Month | Monthly Yield (kWh) | Daily Average (kWh) |
|---|---|---|
| January | 100–150 | 3–5 |
| March | 300–400 | 10–13 |
| June | 550–650 | 18–22 |
| September | 320–420 | 11–14 |
| December | 80–120 | 2.5–4 |

A system produces approximately **5–8× more energy in June than December** (for extreme week comparisons; typical monthly ratio closer to 3–4×).

**Irish "Gold Standard" orientation:** South-facing, 35° tilt.  
**East/West split:** Increasingly popular — spreads generation across the day, better matching morning and evening usage peaks typical of Irish families.

---

### Physical Problems — Field Reference

| Problem | Description | Risk Level | Action |
|---|---|---|---|
| **Snail trails** | Dark discolouration along microcracks | Performance-risk | Document, escalate to installer |
| **Hotspots** | Failed cell dissipating energy as heat; may melt backsheet | Safety-risk | Not DIY-visible without thermal imaging; installer required |
| **Bird nesting** | Crows/pigeons under panels for warmth — very common in Ireland | Performance-risk over time | "Bird Guard" mesh; installer inspection |
| **Coastal salt crust** | Translucent film reducing efficiency 5–10% | Performance-risk | Clean with deionised water and soft brush; never pressure wash |

---

## Part 2 — Battery Storage

### Chemistry Comparison: LFP vs NMC (2026)

By 2026, **Lithium Iron Phosphate (LFP/LiFePO4) has become the dominant chemistry** in Irish home storage.

| Property | LFP | NMC |
|---|---|---|
| Thermal stability | High (non-toxic, high runaway threshold) | Lower — pack design is critical |
| Cycle life | **6,000+ cycles** | 2,000–3,000 cycles typical |
| Energy density | Lower (physically larger per kWh) | Higher (more compact) |
| 2026 home suitability | **Preferred for Irish homes** | Used in some products and EVs |

---

### Major Battery Brands — 2026 Specification Reference

| Brand | Model | Usable Capacity | Chemistry | Notes |
|---|---|---|---|---|
| **Huawei** | LUNA2000-S1 | 6.9 / 13.8 / 20.7 kWh | LFP | Modular; 15-year warranty |
| **Tesla** | Powerwall 3 | 13.5 kWh | LFP | Integrated hybrid inverter (20 kW solar input); **97.5% round-trip efficiency** |
| **GivEnergy** | All-in-One | 13.5 kWh | LFP | Whole-home backup; silent (<30 dB) |
| **Pylontech** | US5000 | 4.8 kWh | LFP | Modular rack-mount, 48V |
| **BYD** | Premium HVS | 5.1–12.8 kWh | LFP | High-voltage, modular stacking |

**Tesla Powerwall 3 (2026):** Significant advancement — integrated hybrid inverter capable of 20 kW solar input; round-trip efficiency of 97.5% (only 2.5% energy lost in charge/discharge cycle).

---

### Operating Modes

| Mode | How It Works | Best Season |
|---|---|---|
| **Maximum self-consumption** | Solar → home → battery → grid; no export until battery full | Year-round default |
| **Time-of-Use (TOU) arbitrage** | Charge from grid at cheap overnight rate (e.g. 2am–5am); discharge at peak (5pm–7pm) | Winter (low solar generation) |
| **Backup/EPS** | Battery powers essential circuits during grid outage | Emergency |

> ⚠️ **Backup mode requires a "Backup Box" or "Gateway"** — standard grid-tied batteries without this hardware will NOT function during a power cut (anti-islanding safety requirement). Ask your installer whether backup capability was included at installation.

---

### Battery Sizing for Irish Homes

| Usable Capacity | What It Covers | Notes |
|---|---|---|
| **5 kWh** | Entry-point; evening lights, TV, router, basic cooking | Not "whole house" coverage |
| **10 kWh** | Most evening/night loads for a 3-bed semi in shoulder seasons | **Recommended for most families** |
| **15 kWh+** | High evening loads, large PV systems, aggressive TOU arbitrage | Longer payback; assess economics carefully |

---

## Part 3 — Heat Pumps

### How Air-to-Water Heat Pumps Work

Extracts thermal energy from outdoor air (even at sub-zero temperatures) using a refrigeration cycle (compressor + refrigerant) and delivers it to the home's water-based heating system (radiators or underfloor heating).

**COP and SCOP:**
- COP 4.0 = 4 kWh of heat for 1 kWh of electricity consumed (400% efficiency)
- SCOP (Seasonal COP): average efficiency across the full Irish heating season — most top-tier 2026 units achieve **SCOP 4.3–5.4**

---

### Heat Pump Brand Reference — 2026 Irish Market

| Brand | Model | Max Flow Temp | Refrigerant | Notes |
|---|---|---|---|---|
| **Mitsubishi Electric** | Ecodan R290 | 75°C | R290 (Propane) | Ideal for radiator retrofits in older homes |
| **Grant** | Aerona3 R32 | 55°C | R32 | Compact; high SCOP (5.4) |
| **Daikin** | Altherma 3 | 65°C | R32 | Built-in hot water tank options |
| **Vaillant** | aroTHERM Plus | 75°C | R290 | Very quiet operation |
| **Panasonic** | Aquarea T-CAP | 75°C | R290 | Maintains full capacity at −20°C |

---

### R290 vs R32 Refrigerant — Why It Matters for Older Irish Homes

**The 2026 R290 transition is significant for retrofit projects:**

| Refrigerant | Max Flow Temp | Radiator Implication |
|---|---|---|
| **R290** (Propane) | 75°C | Can often **retain existing radiators** in older homes |
| R32 | 55°C | Usually requires **upsized radiators** to compensate for lower output temperature |

This distinction is critical for homeowners in older properties (pre-2000) where existing radiators were sized for a boiler running at 60–75°C. An R290 unit can often work with the existing radiator system; an R32 unit usually requires a radiator upgrade programme.

---

### Sizing and the HLI Requirement

A heat pump must be sized based on a **room-by-room heat loss calculation**:
- **Undersized:** Struggles to reach temperature → high bills
- **Oversized:** Short cycles frequently → premature component wear

**SEAI HLI threshold:** ≤ 2.3 W/K·m² required for grant eligibility. Typically requires attic and wall insulation as a prerequisite.

---

### Heat Pump Troubleshooting (Homeowner-Safe)

**Step 1 — Check system pressure:** Is the pressure gauge between **1.0 and 2.0 bar**?  
- Below 1.0 bar: system may need re-pressurising — contact installer (do not attempt yourself on a sealed system)  
- Above 3.0 bar: overpressure — contact installer

**Step 2 — Check controller:**
- Is it in **Holiday Mode**? (A common accidental cause of no heat)
- Is the **setpoint temperature** lower than the current room temperature? The system won't call for heat if the setpoint is already met.

**Step 3 — Check the outdoor unit:**
- Is the fan spinning? Stopped fan = likely fault
- Is the unit **iced over**? Defrost cycle takes approximately 10 minutes — wait before concluding it is a fault

**Step 4 — Error codes:**
- Note the exact fault code displayed (e.g., Mitsubishi 'P' codes, Daikin error numbers)
- Record for installer — do not attempt internal repairs

---

### "Set and Forget" Operation Model

Heat pumps are most efficient running continuously at a **stable low temperature**, not cycled on/off like a boiler.

- Enable **weather compensation** (automatically adjusts flow temperature to outdoor conditions)
- Maintain stable **indoor setpoints** (20–21°C) — large overnight setbacks cost more energy to recover
- Expect **defrost cycles** in winter: the outdoor unit briefly stops heating to melt ice on the coils; short-term dips are normal
- Schedule **hot water** cylinder heating to align with solar PV generation where possible
- Run **weekly legionella cycle** at 60°C+ for hygiene

---

## Part 4 — EV Charging

### Connector Types and Speeds

Residential EV charging draws **7.4 kW** — roughly equivalent to running three large kettles simultaneously.

| Type | Power | Use |
|---|---|---|
| Mode 2 (3-pin "granny" cable) | ~2.3 kW | Emergency/temporary only |
| **Mode 3 wallbox (16A)** | ~3.7 kW | Light usage, overnight charging |
| **Mode 3 wallbox (32A)** | **7.4 kW** | Standard Irish residential |
| Three-phase (22 kW) | 22 kW | Rarely available residential; requires dedicated three-phase supply from ESB Networks |

Most Irish residences are **single-phase** (maximum 7.4 kW). Three-phase 22 kW is uncommon in residential areas without a dedicated ESB Networks supply.

---

### Leading Charger Brands — Irish Market 2026

| Brand | Model | Key Feature |
|---|---|---|
| **MyEnergi** | Zappi v2.1 | Solar surplus charging — "Eco+" mode charges only from PV surplus |
| **Ohme** | Home Pro | Smart tariff integration — auto-schedules for cheapest hours (real-time pricing) |
| **Wallbox** | Pulsar Plus | Compact; high-speed Bluetooth; widely installed in Ireland |
| **Easee** | One | Intelligent load balancing — multiple chargers on one circuit without overloading main fuse |

---

### Dynamic Load Balancing — What It Is and Why It Matters

**Dynamic load balancing** prevents the main house fuse from tripping when the EV charger and other high loads run simultaneously.

How it works:
1. A **CT (Current Transformer) clamp** is installed at the main ESB meter — it monitors the total house electrical draw in real time
2. If a large load switches on (e.g., electric shower at 9 kW), the charger automatically reduces car charging power
3. The system ensures total draw never exceeds the **main 63A fuse** (≈14.5 kW on single phase)

**Practical example:**
- Car charging at 7.4 kW + electric shower at 9 kW = 16.4 kW → would trip 63A fuse
- With dynamic load balancing: shower detected → car charger drops to ~5 kW → total = 14 kW → no trip

This is a standard requirement for Irish installations and is built into modern chargers like the Easee One and Ohme Home Pro.

---

## Part 5 — Ventilation (MVHR)

### Why Ventilation Is Critical After Retrofit

As homes become airtight through insulation and window upgrades, natural draughts that previously provided ventilation disappear. Without controlled ventilation:
- Moisture accumulates → condensation and mould
- Indoor pollutants (CO2, VOCs, cooking fumes) build up
- Indoor air quality degrades

MVHR recovers **up to 95% of heat** from extracted air, significantly reducing the heating load on the heat pump.

### Brands and Maintenance

**Major Irish market brands:** Zehnder ComfoAir, Vent-Axia Sentinel, Mitsubishi Lossnay

**Filter maintenance:** Every 6–12 months (more frequently if pets, coastal location, or nearby construction). Restricted filters reduce airflow efficiency and negate the health benefits of the system.

---

## Part 6 — Irish Grants, Regulations & Financial

### 2026 SEAI Individual Energy Upgrade Grants
*(Works where Request for Payment submitted from March 2026 onwards)*

| Measure | Apartment | Mid-terrace | Semi-D/End-terrace | Detached |
|---|---|---|---|---|
| Attic insulation | €1,100 | €1,400 | €1,500 | **€2,000** |
| Cavity wall insulation | €700 | €850 | €1,300 | **€1,800** |
| External wall insulation | €3,000 | €3,500 | €6,000 | **€8,000** |
| Heat pump system | €4,500 | €6,500 | €6,500 | **€6,500** |
| Renewable Heat Bonus | €4,000 | €4,000 | €4,000 | **€4,000** |
| Central Heating Upgrade | €2,000 | €2,000 | €2,000 | **€2,000** |
| Windows (complete) | €1,500 | €1,800 | €3,000 | **€4,000** |
| Solar PV (maximum) | €1,800 | €1,800 | €1,800 | **€1,800** |

**Total heat pump bundle maximum: €12,500** (heat pump + central heating upgrade + renewable heat bonus)

---

### Clean Export Guarantee (CEG)

**Current rates (March 2026):** Approximately 18.5c–25c/kWh across major suppliers.  
**Tax exemption:** First €400 of CEG income is tax-free annually (until at least 2028).

**Deemed Export (for homes without a smart meter):**  
If a smart meter has not yet been installed, CEG payment can still be made based on a **"Deemed Export" calculation** — an SEAI-estimated figure of what a typical home would export — until a smart meter is fitted. This means you do not have to wait for a smart meter to start receiving export payments.

**To activate CEG:**
1. Installer submits **NC6** to ESB Networks (20 working days to process)
2. ESB Networks installs a smart meter (or begins Deemed Export payments in the interim)
3. Register with your electricity supplier for the Micro-generation Support Scheme / CEG

---

### ESB Networks NC6 Process

The NC6 (**Notification of Completion**) is submitted by your solar installer to ESB Networks after installation. Once processed:
- Your electricity supplier is notified
- Your export account is activated
- Smart meter installation is triggered (if not already fitted)

**Homeowners must keep copies** of the NC6 confirmation, SEAI grant documentation, and all post-works BER certificates.

---

## Part 7 — Practical Homeowner Guides

### Understanding Your Smart Meter and Bill

**MPRN (Meter Point Reference Number):** 11-digit number on your electricity bill. Required for SEAI grant applications and supplier processes.

**Smart meter registers:**
| Register | What It Measures |
|---|---|
| **Import (Cumulative)** | Total electricity bought from the grid |
| **Export (Cumulative)** | Total electricity sent to the grid |
| **Active (Current)** | Real-time demand or generation |

---

### Seasonal Operating Strategy

**Summer:**
- Maximise self-consumption: run appliances, charge EV, heat water during solar hours
- Keep battery capacity available for evening discharge
- Export surplus as bonus income

**Winter:**
- Solar yield is low — switch to **TOU (Time-of-Use) arbitrage**
- Charge battery from cheap overnight grid rate (e.g., 2am–5am)
- Discharge during expensive peak window (5pm–7pm)
- Keep heat pump outdoor unit **clear of leaves and debris** — essential for airflow and efficiency

---

### Power Cuts — Irish Reality Check

Standard solar PV **stops working automatically** during a power cut (anti-islanding — mandatory under Irish grid protection standards). This prevents sending power back to a grid that ESB Networks engineers may be working on.

**Battery backup during outages:** Only possible if your system was installed with a **specific backup box/gateway configuration**. Standard grid-tied batteries shut down with the solar system during an outage. Ask your installer if backup capability is included.

---

## Part 8 — Troubleshooting Decision Trees

### Solar PV Not Generating

1. **Is it daytime?** → Night: normal (zero output expected)
2. **Check inverter screen/LEDs** — is there a red light or fault code?  
   → Record exact code; contact installer
3. **Check monitoring app** — status shows "Offline" or "Fault"?
4. **Check AC and DC isolators** — are both in the ON position?
5. **Reboot sequence (non-safety faults only):**  
   Turn AC OFF → Turn DC OFF → Wait 5 minutes → Turn DC ON → Turn AC ON
6. **If inverter completely dead with all isolators on** → call installer (possible supply fault)

---

### Heat Pump Not Heating

1. **Check system pressure** — is it between 1.0 and 2.0 bar?  
   Below 1.0 bar → call installer (do not re-pressurise a sealed system yourself)
2. **Check controller** — is it in Holiday Mode? Is the setpoint lower than current temperature?
3. **Check outdoor unit** — is the fan spinning? Is it iced over?  
   → Defrost cycle: wait ~10 minutes before diagnosing
4. **Fault code displayed?** → Note the exact code (e.g., Mitsubishi 'P' code) and call installer

---

### EV Charger Not Starting

1. **Cable check** — is the plug firmly seated in the car's socket?
2. **App lock** — is the charger locked in the app?
3. **Schedule** — is the car waiting for a night-rate timer to start?  
   → Check vehicle scheduling too (vehicle-side timer can override charger)
4. **Fault light** — red light usually indicates a grid voltage issue or earth fault → contact installer

---

*This guide reflects the Irish market and regulatory environment as of March 2026. Volatile elements — electricity import prices, CEG export rates, SEAI grant amounts, and ESB Networks processes — should be reviewed on a scheduled basis.*
