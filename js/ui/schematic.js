// OWNER: PERSON B (visualisation)
// Builds the clickable SVG process-flow diagram (mirrors the concept image) and animates it from the snapshot.
(function () {
  'use strict';
  const WTE = window.WTE;

  const TEMP_STOPS = [[25, [58, 47, 37]], [200, [91, 58, 30]], [400, [122, 42, 18]], [600, [184, 50, 15]], [800, [232, 88, 12]], [1000, [255, 154, 31]], [1250, [255, 230, 130]]];
  function tempColor(T) {
    for (let i = 1; i < TEMP_STOPS.length; i++) {
      const [t1, c1] = TEMP_STOPS[i];
      if (T <= t1 || i === TEMP_STOPS.length - 1) {
        const [t0, c0] = TEMP_STOPS[i - 1];
        const k = Math.max(0, Math.min(1, (T - t0) / (t1 - t0)));
        return `rgb(${c0.map((c, j) => Math.round(c + (c1[j] - c) * k)).join(',')})`;
      }
    }
  }
  WTE.tempColor = tempColor;

  // pipes: path, colour, width, flow-rate (0..1) from snapshot
  const PIPES = [
    { id: 'conv1', d: 'M240 335 H272', c: 'var(--bio)', w: 8, r: (s) => (s.shredder.on ? 0.8 : 0) },
    { id: 'conv2', d: 'M362 262 V150 H432', c: 'var(--bio)', w: 8, r: (s) => Math.min(1, s.dryer.toBedRate / 60) },
    { id: 'air1', d: 'M380 296 H430', c: 'var(--air)', w: 5, r: (s) => Math.min(1, s.gasifier.airKgH / 40) },
    { id: 'air2', d: 'M380 322 H430', c: 'var(--air)', w: 5, r: (s) => Math.min(1, s.gasifier.airKgH / 40) },
    { id: 'gas1', d: 'M540 400 H566 V266 H596', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.gasifier.Qraw / 50) },
    { id: 'gas2', d: 'M620 240 V224 H725 V246', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.gasifier.Qraw / 50) },
    { id: 'gas3', d: 'M770 282 H811', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.gasifier.Qraw / 50) },
    { id: 'gas4', d: 'M860 385 H886', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.gasifier.Qraw / 50) },
    { id: 'gas5', d: 'M945 385 H986', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.tank.inRate / 50) },
    { id: 'flare', d: 'M1065 330 H1088 V180', c: 'var(--gas)', w: 6, r: (s) => Math.min(1, s.tank.flareRate / 40) },
    { id: 'gas6', d: 'M1065 412 H1112', c: 'var(--gas)', w: 7, r: (s) => Math.min(1, s.engine.gasNm3h / 50) },
    { id: 'exh', d: 'M1200 300 V268 H1292', c: '#aaa', w: 6, r: (s) => (s.engine.on ? 0.7 : 0) },
    { id: 'heat', d: 'M1312 246 V48 H300 V262', c: 'var(--heat)', w: 4, r: (s) => Math.min(1, (s.dryer.Qrec) / 12), dash: true },
    { id: 'elec1', d: 'M1320 392 H1362', c: 'var(--elec)', w: 5, r: (s) => Math.min(1, s.engine.P / 12) },
    { id: 'elec2', d: 'M1440 392 H1462', c: 'var(--elec)', w: 5, r: (s) => Math.min(1, s.village.served / 6) },
    { id: 'char', d: 'M466 472 V540', c: '#555', w: 6, r: (s) => Math.min(1, s.gasifier.charRate / 1.5) },
    { id: 'ashp', d: 'M512 472 V548', c: '#888', w: 5, r: (s) => Math.min(1, s.gasifier.ashRate / 0.5) },
  ];

  const svgNS = 'http://www.w3.org/2000/svg';
  const badge = (n, x, y) => `<circle class="badge" cx="${x}" cy="${y}" r="15"/><text class="badge-t" x="${x}" y="${y + 1}">${n}</text>`;
  const tag = (id, x, y, w = 120) => `<rect class="tagbg" x="${x - w / 2}" y="${y - 12}" width="${w}" height="22" rx="6"/><text class="tag" id="tag-${id}" x="${x}" y="${y + 4}">-</text>`;
  const metal = 'url(#gTeal)';

  function build(svg) {
    let pipesBase = '', pipesFlow = '';
    PIPES.forEach((p) => {
      pipesBase += `<path class="pipe" d="${p.d}" stroke="${p.dash ? 'transparent' : '#2b3e45'}" stroke-width="${p.w + 4}"/>`;
      pipesFlow += `<path class="flow" id="pf-${p.id}" d="${p.d}" stroke="${p.c}" stroke-width="${p.w}" ${p.dash ? 'stroke-dasharray="10 8"' : ''}/>`;
    });
    svg.innerHTML = `
    <defs>
      <linearGradient id="gTeal" x1="0" x2="1"><stop offset="0" stop-color="#1b6f72"/><stop offset=".45" stop-color="#2aa5a2"/><stop offset="1" stop-color="#15595c"/></linearGradient>
      <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6ff" stop-opacity=".8"/><stop offset="1" stop-color="#1a6fb0"/></linearGradient>
      <radialGradient id="gGlow"><stop offset="0" stop-color="#ffd23f" stop-opacity=".9"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>
      <radialGradient id="gFire"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ff8a1f"/><stop offset="1" stop-color="#ff3d00" stop-opacity="0"/></radialGradient>
      <filter id="fBlur"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <text class="lbl" id="tag-heat" x="800" y="38" style="fill:var(--heat);font-weight:600">waste heat → dryer</text>
    ${pipesBase}

    <!-- 1 hopper + shredder -->
    <g class="unit" data-id="hopper">
      <rect class="hit" x="18" y="190" width="232" height="225"/>
      <path d="M30 240 L150 240 L125 305 L55 305 Z" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <clipPath id="cpHop"><path d="M30 240 L150 240 L125 305 L55 305 Z"/></clipPath>
      <rect id="hopPile" clip-path="url(#cpHop)" x="30" y="305" width="120" height="0" fill="var(--bio)"/>
      <rect x="62" y="305" width="56" height="20" fill="#176466"/>
      <path d="M65 325 L60 380 M115 325 L120 380" stroke="#176466" stroke-width="6"/>
      <rect x="160" y="285" width="80" height="78" rx="6" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <rect x="168" y="300" width="64" height="48" rx="4" fill="#0b2226"/>
      <g id="rotA"><circle cx="188" cy="324" r="14" fill="#555" stroke="#999" stroke-width="2" stroke-dasharray="4 3"/><path d="M188 312 V336 M176 324 H200" stroke="#bbb" stroke-width="2"/></g>
      <g id="rotB"><circle cx="213" cy="324" r="14" fill="#555" stroke="#999" stroke-width="2" stroke-dasharray="4 3"/><path d="M213 312 V336 M201 324 H225" stroke="#bbb" stroke-width="2"/></g>
      <rect x="196" y="270" width="18" height="16" fill="#176466"/>
      ${badge(1, 90, 212)} ${tag('hopper', 130, 400)}
    </g>

    <!-- 2 dryer -->
    <g class="unit" data-id="dryer">
      <rect class="hit" x="262" y="215" width="138" height="230"/>
      <rect x="272" y="262" width="118" height="148" rx="6" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <rect x="284" y="280" width="94" height="96" rx="4" fill="#1a1410" stroke="#0c3d40"/>
      <rect id="dryGlow" x="284" y="280" width="94" height="96" rx="4" fill="#ff7a1f" opacity="0"/>
      <rect id="dryBed" x="284" y="376" width="94" height="0" fill="var(--bio)"/>
      <g id="drySteam" stroke="#ffb070" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0">
        <path d="M305 350 q6 -10 0 -20 q-6 -10 0 -20"/><path d="M330 350 q6 -10 0 -20 q-6 -10 0 -20"/><path d="M355 350 q6 -10 0 -20 q-6 -10 0 -20"/>
      </g>
      ${badge(2, 330, 236)} ${tag('dryer', 331, 430)}
    </g>

    <!-- 3 gasifier + bins -->
    <g class="unit" data-id="gasifier">
      <rect class="hit" x="400" y="62" width="168" height="420"/>
      <rect x="470" y="96" width="30" height="16" fill="#176466"/>
      <path d="M428 125 Q485 85 542 125 Z" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <rect x="428" y="118" width="114" height="312" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <rect id="z-dry" x="438" y="124" width="94" height="72" fill="#3a2f25"/>
      <rect id="z-pyro" x="438" y="196" width="94" height="72" fill="#3a2f25"/>
      <rect id="z-ox" x="438" y="268" width="94" height="76" fill="#3a2f25"/>
      <rect id="z-red" x="438" y="344" width="94" height="76" fill="#3a2f25"/>
      <circle id="oxGlow" cx="485" cy="306" r="40" fill="url(#gFire)" opacity="0"/>
      <path d="M438 420 H532" stroke="#999" stroke-width="5" stroke-dasharray="6 4"/>
      <path d="M428 430 L542 430 L520 470 L450 470 Z" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <text class="zlbl" id="zl-dry" x="442" y="140">Drying</text>
      <text class="zlbl" id="zl-pyro" x="442" y="212">Pyrolysis</text>
      <text class="zlbl" id="zl-ox" x="442" y="284">Oxidation</text>
      <text class="zlbl" id="zl-red" x="442" y="360">Reduction</text>
      ${badge(3, 485, 76)} ${tag('gasifier', 485, 500, 130)}
    </g>
    <g class="unit" data-id="bins">
      <rect class="hit" x="408" y="530" width="168" height="108"/>
      <path d="M418 540 H514 L506 615 H426 Z" fill="#2f7d32" stroke="#1b4d1d" stroke-width="2"/>
      <clipPath id="cpChar"><path d="M418 540 H514 L506 615 H426 Z"/></clipPath>
      <rect id="charPile" clip-path="url(#cpChar)" x="418" y="615" width="96" height="0" fill="#1b1b1b"/>
      <path d="M522 548 H572 L566 612 H528 Z" fill="#6b7377" stroke="#3b4245" stroke-width="2"/>
      <text class="lbl" x="466" y="582" style="fill:#e8ffe8">biochar</text>
      <text class="lbl" x="547" y="584" style="fill:#eee">ash</text>
      ${tag('bins', 495, 628, 160)}
    </g>

    <!-- 4 cyclone -->
    <g class="unit" data-id="cyclone">
      <rect class="hit" x="580" y="196" width="80" height="268"/>
      <rect x="596" y="244" width="48" height="70" rx="4" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <path d="M596 314 L644 314 L628 398 L612 398 Z" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <path id="cycSwirl" d="M604 262 q16 10 32 0 M606 280 q14 9 28 0 M608 298 q12 8 24 0" stroke="#cfe" stroke-width="1.5" fill="none" opacity=".2"/>
      <rect x="606" y="398" width="28" height="26" rx="3" fill="#455" stroke="#233"/>
      ${badge(4, 620, 206)} ${tag('cyclone', 620, 446, 92)}
    </g>

    <!-- 5 scrubber -->
    <g class="unit" data-id="scrubber">
      <rect class="hit" x="670" y="196" width="150" height="320"/>
      <rect x="680" y="246" width="90" height="192" rx="18" fill="#2b4b55" stroke="#0c3d40" stroke-width="2"/>
      <rect id="scrubWater" x="686" y="320" width="78" height="112" rx="12" fill="url(#gWater)"/>
      <g id="scrubSpray" stroke="#9fe0ff" stroke-width="2" opacity=".2"><path d="M700 262 v14 M712 262 v18 M725 262 v14 M738 262 v18 M750 262 v14"/></g>
      <rect x="688" y="458" width="84" height="40" rx="4" fill="#173a44" stroke="#2b5c66"/>
      <rect id="scrubTankWater" x="691" y="470" width="78" height="25" fill="#2a8ac0"/>
      <circle cx="796" cy="478" r="15" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <path d="M725 438 V458 M781 478 H772 M796 463 V430 H770" stroke="#2b5c66" stroke-width="4" fill="none"/>
      ${badge(5, 725, 214)} ${tag('scrubber', 745, 520, 110)}
    </g>

    <!-- 6 filter -->
    <g class="unit" data-id="filter">
      <rect class="hit" x="798" y="210" width="74" height="232"/>
      <rect x="811" y="262" width="49" height="140" rx="10" fill="#9aa9ad" stroke="#4a5a5e" stroke-width="2"/>
      <rect id="filterLoad" x="816" y="270" width="39" height="124" rx="5" fill="#5a3d1f" opacity="0"/>
      <path d="M814 285 H857 M814 300 H857 M814 315 H857 M814 330 H857 M814 345 H857 M814 360 H857 M814 375 H857" stroke="#6b7b80" stroke-width="2"/>
      ${badge(6, 835, 232)} ${tag('filter', 835, 424, 92)}
    </g>

    <!-- 7 blower -->
    <g class="unit" data-id="blower">
      <rect class="hit" x="878" y="300" width="76" height="155"/>
      <circle cx="916" cy="385" r="30" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <g id="impeller"><path d="M916 362 V408 M893 385 H939 M900 369 L932 401 M932 369 L900 401" stroke="#dff" stroke-width="3"/></g>
      <rect x="896" y="413" width="40" height="18" fill="#176466"/>
      ${badge(7, 916, 330)} ${tag('blower', 916, 446, 76)}
    </g>

    <!-- 9 gas holder + flare -->
    <g class="unit" data-id="tank">
      <rect class="hit" x="976" y="130" width="130" height="362"/>
      <rect x="986" y="292" width="80" height="160" rx="26" fill="#1d3d44" stroke="#0c3d40" stroke-width="2"/>
      <clipPath id="cpTank"><rect x="986" y="292" width="80" height="160" rx="26"/></clipPath>
      <rect id="tankFill" clip-path="url(#cpTank)" x="986" y="452" width="80" height="0" fill="#2cc4bf" opacity=".75"/>
      <rect x="986" y="292" width="80" height="160" rx="26" fill="none" stroke="#2aa5a2" stroke-width="3"/>
      <path d="M1000 452 V470 M1052 452 V470" stroke="#176466" stroke-width="6"/>
      <path id="flame" d="M1088 178 C1074 160 1082 140 1088 120 C1094 140 1102 160 1088 178 Z" fill="url(#gFire)" transform-origin="1088 178"/>
      <rect x="1100" y="246" width="20" height="18" rx="3" fill="#ddd" stroke="#777"/>
      ${badge(9, 1026, 264)} ${tag('tank', 1026, 482, 92)}
    </g>

    <!-- 8 engine + generator -->
    <g class="unit" data-id="engine">
      <rect class="hit" x="1104" y="250" width="222" height="250"/>
      <rect x="1112" y="300" width="208" height="160" rx="6" fill="#7d8b90" fill-opacity=".25" stroke="#8fa0a5" stroke-width="2"/>
      <rect x="1124" y="355" width="96" height="74" rx="4" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <g id="cyls">${[0, 1, 2, 3].map((i) => `<rect id="cyl${i}" x="${1130 + i * 22}" y="335" width="16" height="22" rx="2" fill="#1f8a8a" stroke="#0c3d40"/>`).join('')}</g>
      <g id="flywheel"><circle cx="1238" cy="392" r="22" fill="#455" stroke="#9ab" stroke-width="3"/><path d="M1238 372 V412 M1218 392 H1258" stroke="#cde" stroke-width="3"/></g>
      <rect x="1264" y="366" width="50" height="52" rx="8" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <text class="lbl" x="1289" y="397" style="fill:#fff;font-weight:700">G</text>
      ${badge(8, 1160, 272)} ${tag('engine', 1215, 482, 96)}
    </g>

    <!-- 9 exhaust heat exchanger -->
    <g class="unit" data-id="hx">
      <rect class="hit" x="1284" y="200" width="60" height="122"/>
      <rect x="1292" y="246" width="40" height="70" rx="4" fill="#3b4a4e" stroke="#9ab" stroke-width="2"/>
      <g id="hxFins" stroke="#ff7a3d" stroke-width="3" opacity=".2">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M1297 ${254 + i * 10} H1327"/>`).join('')}</g>
      ${badge(9, 1312, 220)}
    </g>

    <!-- 10 control panel + battery -->
    <g class="unit" data-id="panel">
      <rect class="hit" x="1352" y="250" width="98" height="230"/>
      <rect x="1362" y="300" width="78" height="170" rx="5" fill="${metal}" stroke="#0c3d40" stroke-width="2"/>
      <rect x="1372" y="312" width="58" height="34" rx="3" fill="#0a1a20" stroke="#2cc4bf"/>
      <polyline id="panelSpark" points="" fill="none" stroke="#3ddc84" stroke-width="1.5"/>
      <circle cx="1380" cy="356" r="4" id="ledGen" fill="#333"/><circle cx="1394" cy="356" r="4" id="ledBat" fill="#333"/><circle cx="1408" cy="356" r="4" id="ledAlm" fill="#333"/>
      <rect x="1372" y="372" width="58" height="40" rx="3" fill="#0a1a20" stroke="#456"/>
      <rect x="1372" y="420" width="58" height="40" rx="3" fill="#0a1a20" stroke="#456"/>
      <rect id="bat1" x="1374" y="410" width="54" height="0" fill="#3ddc84"/>
      <rect id="bat2" x="1374" y="458" width="54" height="0" fill="#3ddc84"/>
      <text class="lbl" x="1401" y="397" style="fill:#fff;font-size:16px">⚡</text><text class="lbl" x="1401" y="445" style="fill:#fff;font-size:16px">⚡</text>
      ${badge(10, 1401, 272)} ${tag('panel', 1401, 492, 82)}
    </g>
    <g class="unit" data-id="panel">
      <rect class="hit" x="1290" y="510" width="110" height="80"/>
      <path class="pipe" d="M1401 470 V548 H1388" stroke="#567" stroke-width="2" stroke-dasharray="5 4"/>
      <rect x="1300" y="518" width="84" height="54" rx="4" fill="#1a2a30" stroke="#789" stroke-width="2"/>
      <polyline id="laptopSpark" points="" fill="none" stroke="#ffd23f" stroke-width="1.5"/>
      <path d="M1290 576 H1394 L1386 586 H1298 Z" fill="#567"/>
      <text class="lbl" x="1342" y="604">SCADA monitor</text>
    </g>

    <!-- 11 village (mini) -->
    <g class="unit" data-id="village">
      <rect class="hit" x="1458" y="230" width="138" height="290"/>
      <path d="M1462 470 L1596 420 L1596 480 L1462 530 Z" fill="#3a4448"/>
      <path d="M1475 488 L1590 446" stroke="#ddd" stroke-width="2" stroke-dasharray="8 8"/>
      ${[0, 1, 2].map((i) => `<g transform="translate(${1478 + i * 38},${398 - i * 14})"><path d="M0 22 L14 8 L28 22 Z" fill="#b5523b"/><rect x="3" y="22" width="22" height="18" fill="#e9d8b8"/><rect class="vwin" x="10" y="27" width="8" height="7" fill="#333"/></g>`).join('')}
      ${[0, 1, 2, 3, 4].map((i) => `<g transform="translate(${1470 + i * 27},${370 - i * 10})"><path d="M0 70 V0 H8" stroke="#222" stroke-width="3" fill="none"/><circle class="vglow" cx="9" cy="2" r="12" fill="url(#gGlow)" opacity="0"/><circle class="vlamp" cx="9" cy="2" r="4" fill="#444"/></g>`).join('')}
      ${badge(11, 1527, 252)} ${tag('village', 1527, 545, 110)}
    </g>
    ${pipesFlow}
    `;
  }

  const Schematic = {
    init(svg, onSelect) {
      this.svg = svg; build(svg);
      this.flows = PIPES.map((p) => ({ p, el: svg.querySelector('#pf-' + p.id), off: 0 }));
      this.q = (id) => svg.querySelector('#' + id);
      this.ang = { rot: 0, imp: 0, fly: 0, crank: 0 };
      svg.querySelectorAll('.unit').forEach((g) => g.addEventListener('click', () => onSelect(g.dataset.id)));
    },
    select(id) {
      this.svg.querySelectorAll('.unit').forEach((g) => g.classList.toggle('selected', g.dataset.id === id));
    },
    setText(id, txt) { const el = this.q('tag-' + id); if (el && el.textContent !== txt) el.textContent = txt; },

    update(s, dtReal) {
      const q = this.q, A = this.ang, g = s.gasifier;
      // flowing pipes
      this.flows.forEach((f) => {
        const r = Math.max(0, f.p.r(s) || 0);
        f.off -= r * dtReal * 70;
        f.el.style.strokeDashoffset = f.off;
        f.el.style.opacity = r > 0.01 ? 0.35 + 0.65 * Math.min(1, r * 1.5) : 0.08;
      });
      // hopper & shredder
      const pileH = Math.min(65, s.hopper.kg / 3);
      q('hopPile').setAttribute('y', 305 - pileH); q('hopPile').setAttribute('height', pileH);
      if (s.shredder.on) A.rot += dtReal * 360;
      q('rotA').setAttribute('transform', `rotate(${A.rot} 188 324)`);
      q('rotB').setAttribute('transform', `rotate(${-A.rot} 213 324)`);
      // dryer
      q('dryGlow').setAttribute('opacity', Math.min(0.6, s.dryer.Qavail / 15));
      const dh = Math.min(90, s.dryer.kg * 3.6);
      q('dryBed').setAttribute('y', 376 - dh); q('dryBed').setAttribute('height', dh);
      q('drySteam').setAttribute('opacity', Math.min(1, s.dryer.evapRate / 6));
      // gasifier zones coloured by live temperature
      const zones = [['dry', g.T.dry, 'Drying'], ['pyro', g.T.pyro, 'Pyrolysis'], ['ox', g.T.ox, 'Oxidation'], ['red', g.T.red, 'Reduction']];
      zones.forEach(([z, T, name]) => {
        q('z-' + z).setAttribute('fill', g.bedKg > 0.1 || T > 60 ? tempColor(T) : '#1c2326');
        q('zl-' + z).textContent = `${name} ${Math.round(T)}°C`;
      });
      q('oxGlow').setAttribute('opacity', Math.max(0, Math.min(1, (g.T.ox - 500) / 600)));
      // bins
      const ch = Math.min(70, s.bins.biochar * 4);
      q('charPile').setAttribute('y', 615 - ch); q('charPile').setAttribute('height', ch);
      // cyclone / scrubber / filter
      q('cycSwirl').setAttribute('opacity', g.Qraw > 0.1 ? 0.9 : 0.15);
      q('cycSwirl').setAttribute('transform', g.Qraw > 0.1 ? `translate(${Math.sin(performance.now() / 120) * 2},0)` : '');
      q('scrubSpray').setAttribute('opacity', g.Qraw > 0.1 ? 0.95 : 0.15);
      const wq = s.scrubber.waterQ;
      q('scrubWater').setAttribute('opacity', 1); q('scrubWater').style.filter = `sepia(${(1 - wq) * 1.6}) brightness(${0.6 + 0.4 * wq})`;
      q('scrubTankWater').style.filter = q('scrubWater').style.filter;
      q('filterLoad').setAttribute('opacity', Math.min(0.95, s.filter.loadPct));
      // blower
      A.imp += dtReal * s.blower.rpm * 0.4;
      q('impeller').setAttribute('transform', `rotate(${A.imp} 916 385)`);
      // tank + flare
      const th = 160 * s.tank.fill;
      q('tankFill').setAttribute('y', 452 - th); q('tankFill').setAttribute('height', th);
      const fl = Math.min(1.6, s.tank.flareRate / 20);
      const flick = 1 + 0.12 * Math.sin(performance.now() / 70);
      q('flame').setAttribute('transform', `scale(${fl > 0.02 ? (0.4 + fl) * flick : 0.15})`);
      q('flame').setAttribute('opacity', fl > 0.02 ? 1 : 0.35);
      // engine
      A.crank += dtReal * (s.engine.rpm / 60) * Math.PI * 2 * 0.08; // slowed for visibility
      A.fly += dtReal * s.engine.rpm * 0.5;
      q('flywheel').setAttribute('transform', `rotate(${A.fly} 1238 392)`);
      [0, 1, 2, 3].forEach((i) => q('cyl' + i).setAttribute('y', 335 - (s.engine.rpm > 10 ? 5 * Math.sin(A.crank + [0, Math.PI, Math.PI, 0][i]) : 0)));
      q('hxFins').setAttribute('opacity', 0.2 + 0.8 * Math.min(1, s.hx.Qrec / 10));
      // panel
      const soc = s.panel.soc;
      q('bat1').setAttribute('height', 36 * Math.min(1, Math.max(0, (soc - 0.5) * 2))); q('bat1').setAttribute('y', 410 - 36 * Math.min(1, Math.max(0, (soc - 0.5) * 2)));
      q('bat2').setAttribute('height', 36 * Math.min(1, soc * 2)); q('bat2').setAttribute('y', 458 - 36 * Math.min(1, soc * 2));
      const bc = soc < 0.15 ? '#ff4d5e' : soc < 0.35 ? '#ffb020' : '#3ddc84';
      q('bat1').setAttribute('fill', bc); q('bat2').setAttribute('fill', bc);
      q('ledGen').setAttribute('fill', s.engine.on ? '#3ddc84' : '#333');
      q('ledBat').setAttribute('fill', s.panel.battKW > 0.05 ? '#ffb020' : s.panel.battKW < -0.05 ? '#3ddc84' : '#333');
      q('ledAlm').setAttribute('fill', s.alerts.some((a) => a.lvl === 'bad') && Math.floor(performance.now() / 400) % 2 ? '#ff4d5e' : '#333');
      // mini village
      const frac = s.village.servedFrac, lit = s.village.night ? s.village.lampsLit / Math.max(1, s.village.lampsTotal) : 0;
      this.svg.querySelectorAll('.vglow').forEach((c, i) => c.setAttribute('opacity', i < Math.round(lit * 5) ? 1 : 0));
      this.svg.querySelectorAll('.vlamp').forEach((c, i) => c.setAttribute('fill', i < Math.round(lit * 5) ? '#fff6c0' : '#444'));
      this.svg.querySelectorAll('.vwin').forEach((c, i) => c.setAttribute('fill', i < Math.round((s.village.housesLit / Math.max(1, s.village.housesTotal)) * 3) ? '#ffd23f' : '#333'));
    },

    updateTags(s, history) {
      const f = (x, d = 0) => x.toFixed(d);
      this.setText('hopper', `${f(s.hopper.kg, 1)} kg`);
      this.setText('dryer', `M ${f(s.dryer.mOut * 100)}% · ${f(s.dryer.Qavail, 1)} kW`);
      this.setText('gasifier', s.gasifier.ignited ? `${f(s.gasifier.T.ox)}°C · ${f(s.gasifier.Qraw)} Nm³/h` : 'cold');
      this.setText('bins', `${f(s.bins.biochar, 2)} kg biochar`);
      this.setText('cyclone', `${f(s.cyclone.dustOut, 2)} g/Nm³`);
      this.setText('scrubber', `water ${f(s.scrubber.waterQ * 100)}%`);
      this.setText('filter', `${f(s.filter.tarOutMg)} mg tar`);
      this.setText('blower', `${f(s.blower.kW, 2)} kW`);
      this.setText('tank', `${f(s.tank.fill * 100)}% · ${f(s.tank.LHV, 1)}MJ`);
      this.setText('engine', `${f(s.engine.P, 1)} kWe`);
      this.setText('panel', `🔋 ${f(s.panel.soc * 100)}%`);
      this.setText('village', `${s.village.lampsLit}/${s.village.lampsTotal} lights`);
      const h = this.q('tag-heat'); const txt = `waste heat → dryer  ♨ ${f(s.hx.Qrec, 1)} kW`; if (h.textContent !== txt) h.textContent = txt;
      // mini sparklines on the panel screen and laptop
      const pts = (hist, x0, y0, w, hgt, key, max) => hist.slice(-40).map((p, i, a) => `${x0 + (i / Math.max(1, a.length - 1)) * w},${y0 + hgt - (Math.min(max, p[key]) / max) * hgt}`).join(' ');
      this.q('panelSpark').setAttribute('points', pts(history, 1375, 315, 52, 28, 'soc', 1));
      this.q('laptopSpark').setAttribute('points', pts(history, 1305, 524, 74, 42, 'Pgen', s.p.engineRated));
    },
  };
  WTE.Schematic = Schematic;
})();
