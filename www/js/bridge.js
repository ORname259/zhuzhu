/* 原生桥：桌面小组件与 WebView 之间的待合并记录 */
window.ZZ = window.ZZ || {};

(function (ZZ) {
  function plugin() {
    var C = window.Capacitor;
    if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return null;
    return (C.Plugins && C.Plugins.ScaleBridge) || null;
  }

  ZZ.isNative = function () { return !!plugin(); };

  ZZ.pushNative = function () {
    var P = plugin();
    if (!P) return;
    var last = ZZ.lastRecord();
    if (!last) return;
    try { P.pushState({ jin: String(last.jin), ts: String(last.ts) }); } catch (e) { /* 桥不可用 */ }
  };

  ZZ.pullNative = function (done) {
    var P = plugin();
    if (!P) { if (done) done(0); return; }
    P.pullPending().then(function (res) {
      var n = 0;
      var list = [];
      try { list = JSON.parse((res && res.records) || '[]'); } catch (e) { list = []; }
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var jin = Number(r && r.jin);
        if (!isFinite(jin) || jin < 15 || jin > 1000) continue;
        ZZ.addRecord({
          ts: Number(r.ts) || Date.now(),
          jin: jin,
          note: (r.note || '桌面小组件'),
          tags: []
        });
        n++;
      }
      if (n && ZZ.rerender) ZZ.rerender();
      ZZ.pushNative();
      if (done) done(n);
    }).catch(function () { if (done) done(0); });
  };
})(window.ZZ);
