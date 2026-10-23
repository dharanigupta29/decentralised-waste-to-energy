# Build Spec: Decentralized Waste-to-Energy Microgrid with Biochar (Digital Twin)

> **How to use this file in Antigravity**
> 1. Create a new empty folder (e.g. `wte-microgrid`) and open it in Antigravity.
> 2. Copy this file into that folder.
> 3. Give the agent the **Stage prompts in Section 9, one at a time**. After each stage, open the page, check the "✅ Check" list, and only then move to the next stage.
> 4. Every stage prompt starts with "Read ANTIGRAVITY_BUILD_SPEC.md". Keep this file in the project root so the agent can always re-read it.

---

## 1. What we are building

A **real-time, browser-based digital twin** of a village-scale waste-to-energy plant:

```
Waste dumped (kg) → ① Hopper + shredder → ② Dryer → ③ Downdraft gasifier → ④ Cyclone → ⑤ Wet scrubber
→ ⑥ Fine filter → ⑦ Blower → ⑨ Gas holder + flare → ⑧ Gas engine + generator → ⑨ Exhaust heat exchanger
(heat loops back to the dryer) → ⑩ Control panel + battery → ⑪ Village (LED streetlights, homes, clinic)
Side products: biochar bin + ash bin (from the gasifier bottom)
```

**Core behaviour:**
- The user enters a **weight of waste** and a **waste type** and clicks **Dump**. That waste flows through the plant in simulated real time.
- The **math runs every step**: temperatures rise, gas forms, the engine starts, the battery charges, and **village LEDs glow** for as long as that waste's energy lasts. More weight means the lights stay on longer.
- **Clicking any unit** opens a side panel with an **animated cut-away** of what happens inside, **live readings**, and the **equations with the current numbers substituted**.
- All operator values can be changed live (sliders), and everything is monitored (KPIs, charts, alarms, event log).

**Tech rules:**
- Plain **HTML + CSS + vanilla JavaScript**. No frameworks, no build step, no npm, no external libraries, no internet needed.
- Use classic `<script>` tags (NOT ES modules) with one global namespace `window.WTE`, so it also works by double-clicking `index.html`.
- Deployable as a **static site on Vercel** (no build command).
- Dark industrial theme, teal equipment colour (`#1f9a9a`), works at 1920×1080 for projectors.

---

## 2. File structure and team ownership

```
index.html                     B   page layout
css/style.css                  B   theme
js/engine/feedstocks.js        A   waste property table
js/engine/engine.js            A   ALL physics/chemistry/electrical math (NO DOM access)
js/engine/equations.js         A   per-unit text + live equations for the inspector
js/engine/hardware.js          A   optional Arduino (Web Serial) bridge
hardware/scale_and_leds/scale_and_leds.ino   A   optional Arduino sketch
js/ui/schematic.js             B   clickable SVG process-flow diagram
js/ui/inspector.js             B   slide-in panel with animated canvas cut-aways
js/ui/village.js               B   village SVG + 8-LED strip
js/ui/charts.js                B   trend charts (canvas)
js/ui/controls.js              B   left control panel, KPIs, alarms, log, forecast
js/main.js                     A+B animation loop (glue)
README.md, CONTRACT.md, WORK_SPLIT.md
```

**Person A** (math) never edits `js/ui/` or `css/`. **Person B** (visuals) never edits `js/engine/`.
They connect **only** through the snapshot object `sim.s` (Section 5) and `WTE.EQUATIONS`.

Script load order in `index.html`: feedstocks → engine → equations → hardware → schematic → inspector → village → charts → controls → main.

---

## 3. Feedstocks (`js/engine/feedstocks.js`)

`WTE.FEEDSTOCKS = { key: { name, moisture, ash, lhv, fc, color } }`
moisture = wet basis (as dumped). ash, fc (fixed carbon) and lhv (MJ/kg) are dry basis.

