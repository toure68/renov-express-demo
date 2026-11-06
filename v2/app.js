/* Rénov’Express — AutoDroits visual components, local quote engine. */
(function(){
'use strict';
const $=s=>document.querySelector(s),F=QuoteFlow,K={devis:'re_v2_devis',tarifs:'re_v2_tarifs',counter:'re_v2_counter_'};
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
 const docs=[make('demo-claire','D2026-042','Claire Dubois','Rénovation séjour et chambre',2847,10,'sent',6,'Madame','Dubois'),make('demo-paul','D2026-043','Paul Martin','Peinture cuisine',1033.33,20,'draft',0,'Monsieur','Martin'),make('demo-sophie','D2026-044','Sophie Bernard','Plafonds et boiseries',2066.67,20,'signed',2,'Madame','Bernard'),make('demo-karim','D2026-045','Karim Benali','Peinture du séjour',500,10,'draft',0,'Monsieur','Benali'),make('demo-julie','D2026-046','Julie Moreau','Couloir et entrée',809.09,10,'sent',1,'Madame','Moreau')];
 docs[3].client.email='';return docs;
}
let D=load(K.devis,null);if(!Array.isArray(D)){D=demonstration();store(K.devis,D);}
let tarifs=load(K.tarifs,null);if(!Array.isArray(tarifs)){tarifs=clone(DEFAULT_TARIFS);store(K.tarifs,tarifs);}
let cur=null,saveTimer,EXPLORER=false,HEROD=null,toastTimer,focusBefore=null,routeKind='',routeId='',lastState='',scrollLast=false;
const prepared=new Map(),downloaded=new Set(),sheet=$('#sheet'),body=$('#service'),backdrop=$('#sbg');
function toast(msg){const box=$('#island');box.innerHTML='<div class="mini" style="white-space:normal;padding:4px 7px">'+esc(msg)+'</div>';box.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),3600);}
function total(d){return Calc.money(Calc.totals(d).ttc);}
function find(id){return D.find(x=>x.id===id);}
function nextNumber(){const y=new Date().getFullYear(),key=K.counter+y;let n=load(key,y===2026?COMPANY.lastNumber:0);D.forEach(d=>{const m=/^D(\d{4})-(\d+)$/.exec(d.num);if(m&&+m[1]===y)n=Math.max(n,+m[2]);});store(key,++n);return'D'+y+'-'+String(n).padStart(3,'0');}
function saveQuote(d){
 if(!d||(!(d.client.name||'').trim()&&!d.lines.length&&!(d.obj||'').trim()))return false;
 if(!d.num)d.num=nextNumber();d.updated=Date.now();const next=D.slice(),i=next.findIndex(x=>x.id===d.id);if(i<0)next.push(clone(d));else next[i]=clone(d);
 if(!store(K.devis,next))return false;D=next;preparePdf(d);return true;
}
function flush(){clearTimeout(saveTimer);if(cur&&routeKind==='edit')saveQuote(cur);}
function persistEdit(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(cur){saveQuote(cur);const n=$('#editNumber');if(n)n.textContent=cur.num||'Nouveau devis';rendreGains();}},400);}
function blank(){return{id:uid(),num:'',date:localISO(new Date()),client:{name:'',addr:'',email:'',tel:''},site:'',obj:'',lines:[],tva:10,status:'draft',createdAt:new Date().toISOString(),demo:false};}
function newQuote(){flush();cur=blank();navigate('edit/'+cur.id);}
const IC={doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9ZM14 3v6h6M8 13h8M8 17h5"/>',down:'<path d="m6 9 6 6 6-6"/>',euro:'<path d="M18 5a7 7 0 1 0 0 14M4 10h11M4 14h10"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const ico=(k,color='#fff')=>'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+IC[k]+'</svg>';
const logo=(d,size)=>'<span class="bt"'+(size?' style="--sz:'+size+'px"':'')+'>'+ico('doc','#1F4E5F').replace('width="20" height="20"','')+'</span>';
const back='<button class="back" data-action="back" aria-label="Fermer">'+ico('down')+'</button>';
const LIB={late:'À relancer',ready:'Prêt à envoyer',draft:'Brouillon',signed:'Signé',sent:'Envoyé',deposit:'Acompte reçu',invoiced:'Facturé'};
const CLS={late:'late',ready:'ready',draft:'draft',signed:'ok',sent:'wait',deposit:'ok',invoiced:'watch'};
function pill(d){const st=F.etatDossier(d);return'<span class="pill '+CLS[st]+'">'+LIB[st]+'</span>';}
function frise(d){const st=F.etatDossier(d),i=F.ETAPES.findIndex(x=>x[0]===(st==='late'?'sent':st));return'<ol class="frise" aria-label="Étapes du devis">'+F.ETAPES.map((x,j)=>'<li class="'+(j<i?'ok':j===i?'cur':'')+'"'+(j===i?' aria-current="step"':'')+'>'+x[1]+'</li>').join('')+'</ol>';}
function row(d){return'<div class="row" role="button" tabindex="0" data-open="'+esc(d.id)+'" aria-label="'+esc(d.client.name+' · '+LIB[F.etatDossier(d)])+'"><div class="l">'+logo(d)+'<div class="re-client"><div class="t">'+esc(d.client.name||'Client à renseigner')+'</div><div class="s">'+esc(d.obj||'Objet à préciser')+'</div></div></div><div class="r"><div class="v">'+total(d)+'</div>'+pill(d)+'</div></div>';}
function summary(){return F.totalsSummary(D);}
function demoBadge(d){return d&&d.demo?'<span class="demo">Démonstration · fictif</span>':'';}
function primaryButton(action,id,text){return'<button class="cta" data-action="'+action+'" data-id="'+esc(id)+'">'+text+'</button>';}
function secondaryButton(action,id,text){return'<button class="all" data-action="'+action+'" data-id="'+esc(id)+'">'+text+'</button>';}
function addressForWhatsApp(d,msg){const tel=(d.client.tel||'').replace(/[\s().-]/g,'');return'https://wa.me/'+(/^\+\d{8,15}$/.test(tel)?tel.slice(1):'')+'?text='+encodeURIComponent(msg);}
function depositMessage(d){const c=d.client,who=c.title&&c.lastName?c.title+' '+c.lastName:c.name;return'Bonjour '+who+', merci pour votre accord sur le devis '+d.num+'. L’acompte de 30 % s’élève à '+Calc.money(Calc.totals(d).acompte)+'. Pouvez-vous procéder au règlement selon les conditions du devis ? Merci.';}
function whatsappButton(d,kind,text,extra='') {const msg=kind==='relance'?F.relanceMessage(d):depositMessage(d);return'<a class="cta re-link '+extra+'" data-whatsapp="'+kind+'" href="'+esc(addressForWhatsApp(d,msg))+'" target="_blank" rel="noopener noreferrer">'+text+'</a>';}
function actionHTML(d,action,text){return action==='relance'||action==='deposit'?whatsappButton(d,action,text):primaryButton(action,d.id,text);}
function rendreHero(){const h=$('#hero'),d=F.prioritaire(D);HEROD=d;
 if(!d){h.className='hero';h.innerHTML='<div class="lbl">Mes devis</div>'+(D.some(x=>x.demo)?'<div class="demo">Démonstration · fictif</div>':'')+'<div class="amount">'+Calc.money(D.filter(x=>['sent','late'].includes(F.etatDossier(x))).reduce((n,x)=>n+Calc.totals(x).ttc,0))+'</div><div class="paid">'+esc(summary())+'</div>';return;}
 const info=F.heroInfo(d);h.className='hero vedette'+(F.etatDossier(d)==='late'?' alerte':'');
 h.innerHTML='<div class="hv-t"><span class="lbl">'+info.tag+'</span>'+demoBadge(d)+'</div><div class="hv-d">'+logo(d)+'<div class="hv-m"><b>'+esc(d.client.name||'Nouveau devis')+'</b><span>'+esc(info.txt)+'</span></div><div class="hv-v">'+total(d)+'</div></div>'+actionHTML(d,info.action,info.cta).replace('class="cta','class="cta hv-go')+'<div class="hv-tot">'+esc(summary())+'</div>';
 preparePdf(d);
}
function rendreGains(){rendreHero();const list=D.filter(F.needsAttention).sort(F.ordre),visible=EXPLORER?list:list.slice(0,3),remaining=list.length-visible.length;
 $('#exampleLabel').textContent=D.some(d=>d.demo)?'exemples fictifs':'';
 $('#gains').innerHTML=visible.map(row).join('')+(list.length?'':'<p class="empty">Aucun devis à suivre pour le moment.</p>');
 $('#quoteExplorer').innerHTML=(remaining>0?'<button class="all explorer" data-action="explorer">Explorer · '+remaining+' autre'+(remaining>1?'s':'')+'</button>':EXPLORER&&list.length>3?'<button class="all explorer" data-action="explorer">Réduire</button>':'');
 const quotes=F.historyDocuments(D,'quotes').length,invoices=F.historyDocuments(D,'invoices').length;
 $('#quotesCount').textContent=quotes+' devis';
 $('#invoicesCount').textContent=invoices+' document'+(invoices>1?'s':'')+' facturé'+(invoices>1?'s':'');
}
function head(title,sub,d){return'<div class="top">'+back+(d?logo(d,46):'')+'<div class="re-client"><div class="ttl" id="sheetTitle">'+esc(title)+'</div><div class="sub">'+esc(sub||'')+'</div></div></div>';}
function contextButtons(d){const st=F.etatDossier(d);let action,text;
 if(st==='late'){action='relance';text='Relancer';}else if(st==='ready'){action='send';text='Envoyer le devis';}else if(st==='draft'){action='edit';text='Compléter';}else if(st==='signed'){action='deposit';text='Demander l’acompte';}else if(st==='sent'){action='sign';text='Faire signer le client';}else if(st==='deposit'){action='invoiced';text='Marquer comme facturé';}else{return'<div class="actbar">'+primaryButton('document',d.id,'Voir le devis')+'</div>';}
 return'<div class="actbar">'+actionHTML(d,action,text)+secondaryButton(downloaded.has(d.id)&&st==='ready'?'confirmSent':'document',d.id,downloaded.has(d.id)&&st==='ready'?'Confirmer l’envoi':'Voir le devis')+'</div>';
}
function dossier(d){const st=F.etatDossier(d),info=F.heroInfo(d),amounts=Calc.totals(d),late=st==='late';
 return head(d.client.name||'Nouveau devis',d.obj,d)+frise(d)+'<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="tag" style="color:'+(late?'var(--alert)':st==='sent'?'var(--amber)':'var(--green)')+'">'+LIB[st]+'</span><b style="font-size:18px">'+total(d)+'</b></div>'+demoBadge(d)+'<ul class="steps" style="margin-top:12px"><li class="ok">Devis '+esc(d.num)+'<small>Créé le '+displayDate(d.date)+'</small></li>'+(d.sentAt?'<li class="ok">Devis envoyé<small>'+displayTime(d.sentAt)+'</small></li>':'')+(d.signedAt?'<li class="ok">Accord du client<small>'+displayTime(d.signedAt)+(d.signature?' · signature recueillie':' · statut enregistré manuellement')+'</small></li>':'')+'<li>'+esc(info.txt)+'</li></ul>'+(late?'<div class="cd late"><div class="l1"><span>Aucune réponse de '+esc(d.client.name)+'</span><b>+'+F.days(d)+' j</b></div><div class="bar"><i style="width:100%"></i></div></div>':'')+'</div>'+(late?'<div class="hint"><span>Une relance double souvent les chances de signature</span></div>':'')+(st==='signed'?'<div class="cd"><div class="l1"><span>Acompte de 30 % à demander</span><b>'+Calc.money(amounts.acompte)+'</b></div></div>':'')+contextButtons(d);
}
function documentView(d){const t=Calc.totals(d);return head(d.num,'Devis de peinture',d)+demoBadge(d)+'<div class="card"><span class="tag">Client</span><h3>'+esc(d.client.name)+'</h3><p>'+esc(d.client.addr)+'<br>'+esc(d.client.email)+(d.client.tel?'<br>'+esc(d.client.tel):'')+'</p></div><div class="card"><span class="tag">Chantier</span><h3>'+esc(d.obj||'Travaux de peinture')+'</h3><p>'+esc(d.site||d.client.addr)+'</p></div><div class="card"><span class="tag">Prestations</span>'+d.lines.map(l=>'<div class="opt"><span>'+esc(l.label)+'<small>'+esc(Calc.qty(l.qty))+' '+esc(l.unit)+' × '+Calc.money(l.price)+' HT</small></span><b>'+Calc.money(Calc.lineTotalCents(l)/100)+'</b></div>').join('')+'</div><div class="card">'+[['Total HT',t.ht],['TVA '+d.tva+' %',t.tva],['Total TTC',t.ttc],['Acompte 30 %',t.acompte]].map(x=>'<div class="opt'+(x[0]==='Total TTC'?' re-total-ttc':'')+'"><span>'+x[0]+'</span><b>'+Calc.money(x[1])+'</b></div>').join('')+'</div>'+(d.signature?'<div class="card"><span class="tag">Bon pour accord</span><p>Signé le '+displayTime(d.signature.signedAt)+'</p><img class="re-signature" src="'+d.signature.data+'" alt="Signature du client"></div>':'')+'<details class="lettre"><summary>Mentions et rétractation</summary><div>Le PDF reprend les mentions de la V1, les conditions de paiement, la validité de '+COMPANY.validityDays+' jours, l’assurance décennale, le médiateur et le formulaire de rétractation. Les coordonnées d’entreprise sont fictives dans cette démonstration.</div></details><div class="actbar">'+primaryButton('download',d.id,'Télécharger le PDF')+secondaryButton('options',d.id,'Options du devis')+'</div>';}
function optionsView(d){return head('Options du devis',d.num,d)+'<div class="card"><div class="chxs"><button class="chx" data-action="edit" data-id="'+d.id+'">Modifier le devis</button><button class="chx" data-action="duplicate" data-id="'+d.id+'">Dupliquer</button><button class="chx" data-action="status" data-id="'+d.id+'">Changer le statut</button></div></div>';}
function field(label,key,value,type='text',area=false){return'<label class="re-field">'+label+(area?'<textarea data-field="'+key+'" rows="2">'+esc(value)+'</textarea>':'<input data-field="'+key+'" type="'+type+'" value="'+esc(value)+'"'+(type==='email'?' autocomplete="email"':type==='tel'?' inputmode="tel"':/\.(price|qty)$/.test(key)?' inputmode="decimal"':'')+'>')+'</label>';}
function editView(d){return head(d.num||'Nouveau devis','Devis de peinture',d)+'<div class="fine" style="text-align:left" id="editNumber">'+esc(d.num||'Nouveau devis')+'</div>'+demoBadge(d)+'<fieldset'+(d.signature?' disabled':'')+'><div class="card"><span class="tag">Client</span>'+field('Nom','client.name',d.client.name)+field('Adresse','client.addr',d.client.addr,'text',true)+field('Email','client.email',d.client.email,'email')+field('Téléphone','client.tel',d.client.tel,'tel')+'</div><div class="card"><span class="tag">Chantier</span>'+field('Objet','obj',d.obj)+field('Adresse du chantier','site',d.site,'text',true)+'</div><h2>Prestations</h2><div id="editLines">'+linesHTML(d)+'</div>'+secondaryButton('pick',d.id,'Ajouter une prestation')+secondaryButton('free',d.id,'Ajouter une ligne libre')+'<div class="card"><span class="tag">TVA</span><div class="re-tva"><button data-tva="10" class="'+(+d.tva===10?'on':'')+'">10 %</button><button data-tva="20" class="'+(+d.tva===20?'on':'')+'">20 %</button></div><div id="editTotals">'+totalsHTML(d)+'</div></div></fieldset>'+(d.signature?'<div class="hint">Ce devis est signé. Pour le modifier, vous devez d’abord retirer sa signature.</div>':'')+'<div class="actbar">'+primaryButton(d.signature?'unlock':'save',d.id,d.signature?'Retirer la signature pour modifier':'Enregistrer le devis')+secondaryButton('dossier',d.id,'Voir la fiche')+'</div><p class="fine">Enregistrement automatique sur cet appareil.</p>';}
function linesHTML(d){return d.lines.map((l,i)=>'<div class="card re-line" data-line="'+i+'">'+field('Prestation','line.'+i+'.label',l.label,'text',true)+'<div class="re-grid three">'+field('Quantité','line.'+i+'.qty',Calc.qty(l.qty,''))+field('Unité','line.'+i+'.unit',l.unit)+field('Prix HT €','line.'+i+'.price',l.price===null?'':String(l.price).replace('.',','))+'</div><div class="re-foot"><button class="lien" data-action="deleteLine" data-i="'+i+'">Supprimer</button><b data-line-total>'+Calc.money(Calc.lineTotalCents(l)/100)+'</b></div>'+(l.price===null?'<p class="re-error">Prix à saisir : prestation sur devis.</p>':'')+'</div>').join('')||'<p class="empty">Aucune prestation pour l’instant.</p>';}
function totalsHTML(d){const t=Calc.totals(d);return[['Total HT',t.ht],['TVA '+d.tva+' %',t.tva],['Total TTC',t.ttc],['Acompte 30 %',t.acompte]].map(x=>'<div class="opt'+(x[0]==='Total TTC'?' re-total-ttc':'')+'"><span>'+x[0]+'</span><b>'+Calc.money(x[1])+'</b></div>').join('');}
function priceLabel(t){const p=Calc.parseNum(t.price);return p===null?'Sur devis':Calc.money(p)+(t.unit?' / '+esc(t.unit):'');}
function tariffRows(filter,pick){const q=norm(filter);return tarifs.map((t,i)=>({t,i})).filter(x=>!q||norm(x.t.label+' '+x.t.code+' '+x.t.note).includes(q)).map(({t,i})=>'<div class="row" role="button" tabindex="0" data-tarif="'+i+'"'+(pick?' data-pick="1"':'')+'><div class="l">'+logo(t)+'<div class="re-client"><div class="t">'+esc(t.label)+'</div><div class="s">'+esc([t.code,t.note].filter(Boolean).join(' · '))+'</div></div></div><div class="r"><div class="v" style="font-size:13px">'+priceLabel(t)+'</div></div></div>').join('')||'<p class="empty">Aucun tarif trouvé.</p>';}
function tariffView(pick){return head(pick?'Choisir une prestation':'Mes tarifs',pick?'Ajouter au devis':'Tarifs modifiables')+'<input type="search" class="re-search" id="tarifSearch" placeholder="Rechercher une prestation…" aria-label="Rechercher une prestation"><section class="list" id="tarifRows">'+tariffRows('',pick)+'</section>'+(pick?'':'<div class="actbar">'+primaryButton('newTarif','', 'Ajouter un tarif')+secondaryButton('resetTarifs','','Remettre les tarifs d’origine')+'</div>');}
function editTariffView(idx){const t=tarifs[idx]||{code:'',label:'',unit:'',price:null,note:''};return head(tarifs[idx]?'Modifier le tarif':'Ajouter un tarif','Mes tarifs')+'<div class="card">'+field('Code','t.code',t.code)+field('Prestation','t.label',t.label,'text',true)+field('Unité','t.unit',t.unit)+field('Prix HT € · vide = sur devis','t.price',t.price===null?'':String(t.price).replace('.',','))+field('Remarque','t.note',t.note,'text',true)+'</div><div class="actbar">'+primaryButton('saveTarif',idx,'Enregistrer le tarif')+(tarifs[idx]?secondaryButton('deleteTarif',idx,'Supprimer ce tarif'):'')+'</div>';}
function statusView(d){return head('Changer le statut',d.num,d)+'<div class="card"><div class="chxs">'+[['draft','Brouillon'],['ready','Prêt à envoyer'],['sent','Envoyé'],['signed','Signé'],['deposit','Acompte reçu'],['invoiced','Facturé']].map(([st,label])=>'<button class="chx" data-status="'+st+'" data-id="'+d.id+'">'+label+(F.etatDossier(d)===st?ico('check'):'')+'</button>').join('')+'</div></div><p class="fine">Les statuts manuels ne vérifient pas le paiement ou la signature du client.</p>';}
function appearanceView(){return head('Choisir le thème','Les textes, boutons et cartes s’adaptent au fond')+'<div class="theme-list">'+Appearance.themes.map(t=>'<button class="chx theme-option" data-theme-choice="'+t.id+'" aria-pressed="'+(Appearance.selected===t.id)+'"><span class="theme-swatch" style="background:'+t.swatch+'" aria-hidden="true"></span><span class="theme-label"><span>'+t.name+'</span><small>'+t.description+'</small></span>'+(Appearance.selected===t.id?ico('check'):'')+'</button>').join('')+'</div><p class="fine">Le thème choisi est mémorisé sur cet appareil. Les couleurs des statuts conservent leur sens.</p>';}
function historyRows(query=''){const q=norm(query),list=F.historyDocuments(D,routeId).filter(d=>!q||norm(d.client.name+' '+d.num+' '+d.obj).includes(q)).sort(F.ordre);return list.map(row).join('')||'<p class="empty">'+(q?'Aucun document trouvé.':routeId==='invoices'?'Aucun document marqué « Facturé » pour le moment.':'Aucun devis enregistré.')+'</p>';}
function historyView(){const title=routeId==='quotes'?'Mes devis':routeId==='invoices'?'Mes factures':'Historique',sub=routeId==='invoices'?'Documents marqués « Facturé »':routeId==='quotes'?'Historique des devis':'Devis et documents facturés';return head(title,sub)+'<input type="search" class="re-search" id="historySearch" placeholder="Rechercher un client, un numéro…" aria-label="Rechercher un document"><section class="list" id="historyRows">'+historyRows()+'</section>';}
function signView(d){return head('Signature du client',d.num,d)+'<div class="card"><span class="tag">Bon pour accord</span><h3>'+esc(d.client.name)+'</h3><p>'+esc(d.obj)+'<br><b>'+total(d)+' TTC</b></p>'+demoBadge(d)+'<p>Signez avec votre doigt dans le cadre.</p><canvas id="signatureCanvas" aria-label="Zone de signature au doigt"></canvas><button class="lien" style="margin-top:10px" data-action="clearSignature">Effacer et recommencer</button><label class="re-consent"><input type="checkbox" id="signConsent"><span>J’ai lu ce devis, son montant et ses conditions. <b>Bon pour accord.</b></span></label><p class="re-error" id="signError" role="alert"></p></div><div class="actbar">'+primaryButton('confirmSignature',d.id,'Valider la signature')+'</div><p class="fine">Signature et date ajoutées au PDF.</p>';}
function navigate(hash){flush();if(location.hash.slice(1)===hash)route();else location.hash=hash;}
function parentRoute(){if(routeKind==='edit'||routeKind==='document'||routeKind==='sign'||routeKind==='options'||routeKind==='status')return find(routeId)?'d/'+routeId:'';if(routeKind==='pick')return'edit/'+routeId;if(routeKind==='tarif')return'tarifs';return'';}
/* AutoDroits morph: source card -> useful-height panel, then content fade. */
let originElement=null,originBox=null,originKey=null,contentTimer=null,closeTimer=null,openingFrame=null;
function geom(){const v=window.visualViewport,w=Math.min(document.documentElement.clientWidth,v?v.width:innerWidth),h=v?v.height:innerHeight,app=document.querySelector('.phone').getBoundingClientRect(),W=Math.min(w,app.width);return{top:v?v.offsetTop:0,left:(v?v.offsetLeft:0)+(w-W)/2,width:W,height:h};}
const HAUT=()=>Math.min(56,Math.max(22,Math.round(geom().height*.08)));
function setBox(el,b){for(const p in b)el.style[p]=b[p]+'px';}
function boxOf(el){if(!el)return null;const r=el.getBoundingClientRect();return{top:r.top,left:r.left,width:r.width,height:r.height};}
function measurePanel(html,full){const G=geom();if(full)return G.height-HAUT();const m=document.createElement('div');m.className='mbody half on';m.setAttribute('aria-hidden','true');m.inert=true;
 m.style.cssText='position:absolute;visibility:hidden;left:0;top:0;width:'+G.width+'px;height:auto;overflow:visible';m.innerHTML=html;document.body.appendChild(m);const h=m.offsetHeight;m.remove();return Math.min(h+2,G.height-HAUT());}
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
 if(wasOpen){setBox(sheet,target);requestAnimationFrame(reveal);}else{
  openingFrame=requestAnimationFrame(()=>{openingFrame=null;setBox(sheet,target);contentTimer=setTimeout(reveal,260);});
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
 if(kind==='appearance'){cur=null;renderSheet(appearanceView(),false);return;}
 if(kind==='history'){cur=null;renderSheet(historyView(),true);return;}
 if(kind==='tarifs'){cur=null;renderSheet(tariffView(false),true);return;}
 if(kind==='tarif'){cur=null;renderSheet(editTariffView(+id),true);return;}
 if(!d){navigate('');return;}
 if(kind==='edit'){cur=clone(d);renderSheet(editView(cur),true);if(scrollLast){scrollLast=false;const lines=body.querySelectorAll('.re-line');if(lines.length)lines[lines.length-1].scrollIntoView({block:'center'});}return;}
 if(kind==='pick'){if(!cur||cur.id!==d.id)cur=clone(d);renderSheet(tariffView(true),true);return;}
 cur=null;preparePdf(d);lastState=F.etatDossier(d);
 if(kind==='d')renderSheet(dossier(d),false);else if(kind==='document')renderSheet(documentView(d),true);else if(kind==='options')renderSheet(optionsView(d),false);else if(kind==='status')renderSheet(statusView(d),false);else if(kind==='sign'){renderSheet(signView(d),false);initSignature();}else navigate('');
}
function checkReady(d){const m=F.missing(d);if(m.length){toast('Il manque : '+m.join(', '));return false;}return true;}
function pdfKey(d){return JSON.stringify([d.num,d.date,d.client,d.site,d.obj,d.lines,d.tva,d.signature||null]);}
function preparePdf(d){if(!d||!d.num||!d.client.name.trim()||!d.lines.length||d.lines.some(l=>Calc.parseNum(l.price)===null))return null;const sig=pdfKey(d),old=prepared.get(d.id);if(old&&old.signature===sig)return old;
 try{const doc=PDFDevis.build(d),blob=doc.output('blob'),name='Devis_'+d.num+'_RenovExpress.pdf',entry={signature:sig,blob,name,file:new File([blob],name,{type:'application/pdf'})};prepared.set(d.id,entry);return entry;}catch(e){prepared.delete(d.id);toast('Le PDF n’a pas pu être préparé.');return null;}}
function downloadPDF(d){const f=preparePdf(d);if(!f){toast('Complétez le nom et les prestations pour créer le PDF.');return;}PDFShare.download(f);toast('PDF téléchargé');}
function updateDoc(d){if(saveQuote(d)){rendreGains();if(routeKind&&routeKind!=='edit')route();return true;}return false;}
function markShared(id){const current=find(id);if(!current)return;const d=clone(current);if(['draft','ready'].includes(F.etatDossier(d))){d.status='sent';d.sentAt=new Date().toISOString();}d.sharedAt=new Date().toISOString();if(updateDoc(d))toast('PDF partagé · envoi enregistré');}
function sendPDF(d){if(!checkReady(d))return;const f=prepared.get(d.id);if(!f||f.signature!==pdfKey(d)){preparePdf(d);toast('PDF préparé. Touchez à nouveau « Envoyer le devis ».');return;}
 const fallback=()=>{PDFShare.download(f);downloaded.add(d.id);toast('PDF téléchargé. Après votre envoi, confirmez-le dans la fiche.');if(routeKind==='d')route();};
 let native=false;try{native=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[f.file]}));}catch(e){}
 if(native){try{navigator.share({files:[f.file]}).then(()=>markShared(d.id)).catch(e=>{if(e&&e.name!=='AbortError')fallback();});}catch(e){fallback();}}else fallback();
}
let signatureStrokes=[],signatureActive=null,signatureContext=null;
function redrawSignature(){const c=$('#signatureCanvas');if(!c)return;const scale=Math.min(devicePixelRatio||1,3),w=c.clientWidth,h=c.clientHeight;c.width=w*scale;c.height=h*scale;const x=c.getContext('2d');x.setTransform(scale,0,0,scale,0,0);x.fillStyle='#fff';x.fillRect(0,0,w,h);x.strokeStyle='#1F4E5F';x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';signatureStrokes.forEach(ps=>{x.beginPath();ps.forEach((p,i)=>i?x.lineTo(p.x*w,p.y*h):x.moveTo(p.x*w,p.y*h));x.stroke();});signatureContext=x;}
function initSignature(){signatureStrokes=[];signatureActive=null;redrawSignature();const c=$('#signatureCanvas'),point=e=>{const r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
 c.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();signatureActive=[point(e)];signatureStrokes.push(signatureActive);c.setPointerCapture(e.pointerId);$('#signError').textContent='';});
 c.addEventListener('pointermove',e=>{if(!signatureActive)return;e.preventDefault();signatureActive.push(point(e));redrawSignature();});['pointerup','pointercancel'].forEach(ev=>c.addEventListener(ev,()=>signatureActive=null));
}
function confirmSignature(d){const length=signatureStrokes.reduce((sum,ps)=>sum+ps.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-ps[i].x,p.y-ps[i].y),0),0);if(length<.06){$('#signError').textContent='Tracez votre signature dans le cadre.';return;}if(!$('#signConsent').checked){$('#signError').textContent='Cochez la case « Bon pour accord ».';return;}
 const copy=clone(d),when=new Date().toISOString();copy.signature={data:$('#signatureCanvas').toDataURL('image/png'),name:d.client.name,signedAt:when};copy.status='signed';copy.signedAt=when;if(saveQuote(copy)){navigate('d/'+d.id);rendreGains();toast('Devis signé · signature intégrée au PDF');}}
