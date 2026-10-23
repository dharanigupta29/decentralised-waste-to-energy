# Engine ⇄ UI contract

**The rule:** Person A's engine never touches the DOM. Person B's UI never does physics. They talk only through:

1. **`sim.s`**, a plain snapshot object rebuilt every step (read-only for the UI)
2. **Public methods** on `WTE.Sim`
3. **`WTE.EQUATIONS[id](s)`**, the text/equations each inspector shows (owned by A, rendered by B)

If you add a field, add it here in the same commit.

## Public methods (`js/engine/engine.js`)

| Method | What it does |
|---|---|
| `sim.dump(kg, type)` | Put waste into the hopper. `type` is a key of `WTE.FEEDSTOCKS` |
| `sim.advance(seconds)` | Integrate the plant forward (internally 1 s steps) |
| `sim.set(key, value)` | Change an operator parameter (keys listed in `WTE.DEFAULTS`) |
| `sim.ignite()` / `sim.shutdown()` | Gasifier start / stop (stop also disables auto-start) |
| `sim.changeScrubberWater()` / `sim.replaceFilter()` / `sim.emptyBins()` | Maintenance |
| `sim.reset()` | Back to a cold, empty plant |
| `WTE.forecast(kg, type, sim.p)` | Steady-state prediction for a batch (kWh, lamp-hours, biochar, CO₂e) |
| `sim.history` | Array, one sample every 30 s sim time: `{t, Pgen, served, soc, Tox, LHV, Q}` |
| `sim.log` | Events, newest first: `{t, msg}` |

## Snapshot `sim.s` (units in brackets)

```
t [s]                       p  (current parameters, same keys as WTE.DEFAULTS)
hopper   { kg, moisture[0-1], lhv[MJ/kg] }
shredder { on, rate[kg/h], kW }
dryer    { kg, mIn, mOut, target, Qavail, Qused, Qcool, Qrec [kW], evapRate[kg/h], airT[°C], fanKW, toBedRate[kg/h] }
gasifier { ignited, burning, bedKg, bedFill, moisture, feedWet, feedDry [kg/h], ER, airKgH,
           T{dry,pyro,ox,red}[°C], gasOutT, comp{CO,H2,CH4,CO2,N2 [%], LHV, gasYield, q, airKg, airNm3},
           LHV[MJ/Nm3], gasYield[Nm3/kg], Qraw[Nm3/h], gasKW, feedKW, CGE[0-1],
           charRate, ashRate, co2eRate [kg/h], tarRaw, dustRaw [g/Nm3], ash, fc, lhvDry }
cyclone  { dustIn, dustOut, tarOut [g/Nm3], eff, Tout, Q }
scrubber { tarIn, tarOut, dustOut [g/Nm3], eff, waterQ[0-1], loadG[g], condRate[kg/h], pumpKW, Tout, Q }
filter   { tarIn[g/Nm3], tarOutMg, dustOutMg [mg/Nm3], eff, dp[kPa], loadG, loadPct, Q }
blower   { Q[Nm3/h], dp[kPa], kW, rpm }
tank     { nm3, fill, pressure[kPa g], LHV, inRate, outRate, flareRate [Nm3/h], flareKW, gasOK, mode }
engine   { on, P, Pset, rated [kW], lf, eff, fuelKW, gasNm3h, rpm, Texh, freq[Hz], voltage[V] }
hx       { Tin, Tout [°C], Qexh, Qrec [kW], eff }
panel    { soc[0-1], socKWh, battKW(+ = discharging), Pgen, parasitic, servedPar, demand, served, curtailed, unserved [kW], mode }
village  { night, clinicOn, lampsLit, lampsTotal, housesLit, housesTotal, demand, served, servedFrac, ledsLit(0-8) }
bins     { biochar, ash, dust, condensate, tarSludge [kg] }
tot      { dumpedKg, feedMJ, gasMJ, elecKWh, parKWh, servedKWh, flaredMJ, heatRecMJ, waterKg, co2e }
econ     { electricity, biochar, carbon, cost, profit [₹] }
alerts   [ { lvl: 'info'|'warn'|'bad', unit: <unit id>, msg } ]
```

Economic rates in `WTE.DEFAULTS`:
- `rateElec`: ₹8 per kWh of `tot.servedKWh`
- `rateBiochar`: ₹25 per kg of `bins.biochar`
- `rateCarbon`: ₹2 per kg of `tot.co2e`
- `rateCost`: ₹3 per kg of `tot.dumpedKg` (operating cost)
- `profit`: `electricity + biochar + carbon − cost`

Unit ids (used by the schematic, the inspector, EQUATIONS and alerts):
`hopper dryer gasifier bins cyclone scrubber filter blower tank engine hx panel village`
