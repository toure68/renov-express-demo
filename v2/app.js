/* Rénov’Express — AutoDroits visual components, local quote engine. */
(function(){
'use strict';
const $=s=>document.querySelector(s),F=QuoteFlow,K={devis:'re_v2_devis',tarifs:'re_v2_tarifs',counter:'re_v2_counter_',demo:'re_v2_demo'};
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const localISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const displayDate=x=>new Date(x.length===10?x+'T12:00:00':x).toLocaleDateString('fr-FR');
const displayTime=x=>new Date(x).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
function load(k,fallback){try{const raw=localStorage.getItem(k);return raw===null?fallback:JSON.parse(raw);}catch(e){return fallback;}}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch(e){toast('Enregistrement impossible : mémoire du navigateur indisponible ou pleine.');return false;}}
function demonstration(){
 const now=Date.now(),ago=n=>new Date(now-n*864e5).toISOString();
 function make(id,num,name,obj,price,tva,status,days,title,lastName){
  const createdAt=ago(8);return{id,num,date:localISO(new Date(createdAt)),client:{name,addr:'Adresse fictive · Lyon',email:name.toLowerCase().replace(/ /g,'.')+'@example.com',tel:'',title,lastName},site:'',obj,lines:[{code:'',label:obj,qty:1,unit:'forfait',price}],tva,status,demo:true,createdAt,updated:now-days*864e5,...(['sent','late'].includes(status)?{sentAt:ago(days)}:{}),...(status==='signed'?{signedAt:ago(days)}:{})};
 }
 const docs=[make('demo-claire','D2026-042','Claire Dubois','Rénovation séjour et chambre',2807,10,'sent',6,'Madame','Dubois'),make('demo-paul','D2026-043','Paul Martin','Peinture cuisine',1033.33,20,'draft',0,'Monsieur','Martin'),make('demo-sophie','D2026-044','Sophie Bernard','Plafonds et boiseries',2066.67,20,'signed',2,'Madame','Bernard'),make('demo-karim','D2026-045','Karim Benali','Peinture du séjour',500,10,'draft',0,'Monsieur','Benali'),make('demo-julie','D2026-046','Julie Moreau','Couloir et entrée',809.09,10,'sent',1,'Madame','Moreau')];
 docs[3].client.email='';return docs;
}
let D=load(K.devis,null);if(!Array.isArray(D)){D=load(K.demo,'on')==='off'?[]:demonstration();store(K.devis,D);}
const demoActive=()=>D.some(d=>d.demo);
const companyFields=['name','activity','address','city','phone','email','siret','tvaIntra','rcs','insurer','insurerPolicy','insurerZone','mediator','payment','validityDays','depositRate'];
const companySaved=load('re_v2_company',null);if(companySaved&&typeof companySaved==='object')companyFields.forEach(k=>{if(Object.prototype.hasOwnProperty.call(companySaved,k))COMPANY[k]=companySaved[k];});
let tarifs=load(K.tarifs,null);if(!Array.isArray(tarifs)){tarifs=clone(DEFAULT_TARIFS);store(K.tarifs,tarifs);}
let pendingInvoiceId=null;
let cur=null,saveTimer,EXPLORER=false,HEROD=null,toastTimer,focusBefore=null,routeKind='',routeId='',lastState='',scrollLast=false,GLOBAL_QUERY='',GLOBAL_STATUS='all';
const prepared=new Map(),downloaded=new Set(),sheet=$('#sheet'),body=$('#service'),backdrop=$('#sbg');
function toast(msg){const box=$('#island');box.innerHTML='<div class="mini" style="white-space:normal;padding:4px 7px">'+esc(msg)+'</div>';box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),3600);}
function total(d){return Calc.money(Calc.totals(d).ttc);}
function find(id){return D.find(x=>x.id===id);}
function nextNumber(){const y=new Date().getFullYear(),key=K.counter+y;let n=load(key,y===2026?COMPANY.lastNumber:0);D.forEach(d=>{const m=/^D(\d{4})-(\d+)$/.exec(d.num);if(m&&+m[1]===y)n=Math.max(n,+m[2]);});store(key,++n);return'D'+y+'-'+String(n).padStart(3,'0');}
function saveQuote(d){
 if(!d||(!(d.client.name||'').trim()&&!d.lines.length&&!(d.obj||'').trim()))return false;
 if(!d.num)d.num=nextNumber();d.updated=Date.now();const next=D.slice(),i=next.findIndex(x=>x.id===d.id);if(i>=0&&next[i].invoice&&(!d.invoice||JSON.stringify(d.invoice)!==JSON.stringify(next[i].invoice)))return false;if(i<0)next.push(clone(d));else next[i]=clone(d);
 if(!store(K.devis,next))return false;D=next;preparePdf(d);return true;
}
function flush(){clearTimeout(saveTimer);if(cur&&routeKind==='edit')saveQuote(cur);}
function persistEdit(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(cur){saveQuote(cur);const n=$('#editNumber');if(n)n.textContent=cur.num||'Nouveau devis';rendreGains();}},400);}
function blank(){return{id:uid(),num:'',date:localISO(new Date()),client:{name:'',addr:'',email:'',tel:''},site:'',obj:'',lines:[],tva:10,status:'draft',createdAt:new Date().toISOString(),demo:false};}
function newQuote(){flush();cur=blank();navigate('edit/'+cur.id);}
const IC={doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5"/>',down:'<path d="m6 9 6 6 6-6"/>',euro:'<path d="M18 5a7 7 0 1 0 0 14M4 10h11M4 14h10"/>',check:'<path d="m5 12 4 4L19 6"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
 send:'<path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z"/>',
 download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
 save:'<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
 pen:'<path d="M4 20h4L19 9l-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/>',
 sign:'<path d="M3 17c3-6 5-9 6-8s-2 7 0 7 3-5 5-5-1 5 1 5 3-2 6-3"/><path d="M3 21h18"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 more:'<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 unlock:'<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
 reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
 wa:'<path d="M3.6 20.4 4.9 16A8.6 8.6 0 1 1 8 19.2Z"/><path d="M9.2 8.3c.3-.6.9-.6 1.2 0l.6 1.4c.1.3 0 .6-.2.8l-.5.5c.6 1.2 1.6 2.2 2.8 2.8l.5-.5c.2-.2.5-.3.8-.2l1.4.6c.6.3.6.9 0 1.2-.8.5-1.8.6-2.7.2-2-.9-3.6-2.5-4.5-4.5-.4-.9-.3-1.9.2-2.7Z" fill="currentColor" stroke="none"/>'};
