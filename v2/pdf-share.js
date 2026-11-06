/* PDFShare — partage d'un fichier PDF déjà préparé, compatible Web Share API.
 * Utilisation :
 *   var p = PDFShare.prepare(pdfBlob, 'Devis_D2026-042_RenovExpress.pdf');
 *   // Au clic utilisateur, sans await ni génération PDF avant cet appel :
 *   PDFShare.send(p);
 * Le partage iOS ouvre la feuille native : l'utilisateur choisit WhatsApp.
 * Aucune URL blob: n'est jamais transmise à navigator.share.
 */
(function (root) {
  'use strict';
  function prepare(blob, filename) {
    if (!(blob instanceof Blob)) throw new TypeError('Un Blob PDF est requis.');
    if (!filename || !/\.pdf$/i.test(filename)) throw new TypeError('Nom de fichier PDF requis.');
    var pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
    return { blob: pdfBlob, name: filename,
      file: new File([pdfBlob], filename, { type: 'application/pdf' }) };
  }
  function download(prepared) {
    var url = URL.createObjectURL(prepared.blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = prepared.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  function send(prepared, onFallback) {
    var fallback = typeof onFallback === 'function' ? onFallback : download;
    if (!prepared || !prepared.file) throw new TypeError('Préparer le PDF avant le clic.');
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [prepared.file] })) {
      try {
        // Ni text, ni title, ni url : seulement le fichier.
        return navigator.share({ files: [prepared.file] }).catch(function (err) {
          if (!err || err.name !== 'AbortError') fallback(prepared);
        });
      } catch (err) { fallback(prepared); }
    } else {
      fallback(prepared);
    }
  }
  root.PDFShare = { prepare: prepare, send: send, download: download };
})(typeof window !== 'undefined' ? window : this);
