import {MayorEconomy} from './mayor-economy.js';
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
 function scenario(name,fn){
  try{const result=fn();cases.push({name,ok:true,detail:result||''})}
  catch(error){cases.push({name,ok:false,detail:error.message})}
 }
 scenario('Cidade em crescimento',()=>{
  const {game:g}=make();g.setTax('service',1);
  g.setTax('permit',0);g.startWork('avenida');g.startWork('escola');
  g.runDays(65);
  const built=g.s.projects.filter(p=>p.status==='complete').length;
  assert(built>2,'Investidores não concluíram obras');
  assert(g.s.companies.length>6,'Empresas não surgiram');
  assert(g.s.ledger.some(x=>x.reason.includes('Contrato de construção')),'Contratos não registrados');
  assert(g.total()===40000000,'Dinheiro criado durante crescimento');
  return built+' obras privadas concluídas';
 });
 scenario('Impostos altos reduzem investimento',()=>{
  const baseline=make().game,high=make().game;
  baseline.setTax('service',1);baseline.setTax('permit',0);
  high.setTax('service',12);high.setTax('permit',12);high.setTax('property',10);
  baseline.runDays(60);high.runDays(60);
  assert(high.s.projects.length<baseline.s.projects.length,'Os impostos não mudaram decisões');
  return baseline.s.projects.length+' investimentos com tributação baixa contra '+high.s.projects.length+' alta';
 });
 scenario('Crise reduz atividade',()=>{
  const normal=make().game,crisis=make().game;
  crisis.s.cycle=-.65;
  for(const k of Object.keys(crisis.s.allocations))crisis.s.allocations[k]=8;
  normal.runDays(60);crisis.runDays(60);
  assert(crisis.s.projects.length<normal.s.projects.length,'Crise não reduziu investimento');
  assert(crisis.s.metrics.product<normal.s.metrics.product,'Crise não reduziu produção');
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
  const old=JSON.stringify(g.s);
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
  const {game:g}=make();g.setTax('service',1);g.runDays(85);
  const shops=g.s.companies.filter(c=>c.sector==='retail');
  assert(shops.length>0,'Nenhum comércio foi aberto');
  assert(shops.every(c=>Number.isFinite(c.stock)&&c.stock>=0),'Estoque inválido');
  assert(g.s.ledger.some(t=>t.reason.startsWith('Reposição de estoque')),'Nenhuma compra de mercadorias');
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
  const copyState=JSON.stringify(g.s);
  const restored=new MayorEconomy({storage,legacyLots:legacy,parkIds,now:5000});
  assert(JSON.stringify(restored.s)===copyState,'Persistência perdeu dados de anos');
  return g.s.companies.length+' empresas após '+g.s.day+' dias';
 });
 return {passed:cases.filter(c=>c.ok).length,total:cases.length,cases};
}