const bi=k=>'<svg class="bi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+IC[k]+'</svg>';
const ico=(k,color='#fff')=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[k]+'</svg>';
const logo=(d,size)=>'<span class="bt"'+(size?' style="--sz:'+size+'px"':'')+'>'+ico('doc','#1F4E5F').replace('width="20" height="20"','')+'</span>';
const back='<button class="back" data-action="back" aria-label="Fermer">'+ico('down')+'</button>';
const LIB={late:'À relancer',ready:'Prêt à envoyer',draft:'Brouillon',signed:'Signé',sent:'Envoyé',deposit:'Acompte reçu',invoiced:'Facturé'};
const CLS={late:'late',ready:'ready',draft:'draft',signed:'ok',sent:'wait',deposit:'ok',invoiced:'watch'};
function pill(d){const st=F.etatDossier(d),late=F.invoiceOverdue(d);return'<span class="pill '+(late?'late':CLS[st])+'">'+(late?'Paiement en retard':st==='invoiced'&&!d.invoice?'Suivi facturé':LIB[st])+'</span>';}
function currentAction(d){
 return ContextFlow.describe(d,F,{signature:AppConfig.features.signature,invoicing:AppConfig.features.invoicing,shared:downloaded.has(d.id),balance:d.invoice?InvoiceLogic.balance(d):null});
}
function frise(d){
 const p=currentAction(d);
 return'<div class="re-progress re-progress-'+(p.warning?'alert':p.state)+'" role="group" aria-label="Avancement du dossier"><div class="re-progress-heading"><span class="re-progress-caption">Avancement du devis</span><strong class="re-progress-current'+(p.warning?' re-progress-alert':'')+'">'+esc(p.label)+'</strong></div><div class="re-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="'+p.count+'" aria-valuenow="'+(p.index+1)+'" aria-valuetext="'+esc(p.label)+'"><span style="width:'+p.percent+'%"></span></div></div>';
}
function row(d){return'<div class="row" role="button" tabindex="0" data-open="'+esc(d.id)+'" aria-label="'+esc(d.client.name+' · '+LIB[F.etatDossier(d)])+'"><div class="l">'+logo(d)+'<div class="re-client"><div class="t">'+esc(d.client.name||'Client à renseigner')+'</div><div class="s">'+esc(d.obj||'Objet à préciser')+'</div></div></div><div class="r"><div class="v">'+total(d)+'</div>'+pill(d)+'</div></div>';}
function summary(){return F.totalsSummary(D);}
function demoBadge(d){return d&&d.demo?'<span class="demo">Démonstration · fictif</span>':'';}
function primaryButton(action,id,text,icon){return'<button class="cta" data-action="'+action+'" data-id="'+esc(id)+'">'+(icon?bi(icon):'')+'<span>'+text+'</span></button>';}
function secondaryButton(action,id,text,icon){return'<button class="all" data-action="'+action+'" data-id="'+esc(id)+'">'+(icon?bi(icon):'')+'<span>'+text+'</span></button>';}
function addressForWhatsApp(d,msg){const tel=(d.client.tel||'').replace(/[\s().-]/g,'');return'https://wa.me/'+(/^\+\d{8,15}$/.test(tel)?tel.slice(1):'')+'?text='+encodeURIComponent(msg);}
function depositMessage(d){const c=d.client,who=c.title&&c.lastName?c.title+' '+c.lastName:c.name;return'Bonjour '+who+', merci pour votre accord sur le devis '+d.num+'. L’acompte de 30 % s’élève à '+Calc.money(Calc.totals(d).acompte)+'. Pouvez-vous procéder au règlement selon les conditions du devis ? Merci.';}
function addressForEmail(d,kind,msg){const subject=(kind==='relance'?'Votre devis '+d.num:'Acompte · devis '+d.num)+' · '+COMPANY.name,to=(d.client.email||'').trim();return'mailto:'+(/^[^\s@?&]+@[^\s@?&]+$/.test(to)?to:'')+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(msg+'\n\n'+COMPANY.name);}
function contactButtons(d,kind,text,extra=''){
 const msg=kind==='relance'?F.relanceMessage(d):depositMessage(d);
 if(d.demo)return'<div class="re-contact '+extra+'"><p class="re-contact-label">Exemple fictif : aucun message réel ne peut être envoyé.</p></div>';
 const raw=String(d.client.tel||'').replace(/[\s().-]/g,''),tel=/^0[1-9]\d{8}$/.test(raw)?'+33'+raw.slice(1):raw;
 const whatsapp=/^\+\d{8,15}$/.test(tel)?'<a class="re-wa" data-contact="whatsapp" href="https://wa.me/'+tel.slice(1)+'?text='+encodeURIComponent(msg)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(text)+' par WhatsApp">'+bi('wa')+'<span>WhatsApp</span></a>':'';
 const email=(d.client.email||'').trim(),mail=/^[^\s@?&]+@[^\s@?&]+\.[^\s@?&]+$/.test(email)?'<a class="re-mail" data-contact="email" href="'+esc(addressForEmail(d,kind,msg))+'" aria-label="'+esc(text)+' par email">'+bi('mail')+'<span>Email</span></a>':'';
 if(!whatsapp&&!mail)return'<div class="re-contact '+extra+'"><p class="re-contact-label">Aucune coordonnée utilisable. Complétez le client pour le contacter.</p>'+primaryButton('edit',d.id,'Ajouter les coordonnées','pen')+'</div>';
 return'<div class="re-contact '+extra+'"><p class="re-contact-label">'+esc(text)+' via :</p><div class="re-contact-row '+(!whatsapp||!mail?'re-one-channel':'')+'">'+whatsapp+mail+'</div><p class="fine">Le message doit être envoyé par vous dans l’application choisie.</p></div>';
}
const ACTION_ICON={send:'send',edit:'pen',sign:'sign',invoiced:'euro',document:'eye',contact:'send',confirmSent:'check',issueInvoice:'euro',payment:'euro',downloadInvoice:'download'};
function actionHTML(d,action,text,extra=''){const next=action==='relance'||action==='deposit'?'contact':action;return primaryButton(next,d.id,esc(text),ACTION_ICON[next]||'check').replace('class="cta"','class="cta '+extra+(action==='relance'?' re-relance':'')+'"');}
function rendreHero(){const h=$('#hero'),d=F.prioritaire(D);HEROD=d;
 if(!d){h.className='hero';h.innerHTML='<div class="lbl">Mes devis</div>'+(demoActive()?'<div class="demo">Démonstration · fictif</div>':'')+'<div class="amount">'+Calc.money(D.filter(x=>['sent','late'].includes(F.etatDossier(x))).reduce((n,x)=>n+Calc.totals(x).ttc,0))+'</div><div class="paid">'+esc(summary())+'</div>';return;}
 const info=F.heroInfo(d);h.className='hero vedette'+(F.etatDossier(d)==='late'||F.invoiceOverdue(d)?' alerte':'');
 h.innerHTML='<div class="hv-t"><span class="lbl">'+info.tag+'</span>'+demoBadge(d)+'</div><div class="hv-d">'+logo(d)+'<div class="hv-m"><b>'+esc(d.client.name||'Nouveau devis')+'</b><span>'+esc(info.txt)+'</span></div><div class="hv-v">'+total(d)+'</div></div>'+actionHTML(d,info.action,info.cta,'hv-go')+'<div class="hv-tot">'+esc(summary())+'</div>';
 preparePdf(d);
}
function documentKindLabel(d){return F.documentKind(d)==='invoices'?'facture facturé':'devis';}
function rendreGains(){rendreHero();const searching=GLOBAL_QUERY.trim().length>0,filtering=GLOBAL_STATUS!=='all';const list=(searching||filtering?D:D.filter(F.needsAttention)).filter(d=>(!filtering||F.etatDossier(d)===GLOBAL_STATUS)&&(!searching||norm([d.client.name,d.num,d.invoice&&d.invoice.num,d.obj,d.client.email,d.client.tel,d.date,documentKindLabel(d)].join(' ')).includes(norm(GLOBAL_QUERY)))).sort(F.ordre),visible=searching||filtering||EXPLORER?list:list.slice(0,3),remaining=list.length-visible.length;
 $('#exampleLabel').textContent=demoActive()?'exemples fictifs':'';
 $('#gains').innerHTML=visible.map(row).join('')+(list.length?'':'<p class="empty">'+(searching?'Aucun dossier trouvé.':'Aucun devis à suivre pour le moment.')+'</p>');
 $('#quoteExplorer').innerHTML=searching||filtering?'':(remaining>0?'<button class="all explorer" data-action="explorer">Explorer · '+remaining+' autre'+(remaining>1?'s':'')+'</button>':EXPLORER&&list.length>3?'<button class="all explorer" data-action="explorer">Réduire</button>':'');
 const quotes=F.historyDocuments(D,'quotes').length,invoices=D.filter(d=>!!d.invoice).length;
 $('#quotesCount').textContent=quotes+' devis';if($('#invoicesArchive'))$('#invoicesArchive').hidden=!AppConfig.features.invoicing;
 $('#invoicesCount').textContent=invoices+' facture'+(invoices>1?'s':'')+' PDF';
}
function head(title,sub,d){return'<div class="top">'+back+(d?logo(d,46):'')+'<div class="re-client"><div class="ttl" id="sheetTitle">'+esc(title)+'</div><div class="sub">'+esc(sub||'')+'</div></div></div>';}
function contextButtons(d){
 const next=currentAction(d);
 return '<div class="re-primary-next" aria-label="Prochaine action">'+primaryButton(next.action,d.id,next.text,ACTION_ICON[next.action]||'check')+'</div>';
}
function contactView(d){
 const stage=F.etatDossier(d),kind=stage==='signed'?'deposit':'relance';
 const title=kind==='deposit'?'Demander l’acompte':'Relancer le client';
 return head(title,d.num,d)+'<div class="card"><p>'+esc(kind==='deposit'?'Choisissez le canal pour demander l’acompte.':'Choisissez le canal pour relancer ce devis.')+'</p>'+contactButtons(d,kind,title)+'</div>'+(kind==='deposit'?'<details class="re-more"><summary>Acompte déjà reçu ?</summary><p>Enregistrez cet état uniquement après avoir vérifié le règlement.</p>'+secondaryButton('recordDeposit',d.id,'Confirmer l’acompte reçu','check')+'</details>':'')+'<p class="fine">L’ouverture de WhatsApp ou de l’e-mail ne confirme pas la réception par le client.</p>';
}

