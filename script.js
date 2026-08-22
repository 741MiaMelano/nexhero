(()=>{
  const btn=document.getElementById('lang');
  const nodes=[...document.querySelectorAll('[data-en]')];
  let lang=localStorage.getItem('nexhero-lang')||((navigator.language||'').toLowerCase().startsWith('zh')?'zh':'en');
  function apply(){document.documentElement.lang=lang==='zh'?'zh-CN':'en';nodes.forEach(el=>el.textContent=el.dataset[lang]);btn.textContent=lang==='zh'?'EN':'中文';btn.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');document.title=lang==='zh'?'NexHero — 独立软件与 AI 实验室':'NexHero — Independent software & AI laboratory';localStorage.setItem('nexhero-lang',lang)}
  btn.addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';apply()});
  const art=document.querySelector('.hero-art'),network=document.querySelector('.network');
  const fine=matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(art&&network&&fine){
    const NS='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(NS,'defs');
    const filter=document.createElementNS(NS,'filter');filter.id='fieldWarp';filter.setAttribute('x','-20%');filter.setAttribute('y','-20%');filter.setAttribute('width','140%');filter.setAttribute('height','140%');
    const turb=document.createElementNS(NS,'feTurbulence');turb.id='fieldNoise';turb.setAttribute('type','fractalNoise');turb.setAttribute('baseFrequency','.012 .018');turb.setAttribute('numOctaves','2');turb.setAttribute('seed','8');turb.setAttribute('result','noise');
    const disp=document.createElementNS(NS,'feDisplacementMap');disp.id='fieldDisplace';disp.setAttribute('in','SourceGraphic');disp.setAttribute('in2','noise');disp.setAttribute('scale','0');disp.setAttribute('xChannelSelector','R');disp.setAttribute('yChannelSelector','G');filter.append(turb,disp);defs.append(filter);network.prepend(defs);
    const morph=document.createElementNS(NS,'g');morph.id='morphLayer';[...network.children].filter(el=>el!==defs).forEach(el=>morph.appendChild(el));morph.setAttribute('filter','url(#fieldWarp)');network.appendChild(morph);
    const canvas=document.createElement('canvas');canvas.className='particle-canvas';canvas.setAttribute('aria-hidden','true');art.prepend(canvas);
    const hint=document.createElement('div');hint.className='interaction-hint';hint.dataset.en='DRAG FIELD · CLICK BURST';hint.dataset.zh='拖拽力场 · 点击爆散';hint.textContent=lang==='zh'?hint.dataset.zh:hint.dataset.en;art.appendChild(hint);nodes.push(hint);
    const ctx=canvas.getContext('2d');let w=0,h=0,dpr=1,drag=false,lastX=0,lastY=0,lastT=performance.now(),warp=0,targetWarp=0,seed=8;const particles=[];
    const resize=()=>{const r=art.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0)};resize();addEventListener('resize',resize,{passive:true});
    const spawn=(x,y,count=1,power=1)=>{for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=(.35+Math.random()*1.6)*power;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,size:1+Math.random()*2.8,hue:Math.random()>.23?'77,124,255':'132,220,200'})}if(particles.length>220)particles.splice(0,particles.length-220)};
    const burst=(x,y)=>spawn(x,y,36,3.2);
    function render(){warp+=(targetWarp-warp)*.11;disp.setAttribute('scale',warp.toFixed(2));ctx.clearRect(0,0,w,h);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.985;p.vy*=.985;p.life-=.018;p.size*=.992;if(p.life<=0){particles.splice(i,1);continue}ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=`rgba(${p.hue},${p.life*.72})`;ctx.shadowBlur=12;ctx.shadowColor=`rgba(${p.hue},.35)`;ctx.fill()}ctx.shadowBlur=0;requestAnimationFrame(render)}requestAnimationFrame(render);
    const local=e=>{const r=art.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,nx:(e.clientX-r.left)/r.width-.5,ny:(e.clientY-r.top)/r.height-.5}};
    art.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag=true;art.classList.add('is-dragging');art.setPointerCapture(e.pointerId);const p=local(e);lastX=p.x;lastY=p.y;lastT=performance.now();targetWarp=18;burst(p.x,p.y);seed=(seed+3)%97;turb.setAttribute('seed',String(seed))});
    art.addEventListener('pointermove',e=>{const p=local(e),now=performance.now(),dt=Math.max(8,now-lastT),dx=p.x-lastX,dy=p.y-lastY,speed=Math.min(28,Math.hypot(dx,dy)/dt*70);network.style.transform=`perspective(900px) rotateX(${-p.ny*7}deg) rotateY(${p.nx*9}deg) translate3d(${p.nx*11}px,${p.ny*8}px,0) scale(${drag?1.025:1.012})`;targetWarp=drag?Math.min(42,17+speed):Math.min(9,2+speed*.18);if(drag)spawn(p.x,p.y,Math.max(1,Math.round(speed/7)),1.2+speed/18);else if(Math.random()<.15)spawn(p.x,p.y,1,.55);lastX=p.x;lastY=p.y;lastT=now});
    const release=e=>{drag=false;art.classList.remove('is-dragging');targetWarp=0;network.style.transform='';try{art.releasePointerCapture(e.pointerId)}catch{}};art.addEventListener('pointerup',release);art.addEventListener('pointercancel',release);art.addEventListener('pointerleave',()=>{if(!drag){targetWarp=0;network.style.transform=''}});art.addEventListener('click',e=>{const p=local(e);burst(p.x,p.y);targetWarp=30;setTimeout(()=>targetWarp=0,180)});
  }
  apply();
})();