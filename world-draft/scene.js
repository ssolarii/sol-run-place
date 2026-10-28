import * as THREE from './vendor/three.module.js';

// The camera and each independently curved surface are the approved Blender export.
// No island, primitive replacement foliage, or travelling camera is involved.
export async function createWorld({container,motionAllowed,onReady,onFailure}) {
  const [layout,texture]=await Promise.all([
    fetch('../assets/foliage/leaf-layout.json').then(r=>{if(!r.ok)throw Error('Leaf geometry unavailable');return r.json()}),
    new THREE.TextureLoader().loadAsync('../assets/runtime/leaf-texture.webp').catch(()=>new THREE.TextureLoader().loadAsync('../assets/foliage/leaf-texture.png'))
  ]);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.flipY=layout.texture.flipY;
  texture.anisotropy=4;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.NoToneMapping;
  renderer.setClearColor(0x101111,0);
  const canvas=renderer.domElement;canvas.setAttribute('aria-hidden','true');canvas.dataset.curvedMeshes=String(layout.leaves.length);canvas.dataset.triangles=String(layout.leaves.length*layout.meshTopology.indices.length/3);
  container.append(canvas);
  const scene=new THREE.Scene(),span=layout.camera.verticalSpan;
  const camera=new THREE.OrthographicCamera(-layout.camera.horizontalSpan/2,layout.camera.horizontalSpan/2,span/2,-span/2,.1,100);
  camera.position.fromArray(layout.camera.position);
  const ambient=new THREE.AmbientLight(0xffffff,.32);scene.add(ambient);
  const key=new THREE.DirectionalLight(0xfffcf4,.96);key.position.set(-3,4,7);scene.add(key);
  const fill=new THREE.DirectionalLight(0xd7e5d6,.26);fill.position.set(4,-2,5);scene.add(fill);
  const leaves=layout.leaves.map(item=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(item.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(item.normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(layout.meshTopology.uvs,2));
    geometry.setIndex(layout.meshTopology.indices);
    const material=new THREE.MeshLambertMaterial({map:texture,emissive:0x141414,transparent:true,alphaTest:.025,side:THREE.DoubleSide,depthWrite:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(item.position);mesh.rotation.fromArray([...item.rotationEulerXYZ,'XYZ']);mesh.scale.fromArray(item.scale);mesh.userData.home=mesh.position.clone();mesh.userData.angle=mesh.rotation.z;scene.add(mesh);return mesh;
  });
  let allowed=motionAllowed,frame=0,disposed=false,visible=true;
  let x=0,y=0,s=0,targetX=0,targetY=0,targetS=0,sectionX=0,sectionY=0;
  function draw(){
    if(disposed)return;
    x+=(targetX-x)*.13;y+=(targetY-y)*.13;s+=(targetS-s)*.13;
    leaves.forEach((leaf,i)=>{const depth=[1,-.8,.55][i];leaf.position.x=leaf.userData.home.x+(x*.016+sectionX)*depth;leaf.position.y=leaf.userData.home.y+(y*.012+s*.022+sectionY)*depth;leaf.rotation.z=leaf.userData.angle+x*.0016*depth});
    renderer.render(scene,camera);
    frame=0;
    if(visible&&(Math.abs(x-targetX)+Math.abs(y-targetY)+Math.abs(s-targetS)>.0005))frame=requestAnimationFrame(draw);
  }
  function invalidate(){if(!frame&&visible&&!disposed)frame=requestAnimationFrame(draw)}
  function size(){const box=container.getBoundingClientRect();renderer.setSize(box.width,box.height,false);invalidate()}
  const resize=new ResizeObserver(size);resize.observe(container);size();draw();
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)invalidate()});observer.observe(container);
  function lost(event){event.preventDefault();onFailure?.();dispose()}
  canvas.addEventListener('webglcontextlost',lost);
  function dispose(){disposed=true;cancelAnimationFrame(frame);resize.disconnect();observer.disconnect();canvas.removeEventListener('webglcontextlost',lost);leaves.forEach(mesh=>{mesh.geometry.dispose();mesh.material.dispose()});texture.dispose();renderer.dispose();canvas.remove()}
  onReady?.();
  return {
    setMotion(value){allowed=value;if(!allowed){x=0;y=0;s=0;targetX=0;targetY=0;targetS=0;sectionX=0;sectionY=0;draw()}},
    setPointer(px,py){targetX=allowed?px:0;targetY=allowed?py:0;invalidate()},
    setScroll(value){targetS=allowed?Math.max(-1,Math.min(1,value)):0;invalidate()},
    setSection(id){sectionX=allowed&&id!=='projects'?.008:0;sectionY=allowed&&id==='about'?-.008:0;invalidate()},
    dispose
  };
}


