/* 统计、目标推算、周期小结 */
window.ZZ = window.ZZ || {};

(function (ZZ) {
  var DAY = 86400000;

  ZZ.movingAverage = function (series, win) {
    var out = [];
    for (var i = 0; i < series.length; i++) {
      var from = Math.max(0, i - win + 1), sum = 0, n = 0;
      for (var j = from; j <= i; j++) { sum += series[j].jin; n++; }
      out.push({ day: series[i].day, jin: sum / n, n: n });
    }
    return out;
  };

  ZZ.bmi = function (jin, heightCm) {
    if (!jin || !heightCm) return null;
    var m = heightCm / 100;
    return (jin / 2) / (m * m);
  };

  ZZ.idealRange = function (heightCm) {
    if (!heightCm) return null;
    var m2 = (heightCm / 100) * (heightCm / 100);
    return { minJin: 18.5 * m2 * 2, maxJin: 23.9 * m2 * 2 };
  };

  ZZ.overview = function () {
    var recs = ZZ.records();
    var p = ZZ.state().profile;
    var last = ZZ.lastRecord();
    var first = recs.length ? recs[0] : null;
    var max = null, min = null;
    for (var i = 0; i < recs.length; i++) {
      if (max === null || recs[i].jin > max) max = recs[i].jin;
      if (min === null || recs[i].jin < min) min = recs[i].jin;
    }
    return {
      count: recs.length,
      current: last ? last.jin : null,
      currentAt: last ? last.ts : null,
      first: first ? first.jin : null,
      firstAt: first ? first.ts : null,
      max: max,
      min: min,
      totalChange: (last && first) ? last.jin - first.jin : null,
      bmi: last ? ZZ.bmi(last.jin, p.heightCm) : null,
      heightCm: p.heightCm,
      targetJin: p.targetJin,
      ideal: ZZ.idealRange(p.heightCm)
    };
  };

  /* 目标进度：起点=首次记录，当前=最近记录 */
  ZZ.targetProgress = function () {
    var o = ZZ.overview();
    if (o.targetJin == null || o.current == null || o.first == null) return null;
    var span = o.first - o.targetJin;           // 需要移动的总距离（正=减重，负=增重）
    var done = o.first - o.current;             // 已经移动的距离
    var pct = span === 0 ? (Math.abs(o.current - o.targetJin) < 0.05 ? 100 : 0) : (done / span) * 100;
    var changed = o.current - o.first;          // 有符号变化量
    return {
      mode: span >= 0 ? 'lose' : 'gain',
      target: o.targetJin,
      start: o.first,
      current: o.current,
      changed: changed,                         // 负=掉了，正=涨了
      changedAbs: Math.abs(changed),
      remaining: Math.abs(o.current - o.targetJin),
      reached: Math.abs(o.current - o.targetJin) < 0.05,
      pct: Math.max(0, Math.min(100, pct))
    };
  };

  /* 近期变化速度：对最近若干天做一次线性回归，得斤/天 */
  ZZ.ratePerDay = function (days) {
    var series = ZZ.dailySeries();
    if (series.length < 2) return null;
    var cutoff = ZZ.dayStart(Date.now()) - (days || 30) * DAY;
    var pts = series.filter(function (s) { return s.day >= cutoff; });
    if (pts.length < 5) pts = series.slice(-5);
    if (pts.length < 3) return null;
    var t0 = pts[0].day, n = pts.length;
    var sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (var i = 0; i < n; i++) {
      var x = (pts[i].day - t0) / DAY, y = pts[i].jin;
      sx += x; sy += y; sxx += x * x; sxy += x * y;
    }
    var denom = n * sxx - sx * sx;
    if (Math.abs(denom) < 1e-9) return null;
    var slope = (n * sxy - sx * sy) / denom;
    var intercept = (sy - slope * sx) / n;
    return { slope: slope, fitted: intercept + slope * ((pts[n - 1].day - t0) / DAY), last: pts[n - 1].jin, points: n };
  };

  /* 预计达成日期 */
  ZZ.projection = function () {
    var p = ZZ.state().profile;
    var last = ZZ.lastRecord();
    if (p.targetJin == null || !last) return { ok: false, reason: '请先设置目标体重' };
    var r = ZZ.ratePerDay(30) || ZZ.ratePerDay(90);
    if (!r) return { ok: false, reason: '暂无足够数据' };
    var diff = p.targetJin - last.jin;          // 还差多少（正=需要涨，负=需要减）
    if (Math.abs(r.slope) < 0.01) return { ok: false, reason: '近期体重基本持平，暂无足够数据', flat: true };
    if (diff !== 0 && (diff > 0) !== (r.slope > 0)) {
      return { ok: false, reason: '近期趋势与目标相反，暂无足够数据', reverse: true, slope: r.slope };
    }
    if (diff === 0) return { ok: true, reached: true, date: last.ts, slope: r.slope };
    var days = diff / r.slope;
    if (!isFinite(days) || days <= 0) return { ok: false, reason: '暂无足够数据' };
    if (days > 365 * 3) return { ok: false, reason: '按当前速度需要 3 年以上，暂无足够数据', slope: r.slope };
    return {
      ok: true,
      date: ZZ.dayStart(Date.now()) + Math.round(days) * DAY,
      days: Math.round(days),
      slope: r.slope,
      perWeek: r.slope * 7,
      points: r.points
    };
  };

  function windowAvg(series, fromDay, toDay) {
    var sum = 0, n = 0;
    for (var i = 0; i < series.length; i++) {
      if (series[i].day >= fromDay && series[i].day <= toDay) { sum += series[i].jin; n++; }
    }
    return n ? { avg: sum / n, days: n } : null;
  }

  /* 周期小结：只描述事实，不给建议 */
  ZZ.summaries = function () {
    var series = ZZ.dailySeries();
    var out = { week: null, month: null };
    if (!series.length) return out;
    var today = ZZ.dayStart(Date.now());

    function build(days, label, prevLabel) {
      var cur = windowAvg(series, today - (days - 1) * DAY, today);
      var prev = windowAvg(series, today - (days * 2 - 1) * DAY, today - days * DAY);
      if (!cur) return null;
      var txt = label + '平均 ' + ZZ.fmt(cur.avg) + ' 斤（' + cur.days + ' 天有记录）';
      if (prev) {
        var d = cur.avg - prev.avg;
        txt += '，比' + prevLabel + (Math.abs(d) < 0.05 ? '基本持平' : (d < 0 ? '低 ' + ZZ.fmt(-d) + ' 斤' : '高 ' + ZZ.fmt(d) + ' 斤'));
      } else {
        txt += '，暂无上一周期数据可比';
      }
      return { text: txt, avg: cur.avg, days: cur.days, delta: prev ? cur.avg - prev.avg : null };
    }
    out.week = build(7, '本周', '上周');
    out.month = build(30, '本月', '上月');
    return out;
  };

  /* 标签：用于解释异常波动 */
  ZZ.TAGS = ['经期', '感冒', '聚餐', '旅行', '换了秤', '运动', '喝酒', '熬夜', '便秘', '称重时间不同'];
})(window.ZZ);
