/* Facturation et encaissements hors ligne.
 * Les documents sont des factures classiques : vérifier la configuration légale
 * de l'entreprise et les obligations comptables avant une utilisation réelle.
 */
(function(root){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const cents=n=>Math.round(Number(n)*100);
 const round=n=>Math.round(n*100)/100;
 function issuerProblems(c){
  if(!c)return ['coordonnées de l’entreprise'];
  const problems=[];
  for(const [field,label] of [['name','raison sociale'],['address','adresse'],['city','ville']]){
   if(!String(c[field]||'').trim()||/fictif|exemple/i.test(String(c[field])))problems.push(label);
  }
  const siret=String(c.siret||'').replace(/\s/g,'');
  if(!/^\d{14}$/.test(siret)||/^0{14}$/.test(siret))problems.push('SIRET réel (14 chiffres)');
  if(/fictif|exemple/i.test(String(c.email||'')))problems.push('adresse e-mail professionnelle');
  if(/fictif|exemple/i.test(String(c.insurer||'')))problems.push('nom de l’assureur');
  return problems;
 }
 function isValidIssuer(c){return issuerProblems(c).length===0;}
 function nextNumber(list,year,demo=false){
  const yy=String(year),prefix=demo?'DEMO-F':'F';
  const ids=list.map(d=>d.invoice&&d.invoice.num).filter(Boolean);
  const n=ids.reduce((max,id)=>{const m=new RegExp('^'+prefix+yy+'-(\\d+)$').exec(id);return m?Math.max(max,Number(m[1])):max;},0);
  return prefix+yy+'-'+String(n+1).padStart(3,'0');
 }
 function issue(d,list,issuer,when=new Date()){
  if(!d)throw Error('Devis introuvable');
  if(!d.demo&&!isValidIssuer(issuer))throw Error('Informations professionnelles à compléter : '+issuerProblems(issuer).join(', '));
  if(d.invoice)throw Error('Une facture existe déjà pour ce devis');
  if(!['signed','deposit'].includes(d.status))throw Error('Un accord client est requis avant facturation');
  if(!d.client||!String(d.client.name||'').trim()||!Array.isArray(d.lines)||!d.lines.length)throw Error('Devis incomplet');
  if(d.lines.some(l=>!String(l.label||'').trim()||!(Number(l.qty)>0)||l.price===null||!(Number(l.price)>=0)))throw Error('Prestations incomplètes');
  const totals=Calc.totals(d),issuedAt=when.toISOString(),year=when.getFullYear();
  const due=new Date(when.getTime());due.setDate(due.getDate()+30);
  const doc=clone(d);
  doc.invoice={num:nextNumber(list,year,!!d.demo),issuedAt,dueDate:due.toISOString().slice(0,10),issuer:clone(issuer),client:clone(d.client),obj:d.obj,site:d.site,lines:clone(d.lines),tva:d.tva,quoteNumber:d.num,totals:clone(totals),demo:!!d.demo};
  doc.payments=Array.isArray(d.payments)?clone(d.payments):[];
  // Acompte déjà confirmé : crédit enregistré une seule fois à l'émission.
  if(d.status==='deposit'&&!doc.payments.some(p=>p.kind==='deposit')){
   const expected=round(Math.max(0,Math.min(totals.ttc,totals.acompte)));
   const remaining=round(Math.max(0,expected-paid(doc)));
   if(remaining>0){
    const sourceDate=d.depositAt||issuedAt;
    const validDate=Number.isFinite(new Date(sourceDate).getTime())?new Date(sourceDate).toISOString().slice(0,10):issuedAt.slice(0,10);
    doc.payments.push({amount:remaining,date:validDate,method:'Acompte encaissé',kind:'deposit',createdAt:issuedAt});
   }
  }
  doc.invoicedAt=issuedAt;
  doc.status='invoiced';
  return doc;
 }
 function paid(d){return round((Array.isArray(d.payments)?d.payments:[]).reduce((a,p)=>a+Number(p.amount||0),0));}
 function balance(d){const amount=d.invoice?d.invoice.totals.ttc:Calc.totals(d).ttc;return Math.max(0,round(amount-paid(d)));}
 function recordDeposit(d,amount,date,method){
  if(!d||!['signed','deposit'].includes(d.status)||d.invoice)throw Error('Le devis doit être signé et non facturé');
  const n=Calc.parseNum(amount),ttc=Calc.totals(d).ttc;
  if(n===null||!Number.isFinite(n)||n<=0||!Number.isFinite(ttc)||ttc<=0)throw Error('Saisissez un montant d’acompte valide');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||!Number.isFinite(new Date(date+'T12:00:00').getTime())||new Date(date+'T12:00:00').toISOString().slice(0,10)!==date)throw Error('Date de réception incorrecte');
  const previous=paid(d);
  if(cents(previous+n)>cents(ttc))throw Error('Le total encaissé dépasse le montant TTC du devis');
  const copy=clone(d),when=new Date().toISOString();
  copy.payments=Array.isArray(copy.payments)?copy.payments:[];
  copy.payments.push({amount:round(n),date,method:String(method||'Autre').slice(0,60),kind:'deposit',createdAt:when});
  copy.status='deposit';
  if(!copy.depositAt)copy.depositAt=when;
  return copy;
 }
 function addPayment(d,amount,date,method){
  if(!d||!d.invoice)throw Error('Aucune facture émise');
  const n=Number(String(amount).replace(',','.'));
  if(!Number.isFinite(n)||n<=0)throw Error('Montant incorrect');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date||''))||Number.isNaN(new Date(date+'T12:00:00').getTime())||new Date(date+'T12:00:00').toISOString().slice(0,10)!==date)throw Error('Date de règlement incorrecte');
  if(cents(n)>cents(balance(d)))throw Error('Le montant dépasse le solde restant');
  const doc=clone(d);doc.payments=doc.payments||[];
  doc.payments.push({amount:round(n),date,method:String(method||'Autre').slice(0,60),createdAt:new Date().toISOString()});
  return doc;
 }
 function buildPDF(d){
  if(!d||!d.invoice)throw Error('Facture introuvable');
  if(typeof jspdf==='undefined'||!jspdf.jsPDF)throw Error('Bibliothèque PDF indisponible');
  const i=d.invoice,c=i.issuer,t=i.totals,money=n=>Calc.money(n,' '),pdf=new jspdf.jsPDF({unit:'mm',format:'a4'});
  if(i.demo){pdf.setTextColor(170,55,55);pdf.setFont('helvetica','bold');pdf.setFontSize(10);pdf.text('SIMULATION — DOCUMENT FICTIF, NON VALABLE',15,10);}
  const mm=180;let y=18;
  const text=(s,x,yy)=>pdf.text(String(s||''),x,yy);
  pdf.setTextColor(31,78,95);pdf.setFont('helvetica','bold');pdf.setFontSize(19);
  text(c.name,15,y);text('FACTURE',152,y);y+=10;
  pdf.setTextColor(45,45,45);pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
  const issuerLines=[c.address,c.city,'SIRET : '+c.siret,c.tvaIntra?'TVA : '+c.tvaIntra:'',c.rcs||'',c.email||'',c.phone||''].filter(Boolean);
  issuerLines.forEach(v=>{text(v,15,y);y+=5;});
  y+=7;pdf.setFont('helvetica','bold');pdf.setFontSize(11);text('N° '+i.num,15,y);y+=6;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9.5);
  const frdate=x=>new Date(x).toLocaleDateString('fr-FR');
  text('Émise le : '+frdate(i.issuedAt),15,y);y+=5;
  text('Échéance : '+frdate(i.dueDate+'T12:00:00'),15,y);y+=5;
  text('Devis d’origine : '+(i.quoteNumber||''),15,y);y+=9;
  pdf.setFont('helvetica','bold');text('Facturé à :',15,y);y+=5;
  pdf.setFont('helvetica','normal');
  [i.client.name,i.client.addr||'',i.client.email||'',i.client.tel||''].filter(Boolean).forEach(v=>{const lines=pdf.splitTextToSize(String(v),mm);pdf.text(lines,15,y);y+=lines.length*5;});
  y+=4;if(i.obj){pdf.setFont('helvetica','bold');pdf.text(pdf.splitTextToSize('Objet : '+i.obj,mm),15,y);y+=9;}
  if(i.site){pdf.setFont('helvetica','normal');pdf.text(pdf.splitTextToSize('Chantier : '+i.site,mm),15,y);y+=9;}
  pdf.autoTable({startY:y,margin:{left:15,right:15,bottom:28},head:[['Prestation','Qté','Unité','P.U. HT','Total HT']],
   body:i.lines.map(l=>[String(l.label||'').replace(/²/g,'2'),String(l.qty),String(l.unit||''),money(l.price),money(Calc.lineTotalCents(l)/100)]),
   theme:'grid',styles:{font:'helvetica',fontSize:9},headStyles:{fillColor:[31,78,95]},columnStyles:{1:{halign:'right'},3:{halign:'right'},4:{halign:'right'}}});
  y=pdf.lastAutoTable.finalY+9;
  if(y>235){pdf.addPage();y=20;}
  pdf.setFont('helvetica','bold');pdf.setFontSize(10);
  text('Total HT : '+money(t.ht),105,y);y+=6;
  text('TVA '+i.tva+' % : '+money(t.tva),105,y);y+=6;
  text('TOTAL TTC : '+money(t.ttc),105,y);y+=6;
  if(paid(d)>0){text('Déjà encaissé : '+money(paid(d)),105,y);y+=6;text('RESTE À PAYER : '+money(balance(d)),105,y);y+=8;}
  else y+=4;
  pdf.setFont('helvetica','normal');pdf.setFontSize(9);
  const terms=['Paiement : '+(c.payment||'Selon accord contractuel.'),'Échéance : '+frdate(i.dueDate+'T12:00:00')];
  terms.forEach(v=>{const lines=pdf.splitTextToSize(v,mm);if(y+lines.length*5>268){pdf.addPage();y=20;}pdf.text(lines,15,y);y+=lines.length*5+2;});
  if(Array.isArray(d.payments)&&d.payments.length){y+=3;if(y>258){pdf.addPage();y=20;}pdf.setFont('helvetica','bold');text('Règlements enregistrés : '+money(paid(d)),15,y);y+=6;text('Reste dû : '+money(balance(d)),15,y);}
  const count=pdf.getNumberOfPages();
  for(let page=1;page<=count;page++){pdf.setPage(page);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(110,110,110);
   text(c.name+' · SIRET '+c.siret,15,286);pdf.text('Facture '+i.num+' · '+page+'/'+count,195,286,{align:'right'});}
  return pdf;
 }
 const api={issuerProblems,isValidIssuer,nextNumber,issue,paid,balance,recordDeposit,addPayment,buildPDF};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.InvoiceLogic=api;
})(typeof window!=='undefined'?window:this);
