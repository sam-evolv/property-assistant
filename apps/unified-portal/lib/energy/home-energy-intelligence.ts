type JsonObject = Record<string, unknown>;

export interface EnergyDriver {
  key: string;
  label: string;
  value: string;
  why_it_matters: string;
  severity: 'info' | 'watch' | 'action';
}

export interface EnergyNextAction {
  key: string;
  label: string;
  reason: string;
  impact: 'money' | 'comfort' | 'risk';
}

export interface EnergyIntelligence {
  source: string;
  month: string | null;
  home_label: string | null;
  installed_systems: string[];
  headline: string | null;
  summary: string;
  facts: {
    grid_import_kwh: number | null;
    heat_pump_cop: number | null;
    heat_pump_design_spf: number | null;
    heat_pump_excess_kwh: number | null;
    heat_pump_excess_pct: number | null;
    solar_generated_kwh: number | null;
    solar_exported_kwh: number | null;
    solar_self_consumed_kwh: number | null;
    solar_self_consumption_pct: number | null;
    ev_total_kwh: number | null;
    ev_day_rate_kwh: number | null;
    ev_night_rate_kwh: number | null;
    ev_day_rate_pct: number | null;
    night_kwh: number | null;
    day_kwh: number | null;
    peak_kwh: number | null;
    peak_day_share_pct: number | null;
  };
  patterns: string[];
  drivers: EnergyDriver[];
  money: string[];
  comfort: string[];
  risk: string[];
  next_actions: EnergyNextAction[];
  answer_guidance: string[];
}

function obj(v: unknown): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as JsonObject : {};
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function pct(part: number | null, whole: number | null): number | null {
  if (part == null || whole == null || whole <= 0) return null;
  return round((part / whole) * 100);
}

function kwh(n: number | null): string | null {
  return n == null ? null : `${round(n).toLocaleString('en-IE')} kWh`;
}

function percent(n: number | null): string | null {
  return n == null ? null : `${round(n)} percent`;
}

function pushUnique(list: string[], value: string | null | undefined) {
  if (value && !list.includes(value)) list.push(value);
}

export function isHomeEnergyQuestion(message: string): boolean {
  const m = message.toLowerCase();
  const mentionsSystem = /\b(electricity|energy|usage|use|bill|cost|grid|kwh|solar|panel|panels|pv|heat\s*pump|ev|charger|export|generation|cop|meter|readings?|tariff|day\s*rate|night\s*rate|peak|comfort|heating|hot\s*water|battery|mvhr)\b/i.test(m);
  const asksForReasonOrInsight = /\b(why|high|higher|tell|analyse|analyze|analysis|pattern|patterns|usage|using|bill|cost|expensive|can you tell|what.*driving|what.*causing|how.*performing|how.*doing|do i have|have i got|how much|reduce|save|optimise|optimize|improve)\b/i.test(m);
  return mentionsSystem && asksForReasonOrInsight;
}

