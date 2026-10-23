# Decentralized Waste-to-Energy Microgrid with Biochar: digital twin

A real-time simulation of the full chain:
**hopper/shredder → dryer → downdraft gasifier → cyclone → wet scrubber → filter → blower → gas holder + flare → gas engine/generator → exhaust heat exchanger (back to dryer) → control panel + battery → village LEDs**, plus the **biochar** output.

Dump a weight of waste and the math runs: the gasifier heats up, gas quality builds, the engine starts, the battery charges, and the village LEDs stay lit for as long as that waste's energy lasts. Click **any unit** to see an animated cut-away of what is happening inside, with the live equations and every number substituted.

## Run it

Option 1: double-click `index.html` (Chrome/Edge).

Option 2, needed for the Arduino/Web Serial part (it requires `localhost`):

```bash
python -m http.server 8765
```

then open http://localhost:8765

No install, no build, no internet. Safe for a hackathon venue with bad Wi-Fi.

## Folder map: who owns what

```
index.html                 B   page layout
css/style.css              B   look & feel
js/engine/feedstocks.js    A   waste property table
js/engine/engine.js        A   ALL physics/chemistry/electrical math (no DOM)
js/engine/equations.js     A   the "math behind it" text per unit
js/engine/hardware.js      A   optional Arduino load-cell + LEDs bridge
hardware/scale_and_leds/   A   Arduino sketch
js/ui/schematic.js         B   clickable process-flow SVG
js/ui/inspector.js         B   animated cut-aways of each unit
js/ui/village.js           B   streetlights / homes / LED strip
js/ui/charts.js            B   trend charts
js/ui/controls.js          B   left panel, KPIs, alarms, log
js/main.js                 A+B animation loop (agree before editing)
CONTRACT.md                A+B the snapshot fields both sides rely on
```

See **WORK_SPLIT.md** for the task list for each person and the demo script.

## The model in one paragraph

Mass flows through three inventories (hopper → dryer → gasifier bed). The dryer evaporates water using recovered heat, `ṁ_w = Q·3600/2600 kJ/kg`. The gasifier oxidation temperature follows an energy-balance fit `T_ox = 780 + 1500·ER − 1100·M − …` with first-order lags for warm-up. Gas composition shifts with ER, moisture and reduction temperature (Boudouard / water-gas / shift trends), and gas **volume comes from a nitrogen balance** (N₂ in air = N₂ in gas), so cold-gas efficiency (~60–65%) emerges from the math rather than being hard-coded. Tar and dust are removed stage by stage (cyclone 88% dust, scrubber 80% tar degrading as the water saturates, filter 90% with rising Δp). The gas holder does a mass balance with a start-up interlock and a flare. The engine efficiency follows a part-load curve (28% peak). The electrical bus dispatches by priority (plant aux → clinic → streetlights → homes) with a 30 kWh battery. Biochar yield `= FC·(0.35 + 1.2·max(0, 0.35 − ER))`, and CO₂ locked `= char·0.75·0.8·44/12`.
