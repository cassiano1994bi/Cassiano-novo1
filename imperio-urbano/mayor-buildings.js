/* Império Urbano: modelos comerciais e industriais próprios, compactos para Android.
 * A frente aponta para +Z; o mapa aplica a orientação do lote.
 * Sem texturas externas nem imagens estáticas.
 */
const commercialLights=new Set();let commercialNight=0,lastCommercialNight=-1;
export function setCommercialNight(level){
 commercialNight=Math.max(0,Math.min(1,level));
 if(Math.abs(commercialNight-lastCommercialNight)<.012)return;
 lastCommercialNight=commercialNight;
 for(const m of commercialLights)m.emissiveIntensity=(m.userData.lightType==='sign'?.9:.48)*commercialNight;
}
export function makeMunicipalBuilding(THREE,kind,x,z,north=false,brandKey=null){
 const g=new THREE.Group();g.position.set(x,.28,z);g.rotation.y=north?Math.PI:0;
 g.userData.kind='municipal:'+kind;
 const mats={concrete:0xe4dfd4,white:0xf3f0e8,wall:0xc0d0d0,brick:0xa97760,
  dark:0x273e50,glass:0x70b7c8,roof:0x495761,blue:0x347e9f,
  green:0x5f9680,red:0xb54f45,gold:0xdab969,asphalt:0x69777c,
  wood:0x9d7358,steel:0x83919a,leaf:0x4b8e59,awning:0xe9bc76,
  light:0xffd28e,gray:0xb2afa8};
 const materials={};
 for(const [n,c] of Object.entries(mats))materials[n]=new THREE.MeshStandardMaterial({
  color:c,roughness:n==='glass'?.24:.85,metalness:n==='steel'?.38:0,
  emissive:n==='light'?0xb66a1b:0x000000,emissiveIntensity:n==='light'?0.65:0
 });
 const storefront=['mercado','padaria','farmacia','restaurante','lojas','hotel','industria','logistica'].includes(kind)||!!brandKey;
 if(storefront){materials.storeGlass=new THREE.MeshStandardMaterial({color:0x9acbd0,roughness:.22,metalness:.04,emissive:0xffc96e,emissiveIntensity:.48*commercialNight});materials.storeGlass.userData.lightType='window';commercialLights.add(materials.storeGlass)}
 function box(mat,w,h,d,x,y,z){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),materials[mat]);o.position.set(x,y,z);o.receiveShadow=true;g.add(o);return o}
 function facade(width,depth,height,color='concrete'){
  box('gray',11,.14,11,0,.07,0);
  box(color,width,height,depth,0,height/2+.18,0);
  box('roof',width+.45,.28,depth+.45,0,height+.31,0);
 }
 function entry(){box('dark',2.1,2.6,.16,0,1.45,4.12);box(storefront?'storeGlass':'glass',1.85,2.25,.19,0,1.45,4.25);
  box('gray',2.8,.15,1.1,0,.12,4.66);}
 function glazing(y,cols=3,front=3.93){for(let i=0;i<cols;i++){
  const xx=(i-(cols-1)/2)*2.2;
  box('dark',1.54,1.5,.13,xx,y,front);box(storefront?'storeGlass':'glass',1.36,1.32,.15,xx,y,front+.08);
 }}
 const brands={
  mercado:{name:'MERCADO VIVA',tag:'perto de você',bg:'#176b4d',mark:'#f5c84c',glyph:'V'},
  padaria:{name:'PÃO DA VILA',tag:'feito hoje',bg:'#8b4a32',mark:'#f3c66a',glyph:'P'},
  farmacia:{name:'FARMA +',tag:'saúde e cuidado',bg:'#13836f',mark:'#fff2db',glyph:'+'},
  restaurante:{name:'VILA BISTRÔ',tag:'cozinha brasileira',bg:'#713f31',mark:'#e8b568',glyph:'B'},
  lojas:{name:'CENTRO URBANO',tag:'galeria comercial',bg:'#345d78',mark:'#f0c35d',glyph:'U'},
  hotel:{name:'HOTEL HORIZONTE',tag:'hospedagem',bg:'#38546c',mark:'#e8c878',glyph:'H'},
  industria:{name:'NOVA INDÚSTRIA',tag:'produção local',bg:'#3d5861',mark:'#e6b75b',glyph:'N'},
  logistica:{name:'PONTO LOG',tag:'entregas e logística',bg:'#30576f',mark:'#f0bd57',glyph:'L'},
  cocacola:{name:'Coca-Cola',tag:'investe em Nova Jundiaí',bg:'#c91f36',mark:'#fffaf0',glyph:'C'},
  mercadolivre:{name:'MERCADO LIVRE',tag:'um mundo de possibilidades',bg:'#f4d328',mark:'#2865a8',glyph:'ML'}
 };
 const brandTextures=new Map();
 function brandMaterial(kind){
  if(brandTextures.has(kind))return brandTextures.get(kind);
  const brand=brands[kind];if(!brand)return materials.white;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=144;
  const c=canvas.getContext('2d');
  c.fillStyle=brand.bg;c.fillRect(0,0,768,144);
  c.fillStyle=brand.mark;c.beginPath();c.arc(75,72,48,0,Math.PI*2);c.fill();
  c.fillStyle=brand.bg;c.font='bold 64px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(brand.glyph,75,72);
  c.textAlign='left';c.fillStyle=kind==='mercadolivre'?'#224f83':'#fffdf5';
  c.font=kind==='cocacola'?'italic 800 54px Georgia':'800 43px system-ui';c.fillText(brand.name,143,65);
  c.fillStyle='#e2eee9';c.font='24px system-ui';c.fillText(brand.tag,146,108);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=2;
  const material=new THREE.MeshStandardMaterial({map:texture,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.9*commercialNight,roughness:.72,metalness:.02,side:THREE.DoubleSide});material.userData.lightType='sign';commercialLights.add(material);
  brandTextures.set(kind,material);return material;
 }
 function signage(mat,kind){
  box(mat,6.9,.77,.23,0,3.78,4.17);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(6.55,.60),brandMaterial(kind));
  face.position.set(0,3.78,4.30);face.receiveShadow=false;g.add(face);
 }
 function canopy(mat='awning'){box(mat,8.3,.27,1.55,0,3.14,4.45);
  for(const xx of [-3.6,3.6])box('steel',.13,2.6,.13,xx,1.55,4.98)}
 function windows(floors,width=7.8){for(let fl=1;fl<=floors;fl++){
   glazing(fl*2.5+.55,3,width/2+.12);
   for(const side of [-1,1])box('glass',.11,1.4,2.1,side*(width/2+.12),fl*2.5+.55,0);
 }}
 function equipment(){for(const xx of [-2.6,-.7,1.2]){box('gray',1.1,.7,1.2,xx,5.25,-1.7);
   box('dark',.8,.15,.9,xx,5.68,-1.7)}}
 switch(kind){
 case 'escola':
  facade(10,8.5,5.6,'white');glazing(2.1,3,4.36);entry();canopy('blue');
  box('blue',10.3,.6,.25,0,4.5,4.4);
  box('gold',.16,7,.16,-4.7,3.5,4.9);box('green',1.4,.85,.08,-4,6.4,4.9);
  for(const xx of [-3,0,3])box('glass',1.4,1.1,.15,xx,4,4.38);
  break;
 case 'hospital':
  facade(9.5,8.7,8,'white');windows(2,9.5);entry();canopy('red');
  box('red',.5,2,.25,0,6.8,4.52);box('red',1.8,.5,.27,0,6.8,4.55);
  box('white',2.3,.8,1.15,3,.65,4.9);box('red',.3,.18,.7,3,1.15,4.9);
  break;
 case 'seguranca':
  facade(8.5,8,5.4,'white');glazing(2,3,4.1);entry();canopy('blue');
  box('blue',8.8,.65,.23,0,4.5,4.17);box('steel',.14,3,.14,3,7,-2);
  box('blue',2,.6,1,3,.65,4.8);box('red',.5,.16,.5,3,1.05,4.8);
  break;
 case 'mercado':
  facade(9.1,7.7,4.35,'white');glazing(1.6,3,3.96);entry();signage('green','mercado');canopy();
  for(const xx of [-4.3,4.3])box('leaf',.65,.86,.65,xx,.54,4.15);
  break;
 case 'padaria':
  facade(8.0,7.2,4,'brick');glazing(1.7,3,3.73);entry();canopy('red');signage('gold','padaria');
  box('steel',.64,1.2,.64,2.8,4.85,-1.8);break;
 case 'farmacia':
  facade(8.5,7.5,4.2,'white');glazing(1.7,3,3.88);entry();signage('green','farmacia');canopy('white');
  box('white',.52,1.6,.22,3.5,4.45,3.98);box('white',1.5,.52,.23,3.5,4.45,4.11);break;
 case 'restaurante':
  facade(8.4,7.9,4.1,'brick');glazing(1.7,3,4.01);entry();signage('wood','restaurante');canopy('wood');
  for(const xx of [-3.3,3.3]){box('wood',1.0,.12,.95,xx,.62,4.75);
   for(const zz of [4.2,5.3])box('steel',.12,.75,.12,xx,.32,zz)}
  break;
 case 'lojas':
  facade(9.0,7.5,7.5,'white');windows(2,9);entry();signage('blue','lojas');canopy('blue');
  box('glass',8.5,1.1,.14,0,5.0,3.9);break;
 case 'hotel':
  facade(9.1,8.5,15.6,'white');
  for(let floor=1;floor<=5;floor++){glazing(floor*2.65,3,4.39);
   box('gray',8.4,.14,1.0,0,floor*2.65-1.0,4.62);
   box('glass',8.2,.83,.12,0,floor*2.65-.59,5.05)}
  entry();canopy('gold');signage('dark','hotel');box('gold',2.6,.34,.25,0,14.6,4.45);break;
 case 'industria':
  facade(9.6,9.3,5.3,'steel');signage('dark',brandKey==='cocacola'?'cocacola':'industria');for(const xx of [-2.5,0,2.5]){
   box('dark',1.9,2.9,.2,xx,1.9,4.77);
   box('glass',1.4,.6,.21,xx,2.65,4.9)}
  for(const xx of [-3.5,3.4])box('steel',.82,5.8,.82,xx,8.2,-3.1);
  box('roof',9.8,.4,2.5,0,5.8,1.5);break;
 case 'logistica':
  facade(9.6,9.5,4.1,'gray');
  for(const xx of [-3,0,3]){box('dark',2.6,2.6,.18,xx,1.47,4.84);
   box('steel',2.25,.12,.2,xx,2.85,4.92)}
  signage('blue',brandKey==='mercadolivre'?'mercadolivre':'logistica');box('blue',9.1,.55,.3,0,3.53,4.9);break;
 default:return null;
 }
 return g;
}
