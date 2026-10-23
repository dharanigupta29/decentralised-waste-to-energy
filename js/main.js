// SHARED glue (keep small; both people may edit, coordinate first).
// Owns the animation loop: advance the engine, then hand the snapshot to every view.
(function () {
  'use strict';
  const WTE = window.WTE;
  const sim = new WTE.Sim();
  WTE.sim = sim; // handy in the browser console: WTE.sim.s

  const app = {
    playing: true, speed: 60,
    select(id) { WTE.Inspector.open(id); },
  };
  const type = () => document.getElementById('feedType').value;

  // buttons shown inside the inspector for each unit
  const ACTIONS = {
    hopper: [['+25 kg waste', () => sim.dump(25, type())], ['+100 kg waste', () => sim.dump(100, type())]],
    gasifier: [['🔥 Ignite', () => sim.ignite()], ['ER −0.02', () => bumpER(-0.02)], ['ER +0.02', () => bumpER(0.02)]],
    scrubber: [['Change scrubber water', () => sim.changeScrubberWater()]],
    filter: [['Replace filter', () => sim.replaceFilter()], ['Change scrubber water', () => sim.changeScrubberWater()]],
    engine: [['Toggle engine', () => { sim.set('engineEnabled', !sim.p.engineEnabled); document.getElementById('engEnable').checked = sim.p.engineEnabled; }]],
    bins: [['Bag biochar (empty bins)', () => sim.emptyBins()]],
    village: [['Toggle day / night', () => document.getElementById('btnNight').click()]],
  };
  function bumpER(d) {
    const v = Math.max(0.18, Math.min(0.45, +(sim.p.ER + d).toFixed(2)));
    sim.set('ER', v); const el = document.getElementById('er'); el.value = v; el.oninput();
  }

  WTE.Schematic.init(document.getElementById('schematic'), (id) => app.select(id));
  WTE.Inspector.init(ACTIONS);
  WTE.Inspector.onChange = (id) => WTE.Schematic.select(id);
  WTE.Village.init(document.getElementById('village'), document.getElementById('ledstrip'));
  WTE.Controls.init(sim, app);

  let last = performance.now(), slowAcc = 1;
  function frame(now) {
    const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
    if (app.playing) sim.advance(dtReal * app.speed);
    const s = sim.s;
    WTE.Schematic.update(s, dtReal);
    WTE.Inspector.update(s, dtReal);
    WTE.Village.update(s);
    slowAcc += dtReal;
    if (slowAcc > 0.25) { // text/DOM-heavy updates at 4 Hz
      slowAcc = 0;
      WTE.Schematic.updateTags(s, sim.history);
      WTE.Inspector.updateText(s);
      WTE.Controls.update(s);
      WTE.Charts.draw(sim);
      WTE.Hardware.sendLeds(s.village.ledsLit, 255 * s.village.servedFrac);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
