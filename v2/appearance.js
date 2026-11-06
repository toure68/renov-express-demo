/* Apply before paint. Only the appearance preference is stored here. */
(function(){
 'use strict';
 const themes=[
  {id:'petrol',name:'Pétrole sombre',description:'Le fond actuel de Rénov’Express',swatch:'linear-gradient(150deg,#153543,#04070f)',bar:'#1F4E5F'},
  {id:'white',name:'Blanc pur',description:'Fond entièrement blanc, textes foncés',swatch:'#ffffff',bar:'#ffffff'},
  {id:'linen',name:'Lin clair',description:'Fond crème doux, accents pétrole et ocre',swatch:'#faf6ee',bar:'#faf6ee'},
  {id:'night',name:'Bleu nuit',description:'Fond bleu profond et textes clairs',swatch:'linear-gradient(150deg,#172947,#050b16)',bar:'#172947'}
 ];
 let selected='petrol';try{const saved=localStorage.getItem('re_v2_theme');if(themes.some(t=>t.id===saved))selected=saved;}catch(e){}
 function apply(id){const t=themes.find(t=>t.id===id);if(!t)return false;selected=id;document.documentElement.dataset.theme=id;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=t.bar;return true;}
 apply(selected);
 window.Appearance={themes,get selected(){return selected;},select(id){if(!apply(id))return false;try{localStorage.setItem('re_v2_theme',id);return true;}catch(e){return false;}}};
})();
