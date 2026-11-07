/* Recette intégrée : vrai navigateur Chromium, sans toucher aux données clients.
 * npm install --no-save playwright && npx playwright install chromium
 * node tests/browser_v2.js
 */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../v2');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const host='http://127.0.0.1:8765';
let server,browser;
const results=[];
fs.mkdirSync(path.resolve(__dirname,'screenshots'),{recursive:true});
function sample(id,status='draft',extras={}){
 return {id,num:'D2026-100',date:'2026-11-07',status,createdAt:'2026-11-07T08:00:00Z',updated:Date.now(),client:{name:'Client test',addr:'Paris',email:'client@test.fr',tel:'0612345678'},obj:'Peinture séjour',site:'Paris',lines:[{label:'Peinture murs',qty:2,price:50,unit:'m²'}],tva:20,demo:false,...extras};
}
const issuer={name:'Entreprise Démo Recette',address:'10 rue du Test',city:'75001 Paris',siret:'12345678901234',email:'contact@btp.fr',phone:'0612345678',insurer:'Assureur BTP',payment:'Virement'};
async function contextPage(documents=[],device={}){
 const context=await browser.newContext({viewport:{width:device.mobile?390:1080,height:device.mobile?844:900},isMobile:!!device.mobile,hasTouch:!!device.mobile,acceptDownloads:true,serviceWorkers:'allow'});
 await context.addInitScript(({documents,issuer})=>{
  localStorage.setItem('re_v2_devis',JSON.stringify(documents));
  localStorage.setItem('re_v2_demo',JSON.stringify('off'));
  localStorage.setItem('re_v2_company',JSON.stringify(issuer));
 },{documents,issuer});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&& !/favicon/.test(m.text()))errors.push(m.text());});
 await page.goto(host+'/',{waitUntil:'load'});
 await page.locator('#newQuote').waitFor();
 return {page,context,errors};
}
async function run(name,fn){
 try{await fn();results.push({name,result:'OK'});console.log('OK '+name);}
 catch(e){results.push({name,result:'FAILED',error:e.stack||String(e)});console.error('ECHEC '+name+'\n'+(e.stack||e));}
}
async function click(page,selector){await page.locator(selector).first().click();}
async function expectText(page,selector,text){await page.locator(selector).filter({hasText:text}).first().waitFor({timeout:7000});}
(async()=>{
 try{
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,host);const relative=decodeURIComponent(u.pathname)==='/'?'index.html':decodeURIComponent(u.pathname).replace(/^\/+/,''),file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);return res.end();}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);});
 });
 await new Promise(ok=>server.listen(8765,'127.0.0.1',ok));
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 await run('Accueil ordinateur, recherche et navigation',async()=>{
  const {page,context,errors}=await contextPage([sample('ready1')]);
  await page.locator('#globalSearch').waitFor();
  await page.screenshot({path:'tests/screenshots/01-accueil.png'});
  assert.equal(await page.locator('#newQuote').isVisible(),true);
  assert.equal(await page.locator('#invoicesArchive').isVisible(),true);
  await page.locator('#globalSearch').fill('Client test');
  assert.equal(await page.locator('#gains [data-open]').count(),1);
  await page.locator('#globalSearch').fill('introuvable');
  assert.equal(await page.locator('#gains [data-open]').count(),0);
  await page.locator('#clearGlobalSearch').click();
  await click(page,'#gains [data-open="ready1"]');
  await expectText(page,'.re-progress-current','Prêt');
  await expectText(page,'.re-primary-next','Envoyer le devis');
  await page.screenshot({path:'tests/screenshots/02-devis-pret.png'});
  assert.equal(await page.locator('.re-progress-current').count(),1);
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Créer un devis et une prestation',async()=>{
  const {page,context,errors}=await contextPage([]);
  await click(page,'#newQuote');
  await page.locator('[data-field="client.name"]').fill('Nouveau client');
  await page.locator('[data-field="obj"]').fill('Peinture chambre');
  await click(page,'[data-action="free"]');
  await page.locator('[data-field="line.0.label"]').fill('Peinture plafond');
  await page.locator('[data-field="line.0.qty"]').fill('2');
  await page.locator('[data-field="line.0.price"]').fill('125');
  await click(page,'[data-action="save"]');
  await expectText(page,'.re-progress-current','Prêt');
  await expectText(page,'.re-summary-total','275');
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Signature au doigt (mobile simulé)',async()=>{
  const {page,context,errors}=await contextPage([sample('s1','sent',{sentAt:new Date().toISOString()})],{mobile:true});
  await click(page,'#gains [data-open="s1"]');
  await expectText(page,'.re-primary-next','Faire signer');
  await click(page,'[data-action="sign"]');
  await page.locator('#signatureCanvas').waitFor();
  const box=await page.locator('#signatureCanvas').boundingBox();
  assert(box&&box.width>50&&box.height>30,'zone de signature inutilisable');
  await page.mouse.move(box.x+20,box.y+20);await page.mouse.down();
  for(let i=0;i<8;i++)await page.mouse.move(box.x+20+i*12,box.y+20+(i%2)*16,{steps:2});
  await page.mouse.up();
  await page.locator('#signConsent').check();
  await click(page,'[data-action="confirmSignature"]');
  await expectText(page,'.re-progress-current','Signé');
  await page.screenshot({path:'tests/screenshots/03-signature.png'});
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Acompte reçu → facture PDF → règlement',async()=>{
  const {page,context,errors}=await contextPage([sample('d1','deposit',{depositAt:'2026-11-06T12:00:00Z'})],{mobile:true});
  page.on('dialog',dialog=>dialog.accept());
  await click(page,'#gains [data-open="d1"]');
  await expectText(page,'.re-progress-current','Acompte reçu');
  await click(page,'#service [data-action="issueInvoice"]');
  await expectText(page,'.re-progress-current','Facturé');
  await expectText(page,'.re-summary','84,00');
  await page.screenshot({path:'tests/screenshots/04-acompte-facture.png'});
  await page.locator('#service .re-more summary').first().click();
  const [download]=await Promise.all([page.waitForEvent('download'),click(page,'#service [data-action="downloadInvoice"]')]);
  assert(download.suggestedFilename().startsWith('Facture_F20'));
  await click(page,'#service [data-action="payment"]');
  await page.locator('[data-field="p.amount"]').fill('84');
  await click(page,'#service [data-action="savePayment"]');
  await expectText(page,'.re-primary-next','Télécharger la facture');
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Tarifs et sauvegarde exportable',async()=>{
  const {page,context,errors}=await contextPage([]);
  await click(page,'#tarifs');
  await page.locator('#tarifSearch').fill('plafond');
  assert((await page.locator('#tarifRows [data-tarif]').count())>0);
  await click(page,'[data-action="newTarif"]');
  await page.locator('[data-field="t.label"]').fill('Élément de recette');
  await page.locator('[data-field="t.unit"]').fill('u');
  await page.locator('[data-field="t.price"]').fill('33');
  await click(page,'[data-action="saveTarif"]');
  await expectText(page,'#tarifRows','Élément de recette');
  await page.goto(host+'/#appearance');
  const [download]=await Promise.all([page.waitForEvent('download'),click(page,'[data-action="backup"]')]);
  assert(download.suggestedFilename().endsWith('.json'));
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Devis prêt : PDF et envoi confirmé manuellement',async()=>{
  const {page,context,errors}=await contextPage([sample('share1')],{mobile:true});
  page.on('dialog',d=>d.accept());
  await click(page,'#gains [data-open="share1"]');
  await page.locator('.re-more summary').click();
  await click(page,'#service [data-action="document"]');
  const [pdf]=await Promise.all([page.waitForEvent('download'),click(page,'#service [data-action="download"]')]);
  assert(pdf.suggestedFilename().endsWith('.pdf'));
  await click(page,'#service [data-action="back"]');
  const [shared]=await Promise.all([page.waitForEvent('download'),click(page,'#service [data-action="send"]')]);
  assert(shared.suggestedFilename().endsWith('.pdf'));
  await expectText(page,'.re-primary-next','Confirmer l’envoi');
  await click(page,'#service [data-action="confirmSent"]');
  await expectText(page,'.re-progress-current','Envoyé');
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Réglages entreprise, mode démo et restauration',async()=>{
  const {page,context,errors}=await contextPage([]);
  page.on('dialog',d=>d.accept());
  await click(page,'#appearance');
  await click(page,'#service [data-action="company"]');
  await page.locator('[data-field="c.name"]').fill('Nouvelle société de test');
  await click(page,'#service [data-action="saveCompany"]');
  const name=await page.evaluate(()=>JSON.parse(localStorage.getItem('re_v2_company')).name);
  assert.equal(name,'Nouvelle société de test');
  await page.locator('#restoreInput').setInputFiles({name:'restore.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'renov-express-v2-backup',version:1,devis:[sample('imported')],tarifs:[]}))});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('re_v2_devis')).some(d=>d.id==='imported'));
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Facture échue : priorité et couleur rouge',async()=>{
  const invoice={num:'F2026-007',issuedAt:'2020-01-01T12:00:00Z',dueDate:'2020-02-01',totals:{ht:100,tva:20,ttc:120,acompte:36},issuer,client:sample('late').client,lines:sample('late').lines};
  const {page,context,errors}=await contextPage([sample('late','invoiced',{invoice,payments:[]})],{mobile:true});
  await expectText(page,'#hero','Enregistrer un règlement');
  await click(page,'#gains [data-open="late"]');
  await expectText(page,'.re-progress-current','Paiement en retard');
  await page.screenshot({path:'tests/screenshots/05-facture-en-retard.png'});
  const color=await page.locator('.re-progress-current').evaluate(el=>getComputedStyle(el).color);
  assert(/255, 159, 159/.test(color),'couleur d’alerte non appliquée : '+color);
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Filtres de statuts et archives des documents',async()=>{
  const draft=sample('draft-filter','draft',{lines:[]});
  const ready=sample('ready-filter','draft');
  const {page,context,errors}=await contextPage([draft,ready]);
  await page.locator('#homeStatusFilter').selectOption('ready');
  assert.equal(await page.locator('#gains [data-open]').count(),1);
  assert.equal(await page.locator('#gains [data-open="ready-filter"]').count(),1);
  await page.locator('#homeStatusFilter').selectOption('draft');
  assert.equal(await page.locator('#gains [data-open="draft-filter"]').count(),1);
  await page.locator('#homeStatusFilter').selectOption('all');
  await click(page,'#quotesArchive');
  await page.locator('#historyRows [data-open]').first().waitFor();
  assert.equal(await page.locator('#historyRows [data-open]').count(),2);
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Contact client et suivi manuel sans boutons superflus',async()=>{
  const docs=[sample('manual-1'),sample('contact-1','signed',{signedAt:new Date().toISOString()})];
  const {page,context,errors}=await contextPage(docs,{mobile:true});
  page.on('dialog',d=>d.accept());
  await click(page,'#gains [data-open="manual-1"]');
  await page.locator('#service .re-more summary').click();
  await click(page,'#service [data-action="options"]');
  await page.locator('#service .re-more summary').click();
  await click(page,'#service [data-action="status"]');
  await click(page,'#service [data-action="manual-sent"]');
  await expectText(page,'.re-progress-current','Envoyé');
  await page.goto(host+'/#d/contact-1');
  await expectText(page,'.re-primary-next','Demander l’acompte');
  await click(page,'#service [data-action="contact"]');
  await page.locator('#service [data-contact="whatsapp"]').waitFor();
  assert.equal(await page.locator('#service [data-contact="whatsapp"]').count(),1);
  assert.equal(await page.locator('#service [data-contact="email"]').count(),1);
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Conformité fenêtres : hauteur, boutons visibles et design sur mobile compact',async()=>{
  const quote=sample('geometry-ready');
  const signed=sample('geometry-signed','signed',{signedAt:new Date().toISOString()});
  const invoice={num:'F2026-009',issuedAt:'2026-11-07T09:00:00Z',dueDate:'2026-12-07',totals:{ht:100,tva:20,ttc:120,acompte:36},issuer,client:quote.client,lines:quote.lines};
  const billed=sample('geometry-billed','invoiced',{invoice,payments:[{amount:36,date:'2026-11-07',method:'Acompte',kind:'deposit'}]});
  const {page,context,errors}=await contextPage([quote,signed,billed],{mobile:true});
  await page.setViewportSize({width:375,height:667});
  const routes=['d/geometry-ready','d/geometry-signed','d/geometry-billed','contact/geometry-signed','options/geometry-ready','status/geometry-ready','payment/geometry-billed','sign/geometry-ready','edit/geometry-ready','tarifs','tarif/0','appearance','company','history/quotes','document/geometry-ready'];
  for(const route of routes){
   await page.goto(host+'/#'+route,{waitUntil:'load'});
   await page.locator('#sheet.open .mbody.on').waitFor({timeout:9000});
   await page.waitForTimeout(820);
   const m=await page.evaluate(()=>{
    const sheet=document.querySelector('#sheet'),content=document.querySelector('#service'),r=sheet.getBoundingClientRect();
    const available=(window.visualViewport?.height||innerHeight)-Math.min(56,Math.max(22,Math.round((window.visualViewport?.height||innerHeight)*.08)));
    const overflow=content.scrollHeight>content.clientHeight+7;
    const buttons=[...content.querySelectorAll('.cta,.chx,.all,.back')].filter(b=>{
      // Un bouton dans un <details> fermé est volontairement secondaire :
      // son rectangle DOM ne signifie pas qu'il soit réellement affiché.
      if(b.closest('details:not([open])')&&!b.closest('summary'))return false;
      const cs=getComputedStyle(b),rect=b.getBoundingClientRect();
      return cs.display!=='none'&&cs.visibility!=='hidden'&&rect.width>0&&rect.height>0;
    }).map(b=>{const box=b.getBoundingClientRect(),style=getComputedStyle(b);return {text:(b.innerText||b.getAttribute('aria-label')||'').slice(0,50),height:box.height,bottom:box.bottom,top:box.top,radius:parseFloat(style.borderTopLeftRadius)};});
    return {panelHeight:r.height,panelTop:r.top,panelBottom:r.bottom,available,overflow,scrollHeight:content.scrollHeight,clientHeight:content.clientHeight,buttons};
   });
   assert(m.panelHeight<=m.available+4,route+': fenêtre hors de l’écran : '+JSON.stringify(m));
   assert(!m.overflow||m.panelHeight>=m.available*.91,route+': fenêtre petite malgré du contenu caché : '+JSON.stringify(m));
   for(const b of m.buttons){
    assert(b.height>=43,route+': bouton tactile trop petit '+JSON.stringify(b));
    assert(b.radius>=10,route+': bouton vieilli / angle trop carré '+JSON.stringify(b));
    if(!m.overflow)assert(b.bottom<=m.panelBottom+5&&b.top>=m.panelTop-5,route+': bouton caché sans défilement nécessaire '+JSON.stringify(b));
   }
   if(route==='contact/geometry-signed'){
    assert.equal(await page.locator('#service .re-wa').count(),1);
    assert.equal(await page.locator('#service .re-mail').count(),1);
   }
   if(route==='d/geometry-billed')await page.screenshot({path:'tests/screenshots/06-fiche-adaptative-mobile.png'});
   if(route==='contact/geometry-signed')await page.screenshot({path:'tests/screenshots/07-contact-moderne.png'});
  }
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Conformité fenêtres : ajustement après changement de taille et orientation',async()=>{
  const {page,context,errors}=await contextPage([sample('resize-1','signed')],{mobile:true});
  await page.goto(host+'/#contact/resize-1',{waitUntil:'load'});
  await page.locator('#service .re-contact-row').waitFor();
  for(const size of [{width:390,height:844},{width:390,height:568},{width:844,height:390},{width:390,height:844}]){
   await page.setViewportSize(size);await page.waitForTimeout(650);
   const x=await page.evaluate(()=>{const p=document.querySelector('#sheet').getBoundingClientRect();return {height:p.height,screen:innerHeight,top:p.top,bottom:p.bottom,overflow:document.querySelector('#service').scrollHeight>document.querySelector('#service').clientHeight+7}});
   assert(x.top>=-5&&x.bottom<=x.screen+5,'Fenêtre déborde après rotation : '+JSON.stringify({size,...x}));
   if(x.overflow)assert(x.height>x.screen*.77,'Contenu tronqué après rotation : '+JSON.stringify({size,...x}));
  }
  assert.deepEqual(errors,[]);await context.close();
 });
 await run('Conformité capture iPhone : Relancer via carte et bouton = même grande fenêtre',async()=>{
  const overdue=sample('relaunch-same','sent',{sentAt:'2026-10-20T09:00:00Z',demo:true});
  const {page,context,errors}=await contextPage([overdue],{mobile:true});
  const measure=async()=>page.evaluate(()=>{
   const s=document.querySelector('#sheet'),b=document.querySelector('#service'),r=s.getBoundingClientRect();
   const viewport=window.visualViewport?.height||innerHeight;
   return {route:location.hash,height:r.height,viewport,top:r.top,big:s.classList.contains('big'),half:s.classList.contains('half'),visible:!!b.querySelector('.back'),title:b.querySelector('.ttl')?.textContent||b.innerText.slice(0,50)};
  });
  await click(page,'#hero.vedette .hv-d');
  await page.locator('#sheet.open.big .mbody.on').waitFor();
  await page.waitForTimeout(500);
  const dossier=await measure();
  assert.equal(dossier.route,'#d/relaunch-same');
  assert(dossier.height>dossier.viewport*.84,'Fiche trop petite '+JSON.stringify(dossier));
  await page.goto(host+'/#',{waitUntil:'load'});
  await click(page,'#hero.vedette [data-action="contact"]');
  await page.locator('#sheet.open.big .mbody.on').waitFor();
  await page.waitForTimeout(500);
  const contact=await measure();
  assert.equal(contact.route,'#contact/relaunch-same');
  assert(contact.title.includes('Relancer le client'),'Mauvais panneau '+JSON.stringify(contact));
  assert(Math.abs(contact.height-dossier.height)<3,'Taille incohérente carte / bouton : '+JSON.stringify({dossier,contact}));
  assert.equal(contact.half,false);
  await page.screenshot({path:'tests/screenshots/08-relance-plein-ecran.png'});
  assert.deepEqual(errors,[]);
  await context.close();
 });
 await run('Conformité navigation : toutes les fenêtres et actions utilisent le grand panneau',async()=>{
  const base=sample('all-ready'),sent=sample('all-sent','sent',{sentAt:new Date().toISOString()});
  const signed=sample('all-signed','signed',{signedAt:new Date().toISOString()});
  const invoice={num:'F2026-060',issuedAt:'2026-11-07T12:00:00Z',dueDate:'2026-12-07',totals:{ht:100,tva:20,ttc:120,acompte:36},issuer,client:base.client,lines:base.lines};
  const billed=sample('all-billed','invoiced',{invoice,payments:[]});
  const {page,context,errors}=await contextPage([base,sent,signed,billed],{mobile:true});
  const routes=['d/all-ready','contact/all-signed','payment/all-billed','options/all-ready','status/all-ready','sign/all-sent','document/all-ready','edit/all-ready','tarifs','tarif/0','appearance','company','history/quotes','history/invoices'];
  for(const route of routes){
   await page.goto(host+'/#'+route,{waitUntil:'load'});
   await page.locator('#sheet.open.big .mbody.on').waitFor({timeout:8000});
   await page.waitForTimeout(120);
   const m=await page.evaluate(()=>{
    const sheet=document.querySelector('#sheet'),r=sheet.getBoundingClientRect();
    return {height:r.height,viewport:window.visualViewport?.height||innerHeight,top:r.top,half:sheet.classList.contains('half')};
   });
   assert(!m.half&&m.height>m.viewport*.83,'Panneau mal dimensionné '+route+' : '+JSON.stringify(m));
  }
  // Même garantie via le bouton principal, pas seulement une URL directe.
  await page.goto(host+'/#d/all-signed',{waitUntil:'load'});
  await click(page,'#service [data-action="contact"]');
  await page.locator('#sheet.open.big .mbody.on').waitFor();
  assert.equal(new URL(page.url()).hash,'#contact/all-signed');
  await page.goto(host+'/#d/all-billed',{waitUntil:'load'});
  await click(page,'#service [data-action="payment"]');
  await page.locator('#sheet.open.big .mbody.on').waitFor();
  assert.equal(new URL(page.url()).hash,'#payment/all-billed');
  assert.deepEqual(errors,[]);
  await context.close();
 });
 await run('PWA : recharge en mode hors connexion',async()=>{
  const {page,context,errors}=await contextPage([sample('off1')],{mobile:true});
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload({waitUntil:'load'});
  await context.setOffline(true);
  await page.reload({waitUntil:'load'});
  assert.equal(await page.locator('#globalSearch').isVisible(),true);
  await click(page,'#gains [data-open="off1"]');
  await expectText(page,'.re-progress-current','Prêt');
  assert.deepEqual(errors,[]);await context.close();
 });
}finally{
 try{await browser?.close();}catch(e){}
 try{await new Promise(ok=>server?.close(ok));}catch(e){}
 const fs=require('node:fs');fs.writeFileSync('tests/browser-results.json',JSON.stringify({results,passed:results.filter(x=>x.result==='OK').length,total:results.length},null,2));
 if(results.some(x=>x.result!=='OK'))process.exitCode=1;
}
})();