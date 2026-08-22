(()=>{
  const btn=document.getElementById('lang');
  const langNodes=[...document.querySelectorAll('[data-en]')];
  let lang=localStorage.getItem('nexhero-lang')||((navigator.language||'').toLowerCase().startsWith('zh')?'zh':'en');

  function applyLang(){
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';
    langNodes.forEach(el=>el.textContent=el.dataset[lang]);
    btn.textContent=lang==='zh'?'EN':'中文';
    btn.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');
    document.title=lang==='zh'?'NexHero — 独立软件与 AI 实验室':'NexHero — Independent software & AI laboratory';
    localStorage.setItem('nexhero-lang',lang);
  }
  btn.addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';applyLang()});
  applyLang();

  const art=document.getElementById('heroArt');
  const network=document.getElementById('networkField');
  const canvas=document.getElementById('fieldParticles');
  const hint=art?.querySelector('.interaction-hint');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine=art&&network&&canvas&&matchMedia('(pointer:fine)').matches&&!reduced;
  if(!fine) return;

  if(hint){
    hint.dataset.en='FLOW · HOLD · RELEASE';
    hint.dataset.zh='流动 · 按住 · 释放';
    hint.textContent=lang==='zh'?hint.dataset.zh:hint.dataset.en;
    langNodes.push(hint);
  }

  const ctx=canvas.getContext('2d',{alpha:true});
  const PARTICLE_COUNT=1500;
  const STAGES=['core','model','inference','memory','agents'];
  const COLORS=['77,124,255','77,124,255','96,139,255','132,220,200','166,184,195'];

  const INTRO_MS=1600;
  const HIDE_MS=480;
  const FLOW_MS=1450;
  const FORM_MS=1150;
  const HOLD_MS=1850;
  const VANISH_MS=600;
  const REVEAL_MS=520;
  const STATIC_MS=1600;
  const FOLLOW_STAGE_MS=4300;
  const FOLLOW_REVEAL_MS=850;
  const FOLLOW_HOLD_MS=2650;
  const EXPLOSION_MS=3000;

  let w=0,h=0,dpr=1;
  let mode='intro';
  let autoPhase='intro';
  let phaseStart=performance.now();
  const introStart=phaseStart;
  let autoStageIndex=0;
  let followStageIndex=0;
  let followStageStart=phaseStart;
  let currentShapeTargets=[];
  let particleAlpha=0;
  let pointerInside=false;
  let pointerDown=false;
  let explosionStart=0;
  let interactionLockUntil=0;
  let targetMouse={x:0,y:0};
  let prevMouse={x:0,y:0};
  let wind={x:0,y:0};
  const particles=[];

  network.style.transition='opacity .48s ease, transform .3s cubic-bezier(.2,.8,.2,1)';
  network.style.opacity='1';
  network.style.transform='';
  canvas.style.opacity='1';
  canvas.style.transition='none';

  function resize(){
    const r=art.getBoundingClientRect();
    dpr=Math.min(devicePixelRatio||1,2);
    w=r.width; h=r.height;
    canvas.width=Math.round(w*dpr);
    canvas.height=Math.round(h*dpr);
    canvas.style.width=w+'px';
    canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    if(!targetMouse.x&&!targetMouse.y){
      targetMouse.x=prevMouse.x=w/2;
      targetMouse.y=prevMouse.y=h/2;
    }
    if(!particles.length) initParticles();
    currentShapeTargets=makeShapeTargets(STAGES[autoStageIndex]);
  }
  addEventListener('resize',resize,{passive:true});

  function initParticles(){
    for(let i=0;i<PARTICLE_COUNT;i++){
      particles.push({
        x:Math.random()*w,
        y:Math.random()*h,
        vx:(Math.random()-.5)*.6,
        vy:(Math.random()-.5)*.6,
        tx:Math.random()*w,
        ty:Math.random()*h,
        size:.75+Math.random()*1.9,
        color:COLORS[(Math.random()*COLORS.length)|0],
        alpha:.28+Math.random()*.64,
        seed:Math.random()*1000,
        mass:.7+Math.random()*.9
      });
    }
  }

  function svgToCanvas(x,y){return{x:x/700*w,y:y/580*h}}
  function addPoint(list,x,y,jitter=0){
    const p=svgToCanvas(x,y);
    list.push({x:p.x+(Math.random()-.5)*jitter,y:p.y+(Math.random()-.5)*jitter});
  }
  function linePoints(list,x1,y1,x2,y2,count,jitter=1.3){
    for(let i=0;i<count;i++){
      const t=count===1?.5:i/(count-1);
      addPoint(list,x1+(x2-x1)*t,y1+(y2-y1)*t,jitter);
    }
  }
  function rectPerimeter(list,x,y,rw,rh,count,jitter=1.2){
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
  function circlePoints(list,cx,cy,r,count,jitter=1.1){
    for(let i=0;i<count;i++){
      const a=i/count*Math.PI*2;
      addPoint(list,cx+Math.cos(a)*r,cy+Math.sin(a)*r,jitter);
    }
  }
  function fillRect(list,x,y,rw,rh,count){
    for(let i=0;i<count;i++) addPoint(list,x+Math.random()*rw,y+Math.random()*rh,0);
  }
  function polylinePoints(list,pts,count,jitter=1.2){
    const lengths=[];let total=0;
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
    circlePoints(a,350,268,108,165,1.5);
    circlePoints(a,350,268,78,120,1.3);
    circlePoints(a,350,268,46,85,1.1);
    rectPerimeter(a,306,224,88,88,120,1.1);
    rectPerimeter(a,326,244,48,48,78,1);
    for(const x of [320,338,356,374]){linePoints(a,x,204,x,224,10,1);linePoints(a,x,312,x,332,10,1)}
    for(const y of [242,260,278]){linePoints(a,290,y,306,y,9,1);linePoints(a,394,y,410,y,9,1)}
    linePoints(a,295,268,405,268,50,1);
    linePoints(a,350,213,350,323,50,1);
    fillRect(a,330,248,40,40,85);
    return a;
  }
  function makeModelShape(){
    const a=[];
    rectPerimeter(a,86,92,170,104,210,1.4);
    fillRect(a,108,134,126,12,120);
    fillRect(a,108,154,84,10,85);
    fillRect(a,108,171,104,10,100);
    circlePoints(a,222,164,14,55,1.1);
    fillRect(a,216,158,12,12,45);
    return a;
  }
  function makeInferenceShape(){
    const a=[];
    rectPerimeter(a,444,98,170,104,210,1.4);
    const pts=[[468,166],[500,146],[532,156],[564,136],[590,146]];
    polylinePoints(a,pts,150,1.2);
    pts.forEach(([x,y])=>{circlePoints(a,x,y,5,24,1);fillRect(a,x-3,y-3,6,6,14)});
    return a;
  }
  function makeMemoryShape(){
    const a=[];
    rectPerimeter(a,88,350,172,108,220,1.4);
    rectPerimeter(a,110,392,54,40,92,1.1);
    rectPerimeter(a,172,392,54,40,92,1.1);
    fillRect(a,112,394,50,36,105);
    fillRect(a,174,394,50,36,105);
    fillRect(a,110,438,116,8,90);
    return a;
  }
  function makeAgentsShape(){
    const a=[];
    rectPerimeter(a,446,344,170,114,225,1.4);
    rectPerimeter(a,468,386,122,44,120,1.1);
    linePoints(a,486,408,570,408,100,1);
    for(const x of [486,528,570]){circlePoints(a,x,408,7,34,1);fillRect(a,x-4,404,8,8,16)}
    fillRect(a,468,438,92,8,85);
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
      out.push({x:p.x+(Math.random()-.5)*1.4,y:p.y+(Math.random()-.5)*1.4});
    }
    return out;
  }

  function setShapeTargets(name){
    currentShapeTargets=makeShapeTargets(name);
    for(let i=0;i<PARTICLE_COUNT;i++){
      particles[i].tx=currentShapeTargets[i].x;
      particles[i].ty=currentShapeTargets[i].y;
    }
  }

  function setSvgOpacity(value){network.style.opacity=String(value)}
  function enterAutoFlow(now=performance.now()){
    mode='auto';autoPhase='flow';phaseStart=now;particleAlpha=1;setSvgOpacity(0);
  }
  function enterFollow(now=performance.now()){
    mode='follow';followStageStart=now;followStageIndex=0;particleAlpha=1;setSvgOpacity(0);
  }
  function enterSingularity(now=performance.now()){
    mode='singularity';pointerDown=true;phaseStart=now;particleAlpha=1;setSvgOpacity(0);
  }
  function enterExplosion(now=performance.now()){
    mode='explosion';pointerDown=false;explosionStart=now;particleAlpha=1;setSvgOpacity(0);
    for(const p of particles){
      let dx=p.x-targetMouse.x,dy=p.y-targetMouse.y,d=Math.hypot(dx,dy);
      if(d<5){const a=Math.random()*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1}
      const speed=4.8+Math.random()*9.5;
      p.vx=dx/d*speed+(Math.random()-.5)*2.8;
      p.vy=dy/d*speed+(Math.random()-.5)*2.8;
    }
  }

  function flowField(p,now,strength=1){
    const t=now*.00052;
    const a=Math.sin(p.y*.013+t+p.seed*.011)*1.2 + Math.cos(p.x*.009-t*.83+p.seed*.017)*.9;
    p.vx+=Math.cos(a)*.020*strength;
    p.vy+=Math.sin(a)*.020*strength;
    p.vx+=Math.sin(t*.9+p.seed)*.004*strength;
    p.vy+=Math.cos(t*.75+p.seed*.7)*.004*strength;
  }

  function wrapParticle(p){
    const m=14;
    if(p.x<-m)p.x=w+m;
    else if(p.x>w+m)p.x=-m;
    if(p.y<-m)p.y=h+m;
    else if(p.y>h+m)p.y=-m;
  }

  function respawnAtEdge(p){
    const edge=(Math.random()*4)|0;
    if(edge===0){p.x=-8;p.y=Math.random()*h;}
    else if(edge===1){p.x=w+8;p.y=Math.random()*h;}
    else if(edge===2){p.x=Math.random()*w;p.y=-8;}
    else{p.x=Math.random()*w;p.y=h+8;}
    p.vx=(targetMouse.x-p.x)*.002+(Math.random()-.5)*.7;
    p.vy=(targetMouse.y-p.y)*.002+(Math.random()-.5)*.7;
  }

  function followMaskProgress(now){
    const e=(now-followStageStart)%FOLLOW_STAGE_MS;
    if(e<FOLLOW_REVEAL_MS) return e/FOLLOW_REVEAL_MS;
    if(e<FOLLOW_REVEAL_MS+FOLLOW_HOLD_MS) return 1;
    return Math.max(0,1-(e-FOLLOW_REVEAL_MS-FOLLOW_HOLD_MS)/(FOLLOW_STAGE_MS-FOLLOW_REVEAL_MS-FOLLOW_HOLD_MS));
  }

  function updateState(now){
    if(mode==='intro'){
      particleAlpha=0;setSvgOpacity(1);
      if(now-introStart>=INTRO_MS){
        mode='auto';autoPhase='hide';phaseStart=now;
      }
      return;
    }

    if(mode==='auto'){
      const elapsed=now-phaseStart;
      if(autoPhase==='hide'){
        setSvgOpacity(Math.max(0,1-elapsed/HIDE_MS));particleAlpha=0;
        if(elapsed>=HIDE_MS){autoPhase='flow';phaseStart=now;setSvgOpacity(0);particleAlpha=.2;}
      }else if(autoPhase==='flow'){
        particleAlpha=Math.min(1,.2+elapsed/FLOW_MS*.8);
        if(elapsed>=FLOW_MS){autoPhase='form';phaseStart=now;autoStageIndex=0;setShapeTargets(STAGES[autoStageIndex]);}
      }else if(autoPhase==='form'){
        particleAlpha=1;
        if(elapsed>=FORM_MS){autoPhase='hold';phaseStart=now;}
      }else if(autoPhase==='hold'){
        particleAlpha=1;
        if(elapsed>=HOLD_MS){
          if(autoStageIndex<STAGES.length-1){
            autoStageIndex++;autoPhase='form';phaseStart=now;setShapeTargets(STAGES[autoStageIndex]);
          }else{
            autoPhase='vanish';phaseStart=now;
          }
        }
      }else if(autoPhase==='vanish'){
        particleAlpha=Math.max(0,1-elapsed/VANISH_MS);
        if(elapsed>=VANISH_MS){autoPhase='reveal';phaseStart=now;particleAlpha=0;}
      }else if(autoPhase==='reveal'){
        setSvgOpacity(Math.min(1,elapsed/REVEAL_MS));
        if(elapsed>=REVEAL_MS){autoPhase='static';phaseStart=now;setSvgOpacity(1);}
      }else if(autoPhase==='static'){
        if(elapsed>=STATIC_MS){autoPhase='hide';phaseStart=now;}
      }
      return;
    }

    if(mode==='follow'){
      particleAlpha=1;setSvgOpacity(0);
      if(now-followStageStart>=FOLLOW_STAGE_MS){
        followStageIndex=(followStageIndex+1)%STAGES.length;
        followStageStart=now;
      }
      return;
    }

    if(mode==='singularity'){
      particleAlpha=1;setSvgOpacity(0);
      return;
    }

    if(mode==='explosion'){
      particleAlpha=1;setSvgOpacity(0);
      if(now-explosionStart>=EXPLOSION_MS){
        interactionLockUntil=now+1100;
        enterAutoFlow(now);
      }
    }
  }

  function autoPhysics(now){
    const forming=autoPhase==='form'||autoPhase==='hold';
    for(const p of particles){
      if(forming){
        const dx=p.tx-p.x,dy=p.ty-p.y;
        const spring=autoPhase==='form'?.030:.018;
        p.vx+=dx*spring;p.vy+=dy*spring;
        flowField(p,now,autoPhase==='hold'?.18:.08);
        p.vx*=.86;p.vy*=.86;
      }else{
        flowField(p,now,1.0);
        p.vx*=.982;p.vy*=.982;
      }
      const sp=Math.hypot(p.vx,p.vy),max=forming?5.2:2.7;
      if(sp>max){p.vx=p.vx/sp*max;p.vy=p.vy/sp*max;}
      p.x+=p.vx;p.y+=p.vy;
      if(!forming) wrapParticle(p);
    }
  }

  function followPhysics(now){
    const dxMouse=wind.x,dyMouse=wind.y;
    for(const p of particles){
      flowField(p,now,1.12);
      const dx=p.x-targetMouse.x,dy=p.y-targetMouse.y;
      const d=Math.hypot(dx,dy);
      const local=Math.exp(-(d*d)/(2*260*260));
      p.vx+=dxMouse*(.055*local+.012);
      p.vy+=dyMouse*(.055*local+.012);
      if(d>2){
        p.vx+=(-dy/d)*.010*local;
        p.vy+=( dx/d)*.010*local;
      }
      p.vx*=.976;p.vy*=.976;
      const sp=Math.hypot(p.vx,p.vy),max=5.8;
      if(sp>max){p.vx=p.vx/sp*max;p.vy=p.vy/sp*max;}
      p.x+=p.vx;p.y+=p.vy;
      wrapParticle(p);
    }
    wind.x*=.78;wind.y*=.78;
  }

  function singularityPhysics(now){
    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      const dx=targetMouse.x-p.x,dy=targetMouse.y-p.y;
      const d=Math.max(3,Math.hypot(dx,dy));
      const inv=1/d;
      const pull=Math.min(.78,24*inv);
      const swirl=.12+Math.min(.18,10*inv);
      p.vx+=dx*pull*.030-dy*inv*swirl;
      p.vy+=dy*pull*.030+dx*inv*swirl;
      p.vx*=.92;p.vy*=.92;
      p.x+=p.vx;p.y+=p.vy;
      if(d<10) respawnAtEdge(p);
    }
    for(let i=0;i<8;i++) respawnAtEdge(particles[(Math.random()*particles.length)|0]);
  }

  function explosionPhysics(now){
    const t=(now-explosionStart)/EXPLOSION_MS;
    const doCollisions=t<.9;
    const grid=doCollisions?new Map():null;
    const cell=18;

    for(let i=0;i<particles.length;i++){
      const p=particles[i];
      p.x+=p.vx;p.y+=p.vy;
      p.vx*=.992;p.vy*=.992;
      if(p.x<p.size){p.x=p.size;p.vx=Math.abs(p.vx)*.88;}
      else if(p.x>w-p.size){p.x=w-p.size;p.vx=-Math.abs(p.vx)*.88;}
      if(p.y<p.size){p.y=p.size;p.vy=Math.abs(p.vy)*.88;}
      else if(p.y>h-p.size){p.y=h-p.size;p.vy=-Math.abs(p.vy)*.88;}
      if(grid){
        const gx=(p.x/cell)|0,gy=(p.y/cell)|0,key=gx+','+gy;
        if(!grid.has(key))grid.set(key,[]);
        grid.get(key).push(i);
      }
    }

    if(grid){
      for(const [key,ids] of grid){
        const [gx,gy]=key.split(',').map(Number);
        for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){
          const other=grid.get((gx+ox)+','+(gy+oy));
          if(!other)continue;
          for(const i of ids)for(const j of other){
            if(j<=i)continue;
            const a=particles[i],b=particles[j];
            let dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
            const minD=a.size+b.size+1.2;
            if(d2>0&&d2<minD*minD){
              const d=Math.sqrt(d2),nx=dx/d,ny=dy/d;
              const overlap=(minD-d)*.5;
              a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
              const rvx=b.vx-a.vx,rvy=b.vy-a.vy,sep=rvx*nx+rvy*ny;
              if(sep<0){
                const impulse=-sep*.92;
                a.vx-=nx*impulse;a.vy-=ny*impulse;
                b.vx+=nx*impulse;b.vy+=ny*impulse;
              }
            }
          }
        }
      }
    }
  }

  function physics(now){
    if(mode==='singularity')singularityPhysics(now);
    else if(mode==='explosion')explosionPhysics(now);
    else if(mode==='follow')followPhysics(now);
    else autoPhysics(now);
  }

  function roundRectPath(c,x,y,rw,rh,r){
    const rr=Math.min(r,rw/2,rh/2);
    c.beginPath();
    c.moveTo(x+rr,y);c.lineTo(x+rw-rr,y);c.quadraticCurveTo(x+rw,y,x+rw,y+rr);
    c.lineTo(x+rw,y+rh-rr);c.quadraticCurveTo(x+rw,y+rh,x+rw-rr,y+rh);
    c.lineTo(x+rr,y+rh);c.quadraticCurveTo(x,y+rh,x,y+rh-rr);
    c.lineTo(x,y+rr);c.quadraticCurveTo(x,y,x+rr,y);c.closePath();
  }

  function drawVoidShape(stage,cx,cy,progress){
    if(progress<=.01)return;
    const s=Math.min(w,h)/560*1.18;
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.globalAlpha=Math.min(1,progress*1.25);
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='rgba(0,0,0,1)';ctx.fillStyle='rgba(0,0,0,1)';

    if(stage==='core'){
      for(const [r,lw] of [[102,14],[74,12],[46,10]]){
        ctx.lineWidth=lw*s;ctx.beginPath();ctx.arc(cx,cy,r*s*progress,0,Math.PI*2);ctx.stroke();
      }
      const rw=90*s*progress,rh=90*s*progress;
      roundRectPath(ctx,cx-rw/2,cy-rh/2,rw,rh,22*s);ctx.fill();
      ctx.lineWidth=7*s;
      ctx.beginPath();ctx.moveTo(cx-120*s*progress,cy);ctx.lineTo(cx+120*s*progress,cy);ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,cy-120*s*progress);ctx.lineTo(cx,cy+120*s*progress);ctx.stroke();
    }else if(stage==='model'){
      const rw=248*s*progress,rh=148*s*progress,x=cx-rw/2,y=cy-rh/2;
      ctx.lineWidth=13*s;roundRectPath(ctx,x,y,rw,rh,24*s);ctx.stroke();
      ctx.lineWidth=11*s;
      const sx=x+34*s,sy=y+54*s;
      [[0,144],[30,104],[58,126]].forEach(([yy,ww])=>{ctx.beginPath();ctx.moveTo(sx,sy+yy*s);ctx.lineTo(sx+ww*s*progress,sy+yy*s);ctx.stroke();});
      ctx.beginPath();ctx.arc(x+rw-42*s,y+rh/2,20*s*progress,0,Math.PI*2);ctx.fill();
    }else if(stage==='inference'){
      const rw=260*s*progress,rh=148*s*progress,x=cx-rw/2,y=cy-rh/2;
      ctx.lineWidth=13*s;roundRectPath(ctx,x,y,rw,rh,24*s);ctx.stroke();
      ctx.lineWidth=9*s;
      const pts=[[-92,30],[-44,-10],[0,12],[50,-30],[94,-10]];
      ctx.beginPath();
      pts.forEach(([px,py],i)=>{const xx=cx+px*s*progress,yy=cy+py*s*progress;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke();
      pts.forEach(([px,py])=>{ctx.beginPath();ctx.arc(cx+px*s*progress,cy+py*s*progress,11*s,0,Math.PI*2);ctx.fill();});
    }else if(stage==='memory'){
      const rw=250*s*progress,rh=150*s*progress,x=cx-rw/2,y=cy-rh/2;
      ctx.lineWidth=13*s;roundRectPath(ctx,x,y,rw,rh,24*s);ctx.stroke();
      const bw=78*s*progress,bh=58*s*progress;
      roundRectPath(ctx,cx-90*s*progress,cy-20*s*progress,bw,bh,15*s);ctx.fill();
      roundRectPath(ctx,cx+12*s*progress,cy-20*s*progress,bw,bh,15*s);ctx.fill();
      ctx.lineWidth=11*s;ctx.beginPath();ctx.moveTo(cx-82*s*progress,cy+58*s*progress);ctx.lineTo(cx+82*s*progress,cy+58*s*progress);ctx.stroke();
    }else if(stage==='agents'){
      const rw=250*s*progress,rh=154*s*progress,x=cx-rw/2,y=cy-rh/2;
      ctx.lineWidth=13*s;roundRectPath(ctx,x,y,rw,rh,24*s);ctx.stroke();
      const iw=182*s*progress,ih=68*s*progress;
      ctx.lineWidth=10*s;roundRectPath(ctx,cx-iw/2,cy-ih/2,iw,ih,18*s);ctx.stroke();
      ctx.lineWidth=8*s;ctx.beginPath();ctx.moveTo(cx-58*s*progress,cy);ctx.lineTo(cx+58*s*progress,cy);ctx.stroke();
      [-58,0,58].forEach(px=>{ctx.beginPath();ctx.arc(cx+px*s*progress,cy,13*s,0,Math.PI*2);ctx.fill();});
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=.16*progress;
    ctx.strokeStyle='rgba(77,124,255,.9)';
    ctx.lineWidth=1.4;
    ctx.beginPath();ctx.arc(cx,cy,Math.min(160,Math.min(w,h)*.30)*progress,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }

  function draw(now){
    ctx.clearRect(0,0,w,h);
    ctx.globalCompositeOperation='source-over';
    for(const p of particles){
      const a=particleAlpha*p.alpha;
      if(a<=.01)continue;
      const speed=Math.hypot(p.vx,p.vy);
      if(speed>.9){
        const ang=Math.atan2(p.vy,p.vx);
        const len=Math.min(18,2+speed*1.7);
        ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-Math.cos(ang)*len,p.y-Math.sin(ang)*len);
        ctx.lineWidth=Math.max(.45,p.size*.58);ctx.strokeStyle=`rgba(${p.color},${a*.28})`;ctx.stroke();
      }
      ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.color},${a})`;
      ctx.shadowBlur=mode==='singularity'?13:6;
      ctx.shadowColor=`rgba(${p.color},${Math.min(.38,a*.34)})`;
      ctx.fill();
    }
    ctx.shadowBlur=0;

    if(mode==='follow'){
      const progress=followMaskProgress(now);
      drawVoidShape(STAGES[followStageIndex],targetMouse.x,targetMouse.y,progress);
    }
  }

  function frame(now){
    updateState(now);
    physics(now);
    draw(now);
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);

  art.addEventListener('pointerenter',e=>{
    pointerInside=true;
    const r=art.getBoundingClientRect();
    targetMouse.x=prevMouse.x=e.clientX-r.left;
    targetMouse.y=prevMouse.y=e.clientY-r.top;
    wind.x=wind.y=0;
    if(!pointerDown&&mode!=='intro'&&mode!=='explosion'&&performance.now()>interactionLockUntil) enterFollow(performance.now());
  });

  art.addEventListener('pointermove',e=>{
    const r=art.getBoundingClientRect();
    const x=e.clientX-r.left,y=e.clientY-r.top;
    wind.x+=(x-prevMouse.x)*.92;
    wind.y+=(y-prevMouse.y)*.92;
    prevMouse.x=x;prevMouse.y=y;
    targetMouse.x=x;targetMouse.y=y;
    if(pointerInside&&!pointerDown&&mode==='auto'&&performance.now()>interactionLockUntil) enterFollow(performance.now());
  });

  art.addEventListener('pointerleave',()=>{
    pointerInside=false;
    network.style.transform='';
    if(!pointerDown&&mode==='follow') enterAutoFlow(performance.now());
  });

  art.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    const r=art.getBoundingClientRect();
    targetMouse.x=prevMouse.x=e.clientX-r.left;
    targetMouse.y=prevMouse.y=e.clientY-r.top;
    wind.x=wind.y=0;
    art.setPointerCapture(e.pointerId);
    enterSingularity(performance.now());
  });

  art.addEventListener('pointerup',e=>{
    if(!pointerDown)return;
    try{art.releasePointerCapture(e.pointerId)}catch{}
    enterExplosion(performance.now());
  });

  art.addEventListener('pointercancel',()=>{if(pointerDown)enterExplosion(performance.now())});
})();