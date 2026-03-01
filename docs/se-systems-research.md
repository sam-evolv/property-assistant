# SE Systems Ireland — Complete Research Brief

> **Last updated:** February 2026  
> **Purpose:** AI knowledge base source document for OpenHouse Care — SE Systems installer portal  
> **Critical finding:** SE Systems uses **Huawei** inverters and batteries exclusively — not SolarEdge or Fronius.

---

## 1. Company Profile

### Overview

**SE Systems** (Sustainable Energy Systems) is Ireland's largest deep retrofit energy upgrade provider. Founded in Cork in 2010, they operate nationwide including offshore islands and have delivered over €900 million in energy grants, retrofitting 14,000+ homes and 2,000+ commercial and community buildings.

- **Legal entity:** Munster External Wall Insulation Limited T/A SE Systems  
- **Company No.:** 487938  
- **VAT No.:** 9756979C  
- **Headquarters:** Unit 6, Kilbarry Business Park, Dublin Hill, Cork  
- **Regional office:** Dublin  
- **Phone:** 021 439 7938  
- **Email:** info@sesystems.ie  
- **Website:** sesystems.ie  

### Founding & Growth

Founded by **John O'Leary** (CEO) and **Youenn Lowry** (Managing Director), originally as an external wall insulation contractor. Key milestones:

| Year | Milestone |
|------|-----------|
| 2010 | Founded in Cork |
| 2011 | SEAI Better Energy Homes registered |
| 2012 | SEAI Communities Energy Grant programme |
| 2014 | Fully Funded Home Energy Upgrade Scheme partner |
| 2026 | ~100 direct employees, 50 sole traders, 250 subcontractors |

### Leadership Team

| Name | Role |
|------|------|
| John O'Leary | Co-founder, Owner & CEO |
| Youenn Lowry | Co-founder & Managing Director |
| Jason Collins | Technical Director |
| Caitríona Courtney | Community Solutions Manager |
| John Brosnan | Quality Manager (BSc Hons Renewable Energy & Energy Management) |
| Jake | Commercial Director (First Class Honours, Electrical Engineering) |
| Gillian | Finance Director (FCCA) |
| Derrick | Operations Director (35+ years construction experience, since 2021) |

### Scale & Track Record

| Metric | Figure |
|--------|--------|
| Completed projects | €500M+ |
| Grants delivered | €900M+ |
| Homes retrofitted | 14,000+ |
| Commercial/community buildings | 2,000+ |
| Energy saved | 1.7 billion kWh |
| CO₂ avoided | 358,000 tonnes |
| Staff (direct) | ~100 employees |
| Subcontractors | ~300 |

### Certifications & Accreditations

- SEAI Registered Contractor (Better Energy Homes, Fully Funded, Communities)
- ISO 9001 (Quality Management System)
- ISO 14001 (Environmental Management System)
- Safe Electric certified
- A-rated Safe-T-Cert (construction industry safety)
- Cork Chamber of Commerce member
- ProCore cloud-based project management platform
- SEAI-recognised as Ireland's leading grant coordinator for C&I projects

### Awards & Recognition

- **Cork Company of the Year Awards 2026** — Finalist, Large Company category (Cork Chamber/KPMG)
- **SEAI Energy Awards 2025** — Shortlisted for Lion House deep energy upgrade, Douglas, Cork
- **Green Collaboration Award 2026** — Shortlisted alongside Douglas & District Lions Club

---

## 2. Technology Stack

> ⚠️ **Critical for customer support:** SE Systems uses **Huawei** inverters and batteries exclusively. Any troubleshooting guidance must reference **Huawei FusionSolar** and **SUN2000 series** inverters — not SolarEdge.

### Solar Panels

| Division | Brand | Technology |
|----------|-------|-----------|
| Solar PV (standalone domestic/commercial) | **Astronergy** | N-type TOPCon (Hot 2.0) |
| Retrofit division (deep retrofit) | **Trina Solar** | Various |

**Astronergy key facts:**
- Tier 1 Bloomberg BNEF rated, owned by CHINT Group
- "Top Performer" Kiwa PVEL (8 times)
- **30-year power performance guarantee** (≤0.4% annual degradation, 87.6% retained at year 30)
- 12–15 year product warranty (model dependent)
- Confirmed: 42 × Astronergy 445W panels on Beaumont Boys School (18.69 kWp)

