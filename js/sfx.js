// 铁甲夹击：音效（IFSfx）— Web Audio API 合成，无外部音频文件。
// 首次用户手势时创建/恢复 AudioContext；开关持久化到 localStorage。
(function (root) {
  'use strict';
  var S = {};
  var ctx = null;
  var KEY = 'if_sound';
  var enabled = true;
  try {
    if (root.localStorage) enabled = root.localStorage.getItem(KEY) !== 'off';
  } catch (e) { enabled = true; }

  function ac() {
    if (ctx) return ctx;
    try {
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { return null; }
    return ctx;
  }

  // 用户手势时调用：创建并恢复 AudioContext（浏览器自动播放策略要求）。
  S.unlock = function () {
    var c = ac();
    if (c && c.state === 'suspended') { try { c.resume(); } catch (e) {} }
  };

  S.isEnabled = function () { return enabled; };
  S.toggle = function () {
    enabled = !enabled;
    try { if (root.localStorage) root.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
    return enabled;
  };

  function tone(freq, dur, type, vol, delay, slideTo) {
    if (!enabled) return;
    var c = ac();
    if (!c) return;
    try {
      var t0 = c.currentTime + (delay || 0);
      var o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }

  function noiseBurst(dur, vol, cutoff) {
    if (!enabled) return;
    var c = ac();
    if (!c) return;
    try {
      var len = Math.max(1, Math.floor(c.sampleRate * dur));
      var buf = c.createBuffer(1, len, c.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = c.createBufferSource();
      src.buffer = buf;
      var f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff || 700;
      var g = c.createGain();
      g.gain.value = vol || 0.3;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start();
    } catch (e) {}
  }

  // ── 音效表 ──
  S.click = function () { tone(880, 0.06, 'square', 0.05); };
  S.move = function () {
    tone(240, 0.09, 'sine', 0.14, 0, 170);
    tone(340, 0.07, 'triangle', 0.07, 0.05);
  };
  S.kill = function () {
    noiseBurst(0.35, 0.32, 650);
    tone(130, 0.3, 'sine', 0.25, 0, 42);
  };
  S.armor = function () {
    tone(1250, 0.07, 'square', 0.07);
    tone(920, 0.12, 'square', 0.06, 0.05);
  };
  S.skill = function () {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, 0.12, 'triangle', 0.12, i * 0.07);
    });
  };
  S.dice = function () {
    [0, 0.09, 0.18].forEach(function (d) { tone(1500, 0.03, 'square', 0.05, d); });
    tone(660, 0.1, 'triangle', 0.1, 0.28);
  };
  S.win = function () {
    [523, 659, 784, 1047].forEach(function (f, i) {
      tone(f, 0.22, 'triangle', 0.14, i * 0.11);
    });
    tone(1319, 0.4, 'triangle', 0.12, 0.48);
  };
  S.lose = function () {
    [392, 330, 262, 196].forEach(function (f, i) {
      tone(f, 0.24, 'triangle', 0.12, i * 0.14);
    });
  };
  S.draw = function () { tone(440, 0.15, 'triangle', 0.1); tone(440, 0.2, 'triangle', 0.08, 0.18); };

  // 首次手势自动解锁音频（各浏览器自动播放策略）。
  if (typeof root.addEventListener === 'function') {
    root.addEventListener('pointerdown', S.unlock);
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = S;
  else root.IFSfx = S;
})(typeof window !== 'undefined' ? window : globalThis);
