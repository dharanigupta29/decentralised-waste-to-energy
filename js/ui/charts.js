// OWNER: PERSON B (visualisation)
// Tiny dependency-free line charts from sim.history.
(function () {
  'use strict';
  const WTE = window.WTE;

  function draw(canvas, hist, series, title) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight || 120;
    if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    const L = 6, R = w - 6, T = 18, B = h - 14;
    c.strokeStyle = '#1d2f36'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = T + ((B - T) * i) / 4; c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); }
    let lx = L;
    c.font = '11px "Segoe UI", sans-serif'; c.textAlign = 'left';
    series.forEach((sr) => {
      const last = hist.length ? hist[hist.length - 1][sr.key] * (sr.mul || 1) : 0;
      const label = `${sr.name} ${last.toFixed(sr.d ?? 1)}${sr.unit}`;
      c.fillStyle = sr.col; c.fillRect(lx, 5, 10, 3); c.fillText(label, lx + 14, 11); lx += c.measureText(label).width + 28;
    });
    if (hist.length < 2) { c.fillStyle = '#567'; c.fillText('collecting data… (sample every 30 s plant time)', L, (T + B) / 2); return; }
    const t0 = hist[0].t, t1 = hist[hist.length - 1].t;
    const X = (t) => L + ((t - t0) / Math.max(1, t1 - t0)) * (R - L);
    series.forEach((sr) => {
      c.strokeStyle = sr.col; c.lineWidth = 2; c.beginPath();
      hist.forEach((p, i) => { const y = B - (Math.min(sr.max, Math.max(0, p[sr.key] * (sr.mul || 1))) / sr.max) * (B - T); i ? c.lineTo(X(p.t), y) : c.moveTo(X(p.t), y); });
      c.stroke();
    });
    c.fillStyle = '#567'; c.textAlign = 'right';
    c.fillText(`${((t1 - t0) / 3600).toFixed(1)} h window`, R, h - 2);
  }

  WTE.Charts = {
    draw(sim) {
      const p = sim.p;
      draw(document.getElementById('chartPower'), sim.history, [
        { key: 'Pgen', name: 'Generator', unit: ' kW', col: '#ffd23f', max: p.engineRated },
        { key: 'served', name: 'Village', unit: ' kW', col: '#3ddc84', max: p.engineRated },
        { key: 'soc', name: 'Battery', unit: '%', col: '#6aa8ff', max: 100, mul: 100, d: 0 },
      ]);
      draw(document.getElementById('chartGas'), sim.history, [
        { key: 'Tox', name: 'T oxidation', unit: ' °C', col: '#ff7a3d', max: 1400, d: 0 },
        { key: 'LHV', name: 'Gas LHV', unit: ' MJ/Nm³', col: '#5fd0c8', max: 7, d: 2 },
        { key: 'Q', name: 'Gas flow', unit: ' Nm³/h', col: '#c38bff', max: 100 },
      ]);
    },
  };
})();
