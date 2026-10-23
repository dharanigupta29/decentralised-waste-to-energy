// OWNER: PERSON A (process & math engine)
// For every unit: a plain-language "what is happening inside" line, live equations with the
// current numbers substituted, and key readings. The inspector (Person B) only renders this.
// Each entry: (s) => { title, inside, readings: [[label, value]], eq: [[name, formula, result]], reactions?: [[zone, text]] }
(function () {
  'use strict';
  const WTE = window.WTE;
  const K = WTE.K;
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  const pct = (x, d = 0) => (x * 100).toFixed(d) + '%';

  WTE.EQUATIONS = {
    hopper: (s) => ({
      title: '1 · Feed hopper & shredder',
      inside: s.shredder.on
        ? `Twin-shaft shredder is chewing waste at ${f(s.shredder.rate, 0)} kg/h into 20–50 mm chips so it flows evenly through the gasifier.`
        : s.hopper.kg > 0 ? 'Waiting: dryer is full, so the shredder is paused.' : 'Hopper empty. Dump some waste to start.',
      readings: [['In hopper', f(s.hopper.kg) + ' kg'], ['Moisture (as dumped)', pct(s.hopper.moisture, 1)], ['Shredder', s.shredder.on ? 'RUNNING' : 'idle'], ['Shredder power', f(s.shredder.kW, 2) + ' kW'], ['Total dumped', f(s.tot.dumpedKg) + ' kg']],
      eq: [
        ['Throughput', 'ṁ = min(ṁ_rated, room in dryer)', f(s.shredder.rate, 0) + ' kg/h'],
        ['Specific energy', 'P = e·ṁ = 20 kWh/t × ' + f(s.shredder.rate, 0) + ' kg/h', f(s.shredder.kW, 2) + ' kW'],
        ['Dry matter', 'm_dry = m_wet·(1 − M) = ' + f(s.hopper.kg) + '·(1 − ' + f(s.hopper.moisture, 2) + ')', f(s.hopper.kg * (1 - s.hopper.moisture)) + ' kg'],
      ],
    }),

    dryer: (s) => {
      const d = s.dryer;
      return {
        title: '2 · Biomass dryer (waste-heat)',
        inside: d.Qavail > 0.05
          ? `Hot air at ${f(d.airT, 0)} °C (recovered from the gasifier jacket and engine exhaust) blows through the chips and evaporates ${f(d.evapRate)} kg of water per hour.`
          : 'No waste heat yet. Wet fuel passes straight through until the gasifier and engine warm up (this is the feedback loop!).',
        readings: [['Inventory', f(d.kg) + ' kg'], ['Moisture now', pct(d.mOut, 1)], ['Set-point', pct(d.target, 0)], ['Heat from gas cooler', f(d.Qcool, 2) + ' kW'], ['Heat from engine HX', f(d.Qrec, 2) + ' kW'], ['Air temperature', f(d.airT, 0) + ' °C']],
        eq: [
          ['Heat available', 'Q = Q_gascooler + Q_HX = ' + f(d.Qcool, 2) + ' + ' + f(d.Qrec, 2), f(d.Qavail, 2) + ' kW'],
          ['Evaporation capacity', 'ṁ_w = Q·3600 / h_evap = ' + f(d.Qavail, 2) + '·3600 / ' + K.H_EVAP, f(d.evapRate, 2) + ' kg/h'],
          ['Water to reach set-point', 'm_w,target = m_dry·M_t/(1 − M_t)', ''],
          ['Why it matters', 'Each +10% moisture → T_ox falls ≈ 110 °C → poorer gas', ''],
        ],
      };
    },

    gasifier: (s) => {
      const g = s.gasifier, c = g.comp, T = g.T;
      return {
        title: '3 · Downdraft gasifier',
        inside: !g.ignited ? 'Cold. Fuel will auto-ignite once the bed has more than 2 kg.'
          : !g.burning ? 'Bed empty, reactor cooling down.'
          : `Fuel falls down through 4 zones. Only ${f(g.ER * 100, 0)}% of the air needed for full combustion enters at the throat, so instead of burning completely the carbon is turned into combustible CO + H₂ (producer gas). The leftover carbon skeleton drops through the grate as BIOCHAR.`,
        readings: [['Feed (wet)', f(g.feedWet) + ' kg/h'], ['Bed moisture', pct(g.moisture, 1)], ['Air in', f(g.airKgH) + ' kg/h'], ['Gas out', f(g.Qraw) + ' Nm³/h'], ['Gas LHV', f(g.LHV, 2) + ' MJ/Nm³'],
          ['Cold-gas efficiency', pct(g.CGE, 0)], ['Biochar', f(g.charRate, 2) + ' kg/h'], ['Tar (raw)', g.Qraw > 0.1 ? f(g.tarRaw, 2) + ' g/Nm³' : '-'],
          ['CO / H₂ / CH₄', g.Qraw > 0.1 ? `${f(c.CO)} / ${f(c.H2)} / ${f(c.CH4)} %` : 'no gas'], ['CO₂ / N₂', g.Qraw > 0.1 ? `${f(c.CO2)} / ${f(c.N2)} %` : 'no gas']],
        eq: [
          ['Air supply', 'ṁ_air = ER·AFR_st·ṁ_dry = ' + f(g.ER, 2) + '·' + K.AFR_ST + '·' + f(g.feedDry, 2), f(g.airKgH) + ' kg/h'],
          ['Oxidation temp. (energy-balance fit)', 'T_ox = 780 + 1500·ER − 1100·M − 150·(1 − S(ṁ))', f(T.ox, 0) + ' °C'],
          ['Reduction zone', 'T_red = 25 + 0.8·(T_ox − 25)', f(T.red, 0) + ' °C'],
          ['Gas yield (N₂ balance)', 'V = 0.79·(ṁ_air/ρ_air) / y_N₂ = 0.79·' + f(c.airNm3, 2) + ' / ' + f(c.N2 / 100, 3), f(g.gasYield, 2) + ' Nm³/kg'],
          ['Heating value', 'LHV = (12.63·CO + 10.78·H₂ + 35.81·CH₄)/100', f(g.LHV, 2) + ' MJ/Nm³'],
          ['Gas chemical power', 'P_gas = Q·LHV/3.6 = ' + f(g.Qraw) + '·' + f(g.LHV, 2) + '/3.6', f(g.gasKW) + ' kW'],
          ['Cold-gas efficiency', 'η_cg = P_gas / (ṁ_dry·LHV_dry/3.6)', pct(g.CGE, 1)],
          ['Biochar yield', 'ṁ_char = ṁ_dry·FC·(0.35 + 1.2·max(0, 0.35 − ER))', f(g.charRate, 2) + ' kg/h'],
          ['Carbon locked', 'CO₂e = ṁ_char·0.75·0.8·44/12', f(g.co2eRate, 2) + ' kg CO₂/h'],
        ],
        reactions: [
          ['Drying · ' + f(T.dry, 0) + ' °C', 'H₂O(l) → H₂O(g)'],
          ['Pyrolysis · ' + f(T.pyro, 0) + ' °C', 'Biomass → char + tar + volatiles (CO, CO₂, CH₄, H₂)'],
          ['Oxidation · ' + f(T.ox, 0) + ' °C', 'C + O₂ → CO₂   ΔH = −394 kJ/mol  ·  2H₂ + O₂ → 2H₂O   ΔH = −484 kJ/mol'],
          ['Reduction · ' + f(T.red, 0) + ' °C', 'C + CO₂ ⇌ 2CO (+172 kJ, Boudouard) · C + H₂O ⇌ CO + H₂ (+131 kJ, water-gas) · CO + H₂O ⇌ CO₂ + H₂ (−41 kJ, shift) · C + 2H₂ ⇌ CH₄ (−75 kJ)'],
        ],
      };
    },

    cyclone: (s) => {
      const c = s.cyclone;
      return {
        title: '4 · Cyclone separator',
        inside: c.Q > 0.1 ? `Gas enters tangentially and spins. Centrifugal force throws heavy ash/char dust to the wall, where it slides down into the dust pot. Clean gas exits up the vortex finder.` : 'No gas flow.',
        readings: [['Gas flow', f(c.Q) + ' Nm³/h'], ['Dust in', f(c.dustIn, 2) + ' g/Nm³'], ['Dust out', f(c.dustOut, 3) + ' g/Nm³'], ['Collected dust', f(s.bins.dust, 3) + ' kg'], ['Gas temp out', f(c.Tout, 0) + ' °C']],
        eq: [
          ['Separation', 'c_out = c_in·(1 − η) = ' + f(c.dustIn, 2) + '·(1 − ' + c.eff + ')', f(c.dustOut, 3) + ' g/Nm³'],
          ['Cut size (Lapple)', 'd₅₀ = √(9μW / (2πN·v·(ρp − ρg)))  ≈ 5 µm', ''],
        ],
      };
    },

    scrubber: (s) => {
      const c = s.scrubber;
      return {
        title: '5 · Wet scrubber & cooler',
        inside: c.Q > 0.1 ? `Water spray cools the gas to ${f(c.Tout, 0)} °C. Tar droplets and steam condense into the water. The water is getting dirtier (quality ${pct(c.waterQ)}).` : 'Idle.',
        readings: [['Tar in', f(c.tarIn, 2) + ' g/Nm³'], ['Tar out', f(c.tarOut, 3) + ' g/Nm³'], ['Removal efficiency', pct(c.eff)], ['Tar captured in water', f(c.loadG) + ' g'], ['Water quality', pct(c.waterQ)], ['Condensate', f(c.condRate, 2) + ' kg/h'], ['Pump', f(c.pumpKW, 2) + ' kW']],
        eq: [
          ['Tar removal', 'c_out = c_in·(1 − η), η = 0.8·q_water = 0.8·' + f(c.waterQ, 2), f(c.tarOut, 3) + ' g/Nm³'],
          ['Water saturation', 'q_water = 1 − 0.5·S(0, cap, m_tar) with m_tar = ' + f(c.loadG) + ' g', pct(c.waterQ)],
          ['Condensed steam', 'ṁ_cond ≈ 0.9·ṁ_feed·M', f(c.condRate, 2) + ' kg/h'],
        ],
      };
    },

    filter: (s) => {
      const c = s.filter;
      return {
        title: '6 · Fine filter (sawdust / fabric bed)',
        inside: c.Q > 0.1 ? `Last polishing step: remaining tar mist and fines get trapped in the media. The engine needs < 100 mg/Nm³ tar. Now ${f(c.tarOutMg, 0)} mg/Nm³.` : 'Idle.',
        readings: [['Tar to engine', f(c.tarOutMg, 1) + ' mg/Nm³'], ['Dust to engine', f(c.dustOutMg, 2) + ' mg/Nm³'], ['Filter loading', pct(c.loadPct)], ['Pressure drop', f(c.dp, 2) + ' kPa'], ['Engine spec', c.tarOutMg <= 100 ? 'OK ✔' : 'EXCEEDED ✖']],
        eq: [
          ['Tar polish', 'c_out = c_in·(1 − η) = ' + f(c.tarIn * 1000, 1) + ' mg·(1 − ' + f(c.eff, 2) + ')', f(c.tarOutMg, 1) + ' mg/Nm³'],
          ['Pressure drop grows', 'Δp = 0.3 + 2.2·(m_load/cap) = 0.3 + 2.2·' + f(c.loadPct, 2), f(c.dp, 2) + ' kPa'],
        ],
      };
    },

    blower: (s) => {
      const b = s.blower;
      return {
        title: '7 · Induced-draft blower',
        inside: b.Q > 0.1 ? 'Creates suction that pulls air into the gasifier and gas through the whole cleaning train.' : 'Stopped.',
        readings: [['Flow', f(b.Q) + ' Nm³/h'], ['Total Δp', f(b.dp, 2) + ' kPa'], ['Speed', f(b.rpm, 0) + ' rpm'], ['Power', f(b.kW, 3) + ' kW']],
        eq: [
          ['Train resistance', 'Δp = Δp_bed + Δp_cyc + Δp_scrub + Δp_filter', f(b.dp, 2) + ' kPa'],
          ['Fan power', 'P = Q·Δp/η_fan = (' + f(b.Q) + '/3600)·' + f(b.dp, 2) + '/0.45 + 0.12', f(b.kW, 3) + ' kW'],
        ],
      };
    },

    tank: (s) => {
      const t = s.tank;
      return {
        title: '9 · Gas holder & safety flare',
        inside: `${t.mode}. The holder buffers gas so the engine runs smoothly. Off-spec start-up gas and surplus gas are burned in the flare (never vented: CO is toxic).`,
        readings: [['Stored', f(t.nm3, 2) + ' Nm³'], ['Fill', pct(t.fill)], ['Pressure', f(t.pressure, 1) + ' kPa(g)'], ['Stored gas LHV', f(t.LHV, 2) + ' MJ/Nm³'], ['In', f(t.inRate) + ' Nm³/h'], ['To engine', f(t.outRate) + ' Nm³/h'], ['Flare', f(t.flareRate) + ' Nm³/h (' + f(t.flareKW) + ' kW)']],
        eq: [
          ['Mass balance', 'dV/dt = Q_in − Q_engine − Q_flare', f(t.inRate - t.outRate, 2) + ' Nm³/h'],
          ['Start-up interlock', 'gas → holder only if LHV ≥ 3.2 MJ/Nm³', t.gasOK ? 'OPEN' : 'TO FLARE'],
          ['Mixed LHV', 'LHV_tank = (LHV_tank·V + LHV_in·ΔV)/(V + ΔV)', f(t.LHV, 2)],
        ],
      };
    },

    engine: (s) => {
      const e = s.engine;
      return {
        title: '8 · Producer-gas engine + generator',
        inside: e.on ? `4-stroke spark-ignition engine burns ${f(e.gasNm3h)} Nm³/h of producer gas. The crank turns the alternator at ${f(e.rpm, 0)} rpm → ${f(e.freq, 1)} Hz, ${f(e.voltage, 0)} V 3-phase.` : 'Stopped. Starts automatically when the holder has ≥ 0.8 Nm³ of gas with LHV ≥ 3.6.',
        readings: [['Electrical output', f(e.P, 2) + ' kW'], ['Set-point', f(e.Pset, 2) + ' kW'], ['Load factor', pct(e.lf)], ['Electrical efficiency', pct(e.eff, 1)], ['Fuel (gas) power', f(e.fuelKW) + ' kW'], ['Gas use', f(e.gasNm3h) + ' Nm³/h'], ['Exhaust', f(e.Texh, 0) + ' °C']],
        eq: [
          ['Set-point', 'P_set = min(P_rated, load + parasitic + battery charge)', f(e.Pset, 2) + ' kW'],
          ['Part-load efficiency', 'η = 0.28·(1 − 0.55·(1 − LF)²)·f(LHV)', pct(e.eff, 1)],
          ['Fuel needed', 'P_fuel = P_el / η = ' + f(e.P, 2) + ' / ' + f(e.eff, 3), f(e.fuelKW) + ' kW'],
          ['Gas flow', 'Q = P_fuel·3.6 / LHV', f(e.gasNm3h) + ' Nm³/h'],
          ['Frequency', 'f = rpm·poles/120 = ' + f(e.rpm, 0) + '·4/120', f(e.freq, 1) + ' Hz'],
        ],
      };
    },

    hx: (s) => {
      const x = s.hx;
      return {
        title: '9 · Exhaust heat exchanger (CHP loop)',
        inside: x.Qrec > 0.05 ? `Hot exhaust at ${f(x.Tin, 0)} °C gives its heat to fresh air, which is ducted back to the dryer (orange dashed loop). Engine waste heat dries the next fuel.` : 'No exhaust heat (engine off).',
        readings: [['Exhaust in', f(x.Tin, 0) + ' °C'], ['Exhaust out', f(x.Tout, 0) + ' °C'], ['Exhaust heat', f(x.Qexh, 2) + ' kW'], ['Recovered → dryer', f(x.Qrec, 2) + ' kW'], ['Effectiveness ε', pct(x.eff)]],
        eq: [
          ['Exhaust heat', 'Q_exh ≈ 0.33·P_fuel', f(x.Qexh, 2) + ' kW'],
          ['Recovered', 'Q_rec = ε·Q_exh = ' + x.eff + '·' + f(x.Qexh, 2), f(x.Qrec, 2) + ' kW'],
          ['Outlet temperature', 'T_out = T_in − ε·(T_in − 120)', f(x.Tout, 0) + ' °C'],
        ],
      };
    },

    panel: (s) => {
      const b = s.panel, p = s.p;
      return {
        title: '10 · Control panel, inverter & battery',
        inside: `${b.mode}. Priority dispatch: plant auxiliaries → health clinic → streetlights → homes. The battery keeps the lights on when the gasifier is starting or the fuel runs out.`,
        readings: [['Generator', f(b.Pgen, 2) + ' kW'], ['Plant auxiliaries', f(b.parasitic, 2) + ' kW'], ['Village demand', f(b.demand, 2) + ' kW'], ['Village served', f(b.served, 2) + ' kW'], ['Battery', (b.battKW >= 0 ? '−' : '+') + f(Math.abs(b.battKW), 2) + ' kW'],
          ['State of charge', pct(b.soc) + ' (' + f(b.socKWh) + ' kWh)'], ['Curtailed', f(b.curtailed, 2) + ' kW']],
        eq: [
          ['Bus balance', 'P_gen + P_batt = P_aux + P_village', f(b.Pgen, 2) + ' + ' + f(b.battKW, 2) + ' = ' + f(b.servedPar + b.served, 2)],
          ['SOC update', 'dSOC/dt = −P_batt/(η·E_batt), η = 0.95, E = ' + p.batteryKWh + ' kWh', pct(b.soc, 1)],
          ['Shedding', 'lamps lit = ⌊P_left / ' + p.lampW + ' W⌋', String(s.village.lampsLit) + ' / ' + s.village.lampsTotal],
        ],
      };
    },

    village: (s) => {
      const v = s.village, p = s.p, t = s.tot, ec = s.econ;
      const profitStr = (ec.profit >= 0 ? '+' : '-') + '₹' + f(Math.abs(ec.profit), 0);
      return {
        title: '11 · Village microgrid',
        inside: `${v.night ? 'Night' : 'Day'}: ${v.lampsLit}/${v.lampsTotal} LED streetlights, ${v.housesLit}/${v.housesTotal} homes and the clinic ${v.clinicOn ? 'ON' : 'OFF'}. Electricity generated earns ₹${f(ec.electricity, 0)} (@ ₹${p.rateElec}/kWh).`,
        readings: [
          ['Demand', f(v.demand, 2) + ' kW'],
          ['Served', f(v.served, 2) + ' kW (' + pct(v.servedFrac) + ')'],
          ['Energy delivered', f(t.servedKWh, 2) + ' kWh'],
          ['Electricity revenue', '₹' + f(ec.electricity, 0) + ' (@ ₹' + p.rateElec + '/kWh)'],
          ['Net project profit', profitStr],
          ['Feedstock cost', '₹' + f(ec.cost, 0) + ' (@ ₹' + p.rateCost + '/kg)'],
          ['Biochar made', f(s.bins.biochar, 2) + ' kg'],
          ['CO₂ locked', f(t.co2e, 2) + ' kg'],
        ],
        eq: [
          ['Demand', 'P = clinic + N_lamp·' + p.lampW + ' W + N_home·' + p.houseW + ' W', f(v.demand, 2) + ' kW'],
          ['Electricity revenue', '₹ = rate·E_served = ' + p.rateElec + '·' + f(t.servedKWh, 1) + ' kWh', '₹' + f(ec.electricity, 0)],
          ['Project net profit', '₹ = elec + biochar + carbon − cost', profitStr],
          ['Overall waste→wire', 'η = E_village / E_feed = ' + f(t.servedKWh, 2) + ' / ' + f(t.feedMJ / 3.6, 2), t.feedMJ > 0 ? pct(t.servedKWh / (t.feedMJ / 3.6), 1) : '-'],
          ['Hardware LEDs', 'n = round(8·P_served/P_demand)', String(v.ledsLit) + ' / 8'],
        ],
      };
    },

    bins: (s) => {
      const b = s.bins, g = s.gasifier, p = s.p, ec = s.econ;
      return {
        title: 'Biochar & ash outputs',
        inside: `Biochar = carbon-rich charcoal that falls through the grate. Used as soil amendment it holds water and nutrients. Total value: ₹${f(ec.biochar, 0)} biochar + ₹${f(ec.carbon, 0)} carbon credits.`,
        readings: [
          ['Biochar collected', f(b.biochar, 2) + ' kg'],
          ['Biochar value', '₹' + f(ec.biochar, 0) + ' (@ ₹' + p.rateBiochar + '/kg)'],
          ['CO₂e locked', f(s.tot.co2e, 2) + ' kg'],
          ['Carbon credit value', '₹' + f(ec.carbon, 0) + ' (@ ₹' + p.rateCarbon + '/kg)'],
          ['Ash collected', f(b.ash, 2) + ' kg'],
          ['Production rate', f(g.charRate, 2) + ' kg/h'],
        ],
        eq: [
          ['Char yield', 'Y = FC·(0.35 + 1.2·max(0, 0.35 − ER)) = ' + f(g.fc, 2) + '·(…)', g.feedDry > 0 ? pct(g.charRate / g.feedDry, 1) : '-'],
          ['Carbon removal', 'CO₂e = m_char·C(0.75)·stable(0.8)·44/12', f(s.tot.co2e, 2) + ' kg'],
          ['Biochar revenue', '₹ = rate·m_char = ' + p.rateBiochar + '·' + f(b.biochar, 2) + ' kg', '₹' + f(ec.biochar, 0)],
          ['Carbon credit value', '₹ = rate·CO₂e = ' + p.rateCarbon + '·' + f(s.tot.co2e, 2) + ' kg', '₹' + f(ec.carbon, 0)],
          ['Biochar + Carbon total', '₹ = ' + f(ec.biochar, 0) + ' + ' + f(ec.carbon, 0), '₹' + f(ec.biochar + ec.carbon, 0)],
        ],
      };
    },
  };
  WTE.EQUATIONS.shredder = WTE.EQUATIONS.hopper;
  WTE.EQUATIONS.laptop = WTE.EQUATIONS.panel;
})();