| key | name | moisture | ash | lhv | fc | color |
|---|---|---|---|---|---|---|
| wood | Wood chips | 0.25 | 0.010 | 18.5 | 0.17 | #b5793b |
| husk | Rice husk | 0.12 | 0.180 | 14.8 | 0.16 | #d9b45c |
| coconut | Coconut shells | 0.12 | 0.020 | 19.5 | 0.22 | #6e4426 |
| stalk | Crop stalks / straw | 0.18 | 0.060 | 16.5 | 0.15 | #c8a05a |
| rdf | Sorted organic waste (RDF) | 0.30 | 0.120 | 15.5 | 0.12 | #6f8a4a |

---

## 4. The math model (`js/engine/engine.js`)

### 4.1 Helpers
```
clamp(x,a,b)
lag(cur, target, tau, dt) = cur + (target − cur)·(1 − e^(−dt/tau))     // first-order response
smooth(a,b,x): t = clamp((x−a)/(b−a),0,1); return t²(3 − 2t)            // smoothstep
```
Export as `WTE.util`.

### 4.2 Constants `WTE.K`
```
LHV_CO = 12.63, LHV_H2 = 10.78, LHV_CH4 = 35.81   [MJ/Nm³]
AFR_ST = 6.0      kg air / kg dry biomass (stoichiometric)
RHO_AIR = 1.293   kg/Nm³
H_EVAP = 2600     kJ per kg water evaporated
CP_GAS = 1.4      kJ/(Nm³·K)
C_IN_CHAR = 0.75, STABLE_C = 0.8, CO2_PER_C = 44/12
TANK_NM3 = 4      gas holder volume
```

### 4.3 Operator parameters `WTE.DEFAULTS` (changeable live via `sim.set(key, value)`)
```
ER 0.28, targetMoisture 0.12, feedMode 'auto', feedRate 20 (kg/h, manual mode), minFeed 8, maxFeed 45,
autoStart true, engineEnabled true, shredderRate 60 (kg/h), shredderKW 1.2, dryerCap 25 (kg), bedCap 40 (kg),
bedFeedRate 120 (kg/h), scrubCap 300 (g tar), filterCap 60 (g), engineRated 15 (kWe), hxEff 0.65,
batteryKWh 30, battMaxKW 10, socMin 0.10, socMax 0.98, controlsKW 0.15,
streetlights 24, lampW 60, houses 10, houseW 300, clinicW 800, night true
```

### 4.4 Core correlations (export as `WTE.model`)
**Gas composition** `gasComposition(ER, M, Tred, feed)`, with values in vol %:
```
dE = ER − 0.28 ; dM = M − 0.12 ; dT = (Tred − 850)/100
CO  = 21  − 60·dE − 30·dM + 1.5·dT
H2  = 17  − 35·dE + 15·dM + 0.8·dT
CH4 = 2.5 −  6·dE          − 0.6·dT
CO2 = 11  + 50·dE + 20·dM − 1.8·dT
comb0 = CO + H2 + CH4
fq = clamp(feed.lhv/18.5, 0.78, 1.05)        // poorer fuel → leaner gas
q  = smooth(550, 800, Tred)                  // reduction zone must be hot
CO, H2, CH4 *= fq·q
CO2 += 0.6·(comb0 − (CO+H2+CH4))
CO ≥ 0.2, H2 ≥ 0.2, CH4 ≥ 0.1, CO2 clamp 1..30
N2  = 100 − CO − H2 − CH4 − CO2
LHV = (CO·12.63 + H2·10.78 + CH4·35.81)/100                 [MJ/Nm³]
airKg = ER·AFR_ST ; airNm3 = airKg/RHO_AIR                   [per kg dry]
gasYield = airNm3·0.79 / (N2/100)                            [Nm³/kg dry]  ← nitrogen balance
return {CO,H2,CH4,CO2,N2,LHV,airKg,airNm3,gasYield,q,fq}
```
**Oxidation temperature target:**
`oxidationTarget(ER, M, feedWet) = clamp(780 + 1500·ER − 1100·M − 150·(1 − smooth(3,15,feedWet)), 450, 1350)`
**Biochar fraction:** `charFraction(ER, fc) = fc·(0.35 + 1.2·max(0, 0.35 − ER))`
**Raw tar:** `tarRaw(Tox) = 0.3 + 6·(max(0, 1050 − Tox)/450)^1.5` [g/Nm³]
**Engine efficiency:** `engineEff(lf, LHV) = 0.28·(1 − 0.55·(1 − clamp(lf,0,1))²)·clamp(0.8 + 0.2·(LHV − 3.5)/1.5, 0.8, 1)`

