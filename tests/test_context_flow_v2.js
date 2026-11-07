/* Parcours contextuel : node tests/test_context_flow_v2.js */
const assert=require('node:assert/strict');
global.Calc=require('../v2/calc.js');
const Flow=require('../v2/workflow.js');
const Context=require('../v2/context-flow.js');
const base=()=>({id:'context-1',num:'D2026-901',date:'2026-11-07',createdAt:'2026-11-07T09:00:00Z',
 client:{name:'Client test',email:'',tel:''},obj:'Peinture',lines:[{label:'Mur',qty:1,unit:'m²',price:100}],tva:20,status:'draft'});
const action=(d,options)=>Context.describe(d,Flow,options);
let d=base();d.lines=[];assert.equal(action(d).action,'edit');
d=base();assert.equal(action(d).label,'Prêt');assert.equal(action(d).action,'send');
assert.equal(action(d,{shared:true}).action,'confirmSent');
d.status='sent';d.sentAt=new Date().toISOString();assert.equal(action(d).action,'sign');
assert.equal(action(d,{signature:false}).action,'document');
d.sentAt='2020-01-01T12:00:00Z';assert.equal(action(d).label,'À relancer');assert.equal(action(d).action,'contact');
d.status='signed';assert.equal(action(d).action,'contact');
d.status='deposit';assert.equal(action(d).action,'issueInvoice');
assert.equal(action(d,{invoicing:false}).action,'document');
d.status='invoiced';d.invoice={num:'F2026-901'};assert.equal(action(d,{balance:120}).action,'payment');
assert.equal(action(d,{balance:0}).action,'downloadInvoice');
delete d.invoice;assert.equal(action(d).legacy,true);assert.equal(action(d).action,'document');
assert.equal(Context.STAGES.length,6);
for(const state of ['draft','ready','sent','signed','deposit','invoiced']) {
 const b=Context.STAGES.indexOf(state);
 assert(b>=0);
 const x=action({...base(),status:state,sentAt:new Date().toISOString()});
 assert(x.percent>0&&x.percent<=100);
}
console.log('Parcours contextuels V2 : tests réussis.');