**Trina Solar key facts:**
- Tier 1 Bloomberg BNEF rated
- 15-year product warranty, 25-year performance (typically ≥80% at year 25)

### Inverters — Huawei SUN2000 Series

SE Systems exclusively uses **Huawei SUN2000** inverters. Key characteristics:
- Built-in Wi-Fi for monitoring and smart management
- Integrated DC and AC surge protection
- Dual MPPTs
- Wide DC operating voltage range (120–600V)
- Natural convection cooling (fanless, silent)
- 97%+ conversion efficiency
- **Standard 10-year warranty**, extendable to 15 or 20 years

Likely residential models:
- **SUN2000-3/3.68/4/4.6/5/6KTL-L1** — single-phase, 3–6 kW (domestic)
- **SUN2000-8/10K-LC0** — larger residential
- **SUN2000-12/15/17/20/25K-MB0** — three-phase (commercial, schools)

### Battery Storage — Huawei LUNA2000

| Spec | Detail |
|------|--------|
| Chemistry | Lithium Iron Phosphate (LiFePO4) |
| Architecture | Stackable modules (Power Control Module + battery modules) |
| Capacity per module | 5 kWh (S0 series) or 6.9 kWh (S1 series) |
| Range | 5–21 kWh |
| Safety | 4-layer protection, VDE AR-E 2510-50 certified |
| Operating temperature | −20°C to +55°C |
| Noise | <29 dB(A) at 1 metre |
| Warranty | 10 years (≥60% capacity retention) |
| Typical install cost | €3,000–€5,000 additional to system |

Confirmed case study: 5.94 kW solar + 10 kWh LUNA2000 battery installation.

### Monitoring — Huawei FusionSolar

SE Systems customers use two layers of monitoring:
1. **OpenSolar** — system design, proposals, customer-facing monitoring app
2. **Huawei FusionSolar** — underlying real-time monitoring platform

FusionSolar features:
- Real-time power output
- Energy generation, consumption, storage status
- Environmental impact tracking
- Remote system management
- Multiple working modes: Time-of-Use (TOU), maximum self-consumption
- Available as web portal and mobile app

### EV Charging — MyEnergi Zappi

| Spec | Detail |
|------|--------|
| Brand | MyEnergi |
| Model | Zappi |
| Single-phase | 7.4 kW |
| Three-phase | 22 kW |
| Charging modes | Eco, Eco+, Fast |
| Solar integration | Yes — auto-prioritises solar surplus |
| Control | MyEnergi app |
| Warranty | 3 years |

The Zappi "works with your solar panels, the grid, or both" and automatically selects the most cost-effective energy source.

### Heat Pumps — Mitsubishi Electric

**Only confirmed brand:** Mitsubishi Electric (logo displayed on residential retrofits page).

SE Systems installs heat pumps as part of **deep retrofit packages**, not as standalone retail products.

Relevant Mitsubishi Electric lines:
- **Ecodan** — air-to-water, 5–14 kW residential
- **Lossnay** — MVHR ventilation (may also be used for SE Systems ventilation installs)

Heat pump types installed:
- **Air-to-water** — primary residential offering (replaces oil/gas boilers)
- **Air-to-air** — confirmed in commercial/community projects (North Cathedral Cork, Douglas Lions Club)

**Note:** Due to SE Systems' subcontractor network, specific heat pump models may vary by project.

### Insulation — Baumit

External wall insulation (EWI) is SE Systems' original speciality. **Baumit** is the confirmed EWI brand partner.

Services include:
- External wall insulation (EWI) — Baumit systems
- Cavity wall insulation
- Internal wall insulation (dry lining)
- Attic insulation
- Window and door replacement
- Airtightness measures

---

## 3. Typical System Sizes

| Application | System Size | Notes |
|-------------|-------------|-------|
| Standard domestic | ~3 kWp | ~7–8 panels, ~2,600 kWh/year |
| Popular mid-range | 4–5 kWp | Most common for Irish homes |
| Larger residential | 5.94 kWp | Confirmed case study with 10 kWh battery |
| Schools | Up to 18.69 kWp | 42 Astronergy 445W panels (Beaumont Boys School) |
| Commercial | Up to 1,000 kWp | SEAI Non-Domestic Microgen Grant eligible |