function dossier(d){
 const p=currentAction(d),t=Calc.totals(d);
 const detail='<details class="re-more"><summary>Informations et historique</summary><div class="re-extra"><div class="opt"><span>Devis</span><b>'+esc(d.num)+'</b></div><div class="opt"><span>Date</span><b>'+displayDate(d.date)+'</b></div>'+(d.sentAt?'<p class="fine">Envoi déclaré : '+displayTime(d.sentAt)+'</p>':'')+(d.signedAt?'<p class="fine">'+(d.signature?'Signature recueillie':'Accord manuel')+' : '+displayTime(d.signedAt)+'</p>':'')+(d.invoice?'<p class="fine">Facture '+esc(d.invoice.num)+' · '+displayDate(d.invoice.issuedAt)+'</p>':'')+secondaryButton('document',d.id,'Consulter le devis','eye')+(d.invoice?secondaryButton('downloadInvoice',d.id,'Télécharger la facture PDF','download'):'')+secondaryButton('options',d.id,'Options du dossier','more')+'</div></details>';
 return head(d.client.name||'Nouveau devis',d.obj,d)+frise(d)+demoBadge(d)+'<div class="card re-summary"><div class="re-summary-label">'+esc(d.obj||'Travaux à préciser')+'</div><strong class="re-summary-total">'+total(d)+'</strong><p class="re-summary-hint">'+(p.real==='draft'?'Complétez les informations pour préparer le devis.':p.real==='ready'?'Le devis est prêt à partager.':p.real==='late'?'Une relance est nécessaire.':p.real==='sent'?'Le devis a été déclaré envoyé.':p.real==='signed'?'Demandez l’acompte convenu.':p.real==='deposit'?'Vous pouvez préparer la facture.':F.invoiceOverdue(d)?'La facture a dépassé son échéance. Enregistrez le paiement seulement après sa réception.':d.invoice?'Facture '+esc(d.invoice.num)+' émise.':'Dossier classé.')+'</p>'+(d.invoice?'<div class="opt"><span>Encaissé'+(d.payments&&d.payments.some(p=>p.kind==='deposit')?' (acompte inclus)':'')+'</span><b>'+Calc.money(InvoiceLogic.paid(d))+'</b></div><div class="opt"><span>Reste dû</span><b>'+Calc.money(InvoiceLogic.balance(d))+'</b></div>':'')+'</div>'+contextButtons(d)+detail;
}

function documentView(d){const t=Calc.totals(d);return head(d.num,d.invoice?'Devis lié à la facture '+d.invoice.num:'Devis de peinture',d)+demoBadge(d)+'<div class="card"><span class="tag">Client</span><h3>'+esc(d.client.name)+'</h3><p>'+esc(d.client.addr)+'<br>'+esc(d.client.email)+(d.client.tel?'<br>'+esc(d.client.tel):'')+'</p></div><div class="card"><span class="tag">Chantier</span><h3>'+esc(d.obj||'Travaux de peinture')+'</h3><p>'+esc(d.site||d.client.addr)+'</p></div><div class="card"><span class="tag">Prestations</span>'+d.lines.map(l=>'<div class="opt"><span>'+esc(l.label)+'<small>'+esc(Calc.qty(l.qty))+' '+esc(l.unit)+' × '+Calc.money(l.price)+' HT</small></span><b>'+Calc.money(Calc.lineTotalCents(l)/100)+'</b></div>').join('')+'</div><div class="card">'+[['Total HT',t.ht],['TVA '+d.tva+' %',t.tva],['Total TTC',t.ttc],['Acompte 30 %',t.acompte]].map(x=>'<div class="opt'+(x[0]==='Total TTC'?' re-total-ttc':'')+'"><span>'+x[0]+'</span><b>'+Calc.money(x[1])+'</b></div>').join('')+'</div>'+(d.signature?'<div class="card"><span class="tag">Bon pour accord</span><p>Signé le '+displayTime(d.signature.signedAt)+'</p><img class="re-signature" src="'+esc(d.signature.data)+'" alt="Signature du client"></div>':'')+'<details class="lettre"><summary>Mentions et rétractation</summary><div>Le PDF reprend les mentions de la V1, les conditions de paiement, la validité de '+COMPANY.validityDays+' jours, l’assurance décennale, le médiateur et le formulaire de rétractation. Les coordonnées d’entreprise sont fictives dans cette démonstration.</div></details><div class="actbar">'+primaryButton('download',d.id,'Télécharger le PDF','download')+'</div>';}
function optionsView(d){
 return head('Options du dossier',d.num,d)+'<div class="card"><div class="chxs">'+(d.invoice||['signed','deposit','invoiced'].includes(d.status)?'':secondaryButton('edit',d.id,'Modifier le devis','pen'))+secondaryButton('duplicate',d.id,'Dupliquer le devis','copy')+'</div></div>'+(d.invoice?'':'<details class="re-more"><summary>Corriger manuellement le suivi</summary><p>À utiliser si une étape a été effectuée en dehors de l’application.</p>'+secondaryButton('status',d.id,'Modifier un état','flag')+'</details>');
}

