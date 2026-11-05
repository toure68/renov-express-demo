// Test des calculs avec l'ancien devis D2026-041 : node tests/test_calculs.js
var Calc = require('../calc.js');
var d = { tva: 10, lines: [
  { label: 'Protection', qty: 1, price: 120 }, { label: 'Lessivage', qty: 142, price: 3.5 },
  { label: 'Rebouchage', qty: 142, price: 6 }, { label: 'Plafonds', qty: 38, price: 19 },
  { label: 'Murs', qty: 104, price: 22 }, { label: 'Portes', qty: 5, price: 85 }, { label: 'Nettoyage', qty: 1, price: 90 } ] };
var t = Calc.totals(d), ok = true;
function eq(name, got, exp) { var g = Calc.money(got, ' '); var pass = g === exp; ok = ok && pass; console.log((pass ? 'OK  ' : 'ERR ') + name + ' : ' + g + (pass ? '' : '  (attendu ' + exp + ')')); }
eq('Total HT ', t.ht, '4 994,00 €'); eq('TVA 10 % ', t.tva, '499,40 €'); eq('Total TTC', t.ttc, '5 493,40 €');
d.tva = 20; t = Calc.totals(d); eq('TVA 20 % ', t.tva, '998,80 €'); eq('TTC 20 % ', t.ttc, '5 992,80 €');
// arrondis et format
eq('Arrondi  ', Calc.lineTotalCents({ qty: 12.35, price: 3.33 }) / 100, '41,13 €');
eq('Virgule  ', Calc.totals({ tva: 20, lines: [{ qty: Calc.parseNum('12,5'), price: Calc.parseNum('6,5') }] }).ttc, '97,50 €');
eq('Millions ', 1234567.891, '1 234 567,89 €');
console.log(ok ? '\nTous les tests passent.' : '\nÉCHEC'); process.exit(ok ? 0 : 1);