---

## 4. Warranties (SE Systems Product Stack)

| Product | Brand | Product Warranty | Performance/Extended |
|---------|-------|-----------------|----------------------|
| Solar panels (solar division) | Astronergy | 12–15 years | 30-year performance (≥87.6% at year 30) |
| Solar panels (retrofit) | Trina Solar | 15 years | 25-year performance (≥80% at year 25) |
| Inverter | Huawei SUN2000 | **10 years** | Extendable to 15 or 20 years |
| Battery | Huawei LUNA2000 | **10 years** (≥60% capacity) | — |
| EV charger | MyEnergi Zappi | **3 years** | — |
| Heat pump | Mitsubishi Electric | **5 years** (parts), 7 years (compressor, some models) | Extended options available |
| Workmanship | SE Systems | Not published | Backed by SEAI registration + ISO 9001 |

> Customers should request specific warranty documentation during handover. All installations are backed by SE Systems' SEAI registration, ISO 9001, and Safe Electric certification.

---

## 5. SEAI Grants (Updated February 2026)

Ireland allocated a record **€558 million** to SEAI for residential retrofits in Budget 2026. Major grant increases from **3 February 2026**.

### Solar PV Grant

**Up to €1,800** (maintained at 2025 levels):

| System Size | Grant Rate | Grant Value |
|-------------|-----------|-------------|
| First 2 kWp | €700/kWp | €1,400 |
| 2–4 kWp (additional) | €200/kWp | Up to €400 |
| **Maximum** | — | **€1,800** |

Example: 3.52 kWp = (2 × €700) + (1.52 × €200) = **€1,704**

- Home must be built and occupied before 31 December 2020
- SEAI-registered installer required
- Safe Electric registered electrician required
- **0% VAT** on supply and installation of residential solar panels
- No separate battery storage grant

### Heat Pump Grant (from 3 February 2026)

| Component | Grant |
|-----------|-------|
| Heat pump unit (house) | €6,500 |
| Heat pump unit (apartment) | €4,500 |
| Air-to-air heat pump (all) | €3,500 |
| Central heating upgrades (radiators/pipework) | €2,000 |
| **Renewable Heat Bonus** (replacing fossil fuel/electric storage heating) | **€4,000** |
| Technical Assessment (pre-2007 homes) | €200 |

**Maximum house bundle: €6,500 + €2,000 + €4,000 = €12,500**

- Heat Loss Indicator (HLI) must be ≤ 2.3 W/(K·m²)
- VAT on heat pumps reduced from 23% to 9% (January 2025)

### EV Charger Grant

**€300** (reduced from €600 on 1 January 2024)
- Smart charger on SEAI Triple E Register
- Safe Electric registered electrician
- Private home with off-street parking
- EV ownership not required

### Insulation Grants (from 3 February 2026)

| Measure | Apartment | Mid-terrace | Semi-D / End-terrace | Detached |
|---------|-----------|-------------|----------------------|----------|
| Attic insulation | €1,100 | €1,400 | €1,500 | **€2,000** |
| Cavity wall | €700 | €850 | €1,300 | **€1,800** |
| Internal wall (dry lining) | €1,500 | €2,000 | €3,500 | **€4,500** |
| External wall | €3,000 | €3,500 | €6,000 | **€8,000** |

New from **2 March 2026:** Window grants (up to €4,000 detached), external door grants (**€800/door**, max 2).

### Other Grants

| Grant | Amount |
|-------|--------|
| Heating controls upgrade | €700 |
| Solar water heating (thermal) | €1,200 |
| BER assessment | €50 |

### Maximum Combined Grants (Detached House)

| Measure | Grant |
|---------|-------|
| Attic insulation | €2,000 |
| External wall insulation | €8,000 |
| Heat pump bundle | €12,500 |
| Solar PV | €1,800 |
| Windows | €4,000 |
| Doors (×2) | €1,600 |
| Heating controls | €700 |
| BER assessment | €50 |
| **Total potential** | **~€30,650** |

