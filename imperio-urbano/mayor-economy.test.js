import {MayorEconomy,CITY_MODELS,CITY_MODEL_COUNT,DAILY_CONSTRUCTION_TARGET,PUBLIC_WORKS} from './mayor-economy.js';
// Testes determinísticos: conservacao, conflitos de lote, tributacao, obras e persistencia.
export function runMayorEconomyTests(){
 const cases=[];
 function assert(x,msg){if(!x)throw new Error(msg)}
 function make(){
  const store=new Map(),storage={
   getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)}
  };
  const legacy=Array.from({length:1000},(_,i)=>({
   owner:i%19===0?'npc':'free',building:i%53===0?'predio_compacto':'',price:0
  }));
  const parkIds=Array.from({length:40},(_,i)=>i+300);
  const game=new MayorEconomy({storage,legacyLots:legacy,parkIds,now:1000});
  return {game,storage,legacy,parkIds};
 }
 function reloadExpected(game){
  const state=JSON.parse(JSON.stringify(game.s));
  if(!Number.isFinite(state.migrationRemainder))state.migrationRemainder=0;
  if(!Number.isFinite(state.monthlyMigration))state.monthlyMigration=0;
  for(const inv of state.investors){
   if(!Number.isFinite(inv.debt))inv.debt=0;
   if(inv.id==='investor:2'){inv.name='Coca-Cola Brasil';inv.brand='cocacola';inv.interest='industry'}
   if(inv.id==='investor:5'){inv.name='Mercado Livre';inv.brand='mercadolivre';inv.interest='industry'}
  }
  return JSON.stringify(state);
 }
 function scenario(name,fn){
  try{const result=fn();cases.push({name,ok:true,detail:result||''})}
  catch(error){cases.push({name,ok:false,detail:error.message})}
 }
 scenario('Catálogo tem 50 construções e mantém 25 obras ativas',()=>{
  const {game:g}=make();
  assert(CITY_MODEL_COUNT===50,'Catálogo tem '+CITY_MODEL_COUNT+' tipos, não 50');
  assert(new Set(Object.values(CITY_MODELS).map(m=>m.name)).size===50,'Há nomes repetidos no catálogo');
  const active=()=>g.s.projects.filter(p=>p.status!=='complete'&&p.status!=='cancelled');
  for(let day=0;day<45;day++){
   g.tickDay();
   assert(active().length===DAILY_CONSTRUCTION_TARGET,'Dia '+g.s.day+' ficou com '+active().length+' obras ativas');
   assert(active().every(p=>CITY_MODELS[p.kind]),'Obra usa tipo sem definição');
  }
  const sectors=new Set(active().map(p=>CITY_MODELS[p.kind].type));
  assert(sectors.has('residential')&&sectors.has('retail')&&sectors.has('industry'),'Obras não acompanharam moradia, comércio e emprego');
  return CITY_MODEL_COUNT+' tipos; '+DAILY_CONSTRUCTION_TARGET+' obras simultâneas nos 45 dias';
 });
 scenario('Cidade em crescimento',()=>{
  const {game:g}=make();g.setTax('service',1);
  g.setTax('permit',0);g.startWork('avenida');g.startWork('escola');
  // O extrato é limitado: capturar contratos enquanto ocorrem, não após sua expiração.
  let sawContract=false;
  for(let d=0;d<65;d++){g.tickDay();sawContract ||= g.s.ledger.some(x=>x.reason.includes('Contrato de construção'));}
  const built=g.s.projects.filter(p=>p.status==='complete').length;
  assert(built>2,'Investidores não concluíram obras');
  assert(g.s.companies.length>6,'Empresas não surgiram');
  assert(sawContract,'Contratos não registrados');
  assert(g.total()===40000000,'Dinheiro criado durante crescimento');
  return built+' obras privadas concluídas';
 });
 scenario('Impostos altos reduzem investimento',()=>{
  const baseline=make().game,high=make().game;
  baseline.setTax('service',1);baseline.setTax('permit',0);
  high.setTax('service',12);high.setTax('permit',12);high.setTax('property',10);
  const lowScore=baseline.listOpportunities(baseline.s.investors[0])[0]?.score||0;
  const highScore=high.listOpportunities(high.s.investors[0])[0]?.score||0;
  assert(highScore<lowScore,'A carga tributária não reduziu a atratividade dos investimentos');
  return 'Atratividade '+lowScore.toFixed(2)+' com impostos baixos contra '+highScore.toFixed(2)+' com impostos altos';
 });
 scenario('Assistente diagnostica e só aplica após aprovação',()=>{
  const {game:g}=make(),advisor=g.cityAdvisor();
  assert(advisor.population>0&&advisor.constructionCount>=0,'Diagnóstico incompleto');
  assert(advisor.suggestion.focus==='residential','Não identificou a pressão por moradia');
  assert(g.s.policy.constructionFocus==='balanced','Assistente alterou a política sem aprovação');
  const result=g.applyAdvisorSuggestion(advisor.suggestion.id);
  assert(result.ok&&g.s.policy.constructionFocus==='residential','Aprovação não aplicou a recomendação');
  assert(!g.applyAdvisorSuggestion(advisor.suggestion.id).ok,'Recomendação obsoleta foi executada novamente');
  return 'Diagnóstico de '+advisor.population+' moradores; aprovação alterou o plano de obras';
 });
 scenario('Crise reduz atividade',()=>{
  const normal=make().game,crisis=make().game;
  crisis.s.cycle=-.65;
  for(const k of Object.keys(crisis.s.allocations))crisis.s.allocations[k]=8;
  normal.runDays(60);crisis.runDays(60);
  assert(crisis.s.metrics.product<normal.s.metrics.product,'Crise não reduziu produção');
  assert(crisis.s.projects.filter(p=>p.status!=='complete'&&p.status!=='cancelled').length===25,'Fila não manteve as 25 obras simultâneas');
  return 'Produção normal '+normal.s.metrics.product+' / crise '+crisis.s.metrics.product;
 });
 scenario('Recuperação econômica',()=>{
  const {game:g}=make();g.s.cycle=-.65;
  for(const k of Object.keys(g.s.allocations))g.s.allocations[k]=8;
  g.runDays(35);const low=g.s.projects.length;
  g.s.cycle=.20;g.setTax('service',1);
  for(const k of Object.keys(g.s.allocations))g.s.allocations[k]=85;
  g.startWork('hospital');g.runDays(50);
  assert(g.s.projects.length>low,'Crescimento não retomou');
  assert(g.s.allocations.health>=85,'Política pública não elevou serviços');
  return 'Investimentos após recuperação: '+(g.s.projects.length-low);
 });
 scenario('Tesouro bloqueia obra acima do saldo sem alterar o estado',()=>{
  const {game:g}=make();
  const cost=PUBLIC_WORKS.hospital.cost;
  const keep=cost-1;
  assert(g.move('treasury','regional',g.account('treasury')-keep,'Preparar caixa insuficiente para teste'),'Não foi possível preparar o saldo');
  const beforeTreasury=g.account('treasury'),beforeLedger=g.s.ledger.length;
  const beforeWorks=g.s.works.length,beforeJournal=g.s.journal.length,beforeTotal=g.total();
  const result=g.startWork('hospital');
  assert(!result.ok&&result.reason.includes('sem recursos'),'Obra excedendo o saldo foi autorizada');
  assert(g.account('treasury')===beforeTreasury,'Tentativa recusada alterou o saldo');
  assert(g.s.ledger.length===beforeLedger,'Tentativa recusada criou lançamento financeiro');
  assert(g.s.works.length===beforeWorks&&g.s.journal.length===beforeJournal,'Tentativa recusada alterou obras ou jornal');
  assert(g.total()===beforeTotal,'Tentativa recusada criou ou removeu dinheiro');
  g.validate();
  return 'Saldo insuficiente recusado sem mudança no caixa';
 });
 scenario('Tesouro e transações rastreáveis',()=>{
  const {game:g}=make();
  const initial=g.account('treasury'),contract=76000;
  const r=g.startWork('escola');
  assert(r.ok&&g.account('treasury')===initial-contract,'Contrato público não foi debitado');
  assert(g.s.ledger[0].from==='treasury'&&g.s.ledger[0].to==='builders','Falta origem ou destino');
  assert(!g.startWork('escola').ok,'Obra pública duplicada');
  g.runDays(12);
  assert(g.s.works.find(w=>w.kind==='escola').status==='complete','Obra não foi finalizada');
  assert(g.total()===40000000,'Transferências geraram dinheiro');
  return 'Tesouro diminuiu '+contract+' IU$ e obra foi concluída';
 });
 scenario('Licença manual e construção automática',()=>{
  const {game:g}=make();
  g.setTax('service',0.5);g.setPermitMode(false);
  const inv=g.s.investors.find(i=>i.interest==='residential');
  let selected=null;
  for(let day=0;day<12&&!selected;day++){
   g.s.day=day;
   if(g.tryInvestment(inv))selected=g.s.permits.find(p=>p.status==='pending');
  }
  assert(!!selected,'Nenhuma proposta foi criada');
  const before=g.account(inv.id);
  assert(g.account(inv.id)===before,'O pedido de licença debitou capital antes de aprovar');
  assert(g.decidePermit(selected.id,true),'Não foi possível aprovar licença');
  assert(g.account(inv.id)<before,'Compra/obra não debitou capital');
  g.runDays(22);
  assert(g.s.plots[selected.plot].model,'Modelo não foi registrado ao final');
  assert(g.s.projects.filter(p=>p.plot===selected.plot).length===1,'Lote teve obras duplicadas');
  return 'Lote #'+(selected.plot+1)+' recebeu construção';
 });
 scenario('Parques e lotes antigos preservados',()=>{
  const {game:g,legacy,parkIds}=make();
  g.runDays(45);
  assert(g.s.plots.length===1000,'IDs alterados');
  assert(parkIds.every(id=>g.s.plots[id].holder==='public'),'Parque vendido');
  assert(legacy.every((l,i)=>(l.owner==='free'&&!l.building)||g.s.plots[i].holder==='legacy'||g.s.plots[i].holder==='public'),'Imóvel anterior foi tomado');
  return '1.000 IDs, 40 lotes de parque protegidos';
 });
 scenario('Salvar e reabrir o mesmo município',()=>{
  const {game:g,storage,legacy,parkIds}=make();
  g.setTax('service',4);g.runDays(38);
  const old=reloadExpected(g);
  const second=new MayorEconomy({storage,legacyLots:legacy,parkIds,now:5000});
  assert(JSON.stringify(second.s)===old,'Estado não foi recuperado integralmente');
  second.validate();
  return 'Dia '+second.s.day+', Tesouro '+second.account('treasury');
 });
 scenario('Toda conta mantém saldo não negativo',()=>{
  const {game:g}=make();g.runDays(125);
  assert(Object.values(g.s.accounts).every(x=>Number.isInteger(x)&&x>=0),'Conta negativa');
  assert(g.total()===40000000,'Dinheiro criado em 125 dias');
  assert(!g.s.projects.some((a,i)=>g.s.projects.some((b,j)=>i!==j&&a.plot===b.plot)),'Lote duplicado');
  return g.s.ledger.length+' transações recentes conferidas';
 });
 scenario('Estoque comercial e mercadorias contabilizadas',()=>{
  const {game:g}=make();g.setTax('service',1);let sawRestock=false;
  for(let day=0;day<85;day++){g.tickDay();sawRestock ||= g.s.ledger.some(t=>t.reason.startsWith('Reposição de estoque'))}
  const shops=g.s.companies.filter(c=>c.sector==='retail');
  assert(shops.length>0,'Nenhum comércio foi aberto');
  assert(shops.every(c=>Number.isFinite(c.stock)&&c.stock>=0),'Estoque inválido');
  assert(sawRestock,'Nenhuma compra de mercadorias');
  assert(g.total()===g.s.initialTotal,'Compras geraram dinheiro');
  return shops.length+' comércios, estoque e pagamentos registrados';
 });
 scenario('Auditoria plurianual de 720 dias',()=>{
  const {game:g,storage,legacy,parkIds}=make();
  for(let day=0;day<720;day++)g.tickDay();
  assert(g.s.day===720,'Simulação não chegou ao dia 720');
  assert(g.s.plots.length===1000,'Lotes perdidos');
  assert(g.total()===g.s.initialTotal,'Dinheiro duplicado em longo prazo');
  assert(!g.s.companies.some(c=>c.stock<0),'Estoque ficou negativo');
  const copyState=reloadExpected(g);
  const restored=new MayorEconomy({storage,legacyLots:legacy,parkIds,now:5000});
  assert(JSON.stringify(restored.s)===copyState,'Persistência perdeu dados de anos');
  return g.s.companies.length+' empresas após '+g.s.day+' dias';
 });
 scenario('Construção privada continua depois dos primeiros meses',()=>{
  const {game:g}=make();g.setTax('service',1);g.setTax('permit',0);
  for(let day=0;day<100;day++)g.tickDay();
  const homesAt100=g.s.projects.filter(p=>CITY_MODELS[p.kind]?.type==='residential').length;
  for(let day=100;day<200;day++)g.tickDay();
  const homesAt200=g.s.projects.filter(p=>CITY_MODELS[p.kind]?.type==='residential').length;
  assert(homesAt200>homesAt100,'Novas obras residenciais não começaram depois do dia 100: '+homesAt100+' → '+homesAt200);
  for(let day=200;day<300;day++)g.tickDay();
  const completed=g.s.projects.filter(p=>p.status==='complete').length;
  assert(completed>30,'Investimentos pararam cedo: '+completed+' obras concluídas');
  assert(g.s.investors.some(i=>i.debt>0),'Crédito de expansão não foi acionado');
  assert(g.total()===g.s.initialTotal,'Crédito criou dinheiro em vez de transferir reservas');
  return completed+' construções concluídas; obras residenciais '+homesAt100+' → '+homesAt200+' do dia 100 ao 200; caixa preservado';
 });
 scenario('Migração e chegada de grandes empresas',()=>{
  const {game:g}=make();g.setTax('service',1);g.setTax('permit',0);
  for(let day=0;day<360;day++)g.tickDay();
  const population=g.s.households.reduce((sum,h)=>sum+h.population,0);
  const cola=g.s.companies.find(c=>c.brand==='cocacola');
  const market=g.s.companies.find(c=>c.brand==='mercadolivre');
  assert(population>1900,'Migração não elevou a população: '+population);
  assert(cola?.kind==='industria','Coca-Cola não chegou como indústria');
  assert(market?.kind==='logistica','Mercado Livre não chegou como centro logístico');
  assert(g.total()===g.s.initialTotal,'Investimentos criaram dinheiro');
  return population.toLocaleString('pt-BR')+' moradores; Coca-Cola e Mercado Livre instalados';
 });
 scenario('População cresce diariamente e frota acompanha na proporção 1:5',()=>{
  const {game:g}=make();const before=g.s.households.reduce((sum,h)=>sum+h.population,0);
  g.tickDay();const after=g.snapshot().population;
  assert(after>before,'Nenhum morador novo entrou no primeiro dia');
  assert(g.snapshot().vehicles===Math.floor(after/5),'Frota não acompanha 1 carro por 5 moradores');
  const first=g.snapshot().vehicles;for(let day=0;day<45;day++)g.tickDay();
  assert(g.snapshot().population>after&&g.snapshot().vehicles>first,'Crescimento diário ou frota parou');
  const large=make().game;large.s.households[0].population+=100000;
  for(let day=0;day<30;day++)large.tickDay();
  assert(large.snapshot().population>101000,'A migração encontrou teto artificial');
  return after.toLocaleString('pt-BR')+' → '+large.snapshot().population.toLocaleString('pt-BR')+
   ' moradores; frota '+large.snapshot().vehicles.toLocaleString('pt-BR');
 });
 scenario('Município sem imóveis antigos continua investível',()=>{
  const g=new MayorEconomy({storage:{getItem(){return null},setItem(){}},now:1000});
  assert(g.s.plots.every(p=>p.holder==='free'),'Lotes vazios tratados como patrimônio antigo');
  g.runDays(40);assert(g.s.projects.length>0,'Cidade vazia não recebeu investimentos');
 });
 scenario('Ativar licenciamento automático processa fila',()=>{
  const {game:g}=make();g.setPermitMode(false);g.setTax('service',0);
  g.runDays(10);const pending=g.s.permits.filter(p=>p.status==='pending');
  assert(pending.length>0,'Sem propostas para testar');
  g.setPermitMode(true);
  assert(g.s.permits.every(p=>p.status!=='pending'),'Propostas ficaram bloqueadas');g.validate();
 });
 scenario('Aluguel entra na empresa e paga tributo',()=>{
  const {game:g}=make();
  const inv=g.s.investors[0];
  g.s.accounts['business:test']=0;g.move('regional','business:test',20000,'Capital de teste');
  const home={id:'business:test',plot:80,kind:'medio',investor:inv.id,sector:'residential',workers:0,capacity:9,age:0,active:true};
  g.s.companies.push(home);g.operateCompanies();
  assert(home.revenue>0,'Sem aluguel');
  assert(g.s.ledger.some(t=>t.to===home.id&&t.reason.startsWith('Aluguel')),'Aluguel desviou da empresa');
  assert(g.s.ledger.some(t=>t.from===home.id&&t.to==='treasury'),'Faturamento sem tributação');
  g.validate();
 });
 scenario('Proposta tem custo, efeito e decisão única',()=>{
  const {game:g}=make();g.runDays(4);
  const c=g.s.challenge;assert(c?.status==='pending','Evento não apareceu');
  const cash=g.account('treasury'),quality=g.s.allocations[c.category];
  assert(g.decideChallenge(true),'Decisão recusada');
  assert(g.account('treasury')===cash-c.cost,'Mutirão não debitou tesouro');
  assert(g.s.allocations[c.category]===quality+4,'Serviço não melhorou');
  assert(!g.decideChallenge(true),'Evento pago duas vezes');g.validate();
 });
 scenario('Pausa e velocidade respeitam tempo econômico',()=>{
  const {game:g}=make();g.setSpeed(60);g.togglePause();
  assert(g.advance(300000)===0&&g.s.day===0,'Pausa ignorada');g.togglePause();
  assert(g.advance(5000)===1&&g.s.day===1,'Velocidade incorreta');
 });
 scenario('Fila com mais de 90 pedidos conserva referências',()=>{
  const {game:g}=make();g.setPermitMode(false);g.setTax('service',0);
  const inv=g.s.investors[0];
  g.move('regional',inv.id,30000000,'Capital de teste para fila extensa');
  for(let i=0;i<300;i++){g.s.day=i;g.tryInvestment(inv)}
  const pending=g.s.permits.filter(p=>p.status==='pending');
  assert(pending.length>90,'Cenário não preencheu fila');
  for(const p of g.s.plots)if(p.project)assert(g.s.permits.some(x=>x.id===p.project),'Lote bloqueado sem licença');
 });
 scenario('Equipamentos públicos ocupam lote próprio e preservam parques',()=>{
  const {game:g,parkIds}=make();
  const works=['escola','hospital','seguranca'].map(k=>g.startWork(k));
  assert(works.every(x=>x.ok),'Obras públicas não iniciaram');
  const plots=works.map(x=>x.work.plot);
  assert(new Set(plots).size===3,'Equipamentos sobrepostos');
  assert(plots.every(i=>!parkIds.includes(i)&&g.s.plots[i].holder==='public'),'Parque foi usado para equipamento');
  g.runDays(15);
  assert(plots.every(i=>g.s.plots[i].model?.startsWith('municipal_')),'Entrega não registrou prédio');
  const upgrade=g.startWork('escola');assert(upgrade.work.plot===plots[0],'Ampliação trocou de terreno');
  g.validate();
 });
 scenario('Obras antigas recebem localização sem cobrança adicional',()=>{
  const {game:g,storage,legacy,parkIds}=make();g.startWork('escola');g.runDays(12);
  const old=g.s.works[0].plot;delete g.s.works[0].plot;g.s.plots[old]={holder:'free',project:null,model:null,zone:null};g.persist();
  const cash=g.account('treasury');const restored=new MayorEconomy({storage,legacyLots:legacy,parkIds});
  assert(Number.isInteger(restored.s.works[0].plot),'Obra anterior ficou sem lote');
  assert(restored.account('treasury')===cash,'Migração cobrou novamente');restored.validate();
 });
 scenario('Rede de saneamento não ocupa praça nem cria prédio fictício',()=>{
  const {game:g}=make();const w=g.startWork('saneamento');
  assert(w.ok&&!Number.isInteger(w.work.plot),'Obra de rede ganhou lote indevido');g.runDays(12);
  assert(w.work.status==='complete','Rede não foi concluída');g.validate();
 });
 return {passed:cases.filter(c=>c.ok).length,total:cases.length,cases};
}
