(function () {
  'use strict';

  var PEOPLE = [
    { slug: 'alisa', name: 'Alisa', order: 1 },
    { slug: 'graham', name: 'Graham', order: 2 },
    { slug: 'konny', name: 'Konny', order: 3 }
  ];
  var START = '2027-01-01', END = '2027-04-30';
  var WD_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  var WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var MON_LONG = ['Januar', 'Februar', 'März', 'April'];
  var LS_KEY = 'ski-week-finder-me';

  function $(id) { return document.getElementById(id); }
  function toIso(d) { return d.toISOString().slice(0, 10); }
  function colorOf(pi) { return 'var(--p' + pi + ')'; }

  var DAYS = [];
  for (var t = Date.UTC(2027, 0, 1); ; t += 864e5) {
    var s = toIso(new Date(t));
    if (s > END) break;
    DAYS.push(s);
  }
  var IDX = new Map(DAYS.map(function (s, i) { return [s, i]; }));

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) el.setAttribute(k, v);
      });
    }
    for (var a = 2; a < arguments.length; a++) {
      var kid = arguments[a];
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ---------- state ---------- */
  var db = null, canWrite = true, loaded = false;
  var snap = {};   // slug -> Set of ISO dates, as last stored
  var edits = {};  // slug -> {blocked:Set, v, tries} while a change is unsaved
  var inflight = {}, dirty = {}, timers = {};
  var me = null, statusTimer = null;
  PEOPLE.forEach(function (p) { snap[p.slug] = new Set(); });
  try { me = localStorage.getItem(LS_KEY); } catch (e) { me = null; }
  if (!PEOPLE.some(function (p) { return p.slug === me; })) me = null;

  function blockedOf(slug) { return edits[slug] ? edits[slug].blocked : snap[slug]; }
  function meIndex() { return PEOPLE.findIndex(function (p) { return p.slug === me; }); }

  function setStatus(msg) {
    $('status').textContent = msg;
    clearTimeout(statusTimer);
    if (msg) statusTimer = setTimeout(function () { $('status').textContent = ''; }, 4500);
  }
  function setBanner(msg) { var b = $('banner'); b.hidden = !msg; b.textContent = msg || ''; }

  /* ---------- saving ---------- */
  function scheduleSave(slug) {
    clearTimeout(timers[slug]);
    timers[slug] = setTimeout(function () { flush(slug); }, 350);
  }
  async function flush(slug) {
    var e = edits[slug];
    if (!e) return;
    if (!db) { snap[slug] = new Set(e.blocked); delete edits[slug]; renderAll(); return; }
    if (inflight[slug]) { dirty[slug] = true; return; }
    inflight[slug] = true;
    var sentV = e.v;
    var person = PEOPLE.find(function (p) { return p.slug === slug; });
    try {
      await db.doc('people/' + slug).set({ name: person.name, order: person.order, blocked: Array.from(e.blocked).sort() });
      inflight[slug] = false;
      e.tries = 0;
      if (dirty[slug]) { dirty[slug] = false; flush(slug); }
      else if (e.v === sentV) { delete edits[slug]; renderAll(); }
    } catch (err) {
      inflight[slug] = false;
      if (err && err.code === 'unavailable' && e.tries < 2) { e.tries++; scheduleSave(slug); return; }
      delete edits[slug];
      dirty[slug] = false;
      setStatus('Speichern hat nicht geklappt. Vielleicht darfst du hier nur lesen.');
      renderAll();
    }
  }

  /* ---------- actions ---------- */
  function selectMe(slug) {
    me = slug;
    try { localStorage.setItem(LS_KEY, slug); } catch (e) { /* storage unavailable */ }
    setStatus('');
    renderAll();
  }
  function isMine(i) { return me && blockedOf(me).has(DAYS[i]); }
  function applyDay(i, value) {
    if (!canWrite) { setStatus('Du kannst den Kalender ansehen, aber nicht ändern.'); return; }
    if (!me) { setStatus('Wähle zuerst oben deinen Namen aus.'); return; }
    if (!loaded) { setStatus('Der Kalender lädt noch. Gleich nochmal versuchen.'); return; }
    if (!edits[me]) edits[me] = { blocked: new Set(snap[me]), v: 0, tries: 0 };
    var e = edits[me];
    if (e.blocked.has(DAYS[i]) === value) return;
    if (value) e.blocked.add(DAYS[i]); else e.blocked.delete(DAYS[i]);
    e.v++;
    renderAll();
    scheduleSave(me);
  }

  /* ---------- rendering ---------- */
  function renderPeople() {
    var box = $('people');
    var a = document.activeElement;
    var k = a && box.contains(a) ? a.getAttribute('data-k') : null;
    box.replaceChildren();
    PEOPLE.forEach(function (p, pi) {
      var sel = p.slug === me;
      var n = blockedOf(p.slug).size;
      var chip = h('button', { type: 'button', class: 'chip' + (sel ? ' sel' : ''), 'aria-pressed': sel ? 'true' : 'false', 'data-k': p.slug, onclick: function () { selectMe(p.slug); } },
        h('span', { class: 'swatch' }),
        h('span', { class: 'who' },
          h('span', { class: 'name', text: p.name }),
          h('span', { class: 'meta', text: n === 0 ? '0 Tage markiert' : (n === 1 ? '1 Tag markiert, der nicht passt' : n + ' Tage markiert, die nicht passen') })));
      chip.style.setProperty('--pc', colorOf(pi));
      box.append(chip);
    });
    if (k) { var el = box.querySelector('[data-k="' + k + '"]'); if (el) el.focus(); }
  }

  var cells = [];
  function buildMonths() {
    var box = $('months');
    [0, 1, 2, 3].forEach(function (m) {
      var first = new Date(Date.UTC(2027, m, 1));
      var dim = new Date(Date.UTC(2027, m + 1, 0)).getUTCDate();
      var grid = h('div', { class: 'grid' });
      WD_SHORT.forEach(function (w) { grid.append(h('span', { class: 'wd', text: w })); });
      var lead = (first.getUTCDay() + 6) % 7;
      for (var k = 0; k < lead; k++) grid.append(h('span', { 'aria-hidden': 'true' }));
      for (var d = 1; d <= dim; d++) {
        var i = IDX.get(toIso(new Date(Date.UTC(2027, m, d))));
        var b = h('button', { type: 'button', class: 'day free', 'data-i': String(i) },
          h('span', { class: 'num', text: String(d) }), h('span', { class: 'tags' }));
        cells[i] = b;
        grid.append(b);
      }
      box.append(h('div', { class: 'month' }, h('h3', { text: MON_LONG[m] + ' 2027' }), grid));
    });
  }

  function renderCalendar() {
    var meIdx = meIndex();
    cells.forEach(function (b, i) {
      var who = [];
      PEOPLE.forEach(function (p, pi) { if (blockedOf(p.slug).has(DAYS[i])) who.push(pi); });
      var mine = meIdx >= 0 && who.indexOf(meIdx) >= 0;
      var sig = who.join('.') + '|' + (mine ? 1 : 0);
      if (b._sig === sig) return;
      b._sig = sig;
      b.className = 'day ' + (who.length ? 'marked' : 'free');
      b.setAttribute('aria-pressed', mine ? 'true' : 'false');
      var dt = new Date(DAYS[i] + 'T00:00:00Z');
      b.setAttribute('aria-label', WD_LONG[dt.getUTCDay()] + ' ' + dt.getUTCDate() + '. ' + MON_LONG[dt.getUTCMonth()] + ': ' +
        (who.length ? who.map(function (pi) { return PEOPLE[pi].name; }).join(', ') + ' kann nicht' : 'alle können'));
      var tags = b.lastChild;
      tags.replaceChildren();
      who.forEach(function (pi) {
        var tag = h('span', { class: 'tag', text: PEOPLE[pi].name + ' kann nicht' });
        tag.style.setProperty('--pc', colorOf(pi));
        tags.append(tag);
      });
    });
  }

  function renderAll() { renderPeople(); renderCalendar(); }

  /* ---------- events ---------- */
  var painting = null, ptrHandled = false;
  var months = $('months');
  months.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    var c = e.target.closest('.day');
    if (!c) return;
    var i = Number(c.getAttribute('data-i'));
    painting = !isMine(i);
    ptrHandled = true;
    applyDay(i, painting);
  });
  months.addEventListener('pointerover', function (e) {
    if (painting === null || e.pointerType !== 'mouse' || !(e.buttons & 1)) return;
    var c = e.target.closest('.day');
    if (c) applyDay(Number(c.getAttribute('data-i')), painting);
  });
  document.addEventListener('pointerup', function () {
    painting = null;
    setTimeout(function () { ptrHandled = false; }, 0);
  });
  months.addEventListener('click', function (e) {
    var c = e.target.closest('.day');
    if (!c || ptrHandled) return;
    var i = Number(c.getAttribute('data-i'));
    applyDay(i, !isMine(i));
  });

  /* ---------- start ---------- */
  buildMonths();
  renderAll();

  (async function init() {
    var cfg = null;
    try { cfg = (await import('./firebase-config.js')).firebaseConfig; } catch (e) { cfg = null; }
    if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf('PASTE') === 0) {
      loaded = true;
      setBanner('Der gemeinsame Kalender ist noch nicht eingerichtet (siehe README, Datei firebase-config.js). Änderungen bleiben nur auf diesem Bildschirm.');
      renderAll();
      return;
    }
    try {
      var V = '10.14.1';
      var mods = await Promise.all([
        import('https://www.gstatic.com/firebasejs/' + V + '/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/' + V + '/firebase-firestore.js')
      ]);
      var fs = mods[1].getFirestore(mods[0].initializeApp(cfg));
      db = {
        doc: function (path) {
          return { set: function (data) { return mods[1].setDoc(mods[1].doc(fs, path), data); } };
        },
        collection: function (path) {
          return {
            onSnapshot: function (next, err) {
              return mods[1].onSnapshot(mods[1].collection(fs, path), function (qs) { next({ docs: qs.docs }); }, err);
            }
          };
        }
      };
    } catch (e) {
      db = null;
      loaded = true;
      setBanner('Die Verbindung zum gemeinsamen Kalender konnte nicht aufgebaut werden. Änderungen bleiben nur auf diesem Bildschirm. Lade die Seite neu.');
      renderAll();
      return;
    }
    db.collection('people').onSnapshot(function (qs) {
      PEOPLE.forEach(function (p) { snap[p.slug] = new Set(); });
      qs.docs.forEach(function (d) {
        if (!snap[d.id]) return;
        var x = d.data() || {};
        var arr = Array.isArray(x.blocked) ? x.blocked : [];
        snap[d.id] = new Set(arr.filter(function (s) { return IDX.has(s); }));
      });
      loaded = true;
      renderAll();
    }, function () {
      loaded = true;
      setBanner('Die Verbindung zum gemeinsamen Kalender ist abgebrochen. Prüfe die Firestore-Regeln und lade die Seite neu.');
      renderAll();
    });
  })();
})();
