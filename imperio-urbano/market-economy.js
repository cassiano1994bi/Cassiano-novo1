export const IU_PER_BRL = 1000;
export const WALLET_CAP = 100_000_000;
export const PROPERTY_PRICE_MULTIPLE_CAP = 10;
export const MARKET_TAX_RATE = 0.10;
export const MARKET_SIDE_FEE_RATE = 0.05;
export const INITIAL_MARKET_RESERVE = 2_500_000;
export const MAX_UNCLAIMED_RENT_DAYS = 365;
export const BASE_PROPERTY_YIELD = 0.049;
export const PROPERTY_UPKEEP_RATE = 0.01;
export const MAX_HISTORY = 100;

export function propertyValuation(landValue, buildingValue = 0) {
  const land = Number.isFinite(Number(landValue)) ? Math.max(0, Number(landValue)) : 0;
  const building = Number.isFinite(Number(buildingValue)) ? Math.max(0, Number(buildingValue)) : 0;
  return Math.max(1000, Math.round((land + building * 0.75) / 100) * 100);
}
export function maximumPropertyPrice(appraisal) {
  return Math.min(WALLET_CAP, Math.max(1000, Math.floor(Number(appraisal) * PROPERTY_PRICE_MULTIPLE_CAP / 100) * 100));
}
export function initializeMarketState(state) {
  if (!state || typeof state !== 'object') throw new TypeError('Estado imobiliário inválido.');
  if (!Number.isFinite(state.marketReserve) || state.marketReserve < 0) state.marketReserve = INITIAL_MARKET_RESERVE;
  if (!Number.isFinite(state.marketCommunityPool) || state.marketCommunityPool < 0) state.marketCommunityPool = 0;
  if (!Array.isArray(state.marketHistory)) state.marketHistory = [];
  if (!Array.isArray(state.marketOffers)) state.marketOffers = [];
  if (!Number.isFinite(state.marketLastRentDay) || state.marketLastRentDay < 0) state.marketLastRentDay = 0;
  if (!state.marketCollections || typeof state.marketCollections !== 'object') state.marketCollections = {};
  return state;
}
function addHistory(state, entry) {
  state.marketHistory.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), at: Date.now(), ...entry });
  state.marketHistory.length = Math.min(state.marketHistory.length, MAX_HISTORY);
}
export function listingIsValid(price, appraisal) {
  return Number.isSafeInteger(price) && price >= 1000 && price <= maximumPropertyPrice(appraisal);
}
function completeNpcPurchase(state, lot, price, appraisal, lotId, description) {
  const buyerFee=Math.ceil(price*MARKET_SIDE_FEE_RATE),sellerFee=Math.floor(price*MARKET_SIDE_FEE_RATE),fee=buyerFee+sellerFee,total=price+buyerFee;
  if(state.balance<total)return {ok:false,reason:'Saldo insuficiente incluindo a taxa de mercado.'};
  state.balance-=total;state.marketReserve=Math.min(WALLET_CAP*10,state.marketReserve+price-sellerFee);state.marketCommunityPool=Math.min(WALLET_CAP*10,state.marketCommunityPool+fee);
  lot.owner='me';lot.price=0;
  addHistory(state,{type:'purchase',lotId,amount:price,fee,net:price-sellerFee,description});
  return {ok:true,price,fee,buyerFee,sellerFee,total};
}
export function buyListedProperty(state, lot, price, appraisal, lotId) {
  initializeMarketState(state);
  if(!lot||lot.owner!=='npc'||!lot.price||lot.price!==price)return {ok:false,reason:'Este imóvel não está anunciado pelo proprietário.'};
  if(!listingIsValid(price,appraisal))return {ok:false,reason:'Preço fora do limite permitido para esta avaliação.'};
  return completeNpcPurchase(state,lot,price,appraisal,lotId,'Compra de imóvel anunciado');
}
export function buySystemPlot(state, lot, price, appraisal, lotId) {
  initializeMarketState(state);
  if (!lot || lot.owner !== 'free') return {ok:false,reason:'Este terreno não está disponível.'};
  if (!listingIsValid(price, appraisal)) return {ok:false,reason:'Preço fora do limite permitido para esta avaliação.'};
  const buyerFee=Math.ceil(price*MARKET_SIDE_FEE_RATE),sellerFee=Math.floor(price*MARKET_SIDE_FEE_RATE),fee=buyerFee+sellerFee,total=price+buyerFee;
  if(state.balance<total)return {ok:false,reason:'Saldo insuficiente incluindo a taxa de mercado.'};
  state.balance-=total;state.marketReserve=Math.min(WALLET_CAP*10,state.marketReserve+price-sellerFee);state.marketCommunityPool=Math.min(WALLET_CAP*10,state.marketCommunityPool+fee);
  lot.owner='me';lot.price=0;
  addHistory(state,{type:'purchase',lotId,amount:price,fee,net:price-sellerFee,description:'Compra de terreno novo'});
  return {ok:true,price,fee,buyerFee,sellerFee,total};
}
export function submitOffer(state, lot, offer, appraisal, lotId) {
  initializeMarketState(state);
  if (!lot || lot.owner !== 'npc') return {ok:false,reason:'Este imóvel não está disponível para negociação.'};
  if (!listingIsValid(offer, appraisal)) return {ok:false,reason:'A proposta precisa estar entre IU$ 1.000 e o limite de preço do imóvel.'};
  const fee=Math.ceil(offer*MARKET_SIDE_FEE_RATE),total=offer+fee;
  if(state.balance<total)return {ok:false,reason:'Saldo insuficiente incluindo a taxa de mercado.'};
  const listed=Number.isSafeInteger(lot.price)&&lot.price>0?lot.price:appraisal;
  const acceptAt=Math.min(maximumPropertyPrice(appraisal),Math.max(Math.round(appraisal*.92/100)*100,Math.round(listed*.94/100)*100));
  addHistory(state,{type:'offer',lotId,amount:offer,fee:0,net:0,description:'Proposta enviada ao proprietário'});
  if(offer>=acceptAt){
    const result=completeNpcPurchase(state,lot,offer,appraisal,lotId,'Proposta aceita pelo proprietário');
    return result.ok?{...result,accepted:true,message:'O proprietário aceitou sua proposta.'}:{...result,accepted:false,message:result.reason};
  }
  const counter=Math.min(maximumPropertyPrice(appraisal),Math.max(offer+1000,Math.round(Math.max(offer*1.12,acceptAt)*100/100)));
  const id='offer-'+Date.now()+'-'+lotId;
  state.marketOffers.unshift({id,lotId,owner:'npc',buyer:'Você',amount:offer,counter,appraisal,status:'countered',createdAt:Date.now()});
  state.marketOffers.length=Math.min(state.marketOffers.length,50);
  return {ok:true,accepted:false,counter,message:'O proprietário respondeu com uma contraproposta de IU$ '+counter.toLocaleString('pt-BR')+'.'};
}
export function acceptCounteroffer(state, offerId, lot, appraisal) {
  initializeMarketState(state);
  const offer=state.marketOffers.find(item=>item.id===offerId&&item.status==='countered');
  if(!offer)return {ok:false,reason:'Esta contraproposta não está mais ativa.'};
  if(!lot||lot.owner!=='npc'||offer.lotId<0)return {ok:false,reason:'O proprietário ou imóvel mudou.'};
  const price=offer.counter,buyerFee=Math.ceil(price*MARKET_SIDE_FEE_RATE),sellerFee=Math.floor(price*MARKET_SIDE_FEE_RATE),fee=buyerFee+sellerFee,total=price+buyerFee;
  if(!listingIsValid(price,appraisal))return {ok:false,reason:'A contraproposta ultrapassa o limite de avaliação.'};
  if(state.balance<total)return {ok:false,reason:'Saldo insuficiente para aceitar a contraproposta.'};
  state.balance-=total;state.marketReserve=Math.min(WALLET_CAP*10,state.marketReserve+price-sellerFee);state.marketCommunityPool=Math.min(WALLET_CAP*10,state.marketCommunityPool+fee);
  lot.owner='me';lot.price=0;offer.status='accepted';
  addHistory(state,{type:'purchase',lotId:offer.lotId,amount:price,fee,net:price-sellerFee,description:'Contraproposta aceita'});
  return {ok:true,price,fee,buyerFee,sellerFee,total};
}
export function sellToInvestor(state, lot, price, appraisal, lotId) {
  initializeMarketState(state);
  if(!lot||lot.owner!=='me')return {ok:false,reason:'Você não é o proprietário deste imóvel.'};
  if(!listingIsValid(price,appraisal))return {ok:false,reason:'Preço fora do limite permitido para esta avaliação.'};
  const buyerFee=Math.ceil(price*MARKET_SIDE_FEE_RATE),sellerFee=Math.floor(price*MARKET_SIDE_FEE_RATE),fee=buyerFee+sellerFee,net=price-sellerFee,total=price+buyerFee;
  if(state.marketReserve<total)return {ok:false,reason:'A reserva de investidores não tem saldo para esta compra agora.'};
  if(state.balance+net>WALLET_CAP)return {ok:false,reason:'A venda ultrapassaria o limite de IU$ da carteira.'};
  state.balance+=net;state.marketReserve-=total;state.marketCommunityPool=Math.min(WALLET_CAP,state.marketCommunityPool+fee);lot.owner='npc';lot.price=0;
  addHistory(state,{type:'sale',lotId,amount:price,fee,net,description:'Venda para investidor'});
  return {ok:true,price,fee,buyerFee,sellerFee,net};
}
export function settlePropertyIncome(state, day, appraise) {
  initializeMarketState(state);
  if(!Number.isSafeInteger(day)||day<=state.marketLastRentDay)return {days:0,gross:0,upkeep:0,net:0};
  const days=Math.min(MAX_UNCLAIMED_RENT_DAYS,day-state.marketLastRentDay);
  let gross=0,upkeep=0;
  for(const [lotId,lot] of state.lots.entries()){
    if(lot?.owner!=='me'||!lot.building)continue;
    const value=appraise(Number(lotId),lot);
    gross+=Math.floor(value*BASE_PROPERTY_YIELD/365*days);
    upkeep+=Math.floor(value*PROPERTY_UPKEEP_RATE/365*days);
  }
  let net=Math.max(0,gross-upkeep);
  if(state.balance+net>WALLET_CAP)net=0;
  const available=Math.max(0,state.marketCommunityPool-upkeep);
  const payout=Math.min(net,available);state.marketCommunityPool-=payout;state.balance+=payout;
  state.marketLastRentDay=day;
  if(gross>upkeep&&payout)addHistory(state,{type:'income',lotId:null,amount:gross,fee:upkeep,net:payout,description:'Renda de imóveis construídos ('+days+' dias virtuais)'});
  return {days,gross,upkeep,net:payout};
}
export function awardCollectionBonus(state,lotId,appraise) {
  initializeMarketState(state);
  const row=Math.floor(lotId/20), start=row*20;
  const owned=state.lots.slice(start,start+20).filter(lot=>lot?.owner==='me');
  if(owned.length<3||state.marketCollections[row])return 0;
  const bonus=Math.min(50000,Math.max(1000,Math.round(appraise(lotId)*.02/100)*100));
  if(state.balance+bonus>WALLET_CAP||state.marketCommunityPool<bonus)return 0;
  state.marketCommunityPool-=bonus;state.balance+=bonus;state.marketCollections[row]=true;
  addHistory(state,{type:'collection',lotId,amount:bonus,fee:0,net:bonus,description:'Bônus por completar uma coleção de rua'});
  return bonus;
}