### Grant Application Process

**Through SE Systems as One Stop Shop (recommended):**
SE Systems handles everything — assessment, energy report, grant application, project management, contractor oversight, works, and final BER. The grant is **deducted from the cost upfront** — homeowner pays only the balance.

**Self-managed (Better Energy Homes):**
1. Get quotes from SEAI-registered contractors
2. Apply online at seai.ie (need MPRN, contractor ID, system details)
3. Receive grant approval (typically minutes by email)
4. Accept offer within 30 days
5. Complete works within 8 months
6. Post-works BER assessment
7. Submit Declaration of Works + Request for Payment
8. Receive grant via EFT within 2–6 weeks

> ⚠️ **Critical rule:** Work must NOT start before grant approval. Any works or purchases before approval date make the application ineligible.

---

## 6. Clean Export Guarantee (Feed-in Tariff) Rates

| Supplier | Rate (c/kWh) |
|----------|-------------|
| **SSE Airtricity (Premium)** | **32.0c** |
| Pinergy | 25.0c |
| Community Power | 20.0c |
| Electric Ireland | 19.5c |
| SSE Airtricity (Standard) | 19.5c |
| Bord Gáis Energy | 18.5c |
| Energia | 18.5c |
| Flogas | 18.5c |
| Prepay Power | 15.89c |

- First **€400/year** of CEG income is tax-free
- Requires smart meter; credited on electricity bills (typically quarterly)
- Self-consumption savings (~35c/kWh) outweigh export earnings — prioritise self-consumption

---

## 7. SE Systems 7-Step Installation Process

1. **Contact** — Form or call; team responds within 24 hours to schedule site survey
2. **Site survey** — Roof orientation, angle, size, structural condition, shading analysis, electrical infrastructure, scaffold/access requirements
3. **Design & quote** — Detailed system design using **OpenSolar** software; clear no-obligation quote
4. **SEAI grant application** — SE Systems applies on customer's behalf; approval typically within minutes. **Work cannot start until approval received.**
5. **ESB NC6 form** — SE Systems submits NC6 (Notification of Electrical Installation) to ESB Networks; ESB has 20 working days to process. No charge. Triggers smart meter installation (ESB aims for 4 months).
6. **Installation** — In-house team; typically 1–2 days for residential. Includes mounting brackets, panels, inverter, wiring, AC isolator, battery (if applicable), and full safety checks. Full handover with system walkthrough.
7. **Post-installation** — BER assessment, grant paperwork, monitoring app setup (OpenSolar/FusionSolar), ongoing support.

### Documents Provided at Handover

- Safe Electric certificate
- Product warranties (panels, inverter, battery)
- System manual
- Monitoring app login (OpenSolar / Huawei FusionSolar)
- NC6 form confirmation
- Pre- and post-works BER certificates
- SEAI grant paperwork

### Planning Permission

Not required for most residential rooftop installations (since October 2022 regulations). Full roof coverage permitted. **Exceptions:** protected structures, Architectural Conservation Areas, Solar Safeguarding Zones (within 5 km of airports). Ground-mounted panels exempt up to 25 m².

---

## 8. Energy Performance in Ireland

### Annual Generation Estimates (Irish Average)

Ireland: ~3.5 peak sun hours/day → **850–1,100 kWh per kWp annually**.  
Cork performance: approximately **2.6% above** national average (~884 kWh/kWp).

| System Size | Annual Generation | Covers % of avg household (4,200 kWh/year) |
|-------------|------------------|----------------------------------------------|
| 3 kWp | 2,550–3,300 kWh | ~60–80% |
| 4 kWp | 3,400–4,400 kWh | ~80–105% |
| 5 kWp | 4,250–5,500 kWh | ~100–130% |
| 6 kWp | 5,100–6,600 kWh | ~120–155% |

Seasonal variation: Up to 75% of annual generation occurs May–September. South-facing at 30–40° tilt is optimal; east/west splits reduce output by ~10–15%.

### Financial Returns

Current average electricity price: **~36c/kWh** (February 2026 — Ireland has 3rd highest electricity prices in EU).

Without battery: self-consumption 30–50%. With battery: 60–80%.

