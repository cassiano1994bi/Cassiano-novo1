/* Modo de compatibilidade: a mesma economia, sem exigir WebGL. */
import {MayorEconomy,CITY_MODELS} from './mayor-economy.js?v=10.3';
import {mountMayorUI} from './mayor-ui.js?v=10.3';
import {buyListedProperty,buySystemPlot,submitOffer,sellToInvestor,acceptCounteroffer,initializeMarketState} from './market-economy.js?v=12.0';
export function startCityMap2D({stage,legacyLots,parkIds,marketState=null,marketAppraise=null,marketCost=null,saveMarket=()=>{}}){
 const marketMode=!!marketState;
 if(marketMode)initializeMarketState(marketState);
 const engine=new MayorEconomy({storage:localStorage,legacyLots,parkIds});
 engine.restoreTime();
 const canvas=document.createElement('canvas'),g=canvas.getContext('2d');stage.prepend(canvas);
 const colors={residential:'#78b58b',mixed:'#72b8bd',commercial:'#d5b468',industrial:'#a7a1bd',tourism:'#6da4d0',environmental:'#3c8066'};
 let zoom=1,panX=0,panY=0,drag=null,moved=false,layer='none',ui;
 const notice=text=>{const box=document.getElementById('viewToast');if(box){box.textContent=text;box.hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>box.hidden=true,4500)}};
 function layout(){const w=stage.clientWidth,h=stage.clientHeight;return {w,h,scale:Math.min(w/760,h/520)*zoom,ox:w/2+panX,oy:h/2+panY}}
 function cell(i){const d=Math.floor(i/200),k=i%200;return {x:-347+d*140+(k%10)*12,y:-166+Math.floor(k/10)*16}}
 function draw(){
  const {w,h,scale,ox,oy}=layout();
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  g.fillStyle='#142b40';g.fillRect(0,0,w,h);g.save();g.translate(ox,oy);g.scale(scale,scale);
  g.fillStyle='#226b89';g.fillRect(-400,-242,800,53);g.fillStyle='#d5c7a2';g.fillRect(-400,-190,800,14);
  g.fillStyle='#fff1b7';g.beginPath();g.arc(260,-218,12,0,Math.PI*2);g.fill();
  g.fillStyle='#345161';g.fillRect(-360,-176,720,340);
  const companies=new Map(engine.s.companies.map(c=>[c.plot,c]));
  const projects=new Map([...engine.s.projects,...engine.s.works.filter(w=>Number.isInteger(w.plot))].filter(p=>p.status!=='complete'&&p.status!=='cancelled').map(p=>[p.plot,p]));
  for(let i=0;i<1000;i++){
   const p=marketMode?legacyLots[i]:engine.s.plots[i],{x,y}=cell(i),company=companies.get(i),project=projects.get(i);
   const holder=marketMode?p?.owner==='me'?'#e8c45f':p?.owner==='npc'?'#79a9c8':p?.owner==='municipal'?'#39815b':'#71966f':p.holder==='public'?'#39815b':colors[engine.zoneFor(i)];
   g.fillStyle=holder||'#71966f';g.fillRect(x,y,10,13);
   if(marketMode?(p?.building||p?.owner==='npc'&&p?.price):p.model||company){g.fillStyle='#e1ddd3';g.fillRect(x+2,y+3,6,7);g.fillStyle='#355b73';g.fillRect(x+3,y+4,2,2)}
   if(project){g.fillStyle='#e3b151';g.fillRect(x+1,y+2,8,9);g.fillStyle='#543d2b';g.fillRect(x+1,y+11,8*project.elapsed/project.days,2)}
   if(layer==='owner'&&p.holder!=='free'){g.strokeStyle='#eed37e';g.strokeRect(x+.5,y+.5,9,12)}
  }
  g.font='bold 11px system-ui';g.textAlign='center';g.fillStyle='#d7ebf5';
  for(let d=0;d<5;d++)g.fillText('BAIRRO '+(d+1),-292+d*140,185);
  g.restore();g.font='11px system-ui';g.fillStyle='#c5dfed';g.textAlign='center';g.fillText('Mapa 2D de compatibilidade · arraste para mover · use zoom para selecionar lotes',w/2,h-58);
 }
 function focus(id){const c=cell(id),l=layout();zoom=2;const n=layout();panX=-c.x*n.scale;panY=-c.y*n.scale;ui?.showLot(id);draw()}
 const refresh=()=>{draw();ui?.refresh(true)};
 let marketPanel=null,marketTitle=null,marketDetails=null,marketActions=null,marketStatus=null;
 function showMarketLot(id){
  const lot=legacyLots[id];if(!lot)return;
  marketPanel.hidden=false;
  marketTitle.textContent='📍 Terreno #'+String(id+1).padStart(3,'0');
  const value=marketAppraise?marketAppraise(id,lot):0;
  marketDetails.textContent=(lot.owner==='free'?'Disponível':lot.owner==='npc'?'Proprietário: morador/investidor':lot.owner==='me'?'Seu imóvel':'Área pública')+' · Avaliação IU$ '+Math.round(value).toLocaleString('pt-BR')+(lot.price?' · Anunciado por IU$ '+Math.round(lot.price).toLocaleString('pt-BR'):'');
  marketActions.replaceChildren();
  const add=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='border:0;border-radius:8px;padding:8px 10px;background:#2e566e;color:#fff;font-weight:700';b.onclick=fn;marketActions.append(b)};
  const finish=message=>{saveMarket();draw();showMarketLot(id);marketStatus.textContent=message};
  if(lot.owner==='free'){
   const price=marketCost?marketCost(id):1000;
   add('Comprar · IU$ '+Math.round(price).toLocaleString('pt-BR'),()=>{const r=buySystemPlot(marketState,lot,price,value,id);if(r.ok)finish('Terreno comprado.');else marketStatus.textContent=r.reason});
  }else if(lot.owner==='npc'){
   if(lot.price)add('Comprar anunciado · IU$ '+Math.round(lot.price).toLocaleString('pt-BR'),()=>{const r=buyListedProperty(marketState,lot,lot.price,value,id);if(r.ok)finish('Imóvel comprado.');else marketStatus.textContent=r.reason});
   add('Fazer proposta',()=>{const raw=window.prompt('Digite sua proposta em IU$:',String(Math.round(value*.86)));if(raw===null)return;const r=submitOffer(marketState,lot,Number(raw),value,id);if(!r.ok){marketStatus.textContent=r.reason;return}if(r.accepted){finish(r.message)}else{const offer=marketState.marketOffers.find(o=>o.lotId===id&&o.status==='countered');marketStatus.textContent=r.message;if(offer)add('Aceitar IU$ '+Math.round(offer.counter).toLocaleString('pt-BR'),()=>{const a=acceptCounteroffer(marketState,offer.id,lot,value);if(a.ok)finish('Contraproposta aceita.');else marketStatus.textContent=a.reason})}});
  }else if(lot.owner==='me'){
   if(!lot.price)add('Anunciar',()=>{const raw=window.prompt('Preço do anúncio em IU$ (máximo 10× avaliação):',String(Math.round(value*1.2)));if(raw===null)return;const price=Number(raw);if(!Number.isSafeInteger(price)||price<1000||price>value*10){marketStatus.textContent='Preço fora do limite permitido.';return}lot.price=price;finish('Imóvel anunciado.')});
   else{add('Vender ao investidor · líquido IU$ '+Math.floor(lot.price*.95).toLocaleString('pt-BR'),()=>{const r=sellToInvestor(marketState,lot,lot.price,value,id);if(r.ok)finish('Imóvel vendido ao investidor.');else marketStatus.textContent=r.reason});add('Retirar anúncio',()=>{lot.price=0;finish('Anúncio retirado.')})}
  }
 }
 if(marketMode){
  stage.style.position='relative';
  marketPanel=document.createElement('section');marketPanel.hidden=true;marketPanel.style.cssText='position:absolute;z-index:5;left:10px;right:10px;bottom:10px;max-height:38%;overflow:auto;padding:12px;border:1px solid #63c6bc;border-radius:14px;background:rgba(16,42,61,.96);color:#eff9ff;font:14px system-ui';
  marketTitle=document.createElement('strong');marketDetails=document.createElement('div');marketDetails.style.margin='7px 0';
  marketActions=document.createElement('div');marketActions.style.cssText='display:flex;flex-wrap:wrap;gap:6px';
  marketStatus=document.createElement('div');marketStatus.style.cssText='margin-top:7px;color:#b9d3df';
  const close=document.createElement('button');close.type='button';close.textContent='Fechar';close.style.cssText='float:right';close.onclick=()=>marketPanel.hidden=true;
  marketPanel.append(close,marketTitle,marketDetails,marketActions,marketStatus);stage.append(marketPanel);
  ui={showLot:showMarketLot,refresh:()=>draw(),close:()=>{marketPanel.hidden=true}};
 }else{
  ui=mountMayorUI(engine,{notice,refresh,paintMap:mode=>{layer=mode||layer;draw()},focusLot:focus,quality:()=> 'economy',setQuality:()=>notice('WebGL indisponível: o mapa 2D usa qualidade econômica.'),camera:action=>{
   if(action==='in')zoom=Math.min(5,zoom*1.35);else if(action==='out')zoom=Math.max(.5,zoom/1.35);
   else if(action==='project'){const p=engine.s.projects.at(-1);if(p)focus(p.plot);else notice('Nenhuma obra privada iniciada ainda.')}
   else if(action==='park'){const id=engine.s.plots.findIndex(p=>p.holder==='public');if(id>=0)focus(id)}
   else if(action==='left'||action==='right')notice('No mapa 2D, arraste para explorar os bairros.');
   else{zoom=1;panX=0;panY=action==='sea'?100:0}
   draw();ui.close();
  }});
 }
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};moved=false});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;panX+=e.clientX-drag.x;panY+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8)moved=true;draw()});
 canvas.addEventListener('pointerup',e=>{
  if(drag&&!moved){const r=canvas.getBoundingClientRect(),l=layout(),x=(e.clientX-r.left-l.ox)/l.scale,y=(e.clientY-r.top-l.oy)/l.scale;
   for(let i=0;i<1000;i++){const c=cell(i);if(x>=c.x&&x<=c.x+10&&y>=c.y&&y<=c.y+13){(marketMode?showMarketLot(i):ui.showLot(i));break}}
  }drag=null;
 });
 canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(5,zoom*(e.deltaY>0?.9:1.1)));draw()},{passive:false});
 new ResizeObserver(draw).observe(stage);
 const clock=document.getElementById('clockReadout'),night=document.getElementById('nightModeButton');night.hidden=true;
 let last=performance.now(),lastView=0;
 function animate(t){
  const days=marketMode?0:engine.advance(Math.min(2000,Math.max(0,t-last)));last=t;
  if(days||t-lastView>1000){lastView=t;if(!marketMode)ui.refresh(!!days);clock.textContent=marketMode?'🏙️ Mercado de terrenos · 2D':'🗓️ Dia '+(engine.s.day+1)+' · Mês '+engine.s.month;draw()}
  requestAnimationFrame(animate);
 }
 window.addEventListener('pagehide',()=>engine.persist());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)engine.persist()});
 document.getElementById('loading')?.remove();
 window.__imperioReady=true;clearTimeout(window.__imperioBootTimeout);
 notice(marketMode?'WebGL indisponível. Mercado imobiliário 2D ativo.':'Este aparelho não disponibilizou WebGL. A prefeitura continua funcionando no mapa 2D.');
 draw();requestAnimationFrame(animate);
}
