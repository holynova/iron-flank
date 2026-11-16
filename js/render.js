// 铁甲夹击：棋盘渲染（IFRender）— Canvas，v2 卡通像素风。
// 地形自画（亮色扁平 + 像素细节）；坦克用潮汐战线像素画法（AWArt.unit，
// 不加载 sprites.js 时退回代码像素画；AWArt 缺席时退回色块坦克，游戏仍可玩）。
(function (root) {
  'use strict';
  var D = root.IFData;
  var AW = root.AWArt || null;
  var R = {};

  // ── 配色 ──
  var TC = {
    plain:    { base: '#8ed35f', alt: '#86cc56' },
    forest:   { base: '#7cc24e', alt: '#74ba47' },
    mountain: { base: '#a8b878', alt: '#a0b06e' },
    river:    { base: '#4aa8ec', alt: '#42a0e6' },
    city:     { base: '#c9c2b4', alt: '#c2bbae' },
  };
  var GRID = 'rgba(24,40,20,0.55)';

  // 确定性伪随机（装饰位置固定，不闪烁）
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
  }

  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  // ── 地形 ──
  function drawTerrain(c, t, x, y, ts, gx, gy) {
    var col = TC[t] || TC.plain;
    rect(c, x, y, ts, ts, (gx + gy) % 2 ? col.alt : col.base);
    var h1 = hash(gx, gy, 1), h2 = hash(gx, gy, 2), h3 = hash(gx, gy, 3);
    var u = ts / 16; // 1 像素单位（按 16 格画）
    if (t === 'plain') {
      // 草叶
      rect(c, x + (2 + h1 * 10) * u, y + (3 + h2 * 9) * u, 2 * u, 2 * u, '#6db83f');
      rect(c, x + (3 + h2 * 9) * u, y + (4 + h3 * 8) * u, 2 * u, 2 * u, '#a4e07a');
    } else if (t === 'forest') {
      // 树：树干 + 三层树冠
      rect(c, x + 7 * u, y + 11 * u, 2 * u, 3 * u, '#8a5a2e');
      rect(c, x + 3 * u, y + 8 * u, 10 * u, 4 * u, '#2f8f3a');
      rect(c, x + 4 * u, y + 5 * u, 8 * u, 4 * u, '#37a544');
      rect(c, x + 6 * u, y + 3 * u, 4 * u, 3 * u, '#4cc254');
      rect(c, x + 5 * u, y + 6 * u, 2 * u, 2 * u, '#6fd35e');
    } else if (t === 'mountain') {
      // 山：三层灰岩 + 雪顶
      rect(c, x + 2 * u, y + 11 * u, 12 * u, 3 * u, '#8a8f96');
      rect(c, x + 4 * u, y + 8 * u, 8 * u, 4 * u, '#9aa0a8');
      rect(c, x + 6 * u, y + 5 * u, 4 * u, 4 * u, '#aeb4bc');
      rect(c, x + 6 * u, y + 4 * u, 4 * u, 2 * u, '#f2f6fa');
      rect(c, x + 3 * u, y + 12 * u, 3 * u, 1 * u, '#6e7378');
    } else if (t === 'river') {
      // 波纹
      rect(c, x + (2 + h1 * 6) * u, y + (4 + h2 * 4) * u, 5 * u, 1.6 * u, '#bfe6ff');
      rect(c, x + (5 + h2 * 6) * u, y + (9 + h3 * 4) * u, 5 * u, 1.6 * u, '#8fd0f8');
      rect(c, x + (3 + h3 * 8) * u, y + (6 + h1 * 5) * u, 3 * u, 1.4 * u, '#d6f0ff');
    } else if (t === 'city') {
      // 两栋楼：墙 + 屋顶 + 窗
      rect(c, x + 2 * u, y + 6 * u, 5 * u, 8 * u, '#7d838c');
      rect(c, x + 2 * u, y + 5 * u, 5 * u, 2 * u, '#565b62');
      rect(c, x + 3 * u, y + 8 * u, 1.6 * u, 1.6 * u, '#ffd94a');
      rect(c, x + 5 * u, y + 10 * u, 1.6 * u, 1.6 * u, '#ffd94a');
      rect(c, x + 9 * u, y + 8 * u, 5 * u, 6 * u, '#8d929a');
      rect(c, x + 9 * u, y + 7 * u, 5 * u, 2 * u, '#5f646b');
      rect(c, x + 10 * u, y + 10 * u, 1.6 * u, 1.6 * u, '#ffd94a');
      rect(c, x + 12 * u, y + 12 * u, 1.6 * u, 1.6 * u, '#ffe98a');
    }
  }

  // ── 坦克 ──
  var unitCache = {};
  function unitCanvas(type, owner, px) {
    var key = type + '|' + owner + '|' + px;
    if (unitCache[key]) return unitCache[key];
    var cv = null;
    if (AW && AW.unit) {
      try { cv = AW.unit(type, owner, false, px, 0); } catch (e) { cv = null; }
    }
    if (cv) { unitCache[key] = cv; return cv; }
    // 退回：色块坦克（AWArt 缺席时）
    cv = document.createElement('canvas');
    cv.width = px; cv.height = Math.round(px * 36 / 32);
    var c = cv.getContext('2d');
    var pal = owner === 1
      ? { m: '#e03828', d: '#a82018', l: '#f06848' }
      : { m: '#2c70e0', d: '#1c4cb0', l: '#58a0f4' };
    var s = px / 32;
    c.fillStyle = '#3a3f4a';
    c.fillRect(3 * s, 20 * s, 26 * s, 10 * s); // 履带
    c.fillStyle = pal.d;
    c.fillRect(5 * s, 14 * s, 22 * s, 8 * s); // 车身
    c.fillStyle = pal.m;
    c.fillRect(8 * s, 8 * s, 14 * s, 8 * s); // 炮塔
    c.fillStyle = pal.l;
    c.fillRect(10 * s, 10 * s, 6 * s, 3 * s);
    c.fillStyle = '#22242c';
    c.fillRect(20 * s, 11 * s, 10 * s, 3 * s); // 炮管
    unitCache[key] = cv;
    return cv;
  }

  // ── 画布 ──
  // canvas: 棋盘 <canvas>；cssSize: CSS 边长。返回 { ctx, ts, dpr }。
  R.setup = function (canvas, cssSize) {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    canvas.style.width = cssSize + 'px';
    canvas.style.height = cssSize + 'px';
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, ts: cssSize / 8, dpr: dpr };
  };

  // 点击 → 格子（clientX/Y）
  R.cellFromPoint = function (canvas, clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var x = Math.floor((clientX - r.left) / (r.width / 8));
    var y = Math.floor((clientY - r.top) / (r.height / 8));
    if (x < 0 || y < 0 || x > 7 || y > 7) return null;
    return { x: x, y: y };
  };

  // 画整盘。view: { selected, targets, killCells, armorCells, lastMove }
  R.drawBoard = function (canvas, state, view) {
    view = view || {};
    var cssSize = canvas.clientWidth || canvas.width;
    var S = R.setup(canvas, cssSize);
    var ctx = S.ctx, ts = S.ts;
    var i, j, u;

    // 地形
    for (j = 0; j < 8; j++) for (i = 0; i < 8; i++) {
      drawTerrain(ctx, state.terrain[j][i], i * ts, j * ts, ts, i, j);
    }
    // 上一步落点
    if (view.lastMove) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      if (view.lastMove.from) ctx.fillRect(view.lastMove.from.x * ts, view.lastMove.from.y * ts, ts, ts);
      if (view.lastMove.to) ctx.fillRect(view.lastMove.to.x * ts, view.lastMove.to.y * ts, ts, ts);
    }
    // 网格线
    ctx.strokeStyle = GRID;
    ctx.lineWidth = Math.max(1, ts / 28);
    ctx.beginPath();
    for (i = 1; i < 8; i++) {
      ctx.moveTo(i * ts, 0); ctx.lineTo(i * ts, ts * 8);
      ctx.moveTo(0, i * ts); ctx.lineTo(ts * 8, i * ts);
    }
    ctx.stroke();

    // 可移动目标：白点
    (view.targets || []).forEach(function (t) {
      ctx.beginPath();
      ctx.arc((t.x + 0.5) * ts, (t.y + 0.5) * ts, ts * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, ts / 20);
      ctx.strokeStyle = '#1d7a3a';
      ctx.stroke();
    });
    // 预览击杀：红准星；破甲：橙准星
    function crosshair(cell, col) {
      var cx = (cell.x + 0.5) * ts, cy = (cell.y + 0.5) * ts, r = ts * 0.34;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2, ts / 14);
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - r - 3, cy); ctx.lineTo(cx - r + 5, cy);
      ctx.moveTo(cx + r - 5, cy); ctx.lineTo(cx + r + 3, cy);
      ctx.moveTo(cx, cy - r - 3); ctx.lineTo(cx, cy - r + 5);
      ctx.moveTo(cx, cy + r - 5); ctx.lineTo(cx, cy + r + 3);
      ctx.stroke();
    }
    (view.killCells || []).forEach(function (k) { crosshair(k, '#e02020'); });
    (view.armorCells || []).forEach(function (k) { crosshair(k, '#e88010'); });

    // 选中：黄框
    if (view.selected) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = Math.max(2.5, ts / 12);
      ctx.strokeRect(view.selected.x * ts + 2, view.selected.y * ts + 2, ts - 4, ts - 4);
    }

    // 单位（按行从上到下画，炮塔探出部分自然遮挡）
    var units = state.units.filter(function (x) { return x.alive; })
      .sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    units.forEach(function (unit) {
      var art = D.UNITS[unit.type].art;
      var owner = D.SIDES[unit.side].owner;
      var px = Math.max(8, Math.round(ts * S.dpr));
      var cv = unitCanvas(art, owner, px);
      var h = ts * cv.height / cv.width;
      var dx = unit.x * ts, dy = unit.y * ts + ts - h;
      // 铁壁生效：蓝光圈
      if (state.shield[unit.side]) {
        ctx.beginPath();
        ctx.arc((unit.x + 0.5) * ts, (unit.y + 0.62) * ts, ts * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125,211,252,0.35)';
        ctx.fill();
      }
      ctx.drawImage(cv, dx, dy, ts, h);
      // 重型装甲指示：左上角小盾（有甲=实心黄，无甲=空心灰）
      if (unit.type === 'heavy') {
        var sx = unit.x * ts + ts * 0.08, sy = unit.y * ts + ts * 0.08, ss = ts * 0.2;
        ctx.fillStyle = unit.armor > 0 ? '#ffd23e' : 'rgba(20,20,20,0.55)';
        ctx.beginPath();
        ctx.moveTo(sx + ss / 2, sy);
        ctx.lineTo(sx + ss, sy + ss * 0.3);
        ctx.lineTo(sx + ss, sy + ss * 0.62);
        ctx.lineTo(sx + ss / 2, sy + ss);
        ctx.lineTo(sx, sy + ss * 0.62);
        ctx.lineTo(sx, sy + ss * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    });
  };

  // 地图小预览（只画地形）
  R.drawMapPreview = function (canvas, mapId) {
    var C = root.IFCore;
    var t = C.expandHalf(C.mapById(mapId).half);
    var cssSize = canvas.clientWidth || 128;
    var S = R.setup(canvas, cssSize);
    var ctx = S.ctx, ts = S.ts;
    for (var j = 0; j < 8; j++) for (var i = 0; i < 8; i++) {
      drawTerrain(ctx, t[j][i], i * ts, j * ts, ts, i, j);
    }
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var k = 1; k < 8; k++) {
      ctx.moveTo(k * ts, 0); ctx.lineTo(k * ts, ts * 8);
      ctx.moveTo(0, k * ts); ctx.lineTo(ts * 8, k * ts);
    }
    ctx.stroke();
  };

  // 菜单横幅：两辆 Q 版坦克隔河对峙（像素风装饰）
  R.drawBanner = function (canvas) {
    var cssW = canvas.clientWidth || 360;
    var cssH = Math.round(cssW * 0.42);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 天空
    var g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, '#7ec8f8');
    g.addColorStop(0.55, '#c9ecff');
    g.addColorStop(0.55, '#8ed35f');
    g.addColorStop(1, '#6db83f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    // 云
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    [[0.08, 0.1, 46, 12], [0.62, 0.06, 56, 13], [0.36, 0.2, 36, 10]].forEach(function (cl) {
      ctx.fillRect(cl[0] * cssW, cl[1] * cssH, cl[2], cl[3]);
      ctx.fillRect(cl[0] * cssW + 8, cl[1] * cssH - 5, cl[2] - 16, 6);
    });
    // 河流（中间竖带）
    ctx.fillStyle = '#4aa8ec';
    ctx.fillRect(cssW * 0.46, cssH * 0.55, cssW * 0.08, cssH * 0.45);
    ctx.fillStyle = '#bfe6ff';
    ctx.fillRect(cssW * 0.48, cssH * 0.66, cssW * 0.04, 3);
    ctx.fillRect(cssW * 0.47, cssH * 0.82, cssW * 0.05, 3);
    // 两辆坦克
    var ts = cssW * 0.2;
    var red = unitCanvas('med', 1, Math.round(ts * dpr));
    var blue = unitCanvas('med', 2, Math.round(ts * dpr));
    var rh = ts * red.height / red.width;
    var bh = ts * blue.height / blue.width;
    ctx.drawImage(red, cssW * 0.12, cssH - rh - 4, ts, rh);
    ctx.drawImage(blue, cssW * 0.68, cssH - bh - 4, ts, bh);
  };

  root.IFRender = R;
})(typeof window !== 'undefined' ? window : globalThis);
