/* Local quote workflow. No network or storage dependency. */
(function(g){
'use strict';
const RANG={late:0,ready:1,draft:2,signed:3,sent:4,deposit:5,invoiced:6};
const ETAPES=[['draft','Brouillon'],['ready','Prêt'],['sent','Envoyé'],['signed','Signé'],['deposit','Acompte reçu'],['invoiced','Facturé']];
function missing(d){
 const m=[];if(!(d.client.name||'').trim())m.push('nom du client');
 if((d.client.email||'').trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.client.email.trim()))m.push('email du client valide');
 if(!d.lines.length)m.push('prestation');
 d.lines.forEach((l,i)=>{if(!(l.label||'').trim())m.push('désignation de la ligne '+(i+1));if(Calc.parseNum(l.price)===null||Calc.parseNum(l.price)<0)m.push('prix de la ligne '+(i+1));if(!(Calc.parseNum(l.qty)>0))m.push('quantité de la ligne '+(i+1));});
 return m;
}
function days(d,now=Date.now()){return Math.max(0,Math.floor((now-new Date(d.sentAt||d.date+'T12:00:00').getTime())/864e5));}
function etatDossier(d,now=Date.now()){
 if(d.status==='invoiced')return'invoiced';if(d.status==='deposit')return'deposit';if(d.status==='signed')return'signed';
 if(d.status==='sent'||d.status==='late')return days(d,now)>=5?'late':'sent';
 return missing(d).length?'draft':'ready';
}
function invoiceOverdue(d,now=Date.now()){
 if(!d.invoice||!d.invoice.dueDate||d.status!=='invoiced')return false;
 const due=new Date(d.invoice.dueDate+'T23:59:59').getTime();
 if(!Number.isFinite(due)||now<=due)return false;
 const payments=Array.isArray(d.payments)?d.payments:[];
 const paid=payments.reduce((sum,p)=>sum+(Number(p.amount)||0),0);
 return paid+0.005<(Number(d.invoice.totals&&d.invoice.totals.ttc)||0);
}
function ordre(a,b,now=Date.now()){
 const overdue=Number(invoiceOverdue(b,now))-Number(invoiceOverdue(a,now));
 if(overdue)return overdue;
 const diff=RANG[etatDossier(a,now)]-RANG[etatDossier(b,now)];
 return diff||(etatDossier(a,now)==='late'?new Date(a.sentAt)-new Date(b.sentAt):0)||(a.createdAt||'').localeCompare(b.createdAt||'');
}
function prioritaire(list,now=Date.now()){return list.slice().sort((a,b)=>ordre(a,b,now)).find(d=>invoiceOverdue(d,now)||['late','ready','draft','signed','deposit'].includes(etatDossier(d,now)))||null;}
function heroInfo(d,now=Date.now()){
 const st=etatDossier(d,now);
 if(invoiceOverdue(d,now))return{tag:'À faire maintenant',txt:'Une facture a dépassé son échéance et reste à encaisser.',cta:'Enregistrer un règlement',action:'payment'};
 if(st==='late')return{tag:'À faire maintenant',txt:`${d.client.name} n’a pas répondu depuis ${days(d,now)} jours.`,cta:'Relancer',action:'relance'};
 if(st==='ready')return{tag:'À faire maintenant',txt:'Devis prêt. Il ne reste qu’à l’envoyer.',cta:'Envoyer le devis',action:'send'};
 if(st==='draft'){const m=missing(d);return{tag:'À faire maintenant',txt:`Il manque : ${m.join(', ')}.${m.length===1?' Tout le reste est prêt.':''}`,cta:'Compléter',action:'edit'};}
 if(st==='signed')return{tag:'À faire maintenant',txt:'Devis signé. Demandez l’acompte de 30 %.',cta:'Demander l’acompte',action:'deposit'};
 if(st==='deposit')return{tag:'À faire maintenant',txt:'Acompte reçu. La facture peut être émise.',cta:'Émettre la facture',action:'issueInvoice'};
 return{tag:'Mes devis',txt:'Aucune action urgente.',cta:'Voir le devis',action:'document'};
}
function relanceMessage(d){const c=d.client,who=c.title&&c.lastName?c.title+' '+c.lastName:c.name;return `Bonjour ${who}, avez-vous pu consulter notre devis ${d.num} ? Je reste disponible pour toute question.`;}
function totalsSummary(list,now=new Date()){
 const pending=list.filter(d=>['sent','late'].includes(etatDossier(d,+now))).length;
 const signed=list.filter(d=>['signed','deposit','invoiced'].includes(etatDossier(d,+now))&&d.signedAt&&new Date(d.signedAt).getMonth()===now.getMonth()&&new Date(d.signedAt).getFullYear()===now.getFullYear()).length;
 return`${pending} devis en attente · ${signed} signé${signed>1?'s':''} ce mois-ci`;
}
function documentKind(d){return d.invoice?'invoices':'quotes';}
function historyDocuments(list,group){return group==='quotes'||group==='invoices'?list.filter(d=>documentKind(d)===group):list.slice();}
function needsAttention(d){return documentKind(d)==='quotes'||invoiceOverdue(d);}
const api={documentKind,historyDocuments,needsAttention,invoiceOverdue,RANG,ETAPES,missing,days,etatDossier,ordre,prioritaire,heroInfo,relanceMessage,totalsSummary};
if(typeof module!=='undefined')module.exports=api;else g.QuoteFlow=api;
})(this);
