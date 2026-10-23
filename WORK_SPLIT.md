# Work split: 2 people, in parallel, no merge conflicts

| | **Person A: Process & Math Engineer** | **Person B: Visualisation & Demo Engineer** |
|---|---|---|
| Owns | `js/engine/*`, `hardware/*` | `index.html`, `css/*`, `js/ui/*` |
| Never edits | anything in `js/ui/`, `css/` | anything in `js/engine/` |
| Talks through | `sim.s` snapshot + `WTE.EQUATIONS` (see `CONTRACT.md`) | same |
| Shared | `js/main.js`, `CONTRACT.md`: tell the other person before editing | |

Both of you can work at the same time because the only meeting point is the snapshot object.
If A needs B to show something new: A adds the field to `sim.s` and to `CONTRACT.md` → B draws it.
If B needs a number that does not exist: B asks A; B never computes physics in the UI.

**Git:** each person on their own branch (`engine`, `ui`), merge to `main` every ~1–2 h. Because the files don't overlap, merges are clean.

---

## Person A: process & math engine

The working model is done. These items make it more defensible in front of judges.

**P1: before judging**
- [ ] **Validate the numbers against 2–3 papers/datasheets.** Check gas composition (CO 18–22%, H₂ 15–19%, LHV 4.5–6 MJ/Nm³), CGE 60–75%, engine η 25–30%, biochar 5–10% of dry feed. Put the citations in `equations.js` (judges *will* ask "where did this come from?").
- [ ] Add your own local feedstocks to `feedstocks.js` (e.g. market vegetable waste, sugarcane bagasse, groundnut shells) with moisture/ash/LHV/fixed carbon.
- [ ] Tune `WTE.DEFAULTS` to your target scale (e.g. 10 kWe vs 50 kWe, village size, battery kWh).
- [ ] Add an **economics block** to the snapshot: ₹/kWh, biochar revenue, carbon credits, payback period → `s.econ` + document it in `CONTRACT.md`.

**P2: if time**
- [ ] Replace the empirical `T_ox` fit with a proper zone energy balance (heat of oxidation − endothermic reduction − losses).
- [ ] Equilibrium gas composition: solve the water-gas shift equilibrium constant `K(T)` instead of linear trends.
- [ ] Day/night 24 h load profile instead of the night toggle (`loadDemand()` as a function of hour).
- [ ] Hardware: wire the HX711 + 8 LEDs (`hardware/scale_and_leds`), calibrate `CALIBRATION`, test `Connect Arduino`.

## Person B: visualisation & demo

**P1: before judging**
- [ ] Run on the demo laptop/projector at 1920×1080 and fix any layout issues.
- [ ] Polish the SVG art in `schematic.js` so it looks closer to your concept image (each unit is one `<g class="unit" data-id="…">` block, so it's safe to redraw one at a time).
- [ ] Add a **"Guided demo" button** that walks judges through it: dumps 50 kg → speeds to 300× → auto-opens gasifier → engine → village with captions.
- [ ] Add an **economics/impact card** once A ships `s.econ`.

**P2: if time**
- [ ] Sankey diagram of energy flow (feed MJ → gas → electricity / heat / losses) from `s.tot`.
- [ ] Sound: engine hum pitch ∝ `s.engine.rpm`.
- [ ] Mobile/tablet layout for judges walking around.
- [ ] "Compare" mode: same 50 kg with vs without the dryer heat loop (shows why the CHP loop matters).

---

## 3-minute demo script

1. **Problem (20 s).** Villages burn or dump agri-waste and have no reliable power.
2. **Dump 50 kg wood chips** at 60× speed. Point at the forecast box: *"this load ≈ 24 kWh, all 24 streetlights for ~17 h, 2.8 kg biochar."*
3. **Click the gasifier.** Show the 4 zones heating up, the reactions, and the live equations. Change ER with ±0.02 and watch the gas composition and T_ox respond.
4. **Click the tank.** Off-spec start-up gas goes to the flare, then the interlock opens and the engine starts.
5. **Click the dryer / heat exchanger.** Engine waste heat dries the next batch (CHP loop).
6. **Village.** LEDs glow. Switch to 900×: fuel runs out, the battery carries the load, then lights shed in priority order (clinic stays on longest). Dump again and they come back.
7. **Biochar bin.** kg of biochar and CO₂ locked, a second revenue stream.
8. **(If built) real scale.** Put a weight on the load cell and the physical LEDs light up.
