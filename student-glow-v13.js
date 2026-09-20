/* Local RC adapter for the preserved v1.3 renderer. Reward decisions remain server-owned. */
(function(g){'use strict';
 const DEFAULT_INTENSITY=1,PREVIEW_MAX_INTENSITY=1.4,controllers=new Map();
 const valid=id=>/^(0[1-9]|1[0-8])$/.test(id||'');
 function intensity(){
  const value=Number(g.state42?.collection25?.visualPolicy?.defaultIntensity??DEFAULT_INTENSITY);
  return value===DEFAULT_INTENSITY?value:DEFAULT_INTENSITY;
 }
 function mount(card){
  const effect=card?.dataset?.shinyEffect;if(!valid(effect)||!g.GlowEffects)return;
  const current=controllers.get(card)||card.__glowEffect;
  if(current?.getState?.().effect===effect){current.setIntensity(intensity());card.dataset.glowIntensity='1';controllers.set(card,current);return;}
  current?.destroy?.();
  const controller=g.GlowEffects.mount(card,{effect,intensity:intensity()});
  card.dataset.glowIntensity='1';controllers.set(card,controller);
 }
 function scan(root=document){
  if(root.matches?.('.history-card[data-shiny-effect]'))mount(root);
  root.querySelectorAll?.('.history-card[data-shiny-effect]').forEach(mount);
  for(const [card,controller] of controllers)if(!card.isConnected){controller.destroy();controllers.delete(card);}
 }
 const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)scan(node);});
 function start(){scan();observer.observe(document.documentElement,{childList:true,subtree:true});}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 g.HistoryGlowV13=Object.freeze({version:'1.0.0',defaultIntensity:DEFAULT_INTENSITY,previewMaximumIntensity:PREVIEW_MAX_INTENSITY,mountAll:scan});
})(globalThis);