// One indexed paper surface replaces the clipped DOM slices. The approved paper
// and its editable note text share UVs, so the ink bends continuously with it.
export async function createPaperCurl({container,source,front,action}) {
  await document.fonts.ready;
  const image=new Image();image.src='../assets/runtime/story-paper.webp';await image.decode();
  const paint=document.createElement('canvas');paint.width=1024;paint.height=768;const context=paint.getContext('2d');
  const texture=new THREE.CanvasTexture(paint);texture.colorSpace=THREE.SRGBColorSpace;
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);renderer.domElement.dataset.surfaceRows='96';renderer.domElement.dataset.triangles='768';container.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-2/3,2/3,.5,-.5,.1,10);camera.position.z=3;
  const geometry=new THREE.PlaneGeometry(4/3,1,4,96),original=new Float32Array(geometry.attributes.position.array);
  const face=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:texture,side:THREE.FrontSide,transparent:true,depthWrite:true}));scene.add(face);
  const reverseTexture=new THREE.Texture(image);reverseTexture.colorSpace=THREE.SRGBColorSpace;reverseTexture.needsUpdate=true;const reverse=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({map:reverseTexture,side:THREE.BackSide,transparent:true}));scene.add(reverse);
  let value=0;
  function paintText(){
    const width=source.getBoundingClientRect().width||336,scale=paint.width/width,style=getComputedStyle(front),actionStyle=getComputedStyle(action);context.clearRect(0,0,paint.width,paint.height);context.drawImage(image,0,0,paint.width,paint.height);context.fillStyle='#17251e';context.textBaseline='top';context.font=`${style.fontWeight} ${parseFloat(style.fontSize)*scale}px HelveticaNow`;
    const words=front.textContent.split(/\s+/);let line='',row=0;const lineHeight=parseFloat(style.fontSize)*1.2*scale;
    for(const word of words){const candidate=line?line+' '+word:word;if(line&&context.measureText(candidate).width>paint.width*.76){context.fillText(line,paint.width*.12,paint.height*.3+row++*lineHeight);line=word}else line=candidate}context.fillText(line,paint.width*.12,paint.height*.3+row*lineHeight);
    context.font=`400 ${parseFloat(actionStyle.fontSize)*scale}px HelveticaNow`;context.fillText('Peel note',paint.width*.12,paint.height*.75);const ax=paint.width*.12+context.measureText('Peel note').width+12*scale,ay=paint.height*.75+3*scale;context.strokeStyle='#17251e';context.lineWidth=1.4*scale;context.beginPath();context.moveTo(ax,ay+12*scale);context.lineTo(ax+12*scale,ay);context.moveTo(ax,ay);context.lineTo(ax+12*scale,ay);context.lineTo(ax+12*scale,ay+12*scale);context.stroke();texture.needsUpdate=true;
  }
  function setProgress(progress){value=progress;const positions=geometry.attributes.position;const rows=97,projected=new Float32Array(rows),depth=new Float32Array(rows);for(let row=1;row<rows;row++){const t=(row-.5)/96,angle=value*Math.PI*1.42*Math.pow(t,1.55);projected[row]=projected[row-1]+Math.cos(angle)/96;depth[row]=depth[row-1]+Math.sin(angle)/96}for(let i=0;i<positions.count;i++){const row=Math.round((.5-original[i*3+1])*96);positions.setXYZ(i,original[i*3],.5-projected[row],depth[row])}positions.needsUpdate=true;geometry.computeVertexNormals();renderer.domElement.dataset.progress=String(value);renderer.domElement.dataset.maxVertexDepth=String(Math.max(...depth));renderer.render(scene,camera)}
  function size(){const box=source.getBoundingClientRect();renderer.setSize(box.width,box.height,false);paintText();setProgress(value)}
  const observer=new ResizeObserver(size);observer.observe(source);size();
  return {setProgress,refresh:paintText,dispose(){observer.disconnect();geometry.dispose();face.material.dispose();reverse.material.dispose();reverseTexture.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove()}};
}