### 4.5 Batch forecast `WTE.forecast(kg, type, p)` (shown before dumping)
```
M = min(f.moisture, p.targetMoisture); dry = kg·(1 − f.moisture)
Tox = oxidationTarget(p.ER, M, 20); g = gasComposition(p.ER, M, 25 + 0.8·(Tox − 25), f)
gasMJ = dry·g.gasYield·g.LHV·0.85            // 15% start-up / cool-down losses
grossKWh = gasMJ·engineEff(0.8, g.LHV)/3.6 ; netKWh = grossKWh·0.88
biochar = dry·charFraction(p.ER, f.fc) ; co2e = biochar·0.75·0.8·44/12
oneLampHours = netKWh·1000/p.lampW ; allLampsHours = netKWh·1000/(p.lampW·p.streetlights) ; homeDays = netKWh/3
return {dry, gasNm3, gasMJ, cge: gasMJ/(dry·f.lhv), grossKWh, netKWh, biochar, co2e, oneLampHours, allLampsHours, homeDays}
```

### 4.6 Material inventories
Each store = `{dry, water, ash, lhv, fc}` (ash/lhv/fc are dry-mass-weighted averages).
`wet(s) = dry + water`, `moist(s) = water/wet`.
`addParcel(s, pc)` blends properties by dry mass. `take(s, kg)` removes a proportional wet parcel and returns it.
Three stores: **hopper → dryer → bed** (gasifier).

### 4.7 `class Sim`: public API
```
constructor(): p = copy of DEFAULTS; reset()
reset(): cold empty plant, T all 25 °C, soc = 0.35, all totals 0, log = [], history = []
set(key, value)
dump(kg, type)                 → adds a parcel to hopper, event log
ignite()  → p.autoStart = true; ignite if any fuel exists
shutdown() → ignited = false; p.autoStart = false
changeScrubberWater(), replaceFilter(), emptyBins()
advance(simSeconds)            → repeated step(≤1 s)
event(msg)                     → log.unshift({t,msg}), keep 60
loadDemand(): clinic = clinicW/1000; lamps = night ? streetlights·lampW/1000 : 0;
              houseKW = houseW/1000·(night ? 1 : 0.5); total = clinic + lamps + houses·houseKW
```

### 4.8 `step(dt)`: the order of calculations each second
Rates are per hour, `h = dt/3600`.

1. **Hopper → shredder → dryer:** if the hopper has waste and the dryer has room (`dryerCap`), move at `shredderRate`. Shredder power = `shredderKW` while running.
2. **Dryer:** heat available `Qavail = Qcool + Qrec` (kW, from the previous step).
   `wTarget = dry·Mt/(1 − Mt)`; removable = water − wTarget; evaporation capacity `= Qavail·3600/2600` kg/h. Remove water. Fan 0.25 kW if not empty.
   Pass to the bed at `bedFeedRate` only if (dryer moisture ≤ target + 0.02 **or** bed < 25% full) and the bed has room.
3. **Gasifier:**
   - Auto-ignite if `autoStart` and bed > 2 kg. `burning = ignited && bed > 0.05 kg`. `Mbed` = bed moisture.
   - **Feed control (auto mode):** `gasNeed = Pset/eff·3.6/max(3, LHV_last)`; `corr = 1 + 1.5·(0.6 − tank/TANK_NM3)`; `feedTarget = clamp(gasNeed·corr/max(1,gasYield)/(1 − Mbed), minFeed, maxFeed)`. Manual mode uses `feedRate`. `feedWet = lag(feedWet, feedTarget, 60 s)`.
   - Consume `feedWet·h` from the bed.
   - Temperatures: `T.ox = lag(T.ox, burning ? oxidationTarget(..) : 25, burning ? 240 : 1500)`; `T.red → 25 + 0.80(Tox − 25)` (τ 120); `T.pyro → 25 + 0.42(..)` (τ 150); `T.dry → 25 + 0.13(..)` (τ 200). If ignited, no fuel, and Tox < 150 → goes out.
   - Gas: `g = gasComposition(ER, Mbed, T.red, bed)`; `dryRate = feedWet·(1 − Mbed)`; `Qraw = dryRate·gasYield` Nm³/h; `gasKW = Qraw·LHV/3.6`; `feedKW = dryRate·lhv/3.6`; `CGE = gasKW/feedKW`; `airKgH = dryRate·airKg`.
   - Biochar rate `= dryRate·charFraction·(0.4 + 0.6q)`; ash rate `= dryRate·ash`; biochar bin += char + 0.3·ash; ash bin += 0.7·ash; CO₂e += char·0.75·0.8·44/12.
   - `gasOutT = 25 + 0.6(T.red − 25)`; gas-cooler heat to dryer `Qcool = Qraw·1.4·max(0, gasOutT − 60)/3600·0.6` kW.
