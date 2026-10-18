/* Modo de compatibilidade: a mesma economia, sem exigir WebGL. */
import {MayorEconomy,CITY_MODELS} from './mayor-economy.js?v=10.3';
import {mountMayorUI} from './mayor-ui.js?v=10.3';
export function startCityMap2D({stage,legacyLots,parkIds}){
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
   const p=engine.s.plots[i],{x,y}=cell(i),company=companies.get(i),project=projects.get(i);
   g.fillStyle=p.holder==='public'?'#39815b':colors[engine.zoneFor(i)];g.fillRect(x,y,10,13);
   if(p.model||company){g.fillStyle=company?.active===false?'#777d86':'#e1ddd3';g.fillRect(x+2,y+3,6,7);g.fillStyle='#355b73';g.fillRect(x+3,y+4,2,2)}
   if(project){g.fillStyle='#e3b151';g.fillRect(x+1,y+2,8,9);g.fillStyle='#543d2b';g.fillRect(x+1,y+11,8*project.elapsed/project.days,2)}
   if(layer==='owner'&&p.holder!=='free'){g.strokeStyle='#eed37e';g.strokeRect(x+.5,y+.5,9,12)}
  }
  g.font='bold 11px system-ui';g.textAlign='center';g.fillStyle='#d7ebf5';
  for(let d=0;d<5;d++)g.fillText('BAIRRO '+(d+1),-292+d*140,185);
  g.restore();g.font='11px system-ui';g.fillStyle='#c5dfed';g.textAlign='center';g.fillText('Mapa 2D de compatibilidade · arraste para mover · use zoom para selecionar lotes',w/2,h-58);
 }
 function focus(id){const c=cell(id),l=layout();zoom=2;const n=layout();panX=-c.x*n.scale;panY=-c.y*n.scale;ui?.showLot(id);draw()}
 const refresh=()=>{draw();ui?.refresh(true)};
 ui=mountMayorUI(engine,{notice,refresh,paintMap:mode=>{layer=mode||layer;draw()},focusLot:focus,quality:()=> 'economy',setQuality:()=>notice('WebGL indisponível: o mapa 2D usa qualidade econômica.'),camera:action=>{
  if(action==='in')zoom=Math.min(5,zoom*1.35);else if(action==='out')zoom=Math.max(.5,zoom/1.35);
  else if(action==='project'){const p=engine.s.projects.at(-1);if(p)focus(p.plot);else notice('Nenhuma obra privada iniciada ainda.')}
  else if(action==='park'){const id=engine.s.plots.findIndex(p=>p.holder==='public');if(id>=0)focus(id)}
  else if(action==='left'||action==='right')notice('No mapa 2D, arraste para explorar os bairros.');
  else {zoom=1;panX=0;panY=action==='sea'?100:0}
  draw();ui.close();
 }});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};moved=false});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;panX+=e.clientX-drag.x;panY+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>8)moved=true;draw()});
 canvas.addEventListener('pointerup',e=>{
  if(drag&&!moved){const r=canvas.getBoundingClientRect(),l=layout(),x=(e.clientX-r.left-l.ox)/l.scale,y=(e.clientY-r.top-l.oy)/l.scale;
   for(let i=0;i<1000;i++){const c=cell(i);if(x>=c.x&&x<=c.x+10&&y>=c.y&&y<=c.y+13){ui.showLot(i);break}}
  }drag=null;
 });
 canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(5,zoom*(e.deltaY>0?.9:1.1)));draw()},{passive:false});
 new ResizeObserver(draw).observe(stage);
 const clock=document.getElementById('clockReadout'),night=document.getElementById('nightModeButton');night.hidden=true;
 let last=performance.now(),lastView=0;
 function animate(t){
  const days=engine.advance(Math.min(2000,Math.max(0,t-last)));last=t;
  if(days||t-lastView>1000){lastView=t;ui.refresh(!!days);clock.textContent='🗓️ Dia '+(engine.s.day+1)+' · Mês '+engine.s.month;draw()}
  requestAnimationFrame(animate);
 }
 window.addEventListener('pagehide',()=>engine.persist());
 document.addEventListener('visibilitychange',()=>{if(document.hidden)engine.persist()});
 document.getElementById('loading')?.remove();
 window.__imperioReady=true;clearTimeout(window.__imperioBootTimeout);
 notice('Este aparelho não disponibilizou WebGL. A prefeitura continua funcionando no mapa 2D.');
 draw();requestAnimationFrame(animate);
}
