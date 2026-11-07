/* Tests de régression pour le workflow V2 : node tests/test_workflow_v2.js */
const assert = require('node:assert/strict');
global.Calc = require('../v2/calc.js');
const Flow = require('../v2/workflow.js');
function quote(email) {
  return {status:'draft', date:'2026-11-07', client:{name:'Client test', email}, lines:[{label:'Peinture',qty:2,price:100}],tva:10};
}
assert.deepEqual(Flow.missing(quote('')), [], 'Un email absent ne bloque pas le devis');
assert.deepEqual(Flow.missing(quote('client@example.com')), [], 'Email valide autorisé');
assert.ok(Flow.missing(quote('adresse-invalide')).includes('email du client valide'), 'Email fourni mais invalide refusé');
assert.equal(Flow.etatDossier(quote('')), 'ready', 'Devis sans email prêt');
assert.equal(Flow.heroInfo(quote('')).action,'send','Action contextuelle envoyer');
const incomplete=quote('');
incomplete.lines=[];
assert.equal(Flow.etatDossier(incomplete),'draft','Prestation obligatoire');
assert.equal(Flow.heroInfo(incomplete).action,'edit','Action contextuelle compléter');
console.log('Workflow V2 : 6 vérifications réussies.');
