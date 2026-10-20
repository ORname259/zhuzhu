/* 数据层：全部存 localStorage，不联网 */
window.ZZ = window.ZZ || {};

(function (ZZ) {
  var KEY = 'zhuzhucheng.v1';
  var DAY = 86400000;

  var defaults = function () {
    return {
      version: 1,
      profile: { heightCm: null, targetJin: null, unit: 'jin', onboarded: false },
      prefs: { showMA: true, range: '30' },
      records: []
    };
  };

  var state = defaults();

  ZZ.load = function () {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) { save(); return state; }
      var parsed = JSON.parse(raw);
      state = {
        version: 1,
        profile: {
          heightCm: num(parsed.profile && parsed.profile.heightCm),
          targetJin: num(parsed.profile && parsed.profile.targetJin),
          unit: 'jin',
          onboarded: !!(parsed.profile && parsed.profile.onboarded)
        },
        prefs: {
          showMA: parsed.prefs ? parsed.prefs.showMA !== false : true,
          range: (parsed.prefs && parsed.prefs.range) || '30'
        },
        records: (Array.isArray(parsed.records) ? parsed.records : []).map(function (r) {
          return {
            id: String(r.id),
            ts: Number(r.ts) || Date.now(),
            jin: Number(r.jin) || 0,
            note: typeof r.note === 'string' ? r.note : '',
            tags: Array.isArray(r.tags) ? r.tags : []
          };
        }).sort(sortByTs)
      };
    } catch (e) {
      state = defaults();
    }
    return state;
  };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 隐私模式等，忽略 */ }
  }
  ZZ.save = save;

  function num(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? n : null;
  }
  function sortByTs(a, b) { return a.ts - b.ts; }

  ZZ.state = function () { return state; };

  ZZ.setProfile = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.profile[k] = patch[k];
    save();
  };

  ZZ.setPrefs = function (patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.prefs[k] = patch[k];
    save();
  };

  function uid() {
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  ZZ.addRecord = function (rec) {
    var item = { id: uid(), ts: rec.ts, jin: rec.jin, note: rec.note || '', tags: rec.tags || [] };
    state.records.push(item);
    state.records.sort(sortByTs);
    save();
    return item;
  };

  ZZ.updateRecord = function (id, patch) {
    for (var i = 0; i < state.records.length; i++) {
      if (state.records[i].id === id) {
        var r = state.records[i];
        if (patch.jin != null) r.jin = patch.jin;
        if (patch.ts != null) r.ts = patch.ts;
        if (patch.note != null) r.note = patch.note;
        if (patch.tags != null) r.tags = patch.tags;
        state.records.sort(sortByTs);
        save();
        return r;
      }
    }
    return null;
  };

  ZZ.deleteRecord = function (id) {
    state.records = state.records.filter(function (r) { return r.id !== id; });
    save();
  };

  ZZ.clearAll = function () {
    state = defaults();
    save();
  };

  ZZ.records = function () { return state.records; };
  ZZ.lastRecord = function () { return state.records.length ? state.records[state.records.length - 1] : null; };

  /* ---------- 日期工具（本地时区） ---------- */
  ZZ.dayStart = function (ts) {
    var d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  ZZ.ymd = function (ts) {
    var d = new Date(ts);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  };
  ZZ.hm = function (ts) {
    var d = new Date(ts);
    var h = d.getHours(), mi = d.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (mi < 10 ? '0' + mi : mi);
  };
  ZZ.mdOf = function (ts) {
    var d = new Date(ts);
    return (d.getMonth() + 1) + '/' + d.getDate();
  };
  ZZ.dayLabel = function (ts) {
    var diff = Math.round((ZZ.dayStart(Date.now()) - ZZ.dayStart(ts)) / DAY);
    if (diff === 0) return '今天';
    if (diff === 1) return '昨天';
    if (diff === 2) return '前天';
    if (diff === -1) return '明天';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  };
  ZZ.weekday = function (ts) {
    return '周' + '日一二三四五六'.charAt(new Date(ts).getDay());
  };

  /* ---------- 每日序列：一天多次取当天最后一次 ---------- */
  ZZ.dailySeries = function () {
    var byDay = {};
    var order = [];
    var recs = state.records;
    for (var i = 0; i < recs.length; i++) {
      var day = ZZ.dayStart(recs[i].ts);
      if (!byDay[day]) { byDay[day] = []; order.push(day); }
      byDay[day].push(recs[i]);
    }
    order.sort(function (a, b) { return a - b; });
    return order.map(function (day) {
      var list = byDay[day].slice().sort(sortByTs);
      var last = list[list.length - 1];
      var sum = 0, tags = [], note = '';
      for (var j = 0; j < list.length; j++) {
        sum += list[j].jin;
        if (list[j].tags.length) tags = tags.concat(list[j].tags);
        if (list[j].note && !note) note = list[j].note;
      }
      return {
        day: day,
        jin: last.jin,
        avg: sum / list.length,
        count: list.length,
        tags: tags.filter(function (v, k) { return tags.indexOf(v) === k; }),
        note: note
      };
    });
  };

  /* ---------- 单位：只用斤 ---------- */
  ZZ.JIN_PER_KG = 2;
  ZZ.jinToKg = function (jin) { return jin / 2; };
  ZZ.fmt = function (jin, digits) {
    if (jin == null || !isFinite(jin)) return '—';
    var d = digits == null ? 1 : digits;
    return jin.toFixed(d);
  };
})(window.ZZ);
