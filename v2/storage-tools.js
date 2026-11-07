/* Sauvegarde/installation offline. Zéro API externe. */
(function(root){
 'use strict';
 const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const safeText=x=>typeof x==='string'&&x.length<=20000;
 const safeAmount=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1000000000;
 function validate(obj){
  if(!obj||obj.format!=='renov-express-v2-backup'||obj.version!==1)throw Error('Format de sauvegarde non reconnu');
  if(!Array.isArray(obj.devis)||!Array.isArray(obj.tarifs))throw Error('Listes de devis ou tarifs manquantes');
  if(obj.devis.length>50000||obj.tarifs.length>50000)throw Error('Sauvegarde trop volumineuse');
  const ids=new Set(),invoiceNumbers=new Set();
  for(const d of obj.devis){
   if(!d||typeof d!=='object'||typeof d.id!=='string'||!d.id||ids.has(d.id)||!d.client||typeof d.client!=='object'||!Array.isArray(d.lines)||typeof d.status!=='string')throw Error('Un devis de la sauvegarde est invalide ou dupliqué');
   if(d.id.length>160||!['draft','ready','sent','late','signed','deposit','invoiced'].includes(d.status))throw Error('Identifiant ou statut de devis invalide');
   if(!safeText(d.client.name||'')||!safeText(d.obj||'')||!safeText(d.num||''))throw Error('Informations client ou devis invalides');
   if(d.lines.length>2000||d.lines.some(l=>!isObject(l)||!safeText(l.label||'')||!safeText(l.unit||'')))throw Error('Prestations invalides');
   if(d.signature){
    if(!isObject(d.signature)||typeof d.signature.data!=='string'||d.signature.data.length>10000000||
       !/^data:image\/png;base64,[a-z\d+/=]+$/i.test(d.signature.data))throw Error('Signature de sauvegarde invalide');
   }
   if(d.payments){
    if(!Array.isArray(d.payments)||d.payments.length>1000||d.payments.some(p=>!isObject(p)||!safeAmount(p.amount)||!safeText(p.method||'')))throw Error('Règlements invalides');
   }
   if(d.invoice){
    if(!isObject(d.invoice)||typeof d.invoice.num!=='string'||!/^(?:DEMO-)?F\d{4}-\d{3,}$/.test(d.invoice.num)||invoiceNumbers.has(d.invoice.num))throw Error('Numéro de facture invalide ou dupliqué dans la sauvegarde');
    if(!isObject(d.invoice.totals)||!safeAmount(d.invoice.totals.ttc)||!isObject(d.invoice.client)||!isObject(d.invoice.issuer)||!Array.isArray(d.invoice.lines))throw Error('Données de facture invalides');
    invoiceNumbers.add(d.invoice.num);
   }
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
