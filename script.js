(()=>{
  const btn = document.getElementById('lang');
  const langNodes = [...document.querySelectorAll('[data-en]')];
  let lang = localStorage.getItem('nexhero-lang') || ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');

  function applyLang(){
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    langNodes.forEach(el => el.textContent = el.dataset[lang]);
    btn.textContent = lang === 'zh' ? 'EN' : '中文';
    btn.setAttribute('aria-label', lang === 'zh' ? 'Switch to English' : '切换到中文');
    document.title = lang === 'zh' ? 'NexHero — 独立软件与 AI 实验室' : 'NexHero — Independent software & AI laboratory';
    localStorage.setItem('nexhero-lang', lang);
  }
  btn.addEventListener('click', () => { lang = lang === 'zh' ? 'en' : 'zh'; applyLang(); });
  applyLang();

  const art = document.getElementById('heroArt');
  const network = document.getElementById('networkField');
  const canvas = document.getElementById('fieldParticles');
  const hint = art?.querySelector('.interaction-hint');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = art && network && canvas && matchMedia('(pointer:fine)').matches && !reduced;
  if(!fine) return;

  if(hint){
    hint.dataset.en = 'PARTICLES · HOLD · RELEASE';
    hint.dataset.zh = '粒子 · 按住 · 释放';
    hint.textContent = lang === 'zh' ? hint.dataset.zh : hint.dataset.en;
    langNodes.push(hint);
  }

  const ctx = canvas.getContext('2d', {alpha:true});
  const PARTICLE_COUNT = 1200;
  const STAGES = ['core','model','inference','memory','agents'];
  const COLORS = ['77,124,255','77,124,255','96,139,255','132,220,200','166,184,195'];
  const AUTO_HIDE_MS = 480;
  const AUTO_FILL_MS = 850;
  const AUTO_STAGE_MS = 1180;
  const AUTO_VANISH_MS = 520;
  const AUTO_REVEAL_MS = 520;
  const AUTO_STATIC_MS = 1600;
  const FOLLOW_STAGE_MS = 1750;
  const EXPLOSION_MS = 3000;

  let w = 0, h = 0, dpr = 1;
  let mode = 'intro';
  let autoPhase = 'static';
  let phaseStart = performance.now();
  const introStart = phaseStart;
  let stageIndex = 0;
  let followStageIndex = 0;
  let followStageStart = phaseStart;
  let pointerInside = false;
  let pointerDown = false;
  let explosionStart = 0;
  let explosionEndedAt = -Infinity;
  let particleAlpha = 0;
  let targetMouse = {x:0,y:0};
  let smoothMouse = {x:0,y:0};
  let currentShapeTargets = [];
  const particles = [];

  network.style.transition = 'opacity .48s ease, transform .45s cubic-bezier(.2,.8,.2,1)';
  network.style.opacity = '1';
  network.style.transform = '';
  canvas.style.opacity = '1';
  canvas.style.transition = 'none';

  function resize(){
    const r = art.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!targetMouse.x && !targetMouse.y){
      targetMouse.x = smoothMouse.x = w/2;
      targetMouse.y = smoothMouse.y = h/2;
    }
    distributeHomes();
    if(mode === 'auto' && autoPhase === 'fill') setHomeTargets();
    if(mode === 'auto' && autoPhase === 'stage') currentShapeTargets = makeShapeTargets(STAGES[stageIndex]);
  }
  addEventListener('resize', resize, {passive:true});

  function svgToCanvas(x,y){ return {x:x/700*w, y:y/580*h}; }
  function addPoint(list,x,y,jitter=0){
    const p = svgToCanvas(x,y);
    list.push({x:p.x+(Math.random()-.5)*jitter,y:p.y+(Math.random()-.5)*jitter});
  }
  function linePoints(list,x1,y1,x2,y2,count,jitter=1.5){
    for(let i=0;i<count;i++){
      const t=count===1?.5:i/(count-1);
      addPoint(list,x1+(x2-x1)*t,y1+(y2-y1)*t,jitter);
    }
  }
  function rectPerimeter(list,x,y,rw,rh,count,jitter=1.4){
    const per=2*(rw+rh);
    for(let i=0;i<count;i++){
      let d=i/count*per,px=x,py=y;
      if(d<rw){px=x+d;py=y;}
      else if((d-=rw)<rh){px=x+rw;py=y+d;}
      else if((d-=rh)<rw){px=x+rw-d;py=y+rh;}
      else{d-=rw;px=x;py=y+rh-d;}
      addPoint(list,px,py,jitter);
    }
  }
  function circlePoints(list,cx,cy,r,count,jitter=1.4){
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2;
      addPoint(list,cx+Math.cos(a)*r,cy+Math.sin(a)*r,jitter);
    }
  }
  function fillRect(list,x,y,rw,rh,count){
    for(let i=0;i<count;i++) addPoint(list,x+Math.random()*rw,y+Math.random()*rh,0);
  }
  function polylinePoints(list,pts,count,jitter=1.5){
    const lengths=[]; let total=0;
    for(let i=0;i<pts.length-1;i++){
      const l=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
      lengths.push(l);total+=l;
    }
    for(let n=0;n<count;n++){
      let d=n/(count-1)*total,seg=0;
      while(seg<lengths.length-1&&d>lengths[seg]){d-=lengths[seg];seg++;}
      const t=lengths[seg]?d/lengths[seg]:0;
      addPoint(list,
        pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*t,
        pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*t,
        jitter);
    }
  }

  function makeCoreShape(){
    const a=[];
    circlePoints(a,350,268,108,160,1.6);
    circlePoints(a,350,268,78,120,1.4);
    circlePoints(a,350,268,46,80,1.1);
    rectPerimeter(a,306,224,88,88,120,1.1);
    rectPerimeter(a,326,244,48,48,80,.9);
    for(const x of [320,338,356,374]){linePoints(a,x,204,x,224,9,.8);linePoints(a,x,312,x,332,9,.8);}
    for(const y of [242,260,278]){linePoints(a,290,y,306,y,8,.8);linePoints(a,394,y,410,y,8,.8);}
    linePoints(a,295,268,405,268,50,1);
    linePoints(a,350,213,350,323,50,1);
    fillRect(a,331,251,38,34,70);
    return a;
  }
  function makeModelShape(){
    const a=[];
    rectPerimeter(a,86,92,170,104,210,1.4);
    fillRect(a,108,134,126,12,100);
    fillRect(a,108,154,84,10,70);
    fillRect(a,108,171,104,10,80);
    circlePoints(a,222,164,14,50,1);
    fillRect(a,216,158,12,12,30);
    return a;
  }
  function makeInferenceShape(){
    const a=[];
    rectPerimeter(a,444,98,170,104,210,1.4);
    const pts=[[468,166],[500,146],[532,156],[564,136],[590,146]];
    polylinePoints(a,pts,150,1.1);
    pts.forEach(([x,y])=>{circlePoints(a,x,y,5,22,.8);fillRect(a,x-3,y-3,6,6,12);});
    return a;
  }
  function makeMemoryShape(){
    const a=[];
    rectPerimeter(a,88,350,172,108,220,1.4);
    rectPerimeter(a,110,392,54,40,86,1.1);
    rectPerimeter(a,172,392,54,40,86,1.1);
    fillRect(a,112,394,50,36,80);
    fillRect(a,174,394,50,36,80);
    fillRect(a,110,438,116,8,72);
    return a;
  }
  function makeAgentsShape(){
    const a=[];
    rectPerimeter(a,446,344,170,114,220,1.4);
    rectPerimeter(a,468,386,122,44,110,1.1);
    linePoints(a,486,408,570,408,95,.9);
    for(const x of [486,528,570]){circlePoints(a,x,408,7,30,.8);fillRect(a,x-4,404,8,8,12);}
    fillRect(a,468,438,92,8,70);
    return a;
  }
  function makeShapeTargets(name){
    let base=[];
    if(name==='core') base=makeCoreShape();
    else if(name==='model') base=makeModelShape();
    else if(name==='inference') base=makeInferenceShape();
    else if(name==='memory') base=makeMemoryShape();
    else base=makeAgentsShape();
    const out=[];
    for(let i=0;i<PARTICLE_COUNT;i++){
      const p=base[i%base.length];
      out.push({x:p.x+(Math.random()-.5)*1.4,y:p.y+(Math.random()-.5)*1.4});
    }
    return out;
  }

  function distributeHomes(){
    if(!particles.length) return;
    const margin=46;
    const aspect=Math.max(.5,w/Math.max(1,h));
    const cols=Math.ceil(Math.sqrt(PARTICLE_COUNT*aspect));
    const rows=Math.ceil(PARTICLE_COUNT/cols);
    const cw=(w+margin*2)/cols;
    const ch=(h+margin*2)/rows;
    for(let i=0;i<PARTICLE_COUNT;i++){
      const c=i%cols,r=Math.floor(i/cols);
      const p=particles[i];
      p.homeX=-margin+(c+.5)*cw+(Math.random()-.5)*cw*.55;
      p.homeY=-margin+(r+.5)*ch+(Math.random()-.5)*ch*.55;
    }
  }

  for(let i=0;i<PARTICLE_COUNT;i++){
    particles.push({
      x:0,y:0,vx:0,vy:0,tx:0,ty:0,homeX:0,homeY:0,
      size:.85+Math.random()*1.7,
      color:COLORS[(Math.random()*COLORS.length)|0],
      alpha:.4+Math.random()*.55
    });
  }
  resize();
  distributeHomes();
  for(const p of particles){
    p.x=p.homeX;p.y=p.homeY;p.tx=p.homeX;p.ty=p.homeY;
  }

  function setSvg(opacity){network.style.opacity=String(opacity);}
  function setHomeTargets(){
    for(const p of particles){p.tx=p.homeX;p.ty=p.homeY;}
  }
  function setShapeTargets(targets){
    for(let i=0;i<PARTICLE_COUNT;i++){
      const t=targets[i%targets.length];
      particles[i].tx=t.x;particles[i].ty=t.y;
    }
  }
  function zeroVel(scale=0){for(const p of particles){p.vx*=scale;p.vy*=scale;}}

  function beginAuto(now=performance.now(),fromParticles=false){
    mode='auto';
    stageIndex=0;
    autoPhase=fromParticles?'fill':'hide';
    phaseStart=now;
    if(fromParticles){
      setSvg(0);particleAlpha=1;setHomeTargets();zeroVel(.25);
    }else{
      setSvg(1);particleAlpha=0;
      requestAnimationFrame(()=>setSvg(0));
    }
  }
  function beginFollow(now=performance.now()){
    mode='follow';
    followStageIndex=0;
    followStageStart=now;
    setSvg(0);
    particleAlpha=1;
    setHomeTargets();
    zeroVel(.45);
  }
  function resetAtEdge(p){
    const side=(Math.random()*4)|0;
    if(side===0){p.x=-12;p.y=Math.random()*h;}
    else if(side===1){p.x=w+12;p.y=Math.random()*h;}
    else if(side===2){p.x=Math.random()*w;p.y=-12;}
    else{p.x=Math.random()*w;p.y=h+12;}
    p.vx=(Math.random()-.5)*.5;p.vy=(Math.random()-.5)*.5;
  }
  function beginSingularity(){
    mode='singularity';pointerDown=true;setSvg(0);particleAlpha=1;zeroVel(.4);
  }
  function beginExplosion(now=performance.now()){
    mode='explosion';pointerDown=false;explosionStart=now;explosionEndedAt=now+EXPLOSION_MS;setSvg(0);particleAlpha=1;
    for(const p of particles){
      let dx=p.x-smoothMouse.x,dy=p.y-smoothMouse.y,d=Math.hypot(dx,dy);
      if(d<2){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1;}
      const power=5.5+Math.random()*9.5;
      p.vx=dx/d*power+(Math.random()-.5)*2.4;
      p.vy=dy/d*power+(Math.random()-.5)*2.4;
    }
  }

  function updateAuto(now){
    const elapsed=now-phaseStart;
    if(autoPhase==='hide'){
      particleAlpha=0;
      if(elapsed>=AUTO_HIDE_MS){autoPhase='fill';phaseStart=now;setHomeTargets();zeroVel(.2);}
      return;
    }
    if(autoPhase==='fill'){
      setSvg(0);
      particleAlpha=Math.min(1,elapsed/AUTO_FILL_MS);
      setHomeTargets();
      if(elapsed>=AUTO_FILL_MS){
        autoPhase='stage';phaseStart=now;stageIndex=0;currentShapeTargets=makeShapeTargets(STAGES[stageIndex]);setShapeTargets(currentShapeTargets);
      }
      return;
    }
    if(autoPhase==='stage'){
      particleAlpha=1;setSvg(0);
      if(elapsed>=AUTO_STAGE_MS){
        if(stageIndex<STAGES.length-1){
          stageIndex++;phaseStart=now;currentShapeTargets=makeShapeTargets(STAGES[stageIndex]);setShapeTargets(currentShapeTargets);
        }else{
          autoPhase='vanish';phaseStart=now;
        }
      }
      return;
    }
    if(autoPhase==='vanish'){
      particleAlpha=Math.max(0,1-elapsed/AUTO_VANISH_MS);
      setSvg(0);
      if(elapsed>=AUTO_VANISH_MS){autoPhase='reveal';phaseStart=now;particleAlpha=0;setSvg(1);}
      return;
    }
    if(autoPhase==='reveal'){
      particleAlpha=0;
      if(elapsed>=AUTO_REVEAL_MS){autoPhase='static';phaseStart=now;setSvg(1);}
      return;
    }
    if(autoPhase==='static'){
      particleAlpha=0;setSvg(1);
      if(elapsed>=AUTO_STATIC_MS){autoPhase='hide';phaseStart=now;requestAnimationFrame(()=>setSvg(0));}
    }
  }

  function updateFollow(now){
    if(now-followStageStart>=FOLLOW_STAGE_MS){
      followStageIndex=(followStageIndex+1)%STAGES.length;
      followStageStart=now;
    }
    const shiftX=(smoothMouse.x-w/2)*.22;
    const shiftY=(smoothMouse.y-h/2)*.22;
    for(const p of particles){
      p.tx=p.homeX+shiftX;
      p.ty=p.homeY+shiftY;
    }
  }

  function resolveCollisions(){
    const cellSize=9;
    const grid=new Map();
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      if(p.x<-20||p.x>w+20||p.y<-20||p.y>h+20) continue;
      const cx=Math.floor(p.x/cellSize),cy=Math.floor(p.y/cellSize),key=cx+','+cy;
      let arr=grid.get(key);if(!arr){arr=[];grid.set(key,arr);}arr.push(i);
    }
    const offsets=[[0,0],[1,0],[0,1],[1,1],[-1,1]];
    for(const [key,arr] of grid){
      const [cx,cy]=key.split(',').map(Number);
      for(const [ox,oy] of offsets){
        const other=grid.get((cx+ox)+','+(cy+oy));if(!other) continue;
        for(const ia of arr){
          for(const ib of other){
            if(ox===0&&oy===0&&ib<=ia) continue;
            const a=particles[ia],b=particles[ib];
            let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
            const min=(a.size+b.size)*1.15;
            if(d2<=.0001||d2>=min*min) continue;
            const d=Math.sqrt(d2),nx=dx/d,ny=dy/d,overlap=min-d;
            a.x-=nx*overlap*.5;a.y-=ny*overlap*.5;b.x+=nx*overlap*.5;b.y+=ny*overlap*.5;
            const rvx=b.vx-a.vx,rvy=b.vy-a.vy,rel=rvx*nx+rvy*ny;
            if(rel<0){
              const impulse=-(1+.78)*rel*.5;
              a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;
            }
          }
        }
      }
    }
  }

  function physics(now){
    smoothMouse.x+=(targetMouse.x-smoothMouse.x)*.42;
    smoothMouse.y+=(targetMouse.y-smoothMouse.y)*.42;

    if(mode==='follow') updateFollow(now);

    if(mode==='singularity'){
      for(let j=0;j<3;j++) resetAtEdge(particles[(Math.floor(now/16)*3+j)%PARTICLE_COUNT]);
      for(const p of particles){
        const dx=smoothMouse.x-p.x,dy=smoothMouse.y-p.y,d=Math.max(5,Math.hypot(dx,dy));
        const nx=dx/d,ny=dy/d;
        const pull=.028+Math.min(.11,24/d*.02);
        const swirl=.42*Math.min(1,150/d);
        p.vx+=dx*pull+(-ny)*swirl;
        p.vy+=dy*pull+(nx)*swirl;
        p.vx*=.91;p.vy*=.91;p.x+=p.vx;p.y+=p.vy;
        if(d<8) resetAtEdge(p);
      }
      return;
    }

    if(mode==='explosion'){
      for(const p of particles){
        p.x+=p.vx;p.y+=p.vy;p.vx*=.992;p.vy*=.992;
        const r=Math.max(1,p.size);
        if(p.x<r){p.x=r;p.vx=Math.abs(p.vx)*.82;}
        else if(p.x>w-r){p.x=w-r;p.vx=-Math.abs(p.vx)*.82;}
        if(p.y<r){p.y=r;p.vy=Math.abs(p.vy)*.82;}
        else if(p.y>h-r){p.y=h-r;p.vy=-Math.abs(p.vy)*.82;}
      }
      resolveCollisions();
      if(now-explosionStart>=EXPLOSION_MS) beginAuto(now,true);
      return;
    }

    for(const p of particles){
      const dx=p.tx-p.x,dy=p.ty-p.y;
      let spring=.026,damping=.84;
      if(mode==='follow'){spring=.09;damping=.72;}
      else if(mode==='auto'&&autoPhase==='stage'){spring=.047;damping=.81;}
      else if(mode==='auto'&&autoPhase==='fill'){spring=.04;damping=.80;}
      p.vx+=dx*spring;p.vy+=dy*spring;
      if(mode==='follow'){
        const mdx=smoothMouse.x-p.x,mdy=smoothMouse.y-p.y,dist=Math.max(40,Math.hypot(mdx,mdy));
        p.vx+=mdx/dist*.045;p.vy+=mdy/dist*.045;
      }
      p.vx*=damping;p.vy*=damping;p.x+=p.vx;p.y+=p.vy;
    }
  }

  function roundedRectPath(x,y,rw,rh,r){
    const rr=Math.min(r,rw/2,rh/2);ctx.beginPath();ctx.roundRect(x,y,rw,rh,rr);
  }
  function carveStage(name,cx,cy){
    const s=Math.max(.64,Math.min(.92,Math.min(w/700,h/580)*1.08));
    ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);
    ctx.globalCompositeOperation='destination-out';
    ctx.strokeStyle='rgba(0,0,0,1)';ctx.fillStyle='rgba(0,0,0,1)';ctx.lineCap='round';ctx.lineJoin='round';
    if(name==='core'){
      ctx.lineWidth=10;for(const r of [108,78,46]){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();}
      roundedRectPath(-44,-44,88,88,18);ctx.stroke();roundedRectPath(-24,-24,48,48,12);ctx.fill();
      ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-74,0);ctx.lineTo(74,0);ctx.moveTo(0,-74);ctx.lineTo(0,74);ctx.stroke();
    }else if(name==='model'){
      ctx.lineWidth=11;roundedRectPath(-85,-52,170,104,20);ctx.stroke();
      ctx.fillRect(-63,-10,126,12);ctx.fillRect(-63,12,84,10);ctx.fillRect(-63,31,104,10);ctx.beginPath();ctx.arc(51,22,14,0,Math.PI*2);ctx.fill();
    }else if(name==='inference'){
      ctx.lineWidth=11;roundedRectPath(-85,-52,170,104,20);ctx.stroke();
      ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-61,18);ctx.lineTo(-29,-2);ctx.lineTo(3,8);ctx.lineTo(35,-12);ctx.lineTo(61,-2);ctx.stroke();
      for(const [x,y] of [[-61,18],[-29,-2],[3,8],[35,-12],[61,-2]]){ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.fill();}
    }else if(name==='memory'){
      ctx.lineWidth=11;roundedRectPath(-86,-54,172,108,20);ctx.stroke();roundedRectPath(-64,-12,54,40,10);ctx.fill();roundedRectPath(-2,-12,54,40,10);ctx.fill();ctx.fillRect(-64,36,116,9);
    }else{
      ctx.lineWidth=11;roundedRectPath(-85,-57,170,114,20);ctx.stroke();roundedRectPath(-63,-15,122,44,13);ctx.stroke();
      ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-45,7);ctx.lineTo(39,7);ctx.stroke();for(const x of [-45,-3,39]){ctx.beginPath();ctx.arc(x,7,8,0,Math.PI*2);ctx.fill();}ctx.fillRect(-63,38,92,9);
    }
    ctx.restore();ctx.globalCompositeOperation='source-over';
  }

  function draw(){
    ctx.clearRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
    for(const p of particles){
      const a=particleAlpha*p.alpha;if(a<=.008) continue;
      const speed=Math.hypot(p.vx,p.vy),len=Math.min(mode==='explosion'?24:16,2+speed*1.7);
      if(speed>.55){
        const ang=Math.atan2(p.vy,p.vx);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-Math.cos(ang)*len,p.y-Math.sin(ang)*len);ctx.lineWidth=Math.max(.5,p.size*.72);ctx.strokeStyle=`rgba(${p.color},${a*.38})`;ctx.stroke();
      }
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=`rgba(${p.color},${a})`;ctx.shadowBlur=mode==='singularity'?14:6;ctx.shadowColor=`rgba(${p.color},${Math.min(.42,a*.38)})`;ctx.fill();
    }
    ctx.shadowBlur=0;
    if(mode==='follow'){
      const margin=125;
      const cx=Math.max(margin,Math.min(w-margin,smoothMouse.x));
      const cy=Math.max(margin,Math.min(h-margin,smoothMouse.y));
      carveStage(STAGES[followStageIndex],cx,cy);
    }
  }

  function updateState(now){
    if(mode==='intro'){
      particleAlpha=0;setSvg(1);
      if(now-introStart>=1600) beginAuto(now,false);
      return;
    }
    if(mode==='auto') updateAuto(now);
    else if(mode==='follow'){
      particleAlpha=1;setSvg(0);
      if(now-followStageStart>=FOLLOW_STAGE_MS){followStageIndex=(followStageIndex+1)%STAGES.length;followStageStart=now;}
    }else if(mode==='singularity'){
      particleAlpha=1;setSvg(0);
    }else if(mode==='explosion'){
      particleAlpha=1;setSvg(0);
    }
  }

  function frame(now){updateState(now);physics(now);draw();requestAnimationFrame(frame);}
  requestAnimationFrame(frame);

  function setPointer(e){
    const r=art.getBoundingClientRect();targetMouse.x=e.clientX-r.left;targetMouse.y=e.clientY-r.top;
  }
  art.addEventListener('pointerenter',e=>{
    pointerInside=true;setPointer(e);
    if(mode!=='intro'&&mode!=='singularity'&&mode!=='explosion') beginFollow(performance.now());
  });
  art.addEventListener('pointermove',e=>{
    setPointer(e);
    if(pointerInside&&mode==='auto'&&performance.now()-explosionEndedAt>500) beginFollow(performance.now());
  });
  art.addEventListener('pointerleave',()=>{
    pointerInside=false;
    if(!pointerDown&&mode==='follow') beginAuto(performance.now(),true);
  });
  art.addEventListener('pointerdown',e=>{
    if(e.button!==0||mode==='intro'||mode==='explosion') return;
    setPointer(e);smoothMouse.x=targetMouse.x;smoothMouse.y=targetMouse.y;
    try{art.setPointerCapture(e.pointerId);}catch{}
    beginSingularity();
  });
  art.addEventListener('pointerup',e=>{
    if(!pointerDown) return;
    setPointer(e);smoothMouse.x=targetMouse.x;smoothMouse.y=targetMouse.y;
    try{art.releasePointerCapture(e.pointerId);}catch{}
    beginExplosion(performance.now());
  });
  art.addEventListener('pointercancel',()=>{if(pointerDown) beginExplosion(performance.now());});
})();