4. **Gas cleaning:**
   - dustRaw = 0.8 + 10·ash g/Nm³; tar = tarRaw(T.ox)
   - Cyclone: dust η 0.88, tar η 0.05
   - Scrubber: `waterQ = 1 − 0.5·smooth(0, scrubCap, scrubTar)`; tar η = 0.8·waterQ; dust η 0.9; captured tar accumulates in `scrubTar` (g); condensate = feedWet·Mbed·0.9 kg/h
   - Filter: tar η = 0.9·(1 − 0.6·smooth(0.8cap, 1.2cap, filterLoad)); dust η 0.95; captured accumulates in `filterLoad`; `Δp = 0.3 + 2.2·filterLoad/filterCap` kPa; `tarOutMg = tar·1000` (engine spec < 100 mg/Nm³)
5. **Blower:** `dpTot = (1.0 + 0.5(Qraw/40)²) + 0.4 + 0.8 + filterΔp`; power = `0.12 + (Qraw/3600)·dpTot/0.45` kW when flowing; rpm lag to 1500 + 1200·min(1, Qraw/60). Scrubber pump 0.37 kW when flowing.
6. **Gas holder + flare:** `gasOK = LHV ≥ 3.2 && flowing`. If OK, gas goes into the tank (mix LHV by volume); otherwise it goes to the flare (start-up). Tank over `TANK_NM3` → excess flared. Displayed flare rate is lagged (τ 5 s).
7. **Demand & set-point:** parasitic = shredder + dryer fan + blower + pump + controls. Battery room = (socMax − soc)·batteryKWh; chargeWant = min(battMaxKW, room/0.25). `Pset = min(engineRated, load + parasitic + chargeWant)`.
8. **Engine:** start when enabled, tank ≥ 0.8 Nm³ and tank LHV ≥ 3.6; stop when disabled, tank < 0.05 or LHV < 3.0. `Pgen = lag(Pgen, on ? Pset : 0, on ? 12 : 3)`; `lf = Pgen/rated`; `eta = engineEff(max(lf,0.05), tankLHV)`; `fuelKW = Pgen/eta`; `gasUse = fuelKW·3.6/tankLHV` Nm³/h, limited by the tank contents. rpm lag to 1500; exhaust temp lag to 380 + 220·lf (τ 30). freq = rpm/1500·50 Hz; voltage 415 V.
9. **Heat exchanger:** `Qexh = 0.33·fuelKW`; `Qrec = hxEff·Qexh` (goes to the dryer next step); `T_out = Texh − hxEff·(Texh − 120)`.
10. **Electrical bus (priority dispatch):** available = Pgen + (soc > socMin ? battMaxKW : 0). Serve in order: **plant parasitic → clinic (all or nothing) → streetlights (whole lamps, ⌊P/lampW⌋) → homes (whole homes)**. Battery = served − Pgen (+ discharge). If negative, charge up to min(battMaxKW, room/h); the rest is curtailed. SOC update with η 0.95 each way.
11. **Totals:** feedMJ, gasMJ, elecKWh, parKWh, servedKWh, flaredMJ, heatRecMJ, waterKg, co2e, dumpedKg.
12. **Alerts** `{lvl:'info'|'warn'|'bad', unit, msg}`: low gas LHV (< 3.5) while burning; tar > 100 mg/Nm³; scrubber waterQ < 0.65; filter > 80% loaded; holder full and flaring; start-up flare; load shedding; fuel running low.
13. **History:** every 30 s of sim time push `{t, Pgen, served, soc, Tox, LHV, Q}`; keep 720 samples.
14. **Build the snapshot `this.s`** (Section 5).

