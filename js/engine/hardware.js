// OWNER: PERSON A
// OPTIONAL real hardware bridge over Web Serial (Chrome / Edge only).
// Arduino sends   "W:<grams>\n"  from an HX711 load cell (see hardware/scale_and_leds.ino)
// Browser sends   "L:<0-8>,<0-255>\n" = how many physical LEDs to light + brightness.
// A stable weight increase on the scale is treated as a DUMP of (increase × kgPerGram) kg.
(function () {
  'use strict';
  const WTE = window.WTE;

  WTE.Hardware = {
    connected: false, status: 'Not connected', grams: 0, kgPerGram: 0.5, type: 'wood',
    _port: null, _writer: null, _committed: 0, _buf: [], _lastSent: '',

    async connect(sim) {
      if (!('serial' in navigator)) { this.status = 'Web Serial not supported: use Chrome or Edge'; return; }
      try {
        this._port = await navigator.serial.requestPort();
        await this._port.open({ baudRate: 115200 });
        this._writer = this._port.writable.getWriter();
        this.connected = true; this.status = 'Connected'; this._committed = 0;
        this._readLoop(sim);
      } catch (e) { this.status = 'Connect failed: ' + e.message; }
    },

    async _readLoop(sim) {
      const decoder = new TextDecoderStream();
      this._port.readable.pipeTo(decoder.writable).catch(() => {});
      const reader = decoder.readable.getReader();
      let line = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          for (const ch of value) {
            if (ch === '\n') { this._onLine(line.trim(), sim); line = ''; } else line += ch;
          }
        }
      } catch (e) { this.status = 'Disconnected'; }
      this.connected = false;
    },

    _onLine(line, sim) {
      if (!line.startsWith('W:')) return;
      const g = parseFloat(line.slice(2));
      if (!Number.isFinite(g)) return;
      this.grams = g;
      this._buf.push(g); if (this._buf.length > 6) this._buf.shift();
      const min = Math.min(...this._buf), max = Math.max(...this._buf);
      const stable = this._buf.length === 6 && max - min < Math.max(2, 0.03 * max);
      if (!stable) return;
      const avg = this._buf.reduce((a, b) => a + b, 0) / this._buf.length;
      if (avg < 3) { this._committed = 0; return; }              // tray emptied -> rearm
      if (avg - this._committed > 5) {                            // > 5 g new waste added
        sim.dump((avg - this._committed) * this.kgPerGram, this.type);
        this._committed = avg;
      }
    },

    sendLeds(n, brightness) {
      if (!this.connected || !this._writer) return;
      const msg = `L:${n},${Math.round(brightness)}\n`;
      if (msg === this._lastSent) return;
      this._lastSent = msg;
      this._writer.write(new TextEncoder().encode(msg)).catch(() => {});
    },
  };
})();
