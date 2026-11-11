/* Graphite Wave theme: dark by default, persisted manual light override.
 * No network access, map/GPS interaction or account information is involved.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root&&root.document){
    root.RRGraphiteTheme=api;
    if(root.document.readyState==="loading"){
      root.document.addEventListener("DOMContentLoaded",function(){api.mount(root.document,root.localStorage);},{once:true});
    }else api.mount(root.document,root.localStorage);
  }
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const KEY="visual_theme_v1";
  const normalize=choice=>choice==="light"?"light":"graphite";
  function read(storage){
    try{return normalize(storage&&storage.getItem(KEY));}catch(e){return "graphite";}
  }
  function apply(doc,choice,storage,save){
    if(!doc||!doc.documentElement)return normalize(choice);
    const theme=normalize(choice);
    doc.documentElement.setAttribute("data-rr-theme",theme);
    const color=theme==="graphite"?"#20262e":"#f7faf8";
    const meta=doc.querySelector&&doc.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute("content",color);
    const select=doc.getElementById&&doc.getElementById("rrThemeSelect");
    if(select)select.value=theme;
    if(save)try{if(storage)storage.setItem(KEY,theme);}catch(e){}
    return theme;
  }
  function mount(doc,storage){
    if(!doc||!doc.getElementById)return;
    const select=doc.getElementById("rrThemeSelect");
    apply(doc,read(storage),storage,false);
    if(!select||select.dataset.rrThemeBound==="1")return;
    select.dataset.rrThemeBound="1";
    select.addEventListener("change",function(){apply(doc,select.value,storage,true);});
  }
  return {KEY,normalize,read,apply,mount};
});