---

## 5. The snapshot contract `sim.s` (the ONLY thing the UI reads)
```
t, p (current parameters)
hopper   { kg, moisture, lhv }
shredder { on, rate, kW }
dryer    { kg, mIn, mOut, target, Qavail, Qused, Qcool, Qrec, evapRate, airT = clamp(25 + 9·Qavail, 25, 220), fanKW, toBedRate }
gasifier { ignited, burning, bedKg, bedFill, moisture, feedWet, feedDry, ER, airKgH, T{dry,pyro,ox,red}, gasOutT, comp, LHV,
           gasYield, Qraw, gasKW, feedKW, CGE, charRate, ashRate, co2eRate, tarRaw, dustRaw, q, ash, fc, lhvDry }
cyclone  { dustIn, dustOut, tarOut, eff, Tout, Q }
scrubber { tarIn, tarOut, dustOut, eff, waterQ, loadG, condRate, pumpKW, Tout, Q }
filter   { tarIn, tarOutMg, dustOutMg, eff, dp, loadG, loadPct, Q }
blower   { Q, dp, kW, rpm }
tank     { nm3, fill, pressure = 0.5 + 4.5·fill, LHV, inRate, outRate, flareRate, flareKW, gasOK, mode }
engine   { on, P, Pset, rated, lf, eff, fuelKW, gasNm3h, rpm, Texh, freq, voltage }
hx       { Tin, Tout, Qexh, Qrec, eff }
panel    { soc, socKWh, battKW, Pgen, parasitic, servedPar, demand, served, curtailed, unserved, mode }
village  { night, clinicOn, lampsLit, lampsTotal, housesLit, housesTotal, demand, served, servedFrac, ledsLit = round(8·served/demand) }
bins     { biochar, ash, dust, condensate, tarSludge }
tot      { dumpedKg, feedMJ, gasMJ, elecKWh, parKWh, servedKWh, flaredMJ, heatRecMJ, waterKg, co2e }
alerts   [ {lvl, unit, msg} ]
```
**Unit ids:** `hopper dryer gasifier bins cyclone scrubber filter blower tank engine hx panel village`

---

## 6. Inspector text & equations (`js/engine/equations.js`)
`WTE.EQUATIONS[unitId](s)` returns `{ title, inside, readings:[[label,value]], eq:[[name, formula-with-numbers, result]], reactions? }`.
- **inside**: one plain-language sentence about what is happening now (it changes with state: cold, starting, running, empty).
- **eq**: show each formula from Section 4 **with the live numbers substituted**, e.g. `ṁ_air = ER·AFR·ṁ_dry = 0.28·6·17.6 → 29.6 kg/h`.
- Gasifier **reactions** by zone (with the live zone temperature in the heading):
  - Drying: H₂O(l) → H₂O(g)
  - Pyrolysis: Biomass → char + tar + volatiles (CO, CO₂, CH₄, H₂)
  - Oxidation: C + O₂ → CO₂ (−394 kJ/mol); 2H₂ + O₂ → 2H₂O
  - Reduction: C + CO₂ ⇌ 2CO (+172, Boudouard); C + H₂O ⇌ CO + H₂ (+131, water-gas); CO + H₂O ⇌ CO₂ + H₂ (−41, shift); C + 2H₂ ⇌ CH₄ (−75)
- Bins: show biochar value (₹25/kg) + carbon credit (₹2/kg CO₂e).
- Show "no gas" instead of composition numbers when Qraw < 0.1.

---

## 7. User interface

