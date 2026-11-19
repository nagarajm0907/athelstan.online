/* Athelstan.Online: live AI Visibility scan. Add-on for the checker page.
   Takes over the form, sends it to /api/check, and shows the real result under the form. */
(function () {
  var form = document.querySelector('form.audit-form');
  if (!form) return;
  var host = form.closest('section') || form.parentNode;
  var css = '#avcResult{padding:10px 20px 60px}#avcResult[hidden]{display:none}' +
    '.avc-card{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e6e1d6;border-radius:22px;padding:14px;box-shadow:0 24px 60px rgba(27,36,48,.12);color:#1b2430;text-align:left}' +
    '.avc-in{background:#f4f1ea;border-radius:14px;padding:18px}' +
    '.avc-top{display:flex;justify-content:space-between;gap:10px;margin-bottom:14px;font-size:.85rem;flex-wrap:wrap}.avc-top b{font-weight:600}.avc-top span{color:#1f9d63;font-size:.78rem}' +
    '.avc-title{background:#fff;border:1px solid #e6e1d6;border-radius:12px;padding:14px 16px;margin-bottom:18px}.avc-title h4{margin:0 0 4px;font-size:1rem}.avc-title p{margin:0;font-size:.82rem;line-height:1.5;color:#5b6675}' +
    '.avc-score{display:flex;align-items:center;gap:22px;margin-bottom:20px}.avc-ring{position:relative;width:92px;height:92px;flex:none}' +
    '.avc-ring svg{width:100%;height:100%;transform:rotate(-90deg)}.avc-ring circle{fill:none;stroke-width:7}.avc-ring .bg{stroke:#e9e5db}' +
    '.avc-ring .fg{stroke-linecap:round;stroke-dasharray:213.6;stroke-dashoffset:213.6;transition:stroke-dashoffset 1.2s ease}' +
    '.avc-ring .v{position:absolute;inset:0;display:grid;place-content:center;font-size:1.6rem;font-weight:700}' +
    '.avc-bars{flex:1;display:grid;gap:11px}.avc-bar{display:grid;grid-template-columns:118px 1fr 36px;align-items:center;gap:10px;font-size:.78rem;color:#5b6675}' +
    '.avc-bar i{display:block;height:7px;border-radius:99px;background:#e9e5db;overflow:hidden}.avc-bar u{display:block;height:100%;width:0;border-radius:99px;transition:width 1s ease}.avc-bar em{font-style:normal;text-align:right;color:#1b2430;font-weight:700}' +
    '.avc-sub{margin:0 0 8px;font-size:.78rem;font-weight:600}.avc-fixes{display:grid;gap:8px}' +
    '.avc-fix{display:flex;justify-content:space-between;gap:12px;background:#fff;border:1px solid #e6e1d6;border-radius:11px;padding:11px 14px}' +
    '.avc-fix b{display:block;font-size:.85rem;font-weight:600}.avc-fix span{display:block;font-size:.74rem;color:#5b6675;margin-top:3px;line-height:1.45}.avc-fix .how{color:#1b2430;margin-top:6px}' +
    '.avc-pill{flex:none;align-self:flex-start;font-size:.66rem;font-weight:700;padding:4px 10px;border-radius:99px;background:#e8e6e0;color:#4d5868}' +
    '.avc-pill.high{background:#fde3da;color:#b2381a}.avc-pill.med{background:#fcefc2;color:#7d5a00}' +
    '.avc-note{font-size:.75rem;color:#5b6675;margin:14px 2px 0;line-height:1.5}' +
    '.avc-loading{text-align:center;padding:34px 18px;color:#5b6675}.avc-spin{width:34px;height:34px;margin:0 auto 14px;border:4px solid #e9e5db;border-top-color:#e6ab00;border-radius:50%;animation:avcspin .9s linear infinite}' +
    '@keyframes avcspin{to{transform:rotate(360deg)}}.avc-err{background:#fde3da;color:#8a2a12;border-radius:12px;padding:14px 16px;font-size:.9rem;line-height:1.5}' +
    '.audit-success{display:none!important}' +
    '@media(max-width:480px){.avc-score{flex-direction:column;align-items:flex-start}.avc-bars{width:100%}.avc-bar{grid-template-columns:100px 1fr 32px}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var sec = document.createElement('section'); sec.id = 'avcResult'; sec.hidden = true;
  sec.innerHTML = '<div class="avc-card"><div class="avc-in" id="avcOut" aria-live="polite"></div></div>';
  host.parentNode.insertBefore(sec, host.nextSibling);
  var out = sec.querySelector('#avcOut');
  var note = form.querySelector('.audit-form-note');
  if (note) note.textContent = 'No card required. Your score appears on this page, usually in under a minute.';

  var COL = { High: '#1f9d63', Medium: '#c98a00', Low: '#c8452a' }, busy = false;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function band(n) { return n >= 71 ? 'High' : n >= 41 ? 'Medium' : 'Low'; }
  function show(n) { out.textContent = ''; out.appendChild(n); sec.hidden = false; setTimeout(function () { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250); }
  function loading() { var d = el('div', 'avc-loading'); d.appendChild(el('div', 'avc-spin')); d.appendChild(el('p', null, 'Scanning your site. This usually takes under a minute.')); show(d); }
  function fail(m) { show(el('div', 'avc-err', m)); }
  function render(r) {
    var col = COL[r.band] || COL.Low, f = document.createDocumentFragment();
    var top = el('div', 'avc-top'); top.appendChild(el('b', null, 'AI Visibility Report')); top.appendChild(el('span', null, '✓ ' + r.host + ' scanned (' + r.pages_scanned + ' pages)')); f.appendChild(top);
    var t = el('div', 'avc-title'); t.appendChild(el('h4', null, 'Overall AI Visibility Score: ' + r.band));
    t.appendChild(el('p', null, 'How easily AI chatbots and AI search can find, read and recommend your website, based on four technical signals.')); f.appendChild(t);
    var sc = el('div', 'avc-score'), ring = el('div', 'avc-ring');
    ring.innerHTML = '<svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="34"/><circle class="fg" cx="40" cy="40" r="34"/></svg>';
    var fg = ring.querySelector('.fg'); fg.style.stroke = col;
    var v = el('div', 'v', String(r.score)); ring.appendChild(v); sc.appendChild(ring);
    var bars = el('div', 'avc-bars'), fills = [];
    r.signals.forEach(function (s) {
      var row = el('div', 'avc-bar'); row.appendChild(document.createTextNode(s.name));
      var i = document.createElement('i'), u = document.createElement('u'); u.style.background = COL[band(s.score)];
      i.appendChild(u); row.appendChild(i); row.appendChild(el('em', null, String(s.score))); bars.appendChild(row); fills.push([u, s.score]);
    });
    sc.appendChild(bars); f.appendChild(sc);
    f.appendChild(el('p', 'avc-sub', r.fixes.length ? 'Fix these first' : 'No major fixes found'));
    var list = el('div', 'avc-fixes');
    r.fixes.forEach(function (x) {
      var row = el('div', 'avc-fix'), d = document.createElement('div');
      d.appendChild(el('b', null, x.title)); d.appendChild(el('span', null, x.detail)); if (x.fix) d.appendChild(el('span', 'how', 'How to fix: ' + x.fix));
      row.appendChild(d); row.appendChild(el('span', 'avc-pill ' + (x.priority === 'High' ? 'high' : x.priority === 'Medium' ? 'med' : ''), x.priority === 'Medium' ? 'MED' : x.priority.toUpperCase())); list.appendChild(row);
    });
    f.appendChild(list);
    if (r.passed && r.passed.length) f.appendChild(el('p', 'avc-note', 'Working well: ' + r.passed.join(', ') + '.'));
    f.appendChild(el('p', 'avc-note', 'This is a technical check of up to ' + r.pages_scanned + ' pages. It shows how readable your site is to AI. It does not guarantee rankings or AI citations. Want the fixes done for you? Write to athelstan.online@gmail.com.'));
    show(f);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      fg.style.strokeDashoffset = String(213.6 * (1 - r.score / 100));
      fills.forEach(function (x) { x[0].style.width = x[1] + '%'; });
    }); });
  }
  function val(n) { var e = form.querySelector('[name="' + n + '"]'); return e ? e.value : ''; }
  window.addEventListener('submit', function (e) {
    if (e.target !== form) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var url = val('website').trim();
    if (busy || !url || val('_honey')) return;
    busy = true; loading();
    var btn = form.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    var ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctl) ctl.abort(); }, 65000);
    fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({ url: url, name: val('name'), email: val('email'), _honey: val('_honey') }) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .then(function (d) { if (d && d.ok) render(d); else fail((d && d.error) || 'The scan could not finish. Please try again in a moment.'); })
      .catch(function () { fail('The scan took too long or could not start. Please try again, or write to athelstan.online@gmail.com and we will review your site by hand.'); })
      .then(function () { clearTimeout(timer); busy = false; if (btn) btn.disabled = false; });
  }, true);
})();
