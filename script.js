(()=>{
  const btn=document.getElementById('lang');
  const nodes=[...document.querySelectorAll('[data-en]')];
  let lang=localStorage.getItem('nexhero-lang')||((navigator.language||'').toLowerCase().startsWith('zh')?'zh':'en');
  function apply(){
    document.documentElement.lang=lang==='zh'?'zh-CN':'en';
    nodes.forEach(el=>el.textContent=el.dataset[lang]);
    btn.textContent=lang==='zh'?'EN':'中文';
    btn.setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');
    document.title=lang==='zh'?'NexHero — 独立软件与 AI 实验室':'NexHero — Independent software & AI laboratory';
    localStorage.setItem('nexhero-lang',lang);
  }
  btn.addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';apply()});

  const art=document.querySelector('.hero-art');
  const network=document.querySelector('.network');
  const canvas=document.getElementById('fieldParticles');
  const disp=document.getElementById('fieldDisplace');
  const noise=document.getElementById('fieldNoise');
  const morph=document.getElementById('morphLayer');
  const orbits=[...network.querySelectorAll('.orbit')];
  const dash=network.querySelector('.dash');
  const pulse=network.querySelector('.pulse');
  const nodeEls=[...network.querySelectorAll('.field-nodes circle, .orbit circle')];
  const fine=art&&network&&canvas&&matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(fine){
    const ctx=canvas.getContext('2d');
    let dpr=1,w=0,h=0;
    let drag=false,rebuilding=false;
    let lastX=0,lastY=0,lastT=performance.now();
    let cumulative=0,vortex=0;
    let warp=0,warpTarget=0,freq=.014;
    const viewBox={w:700,h:580};
    const particles=[];
    const baseNodes=nodeEls.map(el=>({el,x:parseFloat(el.getAttribute('cx')),y:parseFloat(el.getAttribute('cy')),r:parseFloat(el.getAttribute('r'))||3}));

    function resize(){
      const r=art.getBoundingClientRect();
      dpr=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
      canvas.style.width=w+'px';canvas.style.height=h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    resize();
    addEventListener('resize',resize,{passive:true});

    function local(e){
      const r=art.getBoundingClientRect();
      const x=e.clientX-r.left,y=e.clientY-r.top;
      return {x,y,nx:x/r.width-.5,ny:y/r.height-.5,sx:x/r.width*viewBox.w,sy:y/r.height*viewBox.h};
    }

    function spawn(x,y,dx=0,dy=0,count=6,power=1){
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2;
        const speed=(.7+Math.random()*2.7)*power;
        particles.push({x,y,vx:Math.cos(a)*speed+dx*.05,vy:Math.sin(a)*speed+dy*.05,life:1,size:1+Math.random()*2.1,len:6+Math.random()*18+Math.hypot(dx,dy)*.12,color:Math.random()>.23?'77,124,255':'132,220,200'});
      }
      if(particles.length>420)particles.splice(0,particles.length-420);
    }

    function setNodeTransforms(pointer,energy,dragVec){
      const falloffMax=290;
      baseNodes.forEach(node=>{
        const dx=pointer.sx-node.x,dy=pointer.sy-node.y;
        const dist=Math.hypot(dx,dy)||1;
        const pull=Math.max(0,1-dist/falloffMax);
        const attract=(18+energy*92)*pull;
        const swirl=(8+energy*70)*pull;
        const nx=dx/dist,ny=dy/dist;
        const tx=nx*attract+(-ny)*swirl*dragVec.spin;
        const ty=ny*attract+(nx)*swirl*dragVec.spin;
        const scale=1+pull*energy*1.2;
        node.el.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        node.el.style.opacity=(.72+pull*.28).toFixed(3);
      });
      const orbitRot=dragVec.spin*(9+energy*38);
      if(orbits[0])orbits[0].style.transform=`rotate(${orbitRot}deg) scale(${(1+energy*.08).toFixed(3)}) translate(${dragVec.dx*.02}px,${dragVec.dy*.02}px)`;
      if(orbits[1])orbits[1].style.transform=`rotate(${-orbitRot*1.35}deg) scale(${(1-energy*.04).toFixed(3)}) translate(${dragVec.dx*-.018}px,${dragVec.dy*.018}px)`;
      if(dash)dash.style.transform=`translate(${dragVec.dx*.03}px,${dragVec.dy*.03}px) rotate(${dragVec.spin*5.5}deg)`;
      if(pulse)pulse.style.transform=`scale(${(1+energy*.18).toFixed(3)})`;
      if(morph)morph.style.transform=`rotate(${dragVec.spin*(6+energy*16)}deg) scale(${(1+energy*.03).toFixed(3)})`;
    }

    function resetTransforms(){
      baseNodes.forEach(node=>{node.el.style.transform='';node.el.style.opacity=''});
      orbits.forEach(el=>el.style.transform='');
      if(dash)dash.style.transform='';
      if(pulse)pulse.style.transform='';
      if(morph)morph.style.transform='';
    }

    function burst(pointer,power=1){spawn(pointer.x,pointer.y,0,0,28,2.2*power)}

    function animate(){
      warp+=(warpTarget-warp)*.12;
      disp.setAttribute('scale',warp.toFixed(2));
      noise.setAttribute('baseFrequency',`${freq.toFixed(4)} ${(freq*1.35).toFixed(4)}`);
      ctx.clearRect(0,0,w,h);
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i],px=p.x,py=p.y;
        p.x+=p.vx;p.y+=p.vy;p.vx*=.986;p.vy*=.986;p.life-=.018;
        if(p.life<=0){particles.splice(i,1);continue}
        const angle=Math.atan2(p.vy,p.vx),len=Math.max(4,p.len*p.life);
        ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(angle)*len,py-Math.sin(angle)*len);
        ctx.lineWidth=Math.max(.6,p.size*p.life);ctx.strokeStyle=`rgba(${p.color},${.78*p.life})`;ctx.shadowBlur=10;ctx.shadowColor=`rgba(${p.color},.35)`;ctx.stroke();
      }
      ctx.shadowBlur=0;requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    art.addEventListener('pointerdown',e=>{
      if(e.button!==0||rebuilding)return;
      drag=true;art.classList.add('is-dragging');art.setPointerCapture(e.pointerId);
      const p=local(e);lastX=p.x;lastY=p.y;lastT=performance.now();cumulative=0;vortex=0;warpTarget=20;freq=.015;burst(p,1.1);
    });

    art.addEventListener('pointermove',e=>{
      const p=local(e),now=performance.now(),dt=Math.max(8,now-lastT),dx=p.x-lastX,dy=p.y-lastY;
      const speed=Math.min(42,Math.hypot(dx,dy)/dt*78);
      const spin=(dx*.8-dy*.35)/36;
      network.style.transform=`perspective(980px) rotateX(${-p.ny*7.5}deg) rotateY(${p.nx*10}deg) translate3d(${p.nx*12}px,${p.ny*10}px,0) scale(${drag?1.03:1.012})`;
      if(drag){
        cumulative=Math.min(520,cumulative+Math.hypot(dx,dy));
        vortex+=spin;
        const energy=Math.min(1,cumulative/280+speed/58);
        warpTarget=Math.min(105,18+energy*86+speed*1.8);
        freq=.014+energy*.016;
        setNodeTransforms(p,energy,{dx,dy,spin:vortex});
        spawn(p.x,p.y,dx,dy,Math.max(3,Math.round(speed/5)),1.2+energy*1.6);
      }else{
        warpTarget=Math.min(10,2+speed*.18);freq=.0145;
        if(Math.random()<.18)spawn(p.x,p.y,dx,dy,1,.55);
      }
      lastX=p.x;lastY=p.y;lastT=now;
    });

    function release(e){
      if(!drag)return;
      drag=false;art.classList.remove('is-dragging');warpTarget=0;freq=.014;resetTransforms();network.style.transform='';
      try{art.releasePointerCapture(e.pointerId)}catch{}
    }
    art.addEventListener('pointerup',release);
    art.addEventListener('pointercancel',release);
    art.addEventListener('pointerleave',()=>{if(!drag){warpTarget=0;network.style.transform='';resetTransforms()}});

    art.addEventListener('click',e=>{
      if(rebuilding)return;
      const p=local(e);burst(p,1.25);warpTarget=Math.max(warpTarget,46);setTimeout(()=>{if(!drag)warpTarget=0},180);
    });

    art.addEventListener('dblclick',e=>{
      if(rebuilding)return;
      rebuilding=true;art.classList.add('is-rebuilding');const p=local(e);burst(p,1.8);warpTarget=120;freq=.026;
      network.animate([
        {transform:'perspective(980px) scale(1) rotate(0deg)',opacity:1,filter:'blur(0px)'},
        {offset:.42,transform:'perspective(980px) scale(.14) rotate(26deg)',opacity:.35,filter:'blur(1.6px)'},
        {offset:.72,transform:'perspective(980px) scale(1.08) rotate(-10deg)',opacity:1,filter:'blur(0px)'},
        {transform:'perspective(980px) scale(1) rotate(0deg)',opacity:1,filter:'blur(0px)'}
      ],{duration:920,easing:'cubic-bezier(.22,.84,.24,1)'});
      setTimeout(()=>{resetTransforms();warpTarget=0;freq=.014;network.style.transform='';art.classList.remove('is-rebuilding');rebuilding=false},930);
    });
  }
  apply();
})();
