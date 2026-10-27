import * as THREE from './vendor/three.module.js';

export async function createWorld({container,onReady,onFailure,onPick,motionAllowed}){
  const mobile=matchMedia('(max-width:700px)').matches;
  const [kit,fernMap]=await Promise.all([
    fetch('./assets/botanical-kit.json').then(r=>{if(!r.ok)throw Error('Botanical assets unavailable');return r.json()}),
    new THREE.TextureLoader().loadAsync('./assets/fern-rgba.webp')
  ]);
  fernMap.colorSpace=THREE.SRGBColorSpace;fernMap.anisotropy=4;
  const geometry=data=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.position,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normal,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(data.uv,2));g.setIndex(data.index);g.computeBoundingSphere();return g};
  const timberGeometry=geometry(kit.timber);
  const renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1:1.5));
  renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.shadowMap.enabled=!mobile;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  container.append(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101d18');scene.fog=new THREE.Fog('#101d18',mobile?60:19,mobile?95:48);
  const camera=new THREE.PerspectiveCamera(39,innerWidth/innerHeight,.1,80);
  const target=new THREE.Vector3(-1.5,.6,0);
  const hemi=new THREE.HemisphereLight('#d8e0c3','#2c3024',2.7);scene.add(hemi);
  const light=new THREE.DirectionalLight('#e7e5cb',4.2);light.position.set(-7,13,7);light.castShadow=true;light.shadow.mapSize.set(1024,1024);Object.assign(light.shadow.camera,{left:-12,right:12,top:12,bottom:-12,near:.5,far:35});light.shadow.bias=-.0005;scene.add(light);
  const rim=new THREE.DirectionalLight('#91b5ac',1.9);rim.position.set(8,5,-7);scene.add(rim);
  let disposed=false,frame=0,tween=null,current='overview',allowMotion=motionAllowed;
  let seed=247;const rand=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
  const texture=(paint,w=512,h=512)=>{const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t};
  const wood=texture((c,w,h)=>{c.fillStyle='#4b3c2c';c.fillRect(0,0,w,h);for(let i=0;i<1400;i++){const y=rand()*h;c.strokeStyle=rand()>.5?'#70573a55':'#211f1770';c.lineWidth=.3+rand()*2;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(w*.3,y+rand()*14,w*.7,y-rand()*12,w,y+rand()*8);c.stroke()}});
  const paper=texture((c,w,h)=>{c.fillStyle='#d7d4ba';c.fillRect(0,0,w,h);for(let i=0;i<16000;i++){c.fillStyle=rand()>.5?'#5e5a3320':'#fff8e929';c.fillRect(rand()*w,rand()*h,1,1)}});
  const woodMat=new THREE.MeshStandardMaterial({map:wood,roughness:.91,color:'#b1a488'});
  const edgeMat=new THREE.MeshStandardMaterial({color:'#40372b',roughness:1});
  const paperMat=new THREE.MeshStandardMaterial({map:paper,roughness:1,side:THREE.DoubleSide});
  const metalMat=new THREE.MeshStandardMaterial({color:'#a6996b',metalness:.7,roughness:.6});
  const redMat=new THREE.MeshStandardMaterial({color:'#a14e3b',roughness:.9});
  const box=(w,h,d,mat,x,y,z,parent=scene)=>{const m=new THREE.Mesh(timberGeometry,mat);m.scale.set(w,h,d);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m};
  const line=(points,mat,r=.015,parent=scene)=>{const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,20,r,5,false),mat);parent.add(m);return m};
  const pin=(x,y,z,parent)=>{const p=new THREE.Mesh(new THREE.SphereGeometry(.044,8,6),redMat);p.position.set(x,y,z);parent.add(p)};
  const groundMat=new THREE.MeshStandardMaterial({color:'#27352a',roughness:1});
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(10.7,10.1,.65,64),groundMat);ground.scale.z=.65;ground.position.set(0,-.38,0);ground.receiveShadow=true;scene.add(ground);
  // A deliberately irregular deck and connected footpath, cut from the same timber.
  for(let i=0;i<24;i++){const x=(i-11.5)*.48;const width=8.7-Math.abs(x)*.62+rand()*.7;box(.455,.14,width,woodMat,x,.04,rand()*.2-.1)}
  for(let i=0;i<8;i++){const z=4.4+i*.43;box(1.45,.1,.39,woodMat,1.2+Math.sin(i*.3)*.25,-.025,z)}
  const stoneGeometries=kit.stones.map(geometry);
  const stoneMat=new THREE.MeshStandardMaterial({color:'#4b5140',roughness:.98});
  const stones=[[-8.2,2.5,.65],[-7.6,3.4,.45],[-7.9,4,.3],[-5.3,5.1,.5],[-4.4,5.8,.3],[5.9,4.8,.7],[7.2,3.9,.45],[8,2.2,.9],[8.8,1.5,.4],[-7,-3.7,.65],[6,-4.6,.5]];
  stones.forEach(([x,z,size],i)=>{const rock=new THREE.Mesh(stoneGeometries[i%3],stoneMat);rock.position.set(x,-.04,z);rock.rotation.y=i*1.8;rock.scale.setScalar(size);rock.castShadow=!mobile;rock.receiveShadow=true;scene.add(rock)});
  const boardData={projects:{x:-4.0,z:-.5,y:2.25,w:2.9,h:2.15,rotation:.16},about:{x:0,z:-3.0,y:2.5,w:3.1,h:2.1,rotation:-.06},quicklinks:{x:4.0,z:.25,y:1.9,w:2.35,h:1.75,rotation:-.18}};
  const hits=[];const labelPositions={};
  function printed(title,sub){return texture((c,w,h)=>{c.fillStyle='#dedbc6';c.fillRect(0,0,w,h);c.fillStyle='#1d2a21';c.font='900 83px Helvetica,Arial';c.fillText(title,35,135);c.font='23px Helvetica,Arial';c.fillText(sub,38,185);for(let i=0;i<5000;i++){c.fillStyle='#46472b14';c.fillRect(rand()*w,rand()*h,1,1)}},512,256)}
  function plane(w,h,map,x,y,z,parent){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map,roughness:.95,side:THREE.DoubleSide}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  const boards={};
  for(const [id,d]of Object.entries(boardData)){
    const g=new THREE.Group();g.position.set(d.x,d.y,d.z);g.rotation.y=d.rotation;scene.add(g);boards[id]=g;
    box(d.w+.18,d.h+.18,.15,edgeMat,0,0,0,g);box(d.w,d.h,.12,woodMat,0,0,.1,g);
    for(const x of[-d.w*.38,d.w*.38])box(.11,d.y+1,.12,woodMat,x,-d.y*.5-.25,-.08,g);
    const h=box(d.w,d.h,.12,new THREE.MeshBasicMaterial({visible:false}),0,0,.3,g);h.userData.stop=id;hits.push(h);
    labelPositions[id]=new THREE.Vector3(d.x,d.y+d.h*.5+.36,d.z);
    for(const x of[-d.w*.44,d.w*.44])for(const y of[-d.h*.43,d.h*.43]){const nail=new THREE.Mesh(new THREE.SphereGeometry(.026,6,4),metalMat);nail.position.set(x,y,.19);g.add(nail)}
  }
  const projects=boards.projects;
  box(2.4,1.5,.08,edgeMat,-.05,.1,.23,projects);plane(2.23,1.34,printed('Shifty','Schedule Assistant'),-.05,.1,.28,projects);
  plane(2.5,.36,printed('Projects','Shifty'),0,-.83,.22,projects);
  const loader=new THREE.TextureLoader();
  loader.load('./assets/shifty-schedule.jpg',t=>{if(disposed){t.dispose();return}t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;const img=plane(2.23,1.34,t,-.05,.1,.29,projects);img.userData.stop='projects';hits.push(img);render()},undefined,()=>{});
  const about=boards.about;
  const papers=[[-.75,.15,1.02,1.33,-.13],[.55,.28,1.1,.88,.12],[.75,-.55,.8,.5,-.09]];
  papers.forEach(([x,y,w,h,r],i)=>{const p=plane(w,h,i===1?printed('sol.','Notes in progress'):paper,x,y,.22+i*.008,about);p.rotation.z=r;pin(x,y+h*.43,.28+i*.008,about)});
  line([[-.75,.7,.29],[-.3,.35,.3],[.55,.64,.3],[.7,-.31,.31]],redMat,.009,about);
  const note=new THREE.Mesh(new THREE.PlaneGeometry(.8,.62),new THREE.MeshStandardMaterial({color:'#cad382',roughness:1,side:THREE.DoubleSide}));note.position.set(-.5,-.37,.25);note.rotation.z=.13;about.add(note);pin(-.5,-.13,.3,about);
  const links=boards.quicklinks;plane(2.03,1.35,printed('Elsewhere','Discord / Instagram / TikTok / Spotify'),0,0,.22,links);pin(0,.57,.26,links);
  // Red thread makes the three landmarks part of one archive.
  line([[-4,3.55,-.4],[-2,3.1,-1.7],[0,3.65,-2.8],[2,2.9,-1],[4,2.9,.4]],redMat,.018);
  // A framed record at the foot of the note board, echoed in the readable About page.
  const record=new THREE.Group();record.position.set(1.25,.48,-1.85);record.rotation.x=-.12;record.rotation.y=-.12;scene.add(record);box(1.3,.85,.13,edgeMat,0,0,0,record);box(1.13,.69,.03,new THREE.MeshStandardMaterial({color:'#15261d'}),0,0,.09,record);
  const disc=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,.025,32),new THREE.MeshStandardMaterial({color:'#080e0b',roughness:.65}));disc.rotation.x=Math.PI/2;disc.position.set(-.25,0,.13);record.add(disc);plane(.45,.45,printed('Music','Now / recent'),.3,0,.12,record);
  // Four botanically distinct CC0 fern clumps, prepared and indexed in Blender MCP.
  const fernGeometries=kit.ferns.map(geometry);
  const fernMat=new THREE.MeshStandardMaterial({map:fernMap,alphaTest:.43,side:THREE.DoubleSide,roughness:.9,color:'#a1af89'});
  const planting=[[-7.5,-3,4.2,.5],[-8,-.8,3.7,1.7],[-7.8,2.1,3.8,2.8],[-6.4,4.5,3.5,.2],[-3.5,5.4,2.8,1.2],[4.9,4.9,3.6,2.3],[7.2,3.6,4.6,.8],[8.3,1.3,4.2,2.1],[7.7,-2,3.8,1.3],[5.8,-4,4.2,3.5],[-3.5,-4.9,3.3,.9],[1.6,-5.1,3.7,2.9],[-8.7,1.6,2.6,4.2],[8.6,3,2.4,3.6],[-5.8,4.9,2.2,2.1],[6.2,5,2.6,.6]];
  const foliageDummy=new THREE.Object3D();
  for(let variant=0;variant<4;variant++){
    const positions=planting.slice(0,mobile?12:planting.length).filter((_,i)=>i%4===variant);
    const clumps=new THREE.InstancedMesh(fernGeometries[variant],fernMat,positions.length);
    clumps.castShadow=!mobile;clumps.receiveShadow=true;
    positions.forEach(([x,z,size,angle],i)=>{foliageDummy.position.set(x,-.06,z);foliageDummy.rotation.set(0,angle,0);foliageDummy.scale.setScalar(size);foliageDummy.updateMatrix();clumps.setMatrixAt(i,foliageDummy.matrix)});
    clumps.computeBoundingSphere();scene.add(clumps);
  }
  // Trunks, roots and the site's existing photographic foliage provide depth beyond the deck.
  for(let i=0;i<(mobile?6:11);i++){
    const x=(i%2?-1:1)*(7+rand()*4),z=-3-rand()*8;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.11,.27,8+rand()*5,7),woodMat);trunk.position.set(x,3.6,z);trunk.rotation.z=(rand()-.5)*.1;trunk.castShadow=true;scene.add(trunk);
  }
  loader.load('/background.jpg',t=>{if(disposed){t.dispose();return}t.colorSpace=THREE.SRGBColorSpace;const wall=plane(40,24,t,0,5,-15,scene);wall.material.color.set('#75907a');render()},undefined,()=>{});
  function view(stop){
    const small=innerWidth<=700;
    if(stop==='overview')return{p:small?[17,20,39]:[12,10,18],t:small?[0,3.2,0]:[-1.8,1,0]};
    const d=boardData[stop];return{p:small?[d.x+3,5.2,d.z+11]:[d.x+6,5.3,d.z+10],t:small?[d.x,d.y-.4,d.z]:[d.x+1.7,d.y-.15,d.z]};
  }
  function positionLabels(){for(const[id,p]of Object.entries(labelPositions)){const q=p.clone().project(camera);const el=document.querySelector('#spot-'+id);el.style.left=(q.x*.5+.5)*innerWidth+'px';el.style.top=(-q.y*.5+.5)*innerHeight+'px';el.hidden=q.z>1||q.z<0||Math.abs(q.x)>.95||Math.abs(q.y)>.87}}
  function render(){if(disposed||document.hidden)return;renderer.render(scene,camera);positionLabels()}
  function go(stop){current=stop;cancelAnimationFrame(frame);const v=view(stop),endP=new THREE.Vector3(...v.p),endT=new THREE.Vector3(...v.t);if(!allowMotion){camera.position.copy(endP);target.copy(endT);camera.lookAt(target);tween=null;render();return}const fromP=camera.position.clone(),fromT=target.clone(),start=performance.now();let samples=[];tween={endP,endT};const tick=now=>{if(disposed||document.hidden)return;const t=Math.min(1,(now-start)/700);const eased=t*t*(3-2*t);camera.position.lerpVectors(fromP,endP,eased);target.lerpVectors(fromT,endT,eased);camera.lookAt(target);const before=performance.now();render();samples.push(performance.now()-before);if(t<1)frame=requestAnimationFrame(tick);else{tween=null;if(samples.length>5&&samples.reduce((a,b)=>a+b,0)/samples.length>80)onFailure('The 3D view is running slowly. The simple archive is ready.')}};frame=requestAnimationFrame(tick)}
  const initial=view('overview');camera.position.set(...initial.p);target.set(...initial.t);camera.lookAt(target);
  const ray=new THREE.Raycaster();const pointer=new THREE.Vector2();
  const pick=e=>{if(disposed)return;pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(hits,false)[0];if(hit)onPick(hit.object.userData.stop)};
  renderer.domElement.addEventListener('click',pick);
  const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);const v=view(current);camera.position.set(...v.p);target.set(...v.t);camera.lookAt(target);render()};
  const visible=()=>{if(!document.hidden){if(tween){camera.position.copy(tween.endP);target.copy(tween.endT);camera.lookAt(target);tween=null}render()}};
  addEventListener('resize',resize);document.addEventListener('visibilitychange',visible);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('The graphics connection was lost. The simple archive is ready.')});
  render();onReady({renderer:'Three.js WebGL2',triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,mobile});
  return{go,setMotion(value){allowMotion=value;if(!value&&tween){cancelAnimationFrame(frame);camera.position.copy(tween.endP);target.copy(tween.endT);camera.lookAt(target);tween=null;render()}},dispose(){disposed=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visible);const geometries=new Set(),materials=new Set(),maps=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of(Array.isArray(o.material)?o.material:[o.material])){materials.add(m);if(m.map)maps.add(m.map)}});geometries.forEach(g=>g.dispose());maps.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove()}};
}
