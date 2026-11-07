/* Sauvegarde/installation offline. Zéro API externe. */
(function(root){
 'use strict';
 const KINDS=['devis','tarifs'];
 function validate(obj){
  if(!obj||obj.format!=='renov-express-v2-backup'||obj.version!==1)throw Error('Format de sauvegarde non reconnu');
  if(!Array.isArray(obj.devis)||!Array.isArray(obj.tarifs))throw Error('Listes de devis ou tarifs manquantes');
  if(obj.devis.length>50000||obj.tarifs.length>50000)throw Error('Sauvegarde trop volumineuse');
  const ids=new Set(),invoiceNumbers=new Set();
  for(const d of obj.devis){
   if(!d||typeof d!=='object'||typeof d.id!=='string'||!d.id||ids.has(d.id)||!d.client||typeof d.client!=='object'||!Array.isArray(d.lines)||typeof d.status!=='string')throw Error('Un devis de la sauvegarde est invalide ou dupliqué');
   if(d.lines.length>2000)throw Error('Devis avec trop de prestations');
   if(d.invoice){if(typeof d.invoice.num!=='string'||!/^(?:DEMO-)?F\d{4}-\d{3,}$/.test(d.invoice.num)||invoiceNumbers.has(d.invoice.num))throw Error('Numéro de facture invalide ou dupliqué dans la sauvegarde');invoiceNumbers.add(d.invoice.num);}
   ids.add(d.id);
  }
  for(const t of obj.tarifs){if(!t||typeof t.label!=='string'||typeof t.unit!=='string')throw Error('Un tarif est invalide');}
  if(obj.company!==undefined&&(typeof obj.company!=='object'||obj.company===null||Array.isArray(obj.company)))throw Error('Informations entreprise invalides');
  return true;
 }
 function merge(current,backup){
  validate(backup);
  const byId=new Map(current.map(d=>[d.id,d]));
  const usedInvoices=new Map(current.filter(d=>d.invoice&&d.invoice.num).map(d=>[d.invoice.num,d.id]));
  for(const d of backup.devis){if(byId.has(d.id))continue;if(d.invoice&&usedInvoices.has(d.invoice.num))throw Error('Numéro de facture '+d.invoice.num+' déjà présent sur cet appareil');if(d.invoice)usedInvoices.set(d.invoice.num,d.id);byId.set(d.id,d);}
  return Array.from(byId.values());
 }
 const api={validate,merge};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.StorageTools=api;
})(typeof window!=='undefined'?window:this);
