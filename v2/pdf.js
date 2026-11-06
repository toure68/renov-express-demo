/* Génération du PDF du devis (jsPDF + autotable, inclus dans lib/ : fonctionne hors connexion).
   Mise en page calquée sur l'ancien devis D2026-041. */
(function (g) {
  'use strict';
  var PETROLE = [31, 78, 95], OCRE = [227, 167, 47], GRIS = [242, 242, 242], ANTHRA = [43, 43, 43];
  var logo = null; // { data, w, h }

  function loadLogo(url) {
    return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (ok) {
        var fr = new FileReader();
        fr.onload = function () {
          var img = new Image();
          img.onload = function () { logo = { data: fr.result, w: img.naturalWidth, h: img.naturalHeight }; ok(); };
          img.onerror = ok; img.src = fr.result;
        };
        fr.readAsDataURL(b);
      });
    }).catch(function () {});
  }

  // Police PDF standard (Helvetica non incorporée) : le « ² » n'est pas affiché partout -> « m2 »
  function tx(s) { return String(s == null ? '' : s).replace(/²/g, '2').replace(/³/g, '3'); }
  function m(n) { return Calc.money(n, ' '); }          // espace normal dans le PDF
  function q(n) { return Calc.qty(n, ' '); }
  function fmtDate(d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); }

  function build(dv) {
    var C = COMPANY;
    var doc = new jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, H = 297, L = 15, R = 195, y;
    function color(c) { doc.setTextColor(c[0], c[1], c[2]); }
    color(ANTHRA);

    // --- En-tête : logo en haut à gauche (hauteur 2 cm, cf. charte), numéro à droite
    var top = 12, logoH = 20;
    if (logo) {
      var lw = logoH * logo.w / logo.h; if (lw > 80) { lw = 80; logoH = lw * logo.h / logo.w; }
      doc.addImage(logo.data, 'PNG', L, top, lw, logoH);
    } else {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(20); color(PETROLE); doc.text("Rénov'Express", L, top + 12); color(ANTHRA);
    }
    var d0 = new Date(dv.date + 'T12:00:00'), dEnd = new Date(d0.getTime() + C.validityDays * 864e5);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); color(PETROLE);
    doc.text('DEVIS N° ' + dv.num, R, top + 7, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); color(ANTHRA);
    doc.text('Date : ' + fmtDate(d0), R, top + 15, { align: 'right' });
    doc.text('Validité : ' + C.validityDays + ' jours (jusqu\'au ' + fmtDate(dEnd) + ')', R, top + 20, { align: 'right' });

    // --- Émetteur (gauche) et client (droite)
    y = top + logoH + 10;
    doc.setFontSize(8.5);
    var em = [C.name, C.address + ' – ' + C.city, 'Tél. ' + C.phone + ' – ' + C.email,
      'SIRET ' + C.siret + (C.tvaIntra ? ' – TVA ' + C.tvaIntra : ''), C.rcs].filter(Boolean);
    doc.text(em, L, y, { lineHeightFactor: 1.35 });
    var yEm = y + em.length * 4.2;

    var cl = [dv.client.name].concat(doc.splitTextToSize(dv.client.addr || '', 80));
    if (dv.client.email) cl.push(dv.client.email);
    if (dv.client.tel) cl.push('Tél. ' + dv.client.tel);
    doc.setFontSize(9.5);
    doc.text('Client :', R, y, { align: 'right' });
    doc.text(cl, R, y + 5.5, { align: 'right', lineHeightFactor: 1.35 });
    y = Math.max(yEm, y + 5.5 + cl.length * 4.7) + 7;

    // --- Objet et adresse du chantier
    doc.setFontSize(9.5);
    var site = (dv.site || '').trim() || (dv.client.addr || '').trim();
    if (dv.obj) { doc.setFont('helvetica', 'bold'); var ol = doc.splitTextToSize('Objet : ' + tx(dv.obj), R - L); doc.text(ol, L, y); y += 4.8 * ol.length; }
    if (site) { doc.setFont('helvetica', 'normal'); var sl = doc.splitTextToSize('Adresse du chantier : ' + site.replace(/\s*\n\s*/g, ', '), R - L); doc.text(sl, L, y); y += 4.8 * sl.length; }

    // --- Tableau des prestations + totaux (en bas à droite, TTC sur fond ocre)
    var t = Calc.totals(dv);
    var body = dv.lines.map(function (l) {
      return [tx(l.label), tx(l.unit), q(l.qty), m(Calc.parseNum(l.price) || 0), m(Calc.lineTotalCents(l) / 100)];
    });
    var foot = [['', '', '', 'Total HT', m(t.ht)], ['', '', '', 'TVA ' + dv.tva + ' %', m(t.tva)], ['', '', '', 'Total TTC', m(t.ttc)]];
    doc.autoTable({
      startY: y + 2, margin: { left: L, right: W - R, bottom: 20 },
      head: [['Désignation', 'Unité', 'Qté', 'P.U. HT', 'Total HT']],
      body: body, foot: foot, showFoot: 'lastPage', theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: ANTHRA, lineColor: [60, 60, 60], lineWidth: 0.15, valign: 'top' },
      headStyles: { fillColor: PETROLE, textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [255, 255, 255], textColor: ANTHRA, fontStyle: 'bold', halign: 'right' },
      alternateRowStyles: { fillColor: GRIS },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 22 }, 2: { cellWidth: 16, halign: 'right' }, 3: { cellWidth: 27, halign: 'right' }, 4: { cellWidth: 29, halign: 'right' } },
      didParseCell: function (h) {
        if (h.section === 'head' && h.column.index >= 2) h.cell.styles.halign = 'right';
        if (h.section === 'foot') {
          if (h.column.index < 3) { h.cell.styles.lineWidth = 0; }
          if (h.row.index === 2 && h.column.index === 4) h.cell.styles.fillColor = OCRE;
        }
      }
    });
    y = doc.lastAutoTable.finalY + 8;

    // --- Mentions
    var cond = [
      'Conditions : un acompte de ' + C.depositRate + ' % (' + m(t.acompte) + ' TTC) est versé à la signature ; toutefois, si le devis est signé hors établissement, '
        + 'l\'acompte ne peut être versé qu\'à l\'expiration d\'un délai de sept jours à compter de la signature. Solde à la fin des travaux. ' + (C.payment || ''),
      'Droit de rétractation : si le devis est signé hors établissement (par exemple au domicile du client), le client dispose d\'un délai de quatorze jours '
        + 'à compter de la signature pour se rétracter, sans avoir à justifier de motif, au moyen du formulaire de rétractation joint en dernière page ou de toute autre déclaration dénuée d\'ambiguïté.',
      'Devis valable ' + C.validityDays + ' jours à compter de sa date d\'émission.',
      'Assurance décennale : ' + C.insurer + ', contrat n° ' + C.insurerPolicy + ', couverture ' + C.insurerZone + '.',
      'Médiateur de la consommation : ' + C.mediator
    ];
    var tva10 = +dv.tva === 10;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    var condLines = cond.map(function (c) { return doc.splitTextToSize(c, R - L); });
    var need = condLines.reduce(function (a, s) { return a + s.length * 4 + 1.5; }, 0);
    if (y + need > H - 18) { doc.addPage(); y = 20; }
    color(ANTHRA);
    condLines.forEach(function (s) { doc.text(s, L, y); y += s.length * 4 + 1.5; });
    y += 4;

    // --- Bon pour accord (+ certification TVA à taux réduit si 10 %) : bloc gardé d'un seul tenant
    if (y + (tva10 ? 23 : 0) + 36 > H - 16) { doc.addPage(); y = 20; }
    if (tva10) {
      doc.setDrawColor(OCRE[0], OCRE[1], OCRE[2]); doc.setLineWidth(0.6); doc.rect(L, y, R - L, 19);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(PETROLE);
      doc.text('Certification du client pour le taux réduit de TVA', L + 3, y + 5.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(ANTHRA);
      doc.text(doc.splitTextToSize('[Mention de certification TVA à taux réduit - texte à valider par le comptable]', R - L - 6), L + 3, y + 11);
      y += 23;
    }
    doc.setDrawColor(PETROLE[0], PETROLE[1], PETROLE[2]); doc.setLineWidth(0.4); doc.rect(L, y, R - L, 36);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); color(PETROLE);
    doc.text('Bon pour accord', L + 3, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(ANTHRA);
    if (dv.signature && dv.signature.data) {
      var signed = new Date(dv.signature.signedAt);
      doc.text('Signé le ' + fmtDate(signed) + ' à ' + String(signed.getHours()).padStart(2, '0') + ':' + String(signed.getMinutes()).padStart(2, '0'), L + 3, y + 14);
      doc.setFontSize(8.5);
      doc.text(doc.splitTextToSize('Client : ' + tx(dv.signature.name || dv.client.name), 75).slice(0, 3), L + 3, y + 21);
      doc.addImage(dv.signature.data, 'PNG', L + 95, y + 7, 75, 24);
    } else {
      doc.text('Date : ____ / ____ / ________', L + 3, y + 14);
      doc.text('Signature du client, précédée de la mention manuscrite « Bon pour accord » :', L + 3, y + 21);
    }

    // --- Dernière page : formulaire type de rétractation (annexe à l'article R. 221-1 du Code de la consommation)
    doc.addPage(); y = 25;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); color(PETROLE);
    doc.text('Formulaire de rétractation', L, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 110, 110);
    doc.text('Modèle de formulaire de rétractation (annexe à l\'article R. 221-1 du Code de la consommation) – Devis ' + dv.num, L, y); y += 4;
    doc.setDrawColor(PETROLE[0], PETROLE[1], PETROLE[2]); doc.setLineWidth(0.4); doc.line(L, y, R, y); y += 9;
    color(ANTHRA); doc.setFontSize(10);
    function para(s, bold, gap) {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      var ls = doc.splitTextToSize(s, R - L); doc.text(ls, L, y); y += ls.length * 5 + (gap == null ? 4 : gap);
    }
    para('(Veuillez compléter et renvoyer le présent formulaire uniquement si vous souhaitez vous rétracter du contrat.)', false, 6);
    para('À l\'attention de ' + C.name + ', ' + C.address + ', ' + C.city + ', adresse électronique : ' + C.email + ' :', true, 6);
    para('Je/nous (*) vous notifie/notifions (*) par la présente ma/notre (*) rétractation du contrat portant sur la vente du bien (*)/pour la prestation de services (*) ci-dessous :', false, 3);
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.2);
    for (var k = 0; k < 3; k++) { y += 6; doc.line(L, y, R, y); }
    y += 11;
    [['Commandé le (*)/reçu le (*) : ', 1], ['Nom du (des) consommateur(s) : ', 1], ['Adresse du (des) consommateur(s) : ', 2],
     ['Signature du (des) consommateur(s) (uniquement en cas de notification du présent formulaire sur papier) :', 0], ['Date : ', 1]].forEach(function (f) {
      doc.setFont('helvetica', 'normal'); var ls = doc.splitTextToSize(f[0], R - L); doc.text(ls, L, y);
      var w = doc.getTextWidth(ls[ls.length - 1]);
      if (f[1]) { doc.line(L + w + 1, y + 0.8, R, y + 0.8); for (var j = 1; j < f[1]; j++) doc.line(L, y + 0.8 + 8 * j, R, y + 0.8 + 8 * j); y += 8 * f[1] + 6; }
      else { y += ls.length * 5 + 3; doc.rect(L, y, 80, 28); y += 38; }
    });
    doc.setFontSize(9); doc.text('(*) Rayez la mention inutile.', L, y);

    // --- Pied de page
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120);
      doc.text(C.name + ' – ' + C.address + ', ' + C.city + ' – SIRET ' + C.siret, L, H - 10);
      doc.text('Devis ' + dv.num + ' – page ' + p + '/' + n, R, H - 10, { align: 'right' });
    }
    return doc;
  }

  g.PDFDevis = { build: build, loadLogo: loadLogo };
})(this);
