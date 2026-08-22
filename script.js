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

  const ctx = canvas.getContext('2d');
  const PARTICLE_COUNT = 760;
  const STAGES = ['core','model','inference','memory','agents'];
  const COLORS = ['77,124,255','77,124,255','77,124,255','132,220,200','168,184,194'];

  let w = 0, h = 0, dpr = 1;
  let mode = 'intro';
  let stageIndex = 0;
  let autoPhase = 'scatter';
  let phaseStart = performance.now();
  let introStart = phaseStart;
  let followStageStart = phaseStart;
  let mouse = {x:0,y:0,nx:0,ny:0};
  let pointerInside = false;
  let pointerDown = false;
  let explosionStart = 0;
  let particleAlpha = 0;
  let scatterTargets = [];
  let currentShapeTargets = [];
  const particles = [];

  network.style.transition = 'opacity .55s ease, transform .55s cubic-bezier(.2,.8,.2,1)';
  canvas.style.transition = 'opacity .7s ease';
  canvas.style.opacity = '0';

  function resize(){
    const r = art.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!mouse.x && !mouse.y){ mouse.x = w/2; mouse.y = h/2; }
    makeScatterTargets();
    currentShapeTargets = makeShapeTargets(STAGES[stageIndex]);
  }
  resize();
  addEventListener('resize', resize, {passive:true});

  function svgToCanvas(x,y){ return {x:x/700*w, y:y/580*h}; }
  function addPoint(list,x,y,jitter=0){
    const p = svgToCanvas(x,y);
    list.push({x:p.x + (Math.random()-.5)*jitter, y:p.y + (Math.random()-.5)*jitter});
  }
  function linePoints(list,x1,y1,x2,y2,count,jitter=1.5){
    for(let i=0;i<count;i++){
      const t = count===1 ? .5 : i/(count-1);
      addPoint(list, x1+(x2-x1)*t, y1+(y2-y1)*t, jitter);
    }
  }
  function rectPerimeter(list,x,y,rw,rh,count,jitter=1.4){
    const per = 2*(rw+rh);
    for(let i=0;i<count;i++){
      let d = i/count*per;
      let px=x,py=y;
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
      lengths.push(l); total+=l;
    }
    for(let n=0;n<count;n++){
      let d=n/(count-1)*total, seg=0;
      while(seg<lengths.length-1 && d>lengths[seg]){ d-=lengths[seg]; seg++; }
      const t=lengths[seg] ? d/lengths[seg] : 0;
      linePoints(list,
        pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*t,
        pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*t,
        pts[seg][0]+(pts[seg+1][0]-pts[seg][0])*t,
        pts[seg][1]+(pts[seg+1][1]-pts[seg][1])*t,
        1,jitter);
    }
  }

  function makeCoreShape(){
    const a=[];
    circlePoints(a,350,268,108,125,1.8);
    circlePoints(a,350,268,78,90,1.6);
    circlePoints(a,350,268,46,60,1.2);
    rectPerimeter(a,306,224,88,88,90,1.3);
    rectPerimeter(a,326,244,48,48,58,1.1);
    for(let x of [320,338,356,374]){ linePoints(a,x,204,x,224,7,1); linePoints(a,x,312,x,332,7,1); }
    for(let y of [242,260,278]){ linePoints(a,290,y,306,y,6,1); linePoints(a,394,y,410,y,6,1); }
    linePoints(a,295,268,405,268,38,1.2);
    linePoints(a,350,213,350,323,38,1.2);
    fillRect(a,331,251,38,34,45);
    return a;
  }
  function makeModelShape(){
    const a=[];
    rectPerimeter(a,86,92,170,104,155,1.6);
    fillRect(a,108,134,126,12,70);
    fillRect(a,108,154,84,10,48);
    fillRect(a,108,171,104,10,58);
    circlePoints(a,222,164,14,38,1.2);
    fillRect(a,216,158,12,12,20);
    return a;
  }
  function makeInferenceShape(){
    const a=[];
    rectPerimeter(a,444,98,170,104,155,1.6);
    const pts=[[468,166],[500,146],[532,156],[564,136],[590,146]];
    polylinePoints(a,pts,105,1.3);
    pts.forEach(([x,y])=>{circlePoints(a,x,y,5,16,1);fillRect(a,x-3,y-3,6,6,8);});
    return a;
  }
  function makeMemoryShape(){
    const a=[];
    rectPerimeter(a,88,350,172,108,160,1.6);
    rectPerimeter(a,110,392,54,40,65,1.3);
    rectPerimeter(a,172,392,54,40,65,1.3);
    fillRect(a,112,394,50,36,50);
    fillRect(a,174,394,50,36,50);
    fillRect(a,110,438,116,8,50);
    return a;
  }
  function makeAgentsShape(){
    const a=[];
    rectPerimeter(a,446,344,170,114,165,1.6);
    rectPerimeter(a,468,386,122,44,88,1.3);
    linePoints(a,486,408,570,408,70,1.1);
    for(const x of [486,528,570]){ circlePoints(a,x,408,7,24,1); fillRect(a,x-4,404,8,8,8); }
    fillRect(a,468,438,92,8,46);
    return a;
  }

  function makeShapeTargets(name){
    let base=[];
    if(name==='core') base=makeCoreShape();
    if(name==='model') base=makeModelShape();
    if(name==='inference') base=makeInferenceShape();
    if(name==='memory') base=makeMemoryShape();
    if(name==='agents') base=makeAgentsShape();
    const out=[];
    for(let i=0;i<PARTICLE_COUNT;i++){
      const p=base[i%base.length];
      out.push({x:p.x+(Math.random()-.5)*1.8,y:p.y+(Math.random()-.5)*1.8});
    }
    return out;
  }

  function makeScatterTargets(){
    scatterTargets = Array.from({length:PARTICLE_COUNT},()=>({
      x:18+Math.random()*Math.max(20,w-36),
      y:18+Math.random()*Math.max(20,h-36)
    }));
  }

  for(let i=0;i<PARTICLE_COUNT;i++){
    particles.push({
      x:Math.random()*w,
      y:Math.random()*h,
      vx:0,vy:0,
      tx:Math.random()*w,
      ty:Math.random()*h,
      size:.8+Math.random()*1.8,
      color:COLORS[(Math.random()*COLORS.length)|0],
      alpha:.35+Math.random()*.55
    });
  }

  function setTargets(targets, followMouse=false){
    if(!targets.length) return;
    let cx=0,cy=0;
    if(followMouse){
      for(const p of targets){cx+=p.x;cy+=p.y;}
      cx/=targets.length;cy/=targets.length;
    }
    for(let i=0;i<PARTICLE_COUNT;i++){
      const src=targets[i%targets.length];
      if(followMouse){
        const margin=85;
        const mx=Math.max(margin,Math.min(w-margin,mouse.x));
        const my=Math.max(margin,Math.min(h-margin,mouse.y));
        particles[i].tx=mx+(src.x-cx)*.72;
        particles[i].ty=my+(src.y-cy)*.72;
      }else{
        particles[i].tx=src.x;particles[i].ty=src.y;
      }
    }
  }

  function setSvgMood(opacity){ network.style.opacity=String(opacity); }
  function enterAuto(now=performance.now()){
    mode='auto'; autoPhase='scatter'; phaseStart=now; makeScatterTargets(); setTargets(scatterTargets); setSvgMood(.18); canvas.style.opacity='1';
  }
  function enterFollow(now=performance.now()){
    mode='follow'; followStageStart=now; currentShapeTargets=makeShapeTargets(STAGES[stageIndex]); setTargets(currentShapeTargets,true); setSvgMood(.12); canvas.style.opacity='1';
  }
  function enterSingularity(now=performance.now()){
    mode='singularity'; pointerDown=true; phaseStart=now; setSvgMood(.08); canvas.style.opacity='1';
  }
  function explode(now=performance.now()){
    mode='explosion'; pointerDown=false; explosionStart=now; setSvgMood(.1);
    for(const p of particles){
      let dx=p.x-mouse.x,dy=p.y-mouse.y,d=Math.hypot(dx,dy);
      if(d<4){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1;}
      const power=5+Math.random()*8;
      p.vx=dx/d*power+(Math.random()-.5)*2.5;
      p.vy=dy/d*power+(Math.random()-.5)*2.5;
    }
  }

  function updateState(now){
    if(mode==='intro'){
      particleAlpha=0;
      setSvgMood(1);
      if(now-introStart>1600) enterAuto(now);
      return;
    }
    if(mode==='auto'){
      particleAlpha=Math.min(1,particleAlpha+.025);
      const elapsed=now-phaseStart;
      if(autoPhase==='scatter'){
        if(elapsed>850){
          autoPhase='morph';phaseStart=now;currentShapeTargets=makeShapeTargets(STAGES[stageIndex]);setTargets(currentShapeTargets);
        }
      }else if(autoPhase==='morph'){
        if(elapsed>1250){autoPhase='hold';phaseStart=now;}
      }else if(autoPhase==='hold'){
        if(elapsed>650){
          stageIndex=(stageIndex+1)%STAGES.length;autoPhase='scatter';phaseStart=now;makeScatterTargets();setTargets(scatterTargets);
        }
      }
      return;
    }
    if(mode==='follow'){
      particleAlpha=Math.min(1,particleAlpha+.03);
      if(now-followStageStart>1700){
        stageIndex=(stageIndex+1)%STAGES.length;followStageStart=now;currentShapeTargets=makeShapeTargets(STAGES[stageIndex]);
      }
      setTargets(currentShapeTargets,true);
      return;
    }
    if(mode==='singularity'){
      particleAlpha=1;
      for(const p of particles){p.tx=mouse.x;p.ty=mouse.y;}
      return;
    }
    if(mode==='explosion'){
      particleAlpha=1;
      if(now-explosionStart>720) enterAuto(now);
    }
  }

  function physics(){
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      if(mode==='explosion'){
        p.x+=p.vx;p.y+=p.vy;p.vx*=.986;p.vy*=.986;
        continue;
      }
      if(mode==='singularity'){
        const dx=mouse.x-p.x,dy=mouse.y-p.y,d=Math.max(6,Math.hypot(dx,dy));
        const pull=Math.min(.48,18/d);
        const swirl=.06;
        p.vx+=dx*pull*.028-dy/d*swirl;
        p.vy+=dy*pull*.028+dx/d*swirl;
        p.vx*=.89;p.vy*=.89;
        p.x+=p.vx;p.y+=p.vy;
        continue;
      }
      const dx=p.tx-p.x,dy=p.ty-p.y;
      const spring=mode==='follow'?.032:(autoPhase==='morph'?.038:.024);
      p.vx+=dx*spring;p.vy+=dy*spring;
      if(mode==='follow'){
        p.vx+=(mouse.x-p.x)*.0007;
        p.vy+=(mouse.y-p.y)*.0007;
      }
      p.vx*=.84;p.vy*=.84;
      p.x+=p.vx;p.y+=p.vy;
    }
  }

  function draw(){
    ctx.clearRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
    for(const p of particles){
      const speed=Math.hypot(p.vx,p.vy);
      const a=particleAlpha*p.alpha;
      if(a<=.01) continue;
      const len=Math.min(14,2+speed*1.4);
      if(speed>.7){
        const ang=Math.atan2(p.vy,p.vx);
        ctx.beginPath();
        ctx.moveTo(p.x,p.y);
        ctx.lineTo(p.x-Math.cos(ang)*len,p.y-Math.sin(ang)*len);
        ctx.lineWidth=Math.max(.55,p.size*.7);
        ctx.strokeStyle=`rgba(${p.color},${a*.45})`;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.color},${a})`;
      ctx.shadowBlur=mode==='singularity'?14:8;
      ctx.shadowColor=`rgba(${p.color},${Math.min(.5,a*.42)})`;
      ctx.fill();
    }
    ctx.shadowBlur=0;
  }

  function frame(now){
    updateState(now);
    physics();
    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  art.addEventListener('pointerenter',e=>{
    pointerInside=true;
    const r=art.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
    if(!pointerDown) enterFollow(performance.now());
  });
  art.addEventListener('pointermove',e=>{
    const r=art.getBoundingClientRect();
    mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
    mouse.nx=mouse.x/r.width-.5;mouse.ny=mouse.y/r.height-.5;
    if(mode==='follow') network.style.transform=`perspective(1000px) rotateX(${(-mouse.ny*2.4).toFixed(2)}deg) rotateY(${(mouse.nx*3.6).toFixed(2)}deg)`;
  });
  art.addEventListener('pointerleave',()=>{
    pointerInside=false;
    network.style.transform='';
    if(!pointerDown) enterAuto(performance.now());
  });
  art.addEventListener('pointerdown',e=>{
    if(e.button!==0) return;
    const r=art.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
    art.setPointerCapture(e.pointerId);
    enterSingularity(performance.now());
  });
  art.addEventListener('pointerup',e=>{
    if(!pointerDown) return;
    try{art.releasePointerCapture(e.pointerId)}catch{}
    explode(performance.now());
  });
  art.addEventListener('pointercancel',()=>{ if(pointerDown) explode(performance.now()); });

  if(hint){hint.dataset.en='HOVER · HOLD · RELEASE';hint.dataset.zh='悬停 · 按住 · 释放';hint.textContent=lang==='zh'?hint.dataset.zh:hint.dataset.en;langNodes.push(hint);}
})();
