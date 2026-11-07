/* Contrats UI CCTP sans navigateur : node tests/test_cctp_ui.js */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const base=__dirname+'/../v2/';
const html=fs.readFileSync(base+'index.html','utf8');
const app=fs.readFileSync(base+'app.js','utf8');
const worker=fs.readFileSync(base+'sw.js','utf8');
const config=fs.readFileSync(base+'config.js','utf8');
function ordered(...ids){const indices=ids.map(id=>html.indexOf('id="'+id+'"'));assert(indices.every(x=>x>=0));assert(indices.every((x,i)=>i===0||x>indices[i-1]));}
ordered('hero','globalSearch','newQuote','gains','documents');
for(const file of ['home-search.css','config.js','branding.js','invoice.js','storage-tools.js'])assert(html.includes(file),'Ressource '+file+' manquante');
for(const file of ['home-search.css','config.js','branding.js','invoice.js','storage-tools.js'])assert(worker.includes(file),'Fichier hors ligne '+file+' manquant');
assert(app.includes("search.addEventListener('input'"),'Recherche non reliée');
assert(app.includes('searching||filtering?D:D.filter(F.needsAttention)'),'Les factures doivent être recherchables');
assert(config.includes("sector:'btp'"));
assert(config.includes('localVoiceAI:false'),'Ne pas déclarer fonctionnelle une IA absente');
console.log('Contrats UI CCTP : 11 vérifications OK');