function field(label,key,value,type='text',area=false){return'<label class="re-field">'+label+(area?'<textarea data-field="'+key+'" rows="2">'+esc(value)+'</textarea>':'<input data-field="'+key+'" type="'+type+'" value="'+esc(value)+'"'+(type==='email'?' autocomplete="email"':type==='tel'?' inputmode="tel"':/\.(price|qty)$/.test(key)?' inputmode="decimal"':'')+'>')+'</label>';}
function editView(d){return head(d.num||'Nouveau devis','Devis de peinture',d)+'<div class="fine" style="text-align:left" id="editNumber">'+esc(d.num||'Nouveau devis')+'</div>'+demoBadge(d)+'<fieldset'+(d.signature?' disabled':'')+'><div class="card"><span class="tag">Client</span>'+field('Nom','client.name',d.client.name)+field('Adresse','client.addr',d.client.addr,'text',true)+field('Email','client.email',d.client.email,'email')+field('Téléphone','client.tel',d.client.tel,'tel')+'</div><div class="card"><span class="tag">Chantier</span>'+field('Objet','obj',d.obj)+field('Adresse du chantier','site',d.site,'text',true)+'</div><h2>Prestations</h2><div id="editLines">'+linesHTML(d)+'</div>'+secondaryButton('pick',d.id,'Ajouter une prestation','list')+secondaryButton('free',d.id,'Ajouter une ligne libre','plus')+'<div class="card"><span class="tag">TVA</span><div class="re-tva"><button data-tva="10" class="'+(+d.tva===10?'on':'')+'">10 %</button><button data-tva="20" class="'+(+d.tva===20?'on':'')+'">20 %</button></div><div id="editTotals">'+totalsHTML(d)+'</div></div></fieldset>'+(d.signature?'<div class="hint">Ce devis est signé. Pour le modifier, vous devez d’abord retirer sa signature.</div>':'')+'<div class="actbar">'+primaryButton(d.signature?'unlock':'save',d.id,d.signature?'Retirer la signature pour modifier':'Enregistrer le devis',d.signature?'unlock':'save')+'</div><p class="fine">Enregistrement automatique sur cet appareil.</p>';}
function linesHTML(d){return d.lines.map((l,i)=>'<div class="card re-line" data-line="'+i+'">'+field('Prestation','line.'+i+'.label',l.label,'text',true)+'<div class="re-grid three">'+field('Quantité','line.'+i+'.qty',Calc.qty(l.qty,''))+field('Unité','line.'+i+'.unit',l.unit)+field('Prix HT €','line.'+i+'.price',l.price===null?'':String(l.price).replace('.',','))+'</div><div class="re-foot"><button class="lien re-del" data-action="deleteLine" data-i="'+i+'">'+bi('trash')+'<span>Supprimer</span></button><b data-line-total>'+Calc.money(Calc.lineTotalCents(l)/100)+'</b></div>'+(l.price===null?'<p class="re-error">Prix à saisir : prestation sur devis.</p>':'')+'</div>').join('')||'<p class="empty">Aucune prestation pour l’instant.</p>';}
function totalsHTML(d){const t=Calc.totals(d);return[['Total HT',t.ht],['TVA '+d.tva+' %',t.tva],['Total TTC',t.ttc],['Acompte 30 %',t.acompte]].map(x=>'<div class="opt'+(x[0]==='Total TTC'?' re-total-ttc':'')+'"><span>'+x[0]+'</span><b>'+Calc.money(x[1])+'</b></div>').join('');}
function priceLabel(t){const p=Calc.parseNum(t.price);return p===null?'Sur devis':Calc.money(p)+(t.unit?' / '+esc(t.unit):'');}
function tariffRows(filter,pick){const q=norm(filter);return tarifs.map((t,i)=>({t,i})).filter(x=>!q||norm(x.t.label+' '+x.t.code+' '+x.t.note).includes(q)).map(({t,i})=>'<div class="row" role="button" tabindex="0" data-tarif="'+i+'"'+(pick?' data-pick="1"':'')+'><div class="l">'+logo(t)+'<div class="re-client"><div class="t">'+esc(t.label)+'</div><div class="s">'+esc([t.code,t.note].filter(Boolean).join(' · '))+'</div></div></div><div class="r"><div class="v" style="font-size:13px">'+priceLabel(t)+'</div></div></div>').join('')||'<p class="empty">Aucun tarif trouvé.</p>';}
function tariffView(pick){return head(pick?'Choisir une prestation':'Mes tarifs',pick?'Ajouter au devis':'Tarifs modifiables')+'<input type="search" class="re-search" id="tarifSearch" placeholder="Rechercher une prestation…" aria-label="Rechercher une prestation"><section class="list" id="tarifRows">'+tariffRows('',pick)+'</section>'+(pick?'':'<div class="actbar">'+primaryButton('newTarif','','Ajouter un tarif','plus')+'</div><details class="re-more"><summary>Réinitialisation des tarifs</summary>'+secondaryButton('resetTarifs','','Remettre les tarifs d’origine','reset')+'</details>');}
function editTariffView(idx){const t=tarifs[idx]||{code:'',label:'',unit:'',price:null,note:''};return head(tarifs[idx]?'Modifier le tarif':'Ajouter un tarif','Mes tarifs')+'<div class="card">'+field('Code','t.code',t.code)+field('Prestation','t.label',t.label,'text',true)+field('Unité','t.unit',t.unit)+field('Prix HT € · vide = sur devis','t.price',t.price===null?'':String(t.price).replace('.',','))+field('Remarque','t.note',t.note,'text',true)+'</div><div class="actbar">'+primaryButton('saveTarif',idx,'Enregistrer le tarif','save')+'</div>'+(tarifs[idx]?'<details class="re-more"><summary>Options du tarif</summary>'+secondaryButton('deleteTarif',idx,'Supprimer ce tarif','trash')+'</details>':'');}
function statusView(d){
 const state=F.etatDossier(d);
 const allowed=state==='ready'?[['sent','Déjà envoyé au client']]:state==='sent'||state==='late'?[['signed','Accord du client obtenu']]:state==='signed'?[['deposit','Acompte réellement reçu']]:[];
 return head('Suivi manuel',d.num,d)+(allowed.length?'<div class="card"><p>Choisissez uniquement une action déjà réalisée, hors de cette application.</p>'+allowed.map(([key,label])=>secondaryButton('manual-'+key,d.id,label,'check')).join('')+'</div>':'<p class="empty">Aucune correction manuelle nécessaire pour cette étape.</p>')+'<p class="fine">Ces déclarations ne prouvent pas la livraison du message, la signature ou le paiement.</p>';
}