### 7.1 Layout
- **Top bar:** title "Decentralized Waste-to-Energy Microgrid with Biochar", Play/Pause, Speed select (1×, 10×, **60× default**, 300×, 900×), plant clock HH:MM:SS, Night/Day toggle, Reset.
- **KPI strip (10 cards):** waste in system (kg), gasifier T_ox (coloured by temperature), producer gas Nm³/h, gas LHV, generator kWe, battery %, lights on x/y, energy delivered kWh, biochar kg, CO₂ locked kg. Small progress bars.
- **Left column (300 px):**
  1. *Dump waste*: type select, weight input + Dump button, quick buttons +5/+10/+25/+50/+100/+250 kg, **forecast box** ("50 kg → 24.3 kWh net = all 24 streetlights for 16.9 h = one 60 W LED for 405 h · biochar 2.8 kg · locks 6.1 kg CO₂"), updated live as the weight/type/sliders change.
  2. *Operate*: ER slider (0.18–0.45), dryer set-point (6–30%), auto-feed checkbox / manual feed slider (5–45 kg/h), Ignite, Stop gasifier, Engine enabled.
  3. *Village load*: streetlights (0–40), homes (0–30).
  4. *Real scale + LEDs (optional)*: Connect Arduino button, kg-per-gram input, status.
- **Centre:** process-flow SVG (viewBox 1600×640) → below it, village SVG + 8-LED strip, and trend charts → below that, Alarms list (click → opens that unit) and Event log.
- **Inspector:** fixed right drawer (max 560 px), slides in; canvas 300 px tall; "inside" sentence; action buttons; Live readings (2-column grid); "Math behind it" table; Reactions (gasifier only). Close with ✕ or Esc.

### 7.2 Process-flow SVG (`schematic.js`)
- Mirror the concept image left→right: hopper+shredder (1), dryer (2), tall gasifier with 4 zone rectangles (3) and biochar (green) + ash (grey) bins under it, cyclone (4), scrubber with water tank + pump (5), filter (6), blower (7), gas holder with flare stack (9), engine enclosure with 4 cylinders, flywheel and generator "G" (8), heat exchanger on top of the engine (9), control cabinet with screen, 3 LEDs and 2 battery modules (10), SCADA laptop (dashed data line), mini village with 3 houses and 5 lamps (11).
- Numbered teal badges on every unit, and a small status tag under each (e.g. "1062°C · 36 Nm³/h", "60% · 5.4MJ", "15.0 kWe", "🔋 40%", "24/24 lights").
- Each unit is `<g class="unit" data-id="...">` with a transparent hit-rect; hover = dashed outline, selected = yellow outline; click → open inspector.
- **Pipes** coloured by type: biomass brown, producer gas cyan, air blue, waste heat orange dashed (from the HX over the top back to the dryer, labelled "waste heat → dryer ♨ X kW"), electricity yellow, char dark grey. Animated with `stroke-dasharray` + `stroke-dashoffset` moving at a speed proportional to the flow; nearly invisible when the flow is 0.
- **Live visuals:** hopper pile height, rotating shredder rotors, dryer glow ∝ heat, steam wisps ∝ evaporation, **gasifier zone fill colour = temperature colour map** (25 °C dark brown → 600 red → 1000 orange → 1250 pale yellow), zone labels "Oxidation 1066°C", fire glow, scrubber water browns as it gets dirty, filter darkens with load, impeller rotation ∝ rpm, tank fill level, flare flame size ∝ flare rate, pistons and flywheel move with rpm, HX fins glow ∝ heat, battery bars by SOC (green/amber/red), panel LEDs (gen on, battery state, blinking alarm), mini-village lamps/windows lit.

