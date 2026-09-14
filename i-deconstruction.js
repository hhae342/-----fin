/* I: multiple viewpoints of the fourth-floor corridor.
 * Rendering library: OGL 1.0.11 (Unlicense).
 */
(function () {
  'use strict';
  window.createIDeconstruction = function ({ surface, canvas, fallbackCanvas, image, isActive }) {
    const O = window.OGL;
    if (!O) return { enter() {}, move() {}, down() {}, up() {}, leave() {}, reset() {}, rewind() {} };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let renderer, gl, camera, scene, texture, pieces = [], fallback = false;
    const fallbackContext=fallbackCanvas.getContext('2d');
    let width = 0, height = 0, dpr = 1, frame = 0, last = 0;
    let pointer = {x:0,y:0}, pointerTarget = {x:0,y:0};
    let burst = 0, burstTarget = 0, arrangement = 0, ready = false;
    const columns = 4, rows = 3;
    const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
    const ease = (from,to,amount) => from+(to-from)*amount;
    const hash = value => {
      const n=Math.sin(value*91.173+arrangement*47.733)*43758.5453;
      return n-Math.floor(n);
    };
    const vertex = `
      attribute vec3 position;
      attribute vec2 uv;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
    `;
    const fragment = `
      precision highp float;
      uniform sampler2D tMap;
      uniform vec4 uUvRect;
      uniform float uLift;
      varying vec2 vUv;
      void main(){
        vec2 uv=uUvRect.xy+vUv*uUvRect.zw;
        vec4 color=texture2D(tMap,uv);
        color.rgb=mix(color.rgb,min(vec3(1.0),color.rgb*1.035+vec3(0.018)),uLift);
        gl_FragColor=color;
      }
    `;
    function imageUvRect(column,row) {
      const imageAspect=image.naturalWidth/image.naturalHeight,viewAspect=width/height;
      let x=0,y=0,w=1,h=1;
      if (imageAspect>viewAspect) {w=viewAspect/imageAspect;x=(1-w)/2;}
      else {h=imageAspect/viewAspect;y=(1-h)/2;}
      return [x+w*column/columns,y+h*(rows-row-1)/rows,w/columns,h/rows];
    }
    function dispose() {
      cancelAnimationFrame(frame); frame=0; ready=false; pieces=[];
      renderer=null; gl=null; camera=null; scene=null; texture=null;fallback=false;
      width=height=0;
      canvas.width=canvas.height=1;
      fallbackCanvas.width=fallbackCanvas.height=1;
      surface.classList.remove('i-fallback');
      if (isActive()) surface.classList.remove('is-active');
    }
    function buildFallback(){
      fallback=true;ready=true;
      fallbackCanvas.width=Math.round(width*dpr);fallbackCanvas.height=Math.round(height*dpr);
      surface.classList.add('is-active','i-fallback');renderFallback();return true;
    }
    function renderFallback(){
      const context=fallbackContext,scale=Math.max(width/image.naturalWidth,height/image.naturalHeight),sourceWidth=width/scale,sourceHeight=height/scale,sourceX=(image.naturalWidth-sourceWidth)/2,sourceY=(image.naturalHeight-sourceHeight)/2;
      context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);context.fillStyle='#fff';context.fillRect(0,0,width,height);
      for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
        const id=row*columns+column,tileWidth=width/columns,tileHeight=height/rows,homeX=(column+.5)*tileWidth,homeY=(row+.5)*tileHeight,cx=(column+.5)/columns*2-1,cy=1-(row+.5)/rows*2,dx=cx-pointer.x,dy=cy-pointer.y,distance=Math.max(.15,Math.hypot(dx,dy)),direction=Math.atan2(-dy,dx)+(hash(id+3)-.5)*.42;
        const force=(12+hash(id+17)*28)*burst,offsetX=Math.cos(direction)*force+pointer.x*(row-1)*3,offsetY=Math.sin(direction)*force-pointer.y*(column-1.5)*3,angle=(hash(id+131)-.5)*.15*burst+pointer.x*.012*(row-1),zoom=1+(hash(id+71)-.28)*.12*burst;
        context.save();context.translate(homeX+offsetX,homeY+offsetY);context.rotate(angle);context.scale(zoom,zoom);
        context.drawImage(image,sourceX+sourceWidth*column/columns,sourceY+sourceHeight*row/rows,sourceWidth/columns,sourceHeight/rows,-tileWidth*.502,-tileHeight*.502,tileWidth*1.004,tileHeight*1.004);
        context.restore();
      }
    }
    function build() {
      if (!isActive() || !image.complete || !image.naturalWidth) return false;
      const nextWidth=surface.clientWidth,nextHeight=surface.clientHeight,nextDpr=Math.min(window.devicePixelRatio||1,2);
      if (!nextWidth||!nextHeight) return false;
      if (ready&&nextWidth===width&&nextHeight===height&&nextDpr===dpr) return true;
      dispose(); width=nextWidth;height=nextHeight;dpr=nextDpr;
      if(location.protocol==='file:')return buildFallback();
      try{renderer=new O.Renderer({canvas,dpr,alpha:false,antialias:true,premultipliedAlpha:false});gl=renderer.gl;if(!gl)throw new Error('WebGL unavailable')}catch(error){return buildFallback()}
      renderer.setSize(width,height); gl.clearColor(1,1,1,1);
      camera=new O.Camera(gl,{fov:34,near:.1,far:100});camera.position.z=5;camera.perspective({aspect:width/height});
      scene=new O.Transform(); texture=new O.Texture(gl,{image,generateMipmaps:true});
      const worldHeight=2*Math.tan(camera.fov*Math.PI/360)*camera.position.z,worldWidth=worldHeight*(width/height);
      const tileWidth=worldWidth/columns,tileHeight=worldHeight/rows;
      for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
        const id=row*columns+column,homeX=-worldWidth/2+tileWidth*(column+.5),homeY=worldHeight/2-tileHeight*(row+.5);
        const geometry=new O.Plane(gl,{width:tileWidth*1.004,height:tileHeight*1.004,widthSegments:1,heightSegments:1});
        const program=new O.Program(gl,{vertex,fragment,transparent:false,cullFace:false,uniforms:{tMap:{value:texture},uUvRect:{value:imageUvRect(column,row)},uLift:{value:0}}});
        const mesh=new O.Mesh(gl,{geometry,program});mesh.position.set(homeX,homeY,0);mesh.setParent(scene);
        pieces.push({id,row,column,mesh,homeX,homeY,x:homeX,y:homeY,z:0,rx:0,ry:0,rz:0});
      }
      ready=true;surface.classList.add('is-active');render();return true;
    }
    function targets(piece) {
      const cx=(piece.column+.5)/columns*2-1,cy=1-(piece.row+.5)/rows*2;
      const dx=cx-pointerTarget.x,dy=cy-pointerTarget.y,distance=Math.max(.15,Math.hypot(dx,dy));
      const proximity=Math.max(0,1-distance/1.15);
      if (!burstTarget) return {
        x:piece.homeX+pointerTarget.x*.08*(piece.row-1),
        y:piece.homeY+pointerTarget.y*.06*(piece.column-1.5),
        z:proximity*.3,
        rx:-pointerTarget.y*.055*(1+piece.row*.25),
        ry:pointerTarget.x*.075*(1+piece.column*.12),
        rz:(piece.column-1.5)*pointerTarget.y*.012,
        lift:proximity*.28
      };
      const direction=Math.atan2(dy,dx)+(hash(piece.id+3)-.5)*.62;
      const force=(.16+hash(piece.id+17)*.32)*(reduced.matches?.38:1);
      const scale=burstTarget;
      return {
        x:piece.homeX+Math.cos(direction)*force*scale+(hash(piece.id+31)-.5)*.1*scale,
        y:piece.homeY+Math.sin(direction)*force*scale+(hash(piece.id+53)-.5)*.08*scale,
        z:(hash(piece.id+71)*.92-.24)*scale+proximity*.24,
        rx:(hash(piece.id+89)-.5)*.3*scale-pointerTarget.y*.06,
        ry:(hash(piece.id+107)-.5)*.38*scale+pointerTarget.x*.075,
        rz:(hash(piece.id+131)-.5)*.16*scale,
        lift:.18+proximity*.38
      };
    }
    function render() {
      if (!ready)return;
      if(fallback){renderFallback();return;}
      renderer.render({scene,camera});
    }
    function tick(now) {
      frame=0;if(!isActive()){dispose();return;}if(!build())return;
      const elapsed=last?Math.min(32,now-last):16.667,lastAmount=1-Math.pow(.0015,elapsed/1000);
      pointer.x=ease(pointer.x,pointerTarget.x,lastAmount);pointer.y=ease(pointer.y,pointerTarget.y,lastAmount);
      burst=ease(burst,burstTarget,lastAmount*.82);
      let moving=Math.abs(burst-burstTarget)>.002||Math.abs(pointer.x-pointerTarget.x)>.002||Math.abs(pointer.y-pointerTarget.y)>.002;
      if(fallback){renderFallback();last=now;if(moving)frame=requestAnimationFrame(tick);return;}
      for(const piece of pieces){
        const target=targets(piece),amount=lastAmount*(.7+piece.id%3*.08);
        for(const key of ['x','y','z','rx','ry','rz']){const next=ease(piece[key],target[key],amount);if(Math.abs(next-piece[key])>.00005)moving=true;piece[key]=next;}
        piece.mesh.position.set(piece.x,piece.y,piece.z);
        piece.mesh.rotation.set(piece.rx,piece.ry,piece.rz);
        piece.mesh.program.uniforms.uLift.value=ease(piece.mesh.program.uniforms.uLift.value,target.lift,amount);
      }
      camera.position.x=ease(camera.position.x,pointer.x*.13,lastAmount);
      camera.position.y=ease(camera.position.y,pointer.y*.09,lastAmount);
      camera.lookAt([0,0,0]);render();last=now;
      if(moving)frame=requestAnimationFrame(tick);
    }
    function wake(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
    function locate(event){const rect=surface.getBoundingClientRect();return{x:clamp((event.clientX-rect.left)/rect.width*2-1,-1,1),y:clamp(1-(event.clientY-rect.top)/rect.height*2,-1,1)};}
    function activate(){if(!build())return;pointerTarget={x:0,y:0};wake();}
    function enter(event){if(!build())return;pointerTarget=locate(event);wake();}
    function move(event){if(!build())return;pointerTarget=locate(event);wake();}
    function down(event){
      if((event.button!==undefined&&event.button!==0)||!build())return;
      event.preventDefault();pointerTarget=locate(event);arrangement++;
      burstTarget=reduced.matches?.45:1;surface.classList.add('is-pressed');wake();
    }
    function up(){surface.classList.remove('is-pressed');}
    function leave(){pointerTarget={x:0,y:0};up();wake();}
    function rewind(){if(!build())return;arrangement++;burstTarget=0;pointerTarget={x:0,y:0};up();wake();}
    function reset(){dispose();pointer={x:0,y:0};pointerTarget={x:0,y:0};burst=burstTarget=0;arrangement=0;}
    image.addEventListener('load',()=>{if(isActive())build();});
    new ResizeObserver(()=>{if(ready&&isActive()&&(surface.clientWidth!==width||surface.clientHeight!==height)){dispose();build();wake();}}).observe(surface);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else if(isActive()&&ready)wake();});
    return {activate,enter,move,down,up,leave,reset,rewind};
  };
})();