function backupData(){const payload={format:'renov-express-v2-backup',version:1,exportedAt:new Date().toISOString(),devis:D,tarifs,company:clone(COMPANY)};try{const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='RenovExpress_sauvegarde_'+localISO(new Date())+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Sauvegarde téléchargée. Conservez-la dans un emplacement privé.');}catch(e){toast('Impossible de créer la sauvegarde.');}}
function companyView(){
 const labels={name:'Raison sociale',activity:'Activité',address:'Adresse',city:'Code postal et ville',phone:'Téléphone',email:'Email professionnel',siret:'SIRET (14 chiffres)',tvaIntra:'TVA intracommunautaire',rcs:'RCS / capital',insurer:'Assureur',insurerPolicy:'Numéro de police',insurerZone:'Zone de couverture',mediator:'Médiateur consommation',payment:'Conditions de paiement'};
 return head('Mon entreprise','Coordonnées utilisées dans les PDF')+'<div class="card"><p>'+(pendingInvoiceId?'Complétez les champs indiqués pour revenir au devis et émettre sa facture. ':'')+'Vérifiez les informations légales avant d’émettre un document réel.</p>'+(pendingInvoiceId?'<p class="re-error">Champs à corriger : '+esc(InvoiceLogic.issuerProblems(COMPANY).join(', '))+'</p>':'')+Object.keys(labels).map(k=>field(labels[k],'c.'+k,COMPANY[k]||'',k==='email'?'email':'text',k==='payment')).join('')+'</div><div class="actbar">'+primaryButton('saveCompany','','Enregistrer mon entreprise','save')+'</div>';
}
function saveCompany(){
 const next=clone(COMPANY),keys=companyFields.filter(k=>!['validityDays','depositRate'].includes(k));
 for(const k of keys){const el=body.querySelector('[data-field="c.'+k+'"]');if(el)next[k]=el.value.trim();}
 if(next.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email))return toast('Adresse email professionnelle invalide');
 // Profil enregistrable progressivement. Facturation bloquée tant que le SIRET n'est pas réel et valide.
 if(!store('re_v2_company',next))return;
 Object.assign(COMPANY,next);prepared.clear();const pending=find(pendingInvoiceId);if(pending){if(!InvoiceLogic.isValidIssuer(COMPANY)){route();toast('Vérifiez les champs signalés avant de créer la facture.');return;}pendingInvoiceId=null;navigate('d/'+pending.id);toast('Entreprise enregistrée. Le devis est prêt à être facturé.');return;}toast('Entreprise enregistrée · les futurs PDF sont actualisés');navigate('appearance');
}
function restoreData(file){
 if(!file)return;
 if(file.size>20*1024*1024){toast('Sauvegarde trop volumineuse (20 Mo max).');return;}
 file.text().then(raw=>{
  const obj=JSON.parse(raw);StorageTools.validate(obj);
  const nextD=StorageTools.merge(D,obj);
  const keys=new Set(tarifs.map(t=>String(t.code||t.label).toLowerCase()));
  const nextT=clone(tarifs);
  obj.tarifs.forEach(t=>{const key=String(t.code||t.label).toLowerCase();if(!keys.has(key)){nextT.push(t);keys.add(key);}});
  const importCompany=!localStorage.getItem('re_v2_company')&&obj.company&&typeof obj.company==='object';
  const restoredCompany=importCompany?Object.fromEntries(companyFields.filter(k=>Object.prototype.hasOwnProperty.call(obj.company,k)&&['string','number'].includes(typeof obj.company[k])).map(k=>[k,obj.company[k]])):null;
  if(!confirm('Importer '+(nextD.length-D.length)+' devis et '+(nextT.length-tarifs.length)+' tarifs nouveaux'+(restoredCompany?' ainsi que le profil entreprise':'')+' ? Les documents existants seront conservés.'))return;
  const oldD=localStorage.getItem(K.devis),oldT=localStorage.getItem(K.tarifs),oldC=localStorage.getItem('re_v2_company');
  try{localStorage.setItem(K.devis,JSON.stringify(nextD));localStorage.setItem(K.tarifs,JSON.stringify(nextT));if(restoredCompany)localStorage.setItem('re_v2_company',JSON.stringify(restoredCompany));}
  catch(e){try{if(oldD===null)localStorage.removeItem(K.devis);else localStorage.setItem(K.devis,oldD);if(oldT===null)localStorage.removeItem(K.tarifs);else localStorage.setItem(K.tarifs,oldT);if(oldC===null)localStorage.removeItem('re_v2_company');else localStorage.setItem('re_v2_company',oldC);}catch(_){}toast('Import annulé : stockage indisponible ou saturé');return;}
  D=nextD;tarifs=nextT;if(restoredCompany)Object.assign(COMPANY,restoredCompany);prepared.clear();downloaded.clear();rendreGains();route();toast('Sauvegarde importée sur cet appareil');
 }).catch(e=>toast('Import impossible : '+e.message));
}
function issueInvoice(d){
 if(!AppConfig.features.invoicing||!d)return false;
 if(d.invoice){navigate('d/'+d.id);toast('Une facture existe déjà pour ce devis.');return false;}
 if(!d.demo&&!InvoiceLogic.isValidIssuer(COMPANY)){
  pendingInvoiceId=d.id;
  navigate('company');
  toast('Complétez les informations professionnelles indiquées pour facturer.');
  return false;
 }
 const message=d.demo?'Créer une facture de SIMULATION pour ce devis fictif ? Elle sera marquée non valable.':'Créer une facture numérotée avec l’acompte déjà reçu déduit du solde ? Les données du devis seront verrouillées.';
 if(!confirm(message))return false;
 try{
  const next=InvoiceLogic.issue(d,D,COMPANY);
  if(!saveQuote(next)){toast('La facture n’a pas pu être enregistrée. Vérifiez l’espace disponible.');return false;}
  pendingInvoiceId=null;navigate('d/'+d.id);rendreGains();
  toast((d.demo?'Simulation ':'Facture ')+next.invoice.num+' créée · Reste dû : '+Calc.money(InvoiceLogic.balance(next)));
  return true;
 }catch(e){toast(e.message);return false;}
}
function invoiceSummary(d){
 if(!d.invoice)return '';
 const rest=InvoiceLogic.balance(d),payments=Array.isArray(d.payments)?d.payments:[];
 return'<div class="card"><span class="tag">Facture '+esc(d.invoice.num)+'</span><p>Émise le '+displayDate(d.invoice.issuedAt)+' · Échéance '+displayDate(d.invoice.dueDate)+'</p><div class="opt"><span>Encaissé</span><b>'+Calc.money(InvoiceLogic.paid(d))+'</b></div><div class="opt re-total-ttc"><span>Reste dû</span><b>'+Calc.money(rest)+'</b></div>'+payments.map(p=>'<p class="fine">'+displayDate(p.date)+' · '+esc(p.method)+' : '+Calc.money(p.amount)+'</p>').join('')+'</div><div class="actbar">'+primaryButton('downloadInvoice',d.id,'Télécharger la facture PDF','download')+(rest>0?secondaryButton('payment',d.id,'Enregistrer un règlement','euro'):'')+'</div>';
}
function paymentView(d){
 return head('Enregistrer un règlement',d.invoice.num,d)+'<div class="card"><p>Solde restant : <b>'+Calc.money(InvoiceLogic.balance(d))+'</b></p>'+
 field('Montant reçu en euros','p.amount',String(InvoiceLogic.balance(d)).replace('.',','))+
 field('Date du règlement','p.date',localISO(new Date()),'date')+
 '<label class="re-field">Moyen de règlement<select data-field="p.method"><option>Virement</option><option>Carte</option><option>Chèque</option><option>Espèces</option><option>Autre</option></select></label></div><div class="actbar">'+primaryButton('savePayment',d.id,'Confirmer le règlement','check')+'</div>';
}
function savePayment(d){
 const val=k=>body.querySelector('[data-field="p.'+k+'"]').value;
 try{
  const updated=InvoiceLogic.addPayment(d,val('amount'),val('date'),val('method'));
  if(!confirm('Confirmez-vous avoir réellement reçu ce règlement ?'))return;
  if(saveQuote(updated)){navigate('d/'+d.id);rendreGains();toast('Règlement enregistré');}
 }catch(e){toast(e.message);}
}
function downloadInvoice(d){
 if(!d.invoice)return toast('Facture non disponible.');
 try{const pdf=InvoiceLogic.buildPDF(d);PDFShare.download(PDFShare.prepare(pdf.output('blob'),'Facture_'+d.invoice.num+'_RenovExpress.pdf'));toast('PDF de la facture téléchargé');}
 catch(e){toast('PDF facture indisponible : '+e.message);}
}
function demoSection(){const n=D.filter(d=>d.demo).length;return'<h2>Mode démonstration</h2><div class="card"><p style="margin-top:0">'+(n?'Les '+n+' devis d’exemple (Claire Dubois, Paul Martin…) sont fictifs. Ils servent seulement à montrer l’application. Retirez-les dès que vous travaillez avec vos vrais clients : vos propres devis sont conservés.':'Les exemples fictifs sont retirés. Seuls vos vrais devis apparaissent.')+'</p>'+(n?primaryButton('demoOff','','Retirer les exemples fictifs','trash'):secondaryButton('demoOn','','Remettre les exemples fictifs','reset'))+'</div><p class="fine">Les boutons WhatsApp et Email ouvrent vos vraies applications avec le message déjà écrit : vous choisissez le destinataire et vous envoyez vous-même.</p>';}
function appearanceView(){return head('Réglages','Entreprise, sauvegardes et apparence')+'<h2>Fond d’écran</h2><div class="theme-list">'+Appearance.themes.map(t=>'<button class="chx theme-option" data-theme-choice="'+t.id+'" aria-pressed="'+(Appearance.selected===t.id)+'"><span class="theme-swatch" style="background:'+t.swatch+'" aria-hidden="true"></span><span class="theme-label"><span>'+t.name+'</span><small>'+t.description+'</small></span>'+(Appearance.selected===t.id?ico('check'):'')+'</button>').join('')+'</div><p class="fine">Le fond choisi est mémorisé sur cet appareil.</p><h2>Informations professionnelles</h2><div class="card"><p>Coordonnées légales reprises dans les devis et factures PDF.</p>'+primaryButton('company','','Configurer mon entreprise','pen')+'</div><h2>Sauvegarde de vos données</h2><div class="card"><p>Les devis et tarifs sont enregistrés sur cet appareil uniquement. Exportez une copie privée avant de changer de navigateur ou de téléphone.</p>'+primaryButton('backup','','Télécharger une sauvegarde','download')+'<label class="re-field" style="margin-top:12px">Restaurer depuis un fichier JSON<input id="restoreInput" type="file" accept="application/json,.json" aria-label="Importer une sauvegarde"></label><p class="fine">L’import ajoute les devis et tarifs absents sans effacer les données actuelles. Fichier privé : évitez de le partager.</p></div>'+demoSection();}
function historyRows(query=''){const q=norm(query),list=F.historyDocuments(D,routeId).filter(d=>routeId!=='invoices'||!!d.invoice).filter(d=>!q||norm([d.client.name,d.num,d.invoice&&d.invoice.num,d.obj,d.date].join(' ')).includes(q)).sort(F.ordre);return list.map(row).join('')||'<p class="empty">'+(q?'Aucun document trouvé.':routeId==='invoices'?'Aucune facture PDF créée pour le moment.':'Aucun devis enregistré.')+'</p>';}
function historyView(){const title=routeId==='quotes'?'Mes devis':routeId==='invoices'?'Mes factures':'Historique',sub=routeId==='invoices'?'Factures PDF émises sur cet appareil':routeId==='quotes'?'Historique des devis':'Devis et documents facturés';return head(title,sub)+'<input type="search" class="re-search" id="historySearch" placeholder="Rechercher un client, un numéro…" aria-label="Rechercher un document"><section class="list" id="historyRows">'+historyRows()+'</section>';}
function signView(d){return head('Signature du client',d.num,d)+'<div class="card"><span class="tag">Bon pour accord</span><h3>'+esc(d.client.name)+'</h3><p>'+esc(d.obj)+'<br><b>'+total(d)+' TTC</b></p>'+demoBadge(d)+'<p>Signez avec votre doigt dans le cadre.</p><canvas id="signatureCanvas" aria-label="Zone de signature au doigt"></canvas><button class="lien re-del" style="margin-top:10px" data-action="clearSignature">'+bi('reset')+'<span>Effacer et recommencer</span></button><label class="re-consent"><input type="checkbox" id="signConsent"><span>J’ai lu ce devis, son montant et ses conditions. <b>Bon pour accord.</b></span></label><p class="re-error" id="signError" role="alert"></p></div><div class="actbar">'+primaryButton('confirmSignature',d.id,'Valider la signature','check')+'</div><p class="fine">Signature et date ajoutées au PDF.</p>';}
function navigate(hash){flush();if(location.hash.slice(1)===hash)route();else location.hash=hash;}
function parentRoute(){if(routeKind==='edit'||routeKind==='document'||routeKind==='sign'||routeKind==='options'||routeKind==='status'||routeKind==='payment'||routeKind==='contact')return find(routeId)?'d/'+routeId:'';if(routeKind==='pick')return'edit/'+routeId;if(routeKind==='tarif')return'tarifs';return'';}
/* AutoDroits morph: source card -> useful-height panel, then content fade. */
let originElement=null,originBox=null,originKey=null,contentTimer=null,closeTimer=null,openingFrame=null;
function geom(){const v=window.visualViewport,w=Math.min(document.documentElement.clientWidth,v?v.width:innerWidth),h=v?v.height:innerHeight,app=document.querySelector('.phone').getBoundingClientRect(),W=Math.min(w,app.width);return{top:v?v.offsetTop:0,left:(v?v.offsetLeft:0)+(w-W)/2,width:W,height:h};}
const HAUT=()=>Math.min(56,Math.max(22,Math.round(geom().height*.08)));
function setBox(el,b){for(const p in b)el.style[p]=b[p]+'px';}
function boxOf(el){if(!el)return null;const r=el.getBoundingClientRect();return{top:r.top,left:r.left,width:r.width,height:r.height};}
function measurePanel(html,full){
 const G=geom(),available=Math.max(140,G.height-HAUT());
 if(full)return available;
 // Mesurer à la largeur réelle du téléphone : les boutons et libellés peuvent
 // se répartir sur plusieurs lignes et augmenter la hauteur du contenu.
 const m=document.createElement('div');
 m.className='mbody half on';m.setAttribute('aria-hidden','true');m.inert=true;
 m.style.cssText='position:fixed;visibility:hidden;pointer-events:none;left:-10000px;top:0;width:'+G.width+'px;height:auto;max-height:none;overflow:visible;transform:none;';
 m.innerHTML=html;document.body.appendChild(m);
 const natural=Math.ceil(Math.max(m.scrollHeight,m.getBoundingClientRect().height)+14);
 m.remove();
 // Une fiche riche prend quasiment tout l'écran dès l'ouverture au lieu
 // d'afficher un minuscule tiroir dont les boutons restent cachés.
 return natural>available*.62?available:Math.min(available,Math.max(190,natural));
}
function fitSheetContent(){
 if(!sheet.classList.contains('open')||!sheet.classList.contains('half'))return;
 // Les polices, grilles et images réelles peuvent différer de la mesure :
 // si le contenu déborde malgré tout, la fenêtre s'agrandit automatiquement.
 if(body.scrollHeight>body.clientHeight+6)expandSheet();
}
function rememberOrigin(el){originElement=el;originBox=boxOf(el);originKey=el.dataset.open?{quote:el.dataset.open}:el.id?{id:el.id}:null;}
function sourceElement(){if(originElement&&originElement.isConnected)return originElement;if(originKey){if(originKey.id)return document.getElementById(originKey.id);return [...document.querySelectorAll('#gains [data-open]')].find(el=>el.dataset.open===originKey.quote)||null;}return null;}
// Capture before navigation or a save can recreate the home cards.
document.addEventListener('click',e=>{const el=e.target.closest('#gains .row,#documents .svc,#hero.vedette,.actions .act,#history,#appearance');if(el&&!sheet.contains(el))rememberOrigin(el);},true);
function renderSheet(html,full){
 const wasOpen=sheet.classList.contains('open');clearTimeout(contentTimer);clearTimeout(closeTimer);if(openingFrame)cancelAnimationFrame(openingFrame);
 if(!wasOpen)focusBefore=document.activeElement;
 const G=geom(),h=measurePanel(html,full),target={top:G.top+G.height-h,left:G.left,width:G.width,height:h};
 sheet.hidden=false;sheet.inert=false;sheet.setAttribute('aria-labelledby','sheetTitle');
 body.className='mbody'+(full?'':' half');body.innerHTML=html;body.scrollTop=0;
 backdrop.classList.add('on');document.body.classList.add('lock');$('#home').inert=true;
 if(!wasOpen){
  const source=sourceElement()||$('#hero');if(!originBox)rememberOrigin(source);
  sheet.style.transition='none';sheet.className='morph open';setBox(sheet,originBox||boxOf(source));sheet.getBoundingClientRect();sheet.style.transition='';
 }else{sheet.className='morph open';}
 sheet.classList.add(full?'big':'half');
 const reveal=()=>{body.classList.add('on');const close=body.querySelector('.back');if(close)close.focus({preventScroll:true});};
 if(wasOpen){setBox(sheet,target);requestAnimationFrame(()=>{reveal();requestAnimationFrame(fitSheetContent);});}else{
  openingFrame=requestAnimationFrame(()=>{openingFrame=null;setBox(sheet,target);contentTimer=setTimeout(()=>{reveal();requestAnimationFrame(fitSheetContent);},260);});
 }
}
function expandSheet(){if(!sheet.classList.contains('open')||!sheet.classList.contains('half'))return;const G=geom(),t=HAUT();sheet.classList.remove('half');sheet.classList.add('big');body.classList.remove('half');setBox(sheet,{top:G.top+t,left:G.left,width:G.width,height:G.height-t});}
function closeSheet(){
 if(!sheet.classList.contains('open'))return;
 clearTimeout(contentTimer);if(openingFrame){cancelAnimationFrame(openingFrame);openingFrame=null;}
 body.classList.remove('on');body.innerHTML='';sheet.className='morph';sheet.inert=true;
 const source=sourceElement(),target=boxOf(source)||originBox||boxOf($('#hero'));setBox(sheet,target);
 backdrop.classList.remove('on');document.body.classList.remove('lock');$('#home').inert=false;
 closeTimer=setTimeout(()=>{sheet.hidden=true;},420);
 if(focusBefore&&focusBefore.isConnected)focusBefore.focus({preventScroll:true});
}
function route(){
 flush();const parts=decodeURIComponent(location.hash.slice(1)).split('/');let kind=parts[0]||'',id=parts[1]||'';routeKind=kind;routeId=id;
 const d=find(id)||(cur&&cur.id===id?cur:null);
 if(!kind){cur=null;closeSheet();rendreGains();return;}
 if(kind==='appearance'){cur=null;renderSheet(appearanceView(),true);return;}
  if(kind==='company'){cur=null;renderSheet(companyView(),true);return;}
 if(kind==='history'){if(id==='invoices'&&!AppConfig.features.invoicing){navigate('');return;}cur=null;renderSheet(historyView(),true);return;}
 if(kind==='tarifs'){cur=null;renderSheet(tariffView(false),true);return;}
 if(kind==='tarif'){cur=null;renderSheet(editTariffView(+id),true);return;}
 if(!d){navigate('');return;}
 if(kind==='edit'){if(d.invoice||['signed','deposit','invoiced'].includes(d.status)){toast('Dossier accepté : dupliquez le devis pour modifier sans altérer l’original.');navigate('d/'+d.id);return;}cur=clone(d);renderSheet(editView(cur),true);if(scrollLast){scrollLast=false;const lines=body.querySelectorAll('.re-line');if(lines.length)lines[lines.length-1].scrollIntoView({block:'center'});}return;}
 if(kind==='pick'){if(!cur||cur.id!==d.id)cur=clone(d);renderSheet(tariffView(true),true);return;}
 if(kind==='contact'){cur=null;renderSheet(contactView(d),false);return;}
  if(kind==='payment'){if(!d.invoice){navigate('d/'+d.id);return;}cur=null;renderSheet(paymentView(d),false);return;}
 cur=null;preparePdf(d);lastState=F.etatDossier(d);
 if(kind==='d')renderSheet(dossier(d),false);else if(kind==='document')renderSheet(documentView(d),true);else if(kind==='options')renderSheet(optionsView(d),false);else if(kind==='status')renderSheet(statusView(d),false);else if(kind==='sign'&&AppConfig.features.signature){renderSheet(signView(d),false);initSignature();}else navigate('');
}
function checkReady(d){const m=F.missing(d);if(m.length){toast('Il manque : '+m.join(', '));return false;}return true;}
function pdfKey(d){return JSON.stringify([d.num,d.date,d.client,d.site,d.obj,d.lines,d.tva,d.signature||null]);}
function preparePdf(d){if(!d||!d.num||!d.client.name.trim()||!d.lines.length||d.lines.some(l=>Calc.parseNum(l.price)===null))return null;const sig=pdfKey(d),old=prepared.get(d.id);if(old&&old.signature===sig)return old;
 try{const doc=PDFDevis.build(d),blob=doc.output('blob'),name='Devis_'+d.num+'_RenovExpress.pdf',entry={signature:sig,blob,name,file:new File([blob],name,{type:'application/pdf'})};prepared.set(d.id,entry);return entry;}catch(e){prepared.delete(d.id);toast('Le PDF n’a pas pu être préparé.');return null;}}
function downloadPDF(d){const f=preparePdf(d);if(!f){toast('Complétez le nom et les prestations pour créer le PDF.');return;}PDFShare.download(f);toast('PDF téléchargé');}
function updateDoc(d){if(saveQuote(d)){rendreGains();if(routeKind&&routeKind!=='edit')route();return true;}return false;}
function sendPDF(d){if(!checkReady(d))return;const f=prepared.get(d.id);if(!f||f.signature!==pdfKey(d)){preparePdf(d);toast('PDF préparé. Touchez à nouveau « Envoyer le devis ».');return;}
 const fallback=()=>{PDFShare.download(f);downloaded.add(d.id);toast('PDF téléchargé. Après votre envoi, confirmez-le dans la fiche.');if(routeKind==='d')route();};
 let native=false;try{native=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[f.file]}));}catch(e){}
 if(native){try{navigator.share({files:[f.file]}).then(()=>{downloaded.add(d.id);toast('Partage terminé sur cet appareil. Confirmez uniquement si le devis a bien été envoyé.');if(routeKind==='d')route();}).catch(e=>{if(e&&e.name!=='AbortError')fallback();});}catch(e){fallback();}}else fallback();
}
let signatureStrokes=[],signatureActive=null,signatureContext=null;
function redrawSignature(){const c=$('#signatureCanvas');if(!c)return;const scale=Math.min(devicePixelRatio||1,3),w=c.clientWidth,h=c.clientHeight;c.width=w*scale;c.height=h*scale;const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,0);x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#1F4E5F';x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';signatureStrokes.forEach(ps=>{x.beginPath();ps.forEach((p,i)=>i?x.lineTo(p.x*w,p.y*h):x.moveTo(p.x*w,p.y*h));x.stroke();});signatureContext=x;}
function initSignature(){signatureStrokes=[];signatureActive=null;redrawSignature();const c=$('#signatureCanvas'),point=e=>{const r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 c.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();signatureActive=[point(e)];signatureStrokes.push(signatureActive);c.setPointerCapture(e.pointerId);$('#signError').textContent='';});
 c.addEventListener('pointermove',e=>{if(!signatureActive)return;e.preventDefault();signatureActive.push(point(e));redrawSignature();});['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev,()=>signatureActive=null));
}
function confirmSignature(d){const length=signatureStrokes.reduce((sum,ps)=>sum+ps.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-ps[i].x,p.y-ps[i].y),0),0);if(length<.06){$('#signError').textContent='Tracez votre signature dans le cadre.';return;}if(!$('#signConsent').checked){$('#signError').textContent='Cochez la case « Bon pour accord ».';return;}
 const copy=clone(d),when=new Date().toISOString();copy.signature={data:$('#signatureCanvas').toDataURL('image/png'),name:d.client.name,signedAt:when};copy.status='signed';copy.signedAt=when;if(saveQuote(copy)){navigate('d/'+d.id);rendreGains();toast('Devis signé · signature intégrée au PDF');}}
