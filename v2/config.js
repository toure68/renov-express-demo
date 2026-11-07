/* Configuration de build BTP — aucun sélecteur de métier dans l'interface.
 * À adapter avant livraison whitelabel. Les options nécessitant un vrai moteur
 * ne doivent pas être activées avant son installation et ses tests.
 */
(function(root){
 'use strict';
 const config=Object.freeze({
   sector:'btp',
   branding:Object.freeze({name:"Rénov'Express",logo:'logo.svg',primary:'#1F4E5F',accent:'#1fa774'}),
   features:Object.freeze({
     quotes:true,
     pdf:true,
     tariffs:true,
     signature:true,       // fonctionnalité existante
     invoicing:true,       // accès au suivi des devis facturés, pas un moteur comptable
     localVoiceAI:false,   // nécessite un modèle ML local
     localOCR:false,       // nécessite un moteur OCR local
     geofencing:false,     // nécessite le consentement de localisation et le moteur associé
     cloudSync:false       // nécessite authentification et backend sécurisé
   })
 });
 root.AppConfig=config;
})(typeof window!=='undefined'?window:this);
