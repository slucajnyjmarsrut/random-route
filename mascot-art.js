/* Premium mascot art: locally cached 3D animal WebP when species match, unique vector fallback otherwise. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.RRMascotArt=api;
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const cache=new Map();
 const premiumPortraits=Object.freeze({'runner-rabbit':'assets/mascots/premium/runner-rabbit.webp','student-cat':'assets/mascots/premium/student-cat.webp','traveller-puppy':'assets/mascots/premium/traveller-puppy.webp','tourist-hamster':'assets/mascots/premium/tourist-hamster.webp','scholar-owl':'assets/mascots/premium/scholar-owl.webp','collector-raccoon':'assets/mascots/premium/collector-raccoon.webp','explorer-fox':'assets/mascots/premium/explorer-fox.webp','builder-beaver':'assets/mascots/premium/builder-beaver.webp','gamer-cat':'assets/mascots/premium/gamer-cat.webp'});
 const species={
  dog:['#fff0ca','#c97b3b','#5c3424','point'],rabbit:['#fff6fb','#e5a5d0','#8b497f','long'],
  cat:['#d7e8ff','#7582b5','#303956','point'],hamster:['#ffe2a0','#d69e58','#784225','round'],
  owl:['#e8deca','#86755f','#49383a','owl'],raccoon:['#e4e7f0','#959caf','#4c5266','point'],
  fox:['#ffb45a','#e56b2e','#803f29','point'],beaver:['#c78d5b','#a96840','#5a3829','round'],
  panda:['#f6f7f4','#b8bbc8','#2d3248','round'],dino:['#b5ef91','#58b98b','#276954','dino'],
  seal:['#d9e9f7','#91aaca','#445777','round'],wolf:['#eef0fa','#9bacd5','#3d4c70','point'],
  bear:['#f3b865','#af733d','#68412b','round'],raven:['#57617d','#36364a','#161a31','owl'],
  leopard:['#eff2f8','#d4dbe9','#52637a','round'],deer:['#e1af7c','#bc784d','#6a452e','antler'],
  bull:['#d7a16b','#996d4f','#594031','horn'],robot:['#a0f5fc','#58c0d5','#256c89','robot'],
  spirit:['#b4e7fb','#6ca4e6','#354f98','point'],hedgehog:['#edc597','#9f6e5a','#624335','spike'],
  squirrel:['#f7ae6a','#d5763e','#77402c','point'],penguin:['#dcecf4','#647e9c','#334768','round'],
  moose:['#e2b37c','#a4774b','#59402f','antler'],otter:['#caa178','#906748','#4c3d36','round'],
  lynx:['#e3b77f','#bd865a','#694b37','point']
 };
 // Real 3D raster artwork, stored locally in the project (CC0 Animoon pack).
 // Only map animal types to a visually matching species; keep the original
 // character-specific SVG fallback instead of showing a wrong animal.
 const rasterSpecies={
   dog:'wolf',cat:'lion',raccoon:'redpanda',fox:'redpanda',
   panda:'panda',wolf:'wolf',bear:'polarbear',leopard:'leopard',
   spirit:'wolf',squirrel:'redpanda',penguin:'penguin',lynx:'leopard'
 };
 const rasterPath=kind=>rasterSpecies[kind]?'assets/mascots/3d/'+rasterSpecies[kind]+'.webp':null;
 const roles=['trail','scholar','photo','winter','magic','music'];
 function escapeXML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
 function avatar(m){
  const id=String(m?.id||'mascot');
  if(cache.has(id))return cache.get(id);
  if(premiumPortraits[id]){cache.set(id,premiumPortraits[id]);return premiumPortraits[id];}
  const hash=[...id].reduce((h,ch)=>((h*33)^ch.charCodeAt(0))>>>0,5381);
  const keys=Object.keys(species);
  const kind=m.animal||({ 'runner-rabbit':'rabbit','student-cat':'cat','traveller-puppy':'dog','tourist-hamster':'hamster',
   'scholar-owl':'owl','collector-raccoon':'raccoon','explorer-fox':'fox','builder-beaver':'beaver',
   'gamer-cat':'cat','gourmet-panda':'panda','dino-explorer':'dino','traveller-seal':'seal','polar-dog':'wolf',
   'photographer-bear':'bear','cartographer-raven':'raven','snow-leopard':'leopard','northern-deer':'deer',
   'yakut-bull':'bull','robot-tourist':'robot','taiga-spirit':'spirit'}[id])||keys[hash%keys.length];
  const raster=rasterPath(kind);
  if(raster){cache.set(id,raster);return raster;}
  const [skin,shade,ink,ears]=species[kind]||species.dog;
  const role=m.role||roles[(hash>>>4)%roles.length];
  const hue=(hash>>>7)%360,accent='hsl('+hue+' 82% 62%)';
  const darkAccent='hsl('+hue+' 54% 31%)';
  const eyeColor=['#26253a','#153a62','#5a372c','#1f4c46'][hash%4];
  const bg=['#192a5c','#39306d','#164a65','#4c2c65','#5c334a'][['common','uncommon','rare','epic','legendary'].indexOf(m.rarity)]||'#222c59';
  const point=(x,y,r)=>'<circle cx="'+x+'" cy="'+y+'" r="'+r+'" fill="#fff" opacity=".75"/>';
  let earParts='';
  if(ears==='long')earParts='<ellipse cx="76" cy="53" rx="19" ry="48" transform="rotate(-20 76 53)" fill="'+shade+'" stroke="'+ink+'" stroke-width="6"/><ellipse cx="164" cy="53" rx="19" ry="48" transform="rotate(20 164 53)" fill="'+shade+'" stroke="'+ink+'" stroke-width="6"/><ellipse cx="76" cy="50" rx="9" ry="36" transform="rotate(-20 76 50)" fill="#f7a5ca"/><ellipse cx="164" cy="50" rx="9" ry="36" transform="rotate(20 164 50)" fill="#f7a5ca"/>';
  else if(ears==='point'||ears==='dino'||ears==='spike')earParts='<path d="M50 98 48 20Q50 10 62 20L99 59M190 98 192 20Q190 10 178 20L141 59" fill="'+shade+'" stroke="'+ink+'" stroke-width="7" stroke-linejoin="round"/><path d="M58 57 59 36 77 60M182 57 181 36 163 60" fill="#f69fa2"/>';
  else if(ears==='antler')earParts='<path d="M65 74Q31 39 32 11M60 50 19 43M59 43 64 10M177 74Q209 39 206 11M182 50 224 43M182 43 178 10" fill="none" stroke="#d8ac65" stroke-width="12" stroke-linecap="round"/>';
  else if(ears==='horn')earParts='<path d="M63 78Q33 60 32 20Q56 33 82 54M177 78Q207 60 208 20Q184 33 158 54" fill="#ffdfae" stroke="'+ink+'" stroke-width="6"/>';
  else if(ears==='owl')earParts='<path d="M47 94 43 24 94 58M193 94 197 24 146 58" fill="'+shade+'" stroke="'+ink+'" stroke-width="7"/>';
  else if(ears==='robot')earParts='<path d="M120 53V24" stroke="#c9faff" stroke-width="6"/><circle cx="120" cy="19" r="9" fill="#2de4fa"/>';
  else earParts='<circle cx="62" cy="75" r="26" fill="'+shade+'" stroke="'+ink+'" stroke-width="7"/><circle cx="178" cy="75" r="26" fill="'+shade+'" stroke="'+ink+'" stroke-width="7"/><circle cx="62" cy="75" r="12" fill="#f6b7a4"/><circle cx="178" cy="75" r="12" fill="#f6b7a4"/>';
  const earShape=escapeXML(ears);
  const sparks='<path d="M28 38v16m-8-8h16M209 42v18m-9-9h18" stroke="#fff0bd" stroke-width="3" stroke-linecap="round"/>'+point(32,91,2)+point(211,122,2);
  let accessory='';
  if(role==='scholar')accessory='<path d="M83 176q18-12 36 3q18-15 38-4v32q-20-7-38 4q-18-11-36-4z" fill="#ffe8b0" stroke="#58405e" stroke-width="4"/><path d="M119 179v32" stroke="#a26d60" stroke-width="3"/><rect x="64" y="84" width="43" height="25" rx="12" fill="none" stroke="#2d2d4c" stroke-width="6"/><rect x="133" y="84" width="43" height="25" rx="12" fill="none" stroke="#2d2d4c" stroke-width="6"/><path d="M108 97h24" stroke="#2d2d4c" stroke-width="6"/>';
  else if(role==='photo')accessory='<rect x="93" y="176" width="58" height="40" rx="10" fill="#313f58" stroke="#b7cee0" stroke-width="4"/><circle cx="123" cy="196" r="14" fill="#6fcfff" stroke="#e7f9ff" stroke-width="5"/><path d="M103 174h15" stroke="#e7f9ff" stroke-width="6"/>';
  else if(role==='winter')accessory='<path d="M57 154Q116 138 183 154l-8 20q-59 20-111 0z" fill="'+accent+'" stroke="#f4efff" stroke-width="5"/><path d="M154 158l15 53" stroke="'+accent+'" stroke-width="19" stroke-linecap="round"/><path d="M58 60Q120 5 182 60" fill="none" stroke="'+accent+'" stroke-width="23"/><circle cx="180" cy="63" r="12" fill="#fff"/>';
  else if(role==='magic')accessory='<path d="m167 177 12-31 10 31 30 10-30 11-10 30-12-30-29-11z" fill="#ffe4a4" stroke="#f6a9ff" stroke-width="3"/><path d="M80 179h72" stroke="#c9c1ff" stroke-width="6"/>';
  else if(role==='music')accessory='<path d="M69 78Q120 26 172 78" fill="none" stroke="'+accent+'" stroke-width="11"/><rect x="53" y="81" width="20" height="39" rx="9" fill="#54e8ec" stroke="#212844" stroke-width="5"/><rect x="167" y="81" width="20" height="39" rx="9" fill="#54e8ec" stroke="#212844" stroke-width="5"/>';
  else accessory='<path d="M72 174q46 11 94 0" fill="none" stroke="#f5da8d" stroke-width="11"/><rect x="152" y="149" width="37" height="60" rx="12" fill="#bf8748" stroke="#69493a" stroke-width="5"/><path d="M165 160v38m10-38v38" stroke="#f8d8a6" stroke-width="4"/>';
  const eyes=ears==='robot'?'<rect x="63" y="72" width="114" height="73" rx="22" fill="#173356" stroke="#8bf8ff" stroke-width="6"/><ellipse cx="91" cy="104" rx="10" ry="15" fill="#49f6ff"/><ellipse cx="151" cy="104" rx="10" ry="15" fill="#49f6ff"/>':
    '<ellipse cx="87" cy="106" rx="14" ry="19" fill="'+eyeColor+'"/><ellipse cx="153" cy="106" rx="14" ry="19" fill="'+eyeColor+'"/><circle cx="92" cy="99" r="6" fill="#fff"/><circle cx="158" cy="99" r="6" fill="#fff"/><circle cx="81" cy="115" r="3" fill="#fff" opacity=".8"/><circle cx="147" cy="115" r="3" fill="#fff" opacity=".8"/>';
  const freckles=kind==='leopard'||kind==='lynx'?'<g fill="'+ink+'" opacity=".45"><circle cx="50" cy="128" r="5"/><circle cx="61" cy="141" r="4"/><circle cx="185" cy="129" r="6"/><circle cx="172" cy="145" r="4"/></g>':'';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="'+escapeXML(m.name||'Маскот')+'"><defs>'+
   '<radialGradient id="sky" cx="50%" cy="28%" r="85%"><stop stop-color="'+accent+'" stop-opacity=".85"/><stop offset=".43" stop-color="'+bg+'"/><stop offset="1" stop-color="#141b38"/></radialGradient>'+
   '<linearGradient id="fur" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="'+skin+'"/><stop offset=".62" stop-color="'+shade+'"/><stop offset="1" stop-color="'+shade+'"/></linearGradient>'+
   '<linearGradient id="coat" x1="0" y1="0" x2="1" y2="1"><stop stop-color="'+accent+'"/><stop offset="1" stop-color="'+darkAccent+'"/></linearGradient>'+
   '<filter id="light"><feGaussianBlur stdDeviation="14"/></filter></defs>'+
   '<rect width="240" height="240" rx="22" fill="url(#sky)"/><ellipse cx="120" cy="206" rx="100" ry="40" fill="#b8a9ff" opacity=".26" filter="url(#light)"/>'+sparks+
   '<ellipse cx="121" cy="216" rx="82" ry="67" fill="url(#coat)" stroke="'+ink+'" stroke-width="7"/>'+
   '<path d="M55 207q-23-4-29 17M182 205q23-4 31 17" stroke="'+skin+'" stroke-width="22" stroke-linecap="round"/>'+
   earParts+'<ellipse cx="120" cy="115" rx="83" ry="78" fill="url(#fur)" stroke="'+ink+'" stroke-width="7"/>'+
   '<ellipse cx="120" cy="147" rx="54" ry="33" fill="'+skin+'" opacity=".91"/>'+freckles+eyes+
   '<ellipse cx="120" cy="132" rx="11" ry="7" fill="'+ink+'"/><path d="M120 141q-13 20-28 4M120 141q13 20 28 4" stroke="'+ink+'" stroke-width="5" fill="none" stroke-linecap="round"/>'+
   '<ellipse cx="62" cy="137" rx="12" ry="7" fill="#ff8c9c" opacity=".45"/><ellipse cx="178" cy="137" rx="12" ry="7" fill="#ff8c9c" opacity=".45"/>'+
   '<path d="M83 169q37 22 74 0" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/>'+accessory+
   '<path d="M38 201Q119 235 202 201" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width="5"/></svg>';
  const url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  if(cache.size>300)cache.clear();cache.set(id,url);
  return url;
 }
 return {avatar,roles,species,rasterPath,rasterSpecies,premiumPortraits};
});