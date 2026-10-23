// OWNER: PERSON A (process & math engine)
// Pure simulation: NO DOM access in this file. The UI only reads `sim.s` (the snapshot, see CONTRACT.md)
// and calls the public methods at the bottom of the Sim class.
(function () {
  'use strict';
  const WTE = (window.WTE = window.WTE || {});
  const FEED = WTE.FEEDSTOCKS;

  // ---------- helpers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lag = (cur, target, tau, dt) => cur + (target - cur) * (1 - Math.exp(-dt / tau)); // first-order response
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  WTE.util = { clamp, lag, smooth };

  // ---------- physical constants ----------
  const K = {
    LHV_CO: 12.63, LHV_H2: 10.78, LHV_CH4: 35.81, // MJ/Nm3
    AFR_ST: 6.0,        // kg air per kg dry biomass for complete combustion
    RHO_AIR: 1.293,     // kg/Nm3
    H_EVAP: 2600,       // kJ per kg water evaporated (latent + sensible)
    CP_GAS: 1.4,        // kJ/(Nm3.K) producer gas
    C_IN_CHAR: 0.75,    // carbon mass fraction of biochar
    STABLE_C: 0.8,      // fraction of biochar carbon stable for >100 years
    CO2_PER_C: 44 / 12,
    TANK_NM3: 4,        // gas holder volume
  };
  WTE.K = K;

  // ---------- operator parameters (UI may change these via sim.set) ----------
  WTE.DEFAULTS = {
    ER: 0.28,              // equivalence ratio (air supplied / stoichiometric air)
    targetMoisture: 0.12,  // dryer set-point
    feedMode: 'auto',      // 'auto' = load following, 'manual' = fixed feedRate
    feedRate: 20,          // kg/h wet, manual mode
    minFeed: 8, maxFeed: 45,
    autoStart: true, engineEnabled: true,
    shredderRate: 60, shredderKW: 1.2,
    dryerCap: 25, bedCap: 40, bedFeedRate: 120,
    scrubCap: 300,         // g of tar the scrubber water can hold before it is "dirty"
    filterCap: 60,         // g of dust+tar the filter holds before it is "blocked"
    engineRated: 15,       // kWe
    hxEff: 0.65,           // exhaust heat exchanger effectiveness
    batteryKWh: 30, battMaxKW: 10, socMin: 0.10, socMax: 0.98,
    controlsKW: 0.15,
    streetlights: 24, lampW: 60, houses: 10, houseW: 300, clinicW: 800,
    night: true,
    rateElec: 8,           // ₹ per kWh of served electricity
    rateBiochar: 25,       // ₹ per kg of biochar
    rateCarbon: 2,         // ₹ per kg of CO2e locked
    rateCost: 3,           // ₹ per kg of dumped waste (operating cost)
  };

  // ---------- core correlations (exported so equations.js / forecast reuse the same math) ----------
  function gasComposition(ER, M, Tred, feed) {
    const dE = ER - 0.28, dM = M - 0.12, dT = (Tred - 850) / 100;
    let CO = 21 - 60 * dE - 30 * dM + 1.5 * dT;   // Boudouard favoured by high T, low O2
    let H2 = 17 - 35 * dE + 15 * dM + 0.8 * dT;   // water-gas / shift favoured by steam
    let CH4 = 2.5 - 6 * dE - 0.6 * dT;            // methanation favoured by low T
    let CO2 = 11 + 50 * dE + 20 * dM - 1.8 * dT;
    const comb0 = CO + H2 + CH4;
    const fq = clamp(feed.lhv / 18.5, 0.78, 1.05);  // poorer fuel -> leaner gas
    const q = smooth(550, 800, Tred);                // reduction zone must be hot to make fuel gas
    CO *= fq * q; H2 *= fq * q; CH4 *= fq * q;
    CO2 += 0.6 * (comb0 - (CO + H2 + CH4));
    CO = Math.max(0.2, CO); H2 = Math.max(0.2, H2); CH4 = Math.max(0.1, CH4); CO2 = clamp(CO2, 1, 30);
    const N2 = 100 - CO - H2 - CH4 - CO2;
    const LHV = (CO * K.LHV_CO + H2 * K.LHV_H2 + CH4 * K.LHV_CH4) / 100;   // MJ/Nm3
    const airKg = ER * K.AFR_ST;                       // kg air per kg dry feed
    const airNm3 = airKg / K.RHO_AIR;
    const gasYield = (airNm3 * 0.79) / (N2 / 100);     // N2 is inert: N2 in = N2 out
    return { CO, H2, CH4, CO2, N2, LHV, airKg, airNm3, gasYield, q, fq };
  }
  function oxidationTarget(ER, M, feedWet) {
    return clamp(780 + 1500 * ER - 1100 * M - 150 * (1 - smooth(3, 15, feedWet)), 450, 1350);
  }
  function charFraction(ER, fc) { return fc * (0.35 + 1.2 * Math.max(0, 0.35 - ER)); }
  function tarRaw(Tox) { return 0.3 + 6 * Math.pow(Math.max(0, 1050 - Tox) / 450, 1.5); } // g/Nm3
  function engineEff(lf, LHV) {
    return 0.28 * (1 - 0.55 * Math.pow(1 - clamp(lf, 0, 1), 2)) * clamp(0.8 + 0.2 * (LHV - 3.5) / 1.5, 0.8, 1);
  }
  WTE.model = { gasComposition, oxidationTarget, charFraction, tarRaw, engineEff };

  // Steady-state prediction for a batch BEFORE it is dumped (drives the "this load will light..." box).
  WTE.forecast = function (kg, type, p) {
    const f = FEED[type];
    const M = Math.min(f.moisture, p.targetMoisture);
    const dry = kg * (1 - f.moisture);
    const Tox = oxidationTarget(p.ER, M, 20);
    const g = gasComposition(p.ER, M, 25 + 0.8 * (Tox - 25), f);
    const gasMJ = dry * g.gasYield * g.LHV * 0.85; // ~15% lost to warm-up, flaring and cool-down per batch
    const grossKWh = (gasMJ * engineEff(0.8, g.LHV)) / 3.6;
    const netKWh = grossKWh * 0.88; // ~12% plant parasitic (shredder, blower, pump, fans)
    const biochar = dry * charFraction(p.ER, f.fc);
    return {
      dry, gasNm3: dry * g.gasYield, gasMJ, cge: gasMJ / (dry * f.lhv), grossKWh, netKWh, biochar,
      co2e: biochar * K.C_IN_CHAR * K.STABLE_C * K.CO2_PER_C,
      oneLampHours: (netKWh * 1000) / p.lampW,
      allLampsHours: (netKWh * 1000) / (p.lampW * p.streetlights),
      homeDays: netKWh / 3, // ~3 kWh/day for a rural home
    };
  };

  // ---------- material inventory (dry mass + water, dry-mass-weighted properties) ----------
  const store = () => ({ dry: 0, water: 0, ash: 0, lhv: 18.5, fc: 0.17 });
  const wet = (s) => s.dry + s.water;
  const moist = (s) => (wet(s) > 1e-9 ? s.water / wet(s) : 0);
  function addParcel(s, pc) {
    const tot = s.dry + pc.dry;
    if (tot > 1e-9) {
      s.ash = (s.ash * s.dry + pc.ash * pc.dry) / tot;
      s.lhv = (s.lhv * s.dry + pc.lhv * pc.dry) / tot;
      s.fc = (s.fc * s.dry + pc.fc * pc.dry) / tot;
    }
    s.dry = tot; s.water += pc.water;
  }
  function take(s, kg) {
    const w = wet(s);
    const f = w > 1e-9 ? Math.min(1, kg / w) : 0;
    const pc = { dry: s.dry * f, water: s.water * f, ash: s.ash, lhv: s.lhv, fc: s.fc };
    s.dry -= pc.dry; s.water -= pc.water;
    if (wet(s) < 1e-6) { s.dry = 0; s.water = 0; }
    return pc;
  }

  class Sim {
    constructor() { this.p = Object.assign({}, WTE.DEFAULTS); this.reset(); }

    reset() {
      this.t = 0;
      this.hopper = store(); this.dryer = store(); this.bed = store();
      this.T = { dry: 25, pyro: 25, ox: 25, red: 25 };
      this.ignited = false; this.feedWet = 0;
      this.tank = 0; this.tankLHV = 0;
      this.engineOn = false; this.Pgen = 0; this.Pset = 0; this.rpm = 0; this.Texh = 25;
      this.soc = 0.35; this.scrubTar = 0; this.filterLoad = 0; this.blowerRpm = 0; this.flareShown = 0;
      this.Qrec = 0; this.Qcool = 0;
      this.bins = { biochar: 0, ash: 0, dust: 0, condensate: 0, tarSludge: 0 };
      this.tot = { dumpedKg: 0, feedMJ: 0, gasMJ: 0, elecKWh: 0, parKWh: 0, servedKWh: 0, flaredMJ: 0, heatRecMJ: 0, waterKg: 0, co2e: 0 };
      this.lastGas = gasComposition(this.p.ER, 0.12, 25, FEED.wood);
      this.log = []; this.history = []; this._histAcc = 0;
      this.step(0);
    }

    // ===== public API (called by UI / hardware) =====
    set(key, value) { this.p[key] = value; }
    dump(kg, type) {
      const f = FEED[type]; kg = Number(kg);
      if (!f || !(kg > 0)) return;
      addParcel(this.hopper, { dry: kg * (1 - f.moisture), water: kg * f.moisture, ash: f.ash, lhv: f.lhv, fc: f.fc });
      this.tot.dumpedKg += kg;
      this.event(`Dumped ${kg.toFixed(1)} kg of ${f.name} into hopper`);
    }
    ignite() { this.p.autoStart = true; if (wet(this.bed) + wet(this.dryer) + wet(this.hopper) > 0.5) { this.ignited = true; this.event('Gasifier ignited'); } }
    shutdown() { this.ignited = false; this.p.autoStart = false; this.event('Gasifier shut down by operator'); }
    changeScrubberWater() { this.bins.tarSludge += this.scrubTar / 1000; this.scrubTar = 0; this.event('Scrubber water replaced'); }
    replaceFilter() { this.filterLoad = 0; this.event('Gas filter replaced'); }
    emptyBins() { this.bins.biochar = 0; this.bins.ash = 0; this.event('Biochar & ash bins emptied (biochar bagged)'); }
    advance(simSeconds) { let r = simSeconds; while (r > 1e-9) { const h = Math.min(1, r); this.step(h); r -= h; } }
    event(msg) { this.log.unshift({ t: this.t, msg }); if (this.log.length > 60) this.log.pop(); }

    loadDemand() {
      const p = this.p;
      const clinic = p.clinicW / 1000;
      const lamps = p.night ? (p.streetlights * p.lampW) / 1000 : 0;
      const houseKW = (p.houseW / 1000) * (p.night ? 1 : 0.5);
      return { clinic, lamps, houseKW, houses: p.houses * houseKW, total: clinic + lamps + p.houses * houseKW };
    }

    // ===== one integration step, dt in seconds =====
    step(dt) {
      const p = this.p, h = dt / 3600;
      this.t += dt;

      // ---- 1. Hopper -> shredder -> dryer ----
      const dryerRoom = Math.max(0, p.dryerCap - wet(this.dryer));
      const shredRate = wet(this.hopper) > 0.01 && dryerRoom > 0.01 ? p.shredderRate : 0;
      const shredKg = Math.min(shredRate * h, wet(this.hopper), dryerRoom);
      if (shredKg > 0) addParcel(this.dryer, take(this.hopper, shredKg));
      const shredKW = shredRate > 0 ? p.shredderKW : 0;

      // ---- 2. Dryer: heat = gasifier jacket/gas cooler + engine exhaust HX (previous step) ----
      const Qavail = this.Qcool + this.Qrec;
      const mDryerIn = moist(this.dryer);
      const wTarget = (this.dryer.dry * p.targetMoisture) / (1 - p.targetMoisture);
      const removable = Math.max(0, this.dryer.water - wTarget);
      const evapCap = (Qavail * 3600) / K.H_EVAP; // kg/h
      const evapRate = removable > 0.001 ? evapCap : 0;
      const evapKg = Math.min(evapRate * h, removable);
      this.dryer.water -= evapKg;
      this.tot.waterKg += evapKg;
      const Qused = (evapRate * K.H_EVAP) / 3600;
      const dryerFanKW = wet(this.dryer) > 0.01 ? 0.25 : 0;
      const bedRoom = Math.max(0, p.bedCap - wet(this.bed));
      const dryerReady = moist(this.dryer) <= p.targetMoisture + 0.02 || wet(this.bed) < 0.25 * p.bedCap;
      const toBedRate = dryerReady && wet(this.dryer) > 0.01 && bedRoom > 0.01 ? p.bedFeedRate : 0;
      const toBedKg = Math.min(toBedRate * h, wet(this.dryer), bedRoom);
      if (toBedKg > 0) addParcel(this.bed, take(this.dryer, toBedKg));

      // ---- 3. Downdraft gasifier ----
      if (p.autoStart && !this.ignited && wet(this.bed) > 2) { this.ignited = true; this.event('Auto-start: gasifier ignited'); }
      const hasFuel = wet(this.bed) > 0.05;
      const burning = this.ignited && hasFuel;
      const Mbed = hasFuel ? moist(this.bed) : p.targetMoisture;
      const fp = this.bed; // blended feed properties
      let feedTarget = 0;
      if (burning) {
        if (p.feedMode === 'auto') {
          const g0 = this.lastGas;
          const eff = engineEff(Math.max(0.3, this.Pset / p.engineRated), g0.LHV);
          const gasNeed = (this.Pset / eff) * 3.6 / Math.max(3, g0.LHV);             // Nm3/h
          const corr = 1 + 1.5 * (0.6 - this.tank / K.TANK_NM3);                        // keep holder ~60% full
          feedTarget = clamp((gasNeed * corr) / Math.max(1, g0.gasYield) / (1 - Mbed), p.minFeed, p.maxFeed);
        } else feedTarget = p.feedRate;
      }
      this.feedWet = lag(this.feedWet, feedTarget, 60, dt);
      const consRate = burning ? this.feedWet : 0;
      take(this.bed, Math.min(consRate * h, wet(this.bed)));

      const Toxt = burning ? oxidationTarget(p.ER, Mbed, this.feedWet) : 25;
      this.T.ox = lag(this.T.ox, Toxt, burning ? 240 : 1500, dt);
      this.T.red = lag(this.T.red, 25 + 0.8 * (this.T.ox - 25), 120, dt);
      this.T.pyro = lag(this.T.pyro, 25 + 0.42 * (this.T.ox - 25), 150, dt);
      this.T.dry = lag(this.T.dry, 25 + 0.13 * (this.T.ox - 25), 200, dt);
      if (this.ignited && !hasFuel && this.T.ox < 150) { this.ignited = false; this.event('Gasifier went out - no fuel left'); }

      const g = gasComposition(p.ER, Mbed, this.T.red, fp);
      this.lastGas = g;
      const dryRate = consRate * (1 - Mbed);
      const Qraw = dryRate * g.gasYield;               // Nm3/h
      const gasKW = (Qraw * g.LHV) / 3.6;
      const feedKW = (dryRate * fp.lhv) / 3.6;
      const CGE = feedKW > 0 ? gasKW / feedKW : 0;
      const airKgH = dryRate * g.airKg;
      const charRate = dryRate * charFraction(p.ER, fp.fc) * (0.4 + 0.6 * g.q);
      const ashRate = dryRate * fp.ash;
      this.bins.biochar += (charRate + 0.3 * ashRate) * h;
      this.bins.ash += 0.7 * ashRate * h;
      const co2eRate = charRate * K.C_IN_CHAR * K.STABLE_C * K.CO2_PER_C;
      this.tot.co2e += co2eRate * h;
      const gasOutT = 25 + 0.6 * (this.T.red - 25);
      this.Qcool = (Qraw * K.CP_GAS * Math.max(0, gasOutT - 60)) / 3600 * 0.6;

      // ---- 4-6. Gas cleaning ----
      const dustRaw = 0.8 + 10 * fp.ash;  // g/Nm3
      const tarR = tarRaw(this.T.ox);
      const cyc = { eD: 0.88, eT: 0.05 };
      const dust1 = dustRaw * (1 - cyc.eD), tar1 = tarR * (1 - cyc.eT);
      const waterQ = 1 - 0.5 * smooth(0, p.scrubCap, this.scrubTar);
      const eTs = 0.8 * waterQ, eDs = 0.9;
      const dust2 = dust1 * (1 - eDs), tar2 = tar1 * (1 - eTs);
      this.scrubTar += Qraw * (tar1 - tar2) * h;
      const eTf = 0.9 * (1 - 0.6 * smooth(0.8 * p.filterCap, 1.2 * p.filterCap, this.filterLoad)), eDf = 0.95;
      const tar3 = tar2 * (1 - eTf), dust3 = dust2 * (1 - eDf);
      this.filterLoad += Qraw * (tar2 - tar3 + dust2 - dust3) * h;
      const filterDp = 0.3 + 2.2 * (this.filterLoad / p.filterCap);
      this.bins.dust += (Qraw * (dustRaw - dust1) * h) / 1000;
      const condRate = consRate * Mbed * 0.9; // kg/h steam condensed in scrubber
      this.bins.condensate += condRate * h;
      const tarOutMg = tar3 * 1000;

      // ---- 7. Blower ----
      const bedDp = 1.0 + 0.5 * Math.pow(Qraw / 40, 2);
      const dpTot = bedDp + 0.4 + 0.8 + filterDp; // kPa
      const flowing = Qraw > 0.1;
      const blowerKW = flowing ? 0.12 + ((Qraw / 3600) * dpTot) / 0.45 : 0;
      this.blowerRpm = lag(this.blowerRpm, flowing ? 1500 + 1200 * Math.min(1, Qraw / 60) : 0, 3, dt);
      const pumpKW = flowing ? 0.37 : 0;

      // ---- 9a. Gas holder + flare ----
      const gasOK = g.LHV >= 3.2 && flowing;
      const inRate = gasOK ? Qraw : 0;
      let flareRate = gasOK ? 0 : Qraw;
      if (inRate * h > 0) this.tankLHV = (this.tankLHV * this.tank + g.LHV * inRate * h) / (this.tank + inRate * h);
      this.tank += inRate * h;

      // ---- electrical demand & engine set-point ----
      const loads = this.loadDemand();
      const parKW = shredKW + dryerFanKW + blowerKW + pumpKW + p.controlsKW;
      const room = Math.max(0, (p.socMax - this.soc) * p.batteryKWh);
      const chargeWant = room > 0.05 ? Math.min(p.battMaxKW, room / 0.25) : 0;
      this.Pset = Math.min(p.engineRated, loads.total + parKW + chargeWant);

      // ---- 8. Gas engine + generator ----
      if (!this.engineOn && p.engineEnabled && this.tank >= 0.8 && this.tankLHV >= 3.6) { this.engineOn = true; this.event('Gas engine started'); }
      if (this.engineOn && (!p.engineEnabled || this.tank < 0.05 || this.tankLHV < 3.0)) {
        this.engineOn = false; this.event(this.tank < 0.05 ? 'Engine stopped - gas holder empty' : 'Engine stopped');
      }
      this.Pgen = lag(this.Pgen, this.engineOn ? this.Pset : 0, this.engineOn ? 12 : 3, dt);
      const lf = this.Pgen / p.engineRated;
      const eta = engineEff(Math.max(lf, 0.05), this.tankLHV);
      let fuelKW = this.Pgen > 0.01 ? this.Pgen / eta : 0;
      let gasUse = (fuelKW * 3.6) / Math.max(this.tankLHV, 1);
      if (h > 0 && gasUse * h > this.tank) { const f = this.tank / (gasUse * h); gasUse *= f; fuelKW *= f; this.Pgen *= f; }
      this.tank -= gasUse * h;
      if (this.tank > K.TANK_NM3) { if (h > 0) flareRate += (this.tank - K.TANK_NM3) / h; this.tank = K.TANK_NM3; }
      this.flareShown = lag(this.flareShown, flareRate, 5, Math.max(dt, 1e-3));
      this.rpm = lag(this.rpm, this.engineOn ? 1500 : 0, 2, dt);
      this.Texh = lag(this.Texh, this.engineOn ? 380 + 220 * lf : 25, 30, dt);

      // ---- 9b. Exhaust heat exchanger -> dryer ----
      const Qexh = fuelKW * 0.33;
      this.Qrec = Qexh * p.hxEff;
      const hxOutT = this.Texh - Math.max(0, this.Texh - 120) * p.hxEff;

      // ---- 10. Control panel: bus balance with priority load shedding ----
      const battAvail = this.soc > p.socMin ? p.battMaxKW : 0;
      let avail = this.Pgen + battAvail;
      const servedPar = Math.min(parKW, avail); avail -= servedPar;
      const clinic = loads.clinic > 0 && avail >= loads.clinic ? loads.clinic : 0; avail -= clinic;
      const lampKW = p.lampW / 1000;
      const lampsLit = loads.lamps > 0 ? Math.min(p.streetlights, Math.floor(avail / lampKW + 1e-9)) : 0;
      avail -= lampsLit * lampKW;
      const housesLit = loads.houseKW > 0 ? Math.min(p.houses, Math.floor(avail / loads.houseKW + 1e-9)) : 0;
      const served = clinic + lampsLit * lampKW + housesLit * loads.houseKW;
      let battKW = servedPar + served - this.Pgen; // + = discharge, - = surplus
      let curtailed = 0;
      if (battKW < 0) {
        const ch = Math.min(-battKW, p.battMaxKW, h > 0 ? room / h : p.battMaxKW);
        curtailed = -battKW - ch; battKW = -ch;
      }
      this.soc = clamp(this.soc - ((battKW > 0 ? battKW / 0.95 : battKW * 0.95) * h) / p.batteryKWh, 0, 1);

      // ---- totals ----
      this.tot.feedMJ += (feedKW * dt) / 1000;
      this.tot.gasMJ += (gasKW * dt) / 1000;
      this.tot.elecKWh += this.Pgen * h;
      this.tot.parKWh += servedPar * h;
      this.tot.servedKWh += served * h;
      this.tot.flaredMJ += flareRate * g.LHV * h;
      this.tot.heatRecMJ += ((this.Qrec + this.Qcool) * dt) / 1000;

      // ---- alerts ----
      const alerts = [];
      if (burning && g.LHV < 3.5) alerts.push({ lvl: 'warn', unit: 'gasifier', msg: `Gas quality low (LHV ${g.LHV.toFixed(2)} MJ/Nm³): feed too wet or reduction zone too cold` });
      if (flowing && tarOutMg > 100) alerts.push({ lvl: 'bad', unit: 'filter', msg: `Tar to engine ${tarOutMg.toFixed(0)} mg/Nm³ (limit 100). Change scrubber water / replace filter / raise ER` });
      if (waterQ < 0.65) alerts.push({ lvl: 'warn', unit: 'scrubber', msg: 'Scrubber water saturated with tar. Change water' });
      if (this.filterLoad > 0.8 * p.filterCap) alerts.push({ lvl: 'warn', unit: 'filter', msg: `Filter ${Math.round((100 * this.filterLoad) / p.filterCap)}% loaded, Δp ${filterDp.toFixed(1)} kPa. Replace` });
      if (flareRate > 0.5 && gasOK) alerts.push({ lvl: 'info', unit: 'tank', msg: 'Gas holder full. Surplus gas is being flared' });
      if (flareRate > 0.5 && !gasOK) alerts.push({ lvl: 'info', unit: 'tank', msg: 'Start-up: off-spec gas sent to flare until LHV > 3.2 MJ/Nm³' });
      if (served + 1e-6 < loads.total) alerts.push({ lvl: 'bad', unit: 'village', msg: `Load shedding: ${(loads.total - served).toFixed(2)} kW of village load unserved` });
      if (this.ignited && wet(this.hopper) + wet(this.dryer) < 1 && wet(this.bed) < 10) alerts.push({ lvl: 'warn', unit: 'hopper', msg: 'Fuel running low. Dump more waste into the hopper' });

      // ---- history for charts (every 30 s simulated) ----
      this._histAcc += dt;
      if (this._histAcc >= 30) {
        this._histAcc = 0;
        this.history.push({ t: this.t, Pgen: this.Pgen, served, soc: this.soc, Tox: this.T.ox, LHV: gasOK ? g.LHV : 0, Q: Qraw });
        if (this.history.length > 720) this.history.shift();
      }

      // ---- economics ----
      const rateElec = p.rateElec != null ? p.rateElec : 8;
      const rateBiochar = p.rateBiochar != null ? p.rateBiochar : 25;
      const rateCarbon = p.rateCarbon != null ? p.rateCarbon : 2;
      const rateCost = p.rateCost != null ? p.rateCost : 3;

      const econElec = this.tot.servedKWh * rateElec;
      const econBiochar = this.bins.biochar * rateBiochar;
      const econCarbon = this.tot.co2e * rateCarbon;
      const econCost = this.tot.dumpedKg * rateCost;
      const econProfit = econElec + econBiochar + econCarbon - econCost;

      // ---- SNAPSHOT (the contract with the UI, see CONTRACT.md) ----
      this.s = {
        t: this.t, p,
        hopper: { kg: wet(this.hopper), moisture: moist(this.hopper), lhv: this.hopper.lhv },
        shredder: { on: shredRate > 0, rate: shredRate, kW: shredKW },
        dryer: { kg: wet(this.dryer), mIn: mDryerIn, mOut: moist(this.dryer), target: p.targetMoisture, Qavail, Qused, Qcool: this.Qcool, Qrec: this.Qrec,
                 evapRate, airT: clamp(25 + Qavail * 9, 25, 220), fanKW: dryerFanKW, toBedRate },
        gasifier: { ignited: this.ignited, burning, bedKg: wet(this.bed), bedFill: wet(this.bed) / p.bedCap, moisture: Mbed, feedWet: consRate, feedDry: dryRate,
                    ER: p.ER, airKgH, T: Object.assign({}, this.T), gasOutT, comp: g, LHV: g.LHV, gasYield: g.gasYield, Qraw, gasKW, feedKW, CGE,
                    charRate, ashRate, co2eRate, tarRaw: tarR, dustRaw, q: g.q, ash: fp.ash, fc: fp.fc, lhvDry: fp.lhv },
        cyclone: { dustIn: dustRaw, dustOut: dust1, tarOut: tar1, eff: cyc.eD, Tout: gasOutT - 30, Q: Qraw },
        scrubber: { tarIn: tar1, tarOut: tar2, dustOut: dust2, eff: eTs, waterQ, loadG: this.scrubTar, condRate, pumpKW, Tout: flowing ? 35 : 25, Q: Qraw },
        filter: { tarIn: tar2, tarOutMg, dustOutMg: dust3 * 1000, eff: eTf, dp: filterDp, loadG: this.filterLoad, loadPct: this.filterLoad / p.filterCap, Q: Qraw },
        blower: { Q: Qraw, dp: dpTot, kW: blowerKW, rpm: this.blowerRpm },
        tank: { nm3: this.tank, fill: this.tank / K.TANK_NM3, pressure: 0.5 + 4.5 * (this.tank / K.TANK_NM3), LHV: this.tankLHV, inRate, outRate: gasUse,
                flareRate: this.flareShown, flareKW: (this.flareShown * g.LHV) / 3.6, gasOK,
                mode: !gasOK && flowing ? 'Start-up flare' : flareRate > 0.5 ? 'Full: flaring surplus' : inRate > 0 ? 'Storing gas' : 'Idle' },
        engine: { on: this.engineOn, P: this.Pgen, Pset: this.Pset, rated: p.engineRated, lf, eff: this.Pgen > 0.01 ? eta : 0, fuelKW, gasNm3h: gasUse,
                  rpm: this.rpm, Texh: this.Texh, freq: (this.rpm / 1500) * 50, voltage: this.rpm > 1400 ? 415 : (415 * this.rpm) / 1500 },
        hx: { Tin: this.Texh, Tout: hxOutT, Qexh, Qrec: this.Qrec, eff: p.hxEff },
        panel: { soc: this.soc, socKWh: this.soc * p.batteryKWh, battKW, Pgen: this.Pgen, parasitic: parKW, servedPar, demand: loads.total, served, curtailed,
                 unserved: Math.max(0, loads.total - served), mode: battKW > 0.05 ? 'Battery discharging' : battKW < -0.05 ? 'Battery charging' : 'Balanced' },
        village: { night: p.night, clinicOn: clinic > 0, lampsLit, lampsTotal: p.streetlights, housesLit, housesTotal: p.houses, demand: loads.total, served,
                   servedFrac: loads.total > 0 ? served / loads.total : 1, ledsLit: loads.total > 0 ? Math.round((8 * served) / loads.total) : 0 },
        bins: Object.assign({}, this.bins),
        tot: Object.assign({}, this.tot),
        econ: { electricity: econElec, biochar: econBiochar, carbon: econCarbon, cost: econCost, profit: econProfit },
        alerts,
      };
    }
  }

  WTE.Sim = Sim;
})();