function changeStatus(d,status){const copy=clone(d);if(status!=='draft'&&!checkReady(copy))return;if(copy.signature&&['draft','ready','sent'].includes(status)){if(!confirm('Ce changement effacera la signature. Conservez le PDF signé avant de continuer.'))return;delete copy.signature;delete copy.signedAt;}
 copy.status=status==='ready'?'draft':status;const now=new Date().toISOString();if(status==='sent'&&!copy.sentAt)copy.sentAt=now;if(['signed','deposit','invoiced'].includes(status)&&!copy.signedAt)copy.signedAt=now;if(saveQuote(copy)){navigate('d/'+d.id);rendreGains();toast('Statut : '+LIB[F.etatDossier(copy)]);}}
function doAction(action,id,el){const d=find(id)||(cur&&cur.id===id?cur:null);
 if(action==='back'){navigate(parentRoute());return;}if(action==='explorer'){EXPLORER=!EXPLORER;rendreGains();return;}
 if(action==='newTarif'){navigate('tarif/'+tarifs.length);return;}
 if(action==='resetTarifs'){if(confirm('Remettre les tarifs d’origine ? Vos modifications seront remplacées.')){const next=clone(DEFAULT_TARIFS);if(store(K.tarifs,next)){tarifs=next;route();}}return;}
 if(action==='saveTarif'){const val=k=>body.querySelector('[data-field="t.'+k+'"]').value.trim(),price=Calc.parseNum(val('price'));if(!val('label'))return toast('Indiquez la prestation.');if(val('price')&&(price===null||price<0))return toast('Prix incorrect.');const next=clone(tarifs),i=+id;next[i]={...(tarifs[i]||{}),code:val('code'),label:val('label'),unit:val('unit'),price,note:val('note')};if(store(K.tarifs,next)){tarifs=next;navigate('tarifs');toast('Tarif enregistré');}return;}
 if(action==='deleteTarif'){if(confirm('Supprimer ce tarif ?')){const next=clone(tarifs);next.splice(+id,1);if(store(K.tarifs,next)){tarifs=next;navigate('tarifs');}}return;}
 if(action==='clearSignature'){signatureStrokes=[];redrawSignature();return;}
 if(!d)return;
 if(['document','options','status'].includes(action)){navigate(action+'/'+d.id);return;}
 if(action==='dossier'){flush();if(!find(d.id)){toast('Ajoutez un nom ou une prestation pour enregistrer ce devis.');return;}navigate('d/'+d.id);return;}
 if(action==='edit'){if(d.signature){navigate('edit/'+d.id);return;}navigate('edit/'+d.id);return;}
 if(action==='unlock'){if(confirm('Modifier ce devis effacera sa signature et le remettra en brouillon. Conservez le PDF signé avant de continuer.')){delete cur.signature;delete cur.signedAt;cur.status='draft';saveQuote(cur);route();}return;}
 if(action==='save'){if(saveQuote(cur)){navigate('d/'+cur.id);rendreGains();toast('Devis enregistré');}else toast('Ajoutez un nom ou une prestation.');return;}
 if(action==='pick'){navigate('pick/'+d.id);return;}
 if(action==='free'){cur.lines.push({code:'',label:'',qty:1,unit:'u',price:null});saveQuote(cur);scrollLast=true;route();return;}
 if(action==='deleteLine'){if(confirm('Supprimer cette prestation ?')){cur.lines.splice(+el.dataset.i,1);saveQuote(cur);route();}return;}
 if(action==='send'){sendPDF(d);return;}if(action==='download'){downloadPDF(d);return;}
 if(action==='confirmSent'){changeStatus(d,'sent');downloaded.delete(d.id);return;}
 if(action==='sign'){if(checkReady(d))navigate('sign/'+d.id);return;}
 if(action==='confirmSignature'){confirmSignature(d);return;}
 if(action==='duplicate'){flush();cur=blank();cur.client=clone(d.client);cur.site=d.site;cur.obj=d.obj;cur.lines=clone(d.lines);cur.tva=d.tva;cur.demo=!!d.demo;if(saveQuote(cur)){navigate('edit/'+cur.id);rendreGains();toast('Copie créée avec un nouveau numéro');}return;}
 if(action==='invoiced'){changeStatus(d,'invoiced');return;}
}
document.addEventListener('click',e=>{
 const theme=e.target.closest('[data-theme-choice]');if(theme){const saved=Appearance.select(theme.dataset.themeChoice);route();toast(saved?'Thème mémorisé':'Thème appliqué · mémorisation indisponible');return;}
 const wa=e.target.closest('[data-whatsapp]');if(wa)return;
 const archive=e.target.closest('[data-history]');if(archive){navigate('history/'+archive.dataset.history);return;}
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
document.addEventListener('change',e=>{if(cur&&routeKind==='edit'&&e.target.dataset.field)flush();});
document.addEventListener('keydown',e=>{
 const el=e.target;if(el.matches('.row[role="button"]')&&['Enter',' '].includes(e.key)){e.preventDefault();el.click();}
 if(e.key==='Escape'&&sheet.classList.contains('open'))navigate(parentRoute());
 if(e.key==='Tab'&&sheet.classList.contains('open')){const all=[...sheet.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(x=>x.getClientRects().length),first=all[0],last=all[all.length-1];if(e.shiftKey&&el===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&el===last){e.preventDefault();first.focus();}}
});
$('#appearance').onclick=()=>navigate('appearance');$('#newQuote').onclick=newQuote;$('#tarifs').onclick=()=>navigate('tarifs');$('#history').onclick=()=>navigate('history');backdrop.onclick=()=>navigate('');
let grabY=null,grabDelta=0;$('#grab').addEventListener('pointerdown',e=>{grabY=e.clientY;grabDelta=0;$('#grab').setPointerCapture(e.pointerId);});$('#grab').addEventListener('pointermove',e=>{if(grabY!==null)grabDelta=e.clientY-grabY;});$('#grab').addEventListener('pointerup',()=>{if(grabY===null)return;grabY=null;if(grabDelta>80)navigate(parentRoute());else if(grabDelta<-40||Math.abs(grabDelta)<6){expandSheet();}});
body.addEventListener('scroll',()=>{if(body.scrollTop>12){expandSheet();}});
function refreshClock(){rendreGains();const d=find(routeId);if(routeKind==='d'&&d&&F.etatDossier(d)!==lastState)route();}
addEventListener('hashchange',route);addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();else refreshClock();});let viewportFrame=null;
function fitViewport(){if(viewportFrame)cancelAnimationFrame(viewportFrame);viewportFrame=requestAnimationFrame(()=>{viewportFrame=null;originBox=boxOf(sourceElement()||$('#hero'));if(sheet.classList.contains('open')){const G=geom(),h=sheet.classList.contains('big')?G.height-HAUT():measurePanel(body.innerHTML,false);sheet.style.transition='none';setBox(sheet,{top:G.top+G.height-h,left:G.left,width:G.width,height:h});sheet.getBoundingClientRect();sheet.style.transition='';}if(routeKind==='sign')redrawSignature();});}
addEventListener('resize',fitViewport);addEventListener('orientationchange',fitViewport);if(screen.orientation?.addEventListener)screen.orientation.addEventListener('change',fitViewport);if(window.visualViewport){visualViewport.addEventListener('resize',fitViewport);visualViewport.addEventListener('scroll',fitViewport);}setInterval(refreshClock,60000);
const network=()=>$('#horsligne').hidden=navigator.onLine!==false;addEventListener('online',network);addEventListener('offline',network);network();
PDFDevis.loadLogo('logo.png').then(()=>{prepared.clear();D.forEach(preparePdf);});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
rendreGains();route();
})();
