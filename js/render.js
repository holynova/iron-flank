// 铁甲夹击：棋盘渲染（IFRender）— Canvas，v2 卡通像素风。
// 地形与坦克全部原创代码像素画：亮绿草地、粗黑网格、Q 版坦克、
// 饱满地形。不再使用潮汐战线美术模块（vendor 仅保留在仓库中，不加载）。
(function (root) {
  'use strict';
  var D = root.IFData;
  var SP = root.IFSprites;
  var R = {};

  // ── 配色（取自 v2 原型）──
  var TC = {
    plain:    { base: '#93cb52', alt: '#8cc44a' },
    forest:   { base: '#93cb52', alt: '#8cc44a' },
    mountain: { base: '#93cb52', alt: '#8cc44a' },
    river:    { base: '#3d9be9', alt: '#3590dd' },
    city:     { base: '#93cb52', alt: '#8cc44a' },
  };
  var GRID = '#14141c';      // 粗黑网格
  var OUTLINE = '#16161f';   // 描边

  // 确定性伪随机（装饰位置固定，不闪烁）
  function hash(x, y, s) {
    var h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    return (((h ^ (h >>> 16)) >>> 0) % 1000) / 1000;
  }

  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  // ── 地形（16×16 像素格内作画，u = ts/16）──
  function drawTerrain(c, t, x, y, ts, gx, gy) {
    var col = TC[t] || TC.plain;
    rect(c, x, y, ts, ts, (gx + gy) % 2 ? col.alt : col.base);
    var h1 = hash(gx, gy, 1), h2 = hash(gx, gy, 2), h3 = hash(gx, gy, 3);
    var u = ts / 16;
    if (t === 'plain') {
      // 草叶簇 + 偶尔小花
      rect(c, x + (2 + h1 * 9) * u, y + (3 + h2 * 8) * u, 2 * u, 2 * u, '#7ab83a');
      rect(c, x + (4 + h2 * 8) * u, y + (5 + h3 * 7) * u, 2 * u, 2 * u, '#a8dc6a');
      rect(c, x + (9 + h3 * 4) * u, y + (2 + h1 * 4) * u, 2 * u, 1.4 * u, '#7ab83a');
      if (h1 > 0.72) rect(c, x + (5 + h2 * 6) * u, y + (8 + h3 * 4) * u, 1.6 * u, 1.6 * u, '#fff7ae');
    } else if (t === 'forest') {
      // 大树：深色轮廓 + 三层树冠 + 树干，撑满整格
      var rows = [ // [y, x0, x1] 树冠行（描边版各扩 1）
        [1, 6, 9], [2, 5, 10], [3, 4, 11], [4, 3, 12],
        [5, 3, 12], [6, 3, 12], [7, 3, 12], [8, 4, 11], [9, 5, 10],
      ];
      rows.forEach(function (r) {
        rect(c, x + (r[1] - 1) * u, y + r[0] * u, (r[2] - r[1] + 3) * u, u, '#146c2e');
      });
      rect(c, x + 6 * u, y + 0 * u, 4 * u, u, '#146c2e');
      rect(c, x + 5 * u, y + 10 * u, 6 * u, u, '#146c2e');
      // 树冠填色：上亮下暗
      rect(c, x + 6 * u, y + 1 * u, 4 * u, 2 * u, '#3ecb5f');
      rect(c, x + 5 * u, y + 2 * u, 6 * u, 1 * u, '#3ecb5f');
      rect(c, x + 4 * u, y + 3 * u, 8 * u, 2 * u, '#2bb673');
      rect(c, x + 3 * u, y + 5 * u, 10 * u, 3 * u, '#2bb673');
      rect(c, x + 4 * u, y + 8 * u, 8 * u, 1 * u, '#1f9d43');
      rect(c, x + 5 * u, y + 9 * u, 6 * u, 1 * u, '#1f9d43');
      rect(c, x + 5 * u, y + 3 * u, 2 * u, 2 * u, '#7ee787'); // 高光
      rect(c, x + 10 * u, y + 7 * u, 2 * u, 2 * u, '#177a37'); // 阴影
      // 树干
      rect(c, x + 7 * u, y + 10 * u, 2 * u, 4 * u, '#8a5a2e');
      rect(c, x + 8 * u, y + 10 * u, 1 * u, 4 * u, '#6e4520');
      rect(c, x + 6 * u, y + 13 * u, 4 * u, 1 * u, '#6e4520');
    } else if (t === 'mountain') {
      // 大山岩：深色轮廓 + 灰岩层 + 雪顶，撑满整格
      var rock = [ // [y0, y1, x0, x1]
        [12, 14, 1, 14], [9, 11, 2, 13], [6, 8, 4, 11], [3, 5, 6, 9],
      ];
      rock.forEach(function (r) {
        rect(c, x + (r[2] - 1) * u, y + r[0] * u, (r[3] - r[2] + 3) * u, (r[1] - r[0] + 1) * u, '#3f444c');
      });
      rect(c, x + 2 * u, y + 12 * u, 12 * u, 2 * u, '#7d838c');
      rect(c, x + 3 * u, y + 9 * u, 10 * u, 3 * u, '#8d929a');
      rect(c, x + 5 * u, y + 6 * u, 6 * u, 3 * u, '#9aa0a8');
      rect(c, x + 7 * u, y + 3 * u, 2 * u, 3 * u, '#f2f6fa'); // 雪顶
      rect(c, x + 6 * u, y + 4 * u, 4 * u, 1 * u, '#f2f6fa');
      rect(c, x + 8 * u, y + 6 * u, 1 * u, 2 * u, '#f2f6fa'); // 雪水
      rect(c, x + 11 * u, y + 9 * u, 2 * u, 3 * u, '#6e7378'); // 右侧阴影
      rect(c, x + 4 * u, y + 10 * u, 2 * u, 1 * u, '#c6ccd4'); // 高光
    } else if (t === 'river') {
      // 亮蓝水面 + 白色波纹
      rect(c, x + (1 + h1 * 5) * u, y + (3 + h2 * 3) * u, 6 * u, 1.6 * u, '#eaf7ff');
      rect(c, x + (6 + h2 * 5) * u, y + (7 + h3 * 3) * u, 6 * u, 1.6 * u, '#8fd0f8');
      rect(c, x + (2 + h3 * 7) * u, y + (11 + h1 * 3) * u, 5 * u, 1.6 * u, '#d6f0ff');
      rect(c, x + (10 + h1 * 3) * u, y + (5 + h2 * 6) * u, 2 * u, 1.4 * u, '#ffffff');
    } else if (t === 'city') {
      // 人行道 + 两栋楼（黑描边、黄窗）
      rect(c, x + 1 * u, y + 12 * u, 14 * u, 3 * u, '#c9c2b4');
      rect(c, x + 1 * u, y + 14 * u, 14 * u, 1 * u, '#b3ac9c');
      // A 楼（高）
      rect(c, x + 1.6 * u, y + 3.6 * u, 5.8 * u, 9 * u, OUTLINE);
      rect(c, x + 2 * u, y + 4 * u, 5 * u, 8 * u, '#8d929a');
      rect(c, x + 2 * u, y + 4 * u, 5 * u, 1.8 * u, '#5f646b');
      rect(c, x + 3 * u, y + 6.6 * u, 1.4 * u, 1.4 * u, '#ffd94a');
      rect(c, x + 5 * u, y + 6.6 * u, 1.4 * u, 1.4 * u, '#ffd94a');
      rect(c, x + 3 * u, y + 9.2 * u, 1.4 * u, 1.4 * u, '#ffd94a');
      rect(c, x + 5 * u, y + 9.2 * u, 1.4 * u, 1.4 * u, '#ffe98a');
      // B 楼（矮）
      rect(c, x + 8.6 * u, y + 6.6 * u, 5.8 * u, 6 * u, OUTLINE);
      rect(c, x + 9 * u, y + 7 * u, 5 * u, 5 * u, '#7d838c');
      rect(c, x + 9 * u, y + 7 * u, 5 * u, 1.8 * u, '#565b62');
      rect(c, x + 10 * u, y + 9.6 * u, 1.4 * u, 1.4 * u, '#ffd94a');
      rect(c, x + 12 * u, y + 9.6 * u, 1.4 * u, 1.4 * u, '#ffd94a');
    }
  }

  // ── 坦克 ──
  var ART_TO_TYPE = { tnk: 'light', med: 'medium', hvy: 'heavy' };
  function unitCanvas(art, owner) {
    return SP.tank(ART_TO_TYPE[art] || 'medium', owner);
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
    var i, j;

    // 地形
    for (j = 0; j < 8; j++) for (i = 0; i < 8; i++) {
      drawTerrain(ctx, state.terrain[j][i], i * ts, j * ts, ts, i, j);
    }
    // 上一步落点
    if (view.lastMove) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      if (view.lastMove.from) ctx.fillRect(view.lastMove.from.x * ts, view.lastMove.from.y * ts, ts, ts);
      if (view.lastMove.to) ctx.fillRect(view.lastMove.to.x * ts, view.lastMove.to.y * ts, ts, ts);
    }
    // 粗黑网格线 + 外框
    ctx.strokeStyle = GRID;
    ctx.lineWidth = Math.max(2, ts / 16);
    ctx.beginPath();
    for (i = 1; i < 8; i++) {
      ctx.moveTo(i * ts, 0); ctx.lineTo(i * ts, ts * 8);
      ctx.moveTo(0, i * ts); ctx.lineTo(ts * 8, i * ts);
    }
    ctx.stroke();
    ctx.lineWidth = Math.max(3, ts / 12);
    ctx.strokeRect(1.5, 1.5, ts * 8 - 3, ts * 8 - 3);

    // 可移动目标：发光黄点
    (view.targets || []).forEach(function (t) {
      var cx = (t.x + 0.5) * ts, cy = (t.y + 0.5) * ts;
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,210,62,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = '#fff3a6';
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, ts / 22);
      ctx.strokeStyle = '#f0a81d';
      ctx.stroke();
    });
    // 预览击杀：红准星；破甲：橙准星（pulseT 存在时呼吸缩放）
    var pulse = view.pulseT != null ? 1 + 0.14 * Math.sin(view.pulseT * Math.PI * 2) : 1;
    function crosshair(cell, col) {
      var cx = (cell.x + 0.5) * ts, cy = (cell.y + 0.5) * ts, r = ts * 0.34 * pulse;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.lineWidth = Math.max(2.5, ts / 12);
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

    // 选中：黄光晕 + 粗黄框
    if (view.selected) {
      ctx.fillStyle = 'rgba(255,210,62,0.22)';
      ctx.fillRect(view.selected.x * ts, view.selected.y * ts, ts, ts);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = Math.max(3, ts / 10);
      ctx.strokeRect(view.selected.x * ts + 2, view.selected.y * ts + 2, ts - 4, ts - 4);
    }

    // 单位（居中绘制，轻 / 中 / 重尺寸区分明显）
    // 移动动画中的单位跳过常规绘制，改由 view.moving 在插值位置绘制。
    var movingId = view.moving ? view.moving.unitId : -1;
    var units = state.units.filter(function (x) { return x.alive && x.id !== movingId; })
      .sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    units.forEach(function (unit) {
      var art = D.UNITS[unit.type].art;
      var owner = D.SIDES[unit.side].owner;
      var cv = unitCanvas(art, owner);
      var scale = (SP.SCALE_IN_CELL[unit.type] || 0.86);
      var w = ts * scale;
      var dx = unit.x * ts + (ts - w) / 2;
      var dy = unit.y * ts + (ts - w) / 2;
      // 铁壁生效：蓝光圈
      if (state.shield[unit.side]) {
        ctx.beginPath();
        ctx.arc((unit.x + 0.5) * ts, (unit.y + 0.5) * ts, ts * 0.44, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(125,211,252,0.35)';
        ctx.fill();
      }
      ctx.drawImage(cv, dx, dy, w, w);
      // 重型装甲指示：左上角小盾（有甲=实心黄，无甲=空心灰）
      if (unit.type === 'heavy') {
        var sx = unit.x * ts + ts * 0.07, sy = unit.y * ts + ts * 0.07, ss = ts * 0.2;
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
        ctx.lineWidth = Math.max(1, ts / 30);
        ctx.strokeStyle = OUTLINE;
        ctx.stroke();
      }
    });

    // 移动动画：移动中的坦克画在插值位置（fx/fy 为浮点格坐标）
    if (view.moving) {
      var mu = view.moving;
      var mcv = unitCanvas(D.UNITS[mu.type].art, D.SIDES[mu.side].owner);
      var mw = ts * (SP.SCALE_IN_CELL[mu.type] || 0.86);
      ctx.drawImage(mcv, (mu.fx + 0.5) * ts - mw / 2, (mu.fy + 0.5) * ts - mw / 2, mw, mw);
    }

    // 技能闪光：该方所有坦克外扩一圈脉冲光环
    if (view.skillFlash) {
      var sf = view.skillFlash;
      var flashCol = sf.side === 0 ? '125,211,252' : '252,160,136';
      var ringR = ts * (0.42 + 0.14 * Math.sin(sf.t * Math.PI * 2));
      state.units.filter(function (x) { return x.alive && x.side === sf.side; }).forEach(function (u) {
        ctx.beginPath();
        ctx.arc((u.x + 0.5) * ts, (u.y + 0.5) * ts, ringR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + flashCol + ',' + (0.5 * (1 - sf.t)) + ')';
        ctx.fill();
        ctx.lineWidth = Math.max(2, ts / 16);
        ctx.strokeStyle = 'rgba(' + flashCol + ',0.9)';
        ctx.stroke();
      });
    }

    // 击毁爆炸：扩散火球 + 8 向飞散粒子（t: 0→1）
    (view.explosions || []).forEach(function (ex) {
      var cx = (ex.x + 0.5) * ts, cy = (ex.y + 0.5) * ts;
      var t = ex.t;
      var outer = ts * (0.15 + 0.45 * t);
      ctx.beginPath();
      ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(224,32,32,' + (0.85 * (1 - t)) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, outer * 0.66, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(248,138,29,' + (0.95 * (1 - t)) + ')';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, outer * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,240,150,' + (1 - t) + ')';
      ctx.fill();
      for (var p = 0; p < 8; p++) {
        var ang = (p / 8) * Math.PI * 2 + ex.x;
        var dist = ts * (0.2 + 0.55 * t) * (0.7 + 0.3 * ((p * 7 + ex.y) % 3) / 2);
        ctx.fillStyle = p % 2 ? '#f08a1d' : '#ffd23e';
        ctx.fillRect(cx + Math.cos(ang) * dist - ts * 0.05, cy + Math.sin(ang) * dist - ts * 0.05, ts * 0.1, ts * 0.1);
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

  // ── 主菜单横幅：日落河谷，两辆 Q 版笑脸坦克隔河对峙 ──
  function drawCuteTank(c, x, yBase, w, pal, dir) {
    // dir: 1 朝右，-1 朝左。yBase = 履带底。
    var h = w * 0.62;
    var u = w / 24;
    var o = OUTLINE;
    // 炮管（朝向对岸）
    var bx = dir > 0 ? x + w * 0.52 : x + w * 0.48 - w * 0.42;
    rect(c, bx - u, yBase - h * 0.62 - u, w * 0.42 + u, h * 0.13 + 2 * u, o);
    rect(c, bx, yBase - h * 0.62, w * 0.42, h * 0.13, '#3c414d');
    rect(c, dir > 0 ? bx + w * 0.34 : bx, yBase - h * 0.62 - u * 0.5, w * 0.08, h * 0.13 + u, '#565b66');
    // 履带
    rect(c, x - u, yBase - h * 0.3 - u, w + 2 * u, h * 0.3 + 2 * u, o);
    rect(c, x, yBase - h * 0.3, w, h * 0.3, '#23262e');
    for (var i = 0; i < 4; i++) {
      var wx = x + w * (0.12 + i * 0.22);
      c.beginPath();
      c.arc(wx + w * 0.06, yBase - h * 0.15, w * 0.055, 0, Math.PI * 2);
      c.fillStyle = '#8a8f9a';
      c.fill();
      c.lineWidth = Math.max(1, u);
      c.strokeStyle = o;
      c.stroke();
    }
    // 车身
    rect(c, x + w * 0.03 - u, yBase - h * 0.62 - u, w * 0.94 + 2 * u, h * 0.36 + 2 * u, o);
    rect(c, x + w * 0.03, yBase - h * 0.62, w * 0.94, h * 0.36, pal.M);
    rect(c, x + w * 0.03, yBase - h * 0.62, w * 0.94, h * 0.1, pal.L);
    rect(c, x + w * 0.03, yBase - h * 0.32, w * 0.94, h * 0.04, pal.D);
    // 炮塔（圆顶）
    var tx = x + w * 0.2, ty = yBase - h * 0.95, tw = w * 0.55, th = h * 0.38;
    rect(c, tx - u, ty - u, tw + 2 * u, th + 2 * u, o);
    rect(c, tx, ty, tw, th, pal.M);
    rect(c, tx, ty, tw, th * 0.3, pal.L);
    // 笑脸（朝向对岸一侧）
    var ex = dir > 0 ? tx + tw * 0.62 : tx + tw * 0.22;
    var ey = ty + th * 0.42;
    c.fillStyle = o;
    c.beginPath(); c.arc(ex, ey, Math.max(1.6, u * 1.1), 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(ex + (dir > 0 ? u * 2.6 : -u * 2.6), ey, Math.max(1.6, u * 1.1), 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.arc(ex + (dir > 0 ? u * 1.3 : -u * 1.3), ey + u * 1.6, u * 1.8, 0.15 * Math.PI, 0.85 * Math.PI);
    c.lineWidth = Math.max(1.4, u);
    c.strokeStyle = o;
    c.stroke();
    // 天线
    var ax = tx + tw * 0.3;
    rect(c, ax, ty - h * 0.16, Math.max(1.5, u * 0.8), h * 0.16, o);
    c.beginPath();
    c.arc(ax + u * 0.4, ty - h * 0.18, Math.max(2, u * 1.2), 0, Math.PI * 2);
    c.fillStyle = '#ffd23e';
    c.fill();
    c.lineWidth = Math.max(1, u * 0.7);
    c.strokeStyle = o;
    c.stroke();
  }

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
    var W = cssW, H = cssH, horizon = H * 0.58;

    // 日落天空
    var g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, '#6fb9ef');
    g.addColorStop(0.45, '#a5d8f7');
    g.addColorStop(0.8, '#ffd9a0');
    g.addColorStop(1, '#ff9d76');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, horizon + 1);
    // 太阳
    ctx.beginPath();
    ctx.arc(W * 0.76, horizon * 0.42, H * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#fff3a6';
    ctx.fill();
    // 像素云（橙粉）
    function cloud(cx, cy, s, col) {
      ctx.fillStyle = col;
      ctx.fillRect(cx, cy, 10 * s, 3 * s);
      ctx.fillRect(cx + 2 * s, cy - 2 * s, 6 * s, 2 * s);
      ctx.fillRect(cx + 7 * s, cy - 1 * s, 4 * s, 1.5 * s);
    }
    cloud(W * 0.06, H * 0.14, W / 90, '#ffb3a0');
    cloud(W * 0.52, H * 0.08, W / 100, '#ff9d76');
    cloud(W * 0.3, H * 0.3, W / 120, '#ffffff');
    cloud(W * 0.82, H * 0.3, W / 130, '#ffb3a0');
    // 远山
    ctx.fillStyle = '#7cc24e';
    ctx.fillRect(0, horizon - H * 0.08, W, H * 0.08);
    ctx.fillStyle = '#5da83a';
    [[0.1, 0.1], [0.3, 0.13], [0.62, 0.09], [0.85, 0.12]].forEach(function (m) {
      ctx.fillRect(W * m[0], horizon - H * m[1], W * 0.16, H * m[1]);
    });
    // 峭壁地面（左右）+ 草顶
    rect(ctx, 0, horizon, W * 0.44, H - horizon, '#b08a5a');
    rect(ctx, W * 0.56, horizon, W * 0.44, H - horizon, '#b08a5a');
    rect(ctx, 0, horizon, W * 0.44, H * 0.09, '#7cc24e');
    rect(ctx, W * 0.56, horizon, W * 0.44, H * 0.09, '#7cc24e');
    rect(ctx, 0, horizon + H * 0.09, W * 0.44, H * 0.03, '#5da83a');
    rect(ctx, W * 0.56, horizon + H * 0.09, W * 0.44, H * 0.03, '#5da83a');
    // 岩石点缀
    ctx.fillStyle = '#8a6a42';
    [[0.05, 0.8], [0.3, 0.86], [0.66, 0.82], [0.9, 0.88]].forEach(function (p) {
      ctx.fillRect(W * p[0], H * p[1], W * 0.03, H * 0.05);
    });
    // 河流（中间）+ 瀑布水线 + 波光
    rect(ctx, W * 0.44, horizon, W * 0.12, H - horizon, '#4aa8ec');
    rect(ctx, W * 0.468, horizon, W * 0.014, H * 0.18, '#eaf7ff');
    rect(ctx, W * 0.493, horizon, W * 0.014, H * 0.13, '#eaf7ff');
    rect(ctx, W * 0.518, horizon, W * 0.014, H * 0.16, '#eaf7ff');
    rect(ctx, W * 0.475, horizon + H * 0.18, W * 0.05, H * 0.04, '#eaf7ff');
    ctx.fillStyle = '#d6f0ff';
    ctx.fillRect(W * 0.46, H * 0.82, W * 0.04, 2.5);
    ctx.fillRect(W * 0.49, H * 0.92, W * 0.05, 2.5);
    ctx.fillStyle = '#fff7ae';
    ctx.fillRect(W * 0.47, H * 0.74, 3, 3);
    ctx.fillRect(W * 0.51, H * 0.86, 3, 3);
    // 两辆 Q 版坦克（站在草顶上）
    var tw = W * 0.26;
    drawCuteTank(ctx, W * 0.07, horizon + H * 0.14, tw, { M: '#e8402f', D: '#b01e18', L: '#ff8a68' }, 1);
    drawCuteTank(ctx, W * 0.67, horizon + H * 0.14, tw, { M: '#2f7de1', D: '#1d56b0', L: '#6db4ff' }, -1);
  };

  root.IFRender = R;
})(typeof window !== 'undefined' ? window : globalThis);
