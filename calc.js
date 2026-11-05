/* Calculs du devis — tout en centimes entiers pour éviter les erreurs d'arrondi */
(function (g) {
  function toCents(n) { return Math.round((Number(n) || 0) * 100); }

  // "1 234,5" -> 1234.5 ; "" -> null
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).replace(/[\s  €]/g, '').replace(',', '.');
    if (s === '') return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  // Total d'une ligne arrondi au centime
  function lineTotalCents(line) {
    var q = parseNum(line.qty) || 0, pu = parseNum(line.price) || 0;
    return Math.round(q * pu * 100);
  }

  function totals(devis) {
    var ht = 0;
    (devis.lines || []).forEach(function (l) { ht += lineTotalCents(l); });
    var rate = Number(devis.tva) || 0;
    var tva = Math.round(ht * rate / 100);
    var ttc = ht + tva;
    var acompte = Math.round(ttc * 0.30);
    return { ht: ht / 100, tva: tva / 100, ttc: ttc / 100, acompte: acompte / 100 };
  }

  // Format français : 1 234,56 €  (sep = espace insécable par défaut)
  function money(n, sep) {
    sep = sep === undefined ? ' ' : sep;
    var c = Math.round((Number(n) || 0) * 100);
    var neg = c < 0; c = Math.abs(c);
    var ent = String(Math.floor(c / 100)), dec = String(c % 100).padStart(2, '0');
    ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return (neg ? '-' : '') + ent + ',' + dec + sep + '€';
  }

  // Quantité : 12,5 (sans zéros inutiles)
  function qty(n, sep) {
    var v = parseNum(n); if (v === null) return '';
    var s = (Math.round(v * 100) / 100).toString().split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep === undefined ? ' ' : sep);
    return s.join(',');
  }

  var api = { parseNum: parseNum, lineTotalCents: lineTotalCents, totals: totals, money: money, qty: qty, toCents: toCents };
  if (typeof module !== 'undefined') module.exports = api; else g.Calc = api;
})(this);
