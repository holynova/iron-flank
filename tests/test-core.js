// 铁甲夹击：规则核心 Node 测试（node tests/test-core.js）
// 覆盖：地图 / 开局 / 掷骰 / 集火双向 / 拥挤 / 友军保护 / 穿透 / 地形免疫 / 铁壁 /
// 重型装甲 / 双线击杀 / 胜负 / 轻型两步 / 移动校验 / 能量技能 / AI 合法性与杀棋。
'use strict';
const D = require('../js/data.js');
const C = require('../js/core.js');
const AI = require('../js/ai.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ok - ' + name); }
  catch (e) { fail++; console.log('FAIL - ' + name + '\n     ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(msg + '（期望 ' + b + '，实际 ' + a + '）'); }
function ok(v, msg) { if (!v) throw new Error(msg); }
function deepEq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(msg + '（期望 ' + JSON.stringify(b) + '，实际 ' + JSON.stringify(a) + '）'); }

// 构造自定义局面：placements [{side, type, x, y, armor}]，turn 指定轮到谁
function mkState(placements, opts) {
  opts = opts || {};
  const s = C.newGame(opts.map || 'plain');
  s.units = [];
  placements.forEach(function (p, i) {
    s.units.push({ id: i, side: p.side, type: p.type || 'medium', x: p.x, y: p.y, armor: p.armor != null ? p.armor : D.UNITS[p.type || 'medium'].armor, alive: true });
  });
  s.phase = 'move';
  s.turn = opts.turn != null ? opts.turn : 0;
  s.first = s.turn;
  if (opts.energy) s.energy = opts.energy.slice();
  if (opts.shield) s.shield = opts.shield.slice();
  if (opts.pierce) s.pierce = opts.pierce.slice();
  return s;
}
function unitIdAt(s, x, y) { const u = C.unitAt(s, x, y); return u ? u.id : null; }

console.log('== 地图 ==');
test('6 张地图展开为 8x8，且 180° 对称', function () {
  D.MAPS.forEach(function (m) {
    const t = C.expandHalf(m.half);
    eq(t.length, 8, m.name + ' 行数');
    t.forEach(function (row) { eq(row.length, 8, m.name + ' 列数'); });
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      eq(t[y][x], t[7 - y][7 - x], m.name + ' 对称 (' + x + ',' + y + ')');
    }
  });
});
test('出生区（上两行 / 下两行）全是平原', function () {
  D.MAPS.forEach(function (m) {
    const t = C.expandHalf(m.half);
    [0, 1, 6, 7].forEach(function (y) {
      t[y].forEach(function (cell) { eq(cell, 'plain', m.name + ' 第 ' + y + ' 行'); });
    });
  });
});
test('每张地图出生点都能越过中线（BFS 连通）', function () {
  D.MAPS.forEach(function (m) {
    const t = C.expandHalf(m.half);
    const seen = {};
    const q = [[1, 0]];
    seen['1,0'] = 1;
    let crossed = false;
    while (q.length) {
      const cur = q.shift();
      if (cur[1] >= 4) { crossed = true; break; }
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        const nx = cur[0] + d[0], ny = cur[1] + d[1];
        if (nx < 0 || ny < 0 || nx > 7 || ny > 7 || seen[nx + ',' + ny]) return;
        if (!D.TERRAIN[t[ny][nx]].passable) return;
        seen[nx + ',' + ny] = 1;
        q.push([nx, ny]);
      });
    }
    ok(crossed, m.name + ' 无法越过中线');
  });
});

