import {WALLET_CAP,MARKET_TAX_RATE,MARKET_SIDE_FEE_RATE,propertyValuation,maximumPropertyPrice,buyListedProperty,buySystemPlot,submitOffer,acceptCounteroffer,sellToInvestor,awardCollectionBonus} from './market-economy.js?v=12.0';

function fmt(value){return Math.round(Number(value)||0).toLocaleString('pt-BR');}
function ensureHistoryDialog(state){
 let dialog=document.getElementById('marketHistoryDialog');
 if(dialog)return dialog;
 dialog=document.createElement('dialog');dialog.id='marketHistoryDialog';
 dialog.setAttribute('aria-labelledby','marketHistoryTitle');
 dialog.style.cssText='width:min(92vw,520px);max-height:82dvh;overflow:auto;border:1px solid #74b3c5;border-radius:16px;background:#142c43;color:#edf7fc;padding:16px';
 const title=document.createElement('h2');title.id='marketHistoryTitle';title.textContent='📜 Histórico de negociações';
 const list=document.createElement('div');list.id='marketHistoryBody';
 const close=document.createElement('form');close.method='dialog';close.style.marginTop='12px';
 const closeButton=document.createElement('button');closeButton.textContent='Fechar';closeButton.style.cssText='padding:9px 14px;border:0;border-radius:9px;background:#52d5a1;font-weight:700';
 close.append(closeButton);dialog.append(title,list,close);document.body.append(dialog);return dialog;
}
function showHistory(state){
 const dialog=ensureHistoryDialog(state),body=dialog.querySelector('#marketHistoryBody');body.replaceChildren();
 const entries=Array.isArray(state.marketHistory)?state.marketHistory:[];
 if(!entries.length){const p=document.createElement('p');p.textContent='Ainda não há negociações registradas.';body.append(p);}
 for(const entry of entries){
  const row=document.createElement('div');row.style.cssText='padding:9px 0;border-bottom:1px solid #456176';
  const title=document.createElement('strong');title.textContent=(entry.description||'Movimentação')+(entry.lotId===null?'':' · Terreno #'+String(entry.lotId+1).padStart(3,'0'));
  const detail=document.createElement('div');detail.textContent=new Date(entry.at).toLocaleString('pt-BR')+' · '+fmt(entry.amount)+' IU$'+(entry.fee?' · taxas '+fmt(entry.fee)+' IU$':'')+(entry.type==='sale'?' · recebido '+fmt(entry.net)+' IU$':'');
  row.append(title,detail);body.append(row);
 }
 dialog.showModal();
}
function button(actions,label,fn,{alt=false,disabled=false}={}){
 const el=document.createElement('button');el.type='button';el.textContent=label;if(alt)el.className='alt';el.disabled=disabled;
 if(disabled){el.style.opacity='.6';el.style.cursor='not-allowed';}else el.onclick=fn;
 actions.append(el);return el;
}
function input(actions,value,max){
 const el=document.createElement('input');el.type='number';el.min='1000';el.max=String(max);el.step='100';el.inputMode='numeric';el.value=String(Math.min(max,Math.max(1000,Math.round(value/100)*100)));el.setAttribute('aria-label','Valor em IU$');actions.append(el);return el;
}
export function renderMarketPanel(o){
 const {state,selected,actions,panelTitle,desc,status,area,lotShape,rarityNames,rarityIndex,zoneDescription,buildingLabel,beginConstruction,isPublicParkLot,publicParkName,cost,buildingPrice,save,updateMapHighlights,renderState}=o;
 const history=()=>button(actions,'📜 Histórico de negociações',()=>showHistory(state),{alt:true});
 const commit=message=>{save();updateMapHighlights();renderState();status.textContent=message;};
 const appraise=(id,lot=state.lots[id])=>propertyValuation(cost(id),lot?.building?buildingPrice(id,lot.building):0);
 if(selected<0){
  panelTitle.textContent='🏙️ Mercado imobiliário';
  desc.textContent='Compre terrenos, construa, anuncie, envie propostas e negocie com moradores e investidores da cidade. O saldo e o histórico ficam salvos neste navegador.';
  const info=document.createElement('small');info.style.cssText='display:block;margin:4px 0 8px;color:#bdd5e1;font-size:11px';
  info.textContent='1.000 IU$ = R$ 1 apenas como referência · sem saque · carteira até 100.000.000 IU$ · taxa total por negociação: 10% (5% comprador + 5% vendedor).';
  actions.append(info);history();return;
 }
 const l=state.lots[selected],name='#'+String(selected+1).padStart(3,'0');
 if(isPublicParkLot(selected)){
  const block=Math.floor(selected/4);
  panelTitle.textContent='🌳 '+publicParkName(block);desc.textContent='Área pública preservada · Quadra #'+String(block+1).padStart(3,'0')+' · Não está à venda.';history();return;
 }
 const value=appraise(selected),max=maximumPropertyPrice(value),fee=Math.ceil(value*MARKET_SIDE_FEE_RATE);
 panelTitle.textContent='📍 Terreno '+name;
 desc.textContent=area(selected).toLocaleString('pt-BR')+' m² · '+lotShape(selected)+' · '+rarityNames[rarityIndex(selected)]+' · '+zoneDescription(selected)+' · Avaliação: '+fmt(value)+' IU$'+
  (l.owner==='free'?' · Disponível':l.owner==='npc'?' · Morador/investidor proprietário':l.owner==='me'?' · Seu imóvel'+(l.building?' · '+buildingLabel(l.building):'')+(l.price?' · Anunciado por '+fmt(l.price)+' IU$':''):' · Propriedade pública preservada');
 if(l.owner==='free'){
  const ask=cost(selected),buyerFee=Math.ceil(ask*MARKET_SIDE_FEE_RATE),total=ask+buyerFee;
  button(actions,'Comprar · '+fmt(ask)+' IU$ + '+fmt(buyerFee)+' IU$ de taxa',()=>{
   const result=buySystemPlot(state,l,ask,value,selected);if(!result.ok){status.textContent=result.reason;return;}
   const bonus=awardCollectionBonus(state,selected,appraise);commit('Terreno comprado. Taxa de comprador: '+fmt(result.buyerFee)+' IU$.'+(bonus?' Coleção de rua: bônus de '+fmt(bonus)+' IU$!':''));
  },{disabled:state.balance<total});
  history();return;
 }
 if(l.owner==='npc'){
  if(l.price){
   const buyerFee=Math.ceil(l.price*MARKET_SIDE_FEE_RATE),total=l.price+buyerFee;
   button(actions,'Comprar anunciado · '+fmt(l.price)+' IU$ + taxa '+fmt(buyerFee),()=>{
    const result=buyListedProperty(state,l,l.price,value,selected);if(!result.ok){status.textContent=result.reason;return;}
    const bonus=awardCollectionBonus(state,selected,appraise);commit('Imóvel comprado. Taxa total: '+fmt(result.fee)+' IU$.'+(bonus?' Bônus de coleção: '+fmt(bonus)+' IU$!':''));
   },{disabled:state.balance<total});
  }
  const proposal=input(actions,l.price||value*.86,max);
  button(actions,'🤝 Enviar proposta',()=>{
   const result=submitOffer(state,l,Number(proposal.value),value,selected);if(!result.ok){status.textContent=result.reason;return;}
   if(result.accepted){const bonus=awardCollectionBonus(state,selected,appraise);commit(result.message+' Taxa total: '+fmt(result.fee)+' IU$.'+(bonus?' Bônus de coleção: '+fmt(bonus)+' IU$!':''));}
   else{save();renderState();status.textContent=result.message;}
  },{alt:true});
  for(const offer of state.marketOffers.filter(item=>item.status==='countered'&&item.lotId===selected)){
   button(actions,'Aceitar contraproposta · '+fmt(offer.counter)+' IU$',()=>{
    const result=acceptCounteroffer(state,offer.id,l,value);if(!result.ok){status.textContent=result.reason;return;}
    const bonus=awardCollectionBonus(state,selected,appraise);commit('Contraproposta aceita. Taxa: '+fmt(result.fee)+' IU$.'+(bonus?' Bônus de coleção: '+fmt(bonus)+' IU$!':''));
   });
   button(actions,'Recusar contraproposta',()=>{offer.status='rejected';commit('Contraproposta recusada.')},{alt:true});
  }
  const row=Math.floor(selected/20),owned=state.lots.slice(row*20,row*20+20).filter(lot=>lot?.owner==='me').length;
  const collection=document.createElement('small');collection.style.cssText='display:block;width:100%;color:#bdd5e1;font-size:11px';collection.textContent='Coleção da rua: '+owned+'/3 terrenos · bônus único se completar.';actions.append(collection);
  history();return;
 }
 if(l.owner==='me'){
  if(!l.building){
   button(actions,'🏠 Casas',()=>beginConstruction(selected,'casa'));
   button(actions,'🏢 Prédios',()=>beginConstruction(selected,'predio'));
   const note=document.createElement('small');note.style.cssText='display:block;width:100%;color:#c5d8e3;font-size:11px';note.textContent='Construir aumenta a avaliação e pode gerar renda líquida de até 3,9% ao ano virtual, financiada pela reserva da comunidade.';actions.append(note);
  }else{
   const info=document.createElement('small');info.style.cssText='display:block;width:100%;color:#a6f6c9;font-size:12px';info.textContent='✓ Construção: '+buildingLabel(l.building)+' · custo registrado: '+fmt(l.buildingMeta?.costPaid||buildingPrice(selected,l.building))+' IU$.';actions.append(info);
  }
  if(!l.price){
   const listing=input(actions,value*1.2,max);
   button(actions,'Anunciar · máximo '+fmt(max)+' IU$',()=>{
    const price=Number(listing.value);if(!Number.isSafeInteger(price)||price<1000||price>max){status.textContent='Preço acima do limite. Avaliação máxima do anúncio: '+fmt(max)+' IU$.';return;}
    l.price=price;commit('Imóvel anunciado por '+fmt(price)+' IU$.');
   },{alt:true});
  }else{
   const sellerFee=Math.floor(l.price*MARKET_SIDE_FEE_RATE),net=l.price-sellerFee;
   button(actions,'Vender ao investidor · líquido '+fmt(net)+' IU$',()=>{
    const result=sellToInvestor(state,l,l.price,value,selected);if(!result.ok){status.textContent=result.reason;return;}
    commit('Imóvel vendido por '+fmt(result.price)+' IU$. Taxa total: '+fmt(result.fee)+' IU$; recebido: '+fmt(result.net)+' IU$.');
   },{alt:true});
   button(actions,'Retirar anúncio',()=>{l.price=0;commit('Anúncio retirado.')});
  }
  history();return;
 }
 const note=document.createElement('small');note.style.cssText='display:block;width:100%;color:#c5d8e3;font-size:12px';note.textContent='Imóvel público preservado no mapa. Não pode ser negociado.';actions.append(note);history();
}