### 7.3 Inspector canvas animations (`inspector.js`)
Logical canvas 520×300, scaled to fit, devicePixelRatio aware. One draw function per unit:
- **hopper**: hopper pile, two toothed rotors spinning in opposite directions, big chips falling in, small chips leaving on a conveyor.
- **dryer**: chips moving along a belt and changing colour from wet to dry, hot-air dots rising, steam puffs ∝ evapRate, labels for M in/out and heat sources.
- **gasifier**: column with 4 coloured zones, side temperature labels, throat constriction, flame gradient in the oxidation zone, ~110 particles falling (brown → dark → glowing → black char, shrinking), pyrolysis vapour squiggles, blue air jets from both sides, dashed grate, char dots falling out ("biochar X kg/h"), gas-out arrow, **stacked gas-composition bar** (CO, H₂, CH₄, CO₂, N₂) with LHV and η_cg.
- **cyclone**: particles spiralling; heavy ones at the wall sliding down, light ones in the centre going up.
- **scrubber**: falling spray droplets, rising gas bubbles, water colour by quality, water-quality bar.
- **filter**: media layers darkening with load, particles getting stuck, Δp and load bars, tar-out value (red if > 100).
- **blower**: curved-blade impeller rotating (slowed), Q, Δp, kW.
- **tank**: fill level, pressure, mode, particle flame at the flare stack ∝ flare rate, in/out arrows.
- **engine**: 4 cylinders with pistons (1/25 slow motion), combustion glow on the power stroke, spark, crank rod, rotating alternator with red/blue poles, yellow sine wave output, "15.00 kWe · 50.0 Hz · 415 V", "ENGINE STOPPED" when off.
- **hx**: counter-flow lanes (hot exhaust left→right, fresh air right→left) with moving dots and temperatures.
- **panel**: power-flow diagram Generator → AC bus → Plant aux / Village / Battery, with animated dashed lines whose width ∝ kW and labels; SOC bar.
- **village**: night sky, road, lamp posts with light cones when lit, houses with lit windows.
- **bins**: biochar heap and ash heap growing, "🌱 X kg CO₂ locked in soil".

Inspector action buttons: hopper (+25, +100 kg), gasifier (Ignite, ER −0.02, ER +0.02), scrubber (Change water), filter (Replace filter, Change water), engine (Toggle engine), bins (Bag biochar), village (Toggle day/night).

### 7.4 Village (`village.js`)
SVG 900×240: night sky with stars (day = blue), grass, road with dashed centre line, clinic with red cross (window lit when served), homes along the top (windows lit for the first `housesLit`), lamp posts in two staggered rows (bulb + halo + light pool for the first `lampsLit`). Rebuild when the counts change. **8-LED HTML strip** showing `ledsLit` (glowing yellow).

### 7.5 Charts (`charts.js`)
Two dependency-free canvas line charts from `sim.history`: (1) Generator kW, Village kW, Battery %; (2) T_oxidation, Gas LHV, Gas flow. Legend with current values; "collecting data…" until 2 samples exist.

### 7.6 Main loop (`main.js`)
`requestAnimationFrame`: `dtReal = min(0.1 s)`; if playing, `sim.advance(dtReal·speed)`; update schematic, inspector canvas and village **every frame**; update tags, inspector text, controls/KPIs/alarms/log, charts and the hardware LED message **4× per second**. Expose `WTE.sim` for the console.

---

## 8. Optional hardware (`hardware.js` + Arduino)
- Web Serial at 115200 baud (Chrome/Edge, needs localhost or https). Arduino sends `W:<grams>\n` every 150 ms from an HX711 load cell (DT→A1, SCK→A0). The browser sends `L:<0-8>,<0-255>\n`, and the Arduino lights LEDs on D2–D9.
- Dump detection: keep the last 6 readings. When stable (spread < max(2 g, 3%)) and the increase is > 5 g → `sim.dump(increase·kgPerGram, selectedType)`. When the reading is < 3 g, rearm.

---

## 9. Stage prompts for Antigravity (give them one at a time)

**Stage 1: Skeleton**
> Read ANTIGRAVITY_BUILD_SPEC.md fully. Create the file structure from Section 2 and `index.html` with the layout in Section 7.1 (empty containers are fine), `css/style.css` with the dark teal theme, and `js/engine/feedstocks.js` from Section 3. Use classic script tags and the global `window.WTE`. Start a local server and show me the page.
✅ Check: the page opens with the top bar, left panel and empty centre; the waste-type dropdown lists 5 types.

**Stage 2: Math engine**
> Read ANTIGRAVITY_BUILD_SPEC.md Section 4 and Section 5. Implement `js/engine/engine.js` exactly as specified (helpers, constants, DEFAULTS, correlations, forecast, inventories, Sim class, step order 1–14, snapshot). No DOM code in this file. Then add a temporary test in the browser console: create a Sim, dump 50 kg wood, advance in 30-minute steps for 10 hours and print Tox, LHV, Qraw, CGE, tank, engine P, SOC, lamps lit, biochar.
✅ Check (50 kg wood, defaults): engine starts ≈ 15 min · T_ox ≈ 1050–1070 °C · LHV ≈ 5.3–5.4 MJ/Nm³ · gas ≈ 36 Nm³/h · CGE ≈ 61–62% · engine 15 kWe · tar to engine < 10 mg/Nm³ · ≈ 27 kWh gross · lights stay on ≈ 6 h then go off when SOC hits 10% · RDF starts slower (≈ 24 min).

