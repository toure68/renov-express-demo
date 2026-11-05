/* Rénov'Express — application de devis (100 % sur l'appareil) */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var K = { tarifs: 're_tarifs', devis: 're_devis', counter: 're_counter_' };

  /* ---------- Stockage ---------- */
  function load(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function store(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { toast("Mémoire du téléphone pleine : enregistrement impossible"); return false; }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  var tarifs = load(K.tarifs, null);
  if (!tarifs) { tarifs = clone(DEFAULT_TARIFS); store(K.tarifs, tarifs); }
  var devisList = load(K.devis, []);
  var cur = null;         // devis en cours d'édition
  var editTarifIdx = -1;  // tarif en cours d'édition

  /* ---------- Numérotation ---------- */
  function nextNumber() {
    var y = new Date().getFullYear();
    var key = K.counter + y;
    var last = load(key, null);
    if (last === null) last = (y === 2026) ? COMPANY.lastNumber : 0;
    // sécurité : ne jamais réutiliser un numéro existant
    devisList.forEach(function (d) {
      var m = /^D(\d{4})-(\d+)$/.exec(d.num || '');
      if (m && +m[1] === y && +m[2] > last) last = +m[2];
    });
    last += 1; store(key, last);
    return 'D' + y + '-' + String(last).padStart(3, '0');
  }

  /* ---------- Navigation (par #ancre pour le geste retour d'iPhone) ---------- */
  var titles = { home: "Rénov'Express", tarifs: 'Mes tarifs', tarif: 'Modifier le tarif', devis: 'Devis', pick: 'Choisir une prestation', list: 'Mes devis' };
  function go(h) { location.hash = h; }
  function route() {
    var parts = (location.hash.slice(1) || 'home').split('/');
    var v = parts[0]; if (!titles[v]) v = 'home';
    if ((v === 'devis' || v === 'pick') && !cur) {
      var d = devisList.find(function (x) { return x.id === parts[1]; });
      if (d) cur = clone(d); else { v = 'home'; }
    }
    document.querySelectorAll('.view').forEach(function (s) { s.classList.add('hidden'); });
    $('#v-' + v).classList.remove('hidden');
    $('#title').textContent = v === 'devis' && cur && cur.num ? 'Devis ' + cur.num : titles[v];
    $('#btnBack').classList.toggle('hidden', v === 'home');
    if (v === 'home') { cur = null; renderHome(); }
    if (v === 'tarifs') renderTarifs();
    if (v === 'tarif') renderTarifForm(+parts[1]);
    if (v === 'devis') renderDevis();
    if (v === 'pick') renderPick();
    if (v === 'list') { cur = null; renderList(); }
    if (v === 'devis' && scrollToLast) {
      scrollToLast = false;
      var ls = document.querySelectorAll('#lines .line');
      if (ls.length) { ls[ls.length - 1].scrollIntoView({ block: 'center' }); return; }
    }
    window.scrollTo(0, 0);
  }
  var scrollToLast = false;
  window.addEventListener('hashchange', route);
  $('#btnBack').onclick = function () {
    var v = (location.hash.slice(1) || 'home').split('/')[0];
    if (v === 'pick' && cur) go('devis/' + cur.id);
    else if (v === 'tarif') go('tarifs');
    else go('home');
  };
  document.querySelectorAll('[data-go]').forEach(function (b) {
    b.onclick = function () {
      if (b.dataset.go === 'new') { cur = blankDevis(); go('devis/' + cur.id); }
      else go(b.dataset.go);
    };
  });

  var toastT;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2800);
  }

  function renderHome() {
    var n = devisList.length;
    $('#homeHint').textContent = n ? n + ' devis enregistré' + (n > 1 ? 's' : '') + ' sur ce téléphone' : '';
  }

  /* ---------- 1. MES TARIFS ---------- */
  function priceLabel(t) {
    var p = Calc.parseNum(t.price);
    return p === null ? 'sur devis' : Calc.money(p) + (t.unit ? ' / ' + esc(t.unit) : '');
  }
  function tarifRows(filter, onclickAttr) {
    var q = norm(filter), html = '', lastCat = null;
    tarifs.forEach(function (t, i) {
      if (q && norm([t.code, t.label, t.note, t.cat].join(' ')).indexOf(q) < 0) return;
      if (t.cat && t.cat !== lastCat) { html += '<div class="cat">' + esc(t.cat) + '</div>'; lastCat = t.cat; }
      html += '<div class="row" ' + onclickAttr + '="' + i + '"><div class="main"><div class="t">' +
        (t.code ? '<span class="code">' + esc(t.code) + '</span>' : '') + esc(t.label) + '</div>' +
        (t.note ? '<div class="s">' + esc(t.note) + '</div>' : '') +
        '</div><div class="p">' + priceLabel(t) + '</div></div>';
    });
    return html || '<p class="empty">Aucun tarif trouvé</p>';
  }
  function renderTarifs() {
    $('#tarifList').innerHTML = tarifRows($('#tarifSearch').value, 'data-t');
    $('#tarifList').querySelectorAll('[data-t]').forEach(function (r) { r.onclick = function () { go('tarif/' + r.dataset.t); }; });
  }
  $('#tarifSearch').oninput = renderTarifs;
  function renderTarifForm(i) {
    editTarifIdx = i;
    var t = tarifs[i] || { code: '', label: '', unit: '', price: '', note: '' };
    $('#t-code').value = t.code || ''; $('#t-label').value = t.label || ''; $('#t-unit').value = t.unit || '';
    $('#t-price').value = Calc.parseNum(t.price) === null ? '' : String(t.price).replace('.', ',');
    $('#t-note').value = t.note || '';
    $('#btnDelTarif').classList.toggle('hidden', !tarifs[i]);
  }
  $('#btnAddTarif').onclick = function () { go('tarif/' + tarifs.length); };
  $('#btnSaveTarif').onclick = function () {
    var label = $('#t-label').value.trim();
    if (!label) { toast('Indiquez le nom de la prestation'); return; }
    var p = Calc.parseNum($('#t-price').value);
    if ($('#t-price').value.trim() && p === null) { toast('Prix incorrect'); return; }
    var old = tarifs[editTarifIdx] || {};
    var t = { cat: old.cat || '', code: $('#t-code').value.trim(), label: label, unit: $('#t-unit').value.trim(), price: p, note: $('#t-note').value.trim() };
    if (tarifs[editTarifIdx]) tarifs[editTarifIdx] = t; else tarifs.push(t);
    store(K.tarifs, tarifs); toast('Tarif enregistré'); go('tarifs');
  };
  $('#btnDelTarif').onclick = function () {
    if (!confirm('Supprimer ce tarif ?')) return;
    tarifs.splice(editTarifIdx, 1); store(K.tarifs, tarifs); toast('Tarif supprimé'); go('tarifs');
  };
  $('#btnResetTarifs').onclick = function () {
    if (!confirm('Remettre tous les tarifs d\'origine ? Vos modifications seront perdues.')) return;
    tarifs = clone(DEFAULT_TARIFS); store(K.tarifs, tarifs); renderTarifs(); toast('Tarifs d\'origine rétablis');
  };

  /* ---------- 2/3. DEVIS ---------- */
  function blankDevis() {
    return { id: uid(), num: '', date: new Date().toISOString().slice(0, 10), client: { name: '', addr: '', email: '', tel: '' },
      site: '', obj: '', lines: [], tva: 10 };
  }
  function hasContent(d) { return d.client.name.trim() || d.lines.length || d.obj.trim(); }
  function saveCur(silent) {
    if (!cur || !hasContent(cur)) return false;
    if (!cur.num) { cur.num = nextNumber(); $('#d-num').textContent = 'N° ' + cur.num; $('#title').textContent = 'Devis ' + cur.num; }
    cur.updated = Date.now();
    var i = devisList.findIndex(function (d) { return d.id === cur.id; });
    if (i >= 0) devisList[i] = clone(cur); else devisList.unshift(clone(cur));
    store(K.devis, devisList);
    if (!silent) toast('Devis ' + cur.num + ' enregistré');
    return true;
  }
  var saveT;
  function autosave() { clearTimeout(saveT); saveT = setTimeout(function () { saveCur(true); }, 500); }

  var fields = { '#d-cname': ['client', 'name'], '#d-caddr': ['client', 'addr'], '#d-cmail': ['client', 'email'], '#d-ctel': ['client', 'tel'], '#d-site': [null, 'site'], '#d-obj': [null, 'obj'] };
  Object.keys(fields).forEach(function (sel) {
    $(sel).addEventListener('input', function () {
      var f = fields[sel]; (f[0] ? cur[f[0]] : cur)[f[1]] = $(sel).value; autosave();
    });
  });
  function fmtDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }

  function renderDevis() {
    $('#d-num').textContent = cur.num ? 'N° ' + cur.num : 'Nouveau devis';
    $('#d-date').textContent = fmtDate(cur.date);
    Object.keys(fields).forEach(function (sel) { var f = fields[sel]; $(sel).value = (f[0] ? cur[f[0]] : cur)[f[1]] || ''; });
    renderLines(); renderTotals();
  }
  function renderLines() {
    var box = $('#lines');
    if (!cur.lines.length) { box.innerHTML = '<p class="empty">Aucune prestation pour l\'instant</p>'; return; }
    box.innerHTML = cur.lines.map(function (l, i) {
      var noPrice = Calc.parseNum(l.price) === null;
      return '<div class="line' + (noPrice ? ' warn' : '') + '" data-i="' + i + '">' +
        (l.code ? '<span class="code">' + esc(l.code) + '</span>' : '') +
        '<textarea class="field" rows="2" data-k="label" placeholder="Désignation">' + esc(l.label) + '</textarea>' +
        '<div class="grid">' +
        '<label>Quantité<input class="field" inputmode="decimal" data-k="qty" value="' + esc(Calc.qty(l.qty, '')) + '"></label>' +
        '<label>Unité<input class="field" data-k="unit" value="' + esc(l.unit) + '"></label>' +
        '<label>Prix HT €<input class="field" inputmode="decimal" data-k="price" placeholder="à saisir" value="' + (noPrice ? '' : esc(String(l.price).replace('.', ','))) + '"></label>' +
        '</div>' + (noPrice ? '<div class="need">Prix à saisir (prestation sur devis)</div>' : '') +
        '<div class="foot"><button class="del" data-del="' + i + '">Supprimer</button><span class="lt">' + Calc.money(Calc.lineTotalCents(l) / 100) + '</span></div></div>';
    }).join('');
    box.querySelectorAll('[data-k]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var card = inp.closest('.line'), i = +card.dataset.i, k = inp.dataset.k, l = cur.lines[i];
        l[k] = (k === 'qty' || k === 'price') ? Calc.parseNum(inp.value) : inp.value;
        card.querySelector('.lt').textContent = Calc.money(Calc.lineTotalCents(l) / 100);
        if (k === 'price') { var np = l.price === null; card.classList.toggle('warn', np); var n = card.querySelector('.need'); if (n) n.style.display = np ? '' : 'none'; }
        renderTotals(); autosave();
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { if (!confirm('Supprimer cette ligne ?')) return; cur.lines.splice(+b.dataset.del, 1); renderLines(); renderTotals(); saveCur(true); };
    });
  }
  function renderTotals() {
    var t = Calc.totals(cur);
    $('#t-ht').textContent = Calc.money(t.ht);
    $('#t-tvalabel').textContent = 'TVA ' + cur.tva + ' %';
    $('#t-tva').textContent = Calc.money(t.tva);
    $('#t-ttc').textContent = Calc.money(t.ttc);
    $('#t-acompte').textContent = Calc.money(t.acompte);
    document.querySelectorAll('[data-tva]').forEach(function (b) { b.classList.toggle('on', +b.dataset.tva === +cur.tva); });
  }
  document.querySelectorAll('[data-tva]').forEach(function (b) {
    b.onclick = function () { cur.tva = +b.dataset.tva; renderTotals(); autosave(); };
  });
  $('#btnAddLine').onclick = function () { go('pick'); };
  $('#btnAddFree').onclick = function () {
    cur.lines.push({ code: '', label: '', unit: 'u', qty: 1, price: null });
    renderLines(); renderTotals(); saveCur(true);
    var tas = $('#lines').querySelectorAll('textarea'); tas[tas.length - 1].focus();
  };
  $('#btnSave').onclick = function () { if (!saveCur(false)) toast('Rien à enregistrer pour l\'instant'); };

  function renderPick() {
    $('#pickList').innerHTML = tarifRows($('#pickSearch').value, 'data-p');
    $('#pickList').querySelectorAll('[data-p]').forEach(function (r) {
      r.onclick = function () {
        var t = tarifs[+r.dataset.p];
        cur.lines.push({ code: t.code, label: t.label, unit: t.unit, qty: 1, price: Calc.parseNum(t.price) });
        saveCur(true); $('#pickSearch').value = ''; scrollToLast = true; go('devis/' + cur.id);
        toast('Ajouté : pensez à la quantité');
      };
    });
  }
  $('#pickSearch').oninput = renderPick;

  /* ---------- 5/6. PDF : envoyer / télécharger ---------- */
  function checkReady(d) {
    if (!d.client.name.trim()) { toast('Indiquez le nom du client'); return false; }
    if (!d.lines.length) { toast('Ajoutez au moins une prestation'); return false; }
    var miss = d.lines.findIndex(function (l) { return Calc.parseNum(l.price) === null; });
    if (miss >= 0) { toast('Saisissez le prix de la ligne ' + (miss + 1)); return false; }
    return true;
  }
  function pdfFile(d) {
    var blob = PDFDevis.build(d).output('blob');
    var name = 'Devis_' + d.num + '_RenovExpress.pdf';
    return { blob: blob, name: name };
  }
  function download(f) {
    var url = URL.createObjectURL(f.blob), a = document.createElement('a');
    a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('PDF téléchargé');
  }
  function sendDevis(d) {
    var f = pdfFile(d), file;
    try { file = new File([f.blob], f.name, { type: 'application/pdf' }); } catch (e) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      // Uniquement le fichier + titre + texte : jamais de paramètre url (ni d'adresse blob:)
      navigator.share({ files: [file], title: 'Devis ' + d.num + " – Rénov'Express", text: 'Bonjour, voici votre devis ' + d.num + " de Rénov'Express." })
        .catch(function (e) { if (e && e.name !== 'AbortError') download(f); });
    } else {
      toast('Partage non disponible : téléchargement du PDF'); download(f);
    }
  }
  $('#btnSend').onclick = function () { if (checkReady(cur)) { saveCur(true); sendDevis(cur); } };
  $('#btnDownload').onclick = function () { if (checkReady(cur)) { saveCur(true); download(pdfFile(cur)); } };

  /* ---------- 7. MES DEVIS ---------- */
  function renderList() {
    var q = norm($('#listSearch').value);
    var list = devisList.filter(function (d) { return !q || norm(d.client.name).indexOf(q) >= 0; });
    $('#devisList').innerHTML = list.length ? list.map(function (d) {
      return '<div class="card"><div class="row" style="box-shadow:none;padding:0;margin:0" data-open="' + d.id + '"><div class="main"><div class="t">' +
        esc(d.client.name || '(sans nom)') + '</div><div class="s">' + esc(d.num) + ' · ' + fmtDate(d.date) + (d.obj ? ' · ' + esc(d.obj) : '') +
        '</div></div><div class="p">' + Calc.money(Calc.totals(d).ttc) + '</div></div>' +
        '<div class="actions"><button data-open="' + d.id + '">Ouvrir</button><button data-dup="' + d.id + '">Dupliquer</button><button data-send="' + d.id + '">Renvoyer</button></div></div>';
    }).join('') : '<p class="empty">' + (q ? 'Aucun devis pour ce client' : 'Aucun devis enregistré') + '</p>';
    var find = function (id) { return devisList.find(function (d) { return d.id === id; }); };
    $('#devisList').querySelectorAll('[data-open]').forEach(function (b) { b.onclick = function () { cur = clone(find(b.dataset.open)); go('devis/' + cur.id); }; });
    $('#devisList').querySelectorAll('[data-dup]').forEach(function (b) {
      b.onclick = function () {
        var src = find(b.dataset.dup), d = blankDevis();
        d.client = clone(src.client); d.site = src.site; d.obj = src.obj; d.lines = clone(src.lines); d.tva = src.tva;
        cur = d; saveCur(false); go('devis/' + cur.id);
      };
    });
    $('#devisList').querySelectorAll('[data-send]').forEach(function (b) {
      b.onclick = function () { var d = find(b.dataset.send); if (checkReady(d)) sendDevis(d); };
    });
  }
  $('#listSearch').oninput = renderList;

  /* ---------- Démarrage ---------- */
  PDFDevis.loadLogo('logo.png');
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  if (location.hash && location.hash !== '#home') go('home'); else route();
  window.__app = { totals: Calc.totals, devisList: function () { return devisList; } };
})();
