// OWNER: PERSON B (visualisation)
// Left-hand control panel, KPI strip, forecast box, alarms and event log.
(function () {
  'use strict';
  const WTE = window.WTE;
  const $ = (id) => document.getElementById(id);
  const hms = (t) => [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)].map((n) => String(n).padStart(2, '0')).join(':');

  const Controls = {
    init(sim, app) {
      this.sim = sim; this.app = app;
      const sel = $('feedType');
      sel.innerHTML = Object.entries(WTE.FEEDSTOCKS).map(([k, f]) => `<option value="${k}">${f.name} · M ${(f.moisture * 100).toFixed(0)}% · ${f.lhv} MJ/kg</option>`).join('');
      $('quickKg').innerHTML = [5, 10, 25, 50, 100, 250].map((k) => `<button class="btn" data-kg="${k}">+${k} kg</button>`).join('');
      $('quickKg').onclick = (e) => { const k = e.target.dataset.kg; if (k) sim.dump(+k, sel.value); };
      $('btnDump').onclick = () => sim.dump(+$('feedKg').value, sel.value);
      sel.onchange = () => { WTE.Hardware.type = sel.value; this.forecast(); };
      $('feedKg').oninput = () => this.forecast();

      const slider = (id, key, fmt) => {
        const el = $(id), out = $(id + 'Val');
        el.value = sim.p[key]; out.textContent = fmt(sim.p[key]);
        el.oninput = () => {
          sim.set(key, +el.value);
          out.textContent = fmt(+el.value);
          this.forecast();
          this.syncTuningInput(key, +el.value);
        };
      };
      slider('er', 'ER', (v) => v.toFixed(2));
      slider('mt', 'targetMoisture', (v) => (v * 100).toFixed(0) + '%');
      slider('fr', 'feedRate', (v) => v + ' kg/h');
      slider('sl', 'streetlights', (v) => v);
      slider('ho', 'houses', (v) => v);
      $('autoFeed').onchange = (e) => {
        const mode = e.target.checked ? 'auto' : 'manual';
        sim.set('feedMode', mode);
        $('manualWrap').style.display = e.target.checked ? 'none' : '';
        this.syncTuningInput('feedMode', mode);
      };
      $('manualWrap').style.display = 'none';
      $('engEnable').onchange = (e) => {
        sim.set('engineEnabled', e.target.checked);
        this.syncTuningInput('engineEnabled', e.target.checked);
      };
      $('btnIgnite').onclick = () => sim.ignite();
      $('btnStop').onclick = () => sim.shutdown();
      $('btnNight').onclick = () => {
        sim.set('night', !sim.p.night);
        $('btnNight').textContent = sim.p.night ? '🌙 Night' : '☀️ Day';
        this.syncTuningInput('night', sim.p.night);
      };
      $('btnSerial').onclick = () => WTE.Hardware.connect(sim);
      $('kgPerGram').oninput = (e) => (WTE.Hardware.kgPerGram = +e.target.value || 0.5);
      $('btnPlay').onclick = () => { app.playing = !app.playing; $('btnPlay').textContent = app.playing ? '⏸ Pause' : '▶ Play'; };
      $('speed').onchange = (e) => (app.speed = +e.target.value);
      $('btnDemo').onclick = () => this.toggleDemo();
      $('btnReset').onclick = () => { this.stopDemo(); sim.reset(); this.forecast(); };
      $('alerts').onclick = (e) => { const u = e.target.closest('li')?.dataset.unit; if (u) app.select(u); };

      // Initialize Tuning & Monitor
      this.initTuning();
      this.initMonitor();

      // Tab switcher for Tuning & Monitor
      document.querySelectorAll('.tm-tab-btn').forEach((btn) => {
        btn.onclick = () => {
          document.querySelectorAll('.tm-tab-btn').forEach((b) => b.classList.remove('active'));
          document.querySelectorAll('.tm-tab-pane').forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          const pane = btn.dataset.tab === 'tuning' ? $('tabTuning') : $('tabMonitor');
          if (pane) pane.classList.add('active');
        };
      });

      const btnRestore = $('btnRestoreDefaults');
      if (btnRestore) btnRestore.onclick = () => this.restoreDefaults();

      const btnCsv = $('btnDownloadCsv');
      if (btnCsv) btnCsv.onclick = () => this.downloadCsv();

      this.forecast();
    },

    toggleDemo() {
      if (this.demoActive) {
        this.stopDemo();
      } else {
        this.startDemo();
      }
    },

    startDemo() {
      this.stopDemo();
      this.demoActive = true;

      // 1. Reset simulation, dump 50 kg of wood chips, set speed to 300x (and update dropdown)
      if (!this.app.playing) {
        this.app.playing = true;
        $('btnPlay').textContent = '⏸ Pause';
      }
      this.sim.reset();
      this.app.speed = 300;
      $('speed').value = '300';
      $('feedType').value = 'wood';
      $('feedKg').value = 50;
      this.sim.dump(50, 'wood');
      this.forecast();

      const btn = $('btnDemo');
      if (btn) {
        btn.textContent = '⏹ Stop Demo';
        btn.classList.add('active');
      }

      // 2. Open inspector for units in order: gasifier → tank → engine → hx → panel → village → bins, then close
      const steps = [
        {
          unit: 'gasifier',
          label: 'Step 1/7 · Gasifier',
          caption: 'The gasifier turns waste into fuel gas using only 28% of the air needed to burn it.',
        },
        {
          unit: 'tank',
          label: 'Step 2/7 · Gas Holder & Flare',
          caption: 'The gas holder stores clean fuel gas and flares off-spec startup gas until quality is high.',
        },
        {
          unit: 'engine',
          label: 'Step 3/7 · Engine & Generator',
          caption: 'The gas engine combusts producer gas to drive the generator and produce electrical power.',
        },
        {
          unit: 'hx',
          label: 'Step 4/7 · Heat Exchanger',
          caption: 'The heat exchanger captures waste heat from the engine exhaust to dry incoming biomass.',
        },
        {
          unit: 'panel',
          label: 'Step 5/7 · Control Panel & Battery',
          caption: 'The control panel manages power priority: plant auxiliary → clinic → streetlights → homes.',
        },
        {
          unit: 'village',
          label: 'Step 6/7 · Village Microgrid',
          caption: 'The village streetlights and clinic stay lit with clean power for as long as fuel energy lasts.',
        },
        {
          unit: 'bins',
          label: 'Step 7/7 · Biochar & Ash Bins',
          caption: 'Biochar from the gasifier enriches agricultural soil and permanently locks away carbon.',
        },
      ];

      let idx = 0;
      const cap = $('demoCaption');
      const showStep = (i) => {
        const s = steps[i];
        this.app.select(s.unit);
        if (cap) {
          cap.style.display = 'block';
          cap.innerHTML = `<span class="demo-step">${s.label}</span>${s.caption}`;
        }
      };

      showStep(0);

      this.demoTimer = setInterval(() => {
        idx++;
        if (idx < steps.length) {
          showStep(idx);
        } else {
          this.stopDemo();
        }
      }, 6000);
    },

    stopDemo() {
      if (this.demoTimer) {
        clearInterval(this.demoTimer);
        this.demoTimer = null;
      }
      this.demoActive = false;
      const btn = $('btnDemo');
      if (btn) {
        btn.textContent = '▶ Guided Demo';
        btn.classList.remove('active');
      }
      const cap = $('demoCaption');
      if (cap) {
        cap.style.display = 'none';
        cap.innerHTML = '';
      }
      WTE.Inspector.close();
    },

    forecast() {
      const kg = +$('feedKg').value || 0, type = $('feedType').value;
      const f = WTE.forecast(kg, type, this.sim.p);
      const h = f.allLampsHours;
      $('forecast').innerHTML = kg > 0
        ? `<div>${kg} kg → <span class="big">${f.netKWh.toFixed(1)} kWh</span> net electricity</div>
           <div>= all <b>${this.sim.p.streetlights} LED streetlights</b> for <b>${h >= 1 ? h.toFixed(1) + ' h' : (h * 60).toFixed(0) + ' min'}</b></div>
           <div>= one 60 W LED for <b>${f.oneLampHours.toFixed(0)} h</b> · ${f.homeDays.toFixed(1)} home-days</div>
           <div class="muted">gas ${f.gasNm3.toFixed(0)} Nm³ · η_cg ${(f.cge * 100).toFixed(0)}% · biochar <b style="color:#3ddc84">${f.biochar.toFixed(1)} kg</b> · locks ${f.co2e.toFixed(1)} kg CO₂</div>`
        : 'Enter a weight to see the forecast.';
    },

    update(s) {
      $('simTime').textContent = hms(s.t);
      const k = (lbl, val, unit, frac, col) => `<div class="kpi"><small>${lbl}</small><b style="color:${col || 'inherit'}">${val}<i>${unit}</i></b>${frac != null ? `<div class="bar"><span style="width:${Math.max(0, Math.min(100, frac * 100))}%;background:${col || ''}"></span></div>` : ''}</div>`;
      $('kpis').innerHTML = [
        k('Waste in system', (s.hopper.kg + s.dryer.kg + s.gasifier.bedKg).toFixed(1), 'kg', null, '#c08a4a'),
        k('Gasifier T_ox', s.gasifier.T.ox.toFixed(0), '°C', s.gasifier.T.ox / 1300, WTE.tempColor(Math.max(400, s.gasifier.T.ox))),
        k('Producer gas', s.gasifier.Qraw.toFixed(1), 'Nm³/h', s.gasifier.Qraw / 80, '#5fd0c8'),
        k('Gas LHV', s.gasifier.LHV.toFixed(2), 'MJ/Nm³', s.gasifier.LHV / 6.5, '#5fd0c8'),
        k('Generator', s.engine.P.toFixed(2), 'kWe', s.engine.P / s.engine.rated, '#ffd23f'),
        k('Battery', (s.panel.soc * 100).toFixed(0), '%', s.panel.soc, s.panel.soc < 0.15 ? '#ff4d5e' : '#6aa8ff'),
        k('Lights on', `${s.village.lampsLit}/${s.village.lampsTotal}`, s.village.night ? '' : ' (day)', s.village.lampsTotal ? s.village.lampsLit / s.village.lampsTotal : 0, '#ffd23f'),
        k('Energy delivered', s.tot.servedKWh.toFixed(1), 'kWh', null, '#3ddc84'),
        k('Biochar', s.bins.biochar.toFixed(2), 'kg', null, '#3ddc84'),
        k('CO₂ locked', s.tot.co2e.toFixed(1), 'kg', null, '#3ddc84'),
      ].join('');
      $('villageSub').textContent = `${s.village.served.toFixed(2)} / ${s.village.demand.toFixed(2)} kW served`;
      const al = s.alerts.length ? s.alerts : [{ lvl: 'ok', msg: 'All systems normal' }];
      $('alerts').innerHTML = al.map((a) => `<li class="${a.lvl}" ${a.unit ? `data-unit="${a.unit}"` : ''}>${a.msg}</li>`).join('');
      $('log').innerHTML = this.sim.log.slice(0, 30).map((l) => `<li><b>${hms(l.t)}</b>${l.msg}</li>`).join('');
      const hw = WTE.Hardware;
      $('hwStatus').textContent = hw.connected ? `${hw.status} · scale ${hw.grams.toFixed(0)} g · LEDs ${s.village.ledsLit}/8` : hw.status;

      // Economics card
      const ec = s.econ;
      if (ec && $('econGrid')) {
        const profitPos = ec.profit >= 0;
        const profitSign = profitPos ? '+' : '-';
        const profitFmt = `${profitSign}₹${Math.abs(ec.profit).toFixed(2)}`;
        if ($('econProfitTag')) {
          $('econProfitTag').textContent = `Profit: ${profitFmt}`;
          $('econProfitTag').className = `tag-pill ${profitPos ? 'pos' : 'neg'}`;
        }
        $('econGrid').innerHTML = [
          `<div class="econ-item"><small>⚡ Electricity revenue</small><b>₹${ec.electricity.toFixed(2)}</b><span class="sub">@ ₹${s.p.rateElec}/kWh · ${s.tot.servedKWh.toFixed(1)} kWh</span></div>`,
          `<div class="econ-item"><small>🌱 Biochar revenue</small><b>₹${ec.biochar.toFixed(2)}</b><span class="sub">@ ₹${s.p.rateBiochar}/kg · ${s.bins.biochar.toFixed(2)} kg</span></div>`,
          `<div class="econ-item"><small>🌍 Carbon credits</small><b>₹${ec.carbon.toFixed(2)}</b><span class="sub">@ ₹${s.p.rateCarbon}/kg · ${s.tot.co2e.toFixed(1)} kg</span></div>`,
          `<div class="econ-item"><small>⚙️ Feedstock cost</small><b style="color:#ff8585">₹${ec.cost.toFixed(2)}</b><span class="sub">@ ₹${s.p.rateCost}/kg · ${s.tot.dumpedKg.toFixed(1)} kg</span></div>`,
          `<div class="econ-item profit ${profitPos ? 'pos' : 'neg'}"><small>📈 Net profit</small><b>${profitFmt}</b><span class="sub">${profitPos ? 'Operating surplus' : 'Initial investment stage'}</span></div>`,
        ].join('');
      }

      // Telemetry Monitor update (4 Hz)
      this.updateMonitor(s);
    },

    initTuning() {
      const grid = $('tuningGrid');
      if (!grid) return;
      const sim = this.sim;
      grid.innerHTML = '';

      const META = {
        ER: { label: 'Equivalence ratio (ER)', type: 'number', step: 0.01, min: 0.1, max: 0.6 },
        targetMoisture: { label: 'Dryer target moisture (0-1)', type: 'number', step: 0.01, min: 0.01, max: 0.4 },
        feedMode: { label: 'Feed control mode', type: 'select', options: ['auto', 'manual'] },
        feedRate: { label: 'Manual feed rate (kg/h)', type: 'number', step: 1, min: 1, max: 100 },
        minFeed: { label: 'Min feed rate (kg/h)', type: 'number', step: 1, min: 1, max: 50 },
        maxFeed: { label: 'Max feed rate (kg/h)', type: 'number', step: 1, min: 5, max: 100 },
        autoStart: { label: 'Auto-start gasifier', type: 'boolean' },
        engineEnabled: { label: 'Engine enabled', type: 'boolean' },
        shredderRate: { label: 'Shredder rate (kg/h)', type: 'number', step: 1, min: 10, max: 200 },
        shredderKW: { label: 'Shredder power (kW)', type: 'number', step: 0.1, min: 0.1, max: 10 },
        dryerCap: { label: 'Dryer capacity (kg)', type: 'number', step: 1, min: 5, max: 100 },
        bedCap: { label: 'Gasifier bed capacity (kg)', type: 'number', step: 1, min: 10, max: 200 },
        bedFeedRate: { label: 'Bed feed rate (kg/h)', type: 'number', step: 5, min: 20, max: 300 },
        scrubCap: { label: 'Scrubber tar capacity (g)', type: 'number', step: 10, min: 50, max: 1000 },
        filterCap: { label: 'Filter capacity (g)', type: 'number', step: 5, min: 10, max: 500 },
        engineRated: { label: 'Generator rated power (kWe)', type: 'number', step: 0.5, min: 1, max: 100 },
        hxEff: { label: 'Heat exchanger efficiency', type: 'number', step: 0.01, min: 0.1, max: 0.99 },
        batteryKWh: { label: 'Battery capacity (kWh)', type: 'number', step: 1, min: 1, max: 200 },
        battMaxKW: { label: 'Max battery power (kW)', type: 'number', step: 0.5, min: 1, max: 50 },
        socMin: { label: 'Min battery SOC fraction', type: 'number', step: 0.01, min: 0.01, max: 0.5 },
        socMax: { label: 'Max battery SOC fraction', type: 'number', step: 0.01, min: 0.5, max: 1.0 },
        controlsKW: { label: 'Controls parasitic (kW)', type: 'number', step: 0.01, min: 0.01, max: 2 },
        streetlights: { label: 'Streetlights count', type: 'number', step: 1, min: 0, max: 100 },
        lampW: { label: 'Streetlight power (W)', type: 'number', step: 5, min: 10, max: 200 },
        houses: { label: 'Village houses count', type: 'number', step: 1, min: 0, max: 100 },
        houseW: { label: 'House power (W)', type: 'number', step: 10, min: 50, max: 2000 },
        clinicW: { label: 'Clinic power (W)', type: 'number', step: 50, min: 100, max: 5000 },
        night: { label: 'Night mode active', type: 'boolean' },
        rateElec: { label: 'Electricity rate (₹/kWh)', type: 'number', step: 0.5, min: 0, max: 50 },
        rateBiochar: { label: 'Biochar rate (₹/kg)', type: 'number', step: 1, min: 0, max: 100 },
        rateCarbon: { label: 'Carbon credit rate (₹/kg)', type: 'number', step: 0.5, min: 0, max: 50 },
        rateCost: { label: 'Feedstock cost (₹/kg)', type: 'number', step: 0.5, min: 0, max: 50 },
      };

      Object.entries(WTE.DEFAULTS).forEach(([key, defaultVal]) => {
        const meta = META[key] || { label: key, type: typeof defaultVal === 'boolean' ? 'boolean' : 'number' };
        const curVal = sim.p[key] !== undefined ? sim.p[key] : defaultVal;
        const item = document.createElement('div');
        item.className = `tuning-item ${meta.type === 'boolean' ? 'checkbox' : ''}`;

        if (meta.type === 'boolean') {
          item.innerHTML = `
            <label for="tune_${key}">${meta.label}</label>
            <input id="tune_${key}" type="checkbox" ${curVal ? 'checked' : ''}>
          `;
          const input = item.querySelector('input');
          input.onchange = () => {
            sim.set(key, input.checked);
            this.syncLeftPanel(key, input.checked);
          };
        } else if (meta.type === 'select') {
          item.innerHTML = `
            <label for="tune_${key}">${meta.label}</label>
            <select id="tune_${key}">
              ${meta.options.map((o) => `<option value="${o}" ${o === curVal ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          `;
          const select = item.querySelector('select');
          select.onchange = () => {
            sim.set(key, select.value);
            this.syncLeftPanel(key, select.value);
          };
        } else {
          item.innerHTML = `
            <label for="tune_${key}">${meta.label}</label>
            <input id="tune_${key}" type="number" value="${curVal}" step="${meta.step || 1}" ${meta.min !== undefined ? `min="${meta.min}"` : ''} ${meta.max !== undefined ? `max="${meta.max}"` : ''}>
          `;
          const input = item.querySelector('input');
          input.oninput = () => {
            const v = +input.value;
            if (!Number.isNaN(v)) {
              sim.set(key, v);
              this.syncLeftPanel(key, v);
            }
          };
        }
        grid.appendChild(item);
      });
    },

    syncLeftPanel(key, val) {
      if (key === 'ER') {
        const el = $('er'); if (el) { el.value = val; $('erVal').textContent = Number(val).toFixed(2); }
      } else if (key === 'targetMoisture') {
        const el = $('mt'); if (el) { el.value = val; $('mtVal').textContent = (Number(val) * 100).toFixed(0) + '%'; }
      } else if (key === 'feedRate') {
        const el = $('fr'); if (el) { el.value = val; $('frVal').textContent = val + ' kg/h'; }
      } else if (key === 'streetlights') {
        const el = $('sl'); if (el) { el.value = val; $('slVal').textContent = val; }
      } else if (key === 'houses') {
        const el = $('ho'); if (el) { el.value = val; $('hoVal').textContent = val; }
      } else if (key === 'feedMode') {
        const auto = val === 'auto';
        const el = $('autoFeed'); if (el) el.checked = auto;
        const wrap = $('manualWrap'); if (wrap) wrap.style.display = auto ? 'none' : '';
      } else if (key === 'engineEnabled') {
        const el = $('engEnable'); if (el) el.checked = !!val;
      } else if (key === 'night') {
        const btn = $('btnNight'); if (btn) btn.textContent = val ? '🌙 Night' : '☀️ Day';
      }
      this.forecast();
    },

    syncTuningInput(key, val) {
      const el = $(`tune_${key}`);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!val;
      } else {
        el.value = val;
      }
    },

    restoreDefaults() {
      Object.entries(WTE.DEFAULTS).forEach(([k, v]) => {
        this.sim.set(k, v);
        this.syncTuningInput(k, v);
        this.syncLeftPanel(k, v);
      });
      this.forecast();
    },

    downloadCsv() {
      const hms = (t) => [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)].map((n) => String(n).padStart(2, '0')).join(':');
      const headers = ['time_s', 'time_hms', 'Pgen_kW', 'served_kW', 'soc_pct', 'Tox_C', 'LHV_MJ_Nm3', 'gas_flow_Nm3_h'];
      const rows = (this.sim.history || []).map((h) => [
        h.t.toFixed(0),
        hms(h.t),
        h.Pgen.toFixed(2),
        h.served.toFixed(2),
        (h.soc * 100).toFixed(1),
        h.Tox.toFixed(1),
        h.LHV.toFixed(2),
        h.Q.toFixed(2),
      ]);
      if (rows.length === 0 && this.sim.s) {
        const s = this.sim.s;
        rows.push([
          s.t.toFixed(0),
          hms(s.t),
          s.engine.P.toFixed(2),
          s.village.served.toFixed(2),
          (s.panel.soc * 100).toFixed(1),
          s.gasifier.T.ox.toFixed(1),
          s.gasifier.LHV.toFixed(2),
          s.gasifier.Qraw.toFixed(2),
        ]);
      }
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wte_microgrid_history_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },

    initMonitor() {
      const tbody = $('monitorBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      this.monitorUpdaters = [];

      const GROUPS = [
        {
          title: '① Feed Hopper & Shredder',
          items: [
            ['Hopper', 'Biomass mass', (s) => s.hopper.kg.toFixed(1), 'kg'],
            ['Hopper', 'Moisture (as dumped)', (s) => (s.hopper.moisture * 100).toFixed(1), '%'],
            ['Hopper', 'Lower heating value (dry)', (s) => s.hopper.lhv.toFixed(1), 'MJ/kg'],
            ['Shredder', 'Operating state', (s) => s.shredder.on ? 'RUNNING' : 'IDLE', '-'],
            ['Shredder', 'Throughput rate', (s) => s.shredder.rate.toFixed(0), 'kg/h'],
            ['Shredder', 'Motor power', (s) => s.shredder.kW.toFixed(2), 'kW'],
          ],
        },
        {
          title: '② Biomass Dryer',
          items: [
            ['Dryer', 'Inventory mass', (s) => s.dryer.kg.toFixed(1), 'kg'],
            ['Dryer', 'Inlet moisture', (s) => (s.dryer.mIn * 100).toFixed(1), '%'],
            ['Dryer', 'Outlet moisture', (s) => (s.dryer.mOut * 100).toFixed(1), '%'],
            ['Dryer', 'Target moisture set-point', (s) => (s.dryer.target * 100).toFixed(0), '%'],
            ['Dryer', 'Hot air temperature', (s) => s.dryer.airT.toFixed(0), '°C'],
            ['Dryer', 'Available waste heat', (s) => s.dryer.Qavail.toFixed(2), 'kW'],
            ['Dryer', 'Heat from engine exhaust HX', (s) => s.dryer.Qrec.toFixed(2), 'kW'],
            ['Dryer', 'Heat from gas cooler', (s) => s.dryer.Qcool.toFixed(2), 'kW'],
            ['Dryer', 'Water evaporation rate', (s) => s.dryer.evapRate.toFixed(2), 'kg/h'],
            ['Dryer', 'Discharge rate to gasifier', (s) => s.dryer.toBedRate.toFixed(1), 'kg/h'],
            ['Dryer', 'Circulation fan power', (s) => s.dryer.fanKW.toFixed(2), 'kW'],
          ],
        },
        {
          title: '③ Downdraft Gasifier',
          items: [
            ['Gasifier', 'Ignition status', (s) => s.gasifier.ignited ? 'IGNITED' : 'COLD', '-'],
            ['Gasifier', 'Active combustion in bed', (s) => s.gasifier.burning ? 'YES' : 'NO', '-'],
            ['Gasifier', 'Active bed inventory', (s) => s.gasifier.bedKg.toFixed(1), 'kg'],
            ['Gasifier', 'Bed fill capacity fraction', (s) => (s.gasifier.bedFill * 100).toFixed(0), '%'],
            ['Gasifier', 'Bed moisture fraction', (s) => (s.gasifier.moisture * 100).toFixed(1), '%'],
            ['Gasifier', 'Wet fuel feed rate', (s) => s.gasifier.feedWet.toFixed(1), 'kg/h'],
            ['Gasifier', 'Dry fuel feed rate', (s) => s.gasifier.feedDry.toFixed(1), 'kg/h'],
            ['Gasifier', 'Equivalence ratio (ER)', (s) => s.gasifier.ER.toFixed(2), '-'],
            ['Gasifier', 'Primary combustion air flow', (s) => s.gasifier.airKgH.toFixed(1), 'kg/h'],
            ['Gasifier', 'Drying zone temperature', (s) => s.gasifier.T.dry.toFixed(0), '°C'],
            ['Gasifier', 'Pyrolysis zone temperature', (s) => s.gasifier.T.pyro.toFixed(0), '°C'],
            ['Gasifier', 'Oxidation zone temperature', (s) => s.gasifier.T.ox.toFixed(0), '°C'],
            ['Gasifier', 'Reduction zone temperature', (s) => s.gasifier.T.red.toFixed(0), '°C'],
            ['Gasifier', 'Producer gas exit temperature', (s) => s.gasifier.gasOutT.toFixed(0), '°C'],
            ['Gasifier', 'Carbon monoxide (CO)', (s) => s.gasifier.comp.CO.toFixed(1), '%'],
            ['Gasifier', 'Hydrogen (H₂)', (s) => s.gasifier.comp.H2.toFixed(1), '%'],
            ['Gasifier', 'Methane (CH₄)', (s) => s.gasifier.comp.CH4.toFixed(1), '%'],
            ['Gasifier', 'Carbon dioxide (CO₂)', (s) => s.gasifier.comp.CO2.toFixed(1), '%'],
            ['Gasifier', 'Nitrogen (N₂)', (s) => s.gasifier.comp.N2.toFixed(1), '%'],
            ['Gasifier', 'Gas lower heating value (LHV)', (s) => s.gasifier.LHV.toFixed(2), 'MJ/Nm³'],
            ['Gasifier', 'Specific gas yield', (s) => s.gasifier.gasYield.toFixed(2), 'Nm³/kg'],
            ['Gasifier', 'Raw gas generation flow', (s) => s.gasifier.Qraw.toFixed(1), 'Nm³/h'],
            ['Gasifier', 'Gas chemical power', (s) => s.gasifier.gasKW.toFixed(1), 'kW'],
            ['Gasifier', 'Biomass chemical input', (s) => s.gasifier.feedKW.toFixed(1), 'kW'],
            ['Gasifier', 'Cold-gas efficiency (CGE)', (s) => (s.gasifier.CGE * 100).toFixed(1), '%'],
            ['Gasifier', 'Biochar production rate', (s) => s.gasifier.charRate.toFixed(2), 'kg/h'],
            ['Gasifier', 'Ash production rate', (s) => s.gasifier.ashRate.toFixed(2), 'kg/h'],
            ['Gasifier', 'Raw tar concentration', (s) => s.gasifier.tarRaw.toFixed(2), 'g/Nm³'],
            ['Gasifier', 'Raw dust concentration', (s) => s.gasifier.dustRaw.toFixed(2), 'g/Nm³'],
          ],
        },
        {
          title: '④ Gas Cleaning Train',
          items: [
            ['Cyclone', 'Inlet particulate dust', (s) => s.cyclone.dustIn.toFixed(2), 'g/Nm³'],
            ['Cyclone', 'Outlet particulate dust', (s) => s.cyclone.dustOut.toFixed(2), 'g/Nm³'],
            ['Cyclone', 'Separation efficiency', (s) => (s.cyclone.eff * 100).toFixed(0), '%'],
            ['Cyclone', 'Gas exit temperature', (s) => s.cyclone.Tout.toFixed(0), '°C'],
            ['Scrubber', 'Inlet tar concentration', (s) => s.scrubber.tarIn.toFixed(2), 'g/Nm³'],
            ['Scrubber', 'Outlet tar concentration', (s) => s.scrubber.tarOut.toFixed(2), 'g/Nm³'],
            ['Scrubber', 'Water quality rating', (s) => (s.scrubber.waterQ * 100).toFixed(0), '%'],
            ['Scrubber', 'Accumulated tar sludge', (s) => s.scrubber.loadG.toFixed(1), 'g'],
            ['Scrubber', 'Condensate separation rate', (s) => s.scrubber.condRate.toFixed(2), 'kg/h'],
            ['Scrubber', 'Recirculation pump power', (s) => s.scrubber.pumpKW.toFixed(2), 'kW'],
            ['Filter', 'Clean gas tar to engine', (s) => s.filter.tarOutMg.toFixed(1), 'mg/Nm³'],
            ['Filter', 'Clean gas dust to engine', (s) => s.filter.dustOutMg.toFixed(1), 'mg/Nm³'],
            ['Filter', 'Differential pressure Δp', (s) => s.filter.dp.toFixed(2), 'kPa'],
            ['Filter', 'Particulate load capacity', (s) => (s.filter.loadPct * 100).toFixed(0), '%'],
            ['Blower', 'Suction volume flow', (s) => s.blower.Q.toFixed(1), 'Nm³/h'],
            ['Blower', 'Total train pressure differential', (s) => s.blower.dp.toFixed(2), 'kPa'],
            ['Blower', 'Impeller speed', (s) => s.blower.rpm.toFixed(0), 'RPM'],
            ['Blower', 'Motor power draw', (s) => s.blower.kW.toFixed(2), 'kW'],
          ],
        },
        {
          title: '⑤ Gas Holder & Flare',
          items: [
            ['Tank', 'Stored gas inventory', (s) => s.tank.nm3.toFixed(2), 'Nm³'],
            ['Tank', 'Gas holder fill percentage', (s) => (s.tank.fill * 100).toFixed(0), '%'],
            ['Tank', 'Internal gas pressure', (s) => s.tank.pressure.toFixed(2), 'kPa (g)'],
            ['Tank', 'Stored gas heating value', (s) => s.tank.LHV.toFixed(2), 'MJ/Nm³'],
            ['Tank', 'Producer gas inflow rate', (s) => s.tank.inRate.toFixed(1), 'Nm³/h'],
            ['Tank', 'Engine fuel gas outflow rate', (s) => s.tank.outRate.toFixed(1), 'Nm³/h'],
            ['Flare', 'Surplus/startup flaring rate', (s) => s.tank.flareRate.toFixed(1), 'Nm³/h'],
            ['Flare', 'Flared thermal power', (s) => s.tank.flareKW.toFixed(1), 'kW'],
            ['Tank', 'Gas quality interlock state', (s) => s.tank.gasOK ? 'OK' : 'OFF-SPEC', '-'],
            ['Tank', 'Operating status mode', (s) => s.tank.mode, '-'],
          ],
        },
        {
          title: '⑥ Gas Engine, Generator & Heat Exchanger',
          items: [
            ['Engine', 'Operating status', (s) => s.engine.on ? 'RUNNING' : 'STOPPED', '-'],
            ['Engine', 'Electrical generation output', (s) => s.engine.P.toFixed(2), 'kWe'],
            ['Engine', 'Governor power setpoint', (s) => s.engine.Pset.toFixed(2), 'kW'],
            ['Engine', 'Rated alternator capacity', (s) => s.engine.rated.toFixed(1), 'kWe'],
            ['Engine', 'Engine load factor', (s) => (s.engine.lf * 100).toFixed(0), '%'],
            ['Engine', 'Thermal-to-electric efficiency', (s) => (s.engine.eff * 100).toFixed(1), '%'],
            ['Engine', 'Fuel chemical energy consumption', (s) => s.engine.fuelKW.toFixed(1), 'kW'],
            ['Engine', 'Fuel gas volumetric usage', (s) => s.engine.gasNm3h.toFixed(1), 'Nm³/h'],
            ['Engine', 'Crankshaft rotational speed', (s) => s.engine.rpm.toFixed(0), 'RPM'],
            ['Engine', 'Exhaust manifold temperature', (s) => s.engine.Texh.toFixed(0), '°C'],
            ['Engine', 'AC bus frequency', (s) => s.engine.freq.toFixed(1), 'Hz'],
            ['Engine', 'AC line terminal voltage', (s) => s.engine.voltage.toFixed(0), 'V'],
            ['HX', 'Exhaust gas inlet temperature', (s) => s.hx.Tin.toFixed(0), '°C'],
            ['HX', 'Exhaust gas outlet temperature', (s) => s.hx.Tout.toFixed(0), '°C'],
            ['HX', 'Available exhaust thermal power', (s) => s.hx.Qexh.toFixed(2), 'kW'],
            ['HX', 'Recovered heat directed to dryer', (s) => s.hx.Qrec.toFixed(2), 'kW'],
            ['HX', 'Heat exchanger thermal effectiveness', (s) => (s.hx.eff * 100).toFixed(0), '%'],
          ],
        },
        {
          title: '⑦ Electrical Panel & Battery Storage',
          items: [
            ['Panel', 'Battery state of charge (SOC)', (s) => (s.panel.soc * 100).toFixed(1), '%'],
            ['Panel', 'Battery stored energy', (s) => s.panel.socKWh.toFixed(1), 'kWh'],
            ['Panel', 'Battery net power (+dis / -chg)', (s) => s.panel.battKW.toFixed(2), 'kW'],
            ['Panel', 'Generator active power', (s) => s.panel.Pgen.toFixed(2), 'kW'],
            ['Panel', 'Plant internal parasitic load', (s) => s.panel.parasitic.toFixed(2), 'kW'],
            ['Panel', 'Total microgrid load demand', (s) => s.panel.demand.toFixed(2), 'kW'],
            ['Panel', 'Total active power served', (s) => s.panel.served.toFixed(2), 'kW'],
            ['Panel', 'Surplus power curtailed', (s) => s.panel.curtailed.toFixed(2), 'kW'],
            ['Panel', 'Unserved deficit load', (s) => s.panel.unserved.toFixed(2), 'kW'],
            ['Panel', 'Electrical dispatch mode', (s) => s.panel.mode, '-'],
          ],
        },
        {
          title: '⑧ Village Microgrid',
          items: [
            ['Village', 'Day / Night cycle status', (s) => s.village.night ? 'NIGHT' : 'DAY', '-'],
            ['Village', 'Healthcare clinic state', (s) => s.village.clinicOn ? 'POWERED' : 'OFF', '-'],
            ['Village', 'Active LED streetlights', (s) => `${s.village.lampsLit} / ${s.village.lampsTotal}`, 'lamps'],
            ['Village', 'Powered rural homes', (s) => `${s.village.housesLit} / ${s.village.housesTotal}`, 'homes'],
            ['Village', 'Load served satisfaction', (s) => (s.village.servedFrac * 100).toFixed(0), '%'],
            ['Village', 'Hardware mirror LEDs lit', (s) => `${s.village.ledsLit} / 8`, 'LEDs'],
          ],
        },
        {
          title: '⑨ Residual Bins & Cumulative Totals',
          items: [
            ['Bins', 'Biochar collected in bin', (s) => s.bins.biochar.toFixed(2), 'kg'],
            ['Bins', 'Ash collected in bin', (s) => s.bins.ash.toFixed(2), 'kg'],
            ['Bins', 'Cyclone dust collected', (s) => s.bins.dust.toFixed(2), 'kg'],
            ['Bins', 'Scrubber condensate collected', (s) => s.bins.condensate.toFixed(2), 'kg'],
            ['Bins', 'Scrubber tar sludge collected', (s) => s.bins.tarSludge.toFixed(2), 'kg'],
            ['Totals', 'Total waste dumped into plant', (s) => s.tot.dumpedKg.toFixed(1), 'kg'],
            ['Totals', 'Biomass chemical energy fed', (s) => s.tot.feedMJ.toFixed(1), 'MJ'],
            ['Totals', 'Producer gas energy synthesized', (s) => s.tot.gasMJ.toFixed(1), 'MJ'],
            ['Totals', 'Gross electricity generated', (s) => s.tot.elecKWh.toFixed(2), 'kWh'],
            ['Totals', 'Plant parasitic energy consumed', (s) => s.tot.parKWh.toFixed(2), 'kWh'],
            ['Totals', 'Net delivered microgrid electricity', (s) => s.tot.servedKWh.toFixed(2), 'kWh'],
            ['Totals', 'Exhaust & cooler heat recovered', (s) => s.tot.heatRecMJ.toFixed(1), 'MJ'],
            ['Totals', 'Permanent CO₂ locked into soil', (s) => s.tot.co2e.toFixed(1), 'kg'],
          ],
        },
        {
          title: '⑩ Microgrid Economics & Financials',
          items: [
            ['Economics', 'Electricity revenue', (s) => '₹' + s.econ.electricity.toFixed(2), '₹'],
            ['Economics', 'Biochar revenue', (s) => '₹' + s.econ.biochar.toFixed(2), '₹'],
            ['Economics', 'Carbon offset credits', (s) => '₹' + s.econ.carbon.toFixed(2), '₹'],
            ['Economics', 'Feedstock collection cost', (s) => '₹' + s.econ.cost.toFixed(2), '₹'],
            ['Economics', 'Net financial profit', (s) => (s.econ.profit >= 0 ? '+' : '-') + '₹' + Math.abs(s.econ.profit).toFixed(2), '₹'],
          ],
        },
      ];

      GROUPS.forEach((g) => {
        const hRow = document.createElement('tr');
        hRow.className = 'group-row';
        hRow.innerHTML = `<td colspan="4">${g.title}</td>`;
        tbody.appendChild(hRow);

        g.items.forEach(([subsystem, param, getVal, unit]) => {
          const row = document.createElement('tr');
          const tdSub = document.createElement('td'); tdSub.textContent = subsystem;
          const tdParam = document.createElement('td'); tdParam.textContent = param;
          const tdVal = document.createElement('td'); tdVal.className = 'num'; tdVal.textContent = '-';
          const tdUnit = document.createElement('td'); tdUnit.className = 'unit'; tdUnit.textContent = unit;

          row.appendChild(tdSub);
          row.appendChild(tdParam);
          row.appendChild(tdVal);
          row.appendChild(tdUnit);
          tbody.appendChild(row);

          this.monitorUpdaters.push((s) => {
            tdVal.textContent = getVal(s);
          });
        });
      });
    },

    updateMonitor(s) {
      if (!this.monitorUpdaters) return;
      for (let i = 0; i < this.monitorUpdaters.length; i++) {
        this.monitorUpdaters[i](s);
      }
    },
  };
  WTE.Controls = Controls;
})();
