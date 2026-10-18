// Natural materials and atmosphere. All assets are generated locally and shared.
export function createNaturalCity(THREE, scene, renderer) {
 const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const rand=rng(7319), dummy=new THREE.Object3D();
 function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=512;
  const g=c.getContext('2d'),im=g.createImageData(512,512),r=rng(9821);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){
   const i=(y*512+x)*4,grain=(r()-.5)*62;
   const patch=12*Math.sin(x*.037+Math.sin(y*.029))+8*Math.cos(y*.071+x*.024);
   let v=kind==='asphalt'?232+grain*.32+patch*.22:kind==='grass'?234+grain*.34+patch*.28:242+grain*.22+patch*.16;
   im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=255;
  }
  g.putImageData(im,0,0);
  if(kind==='asphalt'){
   // Aggregate and irregular repaired hairline cracks, not a flat colour.
   for(let i=0;i<3800;i++){g.fillStyle=i%3?'#ffffff18':'#00000030';g.fillRect(r()*512,r()*512,.5+r()*1.6,.5+r()*1.6)}
   for(let i=0;i<4;i++){
    let x=r()*512,y=r()*512;g.beginPath();g.moveTo(x,y);
    for(let j=0;j<7;j++){x+=(r()-.4)*15;y+=r()*19;g.lineTo(x,y)}
    g.strokeStyle='#20221f55';g.lineWidth=.65;g.stroke();
   }
  }else if(kind==='paving'){
   g.strokeStyle='#66655d50';g.lineWidth=2;
   for(let y=0;y<=512;y+=128){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();
    for(let x=(y%256?64:0);x<512;x+=128){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+128);g.stroke()}}
  }else{
   for(let i=0;i<16000;i++){const x=r()*512,y=r()*512;g.strokeStyle=i%3?'#24352228':'#e6db9b30';g.lineWidth=.5;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*2,y-1-r()*5);g.stroke()}
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return t;
 }
 const maps={asphalt:texture('asphalt'),grass:texture('grass'),paving:texture('paving')};
 function surface(material,kind,scale=.25){
  material.map=maps[kind];material.bumpMap=null;
  material.roughness=kind==='asphalt'?.93:1;
  // World-space coordinates keep the grain size constant on long streets and small plots.
  material.onBeforeCompile=s=>{
   s.vertexShader='varying vec3 cityWorld;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>',`#include <worldpos_vertex>
   vec4 cp=vec4(transformed,1.0);
   #ifdef USE_INSTANCING
   cp=instanceMatrix*cp;
   #endif
   cityWorld=(modelMatrix*cp).xyz;`);
   s.fragmentShader='varying vec3 cityWorld;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
   vec4 sampledDiffuseColor=texture2D(map, cityWorld.xz*${scale.toFixed(4)});
   diffuseColor*=sampledDiffuseColor;
   #endif`);
  };
  material.customProgramCacheKey=()=>`city-${kind}-${scale}`;material.needsUpdate=true;return material;
 }
 const trunks=[],crowns=[];
 function tree(x,z,size=1,type=0){
  const r=rng(Math.floor((x+1000)*931+(z+1000)*719+type*199));
  const h=(4.8+r()*1.5)*size;
  trunks.push({x,y:h*.31,z,sx:.24*size,sy:h*.62,sz:.24*size});
  for(let j=0;j<13;j++){
   const a=r()*Math.PI*2,rad=Math.sqrt(r())*1.35*size;
   crowns.push({x:x+Math.cos(a)*rad,y:h*.70+(r()-.15)*2.15*size,z:z+Math.sin(a)*rad,
    sx:(.78+r()*.62)*size,sy:(.72+r()*.72)*size,sz:(.78+r()*.62)*size,c:r()});
  }
 }
 function instances(geometry,material,items,colours=false){
  const m=new THREE.InstancedMesh(geometry,material,items.length);
  items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.yaw||0,0);dummy.scale.set(p.sx,p.sy,p.sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
   if(colours)m.setColorAt(i,new THREE.Color().setHSL(.23+p.c*.07,.26+p.c*.1,.20+p.c*.09));});
  m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();scene.add(m);return m;
 }
 function finishTrees(){
  instances(new THREE.CylinderGeometry(.6,1,1,7),new THREE.MeshStandardMaterial({color:0x665447,roughness:1}),trunks);
 const geo=new THREE.IcosahedronGeometry(1,1),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=1+.1*Math.sin(x*19+y*13+z*21);p.setXYZ(i,x*f,y*f,z*f)}geo.computeVertexNormals();
  instances(geo,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1}),crowns,true);
 }
 function streets(blocks){
  const curb=[],paving=[],paint=[],drains=[];
  for(const b of blocks){
   for(const side of [-1,1]){
    curb.push({x:b.x,y:.22,z:b.z+side*12.48,sx:27,sy:.20,sz:.18},{x:b.x+side*13.48,y:.22,z:b.z,sx:.18,sy:.20,sz:25});
    paving.push({x:b.x,y:.23,z:b.z+side*12.12,sx:26.7,sy:.12,sz:.55},{x:b.x+side*13.12,y:.23,z:b.z,sx:.55,sy:.12,sz:24.4});
   }
   if(b.col<4)for(const dz of [-7,0,7])paint.push({x:b.x+15.5,y:.158,z:b.z+dz,sx:.10,sy:.008,sz:2.8});
   if(b.row<9)for(const dx of [-8,0,8])paint.push({x:b.x+dx,y:.158,z:b.z+14.5,sx:2.8,sy:.008,sz:.10});
   for(let j=0;j<5;j++)drains.push({x:b.x+12.95+j*.08,y:.33,z:b.z+11.4,sx:.035,sy:.014,sz:.48});
  }
  const geo=new THREE.BoxGeometry(1,1,1);
  instances(geo,surface(new THREE.MeshStandardMaterial({color:0xa9a69d}),'paving',.6),curb);
  instances(geo,surface(new THREE.MeshStandardMaterial({color:0xbcb7ab}),'paving',.65),paving);
  instances(geo,new THREE.MeshStandardMaterial({color:0xc9c4ad,roughness:1}),paint).castShadow=false;
  instances(geo,new THREE.MeshStandardMaterial({color:0x333633,roughness:.85}),drains).castShadow=false;
 }
 const skyUniforms={uTime:{value:0},uDay:{value:1},uDusk:{value:0},uSunDir:{value:new THREE.Vector3(0,1,0)},uMoonDir:{value:new THREE.Vector3(0,1,0)}};
 const sky=new THREE.Mesh(new THREE.SphereGeometry(2100,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,uniforms:skyUniforms,
  vertexShader:'varying vec3 dir; void main(){dir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`precision highp float;
  varying vec3 dir;uniform float uTime,uDay,uDusk;uniform vec3 uSunDir,uMoonDir;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<3;i++){n+=a*noise(p);p=p*2.03+11.7;a*=.5;}return n;}
  void main(){vec3 d=normalize(dir);float h=max(d.y,0.);
   vec3 day=mix(vec3(.72,.80,.83),vec3(.18,.43,.68),pow(h,.45));
   day=mix(day,vec3(.85,.46,.26),uDusk*pow(1.-h,4.)*.72);
   vec3 night=mix(vec3(.065,.09,.135),vec3(.009,.018,.045),pow(h,.4));
   vec3 col=mix(night,day,uDay);
   vec2 starUV=vec2(atan(d.z,d.x)*125.,asin(d.y)*180.);
   float star=0.;if(uDay<.7)star=step(.9945,hash(floor(starUV)))*pow(max(0.,1.-length(fract(starUV)-.5)*2.),7.);
   col+=vec3(.65,.73,.9)*star*(1.-uDay)*smoothstep(0.,.2,h);
   vec2 uv=d.xz/(max(.12,h)+.18)*2.8+vec2(uTime*.003,0.);
   float n=fbm(uv);float cloud=smoothstep(.43,.79,n)*smoothstep(.015,.19,h);
   float shade=fbm(uv+vec2(.15,.25));
   vec3 lit=mix(vec3(.51,.59,.65),vec3(.97,.96,.90),smoothstep(.40,.72,shade));
   lit=mix(lit,vec3(.95,.64,.40),uDusk*.42);
   lit=mix(vec3(.10,.13,.19),lit,uDay);
   col=mix(col,lit,cloud*.54);
   float sunDot=dot(d,normalize(uSunDir));
   float sunDisk=smoothstep(cos(.012),cos(.008),sunDot)*uDay;
   col+=vec3(1.,.73,.42)*pow(max(sunDot,0.),80.)*uDay*.42;
   col=mix(col,vec3(1.,.96,.83),sunDisk);
   float moonDot=dot(d,normalize(uMoonDir));
   float moonDisk=smoothstep(cos(.009),cos(.006),moonDot)*(1.-uDay);
   col+=vec3(.62,.76,1.)*pow(max(moonDot,0.),110.)*(1.-uDay)*.25;
   col=mix(col,vec3(.88,.91,1.),moonDisk);gl_FragColor=vec4(col,1.);
  }`
 }));sky.renderOrder=-100;sky.frustumCulled=false;scene.add(sky);
 function atmosphere(camera,seconds,day,hour,sunPosition,moonPosition){sky.position.copy(camera.position);skyUniforms.uTime.value=seconds;skyUniforms.uDay.value=day;skyUniforms.uDusk.value=Math.max(0,1-Math.abs(hour-18)/2.1,1-Math.abs(hour-6)/2.1);if(sunPosition)skyUniforms.uSunDir.value.copy(sunPosition).sub(camera.position).normalize();if(moonPosition)skyUniforms.uMoonDir.value.copy(moonPosition).sub(camera.position).normalize();}
 return {surface,tree,finishTrees,streets,atmosphere};
}