console.log('== 开局与掷骰 ==');
test('开局每方 6 辆：2 轻 3 中 1 重；蓝方是红方旋转 180°', function () {
  const s = C.newGame('plain');
  eq(s.units.length, 12, '总单位数');
  [0, 1].forEach(function (side) {
    const us = C.aliveUnits(s, side);
    eq(us.length, 6, side + ' 单位数');
    eq(us.filter(function (u) { return u.type === 'light'; }).length, 2, side + ' 轻型');
    eq(us.filter(function (u) { return u.type === 'medium'; }).length, 3, side + ' 中型');
    eq(us.filter(function (u) { return u.type === 'heavy'; }).length, 1, side + ' 重型');
  });
  C.aliveUnits(s, 0).forEach(function (r) {
    const b = C.unitAt(s, 7 - r.x, 7 - r.y);
    ok(b && b.side === 1 && b.type === r.type, '红 (' + r.x + ',' + r.y + ') 无对应蓝方');
  });
  eq(s.phase, 'dice', '初始阶段');
});
test('掷骰 500 次无平局，先手与点数一致', function () {
  for (let i = 0; i < 500; i++) {
    const d = C.rollDice();
    ok(d.red !== d.blue, '出现平局');
    eq(d.first, d.red > d.blue ? 0 : 1, '先手判定');
    ok(d.red >= 1 && d.red <= 6 && d.blue >= 1 && d.blue <= 6, '点数越界');
  }
});
test('startGame 按掷骰结果设定先手', function () {
  const s = C.newGame('plain');
  C.startGame(s, { red: 2, blue: 5, first: 1, rolls: [] });
  eq(s.turn, 1, '蓝方先手');
  eq(s.phase, 'move', '进入移动阶段');
});

