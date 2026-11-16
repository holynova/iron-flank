// 铁甲夹击：国际化壳层（IFI18n），潮汐战线式。
// 中文是源语言，没有词典；以后加语言只需注册词典（中文原文 → 译文），
// 再调 IFI18n.setLang('xx')，界面文字全部走 t() 取用。
(function (root) {
  'use strict';
  var D = root.IFData || (typeof require !== 'undefined' ? require('./data.js') : null);

  var I = {
    lang: 'zh-CN',
    dicts: {}, // lang -> { key: 译文 }
  };

  // 注册一门语言的词典（key 与 D.TEXT 的 key 一致）
  I.register = function (lang, dict) { I.dicts[lang] = dict || {}; };

  I.setLang = function (lang) {
    if (lang === 'zh-CN' || I.dicts[lang]) I.lang = lang;
    return I.lang;
  };

  // 取文字：有词典用词典，否则回源语言；都没有就返回 key 本身
  I.t = function (key) {
    var d = I.dicts[I.lang];
    if (d && d[key] != null) return d[key];
    if (D && D.TEXT && D.TEXT[key] != null) return D.TEXT[key];
    return key;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = I;
  else root.IFI18n = I;
})(typeof window !== 'undefined' ? window : globalThis);
