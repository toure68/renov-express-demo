/* Parcours unique des dossiers, calculé localement selon leur état réel.
 * Aucun historique de statuts affiché comme une barre de boutons.
 */
(function(root){
 'use strict';
 const STAGES=['draft','ready','sent','signed','deposit','invoiced'];
 const TITLES={draft:'À compléter',ready:'Prêt',sent:'Envoyé',signed:'Signé',deposit:'Acompte reçu',invoiced:'Facturé'};
 function describe(d,flow,{signature=true,invoicing=true,shared=false,balance=null}={}){
  const real=flow.etatDossier(d);
  const state=real==='late'?'sent':real;
  const index=Math.max(0,STAGES.indexOf(state));
  const isLegacy=state==='invoiced'&&!d.invoice;
  const overdue=!!(flow.invoiceOverdue&&flow.invoiceOverdue(d));
  const label=overdue?'Paiement en retard':real==='late'?'À relancer':isLegacy?'Ancien suivi facturé':TITLES[state]||'À compléter';
  let action='document',text='Voir le devis';
  if(real==='draft'){action='edit';text='Compléter le devis';}
  else if(real==='ready'){action=shared?'confirmSent':'send';text=shared?'Confirmer l’envoi':'Envoyer le devis';}
  else if(real==='late'){action='contact';text='Relancer le client';}
  else if(real==='sent'){action=signature?'sign':'document';text=signature?'Faire signer le devis':'Voir le devis';}
  else if(real==='signed'){action='contact';text='Demander l’acompte';}
  else if(real==='deposit'){action=invoicing?'issueInvoice':'document';text=invoicing?'Émettre la facture':'Voir le devis';}
  else if(real==='invoiced'&&d.invoice){action=balance!==null&&balance>0?'payment':'downloadInvoice';text=action==='payment'?'Enregistrer un règlement':'Télécharger la facture';}
  return {state,real,label,index,count:STAGES.length,percent:Math.round((index+1)/STAGES.length*100),action,text,warning:real==='late'||overdue,legacy:isLegacy};
 }
 const api={STAGES,TITLES,describe};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.ContextFlow=api;
})(typeof window!=='undefined'?window:this);
