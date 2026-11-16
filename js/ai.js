// 铁甲夹击：电脑 AI（IFAI），潮汐战线式启发式打分。
// aiNext 每次返回一个动作（{ unitId, path }），不是一次算完整回合。
// 8×8 棋盘分支因子太大，不做 Minimax / 搜索；只做单步模拟 + 打分。
(function (root) {
  'use strict';
  var D = root.IFData || (typeof require !== 'undefined' ? require('./data.js') : null);
  var C = root.IFCore || (typeof require !== 'undefined' ? require('./core.js') : null);

  var AI = {};

  // 难度 = 参数集（数值越大越强）。权重经 Node 模拟调参（见 tests/soak-ai.js）：
  // replyKill 必须明显小于 kill，否则 AI 为躲报复永远不设局、对局拖成平局；
  // 但也不能太小：hard 在 threat 3500 / replyKill 2500 时镜像击杀上去了，
  // 对 easy 的胜率却从 9/10 跌到 6/10（为设局白送人头）；5000/2000 更跌到 4/10。
  // 2800/3200 是测到的平衡点：镜像 2.3 杀/局且 2/10 分胜负，对 easy 仍 9/10。
  // hard 也保留一点噪声，避免确定性来回摆动。
  AI.LEVELS = {
    easy:   { noise: 1500, replyCheck: false, randomPick: 0.3,  threat: 0,    advance: 60,  prox: -40,  replyKill: 0,    immune: 500, ally: 150 },
    normal: { noise: 300,  replyCheck: true,  randomPick: 0.05, threat: 1500, advance: 120, prox: -80,  replyKill: 4500, immune: 500, ally: 150 },
    hard:   { noise: 60,   replyCheck: true,  randomPick: 0,    threat: 2800, advance: 150, prox: -100, replyKill: 3200, immune: 500, ally: 150 },
  };
  AI.KILL = 10000; AI.KILL_HEAVY = 13000; AI.ARMOR = 2500; AI.WIN = 100000;

  function other(side) { return side === 0 ? 1 : 0; }

  // 某方在给定状态下一次移动最多能击杀几辆（以及能否破甲）
  function bestReplyValue(s, side) {
    var moves = C.legalMoves(s, side);
    var best = { kills: 0, armor: 0 };
    for (var i = 0; i < moves.length; i++) {
      var r = C.simulate(s, moves[i].unitId, moves[i].path);
      if (r.events.error) continue;
      var k = (r.events.kills || []).length;
      var a = (r.events.armorLost || []).length;
      if (k > best.kills || (k === best.kills && a > best.armor)) best = { kills: k, armor: a };
    }
    return best;
  }

  // 设局分：这步之后，下回合一步即可完成集火的「准三格」。
  // 只数真正可完成的窗口：敌方在三格窗口的一端、我方已占一格、空格可被
  // 我方下回合到达；再按目标的可逃格子数加权——无路可逃的目标是即将到手
  // 的击杀（大分），逃格越多价值越低（对手大概率逃掉）。
  // 旧版只数「同线 2 我 + 1 敌」不看几何与逃格，镜像对局里双方永远设局、
  // 永远逃掉，10 局 0 击杀；新版逼 AI 去造无路可逃的杀局。
  function threatScore(s, side) {
    var score = 0;
    var mine = C.aliveUnits(s, side);
    var foe = C.aliveUnits(s, other(side));
    if (!mine.length || !foe.length) return 0;
    // 我方下回合能到达的格子（1 步；轻型 2 步）
    var reach = {};
    mine.forEach(function (u) {
      var t1 = C.stepTargets(s, u, u.x, u.y);
      t1.forEach(function (t) { reach[t.x + ',' + t.y] = 1; });
      if (D.UNITS[u.type].steps >= 2) {
        t1.forEach(function (a) {
          C.stepTargets(s, u, a.x, a.y).forEach(function (b) {
            if (b.x !== u.x || b.y !== u.y) reach[b.x + ',' + b.y] = 1;
          });
        });
      }
    });
    function scanLine(cells) {
      for (var i = 0; i + 2 < cells.length; i++) {
        var w = [cells[i], cells[i + 1], cells[i + 2]];
        var occ = w.map(function (c) { return C.unitAt(s, c.x, c.y); });
        // 敌方必须在窗口一端（中间的敌方填不满三格杀）
        var foeEnd = -1;
        if (occ[0] && occ[0].side !== side) foeEnd = 0;
        else if (occ[2] && occ[2].side !== side) foeEnd = 2;
        if (foeEnd < 0) continue;
        var foeUnit = occ[foeEnd];
        // 免疫地形 → 设局无用
        if (D.TERRAIN[s.terrain[foeUnit.y][foeUnit.x]].immune) continue;
        // 已受友军保护 → 设局无用（除非己方有穿透）
        if (!s.pierce[side]) {
          var fp = i + foeEnd, prot = false;
          if (fp > 0) { var pl = C.unitAt(s, cells[fp - 1].x, cells[fp - 1].y); if (pl && pl.side !== side) prot = true; }
          if (fp < cells.length - 1) { var pr = C.unitAt(s, cells[fp + 1].x, cells[fp + 1].y); if (pr && pr.side !== side) prot = true; }
          if (prot) continue;
        }
        // 其余两格：一格是我方，一格是空且下回合可达
        var mineCount = 0, gap = null;
        [0, 1, 2].forEach(function (j) {
          if (j === foeEnd) return;
          if (occ[j] && occ[j].side === side) mineCount++;
          else if (!occ[j]) gap = w[j];
        });
        if (mineCount !== 1 || !gap) continue;
        if (!reach[gap.x + ',' + gap.y]) continue;
        var escapes = C.stepTargets(s, foeUnit, foeUnit.x, foeUnit.y).length;
        score += escapes === 0 ? 3 : escapes === 1 ? 1.5 : escapes === 2 ? 0.7 : 0.25;
      }
    }
    for (var y = 0; y < 8; y++) {
      var row = [];
      for (var x = 0; x < 8; x++) row.push({ x: x, y: y });
      scanLine(row);
    }
    for (var x = 0; x < 8; x++) {
      var col = [];
      for (var yy = 0; yy < 8; yy++) col.push({ x: x, y: yy });
      scanLine(col);
    }
    return score;
  }

  function scoreMove(s, side, mv, P) {
    var r = C.simulate(s, mv.unitId, mv.path);
    if (r.events.error) return -Infinity;
    var ev = r.events;
    var ns = r.state;
    var score = 0;
    var kills = ev.kills || [], armorLost = ev.armorLost || [];
    // 击杀是最高价值；重型目标更值钱
    kills.forEach(function (id) {
      var v = C.unitById(s, id);
      score += v && v.type === 'heavy' ? AI.KILL_HEAVY : AI.KILL;
    });
    score += armorLost.length * AI.ARMOR;
    if (ns.winner === side) score += AI.WIN;
    // 位置分（全部取自难度参数集 P，勿写死数值）
    var to = mv.path[mv.path.length - 1];
    var terr = D.TERRAIN[ns.terrain[to.y][to.x]];
    if (terr.immune) score += P.immune; // 森林 / 城市免伤
    score += side === 0 ? to.y * P.advance : (7 - to.y) * P.advance; // 向敌方推进
    // 贴近友军（互相保护、便于组集火）
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      var n = C.unitAt(ns, to.x + d[0], to.y + d[1]);
      if (n && n.side === side) score += P.ally;
    });
    // 靠近最近敌军（P.prox 为负数）
    var best = 99;
    C.aliveUnits(ns, other(side)).forEach(function (e) {
      best = Math.min(best, Math.abs(e.x - to.x) + Math.abs(e.y - to.y));
    });
    score += best * P.prox;
    // 设局分
    score += threatScore(ns, side) * P.threat;
    // 对手下回合的报复：我这步之后，对手最多能杀我几辆
    if (P.replyCheck && ns.phase === 'move') {
      var rep = bestReplyValue(ns, other(side));
      score -= rep.kills * P.replyKill + rep.armor * Math.round(P.replyKill / 2);
    }
    // 噪声（难度越低越随意）
    if (P.noise) score += (Math.random() * 2 - 1) * P.noise;
    return score;
  }

  // 主接口：返回一个合法移动，或 null（无路可走 → UI 跳过回合）
  AI.aiNext = function (s, level) {
    var P = AI.LEVELS[level] || AI.LEVELS.normal;
    var side = s.turn;
    var moves = C.legalMoves(s, side);
    if (!moves.length) return null;
    if (P.randomPick && Math.random() < P.randomPick) {
      return moves[Math.floor(Math.random() * moves.length)];
    }
    var best = null, bestScore = -Infinity;
    for (var i = 0; i < moves.length; i++) {
      var sc = scoreMove(s, side, moves[i], P);
      if (sc > bestScore) { bestScore = sc; best = moves[i]; }
    }
    return best;
  };

  // 技能时机：只在能改变结果时放，否则留着（能量满了也不会溢出浪费）
  AI.shouldFireSkill = function (s, side, level) {
    if (!C.canSkill(s, side)) return false;
    var sk = D.SKILLS[D.SIDES[side].skill];
    var P = AI.LEVELS[level] || AI.LEVELS.normal;
    if (P.randomPick && Math.random() < P.randomPick) return Math.random() < 0.5;
    if (sk.id === 'pierce') {
      // 穿透：有某步开了穿透才能杀、关了杀不了，才放
      var moves = C.legalMoves(s, side);
      var without = 0, withSk = 0;
      moves.forEach(function (mv) {
        var r0 = C.simulate(s, mv.unitId, mv.path);
        without = Math.max(without, (r0.events.kills || []).length);
        var c = C.clone(s);
        c.pierce[side] = true;
        var r1 = C.simulate(c, mv.unitId, mv.path);
        withSk = Math.max(withSk, (r1.events.kills || []).length);
      });
      return withSk > without;
    }
    // 铁壁：对手下回合能杀我人，才放
    var c2 = C.clone(s);
    c2.turn = other(side);
    var rep = bestReplyValue(c2, other(side));
    return rep.kills > 0;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
  else root.IFAI = AI;
})(typeof window !== 'undefined' ? window : globalThis);