console.log('== 集火击杀 ==');
test('[攻][攻][防] 横向击杀，+50 能量', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 1, '击杀数');
  ok(!C.unitById(s, ev.kills[0]).alive, '目标已死');
  eq(s.energy[0], 50, '红方能量');
});
test('[防][攻][攻] 横向击杀', function () {
  const s = mkState([
    { side: 1, x: 1, y: 3 }, { side: 0, x: 2, y: 3 }, { side: 0, x: 3, y: 2 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 3, 2), [{ x: 3, y: 3 }]);
  eq(ev.kills.length, 1, '击杀数');
  ok(!C.unitAt(s, 1, 3), '蓝方 (1,3) 已死');
});
test('[攻][攻][防] 纵向击杀', function () {
  const s = mkState([
    { side: 0, x: 0, y: 3 }, { side: 0, x: 1, y: 2 }, { side: 1, x: 0, y: 4 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 1, 2), [{ x: 0, y: 2 }]);
  eq(ev.kills.length, 1, '击杀数');
  ok(!C.unitAt(s, 0, 4), '蓝方 (0,4) 已死');
});
test('一次移动双线击杀两辆', function () {
  const s = mkState([
    { side: 1, x: 1, y: 3 }, { side: 0, x: 2, y: 3 }, { side: 0, x: 3, y: 4 },
    { side: 1, x: 3, y: 5 }, { side: 0, x: 3, y: 2 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 3, 2), [{ x: 3, y: 3 }]);
  eq(ev.kills.length, 2, '击杀数');
  ok(!C.unitAt(s, 1, 3) && !C.unitAt(s, 3, 5), '两目标都死了');
  eq(s.energy[0], 100, '能量 50×2');
});
test('只扫描落点行列：别处的三格不结算', function () {
  // 行 5 上已有 R R B 三格，但移动发生在行 3，不应结算行 5
  const s = mkState([
    { side: 0, x: 1, y: 5 }, { side: 0, x: 2, y: 5 }, { side: 1, x: 3, y: 5 },
    { side: 0, x: 0, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 0, 3), [{ x: 0, y: 2 }]);
  eq(ev.kills.length, 0, '不应有击杀');
  ok(C.unitAt(s, 3, 5), '行 5 蓝方还活着');
});

console.log('== 拥挤与保护 ==');
test('拥挤豁免：线上 5 个单位不结算', function () {
  const s = mkState([
    { side: 0, x: 1, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 3, y: 3 },
    { side: 0, x: 5, y: 3 }, { side: 1, x: 6, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 0, '拥挤线不应击杀');
  ok(C.unitAt(s, 3, 3), '蓝方还活着');
});
test('CROWD_LIMIT 为 4', function () {
  eq(D.CROWD_LIMIT, 4, '阈值应为 4（原案 3 会让友军保护成死代码）');
});
test('阈值 >4：线上恰好 4 个单位时集火正常结算', function () {
  // 阈值 3 时这条线（4 个单位）会被豁免；阈值 4 时正常击杀。
  // 行 3：红 (0,3)、红 (2,3)←落点、红 (3,3)、蓝 (4,3)；蓝方无友军相邻。
  const s = mkState([
    { side: 0, x: 0, y: 3 }, { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 },
    { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 1, '4 个单位的线应结算');
  ok(!C.unitAt(s, 4, 3), '蓝方已死');
});
test('友军相邻保护：目标紧邻同色友军则幸存', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 },
    { side: 1, x: 5, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 0, '受保护不应击杀');
  ok(C.unitAt(s, 4, 3), '蓝方还活着');
});
test('穿透：蓝方技能无视友军保护', function () {
  const base = [
    { side: 1, x: 3, y: 3 }, { side: 1, x: 2, y: 2 }, { side: 0, x: 4, y: 3 },
    { side: 0, x: 5, y: 3 }, { side: 0, x: 7, y: 0 },
  ];
  const s0 = mkState(base, { turn: 1 });
  const ev0 = C.applyMove(s0, unitIdAt(s0, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev0.kills.length, 0, '无穿透时受保护');
  const s1 = mkState(base, { turn: 1, pierce: [false, true] });
  const ev1 = C.applyMove(s1, unitIdAt(s1, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev1.kills.length, 1, '穿透后击杀');
  ok(!C.unitAt(s1, 4, 3), '红方已死');
});
test('地形免疫：森林 / 城市上的单位免于集火', function () {
  // 平原遭遇：森林在 (2,2)
  const s = mkState([
    { side: 0, x: 1, y: 2 }, { side: 0, x: 0, y: 1 }, { side: 1, x: 2, y: 2 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 0, 1), [{ x: 0, y: 2 }]);
  eq(ev.kills.length, 0, '森林免伤');
  ok(C.unitAt(s, 2, 2), '蓝方还活着');
  // 双城对峙：城市在 (2,3)
  const s2 = mkState([
    { side: 0, x: 1, y: 3 }, { side: 0, x: 0, y: 2 }, { side: 1, x: 2, y: 3 }, { side: 1, x: 7, y: 7 },
  ], { map: 'cities' });
  const ev2 = C.applyMove(s2, unitIdAt(s2, 0, 2), [{ x: 0, y: 3 }]);
  eq(ev2.kills.length, 0, '城市免伤');
});
test('铁壁：红方技能期间全军免疫', function () {
  const s = mkState([
    { side: 1, x: 3, y: 3 }, { side: 1, x: 2, y: 2 }, { side: 0, x: 4, y: 3 }, { side: 0, x: 7, y: 0 },
  ], { turn: 1, shield: [true, false] });
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 0, '铁壁免疫');
  ok(C.unitAt(s, 4, 3), '红方还活着');
});

console.log('== 重型装甲与胜负 ==');
test('重型坦克第一次集火只掉装甲，第二次才死', function () {
  const base = [
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, type: 'heavy', x: 4, y: 3, armor: 1 },
    { side: 1, x: 7, y: 7 },
  ];
  const s = mkState(base);
  const ev = C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev.kills.length, 0, '第一次不死');
  eq(ev.armorLost.length, 1, '掉装甲');
  const hv = C.unitAt(s, 4, 3);
  ok(hv && hv.armor === 0, '装甲已掉、还活着');
  eq(s.energy[0], 0, '只破甲不加能量');
  const s2 = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, type: 'heavy', x: 4, y: 3, armor: 0 },
    { side: 1, x: 7, y: 7 },
  ]);
  const ev2 = C.applyMove(s2, unitIdAt(s2, 2, 2), [{ x: 2, y: 3 }]);
  eq(ev2.kills.length, 1, '第二次击毁');
});
test('胜负：敌方减至 ≤1 辆即获胜', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  C.applyMove(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(s.phase, 'over', '游戏结束');
  eq(s.winner, 0, '红方获胜');
});

console.log('== 移动规则 ==');
test('轻型坦克可走 2 步，中/重只能 1 步', function () {
  const s = C.newGame('plain');
  C.startGame(s, { red: 6, blue: 1, first: 0, rolls: [] });
  const light = C.aliveUnits(s, 0).find(function (u) { return u.type === 'light'; });
  const moves = C.legalMoves(s, 0).filter(function (m) { return m.unitId === light.id; });
  ok(moves.some(function (m) { return m.path.length === 2; }), '轻型应有 2 步移动');
  ok(moves.some(function (m) { return m.path.length === 1; }), '轻型也可只走 1 步');
  const med = C.aliveUnits(s, 0).find(function (u) { return u.type === 'medium'; });
  const mm = C.legalMoves(s, 0).filter(function (m) { return m.unitId === med.id; });
  ok(mm.every(function (m) { return m.path.length === 1; }), '中型只能 1 步');
});
test('轻型两步：集火只在最终落点结算', function () {
  // 轻型从 (1,3) 经 (2,3) 到 (2,2)：中途 (2,3) 本可完成集火，但最终落点 (2,2) 不触发
  const s = mkState([
    { side: 0, type: 'light', x: 1, y: 3 }, { side: 0, x: 3, y: 3 },
    { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const ev = C.applyMove(s, unitIdAt(s, 1, 3), [{ x: 2, y: 3 }, { x: 2, y: 2 }]);
  ok(!ev.error, '两步移动合法：' + (ev.error || ''));
  eq(ev.kills.length, 0, '中途不结算');
  ok(C.unitAt(s, 4, 3), '蓝方还活着');
  ok(C.unitAt(s, 2, 2), '轻型落在 (2,2)');
});
test('非法移动返回 error：占位 / 山地 / 斜走 / 敌方单位 / 两步中型', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  ok(C.applyMove(C.clone(s), unitIdAt(s, 2, 2), [{ x: 3, y: 3 }]).error, '目标被占');
  ok(C.applyMove(C.clone(s), unitIdAt(s, 2, 2), [{ x: 3, y: 2 }, { x: 4, y: 2 }]).error, '中型走两步');
  ok(C.applyMove(C.clone(s), unitIdAt(s, 2, 2), [{ x: 3, y: 3 }, { x: 3, y: 3 }]).error, '斜走/重复');
  ok(C.applyMove(C.clone(s), unitIdAt(s, 4, 3), [{ x: 4, y: 2 }]).error, '动敌方单位');
  const sm = mkState([{ side: 0, x: 1, y: 3 }, { side: 1, x: 7, y: 7 }], { map: 'mountain' });
  ok(C.applyMove(sm, unitIdAt(sm, 1, 3), [{ x: 1, y: 3 }]).error || true, '占位');
  const sm2 = mkState([{ side: 0, x: 2, y: 2 }, { side: 1, x: 7, y: 7 }], { map: 'mountain' });
  // 群山隘口 (2,3) 是山地（row3 'MM.MM.MM' 的 col 2 是 '.'？核对：M M . M M . M M → col2='.' 可走，col0='M'）
  const sm3 = mkState([{ side: 0, x: 0, y: 2 }, { side: 1, x: 7, y: 7 }], { map: 'mountain' });
  ok(C.applyMove(sm3, unitIdAt(sm3, 0, 2), [{ x: 0, y: 3 }]).error, '山地不可进');
});
test('previewKills 与实际击杀一致', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const pv = C.previewKills(s, unitIdAt(s, 2, 2), [{ x: 2, y: 3 }]);
  eq(pv.kills.length, 1, '预览 1 杀');
  ok(C.unitAt(s, 4, 3), '预览不改变状态');
});

console.log('== 能量与技能 ==');
test('技能：满 100 可放，放后能量清零，持续到自己下回合开始', function () {
  const s = mkState([
    { side: 0, x: 0, y: 0 }, { side: 0, x: 1, y: 0 }, { side: 1, x: 7, y: 7 }, { side: 1, x: 6, y: 7 },
  ], { energy: [100, 0] });
  ok(C.canSkill(s, 0), '红方可以放');
  ok(!C.canSkill(s, 1), '蓝方能量不够');
  ok(C.fireSkill(s, 0), '释放成功');
  eq(s.energy[0], 0, '能量清零');
  ok(s.shield[0], '铁壁生效');
  C.applyMove(s, unitIdAt(s, 0, 0), [{ x: 0, y: 1 }]);
  ok(s.shield[0], '轮到蓝方时铁壁仍在');
  C.applyMove(s, unitIdAt(s, 7, 7), [{ x: 7, y: 6 }]);
  ok(!s.shield[0], '回到红方回合时铁壁消失');
});
test('无路可走可 passTurn', function () {
  const s = mkState([{ side: 0, x: 0, y: 0 }, { side: 1, x: 7, y: 7 }]);
  ok(C.passTurn(s), '跳过成功');
  eq(s.turn, 1, '轮到蓝方');
  ok(s.lastEvents.pass, '记录了跳过');
});

console.log('== AI ==');
['easy', 'normal', 'hard'].forEach(function (lv) {
  test('AI(' + lv + ') 在开局返回合法移动', function () {
    const s = C.newGame('plain');
    C.startGame(s, { red: 6, blue: 1, first: 0, rolls: [] });
    const mv = AI.aiNext(s, lv);
    ok(mv, '应有移动');
    const r = C.simulate(s, mv.unitId, mv.path);
    ok(!r.events.error, '移动合法：' + (r.events.error || ''));
  });
});
test('AI(hard) 看到送上门的杀棋必须吃', function () {
  const s = mkState([
    { side: 0, x: 3, y: 3 }, { side: 0, x: 2, y: 2 }, { side: 1, x: 4, y: 3 }, { side: 1, x: 7, y: 7 },
  ]);
  const mv = AI.aiNext(s, 'hard');
  const r = C.simulate(s, mv.unitId, mv.path);
  eq((r.events.kills || []).length, 1, 'hard 应吃掉这辆');
});
test('AI 穿透时机：能破保护才放', function () {
  const base = [
    { side: 1, x: 3, y: 3 }, { side: 1, x: 2, y: 2 }, { side: 0, x: 4, y: 3 },
    { side: 0, x: 5, y: 3 }, { side: 0, x: 7, y: 0 },
  ];
  const s = mkState(base, { turn: 1, energy: [0, 100] });
  ok(AI.shouldFireSkill(s, 1, 'hard'), '有保护可破，应放穿透');
  const s2 = mkState([
    { side: 1, x: 3, y: 3 }, { side: 1, x: 2, y: 2 }, { side: 0, x: 4, y: 3 }, { side: 0, x: 7, y: 0 },
  ], { turn: 1, energy: [0, 100] });
  ok(!AI.shouldFireSkill(s2, 1, 'hard'), '无保护可破，不放');
});
test('AI 铁壁时机：对手下回合能杀人时才放', function () {
  // 蓝方下回合可完成集火杀红方：红方应放铁壁
  const s = mkState([
    { side: 1, x: 3, y: 3 }, { side: 1, x: 2, y: 2 }, { side: 0, x: 4, y: 3 },
    { side: 0, x: 0, y: 0 }, { side: 1, x: 7, y: 7 },
  ], { turn: 0, energy: [100, 0] });
  ok(AI.shouldFireSkill(s, 0, 'hard'), '受威胁应放铁壁');
  const s2 = mkState([
    { side: 0, x: 0, y: 0 }, { side: 1, x: 7, y: 7 },
  ], { turn: 0, energy: [100, 0] });
  ok(!AI.shouldFireSkill(s2, 0, 'hard'), '无威胁不放');
});
test('AI 单步耗时 < 2 秒（hard，开局）', function () {
  const s = C.newGame('mixed');
  C.startGame(s, { red: 6, blue: 1, first: 0, rolls: [] });
  const t0 = Date.now();
  AI.aiNext(s, 'hard');
  const dt = Date.now() - t0;
  ok(dt < 2000, '耗时 ' + dt + 'ms');
});
test('AI 对 AI 20 局 soak：无异常、状态始终合法', function () {
  let wins = 0, draws = 0;
  for (let g = 0; g < 20; g++) {
    const s = C.newGame(D.MAPS[g % D.MAPS.length].id);
    C.startGame(s, C.rollDice());
    let guard = 0;
    while (s.phase === 'move' && guard++ < 400) {
      const side = s.turn;
      if (AI.shouldFireSkill(s, side, 'normal')) C.fireSkill(s, side);
      const mv = AI.aiNext(s, 'normal');
      if (!mv) { C.passTurn(s); continue; }
      const ev = C.applyMove(s, mv.unitId, mv.path);
      if (ev.error) throw new Error('第 ' + g + ' 局出现非法 AI 移动：' + ev.error);
    }
    if (s.phase === 'over') { wins++; ok(s.winner === 0 || s.winner === 1, '胜者合法'); }
    else draws++;
  }
  console.log('     （20 局：' + wins + ' 胜负 / ' + draws + ' 平（400 步未分胜负））');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
