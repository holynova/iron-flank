// 铁甲夹击：AI 对局 soak（node tests/soak-ai.js）
// 每档 10 局同级对战 + hard 对 easy 交叉 10 局，验证胜负/击杀合理、hard 不龟缩。
'use strict';
const D = require('../js/data.js');
const C = require('../js/core.js');
const AI = require('../js/ai.js');

function playGame(mapId, levelRed, levelBlue, cap) {
  const s = C.newGame(mapId);
  C.startGame(s, C.rollDice());
  const kills = [0, 0];
  const skills = [0, 0];
  let moves = 0;
  const t0 = Date.now();
  while (s.phase === 'move' && moves < cap) {
    const side = s.turn;
    const lv = side === 0 ? levelRed : levelBlue;
    if (AI.shouldFireSkill(s, side, lv)) { C.fireSkill(s, side); skills[side]++; }
    const mv = AI.aiNext(s, lv);
    if (!mv) { C.passTurn(s); moves++; continue; }
    const ev = C.applyMove(s, mv.unitId, mv.path);
    if (ev.error) throw new Error('非法 AI 移动：' + ev.error);
    kills[side] += (ev.kills || []).length;
    moves++;
  }
  return { winner: s.phase === 'over' ? s.winner : null, moves: moves, kills: kills, skills: skills, ms: Date.now() - t0 };
}

function run(label, n, levelRed, levelBlue) {
  let wins = [0, 0], draws = 0, totKills = 0, totMoves = 0, totMs = 0, totSkills = 0, zeroKillGames = 0;
  for (let g = 0; g < n; g++) {
    const r = playGame(D.MAPS[g % D.MAPS.length].id, levelRed, levelBlue, 400);
    if (r.winner === null) draws++; else wins[r.winner]++;
    const k = r.kills[0] + r.kills[1];
    totKills += k; totMoves += r.moves; totMs += r.ms; totSkills += r.skills[0] + r.skills[1];
    if (k === 0) zeroKillGames++;
  }
  console.log(label + '：' + n + ' 局，红胜 ' + wins[0] + ' / 蓝胜 ' + wins[1] + ' / 平 ' + draws +
    '，平均击杀 ' + (totKills / n).toFixed(1) + '/局，平均步数 ' + Math.round(totMoves / n) +
    '，0 击杀局 ' + zeroKillGames + '，技能释放 ' + totSkills + ' 次，平均耗时 ' + Math.round(totMs / n) + 'ms/局');
}

console.log('== 同级对战（各 10 局）==');
run('easy   对 easy  ', 10, 'easy', 'easy');
run('normal 对 normal', 10, 'normal', 'normal');
run('hard   对 hard  ', 10, 'hard', 'hard');
console.log('== 交叉对战 ==');
run('hard(红) 对 easy(蓝)', 10, 'hard', 'easy');
run('easy(红) 对 hard(蓝)', 10, 'easy', 'hard');