**Stage 3: Process-flow diagram**
> Read Section 7.2. Implement `js/ui/schematic.js` and a minimal `js/main.js` loop (Section 7.6) so the SVG diagram animates from `sim.s`. Add the Dump controls so I can dump waste.
✅ Check: dumping waste makes the hopper fill, rotors spin, gasifier zones change colour as they heat, gas pipes start flowing, the flare lights at start-up, then the engine runs and the battery bars change.

**Stage 4: Inspector + equations**
> Read Sections 6 and 7.3. Implement `js/engine/equations.js` and `js/ui/inspector.js`. Clicking any unit in the diagram opens the drawer with the animated canvas, the inside sentence, live readings, the equations with numbers substituted, and gasifier reactions. Add the action buttons.
✅ Check: open every one of the 13 units, both cold and running, with no console errors; changing ER with the buttons changes T_ox and the gas composition bar.

**Stage 5: Village, KPIs, controls, charts, alarms**
> Read Sections 7.1, 7.4 and 7.5. Implement `js/ui/village.js`, `js/ui/charts.js` and `js/ui/controls.js` (all sliders, forecast box, KPI cards, alarms clickable to open the unit, event log, speed, pause, night/day, reset).
✅ Check: the forecast updates while typing a weight; at 900× the lights go off when the battery is empty and come back after a new dump; the alarms list shows "Filter loaded" after long rice-husk runs.

**Stage 6: Hardware (optional)**
> Read Section 8. Implement `js/engine/hardware.js` and `hardware/scale_and_leds/scale_and_leds.ino`, and wire the Connect Arduino button.

**Stage 7: Our own features** (do after the base works)
> Add a "▶ Guided Demo" button: reset, dump 50 kg wood, speed 300×, then every 6 s open gasifier → tank → engine → hx → panel → village → bins with a caption explaining each step.

> Add `s.econ` in engine.js (electricity ₹8/kWh served, biochar ₹25/kg, carbon credit ₹2/kg CO₂e, running cost ₹3/kg waste, total profit, payback estimate) and show it as an Economics card. Update CONTRACT.md.

> Add a "Tuning & Monitor" tab: every WTE.DEFAULTS value as an editable box calling sim.set live, a live table of every number in sim.s (4 Hz), and a "Download CSV" button for sim.history.

**Stage 8: Docs + deploy**
> Write README.md (what it is, how to run, folder map, model summary), CONTRACT.md (Section 5 + public methods) and WORK_SPLIT.md (Person A / Person B task lists + 3-minute demo script). Then initialise git, create a `.gitignore`, and make the first commit.

---

## 10. Deploy (GitHub + Vercel)
1. github.com → **New repository** → name `waste-to-energy-microgrid` → **Public** → no README → Create.
2. In the Antigravity terminal:
   ```
   git branch -M main
   git remote add origin https://github.com/<USERNAME>/waste-to-energy-microgrid.git
   git push -u origin main
   ```
3. vercel.com → Continue with GitHub → **Add New → Project** → Import the repo → Framework Preset **Other**, leave Build/Output empty → **Deploy**.
4. Public link: `https://waste-to-energy-microgrid.vercel.app`. Every `git push` redeploys automatically.

## 11. 3-minute demo script
1. Problem: villages dump/burn agri-waste and lack reliable power.
2. Dump 50 kg wood chips → read the forecast aloud.
3. Click the gasifier → zones heating, reactions, live equations; change ER ±0.02.
4. Click the tank → start-up flare, then the interlock opens and the engine starts.
5. Click the dryer/HX → engine waste heat dries the next batch (CHP loop).
6. Village → LEDs glow; 900× → fuel ends, the battery carries the load, then lights go off; dump again and they return.
7. Biochar bin → kg biochar + CO₂ locked = second revenue stream.
8. (Optional) real load cell → real LEDs.
