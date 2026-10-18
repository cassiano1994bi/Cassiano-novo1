/* Império Urbano · motor municipal v1. Sem dependências e sem backend.
 * Unidades monetárias IU$ inteiras. Todas as transferências conservam caixa.
 * Só o fundo regional preexistente financia rendas externas, exportações e aportes.
 */
export const MUNICIPAL_SAVE_KEY='imperio_urbano_prefeitura_v1';
export const CITY_MODELS={
 popular:{name:'Casa popular',type:'residential',model:'house_popular',cost:35000,days:5,capacity:6,jobs:0},
 medio:{name:'Casa familiar',type:'residential',model:'house_padrao',cost:54000,days:7,capacity:9,jobs:0},
 luxo:{name:'Residência nobre',type:'residential',model:'house_luxo',cost:135000,days:13,capacity:5,jobs:1},
 apartamentos:{name:'Prédio residencial',type:'residential',model:'predio_urbano',cost:175000,days:16,capacity:54,jobs:2},
 mercado:{name:'Supermercado',type:'retail',model:'predio_compacto',cost:88000,days:9,capacity:0,jobs:22},
 padaria:{name:'Padaria',type:'retail',model:'house_padrao',cost:48000,days:6,capacity:0,jobs:10},
 farmacia:{name:'Farmácia',type:'retail',model:'house_premium',cost:61000,days:8,capacity:0,jobs:9},
 restaurante:{name:'Restaurante',type:'retail',model:'house_luxo',cost:72000,days:8,capacity:0,jobs:14},
 lojas:{name:'Galeria comercial',type:'retail',model:'predio_urbano',cost:130000,days:13,capacity:0,jobs:32},
 hotel:{name:'Hotel',type:'tourism',model:'predio_premium',cost:230000,days:21,capacity:0,jobs:39},
 industria:{name:'Fábrica',type:'industry',model:'predio_compacto',cost:185000,days:18,capacity:0,jobs:42},
 logistica:{name:'Centro logístico',type:'industry',model:'predio_urbano',cost:157000,days:16,capacity:0,jobs:30}
};
export const PUBLIC_WORKS={
 escola:{name:'Ampliação da rede escolar',cost:76000,days:9,category:'education',benefit:8},
 hospital:{name:'Unidade de saúde',cost:110000,days:13,category:'health',benefit:10},
 saneamento:{name:'Rede de saneamento',cost:92000,days:11,category:'water',benefit:9},
 avenida:{name:'Recuperação das avenidas',cost:62000,days:8,category:'roads',benefit:7},
 iluminacao:{name:'Iluminação pública',cost:35000,days:5,category:'safety',benefit:6},
 transporte:{name:'Linhas de transporte',cost:65000,days:8,category:'transport',benefit:8},
 parque:{name:'Melhoria dos parques',cost:32000,days:5,category:'parks',benefit:6},
 seguranca:{name:'Base da guarda municipal',cost:48000,days:7,category:'safety',benefit:6}
};
const INVESTOR_NAMES=['Alvorada Capital','Horizonte Empreendimentos','Coca-Cola Brasil','Grupo Pontal','Aurora Comércio','Mercado Livre','Costa Investimentos','Nova Geração'];
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const money=n=>Math.max(0,Math.round(n));
const copy=v=>JSON.parse(JSON.stringify(v));
export class MayorEconomy{
 constructor({storage,legacyLots=[],parkIds=[],now=Date.now()}={}){
  this.storage=storage||(typeof localStorage!=='undefined'?localStorage:null);
  this.legacyLots=legacyLots;
  this.parkIds=new Set(parkIds);
  let data=null;
  try{const raw=this.storage?.getItem(MUNICIPAL_SAVE_KEY);if(raw)data=JSON.parse(raw)}catch{}
  if(data?.version===1&&data.accounts&&Array.isArray(data.plots)&&data.plots.length===1000){
   this.state=data;this.reconcileLegacy();this.ensurePublicSites();
   for(const inv of this.state.investors){
    if(!Number.isFinite(inv.debt))inv.debt=0;
    if(inv.id==='investor:2'){inv.name='Coca-Cola Brasil';inv.brand='cocacola';inv.interest='industry'}
    if(inv.id==='investor:5'){inv.name='Mercado Livre';inv.brand='mercadolivre';inv.interest='industry'}
   }
   this.validate();return;
  }
  this.state=this.fresh(now);
  this.persist();
 }
 fresh(now){
  const s={
   version:1,day:0,month:1,year:1,seed:391733,seq:1,speed:10,paused:false,accumMs:0,
   lastWall:now,accounts:{regional:40000000,treasury:0,builders:0},initialTotal:40000000,
   rates:{property:1.4,service:3.0,permit:1.0},policy:{autoPermits:true},
   allocations:{health:56,education:54,safety:52,roads:55,water:55,transport:48,parks:59},
   zones:['residential','mixed','mixed','industrial','tourism'],
   investors:[],households:[],companies:[],projects:[],works:[],permits:[],
   plots:[],ledger:[],journal:[],monthly:[],metrics:{revenue:0,expenses:0,privateInvestment:0,product:0,unemployment:0,satisfaction:62},
   monthlyTotals:{revenue:0,expenses:0,product:0},outstandingDebt:0,cycle:0,statsTick:0
  };
  this.state=s;
  for(let i=0;i<1000;i++){
   const l=this.legacyLots[i]||{};
   s.plots.push({holder:this.parkIds.has(i)||l.owner==='park'?'public':((!l.owner||l.owner==='free')&&!l.building?'free':'legacy'),project:null,model:l.building||null,zone:null});
  }
  // Economia monetária fechada: recursos iniciais vêm de reservas regionais explícitas.
  this.move('regional','treasury',1450000,'Transferência inicial de infraestrutura estadual');
  for(let d=0;d<5;d++){
   const id='family:'+d;s.accounts[id]=0;
   this.move('regional',id,205000,'Poupança e renda regional inicial das famílias');
   s.households.push({id,district:d,population:245+d*13,employed:125+d*13,income:0,expenses:0,satisfaction:61});
  }
  for(let i=0;i<8;i++){
   const id='investor:'+i;s.accounts[id]=0;
   this.move('regional',id,255000+(i%4)*65000,'Capital privado de investidores regionais');
   s.investors.push({id,name:INVESTOR_NAMES[i],profile:['conservador','moderado','arrojado'][i%3],
    interest:['residential','retail','industry','tourism'][i%4],brand:i===2?'cocacola':i===5?'mercadolivre':null,
    history:[],assets:[],failed:0,debt:0});
  }
  // Construções já existentes aparecem no mapa, mas não são apropriadas pelo prefeito.
  let oldSeed=0;
  for(let i=0;i<1000&&oldSeed<6;i++){
   const l=this.legacyLots[i];
   if(!l?.building||this.parkIds.has(i))continue;
   const model=l.building.startsWith('house')?'medio':'apartamentos';
   const businessId='business:'+s.seq++;
   s.accounts[businessId]=0;
   this.move('regional',businessId,30000,'Capital de giro de empresa já existente');
   s.companies.push({id:businessId,plot:i,kind:model,investor:null,sector:CITY_MODELS[model].type,
    workers:CITY_MODELS[model].jobs,capacity:CITY_MODELS[model].capacity,revenue:0,expenses:0,
    profit:0,age:0,active:true,stock:0,initialLegacy:true});
   oldSeed++;
  }
  this.news('Prefeitura assume a administração de Nova Jundiaí. O patrimônio anterior foi preservado.');
  this.news('Tesouro recebe transferência regional documentada. Empreendedores analisam novas oportunidades.');
  this.validate();
  return s;
 }
 get s(){return this.state}
 random(){const s=this.s;s.seed=(Math.imul(1664525,s.seed)+1013904223)>>>0;return s.seed/4294967296}
 account(id){return money(this.s.accounts[id]||0)}
 move(from,to,amount,reason){
  const s=this.s;amount=money(amount);
  if(amount===0)return true;
  if(!from||!to||from===to||typeof reason!=='string')return false;
  if(!Object.prototype.hasOwnProperty.call(s.accounts,from)||!Object.prototype.hasOwnProperty.call(s.accounts,to))return false;
  if(s.accounts[from]<amount)return false;
  s.accounts[from]-=amount;s.accounts[to]+=amount;
  s.ledger.unshift({id:s.seq++,day:s.day,from,to,amount,reason});
  if(s.ledger.length>450)s.ledger.length=450;
  if(to==='treasury'){s.metrics.revenue+=amount;s.monthlyTotals.revenue+=amount}
  if(from==='treasury'){s.metrics.expenses+=amount;s.monthlyTotals.expenses+=amount}
  return true;
 }
 news(text,kind='news'){
  this.s.journal.unshift({day:this.s.day,text,kind});
  if(this.s.journal.length>90)this.s.journal.length=90;
 }
 validate(){
  const s=this.s;
  if(s.plots.length!==1000)throw Error('O cadastro deve manter 1000 lotes');
  let sum=0;
  for(const [key,val] of Object.entries(s.accounts)){
   if(!Number.isSafeInteger(val)||val<0)throw Error('Saldo monetário inválido: '+key);
   sum+=val;
  }
  if(sum!==s.initialTotal)throw Error('Violação de conservação monetária: '+sum+' / '+s.initialTotal);
  const active=new Set();
  for(const p of s.projects.filter(p=>p.status!=='complete'&&p.status!=='cancelled')){
   if(active.has(p.plot))throw Error('Duas obras no mesmo lote');active.add(p.plot);
  }
  return true;
 }
 reconcileLegacy(){
  for(let i=0;i<1000;i++){
   if(this.parkIds.has(i))this.s.plots[i].holder='public';
   const l=this.legacyLots[i]||{};
   if(((l.owner&&l.owner!=='free')||l.building)&&this.s.plots[i].holder==='free')this.s.plots[i].holder='legacy';
  }
 }
 persist(now=Date.now()){
  if(!this.storage)return false;
  this.s.lastWall=now;
  try{this.storage.setItem(MUNICIPAL_SAVE_KEY,JSON.stringify(this.s));return true}catch{return false}
 }
 total(){return Object.values(this.s.accounts).reduce((a,b)=>a+b,0)}
 district(plot){return Math.floor(plot/200)}
 zoneFor(plot){return this.s.plots[plot]?.zone||this.s.zones[this.district(plot)]}
 setZone(district,zone){
  if(!Number.isInteger(district)||district<0||district>4||
    !['residential','mixed','commercial','industrial','tourism','environmental'].includes(zone))return false;
  this.s.zones[district]=zone;
  this.news('Novo zoneamento aprovado no bairro '+(district+1)+': '+zone+'.','policy');
  this.persist();return true;
 }
 setTax(key,value){
  if(!['property','service','permit'].includes(key)||!Number.isFinite(value)||value<0||value>12)return false;
  this.s.rates[key]=Math.round(value*10)/10;
  this.news('Prefeitura alterou '+key+' para '+value.toFixed(1)+'%.','policy');
  this.persist();return true;
 }
 setPermitMode(auto){
  this.s.policy.autoPermits=!!auto;
  if(auto)for(const p of [...this.s.permits])if(p.status==='pending'){
   if(!this.decidePermit(p.id,true)&&p.status==='pending'&&this.account(p.investor)<p.cost){
    p.status='denied';if(this.s.plots[p.plot].project===p.id)this.s.plots[p.plot].project=null;
    this.news('Proposta sem capital disponível foi arquivada; lote liberado para novos investidores.','permit');
   }
  }
  this.persist();
 }
 setSpeed(value){
  if(![1,5,10,30,60].includes(value))return false;
  this.s.speed=value;this.persist();return true;
 }
 togglePause(){this.s.paused=!this.s.paused;this.persist();return this.s.paused}
 economicClimate(){
  const s=this.s;const service=Object.values(s.allocations).reduce((a,b)=>a+b,0)/7;
  const tax=s.rates.service+s.rates.property*.65;
  const population=s.households.reduce((a,b)=>a+b.population,0);
  const capacity=s.companies.filter(x=>x.active&&x.sector==='residential').reduce((a,c)=>a+c.capacity,0);
  const jobs=s.companies.filter(x=>x.active).reduce((a,c)=>a+c.workers,0)+Math.round(population*.42);
  const employed=Math.min(population,jobs);
  return {service,tax,population,capacity,jobs,employed,pressure:clamp((population-capacity*.55)/Math.max(1,population),.1,1.6),
   satisfaction:clamp(25+service*.75-tax*1.65-s.outstandingDebt/250000,10,95)};
 }
 modelOptions(zone){
  switch(zone){
   case 'residential':return ['popular','medio','luxo','apartamentos'];
   case 'commercial':return ['mercado','padaria','farmacia','restaurante','lojas','apartamentos'];
   case 'industrial':return ['industria','logistica'];
   case 'tourism':return ['hotel','restaurante','luxo','apartamentos','mercado'];
   case 'mixed':return ['medio','apartamentos','mercado','padaria','farmacia','restaurante','lojas'];
   default:return [];
  }
 }
 listOpportunities(inv){
  const s=this.s,climate=this.economicClimate();
  if(inv.brand){
   const alreadyArrived=s.companies.some(c=>c.brand===inv.brand)||s.projects.some(p=>p.brand===inv.brand);
   if(alreadyArrived||s.day<120||climate.population<1600||climate.satisfaction<48)return [];
  }
  const activeByType={},nearbyByType={};
  for(const c of s.companies.filter(c=>c.active)){
   const key=this.district(c.plot)+':'+c.kind;nearbyByType[key]=(nearbyByType[key]||0)+1;
  }
  for(const p of s.projects.filter(p=>p.status!=='complete'&&p.status!=='cancelled')){
   const key=this.district(p.plot)+':'+p.kind;nearbyByType[key]=(nearbyByType[key]||0)+1;
  }
  const committed=s.permits.filter(p=>p.investor===inv.id&&p.status==='pending').reduce((n,p)=>n+p.cost,0);
  const capital=Math.max(0,this.account(inv.id)-committed);
  for(const c of s.companies.filter(x=>x.active))activeByType[c.kind]=(activeByType[c.kind]||0)+1;
  for(const p of s.projects.filter(p=>p.status!=='complete'&&p.status!=='cancelled'))activeByType[p.kind]=(activeByType[p.kind]||0)+1;
  const free=s.plots.map((l,i)=>({l,i})).filter(({l})=>l.holder==='free'&&!l.project);
  const scored=[];
  for(const {i} of free){
   // Amostra determinística limitada para respeitar Android; cada bairro é avaliado.
   if((i*37+s.day*11+inv.id.length)%7!==0)continue;
   const zone=this.zoneFor(i);let options=this.modelOptions(zone);
   if(inv.brand==='cocacola'){
    if(zone!=='industrial')continue;
    options=['industria'];
   }else if(inv.brand==='mercadolivre'){
    if(zone!=='industrial')continue;
    options=['logistica'];
   }
   for(const kind of options){
    const model=CITY_MODELS[kind];
    const district=this.district(i),distance=this.district(i);
    const land=this.landCost(i),license=money(model.cost*s.rates.permit/100);
    const reserve=money(model.cost*.20),required=land+license+model.cost+reserve;
    if(capital<required)continue;
    const density=climate.population/5;
    const competition=activeByType[kind]||0;
    const services=climate.service/100;
    const attractiveness=climate.satisfaction/100;
    const tourismBonus=model.type==='tourism'?(zone==='tourism'?.47:0):0;
    const housingBonus=model.type==='residential'?.52*climate.pressure:0;
    const retailBonus=model.type==='retail'?clamp(density/310,.4,1.5)*.35:0;
    const industrialBonus=model.type==='industry'?.26:0;
    const investorPreference=model.type===inv.interest?.20:0;
    const taxPenalty=s.rates.service*.035+s.rates.property*.013;
    const nearby=nearbyByType[district+':'+kind]||0;
    const rivalry=nearby*.075+competition*.012;
    const costPenalty=required/capital*.11;
    const score=services*.24+attractiveness*.33+tourismBonus+housingBonus+retailBonus+
      industrialBonus+investorPreference-taxPenalty-rivalry-costPenalty+s.cycle*.38+
      (i%5===0?.03:0)+(district===0&&model.type==='residential'?.11:0);
    scored.push({plot:i,kind,score,land,license,build:model.cost,reserve,required,district});
   }
  }
  scored.sort((a,b)=>b.score-a.score);
  return scored.slice(0,7);
 }
 landCost(plot){
  const row=Math.floor((plot%200)/20);
  const premium=row===0?1.7:row<=2?1.34:row<=5?1.1:1;
  return money((7800+(plot%13)*280)*premium);
 }
 tryInvestment(inv){
  // Crédito rotativo, vindo do fundo regional e limitado por investidor.
  // O empréstimo é contabilizado como transferência; não cria dinheiro.
  if(this.account(inv.id)<165000&&this.account('regional')>12000000&&(inv.debt||0)<520000){
   const credit=Math.min(210000,520000-(inv.debt||0),this.account('regional')-10000000);
   if(credit>0&&this.move('regional',inv.id,credit,'Crédito de expansão para '+inv.name))inv.debt=(inv.debt||0)+credit;
  }
  const opportunities=this.listOpportunities(inv);
  const offer=opportunities[0];
  if(!offer||offer.score<.53){inv.failed++;return false}
  const resistance=inv.profile==='conservador'?.19:inv.profile==='moderado'?.09:-.02;
  const threshold=.61+resistance;
  if(offer.score+this.random()*.25<threshold){inv.failed++;return false}
  const permit={id:'permit:'+this.s.seq++,plot:offer.plot,investor:inv.id,kind:offer.kind,brand:inv.brand||null,
   cost:offer.required,land:offer.land,license:offer.license,build:offer.build,reserve:offer.reserve,
   status:'pending',score:offer.score,day:this.s.day};
  this.s.permits.unshift(permit);
  if(this.s.permits.length>90){
   // Nunca descartar uma licença pendente e deixar o lote bloqueado para sempre.
   const pending=this.s.permits.filter(p=>p.status==='pending');
   this.s.permits=[...pending,...this.s.permits.filter(p=>p.status!=='pending').slice(0,Math.max(0,90-pending.length))];
  }
  this.s.plots[offer.plot].project=permit.id;
  this.news(inv.name+' solicita licença para '+CITY_MODELS[offer.kind].name+' no lote #'+(offer.plot+1)+'.','permit');
  if(this.s.policy.autoPermits)this.decidePermit(permit.id,true);
  return true;
 }
 decidePermit(id,approve){
  const permit=this.s.permits.find(p=>p.id===id);
  if(!permit||permit.status!=='pending')return false;
  const plot=this.s.plots[permit.plot];
  if(!approve){permit.status='denied';plot.project=null;this.news('Licença de '+CITY_MODELS[permit.kind].name+' recusada.','permit');this.persist();return true}
  if(plot.holder!=='free'||plot.project!==permit.id||!this.modelOptions(this.zoneFor(permit.plot)).includes(permit.kind)){
   permit.status='denied';plot.project=null;this.persist();return false;
  }
  // Pré-validação integral: evitar compra sem ter dinheiro para a obra.
  if(this.account(permit.investor)<permit.cost)return false;
  if(!this.move(permit.investor,'treasury',permit.land,'Compra de terreno público #'+(permit.plot+1)))return false;
  if(!this.move(permit.investor,'treasury',permit.license,'Licença municipal de construção'))return false;
  if(!this.move(permit.investor,'builders',permit.build,'Contrato de construção privada'))return false;
  permit.status='approved';
  plot.holder=permit.investor;plot.project=permit.id;
  const days=CITY_MODELS[permit.kind].days;
  this.s.projects.push({id:'project:'+this.s.seq++,plot:permit.plot,kind:permit.kind,owner:permit.investor,brand:permit.brand||null,
   days,elapsed:0,status:'preparation',cost:permit.build,paid:0,created:this.s.day,permit:permit.id,reserve:permit.reserve});
  this.s.metrics.privateInvestment+=permit.cost;
  const investor=this.s.investors.find(i=>i.id===permit.investor);
  investor?.assets.push(permit.plot);
  investor?.history.unshift({day:this.s.day,kind:permit.kind,plot:permit.plot,cost:permit.cost});
  this.news((investor?.name||'Investidor')+' comprou lote #'+(permit.plot+1)+' e contratou obra de '+CITY_MODELS[permit.kind].name+'.','investment');
  this.persist();return true;
 }
 buildProgress(){
  for(const p of this.s.projects){
   if(p.status==='complete'||p.status==='cancelled')continue;
   p.elapsed++;
   const target=money(p.cost*p.elapsed/p.days);
   const due=target-p.paid;
   if(due>0){
    const toFamilies=money(due*.44);
    const group='family:'+this.district(p.plot);
    if(!this.move('builders',group,toFamilies,'Salários na obra de '+CITY_MODELS[p.kind].name))throw Error('Sem caixa na construtora');
    if(!this.move('builders','regional',due-toFamilies,'Materiais regionais da construção'))throw Error('Sem caixa para materiais');
    p.paid+=due;
   }
   const fraction=p.elapsed/p.days;
   p.status=fraction<.20?'preparation':fraction<.46?'foundation':fraction<.76?'structure':fraction<1?'finish':'complete';
   if(p.status==='complete'){
    const model=CITY_MODELS[p.kind],id='business:'+this.s.seq++;
    this.s.accounts[id]=0;
    const capital=money(Math.min(p.reserve,this.account(p.owner)));
    if(capital>0)this.move(p.owner,id,capital,'Capital de giro na inauguração');
    this.s.companies.push({id,plot:p.plot,kind:p.kind,investor:p.owner,brand:p.brand||null,sector:model.type,
      workers:model.jobs,capacity:model.capacity,age:0,revenue:0,expenses:0,profit:0,stock:0,active:true,
      initialLegacy:false});
    const investor=this.s.investors.find(i=>i.id===p.owner);
    this.s.plots[p.plot].model=model.model;
    this.s.plots[p.plot].project=null;
    this.news((investor?.name||'Investidor')+' concluiu '+model.name+' no lote #'+(p.plot+1)+'.','construction');
   }
  }
 }
 publicSite(kind){
  if(!['escola','hospital','seguranca'].includes(kind))return null;
  const existing=this.s.works.find(w=>w.kind===kind&&Number.isInteger(w.plot));
  if(existing)return existing.plot;
  // Usar apenas terreno municipal disponível; parques e imóveis anteriores são intocáveis.
  const candidates=this.s.plots.map((p,i)=>({p,i})).filter(({p,i})=>p.holder==='free'&&!p.project&&!p.model&&!this.parkIds.has(i)&&this.zoneFor(i)!=='environmental');
  candidates.sort((a,b)=>this.landCost(a.i)-this.landCost(b.i)||a.i-b.i);
  return candidates[0]?.i??null;
 }
 ensurePublicSites(){
  for(const w of this.s.works){
   if(!['escola','hospital','seguranca'].includes(w.kind))continue;
   if(!Number.isInteger(w.plot))w.plot=this.publicSite(w.kind);
   if(Number.isInteger(w.plot)){
    const p=this.s.plots[w.plot];p.holder='public';p.facility=w.kind;
    if(w.status==='complete')p.model='municipal_'+w.kind;
   }
  }
 }
 startWork(kind){
  const def=PUBLIC_WORKS[kind],s=this.s;
  if(!def)return {ok:false,reason:'Projeto público inválido'};
  if(s.works.some(w=>w.category===def.category&&w.status!=='complete'))return {ok:false,reason:'Já há obra desse serviço em andamento'};
  if(this.account('treasury')<def.cost)return {ok:false,reason:'Tesouro sem recursos para financiar esta obra'};
  const site=this.publicSite(kind);
  if(['escola','hospital','seguranca'].includes(kind)&&site===null)return {ok:false,reason:'Nenhum terreno municipal livre fora dos parques. Libere uma zona adequada.'};
  if(!this.move('treasury','builders',def.cost,'Contrato de obra pública: '+def.name))return {ok:false,reason:'Pagamento não autorizado'};
  const work={id:'work:'+s.seq++,kind,category:def.category,cost:def.cost,days:def.days,
   elapsed:0,paid:0,status:'preparation'};
  if(Number.isInteger(site)){work.plot=site;s.plots[site].holder='public';s.plots[site].facility=kind;}
  s.works.push(work);
  this.news('Prefeitura licita e financia '+def.name+' ('+def.cost+' IU$).','public');
  this.persist();return {ok:true,work};
 }
 progressWorks(){
  for(const w of this.s.works){
   if(w.status==='complete')continue;
   w.elapsed++;
   const target=money(w.cost*w.elapsed/w.days),due=target-w.paid;
   if(due>0){
    const salary=money(due*.52);
    this.move('builders','family:0',salary,'Salários de obra pública: '+PUBLIC_WORKS[w.kind].name);
    this.move('builders','regional',due-salary,'Fornecimento regional de obra pública');
    w.paid+=due;
   }
   w.status=w.elapsed/w.days<.3?'foundation':w.elapsed<w.days?'structure':'complete';
   if(w.status==='complete'){
    const cfg=PUBLIC_WORKS[w.kind];
    if(Number.isInteger(w.plot))this.s.plots[w.plot].model='municipal_'+w.kind;
    this.s.allocations[cfg.category]=clamp(this.s.allocations[cfg.category]+cfg.benefit,0,100);
    this.news('Prefeitura entrega '+cfg.name+'. Qualidade de '+cfg.category+' aumentou.','public');
   }
  }
 }
 operateCompanies(){
  const s=this.s;
  const climate=this.economicClimate();
  const population=climate.population;
  const active=s.companies.filter(c=>c.active);
  for(const c of active){c.age++;c.revenue=0;c.expenses=0;c.profit=0}
  // Salários de empresas privados saem do caixa das próprias empresas.
  for(const c of active){
   const model=CITY_MODELS[c.kind];
   if(model.type==='residential')continue;
   const paycheck=money(Math.min(this.account(c.id),model.jobs*16));
   const group='family:'+this.district(c.plot);
   if(paycheck>0&&this.move(c.id,group,paycheck,'Salários pagos por '+model.name)){c.expenses+=paycheck}
  }
  // Trabalho regional e rendas de visitantes: dinheiro transferido do fundo regional.
  for(const h of s.households){
   const income=money(h.population*(1.3+climate.service*.017)*clamp(1+s.cycle*.55,.5,1.35));
   const received=Math.min(income,this.account('regional'));
   if(received&&this.move('regional',h.id,received,'Salários de empregos regionais e remessas externas'))h.income+=received;
  }
  // Estoques reais: mercadorias só entram após pagamento a fornecedores regionais.
  // O valor de estoque representa vendas possíveis (markup médio de 35%).
  for(const c of active.filter(c=>c.sector==='retail')){
   if(!Number.isFinite(c.stock))c.stock=0;
   const capacity=Math.max(1400,CITY_MODELS[c.kind].jobs*120);
   const shortage=Math.max(0,capacity-c.stock);
   const procurement=Math.min(this.account(c.id),money(shortage/1.35),CITY_MODELS[c.kind].jobs*58);
   if(procurement>0&&this.move(c.id,'regional',procurement,'Reposição de estoque: '+CITY_MODELS[c.kind].name)){
    c.stock=Math.min(capacity,c.stock+money(procurement*1.35));
    c.expenses+=procurement;
   }
  }
  // Consumo agregado com concorrência. Residentes sem lojas importam do comércio regional.
  for(const h of s.households){
   const cash=this.account(h.id);
   const spending=Math.min(cash,money(h.population*(1.4+climate.satisfaction*.013)*clamp(1+s.cycle,.28,1.4)));
   if(spending<=0)continue;
   const shops=active.filter(c=>c.sector==='retail'||c.sector==='tourism');
   const here=shops.filter(c=>Math.abs(this.district(c.plot)-h.district)<=1);
   const citySpend=here.length?money(spending*.82):0;
   const importSpend=spending-citySpend;
   // Vendas locais divididas pela oferta real; nenhuma loja vende estoque inexistente.
   let sold=0;
   if(here.length){
    const weights=here.map(c=>Math.max(1,CITY_MODELS[c.kind].jobs)*clamp(
      1-(here.filter(other=>other.kind===c.kind).length-1)*.12,.35,1));
    const weightSum=weights.reduce((a,b)=>a+b,0);
    const planned=here.map((c,i)=>i===here.length-1?citySpend:
     money(citySpend*weights[i]/weightSum));
    for(let i=0;i<here.length;i++){
     const c=here[i],allocation=i===here.length-1?Math.max(0,citySpend-sold):planned[i];
     const amount=Math.min(Math.max(0,citySpend-sold),allocation,
      c.sector==='retail'?Math.max(0,c.stock||0):citySpend);
     if(amount&&this.move(h.id,c.id,amount,'Consumo de famílias na empresa '+CITY_MODELS[c.kind].name)){
      c.revenue+=amount;sold+=amount;
      if(c.sector==='retail')c.stock-=amount;
     }
    }
   }
   const external=spending-sold;
   if(external)this.move(h.id,'regional',external,'Consumo regional quando comércio local não atende à demanda');
   h.expenses+=spending;
  }
  // Turismo e exportações têm origem regional documentada, limitadas por capacidade.
  for(const c of active){
   const model=CITY_MODELS[c.kind],regional=this.account('regional');
   if((c.sector==='industry'||c.sector==='tourism')&&regional){
    const external=money((model.jobs*13)*(climate.satisfaction/65)*(.6+this.random()*.6)*clamp(1+s.cycle,.18,1.45));
    const val=Math.min(external,regional);
    if(val&&this.move('regional',c.id,val,'Exportações / turismo de fora de Nova Jundiaí'))c.revenue+=val;
   }
  }
  // Aluguéis: famílias -> proprietário; somente se houver alguma renda disponível.
  const homes=active.filter(c=>c.sector==='residential'&&c.investor);
  const cap=homes.reduce((a,c)=>a+c.capacity,0);
  for(const h of s.households){
   if(!cap)break;
   const local=homes.filter(c=>Math.abs(this.district(c.plot)-h.district)<=1);
   if(!local.length)continue;
   const spend=Math.min(this.account(h.id),money(h.population*.42));
   if(!spend)continue;
   const amount=money(spend/local.length);
   let remaining=spend;
   for(let k=0;k<local.length;k++){
    const c=local[k],rent=k===local.length-1?remaining:Math.min(remaining,amount);
    remaining-=rent;
    this.move(h.id,c.id,rent,'Aluguel residencial do lote #'+(c.plot+1));
    c.revenue+=rent;
   }
  }
  // ISS simulado somente sobre faturamento empresarial existente, nunca sobre caixa bruto fictício.
  for(const c of active){
   if(c.revenue){
    const tax=money(c.revenue*s.rates.service/100);
    if(tax&&this.move(c.id,'treasury',tax,'Tributo municipal sobre atividade econômica'))c.expenses+=tax;
   }
   const overhead=money(Math.min(this.account(c.id),10+CITY_MODELS[c.kind].jobs*5));
   if(overhead&&this.move(c.id,'regional',overhead,'Compra de insumos, água e energia'))c.expenses+=overhead;
   c.profit=c.revenue-c.expenses;
   // Distribuir apenas caixa acima da reserva de giro; receitas e tributos ficam na empresa.
   const reserve=CITY_MODELS[c.kind].cost*.2;
   let dividend=money(Math.min(Math.max(0,c.profit)*.35,Math.max(0,this.account(c.id)-reserve)));
   const investor=s.investors.find(i=>i.id===c.investor);
   if(investor?.debt>0&&dividend){
    const repayment=money(Math.min(investor.debt,dividend*.55));
    if(repayment&&this.move(c.id,'regional',repayment,'Amortização de crédito de '+investor.name)){
     investor.debt-=repayment;dividend-=repayment;
    }
   }
   if(c.investor&&dividend)this.move(c.id,c.investor,dividend,'Dividendos de '+CITY_MODELS[c.kind].name);
   if(this.account(c.id)<150&&c.age>12&&c.sector!=='residential'){
    c.active=false;c.workers=0;
    this.news(CITY_MODELS[c.kind].name+' encerrou operações por falta de caixa no lote #'+(c.plot+1)+'.','crisis');
   }
  }
  // IPTU simulado: a obrigação recai sobre o proprietário do imóvel em operação.
  if(s.day%30===0){
   for(const c of active.filter(c=>c.investor)){
    const tax=money(CITY_MODELS[c.kind].cost*s.rates.property/1200);
    if(tax)this.move(c.investor,'treasury',tax,'IPTU simulado de propriedade privada');
   }
  }
  const dailyService=money(850+population*.36+
   Object.values(s.allocations).reduce((a,b)=>a+b,0)*1.1);
  const available=Math.min(this.account('treasury'),dailyService);
  if(available){
   const wages=money(available*.58);
   this.move('treasury','family:0',wages,'Salários e serviços públicos municipais');
   this.move('treasury','regional',available-wages,'Contratos e manutenção municipais');
  }
  // Sem serviços pagos, qualidade se deteriora lentamente.
  if(available<dailyService){
   for(const key of Object.keys(s.allocations))s.allocations[key]=Math.max(0,s.allocations[key]-.35);
   if(s.day%7===0)this.news('Déficit de custeio reduz a qualidade dos serviços públicos.','crisis');
  }
  const employment=active.reduce((a,c)=>a+c.workers,0);
  s.metrics.unemployment=clamp(100-(employment+population*.42)/(population*.64)*100,0,90);
  s.metrics.satisfaction=clamp(climate.satisfaction-s.metrics.unemployment*.12,5,98);
  s.metrics.product+=active.reduce((a,c)=>a+c.revenue,0);
  s.monthlyTotals.product+=active.reduce((a,c)=>a+c.revenue,0);
  for(const h of s.households)h.satisfaction=s.metrics.satisfaction;
 }
 monthEnd(){
  const s=this.s,climate=this.economicClimate();const quality=climate.satisfaction;
  const employment=s.metrics.unemployment;
  // Migração líquida considera atratividade, empregos e espaço para novas famílias.
  // A cidade já parte com bairros existentes; novos empreendimentos ampliam a capacidade.
  const housingHeadroom=Math.max(0,2200+climate.capacity*3-climate.population);
  const change=clamp(Math.round(3+(quality-50)*.70+(45-employment)*.14+
   Math.min(12,housingHeadroom/500)),-12,24);
  for(const h of s.households){
   const delta=money(Math.abs(change)*(h.district===2?1:.6));
   h.population=Math.max(60,h.population+(change>=0?delta:-delta));
  }
  if(s.month%3===0&&change>=7)this.news('Nova Jundiaí atrai '+
   Math.round(change*4.6)+' moradores neste mês, com vagas e novos bairros.','migration');
  const result=s.monthlyTotals.revenue-s.monthlyTotals.expenses;
  s.monthly.push({month:s.month,year:s.year,revenue:s.monthlyTotals.revenue,
   expenses:s.monthlyTotals.expenses,product:s.monthlyTotals.product,
   balance:this.account('treasury'),population:s.households.reduce((a,h)=>a+h.population,0)});
  if(s.monthly.length>36)s.monthly.length=36;
  this.news('Fechamento do mês '+s.month+': '+(result>=0?'superávit':'déficit')+
   ' de '+Math.abs(result).toLocaleString('pt-BR')+' IU$.','budget');
  s.monthlyTotals={revenue:0,expenses:0,product:0};
  s.month++;if(s.month>12){s.month=1;s.year++}
 }
 tickDay(){
  const s=this.s;
  s.day++;
  // Demanda flutua em ciclos; ciclos ruins reduzem o desempenho comercial.
  if(s.day%33===0){
   s.cycle=clamp(s.cycle+(this.random()-.52)*.3,-.65,.45);
   if(s.cycle<-.26)this.news('Queda da demanda externa pressiona negócios e consumo.','crisis');
  }
  this.buildProgress();
  this.progressWorks();
  this.operateCompanies();
  if(s.day%2===1){
   const order=[...s.investors].sort((a,b)=>this.random()-.5);
   for(const inv of order.slice(0,4))this.tryInvestment(inv);
  }
  if(s.day%30===0)this.monthEnd();
  this.updateChallenge();
  this.validate();
  this.persist();
  return this.snapshot();
 }
 runDays(n){
  const days=clamp(Math.floor(n),0,180);
  for(let i=0;i<days;i++)this.tickDay();
  return this.snapshot();
 }
 advance(elapsedMs){
  const s=this.s;
  if(s.paused||!Number.isFinite(elapsedMs)||elapsedMs<=0)return 0;
  s.accumMs+=Math.min(elapsedMs,300000)*s.speed;
  let done=0;
  while(s.accumMs>=300000&&done<30){s.accumMs-=300000;this.tickDay();done++}
  return done;
 }
 restoreTime(now=Date.now()){
  const s=this.s;
  const elapsed=clamp(now-(s.lastWall||now),0,15*60*1000);
  // Sem servidor: apenas cálculo local, limitado a 15min de tempo real ao reabrir.
  this.advance(elapsed);
  this.persist(now);
 }
 updateChallenge(){
  const s=this.s;
  if(s.challenge&&s.challenge.status==='pending'&&s.day>=s.challenge.deadline){
   s.challenge.status='expired';this.news('A proposta regional expirou. Novas oportunidades chegarão.','event');
  }
  if(s.day%18===4&&(!s.challenge||s.challenge.status!=='pending')){
   const kinds=['education','health','transport'],category=kinds[Math.floor(s.day/18)%3];
   s.challenge={id:'event:'+s.day,category,status:'pending',deadline:s.day+14,cost:24000};
   this.news('O conselho propõe um mutirão de serviços. Analise a proposta na Prefeitura.','event');
  }
 }
 decideChallenge(accept){
  const c=this.s.challenge;
  if(!c||c.status!=='pending'||this.s.day>=c.deadline)return false;
  if(accept){
   if(!this.move('treasury','family:0',c.cost,'Contrato de mutirão de serviços municipais'))return false;
   this.s.allocations[c.category]=clamp(this.s.allocations[c.category]+4,0,100);
  }
  c.status=accept?'accepted':'declined';
  this.news(accept?'Mutirão realizado: serviço melhorou 4 pontos, com custo documentado.':'Prefeitura optou por preservar caixa e recusou o mutirão.','event');
  this.persist();return true;
 }
 objectives(){
  const s=this.s;
  return [
   {title:'Primeira obra pública',hint:'Abra Obras municipais e financie um serviço.',current:s.works.length,target:1,tab:'projects'},
   {title:'Cidade em movimento',hint:'Mantenha zonas compatíveis e impostos atrativos para os investidores.',current:s.projects.filter(p=>p.status==='complete').length,target:5,tab:'zones'},
   {title:'Serviço entregue',hint:'Acompanhe o prazo das obras; a entrega melhora os serviços.',current:s.works.filter(w=>w.status==='complete').length,target:1,tab:'projects'},
   {title:'Prefeitura bem avaliada',hint:'Melhore serviços e favoreça empregos para elevar a satisfação.',current:Math.floor(s.metrics.satisfaction),target:75,tab:'finance'}
  ];
 }
 snapshot(){
  const s=this.s,climate=this.economicClimate();
  const companies=s.companies.filter(c=>c.active),working=companies.reduce((a,c)=>a+c.workers,0);
  const population=s.households.reduce((a,c)=>a+c.population,0);
  return {day:s.day,month:s.month,year:s.year,
   treasury:this.account('treasury'),population,companies:companies.length,
   investors:s.investors.length,employed:Math.round(population*.42)+working,
   unemployment:s.metrics.unemployment,satisfaction:s.metrics.satisfaction,
   attractiveness:clamp(climate.satisfaction-s.rates.service*1.2,0,100),
   monthlyRevenue:s.monthlyTotals.revenue,monthlyExpense:s.monthlyTotals.expenses,
   monthlyProduct:s.monthlyTotals.product,privateInvestments:s.projects.filter(p=>p.status!=='complete').length,
   constructions:s.projects.filter(p=>p.status!=='complete'),
   works:s.works.filter(w=>w.status!=='complete'),
   companiesList:companies,
   permits:s.permits.filter(p=>p.status==='pending'),
   net:this.account('treasury'),speed:s.speed,paused:s.paused,globalTotal:this.total()};
 }
}