| System | Annual Generation | Annual Benefit | Payback Period |
|--------|------------------|----------------|---------------|
| 3 kWp | ~2,700 kWh | ~€740 | 5–7 years |
| 4 kWp | ~3,600 kWh | ~€990 | 5–7 years |
| 5 kWp | ~4,500 kWh | ~€1,240 | 5–7 years |
| 6 kWp | ~5,400 kWh | ~€1,485 | 5–7 years |

Over a 25-year panel lifespan: a 4 kWp system delivers **€24,000+ in total value**.  
Solar increases property value by an estimated **4–6%**.

---

## 9. Maintenance Guide

### Solar Panels

- Clean every **6–12 months** (rain helps but can't remove bird droppings or lichen — can reduce efficiency 5–25%)
- Use garden hose, soft telescopic brush, plain water or biodegradable soap
- **Never use pressure washers, abrasive tools, or harsh chemicals**
- Coastal properties: more frequent cleaning (salt spray)
- Clean in early morning or late evening (panels cool)

### System Monitoring

- Check FusionSolar app weekly
- Sudden drop of 15%+ on an equivalent weather day → check for soiling, new shading, or fault
- Professional inspection every 1–2 years
- Full professional servicing every 3–5 years

### Panel Degradation

- ~0.3–0.5% per year (modern Tier 1 panels)
- Retain 89–93% capacity after 25 years
- Viable for 30–40+ years at reduced efficiency
- Budget ~€800–€1,500 for inverter replacement during panel lifespan

### When to Call SE Systems

- Significant unexplained production drops
- Inverter error codes or warning lights
- Visible physical damage
- Signs of water ingress
- Loose mounting hardware
- Electrical buzzing
- After severe weather events

---

## 10. Competitors & Market Position

### SE Systems' Competitive Differentiation

SE Systems competes in a fundamentally different segment: **deep retrofit** — the combination of insulation, heat pumps, ventilation, and solar PV delivered as a managed One Stop Shop. Their competitive moat:

- €900M+ grant delivery track record
- Relationships with every local authority in Ireland
- Community fund project scale (barriers competitors can't easily replicate)
- SEAI recognition as Ireland's leading C&I grant coordinator
- ISO 9001/14001, Safe-T-Cert, Safe Electric

### Key Competitors

| Company | Base | Focus | Trustpilot |
|---------|------|-------|-----------|
| Activ8 Solar Energies | Monaghan | Solar-focused, 14,000+ installations | 4.8/5 (2,000+ reviews) |
| PV Generation | Cork | Direct local competitor | 4.8/5 (~800 reviews) |
| Enerpower | Waterford | Commercial/industrial, widest technology range | — |
| Pinergy | Wexford | Electricity supply + solar | — |
| Ecoplex Energy | Dublin | "Best Solar Specialist 2025" | — |

**SE Systems' review gap:** No Trustpilot profile found; limited public consumer reviews. Likely reflects business model (most customers through government-funded schemes rather than direct retail). This is the most significant reputation gap vs. competitors.

---

## 11. Sectors Served

SE Systems operates across **10 sectors:**

1. Residential
2. Commercial
3. Community
4. Public Sector
5. Agriculture
6. Education
7. Sports & Leisure
8. Healthcare
9. Retail
10. Transport

**Major commercial clients:** Tesco, Applegreen, Kerry Group, BWG Foods, MSD  
**Transport:** Partners with Ireland's largest public transport providers for EV charging infrastructure

---

## Key Takeaways for AI Knowledge Base

1. **Huawei-centric tech stack** — Huawei SUN2000 inverters, Huawei LUNA2000 batteries, Huawei FusionSolar monitoring. Astronergy panels for standalone solar; Trina Solar for retrofit. Any troubleshooting must reference Huawei, not SolarEdge.

2. **Feb 2026 SEAI grant increases are transformative** — heat pump bundle at €12,500, combined grants up to €30,650 for a detached house. SE Systems' One Stop Shop deducts grants upfront.

3. **SE Systems = retrofit project management company, not a solar installer** — competitive strength is multi-measure whole-home upgrades at scale through government programmes, not individual solar sales. Frame value around comprehensive energy transformation and grant expertise.