function changeStatus(d,status){const copy=clone(d);if(d.invoice)return false;if(status==='invoiced')return issueInvoice(d);if(status!=='draft'&&!checkReady(copy))return false;if(status==='sent'&&!confirm('Confirmez-vous avoir réellement envoyé le devis au client ?'))return false;if(status==='deposit'&&!confirm('Confirmez-vous avoir réellement reçu l’acompte ?'))return false;if(status==='invoiced'&&!confirm('Marquer ce devis comme facturé dans le suivi ? Ceci ne crée PAS de facture PDF ni de numéro de facture.'))return false;if(status==='signed'&&!copy.signature&&!confirm('Confirmez-vous que le client a réellement signé ? Aucune signature électronique ne sera créée.'))return false;if(copy.signature&&['draft','ready','sent'].includes(status)){if(!confirm('Ce changement effacera la signature. Conservez le PDF signé avant de continuer.'))return false;delete copy.signature;delete copy.signedAt;}
 copy.status=status==='ready'?'draft':status;const now=new Date().toISOString();if(status==='sent'&&!copy.sentAt)copy.sentAt=now;if(status==='signed'&&!copy.signedAt)copy.signedAt=now;if(status==='deposit'&&!copy.depositAt)copy.depositAt=now;if(status==='invoiced'&&!copy.invoicedAt)copy.invoicedAt=now;if(saveQuote(copy)){navigate('d/'+d.id);rendreGains();toast('Statut : '+LIB[F.etatDossier(copy)]);return true;}return false;}
