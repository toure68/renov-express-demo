/* Whitelabel local : une seule configuration JSON, aucun menu côté artisan. */
(function(){
 'use strict';
 function color(v){return typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);}
 function apply(c){
  if(!c||typeof c!=='object')return;
  if(color(c.primary))document.documentElement.style.setProperty('--brand-primary',c.primary);
  if(color(c.accent))document.documentElement.style.setProperty('--brand-accent',c.accent);
  const img=document.querySelector('header .name img');
  if(img&&typeof c.logo==='string'&&/^[a-z0-9_./-]+\.(svg|png|webp)$/i.test(c.logo)&&!c.logo.includes('..'))img.src=c.logo;
  if(img&&typeof c.name==='string'&&c.name.trim())img.alt=c.name.trim();
 }
 fetch('brand.config.json').then(r=>{if(!r.ok)throw Error('Branding inaccessible');return r.json();}).then(apply).catch(()=>{});
})();
