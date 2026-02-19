/**
 * Home Knowledge Library
 *
 * Factual, general guidance for new homeowners in Ireland.
 * Every entry must be:
 *   - Objectively true for virtually all new homes in Ireland
 *   - Non-specific (no development, unit, or product references)
 *   - Safe from a liability perspective
 *   - GDPR-compliant (no personal data, no speculation)
 *
 * Used as Tier 2 knowledge (General Best Practice) per the GLOBAL_SAFETY_CONTRACT.
 * Injected only when relevant to the question and when scheme-specific data is absent.
 */

export interface KnowledgeEntry {
  topics: string[];        // Keywords that trigger this entry
  content: string;         // The knowledge, ready to inject as context
}

export const HOME_KNOWLEDGE: KnowledgeEntry[] = [

  // -------------------------------------------------------------------------
  // MOVING IN / HANDOVER DAY
  // -------------------------------------------------------------------------
  {
    topics: ['move in', 'moving in', 'handover', 'keys', 'first day', 'moving day', 'took possession'],
    content: `MOVING IN — GENERAL GUIDANCE:
On handover day, take meter readings for electricity, gas (if applicable), and water immediately. Photograph each meter with a timestamp. Register these readings with your chosen utility supplier on the same day — this protects you from being billed for consumption that occurred before your possession.

Other essential first-day actions:
- Test every smoke alarm and carbon monoxide detector. New builds are fitted with these by regulation; verify they activate.
- Locate your main electrical consumer unit (fuse board), water stopcock (usually under the kitchen sink), and any gas isolation valve. You need to know where these are before an emergency.
- Check that all windows, doors, and locks operate correctly. Report any that do not to your developer immediately, while you are still within the handover process.
- Do not sign off on the handover without a completed snagging list if defects are present.`,
  },

  // -------------------------------------------------------------------------
  // METER READINGS
  // -------------------------------------------------------------------------
  {
    topics: ['meter reading', 'meter read', 'electricity meter', 'gas meter', 'water meter', 'kwh', 'units'],
    content: `METER READINGS — GENERAL GUIDANCE:
Take meter readings on the day you receive keys and submit them to your utility supplier immediately. This is the single most important step to avoid being billed for consumption before your possession date.

Electricity meters in Ireland are typically digital and display kilowatt-hours (kWh). Smart meters, now widely installed, allow remote reading. Gas meters display cubic metres (m³) or cubic feet. Irish Water manages water meters; register your reading with Irish Water directly.`,
  },

  // -------------------------------------------------------------------------
  // UTILITIES SETUP
  // -------------------------------------------------------------------------
  {
    topics: ['electricity', 'gas', 'broadband', 'internet', 'utilities', 'utility', 'suppliers', 'switch supplier', 'set up', 'esb', 'gas networks'],
    content: `UTILITIES — GENERAL GUIDANCE:
Electricity and gas are deregulated in Ireland. You are free to choose any licensed supplier. The Commission for Regulation of Utilities (CRU) maintains a list of all licensed suppliers. Comparison is available via bonkers.ie or switcher.ie — these are neutral, established Irish comparison services.

Electricity is supplied to the home via the national grid (ESB Networks owns the infrastructure). Your chosen supplier handles billing but the same physical network delivers power regardless of supplier.

Gas: Not all areas have mains gas. If your home has a gas connection, it is connected to the Gas Networks Ireland distribution network. Your gas supplier handles billing separately.

Broadband: Availability depends on your area. National Broadband Plan (NBP) infrastructure is being rolled out to areas previously without fibre. Check with broadband providers directly for availability at your address.

Electricity and gas accounts typically take 1–5 business days to set up. Broadband installations can take 1–4 weeks depending on infrastructure type (fibre to the premises vs. fibre to the cabinet). Plan ahead.`,
  },

  // -------------------------------------------------------------------------
  // HEAT PUMPS (AIR-TO-WATER)
  // -------------------------------------------------------------------------
  {
    topics: ['heat pump', 'heating', 'air to water', 'air-to-water', 'underfloor', 'floor heating', 'radiators', 'hot water', 'temperature', 'thermostat', 'heating system', 'weather compensation'],
    content: `HEAT PUMPS — GENERAL GUIDANCE:
Most new homes in Ireland built to current building regulations (Part L) are fitted with air-to-water heat pumps. These operate fundamentally differently from gas boilers.

Key principles to understand:
- Heat pumps are designed to run continuously at a low output, not to blast heat in short bursts. Turning the system off and back on repeatedly is inefficient and increases running costs.
- They deliver heat at lower flow temperatures (typically 35–45°C for underfloor heating, 45–55°C for radiators) compared to gas boilers (60–80°C). This means radiators will feel warm rather than hot — this is normal and correct.
- Underfloor heating (UFH) has significant thermal mass. It takes several hours to warm up or cool down. Plan accordingly and avoid large temperature setbacks overnight.
- Weather compensation, if fitted, automatically adjusts flow temperature based on outdoor temperature. This is the most efficient mode of operation.
- The hot water cylinder (buffer tank or domestic hot water cylinder) should be set to reach 60°C at least once per day. This is a legionella prevention measure and is important for health.
- Heat pumps are most efficient when the difference between outdoor temperature and required indoor temperature is small. They will use more electricity in very cold weather — this is expected.

Do not attempt to adjust refrigerant pressure, pipework connections, or internal components. Servicing requires a qualified F-Gas engineer.`,
  },

  // -------------------------------------------------------------------------
  // MVHR (MECHANICAL VENTILATION WITH HEAT RECOVERY)
  // -------------------------------------------------------------------------
  {
    topics: ['ventilation', 'mvhr', 'heat recovery', 'air quality', 'vents', 'air flow', 'fresh air', 'humidity', 'condensation'],
    content: `VENTILATION — GENERAL GUIDANCE:
Airtight, well-insulated new homes typically use Mechanical Ventilation with Heat Recovery (MVHR) to maintain air quality. The system continuously extracts stale air from wet rooms (kitchen, bathrooms, utility) and supplies fresh filtered air to living areas and bedrooms.

Key things to know:
- Never block or cover MVHR vents. Obstructing airflow reduces air quality and can cause condensation issues.
- Filters require cleaning or replacement typically every 6–12 months. Check the unit documentation for the correct schedule for your system.
- MVHR does not provide heating — it recovers heat from outgoing air and transfers it to incoming air. The heating system provides warmth; MVHR provides fresh air.
- If you notice condensation on windows or walls, check that vents are clear and the system is running. Persistent condensation should be reported to your developer if the system is new.
- Do not switch MVHR off. It is designed to run continuously at low speed.`,
  },

  // -------------------------------------------------------------------------
  // BER CERTIFICATE
  // -------------------------------------------------------------------------
  {
    topics: ['ber', 'energy rating', 'energy certificate', 'building energy', 'a1', 'a2', 'a3', 'b1', 'b2', 'energy efficiency'],
    content: `BER CERTIFICATE — GENERAL GUIDANCE:
A Building Energy Rating (BER) certificate is a legal requirement for all homes in Ireland. It rates the energy performance of the property on a scale from A1 (most efficient) to G (least efficient).

New homes built to current regulations must achieve at least an A2 rating. An A-rated home requires significantly less energy to heat and maintain comfort compared to older stock.

The BER is calculated based on the building fabric (insulation, windows, air permeability), heating system, ventilation, and renewable energy sources. It does not account for how the occupants use the home — actual energy bills will vary based on usage patterns.

Your BER certificate should be provided by your developer at handover. It is registered with the Sustainable Energy Authority of Ireland (SEAI) and is linked to your property's address. You can verify your BER on the SEAI national register using your property address.`,
  },

  // -------------------------------------------------------------------------
  // SNAGGING / DEFECTS
  // -------------------------------------------------------------------------
  {
    topics: ['snag', 'snagging', 'defect', 'defects', 'punch list', 'repair', 'fix', 'complaint', 'warranty claim', 'builder', 'developer warranty'],
    content: `SNAGGING AND DEFECTS — GENERAL GUIDANCE:
A snagging inspection identifies defects or incomplete work in a new home before or shortly after handover. It is strongly advisable to have a snagging inspection carried out by a qualified professional before you sign off on the handover.

Developer liability:
- Under Irish law, developers are typically responsible for rectifying defects reported within the defects liability period, which is commonly 12 months from handover (though this varies by contract — check your purchase contract).
- Structural defects are covered under a longer structural warranty, typically 10 years, provided by a structural warranty provider such as HomeBond or Premier Guarantee.

Common snagging items include:
- Paint finish imperfections, scuffs, or missed areas
- Door and window alignment, seals, and operation
- Tile grouting and alignment
- Plumbing fixture operation and seals
- Electrical outlets, switches, and lighting
- Skirting board and architrave gaps
- Drainage and external works

Report defects in writing (email) to your developer, with photographs and specific room/location references. Keep records of all correspondence.`,
  },

  // -------------------------------------------------------------------------
  // HOME WARRANTY (HOMEBOND / PREMIER GUARANTEE)
  // -------------------------------------------------------------------------
  {
    topics: ['homebond', 'premier guarantee', 'structural warranty', 'structural guarantee', 'latent defect', '10 year', 'home warranty'],
    content: `STRUCTURAL WARRANTY — GENERAL GUIDANCE:
Most new homes in Ireland are covered by a structural warranty from an approved provider. The most common are HomeBond and Premier Guarantee.

Standard coverage typically includes:
- Years 1–2: developer liability for defects (reported through the developer)
- Years 3–10: structural defects cover provided directly by the warranty scheme

Structural defects covered typically include subsidence, collapse or imminent danger of collapse, and water penetration caused by defects in the structure.

Structural warranties do NOT typically cover:
- Cosmetic defects
- Appliance failures
- Normal wear and tear
- Damage caused by the occupier

Your warranty certificate and policy documents should be provided by your developer at handover. Keep these in a safe place. If you cannot locate your warranty details, contact your developer or solicitor who handled the purchase.`,
  },

  // -------------------------------------------------------------------------
  // MANAGEMENT COMPANY / OMC
  // -------------------------------------------------------------------------
  {
    topics: ['management company', 'omc', 'owners management company', 'service charge', 'management fee', 'management agent', 'common areas', 'maintenance fee', 'block management'],
    content: `MANAGEMENT COMPANY — GENERAL GUIDANCE:
Apartment developments and many housing estates with shared facilities in Ireland are governed by an Owners' Management Company (OMC). All property owners are automatically members of the OMC.

Key things to know:
- The OMC is responsible for maintaining common areas (gardens, car parks, lifts, corridors, external fabric of apartment buildings, shared drainage, lighting, etc.)
- A service charge (management fee) is levied annually on all owners to fund maintenance, insurance, and a sinking fund for future major repairs.
- The OMC is a company registered with the Companies Registration Office (CRO). Owners have voting rights at AGMs (Annual General Meetings).
- The MUD Act 2011 (Multi-Unit Developments Act) governs OMCs in Ireland and sets out rights and obligations for owners.
- Service charges are legally enforceable. Failure to pay can affect your ability to sell the property.
- The management agent is a third-party company appointed by the OMC to handle day-to-day operations. The management agent is not the same as the OMC — you, as an owner, are a member of the OMC.

Contact details for your management company should be provided at handover.`,
  },

  // -------------------------------------------------------------------------
  // HOME SECURITY
  // -------------------------------------------------------------------------
  {
    topics: ['security', 'alarm', 'locks', 'locksmith', 'keys', 'burglary', 'safe', 'cctv', 'cameras'],
    content: `HOME SECURITY — GENERAL GUIDANCE:
After taking possession, consider changing or re-keying external door locks. During construction, multiple contractors may have had access to the property. This is a sensible precaution and does not indicate any fault by the developer.

Smoke alarms and carbon monoxide detectors are fitted to all new homes by regulation. Test them monthly using the test button. Replace batteries according to the manufacturer's schedule (typically annually for battery-operated units). Sealed, long-life battery alarms last up to 10 years.

If your home has a monitored alarm system, ensure you register with the monitoring company and receive your unique reference codes. Do not share alarm codes widely.

Contents insurance is your responsibility from the date you take possession. The developer's building insurance covers the structure; it does not cover your belongings, fixtures you add, or accidental damage within the home.`,
  },

  // -------------------------------------------------------------------------
  // CONDENSATION AND DAMP
  // -------------------------------------------------------------------------
  {
    topics: ['condensation', 'damp', 'mould', 'mold', 'moisture', 'humidity', 'wet walls', 'steam', 'dripping windows'],
    content: `CONDENSATION — GENERAL GUIDANCE:
Some surface condensation on windows during the first winter is normal in new homes as the building fabric (concrete, plasterwork) dries out over 12–18 months. This is called "construction moisture" and will reduce over time.

To minimise condensation:
- Maintain a consistent indoor temperature — avoid large temperature fluctuations
- Use extractor fans in kitchens and bathrooms during and after cooking/showering
- Ensure MVHR vents are clear and the system is running
- Open windows briefly to ventilate if safe and weather permits

Condensation becomes a concern if it is persistent, occurs on walls (not just windows), or if mould develops. If mould appears, document it with photographs and report it to your developer if the property is new, as it may indicate a ventilation or construction defect.

Never seal or cover trickle vents in windows — they are there to allow controlled background ventilation.`,
  },

  // -------------------------------------------------------------------------
  // WATER / PLUMBING
  // -------------------------------------------------------------------------
  {
    topics: ['water', 'stopcock', 'leak', 'plumbing', 'tap', 'drain', 'pressure', 'boiler', 'cylinder', 'hot water cylinder', 'immersion'],
    content: `WATER AND PLUMBING — GENERAL GUIDANCE:
Locate your main water stopcock on or shortly after moving in. In most new homes it is located under the kitchen sink or in a ground-floor utility area. Turning this off immediately stops water flow in the event of a burst pipe.

Most new homes have a pressurised hot water system with a cylinder. The cylinder should reach 60°C at least once per day (legionella prevention). This is typically managed automatically by the heating system controls — check your heating system documentation.

If you have low water pressure, contact Irish Water. Water pressure is Irish Water's responsibility up to the boundary of your property. Internal pressure issues should be investigated by a registered plumber.

Drain cleaning products should be used sparingly. Many new drainage installations use modern fittings that can be damaged by harsh chemicals. A drain plunger is sufficient for most minor blockages.`,
  },

  // -------------------------------------------------------------------------
  // WASTE AND RECYCLING
  // -------------------------------------------------------------------------
  {
    topics: ['bin', 'bins', 'waste', 'recycling', 'rubbish', 'refuse', 'collection', 'green bin', 'brown bin', 'blue bin', 'compost'],
    content: `WASTE AND RECYCLING — GENERAL GUIDANCE:
Household waste collection in Ireland is provided by private operators. You will need to register with a licensed waste collector. Waste collection is not provided free of charge in Ireland — it is a pay-as-you-go or subscription service.

Standard bin types in Ireland:
- Black/grey bin: general (residual) waste, not suitable for recycling or organic material
- Green bin: mixed dry recyclables (paper, cardboard, plastics marked 1–7, tins, cans)
- Brown bin: food and garden organic waste (composting)

Not all areas have all three bins. Your management company or local authority can advise on what collections are available in your development.

Recycling centres (bring banks) are operated by your local authority and accept glass, batteries, clothing, and items not collected at kerbside.

Large, bulky items such as furniture or mattresses require a separate bulky waste collection — contact your waste collector or local authority for this service.`,
  },

  // -------------------------------------------------------------------------
  // POSTAL / ADDRESS REGISTRATION
  // -------------------------------------------------------------------------
  {
    topics: ['post', 'postal', 'address', 'eircode', 'register', 'redirect', 'mail', 'an post', 'delivery'],
    content: `ADDRESS AND POST — GENERAL GUIDANCE:
Every property in Ireland has a unique Eircode (a 7-character postcode). Your Eircode is tied to your specific address. You can look up or verify your Eircode at eircode.ie using your full address.

Update your address with:
- Banks and financial institutions
- Revenue (via MyAccount on revenue.ie)
- DVLA/NDLS for your driving licence (required within 12 months of moving)
- Your GP and medical providers
- Electoral register — register to vote at your new address at checktheregister.ie

An Post offers a mail redirection service from your previous address. Redirections are temporary (1, 3, or 6 months) and are a useful bridge while you update all your records.`,
  },

  // -------------------------------------------------------------------------
  // APPLIANCES AND WARRANTIES
  // -------------------------------------------------------------------------
  {
    topics: ['appliance', 'warranty', 'register', 'washing machine', 'dishwasher', 'oven', 'fridge', 'freezer', 'dryer', 'guarantee', 'manufacturer'],
    content: `APPLIANCES — GENERAL GUIDANCE:
If appliances are included with your home, register them with the manufacturer as soon as possible. Registration typically extends or activates the manufacturer's warranty and ensures you receive safety recall notifications.

Under Irish and EU consumer law, goods must be as described and fit for purpose. New appliances are entitled to a minimum 2-year statutory guarantee from the seller. Manufacturer warranties are separate to and in addition to this statutory right.

Keep appliance documentation (manuals, warranty cards, model numbers, serial numbers) in one place. You will need model and serial numbers to arrange service or warranty claims.

Appliance faults are the responsibility of the manufacturer or retailer, not the property developer. The developer's structural warranty does not cover appliances.`,
  },

  // -------------------------------------------------------------------------
  // PROPERTY TAX (LPT)
  // -------------------------------------------------------------------------
  {
    topics: ['property tax', 'lpt', 'local property tax', 'revenue', 'tax', 'council charge'],
    content: `LOCAL PROPERTY TAX — GENERAL GUIDANCE:
Local Property Tax (LPT) is an annual self-assessed tax payable by owners of residential properties in Ireland. It is collected by Revenue.

Key facts:
- LPT is payable from the date you become the owner of the property.
- New homes that received planning permission after 1 January 2013 may qualify for an LPT exemption for a period of years. This exemption is not automatic — you must claim it via Revenue's LPT portal (revenue.ie/lpt).
- LPT is based on the market value of your property assessed at 1 November 2021, or as at the date of first occupation for properties built after that date.
- Payment options include single annual payment, phased deduction from salary, or direct debit spread over the year.

Check your LPT obligations on revenue.ie promptly after taking possession. Revenue will issue correspondence to your new address.`,
  },

];

/**
 * Returns relevant knowledge entries for a given homeowner message.
 * Matches by topic keywords. Returns up to 3 most relevant entries to avoid
 * overwhelming the context window.
 */
export function getRelevantHomeKnowledge(message: string): KnowledgeEntry[] {
  const lower = message.toLowerCase();

  const scored = HOME_KNOWLEDGE.map(entry => {
    const matches = entry.topics.filter(topic => lower.includes(topic));
    return { entry, score: matches.length };
  }).filter(({ score }) => score > 0);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(({ entry }) => entry);
}

/**
 * Formats knowledge entries into a context block for injection into the system message.
 * Tagged clearly as general guidance so the model uses it as Tier 2, not Tier 1.
 */
export function formatHomeKnowledgeContext(entries: KnowledgeEntry[]): string {
  if (entries.length === 0) return '';

  const blocks = entries.map(e => e.content).join('\n\n');
  return `GENERAL HOME GUIDANCE (Tier 2 — applies to most new homes in Ireland; not specific to this development):\n${blocks}`;
}
