// 铁甲夹击：美术素材（IFSprites）
// 坦克 / 地形 / 横幅使用 AI 生成的像素图片素材（assets/*.png，品红抠图）。
// 红方炮口朝下、蓝方朝上——生成时已按朝向画好，不靠翻转区分。
// 原 16×16 字符画代码手绘保留为图片未加载 / 加载失败时的兜底。
(function (root) {
  'use strict';

  var S = {};

  // ── 图片素材 ──
  var BASE = 'assets/';
  var FILES = {
    'tank|light|1': 'tank-red-light.png',
    'tank|medium|1': 'tank-red-medium.png',
    'tank|heavy|1': 'tank-red-heavy.png',
    'tank|light|2': 'tank-blue-light.png',
    'tank|medium|2': 'tank-blue-medium.png',
    'tank|heavy|2': 'tank-blue-heavy.png',
    'tree': 'tree.png',
    'mountain': 'mountain.png',
    'city': 'city.png',
    'grass-a': 'grass-a.png',
    'grass-b': 'grass-b.png',
    'river-a': 'river-a.png',
    'river-b': 'river-b.png',
    'banner': 'banner.png',
  };
  var imgs = {};
  var loadPromise = null;

  // 预加载全部素材；单张失败不阻塞（走兜底），全部 settled 后 resolve。
  S.loadAll = function () {
    if (loadPromise) return loadPromise;
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      loadPromise = Promise.resolve();
      return loadPromise;
    }
    var keys = Object.keys(FILES);
    var done = 0;
    loadPromise = new Promise(function (resolve) {
      if (!keys.length) { resolve(); return; }
      keys.forEach(function (k) {
        var img = new Image();
        img.onload = function () { imgs[k] = img; if (++done === keys.length) resolve(); };
        img.onerror = function () { if (++done === keys.length) resolve(); };
        img.src = BASE + FILES[k];
      });
    });
    return loadPromise;
  };

  // 取图（未加载完成返回 null，调用方用代码手绘兜底）
  S.img = function (key) { return imgs[key] || null; };

  // ── 坦克：图片优先，兜底代码手绘 ──
  S.tank = function (type, owner) {
    var img = imgs['tank|' + type + '|' + owner];
    if (img) return img;
    return codeTank(type, owner);
  };

  // 棋盘内占比（相对格边长）：生成图含长炮管，占比按整图计。
  S.SCALE_IN_CELL = { light: 0.78, medium: 0.95, heavy: 1.0 };

  // ── 兜底：原 16×16 字符画坦克 ──
  // 字符调色：K 描边 / B 炮管 / T 履带 / G 轮子 / W 高光 / M 主色 / D 深色 / L 亮色
  var COMMON = { K: '#16161f', B: '#565b66', T: '#23262e', G: '#8a8f9a', W: '#ffffff' };
  var SIDE = {
    1: { M: '#e8402f', D: '#b01e18', L: '#ff8a68' }, // 红方
    2: { M: '#2f7de1', D: '#1d56b0', L: '#6db4ff' }, // 蓝方
  };

  var MAPS = {
    light: [
      '................',
      '......KBBK......',
      '......KBBK......',
      '......KBBK......',
      '...KKKKKKKKKK...',
      '...KTMMMMMMTK...',
      '...KTMMLLMMTK...',
      '...KGMMLWMMGK...',
      '...KTMMMMMMTK...',
      '...KTMDDDDMTK...',
      '...KGMMMMMMGK...',
      '...KTMMMMMMTK...',
      '...KKKKKKKKKK...',
      '................',
      '................',
      '................',
    ],
    medium: [
      '......KBBK......',
      '......KBBK......',
      '......KBBK......',
      '..KKKKKKKKKKKK..',
      '..KTMMMMMMMMTK..',
      '..KTMMLLLLMMTK..',
      '..KGMMLLWMMMGK..',
      '..KTMMMMMMMMTK..',
      '..KTMMMMMMMMTK..',
      '..KTMDMMMMDMTK..',
      '..KGMDDDDDDMGK..',
      '..KTMMMMMMMMTK..',
      '..KTMMMMMMMMTK..',
      '..KKKKKKKKKKKK..',
      '................',
      '................',
    ],
    heavy: [
      '.....KBBBBK.....',
      '.....KBBBBK.....',
      '.....KBBBBK.....',
      '.KKKKKKKKKKKKKK.',
      '.KTMMMMMMMMMMTK.',
      '.KTMMLLLLLLMMTK.',
      '.KGMMLLWMMMMMGK.',
      '.KTMMMMMMMMMMTK.',
      '.KTMMMMMMMMMMTK.',
      '.KGMDMMMMMMDMGK.',
      '.KTMDDDDDDDDMTK.',
      '.KTMMMMMMMMMMTK.',
      '.KGMMMMMMMMMMGK.',
      '.KTDDDDDDDDDDTK.',
      '.KKKKKKKKKKKKKK.',
      '................',
    ],
  };

  Object.keys(MAPS).forEach(function (k) {
    var m = MAPS[k];
    if (m.length !== 16) throw new Error('sprite ' + k + ': need 16 rows, got ' + m.length);
    m.forEach(function (row, i) {
      if (row.length !== 16) throw new Error('sprite ' + k + ' row ' + i + ': need 16 chars, got ' + row.length);
    });
  });

  var SCALE = 4; // 16×16 → 64×64 画布
  var cache = {};

  function codeTank(type, owner) {
    if (typeof document === 'undefined') return null;
    var key = type + '|' + owner;
    if (cache[key]) return cache[key];
    var map = MAPS[type] || MAPS.medium;
    var pal = {};
    Object.keys(COMMON).forEach(function (k) { pal[k] = COMMON[k]; });
    var sp = SIDE[owner] || SIDE[1];
    pal.M = sp.M; pal.D = sp.D; pal.L = sp.L;
    var flip = (owner === 1); // 红方翻转，炮口朝下
    var grid = [], shade = [], x, y;
    for (y = 0; y < 16; y++) { grid[y] = []; for (x = 0; x < 16; x++) grid[y][x] = '.'; }
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        var ch = map[y].charAt(x);
        if (ch === '.') continue;
        grid[flip ? 15 - y : y][x] = ch;
        if (flip && (ch === 'W' || ch === 'L' || ch === 'D')) shade.push({ x: x, y: y, ch: ch });
      }
    }
    if (flip) {
      shade.forEach(function (p) { grid[15 - p.y][p.x] = 'M'; });
      shade.forEach(function (p) { if (grid[p.y][p.x] === 'M') grid[p.y][p.x] = p.ch; });
    }
    var cv = document.createElement('canvas');
    cv.width = 16 * SCALE;
    cv.height = 16 * SCALE;
    var c = cv.getContext('2d');
    for (y = 0; y < 16; y++) {
      for (x = 0; x < 16; x++) {
        var gch = grid[y][x];
        if (gch === '.') continue;
        c.fillStyle = pal[gch] || '#ff00ff';
        c.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
    cache[key] = cv;
    return cv;
  }

  root.IFSprites = S;
})(typeof window !== 'undefined' ? window : globalThis);
