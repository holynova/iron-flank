// 铁甲夹击：界面控制器（IFUI）
// 流程：菜单 → 掷骰 → 对战 → 结算。PvE 人类执蓝方，AI 执红方。
(function () {
  'use strict';
  var D = window.IFData, C = window.IFCore, AI = window.IFAI, R = window.IFRender;
  var $ = function (id) { return document.getElementById(id); };

  var app = {
    mode: 'pve', level: 'normal', mapIndex: 0,
    state: null, dice: null,
    selected: null, path: [], targets: [],
    killCells: [], armorCells: [], lastMove: null,
    log: [], stats: null,
    busy: false, humanSide: 1,
    surrenderArm: false, surrenderTimer: null,
    passStreak: 0,
  };

  // ── 小工具 ──
  function sideName(s) { return D.SIDES[s].name; }
  function unitName(u) { return sideName(u.side) + ' ' + D.UNITS[u.type].name; }
  function fmtPos(x, y) { return '(' + (x + 1) + ',' + (y + 1) + ')'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function showScreen(name) {
    ['menu', 'game', 'result'].forEach(function (n) {
      $('screen-' + n).classList.toggle('active', n === name);
    });
    if (name === 'menu') drawMenuArt();
    if (name === 'game') renderAll();
  }

  // ── 战报 ──
  function addLog(html, cls) {
    app.log.push({ html: html, cls: cls || '' });
    if (app.log.length > 60) app.log.shift();
    renderLog();
  }
  function renderLog() {
    var p = $('logPanel');
    p.innerHTML = app.log.map(function (e) {
      return '<div class="' + e.cls + '">' + e.html + '</div>';
    }).join('');
    p.scrollTop = p.scrollHeight;
  }

  // ── 顶栏 / 技能 / 提示 ──
  function renderTop() {
    var s = app.state;
    var red = C.aliveUnits(s, 0).length, blue = C.aliveUnits(s, 1).length;
    $('redCount').textContent = '红方 ' + red;
    $('blueCount').textContent = '蓝方 ' + blue;
    $('redBadge').innerHTML = s.shield[0] ? '<span class="skill-badge shield">铁壁</span>'
      : (s.pierce[0] ? '<span class="skill-badge pierce">穿透</span>' : '');
    $('blueBadge').innerHTML = s.shield[1] ? '<span class="skill-badge shield">铁壁</span>'
      : (s.pierce[1] ? '<span class="skill-badge pierce">穿透</span>' : '');
    var turnText;
    if (s.phase === 'over') turnText = '对局结束';
    else if (app.busy) turnText = '电脑思考中…';
    else if (app.mode === 'pve' && s.turn === app.humanSide) turnText = '轮到你';
    else turnText = sideName(s.turn) + '行动';
    $('turnText').textContent = turnText;
    $('roundText').textContent = '第 ' + s.round + ' 回合';

    // 技能按钮（当前回合方的技能）
    var sk = D.SKILLS[D.SIDES[s.turn].skill];
    var btn = $('skillBtn');
    var can = !app.busy && s.phase === 'move' && C.canSkill(s, s.turn) &&
      (app.mode === 'pvp' || s.turn === app.humanSide);
    var active = (sk.id === 'shield' && s.shield[s.turn]) || (sk.id === 'pierce' && s.pierce[s.turn]);
    btn.disabled = !can;
    btn.textContent = active ? sk.name + ' · 生效中' : (can ? sk.name + ' · 可释放' : sk.name);
    $('energyFill').style.width = Math.min(100, s.energy[s.turn]) + '%';
    $('energyText').textContent = '能量 ' + s.energy[s.turn] + '/100';
  }

  function setHint(html) { $('hint').innerHTML = html; }

  function renderAll() {
    if (!app.state) return;
    renderTop();
    R.drawBoard($('board'), app.state, {
      selected: app.selected ? { x: app.selected.x, y: app.selected.y } : null,
      targets: app.targets,
      killCells: app.killCells,
      armorCells: app.armorCells,
      lastMove: app.lastMove,
    });
  }

  // ── 选子与移动 ──
  function computeTargets() {
    var s = app.state, u = app.selected;
    if (!u) { app.targets = []; app.killCells = []; app.armorCells = []; return; }
    var fromX = app.path.length ? app.path[app.path.length - 1].x : u.x;
    var fromY = app.path.length ? app.path[app.path.length - 1].y : u.y;
    var tg = C.stepTargets(s, u, fromX, fromY);
    // 轻型第二步不能回原地
    if (app.path.length) tg = tg.filter(function (t) { return !(t.x === u.x && t.y === u.y); });
    app.targets = tg;
    // 预览：每条候选路径的击杀/破甲目标格
    var kills = {}, armor = {};
    tg.forEach(function (t) {
      var pv = C.previewKills(s, u.id, app.path.concat([t]));
      pv.kills.forEach(function (id) {
        var v = C.unitById(s, id);
        if (v) kills[v.x + ',' + v.y] = { x: v.x, y: v.y };
      });
      pv.armorLost.forEach(function (id) {
        var v = C.unitById(s, id);
        if (v) armor[v.x + ',' + v.y] = { x: v.x, y: v.y };
      });
    });
    app.killCells = Object.keys(kills).map(function (k) { return kills[k]; });
    app.armorCells = Object.keys(armor).map(function (k) { return armor[k]; });
  }

  function selectUnit(u) {
    app.selected = u;
    app.path = [];
    computeTargets();
    if (!app.targets.length) {
      setHint('<strong>' + esc(unitName(u)) + '</strong> 无路可走，另选一辆');
    } else if (app.killCells.length) {
      setHint('点选高亮格移动，<strong>红圈目标将被集火击毁</strong>');
    } else {
      setHint('点选高亮格移动；轻型坦克可再走一步');
    }
    $('stopBtn').classList.remove('show');
    renderAll();
  }

  function clearSelection() {
    app.selected = null;
    app.path = [];
    app.targets = [];
    app.killCells = [];
    app.armorCells = [];
    $('stopBtn').classList.remove('show');
  }

  function isTarget(cell) {
    return app.targets.some(function (t) { return t.x === cell.x && t.y === cell.y; });
  }

  function onBoardTap(cell) {
    var s = app.state;
    if (!s || s.phase !== 'move' || app.busy) return;
    if (app.mode === 'pve' && s.turn !== app.humanSide) return;
    // 轻型坦克两步模式：再点一次第一步落点 = 停在这里（不用非点按钮）
    if (app.selected && app.path.length === 1 && cell.x === app.path[0].x && cell.y === app.path[0].y) {
      doMove(app.path.slice());
      return;
    }
    // 点到可移动目标
    if (app.selected && isTarget(cell)) {
      var u = app.selected;
      var twoStep = D.UNITS[u.type].steps >= 2 && app.path.length === 0;
      if (twoStep) {
        // 先看第二步有没有路
        var next = C.stepTargets(s, u, cell.x, cell.y)
          .filter(function (t) { return !(t.x === u.x && t.y === u.y); });
        if (next.length) {
          app.path = [{ x: cell.x, y: cell.y }];
          computeTargets();
          $('stopBtn').classList.add('show');
          setHint('轻型坦克：点选第二步，或再点一次停在这里');
          renderAll();
          return;
        }
      }
      doMove(app.path.concat([cell]));
      return;
    }
    // 点到己方坦克 → 选中
    var u = C.unitAt(s, cell.x, cell.y);
    if (u && u.side === s.turn) {
      if (app.selected && app.selected.id === u.id) { clearSelection(); setHint('点选一辆己方坦克'); renderAll(); }
      else selectUnit(u);
      return;
    }
    // 其他 → 取消选择
    if (app.selected) { clearSelection(); setHint('点选一辆己方坦克'); renderAll(); }
  }

  function logMove(ev) {
    var s = app.state;
    var u = C.unitById(s, ev.unitId);
    var name = u ? unitName(u) : '';
    addLog('第 ' + s.round + ' 回合 · ' + esc(name) + ' ' + fmtPos(ev.from.x, ev.from.y) + ' → ' + fmtPos(ev.to.x, ev.to.y));
    (ev.kills || []).forEach(function (id) {
      var v = C.unitById(s, id);
      addLog('🔥 击毁 ' + esc(v ? unitName(v) : '敌军') + '！', 'lk');
    });
    (ev.armorLost || []).forEach(function (id) {
      var v = C.unitById(s, id);
      addLog('🛡 ' + esc(v ? unitName(v) : '敌军') + ' 的装甲被打掉了', 'la');
    });
  }

  function doMove(path) {
    var s = app.state;
    var unitId = app.selected.id;
    var ev = C.applyMove(s, unitId, path);
    if (ev.error) { setHint('这步走不了，请重选'); return; }
    app.stats.moves++;
    app.stats.kills[ev.side] += (ev.kills || []).length;
    app.lastMove = { from: ev.from, to: ev.to };
    app.passStreak = 0;
    logMove(ev);
    clearSelection();
    setHint('点选一辆己方坦克');
    renderAll();
    if (s.phase === 'over') { setTimeout(showResult, 700); return; }
    postTurn();
  }

  // 回合交接：处理无路可走（连跳两次 = 平局）与 AI 行动
  function postTurn() {
    var s = app.state;
    if (!s || s.phase !== 'move') return;
    var guard = 0;
    while (!C.hasAnyMove(s, s.turn) && guard < 2) {
      addLog(sideName(s.turn) + ' 无路可走，跳过回合');
      C.passTurn(s);
      app.passStreak++;
      guard++;
      if (app.passStreak >= 2) {
        s.phase = 'over';
        s.winner = null;
        renderAll();
        setTimeout(showResult, 700);
        return;
      }
    }
    renderAll();
    if (app.mode === 'pve' && s.turn !== app.humanSide) scheduleAI();
  }

  function scheduleAI() {
    app.busy = true;
    setHint('电脑思考中…');
    renderAll();
    setTimeout(function () {
      var s = app.state;
      if (!s || s.phase !== 'move') { app.busy = false; return; }
      var side = s.turn;
      if (AI.shouldFireSkill(s, side, app.level)) {
        C.fireSkill(s, side);
        app.stats.skills[side]++;
        var sk = D.SKILLS[D.SIDES[side].skill];
        addLog('✨ ' + sideName(side) + ' 释放「' + sk.name + '」：' + sk.desc, 'ls');
      }
      var mv = AI.aiNext(s, app.level);
      app.busy = false;
      if (!mv) {
        C.passTurn(s);
        addLog(sideName(side) + ' 无路可走，跳过回合');
        renderAll();
        postTurn();
        return;
      }
      var ev = C.applyMove(s, mv.unitId, mv.path);
      if (ev.error) { // 不应发生：防御性跳过
        C.passTurn(s);
        renderAll();
        postTurn();
        return;
      }
      app.stats.moves++;
      app.stats.kills[side] += (ev.kills || []).length;
      app.lastMove = { from: ev.from, to: ev.to };
      app.passStreak = 0;
      logMove(ev);
      setHint('点选一辆己方坦克');
      renderAll();
      if (s.phase === 'over') { setTimeout(showResult, 700); return; }
      postTurn();
    }, 650);
  }

  // ── 技能 ──
  function onSkill() {
    var s = app.state;
    if (!s || s.phase !== 'move' || app.busy) return;
    if (app.mode === 'pve' && s.turn !== app.humanSide) return;
    var side = s.turn;
    if (!C.fireSkill(s, side)) return;
    app.stats.skills[side]++;
    var sk = D.SKILLS[D.SIDES[side].skill];
    addLog('✨ ' + sideName(side) + ' 释放「' + sk.name + '」：' + sk.desc, 'ls');
    renderAll();
  }

  // ── 掷骰 ──
  var PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function drawDie(el, v) {
    var html = '';
    for (var i = 0; i < 9; i++) html += '<div class="pip" style="visibility:' + (PIPS[v].indexOf(i) >= 0 ? 'visible' : 'hidden') + '"></div>';
    el.innerHTML = html;
  }
  function openDice() {
    drawDie($('dieRed'), 1);
    drawDie($('dieBlue'), 1);
    $('diceResult').textContent = '';
    $('diceRollBtn').style.display = 'block';
    $('diceStartBtn').style.display = 'none';
    $('diceOverlay').classList.add('show');
  }
  function rollDice() {
    $('diceRollBtn').disabled = true;
    var n = 0;
    var iv = setInterval(function () {
      drawDie($('dieRed'), 1 + Math.floor(Math.random() * 6));
      drawDie($('dieBlue'), 1 + Math.floor(Math.random() * 6));
      if (++n >= 7) {
        clearInterval(iv);
        var d = C.rollDice();
        app.dice = d;
        drawDie($('dieRed'), d.red);
        drawDie($('dieBlue'), d.blue);
        $('diceResult').innerHTML = '<span class="w">' + sideName(d.first) + '先手！</span>（红 ' + d.red + ' 点 · 蓝 ' + d.blue + ' 点）';
        $('diceRollBtn').style.display = 'none';
        $('diceStartBtn').style.display = 'block';
        $('diceRollBtn').disabled = false;
      }
    }, 80);
  }
  function startBattle() {
    $('diceOverlay').classList.remove('show');
    var s = app.state;
    C.startGame(s, app.dice);
    addLog('🎲 掷骰：红 ' + app.dice.red + ' 点，蓝 ' + app.dice.blue + ' 点，' + sideName(app.dice.first) + '先手');
    setHint('点选一辆己方坦克');
    renderAll();
    postTurn();
  }

  // ── 开局 / 结算 ──
  function newGame(mode) {
    app.mode = mode;
    var map = D.MAPS[app.mapIndex];
    app.state = C.newGame(map.id);
    app.selected = null; app.path = []; app.targets = [];
    app.killCells = []; app.armorCells = []; app.lastMove = null;
    app.log = []; app.busy = false; app.passStreak = 0;
    app.stats = { kills: [0, 0], moves: 0, skills: [0, 0], startedAt: Date.now(), mapName: map.name };
    app.surrenderArm = false;
    $('surrenderBtn').textContent = '认输';
    showScreen('game');
    openDice();
  }

  function showResult() {
    var s = app.state;
    var secs = Math.round((Date.now() - app.stats.startedAt) / 1000);
    var mm = Math.floor(secs / 60), ss = secs % 60;
    var title, sub;
    if (s.winner === null) {
      title = '平局';
      sub = '双方都无路可走';
    } else if (app.mode === 'pve') {
      title = s.winner === app.humanSide ? '你赢了！' : '电脑赢了';
      sub = s.winner === app.humanSide ? '漂亮的夹击！' : '再接再厉，下一局赢回来';
    } else {
      title = sideName(s.winner) + '获胜！';
      sub = '敌方只剩 1 辆坦克';
    }
    $('resultTitle').textContent = title;
    $('resultSub').textContent = sub;
    var rows = [
      ['对局模式', app.mode === 'pve' ? '人机对战 · ' + ({ easy: '新手', normal: '普通', hard: '高手' }[app.level]) : '双人对战'],
      ['地图', esc(app.stats.mapName)],
      ['回合数', s.round + ' 回合'],
      ['总步数', app.stats.moves + ' 步'],
      ['红方击杀', app.stats.kills[0] + ' 辆'],
      ['蓝方击杀', app.stats.kills[1] + ' 辆'],
      ['技能释放', (app.stats.skills[0] + app.stats.skills[1]) + ' 次'],
      ['用时', mm + ' 分 ' + ss + ' 秒'],
    ];
    $('statCard').innerHTML = rows.map(function (r) {
      return '<div class="stat-row"><span>' + r[0] + '</span><span class="v">' + r[1] + '</span></div>';
    }).join('');
    showScreen('result');
  }

  function surrender() {
    var s = app.state;
    if (!s || s.phase !== 'move') return;
    if (!app.surrenderArm) {
      app.surrenderArm = true;
      $('surrenderBtn').textContent = '确认认输？';
      clearTimeout(app.surrenderTimer);
      app.surrenderTimer = setTimeout(function () {
        app.surrenderArm = false;
        $('surrenderBtn').textContent = '认输';
      }, 3000);
      return;
    }
    clearTimeout(app.surrenderTimer);
    app.surrenderArm = false;
    $('surrenderBtn').textContent = '认输';
    var loser = app.mode === 'pve' ? app.humanSide : s.turn;
    s.winner = loser === 0 ? 1 : 0;
    s.phase = 'over';
    addLog(sideName(loser) + ' 认输');
    showResult();
  }

  // ── 菜单 ──
  function drawMenuArt() {
    R.drawBanner($('banner'));
    updateMapPicker();
  }
  function updateMapPicker() {
    var m = D.MAPS[app.mapIndex];
    $('mapName').textContent = m.name;
    $('mapDesc').textContent = m.desc;
    R.drawMapPreview($('mapPreview'), m.id);
  }

  function bind() {
    $('btnPve').addEventListener('click', function () { newGame('pve'); });
    $('btnPvp').addEventListener('click', function () { newGame('pvp'); });
    $('btnRules').addEventListener('click', function () { $('rulesOverlay').classList.add('show'); });
    $('rulesCloseBtn').addEventListener('click', function () { $('rulesOverlay').classList.remove('show'); });
    $('rulesOverlay').addEventListener('click', function (e) {
      if (e.target === $('rulesOverlay')) $('rulesOverlay').classList.remove('show');
    });
    $('levelSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-level]');
      if (!b) return;
      app.level = b.getAttribute('data-level');
      Array.prototype.forEach.call($('levelSeg').querySelectorAll('button'), function (x) {
        x.classList.toggle('on', x === b);
      });
    });
    $('mapPrev').addEventListener('click', function () {
      app.mapIndex = (app.mapIndex + D.MAPS.length - 1) % D.MAPS.length;
      updateMapPicker();
    });
    $('mapNext').addEventListener('click', function () {
      app.mapIndex = (app.mapIndex + 1) % D.MAPS.length;
      updateMapPicker();
    });
    $('board').addEventListener('click', function (e) {
      var cell = R.cellFromPoint($('board'), e.clientX, e.clientY);
      if (cell) onBoardTap(cell);
    });
    $('skillBtn').addEventListener('click', onSkill);
    $('stopBtn').addEventListener('click', function () {
      if (app.selected && app.path.length) doMove(app.path.slice());
    });
    $('surrenderBtn').addEventListener('click', surrender);
    $('backBtn').addEventListener('click', function () {
      if (app.busy) return;
      showScreen('menu');
    });
    $('diceRollBtn').addEventListener('click', rollDice);
    $('diceStartBtn').addEventListener('click', startBattle);
    $('againBtn').addEventListener('click', function () { newGame(app.mode); });
    $('homeBtn').addEventListener('click', function () { showScreen('menu'); });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if ($('screen-menu').classList.contains('active')) drawMenuArt();
        if ($('screen-game').classList.contains('active')) renderAll();
      }, 150);
    });
  }

  bind();
  drawMenuArt();

  // 测试钩子（Playwright 用）
  window.IFUI = app;
  window.IFGame = { D: D, C: C, AI: AI, R: R, app: app };
})();
