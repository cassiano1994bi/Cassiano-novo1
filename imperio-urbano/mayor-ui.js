import {PUBLIC_WORKS,CITY_MODELS} from './mayor-economy.js';
const fmt=n=>Math.round(n||0).toLocaleString('pt-BR');
const pct=n=>(Number(n)||0).toFixed(1)+'%';
const ZONES={residential:'Residencial',mixed:'Mista',commercial:'Comercial',industrial:'Industrial',tourism:'Turística',environmental:'Proteção ambiental'};
const TITLES={overview:'Visão geral',finance:'Tesouro e impostos',projects:'Obras municipais',zones:'Zoneamento',investors:'Investidores',news:'Jornal',ledger:'Extrato',permits:'Licenciamento'};
const esc=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
export function mountMayorUI(engine,ctx){
 const holder=document.getElementById('mayorHUD');
 if(!holder)throw Error('Painel do prefeito não encontrado');
 const s=engine.s;
 holder.innerHTML='<div id="mayorToolbar">'+
  '<button id="mayorMenuButton" type="button">🏛️ Prefeitura</button>'+
  '<span id="mayorHeadline" aria-live="off"></span>'+
  '<button id="mayorPause" type="button" aria-label="Pausar simulação">⏸</button>'+
  '<button id="mayorSpeed" type="button" aria-label="Acelerar simulação">⏩ 10×</button>'+
  '<button id="mayorRotate" type="button" aria-label="Visualização horizontal">↔️</button>'+
  '</div>'+
  '<div id="mayorDrawer" hidden><div class="mayorDrawerHead">'+
  '<strong id="mayorTitle">🏛️ Prefeitura</strong><button id="mayorClose" type="button" aria-label="Fechar painel">✕</button></div>'+
  '<div id="mayorTabs"></div><div id="mayorBody"></div></div>'+
  '<div id="mayorLotInfo" hidden></div>';
 const byId=id=>document.getElementById(id);
 const drawer=byId('mayorDrawer'),body=byId('mayorBody'),tabs=byId('mayorTabs'),lotBox=byId('mayorLotInfo');
 const toolbar=byId('mayorHeadline');
 let active='overview',isOpen=false,lastSignature='',chosenLot=null,lastDay=-1;
 function msg(text){const id=byId('mayorMessage');if(id){id.textContent=text;id.hidden=false}else ctx.notice?.(text)}
 function row(label,value){return '<div class="mayorRow"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>'}
 function metric(label,value){return '<div class="mayorStat"><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>'}
 function header(text){return '<h3>'+esc(text)+'</h3>'}
 function button(label,act,data='',disabled=false){
  return '<button type="button" data-action="'+esc(act)+'" data-value="'+esc(data)+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
 }
 function workView(){
  const projects=s.works.filter(w=>w.status!=='complete');
  return header('Obras públicas aprovadas')+
   (projects.length?projects.map(w=>'<div class="mayorItem"><b>'+esc(PUBLIC_WORKS[w.kind].name)+'</b>'+
    '<small>'+esc(w.status)+' · '+w.elapsed+'/'+w.days+' dias · contrato '+fmt(w.cost)+' IU$</small></div>').join(''):
    '<p class="mayorEmpty">Não há obras públicas em execução.</p>')+
   header('Investir em serviços da cidade')+
   '<p>Cada projeto é pago pelo Tesouro e financiado antes de começar. Contratos geram salários e compras de materiais.</p>'+
   Object.entries(PUBLIC_WORKS).map(([id,w])=>'<div class="mayorItem"><b>'+esc(w.name)+'</b><small>'+
   fmt(w.cost)+' IU$ · '+w.days+' dias · melhoria '+w.benefit+' pontos</small>'+
   button('Financiar obra', 'work',id,engine.account('treasury')<w.cost)+'</div>').join('');
 }
 function zoneView(){
  const types=Object.entries(ZONES);
  return header('Planejamento dos cinco bairros')+
   '<p>Investidores somente podem construir modelos compatíveis com a zona. Os parques e lotes anteriores continuam preservados.</p>'+
   s.zones.map((zone,i)=>'<label class="mayorZone">Bairro '+(i+1)+
   '<select data-zone="'+i+'">'+types.map(([id,name])=>'<option value="'+id+'"'+(id===zone?' selected':'')+'>'+esc(name)+'</option>').join('')+
   '</select></label>').join('')+
   '<p class="mayorInfo">A alteração do zoneamento muda as futuras decisões dos investidores. Obras existentes permanecem.</p>';
 }
 function financeView(){
  const month=s.monthly[s.monthly.length-1],bal=engine.account('treasury');
  return header('Caixa do Tesouro')+
   row('Disponível',fmt(bal)+' IU$')+
   row('Receitas neste mês',fmt(s.monthlyTotals.revenue)+' IU$')+
   row('Despesas neste mês',fmt(s.monthlyTotals.expenses)+' IU$')+
   row('Saldo do mês',fmt(s.monthlyTotals.revenue-s.monthlyTotals.expenses)+' IU$')+
   row('Dívida municipal',fmt(s.outstandingDebt)+' IU$')+
   (month?row('Fechamento anterior',fmt(month.revenue-month.expenses)+' IU$'):'')+
   header('Alíquotas simuladas')+
   '<p>Tributos simplificados para jogabilidade; não representam a legislação brasileira.</p>'+
   [['service','Atividade econômica'],['property','IPTU anual'],['permit','Licenciamento']].map(([id,label])=>
    '<label class="mayorTax">'+esc(label)+' <b>'+pct(s.rates[id])+'</b>'+
    '<input type="range" min="0" max="12" step="0.5" value="'+s.rates[id]+'" data-tax="'+id+'"></label>').join('')+
   header('Serviços públicos')+
   Object.entries(s.allocations).map(([name,val])=>row(name,Math.round(val)+' / 100')).join('');
 }
 function investorsView(){
  const active=s.companies.filter(c=>c.active);
  return header('Investidores que decidem sozinhos')+
   '<p>Os agentes avaliam impostos, demanda, capital, concorrência e zoneamento. Não há lucros garantidos.</p>'+
   s.investors.map(i=>{
    const owned=s.plots.filter(p=>p.holder===i.id).length;
    const companies=active.filter(c=>c.investor===i.id).length;
    return '<div class="mayorItem"><b>'+esc(i.name)+'</b>'+
     '<small>'+esc(i.profile)+' · '+esc(i.interest)+' · capital '+fmt(engine.account(i.id))+' IU$'+
     ' · '+owned+' terreno(s) · '+companies+' empresa(s)</small></div>';
   }).join('');
 }
 function newsView(){
  return header('Jornal econômico de Nova Jundiaí')+
   '<p>As notícias abaixo são geradas apenas por operações registradas no motor econômico.</p>'+
   (s.journal.slice(0,40).map(n=>'<div class="mayorItem"><small>Dia '+n.day+' · '+esc(n.kind)+'</small><span>'+esc(n.text)+'</span></div>').join('')||
     '<p>Nenhuma ocorrência registrada.</p>');
 }
 function ledgerView(){
  return header('Transferências rastreáveis')+
   '<p>Origem, destino, valor e motivo. O dinheiro não é criado em cada transação.</p>'+
   s.ledger.slice(0,40).map(t=>'<div class="mayorItem"><b>'+fmt(t.amount)+' IU$</b><small>'+
    esc(t.from)+' → '+esc(t.to)+' · dia '+t.day+'</small><span>'+esc(t.reason)+'</span></div>').join('');
 }
 function permitsView(){
  const pending=s.permits.filter(p=>p.status==='pending');
  return header('Regras de licenciamento')+
   '<label class="mayorCheck"><input type="checkbox" id="mayorAutoPermit"'+(s.policy.autoPermits?' checked':'')+'> Aprovação automática de projetos compatíveis</label>'+
   '<p>Em modo manual, as propostas aguardam autorização e não iniciam obras por conta própria.</p>'+
   header('Propostas aguardando análise')+
   (pending.length?pending.map(p=>'<div class="mayorItem"><b>'+esc(CITY_MODELS[p.kind]?.name||p.kind)+'</b>'+
     '<small>Terreno #'+(p.plot+1)+' · '+fmt(p.cost)+' IU$</small>'+
     button('Aprovar', 'permitYes',p.id)+button('Recusar','permitNo',p.id)+'</div>').join(''):
    '<p class="mayorEmpty">Sem pedidos pendentes.</p>');
 }
 function overviewView(){
  const data=engine.snapshot();
  const active=s.companies.filter(c=>c.active);
  const jobs=active.reduce((n,c)=>n+c.workers,0);
  const wages=s.ledger.filter(t=>t.day>=Math.max(0,s.day-6)&&t.reason.includes('Salários')).reduce((a,t)=>a+t.amount,0);
  return '<div class="mayorStats">'+
   metric('Tesouro',fmt(data.treasury)+' IU$')+
   metric('População',fmt(data.population))+
   metric('Empresas',fmt(data.companies))+
   metric('Empregos locais',fmt(jobs))+
   metric('Desemprego',pct(data.unemployment))+
   metric('Satisfação',pct(data.satisfaction))+
   metric('Investimentos',data.privateInvestments)+
   metric('Salários em 7 dias',fmt(wages)+' IU$')+'</div>'+
   header('Economia do mês')+
   row('Receitas municipais',fmt(data.monthlyRevenue)+' IU$')+
   row('Despesas municipais',fmt(data.monthlyExpense)+' IU$')+
   row('PIB mensal estimado',fmt(data.monthlyProduct)+' IU$')+
   row('Atratividade',Math.round(data.attractiveness)+'/100')+
   row('Construções em andamento',data.constructions.length)+
   header('Acompanhar a cidade')+
   button('🏗️ Obras','tab','projects')+
   button('📊 Impostos','tab','finance')+
   button('🏢 Investidores','tab','investors')+
   button('📰 Jornal','tab','news')+
   '<p class="mayorInfo">Simulação local por etapas: as contas são fechadas por dia. Na velocidade 10×, um dia econômico passa a cada 30 segundos reais.</p>';
 }
 function content(){
  switch(active){
   case 'finance':return financeView();
   case 'projects':return workView();
   case 'zones':return zoneView();
   case 'investors':return investorsView();
   case 'news':return newsView();
   case 'ledger':return ledgerView();
   case 'permits':return permitsView();
   default:return overviewView();
  }
 }
 const TABS=['overview','finance','projects','zones','investors','permits','news','ledger'];
 function drawPanel(){
  if(!isOpen)return;
  tabs.innerHTML=TABS.map(k=>'<button type="button" data-tab="'+k+'"'+(active===k?' class="current"':'')+'>'+TITLES[k]+'</button>').join('');
  byId('mayorTitle').textContent='🏛️ '+TITLES[active];
  body.innerHTML='<div id="mayorMessage" hidden></div>'+content();
 }
 function updateHeadline(){
  const d=engine.snapshot();
  toolbar.textContent='🏦 '+fmt(d.treasury)+' IU$ · 👥 '+fmt(d.population)+' · 🏢 '+d.companies+
   ' · Dia '+(d.day+1)+' / M'+d.month;
  byId('mayorPause').textContent=d.paused?'▶️':'⏸';
  byId('mayorSpeed').textContent='⏩ '+d.speed+'×';
 }
 function open(tab='overview'){isOpen=true;active=tab;drawer.hidden=false;drawPanel()}
 function close(){isOpen=false;drawer.hidden=true}
 byId('mayorMenuButton').onclick=()=>isOpen?close():open();
 byId('mayorClose').onclick=close;
 byId('mayorPause').onclick=()=>{engine.togglePause();updateHeadline();ctx.notice?.(engine.s.paused?'Simulação pausada':'Simulação retomada')};
 byId('mayorSpeed').onclick=()=>{
  const levels=[1,5,10,30,60],next=levels[(levels.indexOf(engine.s.speed)+1)%levels.length];
  engine.setSpeed(next);updateHeadline();ctx.notice?.('Velocidade econômica '+next+'×');
 };
 byId('mayorRotate').onclick=async()=>{
  try{if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen()}catch{}
  try{if(screen.orientation?.lock)await screen.orientation.lock('landscape')}catch{}
  if(window.innerHeight>window.innerWidth)ctx.notice?.('Ative a rotação automática e vire o celular.');
 };
 tabs.onclick=e=>{const b=e.target.closest('button[data-tab]');if(!b)return;active=b.dataset.tab;drawPanel()};
 body.onclick=e=>{
  const b=e.target.closest('button[data-action]');if(!b)return;
  const {action,value}=b.dataset;
  if(action==='tab'){active=value;drawPanel();return}
  if(action==='work'){
   const out=engine.startWork(value);
   msg(out.ok?'Contrato financiado e obra iniciada.':out.reason);
  }else if(action==='permitYes'||action==='permitNo'){
   msg(engine.decidePermit(value,action==='permitYes')?'Licenciamento registrado.':'Proposta inválida ou sem capital.');
  }
  updateHeadline();ctx.refresh?.();drawPanel();
 };
 body.onchange=e=>{
  const el=e.target;
  if(el.dataset.zone!==undefined){
   engine.setZone(Number(el.dataset.zone),el.value);
   ctx.paintMap?.();ctx.notice?.('Novo zoneamento registrado.');drawPanel();
  }else if(el.dataset.tax!==undefined){
   engine.setTax(el.dataset.tax,Number(el.value));drawPanel();
  }else if(el.id==='mayorAutoPermit'){
   engine.setPermitMode(el.checked);drawPanel();
  }
 };
 function showLot(plot){
  chosenLot=plot;
  if(plot===null||plot<0){lotBox.hidden=true;return}
  const lot=s.plots[plot],zone=engine.zoneFor(plot);
  const work=s.projects.find(p=>p.plot===plot&&p.status!=='complete');
  const company=s.companies.find(c=>c.plot===plot);
  const holder=s.investors.find(i=>i.id===lot.holder);
  const stateLabel=lot.holder==='public'?'Área pública':
   lot.holder==='legacy'?'Imóvel anterior preservado':
   lot.holder==='free'?'Lote disponível para investidores':
   'Propriedade de '+(holder?.name||lot.holder);
  const detail=work?' · Construção: '+CITY_MODELS[work.kind].name+' · '+work.status+' · '+Math.round(work.elapsed/work.days*100)+'%':
   company?' · '+CITY_MODELS[company.kind].name+(company.active?' em operação':' fechada'):
   lot.model?' · Construção existente':'';
  lotBox.hidden=false;
  lotBox.innerHTML='<button type="button" id="mayorLotClose" aria-label="Fechar">✕</button><b>📍 Lote #'+
    String(plot+1).padStart(3,'0')+'</b><small>Bairro '+(Math.floor(plot/200)+1)+' · '+esc(ZONES[zone]||zone)+'</small>'+
    '<p>'+esc(stateLabel+detail)+'</p>';
  byId('mayorLotClose').onclick=()=>{lotBox.hidden=true;chosenLot=null};
 }
 function refresh(force=false){
  updateHeadline();
  if(force||lastDay!==s.day){
   lastDay=s.day;
   if(isOpen)drawPanel();
   if(chosenLot!==null)showLot(chosenLot);
  }
 }
 updateHeadline();
 return {open,close,refresh,showLot,isOpen:()=>isOpen};
}
