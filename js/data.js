// 铁甲夹击 Iron Flank：数据表（IFData）
// 潮汐战线式数据驱动：兵种 / 地形 / 技能 / 地图全是数据，规则逻辑不写死数值。
// 中文是源语言；界面文字走 IFI18n.t()，以后加语言只需补词典。
(function (root) {
  'use strict';

  var D = {};

  D.W = 8;
  D.H = 8;

  // 拥挤豁免阈值：某条线上存活单位数 > CROWD_LIMIT 时，整条线豁免集火检查。
  // 注意：原案（4×4）阈值是 3；但三格集火 + 友军保护恰好就是 4 个单位，
  // 阈值 3 会让「友军相邻保护」永远触发不了（先被拥挤豁免拦下），蓝方「穿透」
  // 技能也随之失效。8×8 棋盘按比例放宽到 4：三格 + 保护位（4 个）可正常结算，
  // 真正挤满的线（5+ 个）仍然豁免。核心三格击杀规则本身未变。
  D.CROWD_LIMIT = 4;
  // 回合上限：打满 MAX_ROUNDS 回合仍未分胜负时，按剩余坦克数→击杀数判胜负，再相同判平局。
  D.MAX_ROUNDS = 100;

  // ── 阵营 ──
  // side 0 = 红方（上方），1 = 蓝方（下方）。owner 编号沿用潮汐战线：1 红 2 蓝。
  D.SIDES = [
    { id: 0, name: '红方', owner: 1, color: '#e03828', dark: '#a82018', light: '#f06848', skill: 'shield' },
    { id: 1, name: '蓝方', owner: 2, color: '#2c70e0', dark: '#1c4cb0', light: '#58a0f4', skill: 'pierce' },
  ];

  // ── 兵种 ──
  // art：潮汐战线 sprites.js / art-units-heavy.js 里的兵种键（tnk 轻型坦克 / med 中型坦克 / hvy 重型坦克）。
  // steps：每回合可走的正交步数；armor：重型坦克第一次被集火只掉装甲。
  D.UNITS = {
    light:  { id: 'light',  name: '轻型坦克', art: 'tnk', steps: 2, armor: 0, desc: '每回合可走 2 步，落点结算集火' },
    medium: { id: 'medium', name: '中型坦克', art: 'med', steps: 1, armor: 0, desc: '标准坦克，每回合走 1 步' },
    heavy:  { id: 'heavy',  name: '重型坦克', art: 'hvy', steps: 1, armor: 1, desc: '第一次被集火只掉装甲，第二次才被摧毁' },
  };

  // ── 地形 ──
  // passable：能否进入；immune：上面的单位免于集火。
  // 键名沿用潮汐战线地形键，美术直接复用它的地形画法。
  D.TERRAIN = {
    plain:    { id: 'plain',    name: '平原', passable: true,  immune: false, char: '.' },
    forest:   { id: 'forest',   name: '森林', passable: true,  immune: true,  char: 'F' },
    mountain: { id: 'mountain', name: '山地', passable: false, immune: false, char: 'M' },
    river:    { id: 'river',    name: '河流', passable: false, immune: false, char: 'R' },
    city:     { id: 'city',     name: '城市', passable: true,  immune: true,  char: 'C' },
  };

  // ── 指挥官技能 ──
  // 能量：每次击毁 +50，满 100 可放。持续到自己下个回合开始。
  D.SKILLS = {
    shield: { id: 'shield', name: '铁壁', side: 0, cost: 100, gain: 50, desc: '己方全军免疫集火，直到自己下个回合开始' },
    pierce: { id: 'pierce', name: '穿透', side: 1, cost: 100, gain: 50, desc: '己方集火无视友军相邻保护，直到自己下个回合开始' },
  };

  // ── 初始阵型（红方；蓝方 = 旋转 180°）──
  // 每方 2 轻 + 3 中 + 1 重，占据己方两行底线。
  D.FORMATION = [
    { x: 1, y: 0, type: 'light' },
    { x: 3, y: 0, type: 'medium' },
    { x: 4, y: 0, type: 'medium' },
    { x: 6, y: 0, type: 'light' },
    { x: 2, y: 1, type: 'medium' },
    { x: 5, y: 1, type: 'heavy' },
  ];

  // ── 地图：字符画半张 + 180° 自动对称 ──
  // half 只画上半 4 行；下半由 core.expandHalf 按 180° 旋转生成。
  // 上两行必须是平原（出生区）；'.' 平原 'F' 森林 'M' 山地 'R' 河流 'C' 城市。
  D.MAPS = [
    {
      id: 'plain', name: '平原遭遇', desc: '开阔平原，只有几片树林可以藏身',
      half: [
        '........',
        '........',
        '..F..F..',
        '........',
      ],
    },
    {
      id: 'forest', name: '森林夹击', desc: '中部林带密布，善用森林免伤',
      half: [
        '........',
        '........',
        '.F....F.',
        '..FFFF..',
      ],
    },
    {
      id: 'river', name: '断河防线', desc: '河流横贯中部，只有两处浅滩可渡',
      half: [
        '........',
        '........',
        '.F....F.',
        'RR.RR.RR',
      ],
    },
    {
      id: 'mountain', name: '群山隘口', desc: '山地封锁中线，争夺两个隘口',
      half: [
        '........',
        '........',
        '...FF...',
        'MM.MM.MM',
      ],
    },
    {
      id: 'cities', name: '双城对峙', desc: '四座城市居中，占城者免于集火',
      half: [
        '........',
        '........',
        '..F..F..',
        '..C..C..',
      ],
    },
    {
      id: 'mixed', name: '混合战场', desc: '山川河流城市俱全，变化最多',
      half: [
        '........',
        '........',
        '.F.M..F.',
        '..R.CC..',
      ],
    },
    {
      id: 'channel', name: '纵贯河道', desc: '河流蛇形纵贯全场，绕行与渡口是关键',
      half: [
        '........',
        '........',
        '..RR..F.',
        '.F..RR..',
      ],
    },
    {
      id: 'alleys', name: '城市巷战', desc: '市中心街区密布，占城者免于集火',
      half: [
        '........',
        '........',
        '..C..C..',
        '.CC..CC.',
      ],
    },
    {
      id: 'twinpeaks', name: '双峰夹道', desc: '两侧山峰封锁，中路林间隘口是必争之地',
      half: [
        '........',
        '........',
        '.MM..MM.',
        '...FF...',
      ],
    },
    {
      id: 'ambush', name: '森林伏击', desc: '两侧林区密布，藏身林中设伏待敌',
      half: [
        '........',
        '........',
        '.FF..FF.',
        '..F..F..',
      ],
    },
  ];

  // ── 界面文字（源语言中文；IFI18n.t 取用）──
  D.TEXT = {
    'game.title': '铁甲夹击',
    'game.subtitle': 'IRON FLANK · 二打一回合制坦克战棋',
    'mode.pvp': '双人对战',
    'mode.pvp.desc': '同一设备轮流操作',
    'mode.pve': '人机对战',
    'mode.pve.desc': '你执蓝方，电脑执红方',
    'ai.easy': '简单',
    'ai.normal': '普通',
    'ai.hard': '困难',
    'map.label': '选择地图',
    'btn.start': '开始战斗',
    'btn.rules': '玩法说明',
    'btn.back': '返回',
    'btn.surrender': '认输',
    'btn.restart': '再来一局',
    'btn.home': '回标题',
    'btn.close': '关闭',
    'btn.stop': '停在这里',
    'turn.you': '轮到你',
    'turn.red': '红方行动',
    'turn.blue': '蓝方行动',
    'turn.ai': '电脑思考中…',
    'dice.title': '掷骰决定先手',
    'dice.roll': '掷骰',
    'dice.red': '红方',
    'dice.blue': '蓝方',
    'dice.first': '先手',
    'dice.tie': '平局，再掷一次',
    'energy': '能量',
    'skill.ready': '可释放',
    'skill.active': '生效中',
    'win.red': '红方获胜！',
    'win.blue': '蓝方获胜！',
    'win.you': '你赢了！',
    'win.ai': '电脑赢了',
    'units.left': '剩余',
    'log.kill': '击毁了',
    'log.armor': '的装甲被打掉了',
    'log.skill.shield': '红方释放「铁壁」：全军免疫集火',
    'log.skill.pierce': '蓝方释放「穿透」：集火无视友军保护',
    'log.skill.fizzle': '技能已就绪但无人可保护',
    'hint.select': '点选一辆己方坦克',
    'hint.move': '点选高亮格移动；轻型坦克可再走一步',
    'hint.move2': '轻型坦克：点选第二步，或点「停在这里」',
    'hint.immobile': '该坦克无路可走',
    'rules.title': '玩法说明',
    'footer.credit': '架构与像素美术基于 CocoSgt《潮汐战线》(MIT)，字体 Fusion Pixel (OFL)',
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = D;
  else root.IFData = D;
})(typeof window !== 'undefined' ? window : globalThis);