function doAction(action,id,el){const d=find(id)||(cur&&cur.id===id?cur:null);
 if(action==='back'){navigate(parentRoute());return;}if(action==='backup'){backupData();return;}if(action==='company'){navigate('company');return;}if(action==='saveCompany'){saveCompany();return;}if(action==='explorer'){EXPLORER=!EXPLORER;rendreGains();return;}
 if(action==='newTarif'){navigate('tarif/'+tarifs.length);return;}
 if(action==='resetTarifs'){if(confirm('Remettre les tarifs d’origine ? Vos modifications seront remplacées.')){const next=clone(DEFAULT_TARIFS);if(store(K.tarifs,next)){tarifs=next;route();}}return;}
 if(action==='saveTarif'){const val=k=>body.querySelector('[data-field="t.'+k+'"]').value.trim(),price=Calc.parseNum(val('price'));if(!val('label'))return toast('Indiquez la prestation.');if(val('price')&&(price===null||price<0))return toast('Prix incorrect.');const next=clone(tarifs),i=+id;next[i]={...(tarifs[i]||{}),code:val('code'),label:val('label'),unit:val('unit'),price,note:val('note')};if(store(K.tarifs,next)){tarifs=next;navigate('tarifs');toast('Tarif enregistré');}return;}
 if(action==='deleteTarif'){if(confirm('Supprimer ce tarif ?')){const next=clone(tarifs);next.splice(+id,1);if(store(K.tarifs,next)){tarifs=next;navigate('tarifs');}}return;}
 if(action==='clearSignature'){signatureStrokes=[];redrawSignature();return;}
 if(action==='demoOff'){if(!confirm('Retirer les devis d’exemple fictifs ? Vos propres devis sont conservés.'))return;const next=D.filter(x=>!x.demo);if(store(K.devis,next)){D=next;store(K.demo,'off');rendreGains();route();toast('Exemples fictifs retirés');}return;}
 if(action==='demoOn'){const have=new Set(D.map(x=>x.id)),next=D.concat(demonstration().filter(x=>!have.has(x.id)));if(store(K.devis,next)){D=next;store(K.demo,'on');rendreGains();route();toast('Exemples fictifs remis');}return;}
 if(!d)return;
 if(['document','options','status','contact'].includes(action)){navigate(action+'/'+d.id);return;}
 if(action==='recordDeposit'){changeStatus(d,'deposit');return;}
 if(action.startsWith('manual-')){changeStatus(d,action.slice(7));return;}
 if(action==='dossier'){flush();if(!find(d.id)){toast('Ajoutez un nom ou une prestation pour enregistrer ce devis.');return;}navigate('d/'+d.id);return;}
 if(action==='edit'){if(d.invoice||['signed','deposit','invoiced'].includes(d.status)){toast('Devis accepté : créez un duplicata pour toute modification.');return;}navigate('edit/'+d.id);return;}
 if(action==='unlock'){if(d.invoice){toast('Facture émise : modification impossible.');return;}if(confirm('Modifier ce devis effacera sa signature et le remettra en brouillon. Conservez le PDF signé avant de continuer.')){delete cur.signature;delete cur.signedAt;cur.status='draft';saveQuote(cur);route();}return;}
 if(action==='save'){if(saveQuote(cur)){navigate('d/'+cur.id);rendreGains();toast('Devis enregistré');}else toast('Ajoutez un nom ou une prestation.');return;}
 if(action==='pick'){navigate('pick/'+d.id);return;}
 if(action==='free'){cur.lines.push({code:'',label:'',qty:1,unit:'u',price:null});saveQuote(cur);scrollLast=true;route();return;}
 if(action==='deleteLine'){if(confirm('Supprimer cette prestation ?')){cur.lines.splice(+el.dataset.i,1);saveQuote(cur);route();}return;}
 if(action==='send'){sendPDF(d);return;}if(action==='download'){downloadPDF(d);return;}
 if(action==='confirmSent'){if(changeStatus(d,'sent'))downloaded.delete(d.id);return;}
 if(action==='sign'){if(!AppConfig.features.signature)return toast('Signature désactivée sur cette version.');if(checkReady(d))navigate('sign/'+d.id);return;}
 if(action==='confirmSignature'){confirmSignature(d);return;}
  if(action==='downloadInvoice'){downloadInvoice(d);return;}
  if(action==='payment'){navigate('payment/'+d.id);return;}
  if(action==='savePayment'){savePayment(d);return;}
 if(action==='duplicate'){flush();cur=blank();cur.client=clone(d.client);cur.site=d.site;cur.obj=d.obj;cur.lines=clone(d.lines);cur.tva=d.tva;cur.demo=!!d.demo;if(saveQuote(cur)){navigate('edit/'+cur.id);rendreGains();toast('Copie créée avec un nouveau numéro');}return;}
 if(action==='invoiced'||action==='issueInvoice'){issueInvoice(d);return;}
}
document.addEventListener('click',e=>{
 const theme=e.target.closest('[data-theme-choice]');if(theme){const saved=Appearance.select(theme.dataset.themeChoice);route();toast(saved?'Thème mémorisé':'Thème appliqué · mémorisation indisponible');return;}
 const contact=e.target.closest('[data-contact]');if(contact){if(contact.dataset.contact==='email'&&/^mailto:\?/.test(contact.getAttribute('href')))toast('Pas d’email pour ce client : choisissez le destinataire dans votre messagerie.');return;}
 const archive=e.target.closest('[data-history]');if(archive){if(archive.dataset.history==='invoices'&&!AppConfig.features.invoicing)return; navigate('history/'+archive.dataset.history);return;}
 const act=e.target.closest('[data-action]');if(act){doAction(act.dataset.action,act.dataset.id||routeId,act);return;}
 const status=e.target.closest('[data-status]');if(status){changeStatus(find(status.dataset.id),status.dataset.status);return;}
 const tva=e.target.closest('[data-tva]');if(tva&&cur&&!cur.signature){cur.tva=+tva.dataset.tva;$('#editTotals').innerHTML=totalsHTML(cur);body.querySelectorAll('[data-tva]').forEach(b=>b.classList.toggle('on',+b.dataset.tva===cur.tva));saveQuote(cur);return;}
 const t=e.target.closest('[data-tarif]');if(t){if(t.dataset.pick){const item=tarifs[+t.dataset.tarif];cur.lines.push({code:item.code,label:item.label,qty:1,unit:item.unit,price:Calc.parseNum(item.price)});saveQuote(cur);scrollLast=true;navigate('edit/'+cur.id);}else navigate('tarif/'+t.dataset.tarif);return;}
 const r=e.target.closest('[data-open]');if(r){navigate('d/'+r.dataset.open);return;}
 if(e.target.closest('#hero.vedette')&&HEROD)navigate('d/'+HEROD.id);
});
document.addEventListener('input',e=>{const inp=e.target;
 if(inp.id==='tarifSearch'){$('#tarifRows').innerHTML=tariffRows(inp.value,routeKind==='pick');return;}
 if(inp.id==='historySearch'){$('#historyRows').innerHTML=historyRows(inp.value);return;}
 const key=inp.dataset.field;if(!cur||routeKind!=='edit'||!key||cur.signature)return;
 if(key.startsWith('client.')){const k=key.slice(7);cur.client[k]=inp.value;if(k==='name'){delete cur.client.title;delete cur.client.lastName;}}
 else if(key.startsWith('line.')){const [,i,k]=key.split('.');cur.lines[+i][k]=['qty','price'].includes(k)?Calc.parseNum(inp.value):inp.value;const card=inp.closest('[data-line]');card.querySelector('[data-line-total]').textContent=Calc.money(Calc.lineTotalCents(cur.lines[+i])/100);$('#editTotals').innerHTML=totalsHTML(cur);}
 else cur[key]=inp.value;persistEdit();
});
document.addEventListener('change',e=>{if(e.target.id==='restoreInput'){const file=e.target.files&&e.target.files[0];restoreData(file);e.target.value='';return;}if(cur&&routeKind==='edit'&&e.target.dataset.field)flush();});
document.addEventListener('keydown',e=>{
 const el=e.target;if(el.matches('.row[role="button"]')&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}
 if(e.key==='Escape'&&sheet.classList.contains('open'))navigate(parentRoute());
 if(e.key==='Tab'&&sheet.classList.contains('open')){const all=[...sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(x=>x.getClientRects().length),first=all[0],last=all[all.length-1];if(e.shiftKey&&el===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&el===last){e.preventDefault();first.focus();}}
});
const statusFilter=$('#homeStatusFilter');if(statusFilter)statusFilter.addEventListener('change',()=>{GLOBAL_STATUS=statusFilter.value;rendreGains();});
const search=$('#globalSearch'),clearSearch=$('#clearGlobalSearch');if(search){search.addEventListener('input',()=>{GLOBAL_QUERY=search.value;clearSearch.hidden=!GLOBAL_QUERY;rendreGains();});if(clearSearch)clearSearch.onclick=()=>{search.value='';GLOBAL_QUERY='';clearSearch.hidden=true;rendreGains();search.focus();};}
document.addEventListener('pointerdown',e=>{if(e.target.closest('button,.act,.svc')&&typeof navigator.vibrate==='function')navigator.vibrate(8);},{passive:true});
$('#appearance').onclick=()=>navigate('appearance');$('#newQuote').onclick=newQuote;$('#tarifs').onclick=()=>navigate('tarifs');$('#history').onclick=()=>navigate('history');backdrop.onclick=()=>navigate('');
let grabY=null,grabDelta=0;$('#grab').addEventListener('pointerdown',e=>{grabY=e.clientY;grabDelta=0;$('#grab').setPointerCapture(e.pointerId);});$('#grab').addEventListener('pointermove',e=>{if(grabY!==null)grabDelta=e.clientY-grabY;});$('#grab').addEventListener('pointerup',()=>{if(grabY===null)return;grabY=null;if(grabDelta>80)navigate(parentRoute());else if(grabDelta<-40||Math.abs(grabDelta)<6){expandSheet();}});
body.addEventListener('scroll',()=>{if(body.scrollTop>12){expandSheet();}});
function refreshClock(){rendreGains();const d=find(routeId);if(routeKind==='d'&&d&&F.etatDossier(d)!==lastState)route();}
addEventListener('hashchange',route);addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else refreshClock();});let viewportFrame=null;
function fitViewport(){if(viewportFrame)cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(()=>{viewportFrame=null;originBox=boxOf(sourceElement()||$('#hero'));if(sheet.classList.contains('open')){const G=geom(),h=sheet.classList.contains('big')?G.height-HAUT():measurePanel(body.innerHTML,false);sheet.style.transition='none';setBox(sheet,{top:G.top+G.height-h,left:G.left,width:G.width,height:h});sheet.getBoundingClientRect();sheet.style.transition='';fitSheetContent();}if(routeKind==='sign')redrawSignature();});}
addEventListener('resize',fitViewport);addEventListener('orientationchange',fitViewport);if(screen.orientation?.addEventListener)screen.orientation.addEventListener('change',fitViewport);if(window.visualViewport){visualViewport.addEventListener('resize',fitViewport);visualViewport.addEventListener('scroll',fitViewport);}setInterval(refreshClock,60000);
const network=()=>$('#horsligne').hidden=navigator.onLine!==false;addEventListener('online',network);addEventListener('offline',network);network();
PDFDevis.loadLogo('logo.png').then(()=>{prepared.clear();D.forEach(preparePdf);});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
rendreGains();route();
})();
