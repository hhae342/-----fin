/* C: architectural collage fragments. Physics: Matter.js 0.20.0, MIT.
 * Original image remains intact; polygons are clipped only at render time.
 */
(function () {
  'use strict';
  window.createCDeconstruction = function ({ surface, canvas, image, isActive }) {
    const M = window.Matter;
    if (!M) return { enter() {}, move() {}, down() {}, up() {}, leave() {}, reset() {}, rewind() {} };
    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let engine, pieces = [], links = [], width = 0, height = 0, ratio = 1;
    let frame = 0, last = 0, hover = null, held = null, pointerId = null, joint = null;
    let movingUntil = 0, returning = null, crop;
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Oblique cuts echo the window, tabletop and floor axes of c-03-destroy.jpg.
    // Half-plane clipping keeps every piece convex and covers the original exactly.
    function split(poly, a, b, sign) {
      const side = p => sign * ((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));
      const out = [];
      poly.forEach((p, i) => {
        const q = poly[(i+1)%poly.length], d = side(p), e = side(q);
        if (d >= 0) out.push(p);
        if ((d >= 0) !== (e >= 0)) {
          const t = d/(d-e);
          out.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
        }
      });
      return out;
    }
    function polygons() {
      let cells = [[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]];
      const cuts = [[[.73,0],[.29,1]],[[0,.66],[1,.39]],[[0,.32],[1,.16]],[[.16,0],[.42,1]],[[0,.94],[1,.7]]];
      for (const [a,b] of cuts) cells = cells.flatMap(poly => {
        const halves = [1,-1].map(sign => split(poly,{x:a[0],y:a[1]},{x:b[0],y:b[1]},sign));
        // Do not create hairline slivers; retain the unsplit parent instead.
        return halves.every(p => p.length >= 3 && M.Vertices.area(p) > .008) ? halves : [poly];
      });
      return cells;
    }
    function release() {
      if (joint && engine) M.Composite.remove(engine.world,joint);
      joint = null; held = null;
      if (pointerId !== null && surface.hasPointerCapture(pointerId)) surface.releasePointerCapture(pointerId);
      pointerId = null;
      surface.classList.remove('is-pressed');
    }
    function reset() {
      cancelAnimationFrame(frame); frame = 0; last = 0;
      release();
      if (engine) { M.Composite.clear(engine.world,false); M.Engine.clear(engine); }
      engine = null; pieces = []; links = []; returning = null; hover = null;
      movingUntil = 0; width = 0; height = 0;
      // Never clear a canvas already owned by another profile's effect.
      if (isActive()) surface.classList.remove('is-active');
    }
    function prepare() {
      if (!isActive() || !image.complete || !image.naturalWidth) return false;
      const w = surface.clientWidth, h = surface.clientHeight;
      if (!w || !h) return false;
      const dpr = Math.min(window.devicePixelRatio || 1,2);
      if (engine && width === w && height === h && ratio === dpr) return true;
      reset(); width = w; height = h; ratio = dpr;
      canvas.width = Math.round(w*ratio); canvas.height = Math.round(h*ratio);
      const scale = Math.max(w/image.naturalWidth,h/image.naturalHeight);
      crop = {sw:w/scale,sh:h/scale,sx:(image.naturalWidth-w/scale)/2,sy:(image.naturalHeight-h/scale)/2};
      engine = M.Engine.create({gravity:{x:0,y:0},positionIterations:8,velocityIterations:8});
      pieces = polygons().map((poly, id) => {
        const vertices = poly.map(p => ({x:p.x*w,y:p.y*h}));
        const home = M.Vertices.centre(vertices);
        // Tiny collision inset prevents an intact, edge-to-edge collage exploding on startup.
        const physical = vertices.map(p => ({x:home.x+(p.x-home.x)*.982,y:home.y+(p.y-home.y)*.982}));
        const body = M.Bodies.fromVertices(home.x,home.y,[physical],{
          frictionAir:.085,friction:.25,restitution:.18,density:.001,slop:.1
        });
        const piece = {id,body,home,vertices:vertices.map(p => ({x:p.x-home.x,y:p.y-home.y}))};
        body.plugin.piece = piece;
        return piece;
      });
      M.Composite.add(engine.world,pieces.map(p => p.body));
      const paired = new Set();
      for (const p of pieces) {
        const nearest = pieces.filter(q => q!==p).sort((a,b) => M.Vector.magnitude(M.Vector.sub(a.home,p.home))-M.Vector.magnitude(M.Vector.sub(b.home,p.home))).slice(0,2);
        for (const q of nearest) {
          const key = [p.id,q.id].sort((a,b)=>a-b).join(':');
          if (paired.has(key)) continue;
          paired.add(key);
          const link = M.Constraint.create({bodyA:p.body,bodyB:q.body,stiffness:.0015,damping:.025});
          links.push(link); M.Composite.add(engine.world,link);
        }
      }
      M.Composite.add(engine.world,[
        M.Bodies.rectangle(w/2,-55,w+220,100,{isStatic:true}),
        M.Bodies.rectangle(w/2,h+55,w+220,100,{isStatic:true}),
        M.Bodies.rectangle(-55,h/2,100,h+220,{isStatic:true}),
        M.Bodies.rectangle(w+55,h/2,100,h+220,{isStatic:true})
      ]);
      surface.classList.add('is-active');
      draw();
      return true;
    }
    function trace(piece) {
      ctx.beginPath();
      piece.vertices.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.closePath();
    }
    function draw() {
      ctx.setTransform(ratio,0,0,ratio,0,0);
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over'; ctx.filter='none';
      ctx.clearRect(0,0,width,height);
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
      const top = held || hover;
      if (!top && pieces.every(p=>Math.abs(p.body.position.x-p.home.x)<.001 && Math.abs(p.body.position.y-p.home.y)<.001 && Math.abs(p.body.angle)<.00001)) {
        // Draw the intact source once, avoiding antialiased seams after restoration.
        ctx.drawImage(image,crop.sx,crop.sy,crop.sw,crop.sh,0,0,width,height);
        return;
      }
      const order = top ? [...pieces.filter(p=>p!==top),top] : pieces;
      for (const p of order) {
        const lifted = p===top && !returning;
        ctx.save(); ctx.translate(p.body.position.x,p.body.position.y); ctx.rotate(p.body.angle);
        if (lifted && !reduced.matches) ctx.scale(1.009,1.009);
        trace(p);
        if (lifted) {
          ctx.shadowColor='rgba(22,40,70,.2)'; ctx.shadowBlur=14; ctx.shadowOffsetY=5;
          ctx.fillStyle='#fff'; ctx.fill(); ctx.shadowColor='transparent';
        }
        ctx.save(); ctx.clip();
        ctx.drawImage(image,crop.sx,crop.sy,crop.sw,crop.sh,-p.home.x,-p.home.y,width,height);
        ctx.restore();
        if (p===held) { trace(p); ctx.strokeStyle='rgb(22,40,210)'; ctx.lineWidth=1; ctx.stroke(); }
        ctx.restore();
      }
    }
    function tick(now) {
      frame=0;
      if (!isActive()) { reset(); return; }
      if (document.hidden) { release(); return; }
      if (!prepare()) return;
      if (returning) {
        const t = clamp((now-returning.start)/700,0,1), ease=1-Math.pow(1-t,4);
        pieces.forEach((p,i) => {
          const from=returning.from[i];
          M.Body.setPosition(p.body,{x:from.x+(p.home.x-from.x)*ease,y:from.y+(p.home.y-from.y)*ease});
          M.Body.setAngle(p.body,from.angle*(1-ease));
        });
        if (t===1) { reset(); prepare(); return; }
      } else if (held || now<movingUntil) {
        M.Engine.update(engine,Math.min(last ? now-last : 16.667,16.667));
        // The temporary connections tear when stretched, leaving a new arrangement.
        links = links.filter(link => {
          if (M.Vector.magnitude(M.Vector.sub(link.bodyA.position,link.bodyB.position)) > link.length*1.28) {
            M.Composite.remove(engine.world,link); return false;
          }
          return true;
        });
        for (const p of pieces) {
          if (p.body.speed>12) M.Body.setVelocity(p.body,M.Vector.mult(p.body.velocity,12/p.body.speed));
          M.Body.setAngularVelocity(p.body,clamp(p.body.angularVelocity,-.055,.055));
        }
      }
      draw(); last=now;
      if (returning || held || now<movingUntil) frame=requestAnimationFrame(tick);
    }
    function wake() { if (!frame) { last=0; frame=requestAnimationFrame(tick); } }
    function point(event) {
      const r=surface.getBoundingClientRect();
      return {x:clamp((event.clientX-r.left-surface.clientLeft)*width/surface.clientWidth,0,width),y:clamp((event.clientY-r.top-surface.clientTop)*height/surface.clientHeight,0,height)};
    }
    function pick(at) {
      const found=M.Query.point(pieces.map(p=>p.body),at);
      return found.length ? found[found.length-1].plugin.piece : null;
    }
    function enter(event) { if (prepare()) { hover=pick(point(event)); draw(); } }
    function move(event) {
      if (!prepare() || returning) return;
      const at=point(event);
      if (joint && event.pointerId===pointerId) { joint.pointA=at; wake(); }
      else if (!held) { hover=pick(at); draw(); }
    }
    function down(event) {
      if ((event.button!==undefined && event.button!==0) || pointerId!==null || !prepare() || returning) return;
      const at=point(event), p=pick(at);
      if (!p) return;
      event.preventDefault(); held=p; hover=p; pointerId=event.pointerId;
      surface.setPointerCapture(pointerId); surface.classList.add('is-pressed');
      joint=M.Constraint.create({pointA:at,bodyB:p.body,pointB:M.Vector.sub(at,p.body.position),length:0,stiffness:.16,damping:.12});
      M.Composite.add(engine.world,joint);
      // A tap also opens the seams; dragging then carries the chosen fragment.
      for (const q of pieces) {
        const dx=q.body.position.x-at.x,dy=q.body.position.y-at.y,d=Math.max(1,Math.hypot(dx,dy));
        if (q!==p && d<width*.48) {
          const impulse=(1-d/(width*.48))*(reduced.matches ? .5 : 2.8);
          M.Body.setVelocity(q.body,{x:dx/d*impulse,y:dy/d*impulse});
          M.Body.setAngularVelocity(q.body,(q.id%2 ? 1 : -1)*impulse*.007);
        }
      }
      movingUntil=performance.now()+1800; wake();
    }
    function up(event) {
      if (event && pointerId!==null && event.pointerId!==pointerId) return;
      release(); movingUntil=performance.now()+(reduced.matches ? 250 : 1600); wake();
    }
    function leave() { hover=null; if (engine) { draw(); if (held) wake(); } }
    function rewind() {
      if (!prepare()) return;
      release(); hover=null;
      if (reduced.matches) { reset(); prepare(); return; }
      returning={start:performance.now(),from:pieces.map(p=>({...p.body.position,angle:p.body.angle}))};
      wake();
    }
    surface.addEventListener('lostpointercapture',()=>{if (held) up();});
    window.addEventListener('blur',()=>{if (held) up();});
    document.addEventListener('visibilitychange',()=>{if (document.hidden) { release(); cancelAnimationFrame(frame); frame=0; } else if (isActive() && engine) wake();});
    new ResizeObserver(()=>{if (engine && isActive() && (surface.clientWidth!==width || surface.clientHeight!==height)) prepare();}).observe(surface);
    return {enter,move,down,up,leave,reset,rewind};
  };
})();
