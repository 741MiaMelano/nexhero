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
  if(!art || !network || !canvas || reduced) return;

  if(hint){
    hint.dataset.en = 'FLOW FIELD · HOLD · RELEASE';
    hint.dataset.zh = '流场 · 按住 · 释放';
    hint.textContent = lang === 'zh' ? hint.dataset.zh : hint.dataset.en;
    langNodes.push(hint);
  }

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: false
  });
  if(!gl){
    network.style.opacity = '1';
    canvas.style.display = 'none';
    return;
  }

  const desktop = matchMedia('(min-width: 900px)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const COUNT = coarse ? 5500 : (desktop ? 18000 : 9000);
  const STAGES = ['core','model','inference','memory','agents'];
  const INTRO_MS = 1600;
  const HIDE_MS = 420;
  const FLOW_MS = 1000;
  const MORPH_MS = 1150;
  const HOLD_MS = 1550;
  const VANISH_MS = 520;
  const REVEAL_MS = 520;
  const STATIC_MS = 1500;
  const HOVER_STAGE_MS = 3400;
  const EXPLOSION_MS = 3000;

  let w = 1, h = 1, dpr = 1;
  let mode = 'intro';
  let autoPhase = 'intro';
  let phaseStart = performance.now();
  const introStart = phaseStart;
  let stage = 0;
  let hoverStage = 0;
  let hoverStageStart = phaseStart;
  let pointerInside = false;
  let pointerDown = false;
  let pulseFrame = false;
  let explosionStart = 0;
  let lastNow = performance.now();
  const mouse = {x:.5,y:.5,lastX:.5,lastY:.5,vx:0,vy:0,lastT:performance.now()};

  network.style.transition = 'opacity .46s ease, transform .28s cubic-bezier(.2,.8,.2,1)';
  network.style.opacity = '1';
  canvas.style.opacity = '0';
  canvas.style.transition = 'opacity .38s ease';

  const updateVS = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aPosition;
  layout(location=1) in vec2 aVelocity;
  layout(location=2) in vec4 aSeed;

  uniform float uTime;
  uniform float uDelta;
  uniform int uMode;
  uniform int uStage;
  uniform float uMorph;
  uniform vec2 uMouse;
  uniform vec2 uMouseVel;
  uniform float uPulse;
  uniform float uAspect;

  out vec2 vPosition;
  out vec2 vVelocity;

  float hash(float n){ return fract(sin(n)*43758.5453123); }

  vec2 flow(vec2 p, float t, vec4 s){
    vec2 q = p - .5;
    q.x *= uAspect;
    float a = sin(q.y*7.0 + t*.55 + s.x*6.283)
            + cos(q.x*5.7 - t*.38 + s.y*4.6)
            + sin((q.x+q.y)*4.1 + t*.27 + s.z*5.1);
    float b = cos(q.x*4.3 + t*.44 + s.w*6.283)
            - sin(q.y*5.4 - t*.32 + s.x*3.9);
    vec2 f = vec2(cos(a+b), sin(a-b));
    f.x /= max(uAspect,.001);
    return f;
  }

  vec2 rectEdge(vec2 c, vec2 b, float t){
    float per = 2.0*(b.x+b.y);
    float d = fract(t)*per;
    vec2 p;
    if(d < b.x) p = vec2(-b.x+d,-b.y);
    else if((d-=b.x) < b.y) p = vec2(b.x,-b.y+d);
    else if((d-=b.y) < b.x) p = vec2(b.x-d,b.y);
    else { d-=b.x; p=vec2(-b.x,b.y-d); }
    p.x /= uAspect;
    return c+p;
  }

  vec2 ring(vec2 c, float r, float t){
    float a=t*6.2831853;
    return c + vec2(cos(a)*r/uAspect, sin(a)*r);
  }

  vec2 segment(vec2 a, vec2 b, float t){ return mix(a,b,fract(t)); }

  vec2 coreTarget(vec4 s){
    vec2 c=vec2(.5,.48);
    float g=s.w;
    if(g<.52){
      float band=floor(s.z*3.0);
      return ring(c,.115+band*.047,fract(s.x+s.y*.73));
    }
    if(g<.78) return rectEdge(c,vec2(.085*uAspect,.085),fract(s.x*1.31+s.y));
    if(g<.90) return rectEdge(c,vec2(.047*uAspect,.047),fract(s.y*1.7+s.z));
    vec2 p=vec2((s.x-.5)*.072,(s.y-.5)*.062);
    return c+p;
  }

  vec2 modelTarget(vec4 s){
    vec2 c=vec2(.5,.49);
    float g=s.w;
    if(g<.46) return rectEdge(c,vec2(.24*uAspect,.145),s.x);
    if(g<.68) return vec2(c.x-.12 + (s.x-.5)*.22/uAspect, c.y-.035 + (s.y-.5)*.018);
    if(g<.82) return vec2(c.x-.145 + (s.x-.5)*.14/uAspect, c.y+.015 + (s.y-.5)*.014);
    if(g<.92) return vec2(c.x-.13 + (s.x-.5)*.18/uAspect, c.y+.058 + (s.y-.5)*.014);
    return ring(vec2(c.x+.145/uAspect,c.y+.018),.025,s.x);
  }

  vec2 inferenceTarget(vec4 s){
    vec2 c=vec2(.5,.49);
    if(s.w<.48) return rectEdge(c,vec2(.24*uAspect,.145),s.x);
    vec2 p0=c+vec2(-.16/uAspect,.055);
    vec2 p1=c+vec2(-.08/uAspect,-.025);
    vec2 p2=c+vec2(0.0,.012);
    vec2 p3=c+vec2(.09/uAspect,-.055);
    vec2 p4=c+vec2(.16/uAspect,-.018);
    float u=fract(s.x*4.0);
    float k=floor(fract(s.y)*4.0);
    if(k<1.0) return segment(p0,p1,u);
    if(k<2.0) return segment(p1,p2,u);
    if(k<3.0) return segment(p2,p3,u);
    return segment(p3,p4,u);
  }

  vec2 memoryTarget(vec4 s){
    vec2 c=vec2(.5,.49);
    float g=s.w;
    if(g<.42) return rectEdge(c,vec2(.24*uAspect,.15),s.x);
    if(g<.69) return rectEdge(c+vec2(-.07/uAspect,.015),vec2(.065*uAspect,.055),s.y);
    if(g<.90) return rectEdge(c+vec2(.08/uAspect,.015),vec2(.065*uAspect,.055),s.z);
    return vec2(c.x+(s.x-.5)*.28/uAspect,c.y+.105+(s.y-.5)*.012);
  }

  vec2 agentsTarget(vec4 s){
    vec2 c=vec2(.5,.49);
    float g=s.w;
    if(g<.44) return rectEdge(c,vec2(.24*uAspect,.15),s.x);
    if(g<.66) return rectEdge(c,vec2(.17*uAspect,.062),s.y);
    if(g<.86){
      float k=floor(s.z*3.0);
      vec2 cc=c+vec2((-0.105+0.105*k)/uAspect,.002);
      return ring(cc,.024,s.x);
    }
    return vec2(c.x+(s.x-.5)*.22/uAspect,c.y+.105+(s.y-.5)*.012);
  }

  vec2 stageTarget(int st, vec4 s){
    if(st==0) return coreTarget(s);
    if(st==1) return modelTarget(s);
    if(st==2) return inferenceTarget(s);
    if(st==3) return memoryTarget(s);
    return agentsTarget(s);
  }

  vec2 edgeRespawn(vec4 s,float t){
    float h=hash(s.x*91.7+s.z*37.2+floor(t*1.7));
    float side=floor(h*4.0);
    float v=hash(s.y*77.3+s.w*51.9+floor(t*2.3));
    if(side<1.0) return vec2(-.02,v);
    if(side<2.0) return vec2(1.02,v);
    if(side<3.0) return vec2(v,-.02);
    return vec2(v,1.02);
  }

  void main(){
    vec2 p=aPosition;
    vec2 v=aVelocity;
    float dt=min(uDelta,2.0);
    vec2 f=flow(p,uTime,aSeed);

    if(uMode==0){
      v += f*.0018*dt;
      v += vec2(.00022,0.0)*dt;
      v *= pow(.982,dt);
    }else if(uMode==1){
      vec2 target=stageTarget(uStage,aSeed);
      vec2 d=target-p;
      v += d*(.030+.055*uMorph)*dt;
      v += f*.00075*dt;
      v *= pow(.87,dt);
    }else if(uMode==2){
      vec2 d=p-uMouse;
      d.x*=uAspect;
      float dist=max(length(d),.01);
      float nearF=exp(-dist*4.7);
      vec2 tangent=vec2(-d.y,d.x)/dist;
      tangent.x/=uAspect;
      v += f*.0024*dt;
      v += uMouseVel*(.040 + .085*nearF)*dt;
      v += tangent*nearF*.0022*dt;
      v *= pow(.972,dt);
    }else if(uMode==3){
      vec2 d=uMouse-p;
      vec2 ad=d; ad.x*=uAspect;
      float dist=max(length(ad),.004);
      vec2 dir=normalize(ad); dir.x/=uAspect;
      vec2 tan=vec2(-dir.y,dir.x); tan.x/=uAspect;
      float force=min(.22,.010/dist);
      v += dir*force*dt + tan*(.006+.012/(1.0+dist*14.0))*dt;
      v *= pow(.935,dt);
      if(dist<.018){ p=edgeRespawn(aSeed,uTime); v=vec2(0.0); }
    }else if(uMode==4){
      if(uPulse>.5){
        vec2 d=p-uMouse; d.x*=uAspect;
        float dist=max(length(d),.015);
        vec2 dir=normalize(d); dir.x/=uAspect;
        vec2 tan=vec2(-dir.y,dir.x); tan.x/=uAspect;
        float s=.018+.040*aSeed.x;
        v=dir*s+tan*(aSeed.y-.5)*.025;
      }else{
        v += f*.0012*dt;
        v *= pow(.987,dt);
      }
    }

    p += v*dt;

    if(uMode==4){
      if(p.x<0.0){p.x=0.0;v.x=abs(v.x)*.72;}
      if(p.x>1.0){p.x=1.0;v.x=-abs(v.x)*.72;}
      if(p.y<0.0){p.y=0.0;v.y=abs(v.y)*.72;}
      if(p.y>1.0){p.y=1.0;v.y=-abs(v.y)*.72;}
    }else{
      if(p.x<-.03)p.x=1.03;
      if(p.x>1.03)p.x=-.03;
      if(p.y<-.03)p.y=1.03;
      if(p.y>1.03)p.y=-.03;
    }

    vPosition=p;
    vVelocity=v;
    gl_Position=vec4(0.0,0.0,0.0,1.0);
  }`;

  const passthroughFS = `#version 300 es
  precision mediump float;
  out vec4 outColor;
  void main(){ outColor=vec4(0.0); }`;

  const renderVS = `#version 300 es
  precision highp float;
  layout(location=0) in vec2 aPosition;
  layout(location=2) in vec4 aSeed;
  uniform float uDpr;
  uniform float uAlpha;
  out vec4 vSeed;
  out vec2 vPos;
  void main(){
    vSeed=aSeed;
    vPos=aPosition;
    gl_Position=vec4(aPosition.x*2.0-1.0,1.0-aPosition.y*2.0,0.0,1.0);
    gl_PointSize=(1.15+aSeed.z*1.9)*uDpr;
  }`;

  const renderFS = `#version 300 es
  precision highp float;
  in vec4 vSeed;
  in vec2 vPos;
  uniform float uAlpha;
  uniform int uMaskOn;
  uniform int uStage;
  uniform vec2 uMouse;
  uniform float uAspect;
  out vec4 outColor;

  float sdSegment(vec2 p, vec2 a, vec2 b){
    vec2 pa=p-a,ba=b-a;
    float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0);
    return length(pa-ba*h);
  }
  float boxBorder(vec2 p, vec2 b){
    vec2 q=abs(p)-b;
    return abs(max(q.x,q.y));
  }
  bool inHole(vec2 uv){
    if(uMaskOn==0) return false;
    vec2 p=uv-uMouse;
    p.x*=uAspect;
    float th=.016;
    if(uStage==0){
      if(abs(length(p)-.145)<th || abs(length(p)-.10)<th*.8) return true;
      if(boxBorder(p,vec2(.075,.075))<th) return true;
      if(abs(p.x)<th*.7 && abs(p.y)<.12) return true;
      if(abs(p.y)<th*.7 && abs(p.x)<.12) return true;
      return false;
    }
    if(uStage==1){
      if(boxBorder(p,vec2(.25,.15))<th) return true;
      if(abs(p.y+.035)<th && p.x>-.16 && p.x<.05) return true;
      if(abs(p.y-.015)<th && p.x>-.16 && p.x<-.03) return true;
      if(abs(p.y-.065)<th && p.x>-.16 && p.x<.0) return true;
      if(abs(length(p-vec2(.15,.02))-.028)<th) return true;
      return false;
    }
    if(uStage==2){
      if(boxBorder(p,vec2(.25,.15))<th) return true;
      vec2 a=vec2(-.16,.055),b=vec2(-.08,-.025),c=vec2(0.0,.012),d=vec2(.09,-.055),e=vec2(.16,-.018);
      if(sdSegment(p,a,b)<th || sdSegment(p,b,c)<th || sdSegment(p,c,d)<th || sdSegment(p,d,e)<th) return true;
      if(length(p-a)<.032 || length(p-b)<.032 || length(p-c)<.032 || length(p-d)<.032 || length(p-e)<.032) return true;
      return false;
    }
    if(uStage==3){
      if(boxBorder(p,vec2(.25,.155))<th) return true;
      if(boxBorder(p-vec2(-.08,.015),vec2(.07,.055))<th) return true;
      if(boxBorder(p-vec2(.08,.015),vec2(.07,.055))<th) return true;
      if(abs(p.y-.11)<th && abs(p.x)<.16) return true;
      return false;
    }
    if(boxBorder(p,vec2(.25,.155))<th) return true;
    if(boxBorder(p,vec2(.17,.065))<th) return true;
    if(abs(p.y)<th && abs(p.x)<.16) return true;
    if(length(p-vec2(-.105,0.0))<.032 || length(p)<.032 || length(p-vec2(.105,0.0))<.032) return true;
    if(abs(p.y-.11)<th && abs(p.x)<.14) return true;
    return false;
  }

  void main(){
    vec2 pc=gl_PointCoord-.5;
    if(dot(pc,pc)>.25) discard;
    if(inHole(vPos)) discard;
    vec3 blue=vec3(.302,.486,1.0);
    vec3 mint=vec3(.518,.863,.784);
    vec3 grey=vec3(.63,.70,.74);
    float k=vSeed.w;
    vec3 col = k<.68 ? blue : (k<.86 ? mint : grey);
    float soft=1.0-smoothstep(.08,.50,length(pc));
    outColor=vec4(col,uAlpha*(.34+vSeed.y*.56)*soft);
  }`;

  function compile(type, src){
    const sh=gl.createShader(type); gl.shaderSource(sh,src); gl.compileShader(sh);
    if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){
      const msg=gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(msg||'shader compile failed');
    }
    return sh;
  }
  function program(vs,fs,tfVaryings){
    const p=gl.createProgram();
    gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));
    gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
    if(tfVaryings) gl.transformFeedbackVaryings(p,tfVaryings,gl.SEPARATE_ATTRIBS);
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)||'program link failed');
    return p;
  }

  let updateProgram, renderProgram;
  try{
    updateProgram=program(updateVS,passthroughFS,['vPosition','vVelocity']);
    renderProgram=program(renderVS,renderFS);
  }catch(err){
    console.warn('NexHero particle engine fallback:',err);
    network.style.opacity='1'; canvas.style.display='none'; return;
  }

  const posData=new Float32Array(COUNT*2);
  const velData=new Float32Array(COUNT*2);
  const seedData=new Float32Array(COUNT*4);
  for(let i=0;i<COUNT;i++){
    posData[i*2]=Math.random(); posData[i*2+1]=Math.random();
    velData[i*2]=(Math.random()-.5)*.002; velData[i*2+1]=(Math.random()-.5)*.002;
    seedData[i*4]=Math.random(); seedData[i*4+1]=Math.random(); seedData[i*4+2]=Math.random(); seedData[i*4+3]=Math.random();
  }

  const makeBuffer=(data,usage)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,usage);return b;};
  const posBuffers=[makeBuffer(posData,gl.DYNAMIC_COPY),makeBuffer(posData,gl.DYNAMIC_COPY)];
  const velBuffers=[makeBuffer(velData,gl.DYNAMIC_COPY),makeBuffer(velData,gl.DYNAMIC_COPY)];
  const seedBuffer=makeBuffer(seedData,gl.STATIC_DRAW);

  const updateVAO=[gl.createVertexArray(),gl.createVertexArray()];
  const renderVAO=[gl.createVertexArray(),gl.createVertexArray()];
  for(let i=0;i<2;i++){
    gl.bindVertexArray(updateVAO[i]);
    gl.bindBuffer(gl.ARRAY_BUFFER,posBuffers[i]); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,velBuffers[i]); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,seedBuffer); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,0,0);

    gl.bindVertexArray(renderVAO[i]);
    gl.bindBuffer(gl.ARRAY_BUFFER,posBuffers[i]); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,seedBuffer); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,4,gl.FLOAT,false,0,0);
  }
  gl.bindVertexArray(null);

  const tf=gl.createTransformFeedback();
  let current=0;

  const UL={};
  ['uTime','uDelta','uMode','uStage','uMorph','uMouse','uMouseVel','uPulse','uAspect'].forEach(n=>UL[n]=gl.getUniformLocation(updateProgram,n));
  const RL={};
  ['uDpr','uAlpha','uMaskOn','uStage','uMouse','uAspect'].forEach(n=>RL[n]=gl.getUniformLocation(renderProgram,n));

  function resize(){
    const r=art.getBoundingClientRect();
    dpr=Math.min(devicePixelRatio||1, coarse?1.35:1.7);
    w=Math.max(1,r.width); h=Math.max(1,r.height);
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    gl.viewport(0,0,canvas.width,canvas.height);
  }
  resize(); addEventListener('resize',resize,{passive:true});

  function setNetwork(v){ network.style.opacity=String(v); }
  function enterAuto(now){ mode='auto'; autoPhase='hide'; phaseStart=now; stage=0; setNetwork(1); canvas.style.opacity='1'; }
  function enterHover(now){ mode='hover'; hoverStage=0; hoverStageStart=now; setNetwork(0); canvas.style.opacity='1'; }
  function enterSingularity(now){ mode='singularity'; pointerDown=true; phaseStart=now; setNetwork(0); canvas.style.opacity='1'; }
  function enterExplosion(now){ mode='explosion'; pointerDown=false; explosionStart=now; pulseFrame=true; setNetwork(0); canvas.style.opacity='1'; }

  function state(now){
    let alpha=1, mask=0, morph=0, gpuMode=0;
    if(mode==='intro'){
      alpha=0; setNetwork(1);
      if(now-introStart>INTRO_MS) pointerInside?enterHover(now):enterAuto(now);
    }else if(mode==='auto'){
      const e=now-phaseStart;
      if(autoPhase==='hide'){
        setNetwork(Math.max(0,1-e/HIDE_MS)); alpha=Math.min(1,e/HIDE_MS);
        if(e>=HIDE_MS){autoPhase='flow';phaseStart=now;setNetwork(0);}
      }else if(autoPhase==='flow'){
        gpuMode=0; alpha=1;
        if(e>=FLOW_MS){autoPhase='morph';phaseStart=now;stage=0;}
      }else if(autoPhase==='morph'){
        gpuMode=1; alpha=1; morph=Math.min(1,e/MORPH_MS);
        if(e>=MORPH_MS){autoPhase='hold';phaseStart=now;}
      }else if(autoPhase==='hold'){
        gpuMode=1; alpha=1; morph=1;
        if(e>=HOLD_MS){
          if(stage<STAGES.length-1){stage++;autoPhase='morph';phaseStart=now;}
          else{autoPhase='vanish';phaseStart=now;}
        }
      }else if(autoPhase==='vanish'){
        gpuMode=0; alpha=Math.max(0,1-e/VANISH_MS); setNetwork(0);
        if(e>=VANISH_MS){autoPhase='reveal';phaseStart=now;}
      }else if(autoPhase==='reveal'){
        alpha=0; setNetwork(Math.min(1,e/REVEAL_MS));
        if(e>=REVEAL_MS){autoPhase='static';phaseStart=now;setNetwork(1);}
      }else{
        alpha=0; setNetwork(1);
        if(e>=STATIC_MS) enterAuto(now);
      }
    }else if(mode==='hover'){
      gpuMode=2; alpha=1; mask=1; setNetwork(0);
      if(now-hoverStageStart>HOVER_STAGE_MS){hoverStage=(hoverStage+1)%STAGES.length;hoverStageStart=now;}
      stage=hoverStage;
    }else if(mode==='singularity'){
      gpuMode=3; alpha=1; setNetwork(0);
    }else if(mode==='explosion'){
      gpuMode=4; alpha=1; setNetwork(0);
      if(now-explosionStart>EXPLOSION_MS) pointerInside?enterHover(now):enterAuto(now);
    }
    return {alpha,mask,morph,gpuMode};
  }

  function updateGPU(now,dt,s){
    const next=1-current;
    gl.useProgram(updateProgram);
    gl.uniform1f(UL.uTime,now*.001);
    gl.uniform1f(UL.uDelta,dt);
    gl.uniform1i(UL.uMode,s.gpuMode);
    gl.uniform1i(UL.uStage,stage);
    gl.uniform1f(UL.uMorph,s.morph);
    gl.uniform2f(UL.uMouse,mouse.x,mouse.y);
    gl.uniform2f(UL.uMouseVel,mouse.vx,mouse.vy);
    gl.uniform1f(UL.uPulse,pulseFrame?1:0);
    gl.uniform1f(UL.uAspect,w/h);
    pulseFrame=false;

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(updateVAO[current]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,posBuffers[next]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,1,velBuffers[next]);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS,0,COUNT);
    gl.endTransformFeedback();
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);
    gl.disable(gl.RASTERIZER_DISCARD);
    current=next;
  }

  function render(s){
    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
    if(s.alpha<=.002) return;
    gl.useProgram(renderProgram);
    gl.uniform1f(RL.uDpr,dpr);
    gl.uniform1f(RL.uAlpha,s.alpha);
    gl.uniform1i(RL.uMaskOn,s.mask);
    gl.uniform1i(RL.uStage,stage);
    gl.uniform2f(RL.uMouse,mouse.x,mouse.y);
    gl.uniform1f(RL.uAspect,w/h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(renderVAO[current]);
    gl.drawArrays(gl.POINTS,0,COUNT);
    gl.bindVertexArray(null);
  }

  function frame(now){
    const dt=Math.min(2,(now-lastNow)/16.6667); lastNow=now;
    const s=state(now);
    updateGPU(now,dt,s);
    render(s);
    mouse.vx*=.78; mouse.vy*=.78;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function updateMouse(e){
    const r=art.getBoundingClientRect();
    const nx=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    const ny=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
    const now=performance.now();
    const dt=Math.max(8,now-mouse.lastT)/16.6667;
    mouse.vx=(nx-mouse.lastX)/dt;
    mouse.vy=(ny-mouse.lastY)/dt;
    mouse.x=nx; mouse.y=ny; mouse.lastX=nx; mouse.lastY=ny; mouse.lastT=now;
  }

  art.addEventListener('pointerenter',e=>{pointerInside=true;updateMouse(e);if(!pointerDown&&mode!=='intro')enterHover(performance.now());});
  art.addEventListener('pointermove',updateMouse,{passive:true});
  art.addEventListener('pointerleave',()=>{pointerInside=false;if(!pointerDown&&mode!=='intro')enterAuto(performance.now());});
  art.addEventListener('pointerdown',e=>{if(e.button!==0)return;updateMouse(e);try{art.setPointerCapture(e.pointerId);}catch{}enterSingularity(performance.now());});
  art.addEventListener('pointerup',e=>{if(!pointerDown)return;updateMouse(e);try{art.releasePointerCapture(e.pointerId);}catch{}enterExplosion(performance.now());});
  art.addEventListener('pointercancel',()=>{if(pointerDown)enterExplosion(performance.now());});
})();
