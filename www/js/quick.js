/* 桌面快捷录入页：只做一件事——按数字，保存 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var text = '', ts = Date.now();

  ZZ.load();

  function fmtHint() {
    var last = ZZ.lastRecord();
    $('#entry-hint').textContent = last ? '上次 ' + ZZ.fmt(last.jin) + ' 斤 · ' + ZZ.dayLabel(last.ts) : '还没有记录';
    $('#quote-btn').textContent = last ? '引用上次 ' + ZZ.fmt(last.jin) : '引用上次';
  }

  function paint() {
    var el = $('#entry-value');
    el.textContent = text;
    el.classList.toggle('empty', !text);
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  function syncDate() {
    $('#d-date').value = ZZ.ymd(ts);
    $('#d-time').value = ZZ.hm(ts);
  }

  function press(k) {
    if (k === 'del') text = text.slice(0, -1);
    else if (k === '.') {
      if (text.indexOf('.') >= 0) return;
      text = (text === '' ? '0' : text) + '.';
    } else {
      if (text === '0') text = '';
      var next = text + k;
      if (next.replace('.', '').length > 5) return;
      if (next.indexOf('.') >= 0 && next.split('.')[1].length > 2) return;
      text = next;
    }
    paint();
  }

  function save() {
    var v = parseFloat(text);
    if (!isFinite(v) || v < 15 || v > 1000) {
      var el = $('#entry-value');
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
      return;
    }
    v = Math.round(v * 100) / 100;
    ZZ.addRecord({ ts: ts, jin: v, note: '', tags: [] });
    if (ZZ.pushNative) ZZ.pushNative();
    $('#done-val').textContent = ZZ.fmt(v) + ' 斤';
    $('#done-msg').textContent = ZZ.dayLabel(ts) + ' ' + ZZ.hm(ts) + ' 已记下';
    $('#q-form').classList.add('hide');
    $('#q-done').classList.remove('hide');
    text = '';
    ts = Date.now();
    syncDate();
    fmtHint();
  }

  $('#keypad').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) press(b.getAttribute('data-k'));
  });
  $('#save-btn').addEventListener('click', save);
  $('#quote-btn').addEventListener('click', function () {
    var last = ZZ.lastRecord();
    if (!last) return;
    text = String(last.jin);
    paint();
  });
  $('#again-btn').addEventListener('click', function () {
    $('#q-done').classList.add('hide');
    $('#q-form').classList.remove('hide');
    paint();
  });
  $('#d-date').addEventListener('change', function (e) {
    var p = (e.target.value || ZZ.ymd(Date.now())).split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), new Date(ts).getHours(), new Date(ts).getMinutes());
    ts = d.getTime();
  });
  $('#d-time').addEventListener('change', function (e) {
    var p = (e.target.value || '00:00').split(':');
    var d = new Date(ts);
    d.setHours(Number(p[0]) || 0, Number(p[1]) || 0, 0, 0);
    ts = d.getTime();
  });
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key >= '0' && e.key <= '9') press(e.key);
    else if (e.key === '.') press('.');
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') save();
  });

  syncDate();
  paint();
  fmtHint();
  if (ZZ.pullNative) {
    ZZ.pullNative(function (n) {
      fmtHint();
      if (n) {
        var el = $('#entry-hint');
        el.textContent = '已合并小组件记的 ' + n + ' 条';
      }
    });
  }

  var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!native && 'serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
