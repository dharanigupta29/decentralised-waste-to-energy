// OWNER: PERSON B (visualisation)
// Big village view: every LED streetlight and home is drawn and lights up from the snapshot.
(function () {
  'use strict';
  const WTE = window.WTE;

  const Village = {
    init(svg, strip) {
      this.svg = svg; this.strip = strip; this.key = '';
      strip.innerHTML = Array.from({ length: 8 }, () => '<div class="led"></div>').join('');
      this.leds = [...strip.children];
    },
    build(nL, nH) {
      const lamps = [], homes = [];
      for (let i = 0; i < nL; i++) {
        const row = i % 2, idx = Math.floor(i / 2), per = Math.ceil(nL / 2);
        const x = 40 + (idx * 820) / Math.max(1, per - 1 || 1), y = row ? 205 : 150;
        lamps.push(`<g class="lamp" transform="translate(${x},${y})">
          <ellipse class="pool" cx="0" cy="18" rx="30" ry="7" fill="#ffd23f" opacity="0"/>
          <path d="M0 18 V-26 H8" stroke="#0e1416" stroke-width="3" fill="none"/>
          <circle class="halo" cx="9" cy="-24" r="16" fill="url(#vGlow)" opacity="0"/>
          <circle class="bulb" cx="9" cy="-24" r="4" fill="#333"/></g>`);
      }
      for (let i = 0; i < nH; i++) {
        const x = 20 + (i * 750) / Math.max(1, nH);
        homes.push(`<g class="home" transform="translate(${x},34)">
          <path d="M0 30 L24 8 L48 30 Z" fill="#9c4a36"/><rect x="5" y="30" width="38" height="32" fill="#cdbb9a"/>
          <rect class="win" x="11" y="38" width="10" height="9" fill="#2a2a2a"/><rect class="win" x="27" y="38" width="10" height="9" fill="#2a2a2a"/>
          <rect x="20" y="50" width="8" height="12" fill="#5a3a24"/></g>`);
      }
      this.svg.innerHTML = `
        <defs><radialGradient id="vGlow"><stop offset="0" stop-color="#fff3b0"/><stop offset=".4" stop-color="#ffd23f" stop-opacity=".6"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient></defs>
        <rect id="vSky" width="900" height="240" fill="#08101c"/>
        <g id="vStars" fill="#fff">${Array.from({ length: 40 }, () => `<circle cx="${Math.random() * 900}" cy="${Math.random() * 40}" r="${Math.random() * 1.2 + 0.3}"/>`).join('')}</g>
        <rect y="100" width="900" height="140" fill="#14321e"/>
        <rect y="160" width="900" height="44" fill="#2f3a3f"/>
        <path d="M0 182 H900" stroke="#cfcfcf" stroke-width="2" stroke-dasharray="18 14"/>
        <g transform="translate(800,40)"><rect x="0" y="22" width="80" height="44" fill="#eef"/><path d="M-4 22 L40 2 L84 22 Z" fill="#5a7"/>
          <rect id="vClinicWin" x="8" y="32" width="64" height="12" fill="#333"/><path d="M40 47 v14 M33 54 h14" stroke="#e33" stroke-width="4"/>
          <text x="40" y="80" fill="#cde" font-size="10" text-anchor="middle">clinic</text></g>
        ${homes.join('')}${lamps.join('')}`;
      this.lamps = [...this.svg.querySelectorAll('.lamp')];
      this.homes = [...this.svg.querySelectorAll('.home')];
    },
    update(s) {
      const v = s.village;
      const key = v.lampsTotal + ':' + v.housesTotal;
      if (key !== this.key) { this.key = key; this.build(v.lampsTotal, v.housesTotal); }
      this.svg.querySelector('#vSky').setAttribute('fill', v.night ? '#08101c' : '#6fa8d8');
      this.svg.querySelector('#vStars').setAttribute('opacity', v.night ? 1 : 0);
      this.lamps.forEach((g, i) => {
        const on = v.night && i < v.lampsLit;
        g.querySelector('.bulb').setAttribute('fill', on ? '#fff6c0' : '#333');
        g.querySelector('.halo').setAttribute('opacity', on ? 1 : 0);
        g.querySelector('.pool').setAttribute('opacity', on ? 0.25 : 0);
      });
      this.homes.forEach((g, i) => g.querySelectorAll('.win').forEach((w) => w.setAttribute('fill', i < v.housesLit ? '#ffd23f' : '#2a2a2a')));
      this.svg.querySelector('#vClinicWin').setAttribute('fill', v.clinicOn ? '#bfefff' : '#333');
      this.leds.forEach((l, i) => l.classList.toggle('on', i < v.ledsLit));
    },
  };
  WTE.Village = Village;
})();
