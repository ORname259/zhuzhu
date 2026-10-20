/* 趋势折线图：纯 Canvas 手绘，无外部依赖 */
window.ZZ = window.ZZ || {};

(function (ZZ) {
  var DAY = 86400000;
  var PAD = { l: 46, r: 16, t: 20, b: 30 };

  function Chart(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.pick = -1;
    var self = this;
    canvas.addEventListener('click', function (ev) {
      var rect = canvas.getBoundingClientRect();
      self.onTap(ev.clientX - rect.left, ev.clientY - rect.top);
    });
  }

  Chart.prototype.onTap = function (x, y) {
    if (!this.view || !this.view.pts.length) return;
    var best = -1, bd = 1e9;
    for (var i = 0; i < this.view.pts.length; i++) {
      var d = Math.abs(this.view.pts[i].x - x);
      if (d < bd) { bd = d; best = i; }
    }
    this.pick = (bd < 34) ? best : -1;
    this.draw();
  };

  function niceTicks(min, max, count) {
    var span = max - min || 1;
    var raw = span / count;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return { lo: lo, hi: hi, ticks: ticks };
  }

  Chart.prototype.setData = function (opts) {
    this.opts = opts;
    this.pick = -1;
    this.draw();
  };

  Chart.prototype.draw = function () {
    var o = this.opts, ctx = this.ctx, cv = this.cv;
    if (!o) return;
    var cssW = cv.clientWidth || 320;
    var cssH = cv.clientHeight || 230;
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    if (cv.width !== Math.round(cssW * dpr) || cv.height !== Math.round(cssH * dpr)) {
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    var series = o.series || [];
    var plotW = cssW - PAD.l - PAD.r;
    var plotH = cssH - PAD.t - PAD.b;

    if (!series.length) {
      ctx.fillStyle = '#b9a8ae';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('还没有记录，先去记一斤吧', cssW / 2, cssH / 2);
      this.view = { pts: [] };
      return;
    }

    var ma = o.showMA ? ZZ.movingAverage(series, 7) : null;
    var last = series[series.length - 1].day;
    var start, end;
    if (o.range === 'all') { start = series[0].day; end = last; }
    else {
      var n = o.range === '7' ? 7 : 30;
      end = last; start = last - (n - 1) * DAY;
      series = series.filter(function (p) { return p.day >= start; });
      if (ma) ma = ma.filter(function (p) { return p.day >= start; });
    }
    if (start === end) { start -= 3 * DAY; end += 3 * DAY; }

    var vals = [];
    for (var i = 0; i < series.length; i++) vals.push(series[i].jin);
    if (ma) for (var k = 0; k < ma.length; k++) vals.push(ma[k].jin);
    if (o.target != null) vals.push(o.target);
    var vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
    var pad = Math.max(0.4, (vmax - vmin) * 0.18);
    var t = niceTicks(vmin - pad, vmax + pad, 4);

    var X = function (day) { return PAD.l + (day - start) / (end - start) * plotW; };
    var Y = function (v) { return PAD.t + (t.hi - v) / (t.hi - t.lo) * plotH; };

    /* 网格 + Y 轴刻度 */
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px system-ui, sans-serif';
    for (var g = 0; g < t.ticks.length; g++) {
      var yv = t.ticks[g], yy = Y(yv);
      if (yy < PAD.t - 2 || yy > PAD.t + plotH + 2) continue;
      ctx.strokeStyle = '#f4e3e7';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, yy); ctx.lineTo(cssW - PAD.r, yy); ctx.stroke();
      ctx.fillStyle = '#c0aab1';
      ctx.fillText(yv % 1 === 0 ? String(yv) : yv.toFixed(1), PAD.l - 6, yy);
    }

    /* X 轴日期 */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var labels = Math.min(o.range === '7' ? 7 : 5, series.length);
    var seen = {};
    for (var s = 0; s < labels; s++) {
      var idx = labels === 1 ? 0 : Math.round(s * (series.length - 1) / (labels - 1));
      var p = series[idx];
      var key = p.day;
      if (seen[key]) continue;
      seen[key] = 1;
      ctx.fillStyle = '#c0aab1';
      ctx.fillText(ZZ.mdOf(p.day), X(p.day), PAD.t + plotH + 8);
    }

    /* 目标线 */
    if (o.target != null) {
      var ty = Y(o.target);
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#f0a3b4';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(PAD.l, ty); ctx.lineTo(cssW - PAD.r, ty); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#e0748f';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('目标 ' + ZZ.fmt(o.target) + ' 斤', PAD.l + 2, ty - 2);
    }

    /* 原始折线 */
    ctx.strokeStyle = '#f58ba6';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var pts = [];
    for (var a = 0; a < series.length; a++) {
      var px = X(series[a].day), py = Y(series[a].jin);
      pts.push({ x: px, y: py, d: series[a] });
      if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    /* 移动平均线 */
    if (ma && ma.length > 1) {
      ctx.strokeStyle = '#a05c72';
      ctx.lineWidth = 2.6;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (var b = 0; b < ma.length; b++) {
        var mx = X(ma[b].day), my = Y(ma[b].jin);
        if (b === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    /* 数据点 + 备注/标签标记 */
    for (var c = 0; c < pts.length; c++) {
      var pt = pts[c];
      var tagged = (pt.d.tags && pt.d.tags.length) || pt.d.note;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, tagged ? 3.4 : 2.4, 0, Math.PI * 2);
      ctx.fillStyle = tagged ? '#ff8a3d' : '#f58ba6';
      ctx.fill();
      if (tagged) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    this.view = { pts: pts, Y: Y };

    /* 点选气泡 */
    if (this.pick >= 0 && pts[this.pick]) {
      var sel = pts[this.pick], d = sel.d;
      ctx.strokeStyle = '#f0a3b4';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(sel.x, PAD.t); ctx.lineTo(sel.x, PAD.t + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(sel.x, sel.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill();
      ctx.strokeStyle = '#ef6f92'; ctx.lineWidth = 2; ctx.stroke();

      var l1 = ZZ.ymd(d.day) + ' ' + ZZ.weekday(d.day);
      var l2 = ZZ.fmt(d.jin) + ' 斤' + (d.count > 1 ? '（当天 ' + d.count + ' 次）' : '');
      var l3 = (d.tags.length ? d.tags.join('/') : '') + (d.tags.length && d.note ? ' · ' : '') + d.note;
      var lines = l3 ? [l1, l2, l3.length > 16 ? l3.slice(0, 16) + '…' : l3] : [l1, l2];
      ctx.font = '11px system-ui, sans-serif';
      var bw = 0;
      for (var q = 0; q < lines.length; q++) bw = Math.max(bw, ctx.measureText(lines[q]).width);
      bw += 16;
      var bh = lines.length * 15 + 10;
      var bx = Math.min(Math.max(PAD.l, sel.x - bw / 2), cssW - PAD.r - bw);
      var by = sel.y - bh - 10 < PAD.t ? sel.y + 12 : sel.y - bh - 10;
      ctx.fillStyle = 'rgba(74,44,53,0.92)';
      roundRect(ctx, bx, by, bw, bh, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      for (var w = 0; w < lines.length; w++) {
        ctx.fillStyle = w === 1 ? '#ffd7e2' : '#fff';
        ctx.font = (w === 1 ? 'bold ' : '') + '11px system-ui, sans-serif';
        ctx.fillText(lines[w], bx + 8, by + 6 + w * 15);
      }
    }
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  ZZ.Chart = Chart;
})(window.ZZ);