export function buildEnergyIntelligence(demoHome: unknown): EnergyIntelligence | null {
  const root = obj(demoHome);
  if (Object.keys(root).length === 0) return null;

  const home = obj(root.home);
  const energy = obj(root.energy);
  const devices = obj(root.devices);
  const detail = obj(energy.showcase_month_detail);
  if (Object.keys(energy).length === 0 && Object.keys(devices).length === 0) return null;

  const heatPump = obj(detail.heat_pump);
  const hpDevice = obj(devices.heat_pump);
  const solar = obj(detail.solar);
  const solarDevice = obj(devices.solar);
  const ev = obj(detail.ev);
  const evDevice = obj(devices.ev_charger);
  const mvhrDevice = obj(devices.mvhr);
  const bands = obj(detail.grid_import_bands);

  const gridImport = num(detail.grid_import_kwh);
  const cop = num(heatPump.cop);
  const designSpf = num(heatPump.design_spf) ?? num(hpDevice.design_spf);
  const hpExcess = num(heatPump.excess_kwh);
  const hpExcessPct = num(heatPump.excess_pct);
  const solarGenerated = num(solar.generated_kwh);
  const solarExported = num(solar.exported_kwh);
  const solarSelfConsumed = solarGenerated != null && solarExported != null
    ? Math.max(0, solarGenerated - solarExported)
    : null;
  const solarSelfConsumptionPct = pct(solarSelfConsumed, solarGenerated);
  const evTotal = num(ev.total_kwh);
  const evDay = num(ev.day_rate_kwh);
  const evNight = num(ev.night_rate_kwh);
  const evDayPct = pct(evDay, evTotal ?? ((evDay ?? 0) + (evNight ?? 0)));
  const night = num(bands.night_kwh);
  const day = num(bands.day_kwh);
  const peak = num(bands.peak_kwh);
  const peakDayShare = pct((day ?? 0) + (peak ?? 0), gridImport);

  const installedSystems: string[] = [];
  if (Object.keys(hpDevice).length > 0 || Object.keys(heatPump).length > 0) {
    pushUnique(installedSystems, `Heat pump${[str(hpDevice.make), str(hpDevice.model)].filter(Boolean).length ? ` (${[str(hpDevice.make), str(hpDevice.model)].filter(Boolean).join(' ')})` : ''}`);
  }
  if (Object.keys(solarDevice).length > 0 || Object.keys(solar).length > 0) {
    const arrayKwp = num(solarDevice.array_kwp);
    pushUnique(installedSystems, `Solar PV${arrayKwp ? ` (${arrayKwp.toFixed(1)} kWp)` : ''}`);
  }
  if (Object.keys(evDevice).length > 0 || Object.keys(ev).length > 0) {
    pushUnique(installedSystems, `EV charger${[str(evDevice.make), str(evDevice.model)].filter(Boolean).length ? ` (${[str(evDevice.make), str(evDevice.model)].filter(Boolean).join(' ')})` : ''}`);
  }
  if (Object.keys(mvhrDevice).length > 0) {
    pushUnique(installedSystems, `MVHR${str(mvhrDevice.status) ? ` (${str(mvhrDevice.status)})` : ''}`);
  }

  const drivers: EnergyDriver[] = [];
  const patterns: string[] = [];
  const money: string[] = [];
  const comfort: string[] = [];
  const risk: string[] = [];
  const nextActions: EnergyNextAction[] = [];

  if (cop != null && designSpf != null) {
    const gap = round(designSpf - cop, 1);
    if (gap > 0.2) {
      drivers.push({
        key: 'heat_pump_efficiency_gap',
        label: 'Heat pump efficiency gap',
        value: `${cop.toFixed(1)} COP vs ${designSpf.toFixed(1)} design SPF`,
        why_it_matters: hpExcess != null
          ? `This is adding about ${kwh(hpExcess)} of electricity demand this month.`
          : 'Lower heat-pump efficiency means more grid electricity for the same comfort.',
        severity: gap >= 0.7 ? 'action' : 'watch',
      });
      pushUnique(patterns, `Heat pump performance is below design: ${cop.toFixed(1)} COP against ${designSpf.toFixed(1)} expected SPF.`);
      pushUnique(money, hpExcess != null ? `Heat-pump underperformance is the clearest bill driver, adding roughly ${kwh(hpExcess)}${hpExcessPct != null ? `, about ${percent(hpExcessPct)} extra` : ''}.` : 'Heat-pump underperformance is likely increasing grid import.');
      pushUnique(comfort, 'If the flow temperature or schedule is wrong, the house can use more power while still feeling less consistent.');
      pushUnique(risk, 'A sustained COP gap can point to settings, commissioning, airflow, hot-water timing, or a maintenance issue.');
      nextActions.push({
        key: 'check_heat_pump_settings',
        label: 'Check heat pump schedule, flow temperature and hot-water timing',
        reason: 'This is the largest controllable driver in the current model.',
        impact: 'money',
      });
    }
  }

  if (solarGenerated != null) {
    const exportText = solarExported != null ? `, with ${kwh(solarExported)} exported` : '';
    const selfText = solarSelfConsumptionPct != null ? `Self-consumption is about ${percent(solarSelfConsumptionPct)}.` : null;
    pushUnique(patterns, `Solar generated ${kwh(solarGenerated)}${exportText}.${selfText ? ` ${selfText}` : ''}`);
    if (solarExported != null && solarGenerated > 0 && solarExported / solarGenerated > 0.25) {
      drivers.push({
        key: 'solar_export_leakage',
        label: 'Solar export leakage',
        value: `${kwh(solarExported)} exported from ${kwh(solarGenerated)} generated`,
        why_it_matters: 'Exported solar is useful, but it is usually worth less than using that electricity inside the home during expensive periods.',
        severity: 'watch',
      });
      pushUnique(money, `Solar is helping, but ${kwh(solarExported)} was exported instead of offsetting home demand.`);
      nextActions.push({
        key: 'shift_loads_to_solar_window',
        label: 'Move flexible loads into daylight solar windows',
        reason: 'Dishwasher, washing machine and some EV charging can absorb solar that would otherwise be exported.',
        impact: 'money',
      });
    }
  }

  if (evDay != null || evNight != null) {
    const split = `${evDay != null ? `${kwh(evDay)} day-rate` : ''}${evDay != null && evNight != null ? ', ' : ''}${evNight != null ? `${kwh(evNight)} night-rate` : ''}`;
    pushUnique(patterns, `EV charging split: ${split}.`);
    if (evDayPct != null && evDayPct >= 35) {
      drivers.push({
        key: 'ev_day_rate_charging',
        label: 'EV charging on day rate',
        value: `${percent(evDayPct)} of EV charging on day rate`,
        why_it_matters: 'EV charging is one of the easiest loads to move to night-rate or solar periods.',
        severity: evDayPct >= 50 ? 'action' : 'watch',
      });
      pushUnique(money, `EV charging is using ${kwh(evDay)} on day rate, which is a strong candidate for shifting.`);
      nextActions.push({
        key: 'schedule_ev_night_or_solar',
        label: 'Set EV charging to night-rate or solar surplus windows',
        reason: 'This directly reduces expensive day-rate grid import without changing comfort.',
        impact: 'money',
      });
    }
  }

  if (gridImport != null) {
    pushUnique(patterns, `Total grid import for the model month is ${kwh(gridImport)}.`);
  }
  if (peakDayShare != null) {
    pushUnique(patterns, `About ${percent(peakDayShare)} of grid import is in day/peak windows.`);
    if (peakDayShare >= 55) {
      drivers.push({
        key: 'day_peak_grid_import',
        label: 'Day/peak grid exposure',
        value: `${percent(peakDayShare)} of import in day/peak windows`,
        why_it_matters: 'Day and peak periods are where behaviour changes usually save the most.',
        severity: 'watch',
      });
      pushUnique(money, `Day/peak grid import is high at about ${percent(peakDayShare)} of monthly import.`);
    }
  }

  const mvhrAnomaly = str(mvhrDevice.anomaly);
  if (mvhrAnomaly) {
    pushUnique(comfort, `MVHR note: ${mvhrAnomaly}.`);
    pushUnique(risk, 'Ventilation anomalies can affect comfort, humidity and perceived warmth.');
    nextActions.push({
      key: 'check_mvhr_filters',
      label: 'Check MVHR filter status and boost settings',
      reason: 'Ventilation affects comfort and humidity, not just energy use.',
      impact: 'comfort',
    });
  }

  for (const win of Array.isArray(detail.biggest_wins) ? detail.biggest_wins : []) {
    if (typeof win === 'string' && win.trim()) {
      pushUnique(patterns, win.trim());
    }
  }

  if (nextActions.length === 0) {
    nextActions.push({
      key: 'review_energy_pattern',
      label: 'Review the monthly pattern before changing supplier',
      reason: 'The model can usually separate system settings from tariff or supplier issues.',
      impact: 'money',
    });
  }

  const summaryParts = [
    gridImport != null ? `${kwh(gridImport)} imported from the grid` : null,
    cop != null && designSpf != null ? `heat pump at ${cop.toFixed(1)} COP vs ${designSpf.toFixed(1)} design SPF` : null,
    solarGenerated != null ? `${kwh(solarGenerated)} solar generated${solarExported != null ? `, ${kwh(solarExported)} exported` : ''}` : null,
    evDay != null ? `${kwh(evDay)} EV charging on day rate` : null,
  ].filter(Boolean);

  return {
    source: 'units.metadata.demo_home derived intelligence',
    month: str(energy.current_month),
    home_label: str(home.address) || str(home.development) || null,
    installed_systems: installedSystems,
    headline: str(detail.headline),
    summary: summaryParts.length > 0
      ? summaryParts.join('; ')
      : 'Energy systems and usage data are available for this home.',
    facts: {
      grid_import_kwh: gridImport,
      heat_pump_cop: cop,
      heat_pump_design_spf: designSpf,
      heat_pump_excess_kwh: hpExcess,
      heat_pump_excess_pct: hpExcessPct,
      solar_generated_kwh: solarGenerated,
      solar_exported_kwh: solarExported,
      solar_self_consumed_kwh: solarSelfConsumed,
      solar_self_consumption_pct: solarSelfConsumptionPct,
      ev_total_kwh: evTotal,
      ev_day_rate_kwh: evDay,
      ev_night_rate_kwh: evNight,
      ev_day_rate_pct: evDayPct,
      night_kwh: night,
      day_kwh: day,
      peak_kwh: peak,
      peak_day_share_pct: peakDayShare,
    },
    patterns,
    drivers,
    money,
    comfort,
    risk,
    next_actions: nextActions.slice(0, 5),
    answer_guidance: [
      'Answer from this derived intelligence before giving generic supplier advice.',
      'Frame energy answers around Money, Comfort and Risk.',
      'Be explicit that these are Golden Home demo model figures, not a live supplier meter feed.',
      'When usage is high, identify the likely controllable driver and propose one next action.',
    ],
  };
}

