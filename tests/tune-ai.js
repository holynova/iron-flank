// AI 调参实验（node tests/tune-ai.js）：在进程内覆盖 LEVELS，跑镜像对局看击杀/胜负。
'use strict';
const D = require('../js/data.js');
const C = require('../js/core.js');
const AI = require('../js/ai.js');

function playGame(mapId, lvR, lvB, cap) {
  const s = C.newGame(mapId);
  C.startGame(s, C.rollDice());
  let kills = 0, moves = 0;
  while (s.phase === 'move' && moves < cap) {
    const side = s.turn;
    const lv = side === 0 ? lvR : lvB;
    if (AI.shouldFireSkill(s, side, lv)) C.fireSkill(s, side);
    const mv = AI.aiNext(s, lv);
    if (!mv) { C.passTurn(s); moves++; continue; }
    const ev = C.applyMove(s, mv.unitId, mv.path);
    kills += (ev.kills || []).length;
    moves++;
  }
  return { winner: s.phase === 'over' ? s.winner : null, kills: kills, moves: moves };
}

function mirror(level, n) {
  let dec = 0, kills = 0, moves = 0;
  for (let g = 0; g < n; g++) {
    const r = playGame(D.MAPS[g % D.MAPS.length].id, level, level, 400);
    if (r.winner !== null) dec++;
    kills += r.kills; moves += r.moves;
  }
  return '分胜负 ' + dec + '/' + n + '，平均击杀 ' + (kills / n).toFixed(1) + '/局，平均步数 ' + Math.round(moves / n);
}

function cross(n) {
  // hard（红）对 easy（蓝）：hard 应大比分获胜，验证调参没把 hard 调成送人头
  let hw = 0;
  for (let g = 0; g < n; g++) {
    const r = playGame(D.MAPS[g % D.MAPS.length].id, 'hard', 'easy', 400);
    if (r.winner === 0) hw++;
  }
  return 'hard 胜 ' + hw + '/' + n;
}

const base = JSON.parse(JSON.stringify(AI.LEVELS));
function apply(over) {
  Object.keys(over).forEach(function (lv) {
    Object.keys(over[lv]).forEach(function (k) { AI.LEVELS[lv][k] = over[lv][k]; });
  });
}
function reset() {
  Object.keys(base).forEach(function (lv) {
    Object.keys(base[lv]).forEach(function (k) { AI.LEVELS[lv][k] = base[lv][k]; });
  });
}

const candidates = [
  { name: '当前权重', over: {} },
  { name: 'aggro1 reply↓ threat↑', over: {
      hard: { replyKill: 2000, threat: 3000 },
      normal: { replyKill: 3000, threat: 2000 } } },
  { name: 'aggro2 更激进', over: {
      hard: { replyKill: 1500, threat: 3500 },
      normal: { replyKill: 2500, threat: 2500 } } },
];

candidates.forEach(function (cand) {
  reset(); apply(cand.over);
  console.log('[' + cand.name + '] hard 镜像：' + mirror('hard', 10));
  console.log('[' + cand.name + '] normal 镜像：' + mirror('normal', 10));
  console.log('[' + cand.name + '] ' + cross(10));
});
