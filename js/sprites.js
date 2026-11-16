// 铁甲夹击：Q 版坦克像素精灵（IFSprites，原创）
// 16×16 像素图，粗黑描边、亮色扁平。精灵朝上绘制；红方（上方阵营）
// 垂直翻转，炮口朝下迎敌；蓝方炮口朝上。轻/中/重尺寸区分明显。
// 设计要点：黑描边只画外轮廓；炮塔用亮/暗主色区分层次，不用黑框，
// 远看首先是红/蓝而不是黑；履带只占 1 像素宽。
(function (root) {
  'use strict';

  var S = {};

  // 字符调色：K 描边 / B 炮管 / T 履带 / G 轮子 / W 高光 / M 主色 / D 深色 / L 亮色
  var COMMON = { K: '#16161f', B: '#565b66', T: '#23262e', G: '#8a8f9a', W: '#ffffff' };
  var SIDE = {
    1: { M: '#e8402f', D: '#b01e18', L: '#ff8a68' }, // 红方
    2: { M: '#2f7de1', D: '#1d56b0', L: '#6db4ff' }, // 蓝方
  };

  // 每行必须 16 字符（模块加载时自检，行长不对直接报错，不静默画错）。
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

  // 校验像素图（开发期兜底：行长不对时控制台报错，不静默画错）。
  Object.keys(MAPS).forEach(function (k) {
    var m = MAPS[k];
    if (m.length !== 16) throw new Error('sprite ' + k + ': need 16 rows, got ' + m.length);
    m.forEach(function (row, i) {
      if (row.length !== 16) throw new Error('sprite ' + k + ' row ' + i + ': need 16 chars, got ' + row.length);
    });
  });

  var SCALE = 4; // 16×16 → 64×64 画布
  var cache = {};

  // 取一辆坦克的精灵画布（朝向：蓝方朝上，红方朝下迎敌）。
  S.tank = function (type, owner) {
    var key = type + '|' + owner;
    if (cache[key]) return cache[key];
    var map = MAPS[type] || MAPS.medium;
    var pal = {};
    Object.keys(COMMON).forEach(function (k) { pal[k] = COMMON[k]; });
    var sp = SIDE[owner] || SIDE[1];
    pal.M = sp.M; pal.D = sp.D; pal.L = sp.L;
    var cv = document.createElement('canvas');
    cv.width = 16 * SCALE;
    cv.height = 16 * SCALE;
    var c = cv.getContext('2d');
    var flip = (owner === 1); // 红方翻转，炮口朝下
    for (var y = 0; y < 16; y++) {
      for (var x = 0; x < 16; x++) {
        var ch = map[y].charAt(x);
        if (ch === '.') continue;
        var dy = flip ? 15 - y : y;
        c.fillStyle = pal[ch] || '#ff00ff';
        c.fillRect(x * SCALE, dy * SCALE, SCALE, SCALE);
      }
    }
    cache[key] = cv;
    return cv;
  };

  // 棋盘内占比（相对格边长）：轻 / 中 / 重尺寸区分明显。
  S.SCALE_IN_CELL = { light: 0.68, medium: 0.86, heavy: 0.98 };

  root.IFSprites = S;
})(typeof window !== 'undefined' ? window : globalThis);