export function enrichDemoHomeEnergy(demoHome: unknown): unknown {
  const root = obj(demoHome);
  if (Object.keys(root).length === 0) return demoHome;
  const intelligence = buildEnergyIntelligence(root);
  return intelligence ? { ...root, energy_intelligence: intelligence } : demoHome;
}

export function buildHomeEnergyAnswer(demoHome: unknown, message: string): string | null {
  const root = obj(demoHome);
  const intelligence = buildEnergyIntelligence(root);
  if (!intelligence) return null;

  const lower = message.toLowerCase();
  const asksSolar = /\b(solar|panel|panels|pv|generation|export)\b/i.test(lower);
  const asksHeatPump = /\b(heat\s*pump|cop|heating|hot\s*water)\b/i.test(lower);
  const asksEv = /\b(ev|charger|charging|car)\b/i.test(lower);
  const asksPattern = /\b(pattern|patterns|analysis|analyse|analyze|why|high|usage|bill|cost)\b/i.test(lower);
  const month = intelligence.month || 'this month';
  const home = intelligence.home_label || 'this home';
  const f = intelligence.facts;

  const lead = asksPattern
    ? `Yes. For ${home}, the energy pattern is specific, not generic.`
    : `Yes. I can answer that from the Golden Home energy model for ${home}.`;

  const lines: string[] = [lead];
  if (intelligence.headline) {
    lines.push(intelligence.headline.charAt(0).toUpperCase() + intelligence.headline.slice(1));
  }

  if (asksSolar && !asksHeatPump && !asksEv) {
    lines.push(`Solar PV is part of this home${intelligence.installed_systems.find((s) => s.startsWith('Solar')) ? `: ${intelligence.installed_systems.find((s) => s.startsWith('Solar'))}.` : '.'}`);
    if (f.solar_generated_kwh != null) {
      lines.push(`For ${month}, the model shows ${kwh(f.solar_generated_kwh)} generated${f.solar_exported_kwh != null ? ` and ${kwh(f.solar_exported_kwh)} exported` : ''}.${f.solar_self_consumption_pct != null ? ` That implies about ${percent(f.solar_self_consumption_pct)} self-consumption.` : ''}`);
    }
    lines.push('The useful next action is to move flexible loads into daylight windows so more solar is used inside the home rather than exported.');
    return lines.join('\n\n');
  }

  if (asksHeatPump && !asksSolar && !asksEv) {
    const hp = intelligence.installed_systems.find((s) => s.startsWith('Heat pump')) || 'Heat pump';
    lines.push(`${hp} is the main system to check.`);
    if (f.heat_pump_cop != null && f.heat_pump_design_spf != null) {
      lines.push(`It is running at about ${f.heat_pump_cop.toFixed(1)} COP against a design SPF of ${f.heat_pump_design_spf.toFixed(1)}.${f.heat_pump_excess_kwh != null ? ` The model attributes roughly ${kwh(f.heat_pump_excess_kwh)} of extra usage to that gap.` : ''}`);
    }
    lines.push('The next best check is the heating schedule, flow temperature and hot-water timing before blaming the supplier.');
    return lines.join('\n\n');
  }

  if (asksEv && !asksSolar && !asksHeatPump) {
    lines.push(`EV charging is visible in the model${intelligence.installed_systems.find((s) => s.startsWith('EV')) ? `: ${intelligence.installed_systems.find((s) => s.startsWith('EV'))}.` : '.'}`);
    if (f.ev_day_rate_kwh != null || f.ev_night_rate_kwh != null) {
      lines.push(`The split is ${[f.ev_day_rate_kwh != null ? `${kwh(f.ev_day_rate_kwh)} day-rate` : null, f.ev_night_rate_kwh != null ? `${kwh(f.ev_night_rate_kwh)} night-rate` : null].filter(Boolean).join(' and ')}${f.ev_day_rate_pct != null ? `, so about ${percent(f.ev_day_rate_pct)} is happening on day rate` : ''}.`);
    }
    lines.push('The most practical action is to schedule charging for night-rate or solar-surplus windows.');
    return lines.join('\n\n');
  }

  if (f.grid_import_kwh != null) {
    lines.push(`The model shows ${kwh(f.grid_import_kwh)} imported from the grid in ${month}.`);
  }
  if (intelligence.drivers.length > 0) {
    lines.push(`The main drivers are: ${intelligence.drivers.map((d) => `${d.label.toLowerCase()} (${d.value})`).join('; ')}.`);
  }
  if (intelligence.money.length > 0) {
    lines.push(`Money: ${intelligence.money[0]}`);
  }
  if (intelligence.comfort.length > 0) {
    lines.push(`Comfort: ${intelligence.comfort[0]}`);
  }
  if (intelligence.risk.length > 0) {
    lines.push(`Risk: ${intelligence.risk[0]}`);
  }
  const next = intelligence.next_actions[0];
  if (next) {
    lines.push(`Next action: ${next.label}. ${next.reason}`);
  }
  lines.push('I’m taking this from the Golden Home demo energy model, the same data used in My Home, not from a live supplier bill. Want me to break this into the three changes that would cut next month’s usage?');

  return lines.join('\n\n');
}
