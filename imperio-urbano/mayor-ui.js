import {PUBLIC_WORKS,CITY_MODELS} from './mayor-economy.js?v=11.9';
const fmt=n=>Math.round(n||0).toLocaleString('pt-BR');
const pct=n=>(Number(n)||0).toFixed(1)+'%';
const ZONES={residential:'Residencial',mixed:'Mista',commercial:'Comercial',industrial:'Industrial',tourism:'Turística',environmental:'Proteção ambiental'};
const SERVICES={health:'Saúde',education:'Educação',safety:'Segurança',roads:'Vias',water:'Saneamento',transport:'Transporte',parks:'Parques'};
const PHASES={preparation:'Preparação',foundation:'Fundação',structure:'Estrutura',finish:'Acabamento',complete:'Concluída'};
const TITLES={guide:'Como jogar',view:'Câmera e gráficos',overview:'Visão geral',finance:'Tesouro e impostos',projects:'Obras municipais',zones:'Zoneamento',investors:'Investidores',news:'Jornal',ledger:'Extrato',permits:'Licenciamento'};
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
  '<div id="mayorMission"></div>'+
  '<div id="mayorDrawer" hidden><div class="mayorDrawerHead">'+
  '<strong id="mayorTitle">🏛️ Prefeitura</strong><button id="mayorClose" type="button" aria-label="Fechar painel">✕</button></div>'+
  '<div id="mayorTabs"></div><div id="mayorBody"></div></div>'+
  '<div id="mayorLotInfo" hidden></div>';
 const byId=id=>document.getElementById(id);
 const drawer=byId('mayorDrawer'),body=byId('mayorBody'),tabs=byId('mayorTabs'),lotBox=byId('mayorLotInfo');
 const toolbar=byId('mayorHeadline');
 let active='overview',isOpen=false,lastSignature='',chosenLot=null,lastDay=-1,mapLayer='none';
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
    '<small>'+(Number.isInteger(w.plot)?'Lote #'+(w.plot+1)+' · ':'Serviço em rede · ')+esc(PHASES[w.status]||w.status)+' · '+w.elapsed+'/'+w.days+' dias · contrato '+fmt(w.cost)+' IU$</small><progress max="'+w.days+'" value="'+w.elapsed+'" aria-label="Progresso da obra"></progress>'+(Number.isInteger(w.plot)?button('Ver no mapa','focus',w.plot):'')+'</div>').join(''):
    '<p class="mayorEmpty">Não há obras públicas em execução.</p>')+
   header('Equipamentos públicos entregues')+
   (s.works.filter((w,i,a)=>w.status==='complete'&&Number.isInteger(w.plot)&&a.findIndex(x=>x.status==='complete'&&x.plot===w.plot)===i).map(w=>'<div class="mayorItem"><b>'+esc(PUBLIC_WORKS[w.kind].name)+'</b><small>Lote #'+(w.plot+1)+'</small>'+button('Ver no mapa','focus',w.plot)+'</div>').join('')||'<p>As entregas de escolas, saúde e guarda aparecerão aqui.</p>')+
   header('Investir em serviços da cidade')+
   '<p>Cada projeto é pago pelo Tesouro e financiado antes de começar. Contratos geram salários e compras de materiais.</p>'+
   Object.entries(PUBLIC_WORKS).map(([id,w])=>'<div class="mayorItem"><b>'+esc(w.name)+'</b><small>'+
   fmt(w.cost)+' IU$ · '+w.days+' dias · melhoria '+w.benefit+' pontos</small>'+
   button(s.works.some(x=>x.category===w.category&&x.status!=='complete')?'Obra em andamento':'Financiar obra', 'work',id,engine.account('treasury')<w.cost||s.works.some(x=>x.category===w.category&&x.status!=='complete'))+'</div>').join('');
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
   Object.entries(s.allocations).map(([name,val])=>row(SERVICES[name]||name,Math.round(val)+' / 100')).join('');
 }
 function investorsView(){
  const active=s.companies.filter(c=>c.active);
  return header('Investidores que decidem sozinhos')+
   '<p>Os agentes avaliam impostos, demanda, capital, concorrência e zoneamento. Não há lucros garantidos.</p>'+
   header('Empresas em atividade')+
   (active.slice(0,20).map(c=>'<div class="mayorItem"><b>'+esc(CITY_MODELS[c.kind].name)+' · lote #'+(c.plot+1)+'</b><small>Receita '+fmt(c.revenue)+' IU$ · Lucro '+fmt(c.profit)+' IU$ · Empregos '+c.workers+(c.sector==='retail'?' · Estoque '+fmt(c.stock||0)+' IU$':'')+'</small></div>').join('')||'<p>Nenhuma empresa ainda.</p>')+
   header('Capital dos investidores')+
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
 function guideView(){
  return header('Você governa. A cidade empreende.')+
   '<p>Seu dinheiro é o Tesouro municipal. Casas, lojas e fábricas são financiadas pelos investidores, que tomam decisões sozinhos.</p>'+
   '<div class="mayorItem"><b>1 · Prepare a cidade</b><span>Veja os bairros no Zoneamento. Residencial recebe moradias; comercial recebe lojas; industrial gera empregos; mista combina usos.</span>'+button('Planejar bairros','tab','zones')+'</div>'+
   '<div class="mayorItem"><b>2 · Invista em um serviço</b><span>Uma obra pública consome caixa agora e melhora serviços quando termina. Evite gastar todo o Tesouro: a manutenção continua a cada dia.</span>'+button('Escolher uma obra','tab','projects')+'</div>'+
   '<div class="mayorItem"><b>3 · Observe o resultado</b><span>Acelere o tempo e acompanhe os canteiros. Empresas criam empregos, atendem moradores e pagam impostos. Tributos excessivos afastam investimentos.</span>'+button('Ver investidores','tab','investors')+'</div>'+
   header('Mover a câmera')+'<p>No celular: um dedo move; dois dedos giram e fazem zoom. No computador: arraste para mover e use a roda para aproximar. Câmera e gráficos oferecem botões de giro e zoom.</p>'+
   header('Objetivo da gestão')+'<p>Equilibre caixa, empregos e satisfação. As metas guiam seu progresso; não dão dinheiro artificial. O progresso é salvo neste navegador.</p>';
 }
 function viewView(){
  return header('Explore Nova Jundiaí')+
   button('⌖ Cidade inteira','camera','city')+button('🌅 Olhar para o mar','camera','sea')+
   button('🏗️ Obra mais recente','camera','project')+button('🌳 Visitar parque','camera','park')+
   header('Controle da câmera')+
   button('＋ Aproximar','camera','in')+button('− Afastar','camera','out')+
   button('↶ Girar esquerda','camera','left')+button('↷ Girar direita','camera','right')+
   header('Qualidade gráfica')+'<p>Economia reduz resolução e sombras. Alta melhora a definição em aparelhos mais potentes.</p>'+
   '<label class="mayorZone">Qualidade<select data-quality="1">'+['economy','balanced','high'].map((v,i)=>'<option value="'+v+'"'+(ctx.quality?.()===v?' selected':'')+'>'+['Economia','Equilibrada','Alta'][i]+'</option>').join('')+'</select></label>';
 }
 function guidance(){
  const pending=s.permits.filter(p=>p.status==='pending').length;
  if(pending)return {text:pending+' proposta(s) aguardando licença. Revise para liberar investimentos.',tab:'permits'};
  const weak=Object.entries(s.allocations).sort((a,b)=>a[1]-b[1])[0];
  if(engine.account('treasury')<100000)return {text:'Caixa baixo: preserve a reserva e revise despesas antes de novas obras.',tab:'finance'};
  if(s.metrics.unemployment>25)return {text:'Faltam empregos. Avalie bairros comerciais e industriais e a carga de impostos.',tab:'zones'};
  return {text:'Prioridade sugerida: '+SERVICES[weak[0]]+' ('+Math.round(weak[1])+'/100). Uma obra melhora esse serviço.',tab:'projects'};
 }
 function overviewView(){
  const data=engine.snapshot();
  const active=s.companies.filter(c=>c.active);
  const jobs=active.reduce((n,c)=>n+c.workers,0);
  const wages=s.ledger.filter(t=>t.day>=Math.max(0,s.day-6)&&t.reason.includes('Salários')).reduce((a,t)=>a+t.amount,0);
  const advice=guidance(),challenge=s.challenge;
  return '<div class="mayorItem"><b>📋 Gabinete do prefeito</b><span>'+esc(advice.text)+'</span>'+button('Ver prioridade','tab',advice.tab)+button('Como jogar','tab','guide')+'</div>'+
   (challenge?.status==='pending'?'<div class="mayorItem"><b>🤝 Proposta do conselho</b><span>Mutirão de '+esc(SERVICES[challenge.category])+': +4 pontos por '+fmt(challenge.cost)+' IU$. Você decide se a melhoria vale o custo. Prazo: dia '+(challenge.deadline+1)+'.</span>'+button('Financiar mutirão','challenge','yes',engine.account('treasury')<challenge.cost)+button('Preservar caixa','challenge','no')+'</div>':'')+
   header('Metas da gestão')+engine.objectives().map(o=>'<div class="mayorItem"><b>'+(o.current>=o.target?'✓ ':'○ ')+esc(o.title)+' · '+Math.min(o.current,o.target)+'/'+o.target+'</b><progress max="'+o.target+'" value="'+Math.min(o.current,o.target)+'"></progress><small>'+esc(o.hint)+'</small></div>').join('')+
   '<label class="mayorZone">🗺️ Mapa temático <select data-map="1">'+
   '<option value="none">Normal</option>'+
   '<option value="zone">Zoneamento</option>'+
   '<option value="owner">Propriedade</option>'+
   '<option value="construction">Construções</option>'+
   '<option value="valuation">Valor dos terrenos</option>'+
   '<option value="density">Densidade</option>'+
   '<option value="jobs">Empregos</option>'+
   '<option value="demand">Demanda comercial</option>'+
   '<option value="service">Qualidade dos serviços</option></select></label>'+
   '<div class="mayorStats">'+
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
   '<p class="mayorInfo">Simulação local por etapas: as contas são fechadas por dia. Use ⏩ para escolher a velocidade: 10× corresponde a 30 segundos por dia. Pausar também interrompe o ciclo de luz.</p>';
 }
 function content(){
  switch(active){
   case 'guide':return guideView();
   case 'view':return viewView();
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
 const TABS=['overview','guide','view','finance','projects','zones','investors','permits','news','ledger'];
 function drawPanel(){
  if(!isOpen)return;
  tabs.innerHTML=TABS.map(k=>'<button type="button" data-tab="'+k+'"'+(active===k?' class="current"':'')+'>'+TITLES[k]+'</button>').join('');
  byId('mayorTitle').textContent='🏛️ '+TITLES[active];
  const scrollTop=body.scrollTop;
  body.innerHTML='<div id="mayorMessage" hidden></div>'+content();
  const mapSelect=body.querySelector('[data-map]');if(mapSelect)mapSelect.value=mapLayer;
  body.scrollTop=scrollTop;
 }
 function updateHeadline(){
  const d=engine.snapshot();
  toolbar.textContent='🏦 '+fmt(d.treasury)+' IU$ · 👥 '+fmt(d.population)+' · 🚗 '+fmt(d.vehicles)+' · 🏢 '+d.companies+
   ' · Dia '+(d.day+1)+' / M'+d.month;
  byId('mayorPause').textContent=d.paused?'▶️':'⏸';
  byId('mayorPause').setAttribute('aria-label',d.paused?'Retomar simulação':'Pausar simulação');
  const goals=engine.objectives(),next=goals.find(o=>o.current<o.target);
  const mission=byId('mayorMission');
  mission.textContent=next?'🎯 '+next.title+' · '+Math.min(next.current,next.target)+'/'+next.target:'🏆 Todas as metas iniciais concluídas! Continue desenvolvendo a cidade.';
  mission.onclick=()=>open(next?.tab||'overview');
  byId('mayorSpeed').textContent='⏩ '+d.speed+'×';
 }
 function open(tab='overview'){isOpen=true;active=tab;byId('mayorMenuButton').setAttribute('aria-expanded','true');body.scrollTop=0;drawer.hidden=false;drawPanel()}
 function close(){isOpen=false;byId('mayorMenuButton').setAttribute('aria-expanded','false');drawer.hidden=true}
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
  if(action==='focus'){ctx.focusLot?.(Number(value));close();return}
  if(action==='camera'){ctx.camera?.(value);return}
  if(action==='challenge'){
   const ok=engine.decideChallenge(value==='yes');
   drawPanel();msg(ok?'Decisão registrada no jornal e no Tesouro.':'Saldo insuficiente ou proposta expirada.');updateHeadline();return;
  }
  let feedback='';
  if(action==='work'){
   const out=engine.startWork(value);
   feedback=out.ok?'Contrato financiado e obra iniciada.':out.reason;
  }else if(action==='permitYes'||action==='permitNo'){
   feedback=engine.decidePermit(value,action==='permitYes')?'Licenciamento registrado.':'Proposta inválida ou sem capital.';
  }
  updateHeadline();ctx.refresh?.();drawPanel();if(feedback)msg(feedback);
 };
 body.onchange=e=>{
  const el=e.target;
  if(el.dataset.quality!==undefined){ctx.setQuality?.(el.value);ctx.notice?.('Qualidade gráfica atualizada.');return}
  if(el.dataset.map!==undefined){
   mapLayer=el.value;ctx.paintMap?.(mapLayer);ctx.notice?.('Mapa: '+el.value);
  }else if(el.dataset.zone!==undefined){
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
  const publicWork=s.works.find(w=>w.plot===plot&&w.status!=='complete');
  const facility=s.plots[plot]?.facility;
  const work=s.projects.find(p=>p.plot===plot&&p.status!=='complete'&&p.status!=='cancelled');
  const company=s.companies.find(c=>c.plot===plot);
  const holder=s.investors.find(i=>i.id===lot.holder);
  const stateLabel=lot.holder==='public'?'Área pública':
   lot.holder==='legacy'?'Imóvel anterior preservado':
   lot.holder==='free'?'Lote disponível para investidores':
   'Propriedade de '+(holder?.name||lot.holder);
  const publicLabel=facility?({escola:'Escola municipal',hospital:'Unidade de saúde',seguranca:'Base da guarda municipal'}[facility]):'';
  const detail=publicWork?' · '+publicLabel+' em construção · '+Math.round(publicWork.elapsed/publicWork.days*100)+'%':facility?' · '+publicLabel+' em funcionamento':work?' · Construção: '+CITY_MODELS[work.kind].name+' · '+(PHASES[work.status]||work.status)+' · '+Math.round(work.elapsed/work.days*100)+'%':
   company?' · '+CITY_MODELS[company.kind].name+(company.active?' em operação':' fechada')+' · receita '+fmt(company.revenue)+' IU$'+(company.sector==='retail'?' · estoque '+fmt(company.stock||0)+' IU$':''):
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
   if(isOpen&&!(body.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea')))drawPanel();
   if(chosenLot!==null)showLot(chosenLot);
  }
 }
 const helpButton=document.createElement('button');helpButton.id='mayorHelp';helpButton.textContent='?';helpButton.setAttribute('aria-label','Como jogar');helpButton.onclick=()=>open('guide');byId('mayorToolbar').append(helpButton);
 const mission=byId('mayorMission');mission.setAttribute('role','button');mission.tabIndex=0;mission.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mission.click()}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){close();lotBox.hidden=true;chosenLot=null}});
 updateHeadline();
 if(s.day===0&&!s.works.length)open('guide');
 return {open,close,refresh,showLot,isOpen:()=>isOpen};
}
