// OWNER: PERSON B (visualisation)
// Slide-in drawer: animated cut-away of the selected unit + live readings + equations (from WTE.EQUATIONS).
(function () {
  'use strict';
  const WTE = window.WTE;
  const W = 520, H = 300;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  function txt(c, s, x, y, col = '#cde', size = 12, align = 'left', bold = false) {
    c.fillStyle = col; c.font = `${bold ? '600 ' : ''}${size}px "Segoe UI", sans-serif`; c.textAlign = align; c.fillText(s, x, y);
  }
  function arrow(c, x1, y1, x2, y2, col, w = 3) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 9 * Math.cos(a - 0.4), y2 - 9 * Math.sin(a - 0.4)); c.lineTo(x2 - 9 * Math.cos(a + 0.4), y2 - 9 * Math.sin(a + 0.4)); c.fill();
  }
  function rrect(c, x, y, w, h, r, fill, stroke) {
    c.beginPath(); c.roundRect(x, y, w, h, r);
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
  }
  function bar(c, x, y, w, h, frac, col, label) {
    rrect(c, x, y, w, h, 4, '#132228', '#2b4048');
    const fh = h * Math.max(0, Math.min(1, frac));
    rrect(c, x + 2, y + h - fh, w - 4, Math.max(0, fh - 2), 3, col);
    if (label) txt(c, label, x + w / 2, y + h + 14, '#8aa3a8', 11, 'center');
  }
  const ensure = (st, key, n, make) => { if (!st[key]) st[key] = Array.from({ length: n }, make); return st[key]; };

  // ---------- one drawer per unit: (ctx, snapshot, state, dt, time) ----------
  const DRAW = {
    hopper(c, s, st, dt) {
      const on = s.shredder.on;
      c.fillStyle = '#1b6f72'; c.beginPath(); c.moveTo(60, 40); c.lineTo(260, 40); c.lineTo(200, 130); c.lineTo(120, 130); c.closePath(); c.fill();
      const fill = Math.min(1, s.hopper.kg / 150);
      c.fillStyle = '#b5793b'; c.beginPath(); c.moveTo(120 - 0, 130); c.lineTo(200, 130); c.lineTo(200 + 60 * fill, 130 - 90 * fill); c.lineTo(120 - 60 * fill, 130 - 90 * fill); c.closePath(); c.fill();
      txt(c, `${s.hopper.kg.toFixed(1)} kg in hopper`, 160, 30, '#fff', 13, 'center', true);
      rrect(c, 100, 140, 120, 90, 8, '#0b2226', '#2aa5a2');
      st.a = (st.a || 0) + (on ? dt * 4 : 0);
      [[135, 185, 1], [185, 185, -1]].forEach(([x, y, d]) => {
        c.save(); c.translate(x, y); c.rotate(st.a * d);
        c.fillStyle = '#666'; c.beginPath(); c.arc(0, 0, 26, 0, TAU); c.fill();
        c.fillStyle = '#bbb'; for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.fillRect(-4, -34, 8, 12); }
        c.restore();
      });
      const parts = ensure(st, 'p', 40, () => ({ x: rnd(130, 190), y: rnd(100, 260), v: rnd(30, 60) }));
      parts.forEach((p) => {
        if (on) p.y += p.v * dt;
        if (p.y > 230) { p.x += 120 * dt; p.y = 240 + Math.sin(p.x / 10) * 2; }
        if (p.x > 440 || (!on && p.y > 230)) { p.x = rnd(130, 190); p.y = rnd(100, 135); }
        const big = p.y < 165;
        c.fillStyle = big ? '#b5793b' : '#d8a060'; c.fillRect(p.x, p.y, big ? 9 : 4, big ? 6 : 3);
      });
      c.fillStyle = '#334'; c.fillRect(220, 244, 240, 8);
      txt(c, on ? `SHREDDING ${s.shredder.rate} kg/h → 20–50 mm chips` : 'shredder idle', 330, 280, on ? '#3ddc84' : '#8aa3a8', 12, 'center', true);
      txt(c, 'to dryer →', 470, 240, '#c08a4a', 12, 'right');
    },

    dryer(c, s, st, dt) {
      const d = s.dryer;
      rrect(c, 30, 40, 460, 200, 10, '#162a30', '#2aa5a2');
      c.fillStyle = '#333'; c.fillRect(50, 170, 420, 10);
      const chips = ensure(st, 'c', 34, (_, i) => ({ x: 50 + i * 13 }));
      const m = d.mOut;
      chips.forEach((p) => {
        p.x += (d.kg > 0.1 ? 22 : 0) * dt; if (p.x > 470) p.x = 50;
        const k = (p.x - 50) / 420; const wetness = d.mIn + (m - d.mIn) * k;
        c.fillStyle = `hsl(30, 50%, ${48 - wetness * 60}%)`;
        if (d.kg > 0.1) c.fillRect(p.x, 160, 11, 9);
      });
      const air = ensure(st, 'a', 26, () => ({ x: rnd(60, 460), y: rnd(185, 235) }));
      const hot = Math.min(1, d.Qavail / 12);
      air.forEach((p) => { p.y -= (40 + 60 * hot) * dt; if (p.y < 60) { p.y = 235; p.x = rnd(60, 460); } c.fillStyle = `rgba(255,${150 - hot * 60},60,${0.15 + 0.7 * hot})`; c.beginPath(); c.arc(p.x, p.y, 3, 0, TAU); c.fill(); });
      const steam = ensure(st, 's', 20, () => ({ x: rnd(60, 460), y: rnd(60, 150), l: Math.random() }));
      const ev = Math.min(1, d.evapRate / 8);
      steam.forEach((p) => { p.y -= 25 * dt; p.l += dt; if (p.y < 50) { p.y = 150; p.x = rnd(60, 460); } c.fillStyle = `rgba(230,240,255,${0.6 * ev})`; c.beginPath(); c.arc(p.x + Math.sin(p.l * 3) * 4, p.y, 5, 0, TAU); c.fill(); });
      txt(c, `hot air ${d.airT.toFixed(0)} °C ↑`, 60, 258, '#ff9a5a', 12);
      txt(c, `steam out ${d.evapRate.toFixed(1)} kg/h`, 470, 30, '#dde', 12, 'right');
      txt(c, `wet chips in · M ${(d.mIn * 100).toFixed(0)}%`, 50, 30, '#c08a4a', 12);
      txt(c, `→ to gasifier · M ${(d.mOut * 100).toFixed(0)}%`, 470, 258, '#3ddc84', 12, 'right');
      txt(c, `heat: ${d.Qcool.toFixed(1)} kW gas cooler + ${d.Qrec.toFixed(1)} kW engine exhaust`, 260, 285, '#ff7a3d', 12, 'center', true);
    },

    gasifier(c, s, st, dt, t) {
      const g = s.gasifier, T = g.T;
      const x0 = 150, x1 = 300, zh = 55;
      const zones = [['Drying', T.dry, 25], ['Pyrolysis', T.pyro, 80], ['Oxidation', T.ox, 135], ['Reduction', T.red, 190]];
      rrect(c, x0 - 12, 12, x1 - x0 + 24, 250, 8, '#1b6f72');
      zones.forEach(([n, Tz, y]) => {
        c.fillStyle = g.ignited || Tz > 60 ? WTE.tempColor(Tz) : '#1c2326'; c.fillRect(x0, y, x1 - x0, zh);
        txt(c, n, x0 - 58, y + 22, '#fff', 13, 'right', true);
        txt(c, `${Tz.toFixed(0)} °C`, x0 - 58, y + 40, WTE.tempColor(Math.max(500, Tz)), 13, 'right', true);
      });
      // throat
      c.fillStyle = '#1b6f72'; c.beginPath(); c.moveTo(x0, 160); c.lineTo(x0 + 28, 175); c.lineTo(x0, 190); c.fill();
      c.beginPath(); c.moveTo(x1, 160); c.lineTo(x1 - 28, 175); c.lineTo(x1, 190); c.fill();
      // flame in oxidation zone
      if (T.ox > 400) {
        const f = Math.min(1, (T.ox - 400) / 700) * (0.85 + 0.15 * Math.sin(t * 20));
        const gr = c.createRadialGradient(225, 165, 2, 225, 165, 60);
        gr.addColorStop(0, `rgba(255,250,200,${f})`); gr.addColorStop(0.4, `rgba(255,140,30,${0.7 * f})`); gr.addColorStop(1, 'rgba(255,60,0,0)');
        c.fillStyle = gr; c.fillRect(x0, 135, x1 - x0, 55);
      }
      // falling fuel particles
      const parts = ensure(st, 'p', 110, () => ({ x: rnd(x0 + 6, x1 - 10), y: rnd(25, 245) }));
      const v = g.burning ? 10 + g.feedWet * 1.2 : 0;
      parts.forEach((p) => {
        p.y += v * dt;
        if (p.y > 245) { p.y = 25; p.x = rnd(x0 + 6, x1 - 10); }
        const r = p.y < 135 ? 4 : p.y < 190 ? 4 - (p.y - 135) / 30 : 2.2;
        c.fillStyle = p.y < 80 ? '#b5793b' : p.y < 135 ? '#4a3020' : p.y < 190 ? (T.ox > 500 ? '#ffb040' : '#4a3020') : '#151515';
        c.beginPath(); c.arc(p.x, p.y, Math.max(1.5, r), 0, TAU); c.fill();
      });
      // pyrolysis vapours
      if (T.pyro > 220) {
        c.strokeStyle = 'rgba(220,220,220,.35)'; c.lineWidth = 2;
        for (let i = 0; i < 5; i++) { c.beginPath(); const bx = x0 + 18 + i * 28; for (let y = 130; y > 85; y -= 5) c.lineTo(bx + Math.sin(y / 6 + t * 3 + i) * 4, y); c.stroke(); }
      }
      // air jets
      const airOn = g.airKgH > 0.5;
      const jet = airOn ? 10 * Math.sin(t * 8) : 0;
      arrow(c, x0 - 50, 186, x0 + 18 + jet, 186, airOn ? '#6aa8ff' : '#345', 4);
      arrow(c, x1 + 70, 170, x1 - 18 - jet, 170, airOn ? '#6aa8ff' : '#345', 4);
      txt(c, `air ${g.airKgH.toFixed(1)} kg/h`, x1 + 70, 192, '#6aa8ff', 11, 'right');
      txt(c, `ER ${g.ER.toFixed(2)}`, x1 + 70, 160, '#6aa8ff', 11, 'right');
      // grate + char
      c.strokeStyle = '#aaa'; c.setLineDash([6, 4]); c.lineWidth = 3; c.beginPath(); c.moveTo(x0, 247); c.lineTo(x1, 247); c.stroke(); c.setLineDash([]);
      const ch = ensure(st, 'ch', 12, () => ({ x: rnd(x0 + 20, x1 - 20), y: rnd(250, 295) }));
      ch.forEach((p) => { if (g.charRate > 0.01) p.y += 30 * dt; if (p.y > 295) p.y = 250; c.fillStyle = '#111'; c.fillRect(p.x, p.y, 4, 4); });
      txt(c, `biochar ${g.charRate.toFixed(2)} kg/h ↓`, 225, 292, '#3ddc84', 12, 'center', true);
      // gas out + composition
      if (g.Qraw > 0.1) arrow(c, x1 + 12, 225, x1 + 80, 225, '#5fd0c8', 5);
      txt(c, `${g.Qraw.toFixed(1)} Nm³/h`, x1 + 16, 245, '#5fd0c8', 12, 'left', true);
      const comp = g.comp, cols = [['CO', '#ff9a1f'], ['H2', '#5fd0c8'], ['CH4', '#c38bff'], ['CO2', '#7c8a90'], ['N2', '#34464d']];
      let y = 20; const bx = 420, bh = 220;
      txt(c, 'Producer gas', bx + 24, 14, '#cde', 11, 'center', true);
      cols.forEach(([k, col]) => { const hh = (comp[k] / 100) * bh; c.fillStyle = col; c.fillRect(bx, y, 48, hh); txt(c, `${k.replace('2', '₂').replace('4', '₄')} ${comp[k].toFixed(1)}%`, bx + 54, y + hh / 2 + 4, col === '#34464d' ? '#8aa3a8' : col, 11); y += hh; });
      txt(c, `LHV ${g.LHV.toFixed(2)} MJ/Nm³`, bx + 24, 262, '#ffd23f', 12, 'center', true);
      txt(c, `η_cg ${(g.CGE * 100).toFixed(0)}%`, bx + 24, 278, '#ffd23f', 11, 'center');
      if (!g.ignited) txt(c, 'COLD - dump waste to start', 225, 140, '#fff', 14, 'center', true);
    },

    cyclone(c, s, st, dt) {
      const cy = s.cyclone, on = cy.Q > 0.1;
      const cx = 260;
      c.fillStyle = '#1b6f72'; c.fillRect(cx - 70, 40, 140, 100);
      c.beginPath(); c.moveTo(cx - 70, 140); c.lineTo(cx + 70, 140); c.lineTo(cx + 18, 250); c.lineTo(cx - 18, 250); c.fill();
      c.fillStyle = '#0b2226'; c.fillRect(cx - 62, 46, 124, 92);
      c.beginPath(); c.moveTo(cx - 62, 138); c.lineTo(cx + 62, 138); c.lineTo(cx + 13, 246); c.lineTo(cx - 13, 246); c.fill();
      rrect(c, cx - 20, 10, 40, 80, 3, '#2b4b55');
      rrect(c, cx - 25, 252, 50, 34, 4, '#455', '#233');
      const parts = ensure(st, 'p', 70, () => ({ th: rnd(0, TAU), y: rnd(50, 240), heavy: Math.random() < 0.5 }));
      parts.forEach((p) => {
        if (on) { p.th += dt * 7; p.y += (p.heavy ? 28 : 12) * dt; }
        const rmax = p.y < 140 ? 58 : 58 - ((p.y - 140) / 106) * 46;
        const r = p.heavy ? rmax : rmax * 0.55;
        if (p.y > 245) { p.y = 50; p.th = rnd(0, TAU); }
        const x = cx + r * Math.cos(p.th);
        c.fillStyle = p.heavy ? '#7a6a5a' : 'rgba(95,208,200,.8)';
        c.beginPath(); c.arc(x, p.y, p.heavy ? 3 : 2, 0, TAU); c.fill();
      });
      if (on) { arrow(c, 40, 70, cx - 70, 70, '#5fd0c8', 5); arrow(c, cx, 40, cx, 0 + 6, '#5fd0c8', 5); }
      txt(c, `dirty gas ${cy.dustIn.toFixed(2)} g/Nm³`, 30, 60, '#c08a4a', 12);
      txt(c, `clean gas ${cy.dustOut.toFixed(3)} g/Nm³ ↑`, cx + 30, 24, '#5fd0c8', 12);
      txt(c, `dust pot ${s.bins.dust.toFixed(3)} kg`, cx + 35, 275, '#bbb', 12);
      txt(c, 'heavy particles spin to the wall → slide down', 410, 160, '#8aa3a8', 11, 'center');
      txt(c, `η = ${(cy.eff * 100).toFixed(0)}%`, 410, 180, '#ffd23f', 14, 'center', true);
    },

    scrubber(c, s, st, dt) {
      const sc = s.scrubber, on = sc.Q > 0.1, q = sc.waterQ;
      rrect(c, 160, 20, 200, 250, 30, '#2b4b55', '#2aa5a2');
      const water = `rgb(${Math.round(40 + (1 - q) * 120)},${Math.round(120 - (1 - q) * 50)},${Math.round(190 - (1 - q) * 160)})`;
      rrect(c, 168, 150, 184, 112, 22, water);
      c.strokeStyle = '#9fe0ff'; c.lineWidth = 3; c.beginPath(); c.moveTo(175, 40); c.lineTo(345, 40); c.stroke();
      const drops = ensure(st, 'd', 60, () => ({ x: rnd(178, 342), y: rnd(45, 150) }));
      drops.forEach((p) => { if (on) p.y += 140 * dt; if (p.y > 150) { p.y = 45; p.x = rnd(178, 342); } c.fillStyle = 'rgba(160,220,255,.85)'; c.fillRect(p.x, p.y, 2, 6); });
      const bub = ensure(st, 'b', 30, () => ({ x: rnd(180, 340), y: rnd(150, 260), r: rnd(3, 7) }));
      bub.forEach((p) => { if (on) p.y -= 50 * dt; if (p.y < 155) { p.y = 258; p.x = rnd(180, 340); } c.strokeStyle = 'rgba(255,240,160,.8)'; c.lineWidth = 1.5; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.stroke(); });
      if (on) { arrow(c, 60, 230, 165, 230, '#ff9a5a', 5); arrow(c, 360, 60, 460, 60, '#5fd0c8', 5); }
      txt(c, 'hot tarry gas', 60, 220, '#ff9a5a', 12);
      txt(c, `${sc.tarIn.toFixed(2)} g/Nm³ tar`, 60, 250, '#ff9a5a', 12);
      txt(c, 'cool gas 35 °C', 370, 50, '#5fd0c8', 12);
      txt(c, `${sc.tarOut.toFixed(3)} g/Nm³ tar`, 370, 85, '#5fd0c8', 12);
      bar(c, 430, 130, 30, 120, q, q > 0.65 ? '#3ddc84' : '#ffb020', 'water quality');
      txt(c, `η = ${(sc.eff * 100).toFixed(0)}%`, 260, 290, '#ffd23f', 13, 'center', true);
    },

    filter(c, s, st, dt) {
      const f = s.filter, on = f.Q > 0.1;
      rrect(c, 180, 20, 160, 250, 16, '#9aa9ad', '#4a5a5e');
      for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#c9a46a' : '#b48d55'; c.fillRect(190, 40 + i * 30, 140, 26); }
      c.fillStyle = `rgba(60,35,15,${Math.min(0.85, f.loadPct)})`; c.fillRect(190, 40, 140, 210 * Math.min(1, 0.3 + f.loadPct));
      const p = ensure(st, 'p', 50, () => ({ x: rnd(195, 325), y: rnd(25, 250), stuck: Math.random() < 0.85 }));
      p.forEach((q) => {
        if (on) q.y += (q.stuck && q.y > 60 + q.x % 40 ? 0 : 60) * dt;
        if (q.y > 268) { q.y = 25; q.stuck = Math.random() < 0.85; }
        c.fillStyle = q.stuck ? '#5a3a1a' : '#5fd0c8'; c.beginPath(); c.arc(q.x, q.y, 2.5, 0, TAU); c.fill();
      });
      if (on) { arrow(c, 80, 30, 175, 30, '#5fd0c8', 4); arrow(c, 345, 260, 450, 260, '#5fd0c8', 4); }
      txt(c, 'media traps tar mist & fines', 260, 290, '#8aa3a8', 11, 'center');
      txt(c, `${f.tarOutMg.toFixed(1)} mg/Nm³`, 450, 245, f.tarOutMg > 100 ? '#ff4d5e' : '#3ddc84', 14, 'right', true);
      txt(c, 'to engine (spec < 100)', 450, 285, '#8aa3a8', 11, 'right');
      bar(c, 40, 80, 34, 150, f.dp / 3, f.dp > 2 ? '#ff4d5e' : '#ffd23f', `Δp ${f.dp.toFixed(2)} kPa`);
      bar(c, 100, 80, 34, 150, f.loadPct, f.loadPct > 0.8 ? '#ff4d5e' : '#c08a4a', `load ${(f.loadPct * 100).toFixed(0)}%`);
    },

    blower(c, s, st, dt) {
      const b = s.blower;
      st.a = (st.a || 0) + dt * b.rpm / 60 * TAU * 0.05;
      c.fillStyle = '#1b6f72'; c.beginPath(); c.arc(240, 150, 110, 0, TAU); c.fill();
      c.fillStyle = '#0b2226'; c.beginPath(); c.arc(240, 150, 96, 0, TAU); c.fill();
      c.save(); c.translate(240, 150); c.rotate(st.a);
      c.fillStyle = '#cfe'; for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.moveTo(14, -4); c.quadraticCurveTo(60, -24, 88, -8); c.lineTo(88, 2); c.quadraticCurveTo(55, -10, 14, 4); c.fill(); }
      c.fillStyle = '#456'; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.fill(); c.restore();
      if (b.Q > 0.1) { arrow(c, 40, 150, 120, 150, '#5fd0c8', 5); arrow(c, 340, 60, 460, 60, '#5fd0c8', 5); }
      txt(c, `${b.rpm.toFixed(0)} rpm (shown slowed)`, 400, 150, '#cde', 13, 'center', true);
      txt(c, `Q ${b.Q.toFixed(1)} Nm³/h`, 400, 175, '#5fd0c8', 12, 'center');
      txt(c, `Δp ${b.dp.toFixed(2)} kPa · ${b.kW.toFixed(3)} kW`, 400, 195, '#ffd23f', 12, 'center');
    },

    tank(c, s, st, dt, t) {
      const k = s.tank;
      rrect(c, 120, 60, 150, 220, 40, '#1d3d44', '#2aa5a2');
      c.save(); c.beginPath(); c.roundRect(120, 60, 150, 220, 40); c.clip();
      c.fillStyle = 'rgba(44,196,191,.6)'; c.fillRect(120, 280 - 220 * k.fill, 150, 220 * k.fill); c.restore();
      txt(c, `${k.nm3.toFixed(2)} Nm³`, 195, 170, '#fff', 18, 'center', true);
      txt(c, `${k.pressure.toFixed(1)} kPa(g)`, 195, 192, '#cde', 12, 'center');
      txt(c, k.mode, 195, 40, '#ffd23f', 13, 'center', true);
      c.strokeStyle = '#567'; c.lineWidth = 6; c.beginPath(); c.moveTo(270, 120); c.lineTo(380, 120); c.lineTo(380, 60); c.stroke();
      const fl = Math.min(1.5, k.flareRate / 15);
      const fire = ensure(st, 'f', 40, () => ({ x: 0, y: 0, l: Math.random() }));
      fire.forEach((p) => {
        p.l += dt * 2; if (p.l > 1) { p.l = 0; p.x = rnd(-6, 6); p.y = 0; }
        if (fl < 0.02) return;
        const yy = 55 - p.l * 70 * fl, a = 1 - p.l;
        c.fillStyle = `rgba(255,${Math.round(200 - p.l * 150)},40,${a})`; c.beginPath(); c.arc(380 + p.x * (1 + p.l), yy, (8 - 5 * p.l) * fl + 1, 0, TAU); c.fill();
      });
      txt(c, `flare ${k.flareRate.toFixed(1)} Nm³/h`, 395, 85, '#ff9a5a', 12);
      if (k.inRate > 0.1) arrow(c, 20, 230, 115, 230, '#5fd0c8', 5);
      if (k.outRate > 0.1) arrow(c, 275, 250, 470, 250, '#5fd0c8', 5);
      txt(c, `in ${k.inRate.toFixed(1)} Nm³/h`, 20, 220, '#5fd0c8', 12);
      txt(c, `to engine ${k.outRate.toFixed(1)} Nm³/h`, 470, 240, '#5fd0c8', 12, 'right');
      txt(c, `LHV ${k.LHV.toFixed(2)} MJ/Nm³`, 195, 300 - 6, '#ffd23f', 12, 'center');
    },

    engine(c, s, st, dt) {
      const e = s.engine;
      st.a = (st.a || 0) + dt * (e.rpm / 60) * TAU * 0.04; // 1/25 slow motion
      const order = [0, Math.PI, Math.PI, 0];
      for (let i = 0; i < 4; i++) {
        const x = 40 + i * 60, ph = st.a + order[i] + (i >= 2 ? TAU / 2 : 0) * 0;
        rrect(c, x, 40, 46, 130, 4, '#2b4b55', '#2aa5a2');
        const py = 95 + 35 * Math.cos(ph);
        const cycle = ((ph + i * Math.PI / 2) % (4 * Math.PI) + 4 * Math.PI) % (4 * Math.PI);
        const power = cycle < Math.PI;
        if (e.rpm > 50 && power) { const gr = c.createRadialGradient(x + 23, 55, 1, x + 23, 55, 30); gr.addColorStop(0, 'rgba(255,220,120,.95)'); gr.addColorStop(1, 'rgba(255,90,0,0)'); c.fillStyle = gr; c.fillRect(x + 2, 42, 42, py - 42); }
        c.fillStyle = '#aab'; c.fillRect(x + 4, py, 38, 22);
        c.strokeStyle = '#889'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + 23, py + 22); c.lineTo(x + 23 + 12 * Math.sin(ph), 210 + 12 * Math.cos(ph)); c.stroke();
        if (e.rpm > 50 && cycle < 0.25) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 23, 46, 5, 0, TAU); c.fill(); }
      }
      c.fillStyle = '#556'; c.fillRect(30, 205, 250, 12);
      c.save(); c.translate(380, 140); c.rotate(st.a * 4);
      c.fillStyle = '#1b6f72'; c.beginPath(); c.arc(0, 0, 70, 0, TAU); c.fill();
      c.fillStyle = '#c33'; c.fillRect(-12, -60, 24, 50); c.fillStyle = '#33c'; c.fillRect(-12, 10, 24, 50);
      c.restore();
      c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= 200; x += 3) c.lineTo(300 + x, 255 + (e.rpm > 50 ? 16 * Math.sin(x / 12 - st.a * 8) : 0));
      c.stroke();
      txt(c, 'cylinders (1/25 slow motion)', 145, 30, '#8aa3a8', 11, 'center');
      txt(c, 'alternator', 380, 30, '#8aa3a8', 11, 'center');
      txt(c, `${e.P.toFixed(2)} kWe · ${e.freq.toFixed(1)} Hz · ${e.voltage.toFixed(0)} V`, 400, 290, '#ffd23f', 13, 'center', true);
      txt(c, `η ${(e.eff * 100).toFixed(1)}% · gas ${e.gasNm3h.toFixed(1)} Nm³/h`, 145, 250, '#5fd0c8', 12, 'center');
      txt(c, `exhaust ${e.Texh.toFixed(0)} °C → HX`, 145, 270, '#ff7a3d', 12, 'center');
      if (!e.on) txt(c, 'ENGINE STOPPED', 260, 150, '#ff4d5e', 18, 'center', true);
    },

    hx(c, s, st, dt) {
      const x = s.hx, on = x.Qexh > 0.05;
      rrect(c, 60, 70, 400, 60, 6, '#3a2420', '#ff7a3d');
      rrect(c, 60, 150, 400, 60, 6, '#1a2a3a', '#6aa8ff');
      const g1 = c.createLinearGradient(60, 0, 460, 0); g1.addColorStop(0, '#ff4a1a'); g1.addColorStop(1, '#a86a3a');
      const g2 = c.createLinearGradient(460, 0, 60, 0); g2.addColorStop(0, '#4a7aff'); g2.addColorStop(1, '#ff8a3a');
      const p = ensure(st, 'p', 40, (_, i) => ({ x: rnd(60, 460), hot: i % 2 === 0 }));
      p.forEach((q) => {
        if (on) q.x += (q.hot ? 80 : -80) * dt;
        if (q.x > 460) q.x = 60; if (q.x < 60) q.x = 460;
        c.fillStyle = q.hot ? g1 : g2; c.beginPath(); c.arc(q.x, q.hot ? 100 : 180, 5, 0, TAU); c.fill();
      });
      c.strokeStyle = '#ccc'; for (let i = 0; i < 14; i++) { c.beginPath(); c.moveTo(80 + i * 28, 132); c.lineTo(80 + i * 28, 148); c.stroke(); }
      txt(c, `exhaust ${x.Tin.toFixed(0)} °C →`, 60, 60, '#ff7a3d', 12);
      txt(c, `→ ${x.Tout.toFixed(0)} °C to stack`, 460, 60, '#c99', 12, 'right');
      txt(c, '← fresh air', 460, 230, '#6aa8ff', 12, 'right');
      txt(c, `hot air to dryer ← ${x.Qrec.toFixed(2)} kW`, 60, 230, '#ff9a5a', 12, 'left', true);
      txt(c, `counter-flow, ε = ${(x.eff * 100).toFixed(0)}%`, 260, 270, '#ffd23f', 13, 'center', true);
    },

    panel(c, s, st, dt) {
      const b = s.panel;
      const nodes = { gen: [70, 70], bus: [260, 150], aux: [450, 50], vil: [450, 150], bat: [260, 260] };
      st.o = (st.o || 0) + dt * 40;
      const flow = (a, z, kw, col) => {
        if (kw < 0.01) { c.strokeStyle = '#223'; c.lineWidth = 2; c.beginPath(); c.moveTo(...a); c.lineTo(...z); c.stroke(); return; }
        c.strokeStyle = col; c.lineWidth = 2 + Math.min(10, kw); c.setLineDash([8, 10]); c.lineDashOffset = -st.o;
        c.beginPath(); c.moveTo(...a); c.lineTo(...z); c.stroke(); c.setLineDash([]);
        txt(c, `${kw.toFixed(2)} kW`, (a[0] + z[0]) / 2 + 6, (a[1] + z[1]) / 2 - 6, col, 12, 'left', true);
      };
      flow(nodes.gen, nodes.bus, b.Pgen, '#ffd23f');
      flow(nodes.bus, nodes.aux, b.servedPar, '#8aa3a8');
      flow(nodes.bus, nodes.vil, b.served, '#3ddc84');
      if (b.battKW >= 0) flow(nodes.bat, nodes.bus, b.battKW, '#ffb020'); else flow(nodes.bus, nodes.bat, -b.battKW, '#3ddc84');
      const box = (n, label, col) => { const [x, y] = nodes[n]; rrect(c, x - 48, y - 18, 96, 36, 8, '#132228', col); txt(c, label, x, y + 4, '#fff', 12, 'center', true); };
      box('gen', 'Generator', '#ffd23f'); box('bus', 'AC bus 415 V', '#2cc4bf'); box('aux', 'Plant aux', '#8aa3a8'); box('vil', 'Village', '#3ddc84'); box('bat', 'Battery', '#ffb020');
      bar(c, 340, 225, 120, 26, 0, '#000');
      rrect(c, 342, 227, 116 * b.soc, 22, 3, b.soc < 0.15 ? '#ff4d5e' : '#3ddc84');
      txt(c, `SOC ${(b.soc * 100).toFixed(0)}% · ${b.socKWh.toFixed(1)} kWh`, 400, 268, '#cde', 12, 'center');
      txt(c, b.mode, 70, 290, '#ffd23f', 12, 'left', true);
    },

    village(c, s, st, dt, t) {
      const v = s.village;
      c.fillStyle = v.night ? '#08101c' : '#7fb8e8'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#2f3a3f'; c.fillRect(0, 200, W, 60);
      c.strokeStyle = '#ddd'; c.setLineDash([20, 16]); c.beginPath(); c.moveTo(0, 230); c.lineTo(W, 230); c.stroke(); c.setLineDash([]);
      const n = Math.min(12, v.lampsTotal), litN = Math.round((v.lampsLit / Math.max(1, v.lampsTotal)) * n);
      for (let i = 0; i < n; i++) {
        const x = 25 + i * (470 / Math.max(1, n - 1));
        const lit = v.night && i < litN;
        if (lit) { const gr = c.createRadialGradient(x, 120, 2, x, 160, 70); gr.addColorStop(0, 'rgba(255,230,140,.8)'); gr.addColorStop(1, 'rgba(255,210,63,0)'); c.fillStyle = gr; c.beginPath(); c.moveTo(x - 6, 120); c.lineTo(x - 40, 205); c.lineTo(x + 40, 205); c.closePath(); c.fill(); }
        c.strokeStyle = '#111'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, 200); c.lineTo(x, 115); c.stroke();
        c.fillStyle = lit ? '#fff6c0' : '#444'; c.beginPath(); c.arc(x, 117, 6, 0, TAU); c.fill();
      }
      const hn = Math.min(8, v.housesTotal), hl = Math.round((v.housesLit / Math.max(1, v.housesTotal)) * hn);
      for (let i = 0; i < hn; i++) {
        const x = 20 + i * 62;
        c.fillStyle = '#b5523b'; c.beginPath(); c.moveTo(x, 60); c.lineTo(x + 25, 35); c.lineTo(x + 50, 60); c.fill();
        c.fillStyle = '#d9c7a5'; c.fillRect(x + 5, 60, 40, 38);
        c.fillStyle = i < hl ? '#ffd23f' : '#333'; c.fillRect(x + 12, 68, 11, 10); c.fillRect(x + 28, 68, 11, 10);
      }
      txt(c, `${v.lampsLit}/${v.lampsTotal} streetlights · ${v.housesLit}/${v.housesTotal} homes · clinic ${v.clinicOn ? 'ON' : 'OFF'}`, 260, 290, '#ffd23f', 13, 'center', true);
    },

    bins(c, s) {
      const b = s.bins;
      const hb = Math.min(160, b.biochar * 8), ha = Math.min(160, b.ash * 20);
      rrect(c, 80, 60, 140, 190, 6, '#2f7d32', '#1b4d1d');
      c.fillStyle = '#151515'; c.beginPath(); c.moveTo(86, 246); c.quadraticCurveTo(150, 246 - hb * 1.3, 214, 246); c.fill();
      rrect(c, 280, 110, 110, 140, 6, '#6b7377', '#3b4245');
      c.fillStyle = '#c9c9c9'; c.beginPath(); c.moveTo(286, 246); c.quadraticCurveTo(335, 246 - ha * 1.3, 384, 246); c.fill();
      txt(c, `${b.biochar.toFixed(2)} kg biochar`, 150, 45, '#3ddc84', 14, 'center', true);
      txt(c, `${b.ash.toFixed(2)} kg ash`, 335, 95, '#ccc', 13, 'center', true);
      txt(c, `🌱 ${s.tot.co2e.toFixed(2)} kg CO₂ locked in soil`, 260, 285, '#3ddc84', 14, 'center', true);
    },
  };
  DRAW.shredder = DRAW.hopper; DRAW.laptop = DRAW.panel;

  const Inspector = {
    init(actions) {
      this.el = document.getElementById('inspector');
      this.canvas = document.getElementById('inspCanvas');
      this.ctx = this.canvas.getContext('2d');
      this.actions = actions;
      this.id = null; this.t = 0;
      document.getElementById('inspClose').onclick = () => this.close();
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); });
    },
    open(id) {
      this.id = id; this.state = {};
      this.el.classList.add('open'); this.el.setAttribute('aria-hidden', 'false');
      const acts = document.getElementById('inspActions'); acts.innerHTML = '';
      (this.actions[id] || []).forEach(([label, fn]) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = fn; acts.appendChild(b); });
      this._lastText = 0; this.onChange && this.onChange(id);
    },
    close() { this.id = null; this.el.classList.remove('open'); this.el.setAttribute('aria-hidden', 'true'); this.onChange && this.onChange(null); },

    update(s, dtReal) {
      if (!this.id) return;
      this.t += dtReal;
      const cv = this.canvas, dpr = window.devicePixelRatio || 1;
      const cw = cv.clientWidth, ch = cv.clientHeight;
      if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
      const c = this.ctx, k = Math.min(cw / W, ch / H);
      c.setTransform(dpr * k, 0, 0, dpr * k, dpr * (cw - W * k) / 2, dpr * (ch - H * k) / 2);
      c.clearRect(-1000, -1000, 4000, 4000);
      const fn = DRAW[this.id];
      if (fn) fn(c, s, this.state, Math.min(dtReal, 0.05), this.t);
    },

    updateText(s) {
      if (!this.id) return;
      const e = WTE.EQUATIONS[this.id](s);
      document.getElementById('inspTitle').textContent = e.title;
      document.getElementById('inspInside').textContent = e.inside;
      document.getElementById('inspReadings').innerHTML = e.readings.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      document.getElementById('inspEq').innerHTML = e.eq.map(([n, f, r]) => `<tr><td>${n}</td><td>${f}</td><td>${r}</td></tr>`).join('');
      const rw = document.getElementById('inspReactWrap');
      rw.style.display = e.reactions ? '' : 'none';
      if (e.reactions) document.getElementById('inspReact').innerHTML = e.reactions.map(([z, r]) => `<dt>${z}</dt><dd>${r}</dd>`).join('');
    },
  };
  WTE.Inspector = Inspector;
})();
