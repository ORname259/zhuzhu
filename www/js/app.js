/* 界面逻辑 */
window.ZZ = window.ZZ || {};

(function (ZZ) {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var draft = { text: '', ts: Date.now(), tags: [], note: '', editing: null, metaOpen: false, tagOpen: false };
  var chart = null;
  var undoTimer = null;

  /* ---------------- 通用 ---------------- */
  function toast(msg, action) {
    var el = $('#toast');
    el.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    if (action) {
      var b = document.createElement('button');
      b.textContent = action.label;
      b.onclick = function () { action.fn(); hideToast(); };
      el.appendChild(b);
    }
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(hideToast, action ? 6000 : 2200);
  }
  function hideToast() { $('#toast').classList.remove('show'); }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- 录入 ---------------- */
  function pressKey(k) {
    var t = draft.text;
    if (k === 'del') { draft.text = t.slice(0, -1); }
    else if (k === 'clear') { draft.text = ''; }
    else if (k === '.') { if (t.indexOf('.') >= 0 || t === '') { if (t === '') t = '0'; else { bump(); return; } } draft.text = t + '.'; }
    else {
      if (t === '0') t = '';
      var next = t + k;
      var digits = next.replace('.', '');
      if (digits.length > 5) { bump(); return; }
      if (next.indexOf('.') >= 0 && next.split('.')[1].length > 2) { bump(); return; }
      draft.text = next;
    }
    renderEntry();
    bump();
  }
  function bump() {
    var el = $('#entry-value');
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  function draftValue() {
    var v = parseFloat(draft.text);
    return isFinite(v) ? v : null;
  }

  function saveEntry() {
    var v = draftValue();
    if (v == null || v < 15 || v > 1000) {
      toast(draft.text ? '这个数不太像体重，检查一下' : '先按数字输入体重');
      return;
    }
    var payload = { ts: draft.ts, jin: Math.round(v * 100) / 100, note: draft.note.trim(), tags: draft.tags.slice() };
    if (draft.editing) {
      ZZ.updateRecord(draft.editing, payload);
      toast('已更新这条记录');
      cancelEdit();
    } else {
      ZZ.addRecord(payload);
      toast('已记下 ' + ZZ.fmt(payload.jin) + ' 斤');
      draft.text = '';
      draft.ts = Date.now();
      draft.tags = [];
      draft.note = '';
      draft.tagOpen = false;
    }
    renderAll();
  }

  function startEdit(id) {
    var r = ZZ.records().filter(function (x) { return x.id === id; })[0];
    if (!r) return;
    draft.editing = id;
    draft.text = String(r.jin);
    draft.ts = r.ts;
    draft.note = r.note || '';
    draft.tags = (r.tags || []).slice();
    draft.tagOpen = true;
    switchTab('home');
    renderAll();
    $('#entry-card').scrollIntoView({ block: 'center' });
  }
  function cancelEdit() {
    draft.editing = null;
    draft.text = '';
    draft.note = '';
    draft.tags = [];
    draft.tagOpen = false;
    draft.ts = Date.now();
  }

  /* ---------------- 渲染：首页 ---------------- */
  function renderEntry() {
    var last = ZZ.lastRecord();
    $('#entry-value').textContent = draft.text;
    $('#entry-value').classList.toggle('empty', !draft.text);
    $('#entry-value').setAttribute('data-ph', draft.text ? '' : '按数字键输入');
    $('#entry-hint').textContent = draft.text ? '' : (last ? '上次 ' + ZZ.fmt(last.jin) + ' 斤 · ' + ZZ.dayLabel(last.ts) : '还没有记录');

    $('#edit-bar').classList.toggle('show', !!draft.editing);
    if (draft.editing) {
      var r = ZZ.records().filter(function (x) { return x.id === draft.editing; })[0];
      $('#edit-bar span').textContent = '正在修改 ' + (r ? ZZ.ymd(r.ts) + ' ' + ZZ.hm(r.ts) : '') + ' 的记录';
    }
    $('#save-label').textContent = draft.editing ? '保存修改' : '记一斤';
    $('#quote-btn').textContent = last ? '引用上次 ' + ZZ.fmt(last.jin) : '引用上次';

    $('#d-date').value = ZZ.ymd(draft.ts);
    $('#d-time').value = ZZ.hm(draft.ts);
    $('#meta-line').textContent = ZZ.dayLabel(draft.ts) + ' · ' + ZZ.weekday(draft.ts) + ' ' + ZZ.hm(draft.ts);
    $$('#date-shortcuts .chip').forEach(function (c) {
      var off = Number(c.getAttribute('data-off'));
      c.classList.toggle('on', ZZ.dayStart(draft.ts) === ZZ.dayStart(Date.now()) - off * 86400000);
    });

    var tagWrap = $('#tag-area');
    tagWrap.classList.toggle('show', draft.tagOpen || !!draft.note || draft.tags.length > 0);
    $$('#tag-list .chip').forEach(function (c) {
      c.classList.toggle('on', draft.tags.indexOf(c.getAttribute('data-tag')) >= 0);
    });
    $('#note-input').value = draft.note;
    $('#tag-toggle').classList.toggle('open', tagWrap.classList.contains('show'));
  }

  function renderHomeCards() {
    var o = ZZ.overview();
    var p = ZZ.targetProgress();
    $('#top-weight').textContent = o.current == null ? '—' : ZZ.fmt(o.current);

    /* 目标 */
    var goal = $('#goal-card');
    if (!ZZ.state().profile.targetJin || !p) {
      $('#goal-body').innerHTML = '<div class="goal-empty">' +
        (ZZ.state().profile.targetJin ? '还没有体重记录，记一笔就能看到进度' : '还没有目标体重，<b data-act="set-goal">点这里设一个</b>') +
        '</div>';
      $('#goal-bar').style.width = '0%';
      $('#goal-pct').textContent = '';
      $('#goal-changed').textContent = '';
      $('#goal-left').textContent = '';
    } else {
      var mode = p.mode === 'lose' ? '减重' : '增重';
      $('#goal-body').innerHTML = '<div class="goal-nums"><span class="goal-lab">' + mode + '进度</span>' +
        '<span class="goal-t">目标 ' + ZZ.fmt(p.target) + ' 斤</span></div>';
      $('#goal-bar').style.width = p.pct.toFixed(0) + '%';
      $('#goal-pct').textContent = p.pct.toFixed(0) + '%';
      if (p.reached) {
        $('#goal-changed').innerHTML = '<em>已达目标</em>';
        $('#goal-left').textContent = '';
      } else {
        $('#goal-changed').innerHTML = (p.changed < 0 ? '已减 ' : '已增 ') + '<em>' + ZZ.fmt(p.changedAbs) + '</em> 斤';
        $('#goal-left').innerHTML = '还差 <em>' + ZZ.fmt(p.remaining) + '</em> 斤';
      }
    }

    /* 统计卡片 */
    var ideal = o.ideal;
    var bmiTxt = o.bmi == null ? (o.heightCm ? '—' : '<b data-act="set-height">设身高</b>') : o.bmi.toFixed(1);
    var bmiNote = '';
    if (o.bmi != null) {
      bmiNote = o.bmi < 18.5 ? '偏瘦' : o.bmi < 24 ? '正常' : o.bmi < 28 ? '偏胖' : '肥胖';
    }
    var cards = [
      { k: '当前体重', v: o.current == null ? '—' : ZZ.fmt(o.current), u: o.current == null ? '' : '斤', s: o.currentAt ? ZZ.dayLabel(o.currentAt) : '暂无记录' },
      { k: 'BMI', v: bmiTxt, u: '', s: bmiNote || (o.heightCm ? '身高 ' + o.heightCm + 'cm' : '未设身高') },
      { k: '历史最低', v: o.min == null ? '—' : ZZ.fmt(o.min), u: o.min == null ? '' : '斤', s: o.ideal && o.min != null ? idealNote(o.min) : '理想 ' + (ideal ? ZZ.fmt(ideal.minJin, 0) + '~' + ZZ.fmt(ideal.maxJin, 0) + ' 斤' : '设身高后显示') },
      { k: '历史最高', v: o.max == null ? '—' : ZZ.fmt(o.max), u: o.max == null ? '' : '斤', s: o.max == null ? '' : idealNote(o.max) },
      { k: '累计变化', v: o.totalChange == null ? '—' : (o.totalChange > 0 ? '+' : '') + ZZ.fmt(o.totalChange), u: o.totalChange == null ? '' : '斤', s: o.first == null ? '记两条就有了' : '自 ' + ZZ.ymd(o.firstAt) },
      { k: '记录条数', v: String(o.count), u: '条', s: o.count ? '共 ' + ZZ.dailySeries().length + ' 天' : '还没开始' }
    ];
    $('#stat-grid').innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="stat-k">' + c.k + '</div><div class="stat-v">' + c.v +
        (c.u ? '<i>' + c.u + '</i>' : '') + '</div><div class="stat-s">' + c.s + '</div></div>';
    }).join('');

    /* 预计达成 */
    var pr = ZZ.projection();
    var pe = $('#proj-body');
    if (!ZZ.state().profile.targetJin) { pe.innerHTML = '<div class="muted">设定目标后，这里会根据近期速度推算达成日期。</div>'; }
    else if (!pr.ok) {
      pe.innerHTML = '<div class="proj-bad">' + esc(pr.reason) + '</div>' +
        (pr.slope != null ? '<div class="muted">近期速度：' + ZZ.fmt(pr.slope * 7) + ' 斤/周</div>' : '<div class="muted">再多记几天，样本越准。</div>');
    } else if (pr.reached) {
      pe.innerHTML = '<div class="proj-good">已经在目标体重上了</div>';
    } else {
      pe.innerHTML = '<div class="proj-date">' + ZZ.ymd(pr.date) + '<i>' + ZZ.weekday(pr.date) + '</i></div>' +
        '<div class="muted">大约 ' + pr.days + ' 天后 · 近期速度 ' + (pr.perWeek < 0 ? '' : '+') + ZZ.fmt(pr.perWeek) + ' 斤/周</div>';
    }

    /* 周 / 月小结 */
    var sm = ZZ.summaries();
    $('#sum-list').innerHTML =
      (sm.week ? '<div class="sum"><b>周</b><span>' + esc(sm.week.text) + '</span></div>' : '') +
      (sm.month ? '<div class="sum"><b>月</b><span>' + esc(sm.month.text) + '</span></div>' : '') +
      (!sm.week && !sm.month ? '<div class="muted">有记录之后自动生成。</div>' : '');
  }

  function idealNote(jin) {
    var ideal = ZZ.idealRange(ZZ.state().profile.heightCm);
    if (!ideal) return '';
    if (jin < ideal.minJin) return '低于理想区间';
    if (jin > ideal.maxJin) return '高于理想区间';
    return '在理想区间内';
  }

  /* ---------------- 渲染：记录列表 ---------------- */
  function renderRecords() {
    var recs = ZZ.records().slice().reverse();
    var box = $('#record-list');
    $('#record-count').textContent = recs.length ? recs.length + ' 条' : '';
    if (!recs.length) {
      box.innerHTML = '<div class="empty-list">还没有记录<br>去「记一斤」按数字就能记</div>';
      return;
    }
    var html = '', curDay = null;
    recs.forEach(function (r) {
      var day = ZZ.dayStart(r.ts);
      if (day !== curDay) {
        curDay = day;
        var n = ZZ.records().filter(function (x) { return ZZ.dayStart(x.ts) === day; }).length;
        html += '<div class="day-head"><span>' + ZZ.ymd(day) + ' ' + ZZ.weekday(day) + ' ' + ZZ.dayLabel(day) + '</span><i>' + n + ' 次</i></div>';
      }
      var meta = [];
      if (r.tags.length) meta = meta.concat(r.tags);
      if (r.note) meta.push(r.note);
      html += '<div class="rec" data-id="' + r.id + '">' +
        '<div class="rec-time">' + ZZ.hm(r.ts) + '</div>' +
        '<div class="rec-main"><div class="rec-jin">' + ZZ.fmt(r.jin) + '<i>斤</i></div>' +
        (meta.length ? '<div class="rec-meta">' + esc(meta.join(' · ')) + '</div>' : '') + '</div>' +
        '<div class="rec-act">' +
        '<button data-act="edit" data-id="' + r.id + '" aria-label="编辑">编辑</button>' +
        '<button data-act="del" data-id="' + r.id + '" class="danger" aria-label="删除">删除</button>' +
        '</div></div>';
    });
    box.innerHTML = html;
  }

  /* ---------------- 渲染：趋势 ---------------- */
  function renderTrend() {
    var st = ZZ.state();
    var series = ZZ.dailySeries();
    if (!chart) chart = new ZZ.Chart($('#chart'));
    chart.setData({
      series: series,
      showMA: st.prefs.showMA,
      range: st.prefs.range,
      target: st.profile.targetJin
    });
    $$('#range-seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-range') === st.prefs.range); });
    $('#ma-toggle').classList.toggle('on', st.prefs.showMA);
    $('#legend-ma').classList.toggle('off', !st.prefs.showMA);

    var ma = ZZ.movingAverage(series, 7);
    var lastMA = ma.length ? ma[ma.length - 1].jin : null;
    var lastRaw = series.length ? series[series.length - 1].jin : null;
    $('#trend-sub').textContent = series.length
      ? '最新 ' + ZZ.fmt(lastRaw) + ' 斤 · 7 日均线 ' + ZZ.fmt(lastMA) + ' 斤 · 共 ' + series.length + ' 天'
      : '暂无数据';
    $('#trend-summary').innerHTML = (function () {
      var sm = ZZ.summaries();
      var out = [];
      if (sm.week) out.push(sm.week.text);
      if (sm.month) out.push(sm.month.text);
      return out.length ? out.map(function (t) { return '<div class="sum"><b>·</b><span>' + esc(t) + '</span></div>'; }).join('') : '<div class="muted">有记录之后自动生成。</div>';
    })();
  }

  /* ---------------- 渲染：设置 ---------------- */
  function renderSettings() {
    var p = ZZ.state().profile;
    $('#set-height').value = p.heightCm || '';
    $('#set-target').value = p.targetJin || '';
    $('#set-unit-cur').textContent = '斤（全局生效）';
    var o = ZZ.overview();
    $('#set-stats').textContent = o.count ? o.count + ' 条记录 · ' + ZZ.dailySeries().length + ' 天' : '暂无记录';
    $('#set-bmi').textContent = o.bmi != null ? '当前 BMI ' + o.bmi.toFixed(1) + (idealNote(o.current) ? ' · ' + idealNote(o.current) : '') : '设置身高后自动计算 BMI 与理想体重区间';
    var ideal = ZZ.idealRange(p.heightCm);
    $('#set-ideal').textContent = ideal ? '理想体重区间：' + ZZ.fmt(ideal.minJin, 1) + ' ~ ' + ZZ.fmt(ideal.maxJin, 1) + ' 斤（BMI 18.5~23.9）' : '';
  }

  function renderTagChips() {
    $('#tag-list').innerHTML = ZZ.TAGS.map(function (t) {
      return '<button class="chip" data-tag="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
  }

  function renderAll() {
    renderEntry();
    renderHomeCards();
    renderRecords();
    renderSettings();
    if ($('#tab-trend').classList.contains('active')) renderTrend();
    if (ZZ.pushNative) ZZ.pushNative();
  }
  ZZ.rerender = renderAll;

  /* ---------------- Tab ---------------- */
  function switchTab(name) {
    $$('.tab').forEach(function (t) { t.classList.toggle('on', t.getAttribute('data-tab') === name); });
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'tab-' + name); });
    if (name === 'trend') renderTrend();
    window.scrollTo(0, 0);
  }

  /* ---------------- 首次引导 ---------------- */
  function maybeOnboard() {
    var p = ZZ.state().profile;
    if (p.onboarded) return;
    $('#onboard').classList.add('show');
  }
  function closeOnboard() {
    ZZ.setProfile({ onboarded: true });
    $('#onboard').classList.remove('show');
    renderAll();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('#keypad').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) pressKey(b.getAttribute('data-k'));
    });
    $('#save-btn').addEventListener('click', saveEntry);
    $('#quote-btn').addEventListener('click', function () {
      var last = ZZ.lastRecord();
      if (!last) { toast('还没有可以引用的记录'); return; }
      draft.text = String(last.jin);
      bump();
      renderEntry();
    });
    $('#cancel-edit').addEventListener('click', function () { cancelEdit(); renderAll(); });
    $('#tag-toggle').addEventListener('click', function () { draft.tagOpen = !draft.tagOpen; renderEntry(); });
    $('#tag-list').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var t = c.getAttribute('data-tag');
      var i = draft.tags.indexOf(t);
      if (i >= 0) draft.tags.splice(i, 1); else draft.tags.push(t);
      renderEntry();
    });
    $('#note-input').addEventListener('input', function (e) { draft.note = e.target.value; });
    $('#d-date').addEventListener('change', function (e) {
      var parts = (e.target.value || ZZ.ymd(Date.now())).split('-');
      var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]),
        new Date(draft.ts).getHours(), new Date(draft.ts).getMinutes());
      draft.ts = d.getTime();
      renderEntry();
    });
    $('#d-time').addEventListener('change', function (e) {
      var parts = (e.target.value || '00:00').split(':');
      var d = new Date(draft.ts);
      d.setHours(Number(parts[0]) || 0, Number(parts[1]) || 0, 0, 0);
      draft.ts = d.getTime();
      renderEntry();
    });
    $('#date-shortcuts').addEventListener('click', function (e) {
      var c = e.target.closest('.chip');
      if (!c) return;
      var off = Number(c.getAttribute('data-off'));
      var d = new Date(ZZ.dayStart(Date.now()) - off * 86400000);
      var now = new Date();
      d.setHours(now.getHours(), now.getMinutes(), 0, 0);
      if (d.getTime() > Date.now()) d = new Date();
      draft.ts = d.getTime();
      renderEntry();
    });

    $('#range-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      ZZ.setPrefs({ range: b.getAttribute('data-range') });
      renderTrend();
    });
    $('#ma-toggle').addEventListener('click', function () {
      ZZ.setPrefs({ showMA: !ZZ.state().prefs.showMA });
      renderTrend();
    });

    $('#tabs').addEventListener('click', function (e) {
      var t = e.target.closest('.tab');
      if (t) switchTab(t.getAttribute('data-tab'));
    });

    $('#record-list').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var id = b.getAttribute('data-id');
      if (b.getAttribute('data-act') === 'edit') startEdit(id);
      if (b.getAttribute('data-act') === 'del') {
        var r = ZZ.records().filter(function (x) { return x.id === id; })[0];
        if (!r) return;
        ZZ.deleteRecord(id);
        renderAll();
        toast('已删除 ' + ZZ.fmt(r.jin) + ' 斤', {
          label: '撤销', fn: function () {
            ZZ.addRecord({ ts: r.ts, jin: r.jin, note: r.note, tags: r.tags });
            renderAll();
          }
        });
      }
    });

    $('#back-home').addEventListener('click', function () {
      switchTab('home');
      setTimeout(function () { $('#d-date').focus(); }, 150);
      toast('改好日期再记，就能补上漏的那天');
    });

    /* 设置项 */
    function bindNum(sel, key, min, max) {
      $(sel).addEventListener('change', function (e) {
        var v = parseFloat(e.target.value);
        if (e.target.value === '' || isNaN(v)) { ZZ.setProfile(makePatch(key, null)); }
        else if (v < min || v > max) { toast('请输入 ' + min + '~' + max + ' 之间的数'); e.target.value = ZZ.state().profile[key] || ''; return; }
        else ZZ.setProfile(makePatch(key, Math.round(v * 100) / 100));
        renderAll();
        toast('已保存');
      });
    }
    function makePatch(k, v) { var o = {}; o[k] = v; return o; }
    bindNum('#set-height', 'heightCm', 80, 250);
    bindNum('#set-target', 'targetJin', 20, 1000);

    var clearArmed = false;
    $('#clear-data').addEventListener('click', function () {
      if (!clearArmed) {
        clearArmed = true;
        this.textContent = '再点一次确认清空';
        this.classList.add('armed');
        var self = this;
        clearTimeout(undoTimer);
        undoTimer = setTimeout(function () { clearArmed = false; self.textContent = '清空全部数据'; self.classList.remove('armed'); }, 4000);
        return;
      }
      clearArmed = false;
      var backup = JSON.stringify(ZZ.state());
      ZZ.clearAll();
      renderAll();
      toast('已清空', { label: '撤销', fn: function () { localStorage.setItem('zhuzhucheng.v1', backup); ZZ.load(); renderAll(); } });
    });

    $('#export-data').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(ZZ.state(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'zhuzhucheng-' + ZZ.ymd(Date.now()) + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      toast('已导出备份文件');
    });
    $('#import-data').addEventListener('click', function () { $('#import-file').click(); });
    $('#import-file').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var data = JSON.parse(fr.result);
          if (!data || !Array.isArray(data.records)) throw new Error('bad');
          localStorage.setItem('zhuzhucheng.v1', JSON.stringify(data));
          ZZ.load(); renderAll();
          toast('已导入 ' + data.records.length + ' 条记录');
        } catch (err) { toast('这个文件读不了'); }
        e.target.value = '';
      };
      fr.readAsText(f);
    });

    $('#ob-save').addEventListener('click', function () {
      var h = parseFloat($('#ob-height').value), t = parseFloat($('#ob-target').value);
      var patch = {};
      if (isFinite(h) && h >= 80 && h <= 250) patch.heightCm = Math.round(h * 10) / 10;
      if (isFinite(t) && t >= 20 && t <= 1000) patch.targetJin = Math.round(t * 100) / 100;
      ZZ.setProfile(patch);
      closeOnboard();
    });
    $('#ob-skip').addEventListener('click', closeOnboard);

    /* 首页卡片里的行内动作 */
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'set-height' || act === 'set-goal') {
        switchTab('me');
        setTimeout(function () { $(act === 'set-height' ? '#set-height' : '#set-target').focus(); }, 120);
      }
    });

    window.addEventListener('resize', function () { if (chart) chart.draw(); });
    document.addEventListener('keydown', function (e) {
      if (!$('#tab-home').classList.contains('active')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key >= '0' && e.key <= '9') pressKey(e.key);
      else if (e.key === '.') pressKey('.');
      else if (e.key === 'Backspace') pressKey('del');
      else if (e.key === 'Enter') saveEntry();
    });
  }

  ZZ.init = function () {
    ZZ.load();
    renderTagChips();
    bind();
    renderAll();
    switchTab('home');
    maybeOnboard();
    if (ZZ.isNative && ZZ.isNative()) {
      $$('[data-web-only]').forEach(function (el) { el.style.display = 'none'; });
      $$('[data-native-only]').forEach(function (el) { el.style.display = ''; });
      ZZ.pullNative(function (n) {
        if (n) { renderAll(); toast('已合并小组件记的 ' + n + ' 条'); }
      });
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) ZZ.pullNative(function (n) { if (n) { renderAll(); toast('已合并小组件记的 ' + n + ' 条'); } });
      });
    }
    if (window.navigator.standalone || matchMedia('(display-mode: standalone)').matches) {
      document.body.classList.add('standalone');
    }
  };
})(window.ZZ);
