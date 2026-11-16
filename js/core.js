// 铁甲夹击 Iron Flank：规则核心（IFCore），潮汐战线式。
// 纯数据 state + 纯函数，不依赖浏览器（可在 Node 跑模拟 / 测试）。
// 集火规则忠实移植自 holynova/tank-tactics-3d 的 RULES.md（4×4 二打一原案）：
// 只扫描落点所在行与列；连续三格 [攻][攻][防] 或 [防][攻][攻] 击杀最外侧防守方；
// 防守方在线上紧邻同色友军则受保护；行列独立结算、结果去重。
// 一处按 8×8 棋盘缩放的调整：拥挤豁免阈值由原案的 >3 改为 >4（见 data.js D.CROWD_LIMIT
// 的注释）——阈值 3 会让友军保护与蓝方「穿透」技能在逻辑上永远触发不了。
(function (root) {
  'use strict';
  var D = root.IFData || (typeof require !== 'undefined' ? require('./data.js') : null);

  var C = {};
  var W = D.W, H = D.H;
  var DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function inBounds(x, y) { return x >= 0 && y >= 0 && x < W && y < H; }
  function other(side) { return side === 0 ? 1 : 0; }

  // ── 地图：半张字符画 → 8×8 地形（180° 旋转对称）──
  C.expandHalf = function (half) {
    var t = [];
    for (var y = 0; y < H; y++) {
      t.push([]);
      for (var x = 0; x < W; x++) {
        var ch;
        if (y < half.length) ch = half[y].charAt(x);
        else ch = half[H - 1 - y].charAt(W - 1 - x); // 下半 = 上半旋转 180°
        var key = 'plain';
        for (var k in D.TERRAIN) if (D.TERRAIN[k].char === ch) key = k;
        t[y].push(key);
      }
    }
    return t;
  };

  C.mapById = function (mapId) {
    for (var i = 0; i < D.MAPS.length; i++) if (D.MAPS[i].id === mapId) return D.MAPS[i];
    return D.MAPS[0];
  };

  // ── 开局 ──
  C.newGame = function (mapId) {
    var map = C.mapById(mapId);
    var s = {
      mapId: map.id,
      w: W, h: H,
      terrain: C.expandHalf(map.half),
      units: [],
      turn: 0,
      phase: 'dice', // dice → move → over
      dice: null,
      first: null,
      energy: [0, 0],
      shield: [false, false], // 铁壁：该方免疫集火
      pierce: [false, false], // 穿透：该方集火无视友军保护
      round: 1,
      moves: 0,
      winner: null,
      lastEvents: null,
    };
    var id = 0;
    D.FORMATION.forEach(function (f) {
      s.units.push({ id: id++, side: 0, type: f.type, x: f.x, y: f.y, armor: D.UNITS[f.type].armor, alive: true });
    });
    D.FORMATION.forEach(function (f) {
      var x = W - 1 - f.x, y = H - 1 - f.y; // 蓝方 = 红方旋转 180°
      s.units.push({ id: id++, side: 1, type: f.type, x: x, y: y, armor: D.UNITS[f.type].armor, alive: true });
    });
    return s;
  };

  // ── 掷骰先手：点大者先行，平局重掷。rng 注入以便测试。──
  C.rollDice = function (rng) {
    rng = rng || Math.random;
    var rolls = [];
    var r, b;
    do {
      r = 1 + Math.floor(rng() * 6);
      b = 1 + Math.floor(rng() * 6);
      rolls.push({ red: r, blue: b });
    } while (r === b);
    return { red: r, blue: b, first: r > b ? 0 : 1, rolls: rolls };
  };

  C.startGame = function (s, dice) {
    s.dice = { red: dice.red, blue: dice.blue };
    s.first = dice.first;
    s.turn = dice.first;
    s.phase = 'move';
    return s;
  };

  // ── 查询 ──
  C.unitAt = function (s, x, y) {
    for (var i = 0; i < s.units.length; i++) {
      var u = s.units[i];
      if (u.alive && u.x === x && u.y === y) return u;
    }
    return null;
  };

  C.unitById = function (s, id) {
    for (var i = 0; i < s.units.length; i++) if (s.units[i].id === id) return s.units[i];
    return null;
  };

  C.aliveUnits = function (s, side) {
    return s.units.filter(function (u) { return u.alive && u.side === side; });
  };

  C.terrainAt = function (s, x, y) { return s.terrain[y][x]; };

  // 某格能否被单位进入（地形可通行 + 无其他存活单位）
  C.enterable = function (s, x, y, movingUnit) {
    if (!inBounds(x, y)) return false;
    if (!D.TERRAIN[s.terrain[y][x]].passable) return false;
    var u = C.unitAt(s, x, y);
    if (u && u !== movingUnit) return false;
    return true;
  };

  // 从 (fromX, fromY) 出发的一步可达格（移动中单位自身所在格视为空）
  C.stepTargets = function (s, unit, fromX, fromY) {
    var out = [];
    DIRS.forEach(function (d) {
      var x = fromX + d[0], y = fromY + d[1];
      if (C.enterable(s, x, y, unit)) out.push({ x: x, y: y });
    });
    return out;
  };

  // 枚举某方全部合法移动（AI 用）：{ unitId, path: [{x,y}...] }，按终点去重（只留最短路径）
  C.legalMoves = function (s, side) {
    var out = [];
    var seen = {};
    C.aliveUnits(s, side).forEach(function (u) {
      var maxSteps = D.UNITS[u.type].steps;
      var steps1 = C.stepTargets(s, u, u.x, u.y);
      steps1.forEach(function (t1) {
        var key = u.id + ':' + t1.x + ',' + t1.y;
        if (!seen[key]) { seen[key] = 1; out.push({ unitId: u.id, path: [{ x: t1.x, y: t1.y }] }); }
        if (maxSteps >= 2) {
          // 第二步从 t1 出发；原格已腾空，可回走
          C.stepTargets(s, u, t1.x, t1.y).forEach(function (t2) {
            if (t2.x === u.x && t2.y === u.y) return; // 回到原地 = 没动，不算
            var k2 = u.id + ':' + t2.x + ',' + t2.y;
            if (!seen[k2]) { seen[k2] = 1; out.push({ unitId: u.id, path: [{ x: t1.x, y: t1.y }, { x: t2.x, y: t2.y }] }); }
          });
        }
      });
    });
    return out;
  };

  C.hasAnyMove = function (s, side) { return C.legalMoves(s, side).length > 0; };

  // ── 技能 ──
  C.canSkill = function (s, side) {
    if (s.phase !== 'move' || s.turn !== side) return false;
    var sk = D.SKILLS[D.SIDES[side].skill];
    if (s.energy[side] < sk.cost) return false;
    if (sk.id === 'shield' && s.shield[side]) return false;
    if (sk.id === 'pierce' && s.pierce[side]) return false;
    return true;
  };

  C.fireSkill = function (s, side) {
    if (!C.canSkill(s, side)) return false;
    var sk = D.SKILLS[D.SIDES[side].skill];
    s.energy[side] -= sk.cost;
    if (sk.id === 'shield') s.shield[side] = true;
    else s.pierce[side] = true;
    return true;
  };

  // ── 集火结算（核心规则）──
  function lineUnits(s, cells) {
    var out = [];
    cells.forEach(function (c, i) {
      var u = C.unitAt(s, c.x, c.y);
      if (u) out.push({ idx: i, unit: u });
    });
    return out;
  }

  // 目标在该线上是否紧邻同色友军（相邻一格）
  function hasFriendlyAdjacent(s, target, cells) {
    var pos = -1;
    for (var i = 0; i < cells.length; i++) if (cells[i].x === target.x && cells[i].y === target.y) { pos = i; break; }
    if (pos < 0) return false;
    var nb = [];
    if (pos > 0) nb.push(cells[pos - 1]);
    if (pos < cells.length - 1) nb.push(cells[pos + 1]);
    for (var j = 0; j < nb.length; j++) {
      var u = C.unitAt(s, nb[j].x, nb[j].y);
      if (u && u.side === target.side) return true;
    }
    return false;
  }

  function scanLine(s, cells, atk, threatened) {
    var present = lineUnits(s, cells);
    if (present.length > D.CROWD_LIMIT) return; // 拥挤保护：线上单位超限，整条线豁免
    var def = other(atk);
    for (var i = 0; i + 2 < cells.length; i++) {
      var a = C.unitAt(s, cells[i].x, cells[i].y);
      var b = C.unitAt(s, cells[i + 1].x, cells[i + 1].y);
      var c = C.unitAt(s, cells[i + 2].x, cells[i + 2].y);
      if (!a || !b || !c) continue;
      var target = null;
      if (a.side === atk && b.side === atk && c.side === def) target = c;
      else if (a.side === def && b.side === atk && c.side === atk) target = a;
      if (!target) continue;
      if (threatened[target.id]) continue;
      // 地形免疫：森林 / 城市上的单位免于集火
      if (D.TERRAIN[s.terrain[target.y][target.x]].immune) continue;
      // 铁壁：防守方全军免疫
      if (s.shield[def]) continue;
      // 友军相邻保护（穿透可无视）
      if (!s.pierce[atk] && hasFriendlyAdjacent(s, target, cells)) continue;
      threatened[target.id] = target;
    }
  }

  // 落点行列集火结算，返回 { kills:[id], armorLost:[id] }
  C.resolveFlank = function (s, mover) {
    var atk = mover.side;
    var threatened = {};
    var row = [], col = [];
    for (var x = 0; x < W; x++) row.push({ x: x, y: mover.y });
    for (var y = 0; y < H; y++) col.push({ x: mover.x, y: y });
    scanLine(s, row, atk, threatened);
    scanLine(s, col, atk, threatened);
    var events = { kills: [], armorLost: [] };
    Object.keys(threatened).forEach(function (id) {
      var u = threatened[id];
      if (u.type === 'heavy' && u.armor > 0) {
        u.armor = 0;
        events.armorLost.push(u.id);
      } else {
        u.alive = false;
        events.kills.push(u.id);
      }
    });
    if (events.kills.length) {
      var gain = D.SKILLS[D.SIDES[atk].skill].gain;
      s.energy[atk] = Math.min(100, s.energy[atk] + gain * events.kills.length);
    }
    return events;
  };

  // ── 回合流转 ──
  function endTurn(s) {
    s.moves++;
    s.turn = other(s.turn);
    // 技能持续到自己下个回合开始：轮到某方时清掉该方的技能
    s.shield[s.turn] = false;
    s.pierce[s.turn] = false;
    if (s.turn === s.first) s.round++;
  }

  // 无路可走时跳过回合
  C.passTurn = function (s) {
    if (s.phase !== 'move') return false;
    s.lastEvents = { pass: true, kills: [], armorLost: [] };
    endTurn(s);
    return true;
  };

  // ── 执行移动 ──
  // path：1 步（中/重）或 1–2 步（轻）。返回 events，或非法时返回 { error }。
  C.applyMove = function (s, unitId, path) {
    if (s.phase !== 'move') return { error: 'not-in-move-phase' };
    var u = C.unitById(s, unitId);
    if (!u || !u.alive) return { error: 'no-such-unit' };
    if (u.side !== s.turn) return { error: 'not-your-unit' };
    var maxSteps = D.UNITS[u.type].steps;
    if (!path || !path.length || path.length > maxSteps) return { error: 'bad-path-length' };
    var px = u.x, py = u.y;
    for (var i = 0; i < path.length; i++) {
      var st = path[i];
      if (Math.abs(st.x - px) + Math.abs(st.y - py) !== 1) return { error: 'not-adjacent' };
      if (!C.enterable(s, st.x, st.y, u)) return { error: 'blocked' };
      px = st.x; py = st.y;
    }
    var from = { x: u.x, y: u.y };
    u.x = px; u.y = py;
    var ev = C.resolveFlank(s, u);
    ev.unitId = unitId;
    ev.from = from;
    ev.to = { x: px, y: py };
    ev.path = path.map(function (p) { return { x: p.x, y: p.y }; });
    ev.side = u.side;
    s.lastEvents = ev;
    // 胜负：敌方剩余 ≤1
    if (C.aliveUnits(s, other(u.side)).length <= 1) {
      s.winner = u.side;
      s.phase = 'over';
      return ev;
    }
    endTurn(s);
    return ev;
  };

  // ── 模拟（AI / 界面预览用）：克隆后执行，不动原状态 ──
  C.clone = function (s) { return JSON.parse(JSON.stringify(s)); };

  C.simulate = function (s, unitId, path) {
    var c = C.clone(s);
    var ev = C.applyMove(c, unitId, path);
    return { state: c, events: ev };
  };

  // 预览：这次移动会击杀谁（返回单位 id 列表；界面用来标红目标格）
  C.previewKills = function (s, unitId, path) {
    var r = C.simulate(s, unitId, path);
    if (r.events.error) return { kills: [], armorLost: [] };
    return { kills: r.events.kills || [], armorLost: r.events.armorLost || [] };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else root.IFCore = C;
})(typeof window !== 'undefined' ? window : globalThis);
