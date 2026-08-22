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
  const orbits=network?[...network.querySelectorAll('.orbit')]:[];
  const dash=network?.querySelector('.dash');
  const pulse=network?.querySelector('.pulse');
  const nodeEls=network?[...network.querySelectorAll('.field-nodes circle, .orbit circle')]:[];
  const fine=art&&network&&canvas&&disp&&noise&&matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches;

  if(fine){
    // Keep the diagram composition stable at rest. Only the dash flow and pulse
    // remain as ambient motion; orbit geometry no longer rotates by itself.
    const stableStyle=document.createElement('style');
    stableStyle.textContent=`
      .network .orbit,.network .orbit.reverse{animation:none!important}
      .network .dash{animation-duration:30s!important}
      .hero-art.snap-back .network,
      .hero-art.snap-back .network .orbit,
      .hero-art.snap-back .network .dash,
      .hero-art.snap-back .network .pulse,
      .hero-art.snap-back .field-nodes circle,
      .hero-art.snap-back .orbit circle{
        transition:transform .15s cubic-bezier(.18,.9,.22,1),opacity .15s ease!important;
      }
    `;
    document.head.appendChild(stableStyle);

    const ctx=canvas.getContext('2d');
    let dpr=1,w=0,h=0;
    let drag=false,rebuilding=false,dragged=false;
    let dragStart=0,dragDistance=0;
    let lastX=0,lastY=0,lastT=performance.now();
    let vortex=0;
    let warp=0,warpTarget=0,freq=.014;
    let suppressClickUntil=0,clickTimer=null;
    const viewBox={w:700,h:580};
    const particles=[];
    const baseNodes=nodeEls.map(el=>({
      el,
      x:parseFloat(el.getAttribute('cx')),
      y:parseFloat(el.getAttribute('cy')),
      r:parseFloat(el.getAttribute('r'))||3
    }));

    const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
    const smoothstep=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};

    function resize(){
      const r=art.getBoundingClientRect();
      dpr=Math.min(devicePixelRatio||1,2);
      w=r.width;h=r.height;
      canvas.width=Math.round(w*dpr);
      canvas.height=Math.round(h*dpr);
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

    function spawn(x,y,dx=0,dy=0,count=4,power=1){
      for(let i=0;i<count;i++){
        const a=Math.random()*Math.PI*2;
        const speed=(.55+Math.random()*2.1)*power;
        particles.push({
          x,y,
          vx:Math.cos(a)*speed+dx*.035,
          vy:Math.sin(a)*speed+dy*.035,
          life:1,
          size:.8+Math.random()*1.8,
          len:5+Math.random()*13+Math.hypot(dx,dy)*.09,
          color:Math.random()>.24?'77,124,255':'132,220,200'
        });
      }
      if(particles.length>300)particles.splice(0,particles.length-300);
    }

    function setNodeTransforms(pointer,energy,dragVec){
      const falloffMax=270;
      baseNodes.forEach(node=>{
        const dx=pointer.sx-node.x,dy=pointer.sy-node.y;
        const dist=Math.hypot(dx,dy)||1;
        const pull=Math.max(0,1-dist/falloffMax);
        const nx=dx/dist,ny=dy/dist;

        // Attraction and swirl are deliberately capped so the diagram deforms
        // rather than exploding into unrelated pieces.
        const attract=energy*54*pull;
        const swirl=energy*30*pull;
        const tx=nx*attract+(-ny)*swirl*dragVec.spin;
        const ty=ny*attract+(nx)*swirl*dragVec.spin;
        const scale=1+pull*energy*.62;

        node.el.style.transform=`translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        node.el.style.opacity=(.8+pull*.2).toFixed(3);
      });

      const orbitRot=dragVec.spin*(3+energy*13);
      if(orbits[0])orbits[0].style.transform=`rotate(${orbitRot.toFixed(2)}deg) scale(${(1+energy*.035).toFixed(3)})`;
      if(orbits[1])orbits[1].style.transform=`rotate(${(-orbitRot*.78).toFixed(2)}deg) scale(${(1-energy*.018).toFixed(3)})`;
      if(dash)dash.style.transform=`translate(${(dragVec.dx*.018).toFixed(2)}px,${(dragVec.dy*.018).toFixed(2)}px) rotate(${(dragVec.spin*2.2).toFixed(2)}deg)`;
      if(pulse)pulse.style.transform=`scale(${(1+energy*.11).toFixed(3)})`;
      if(morph)morph.style.transform=`rotate(${(dragVec.spin*(2.5+energy*5)).toFixed(2)}deg) scale(${(1+energy*.018).toFixed(3)})`;
    }

    function resetTransforms(){
      baseNodes.forEach(node=>{node.el.style.transform='';node.el.style.opacity=''});
      orbits.forEach(el=>el.style.transform='');
      if(dash)dash.style.transform='';
      if(pulse)pulse.style.transform='';
      if(morph)morph.style.transform='';
    }

    function burst(pointer,power=1){spawn(pointer.x,pointer.y,0,0,22,1.8*power)}

    function animate(){
      // Slow interpolation makes the distortion grow visibly instead of
      // jumping straight to the maximum value.
      const rate=drag?.065:.15;
      warp+=(warpTarget-warp)*rate;
      disp.setAttribute('scale',warp.toFixed(2));
      noise.setAttribute('baseFrequency',`${freq.toFixed(4)} ${(freq*1.32).toFixed(4)}`);

      ctx.clearRect(0,0,w,h);
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i],px=p.x,py=p.y;
        p.x+=p.vx;p.y+=p.vy;p.vx*=.986;p.vy*=.986;p.life-=.02;
        if(p.life<=0){particles.splice(i,1);continue}
        const angle=Math.atan2(p.vy,p.vx),len=Math.max(3,p.len*p.life);
        ctx.beginPath();
        ctx.moveTo(px,py);
        ctx.lineTo(px-Math.cos(angle)*len,py-Math.sin(angle)*len);
        ctx.lineWidth=Math.max(.55,p.size*p.life);
        ctx.strokeStyle=`rgba(${p.color},${.7*p.life})`;
        ctx.shadowBlur=8;
        ctx.shadowColor=`rgba(${p.color},.3)`;
        ctx.stroke();
      }
      ctx.shadowBlur=0;
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    art.addEventListener('pointerdown',e=>{
      if(e.button!==0||rebuilding)return;
      drag=true;dragged=false;dragDistance=0;vortex=0;
      dragStart=performance.now();
      art.classList.add('is-dragging');
      art.setPointerCapture(e.pointerId);
      const p=local(e);
      lastX=p.x;lastY=p.y;lastT=dragStart;
      // No immediate collapse. The first ~350 ms is a stable tension phase.
      warpTarget=0;freq=.014;
      spawn(p.x,p.y,0,0,5,.55);
    });

    art.addEventListener('pointermove',e=>{
      const p=local(e),now=performance.now();
      const dt=Math.max(8,now-lastT),dx=p.x-lastX,dy=p.y-lastY;
      const segment=Math.hypot(dx,dy);
      const speed=Math.min(28,segment/dt*66);

      if(drag){
        dragDistance+=segment;
        if(dragDistance>7)dragged=true;

        const held=(now-dragStart)/1000;
        // 0.35 s: almost no distortion.
        // 0.35–1.55 s: clear, gradual ramp.
        // after ~1.55 s: maximum deformation becomes available.
        const timeRamp=smoothstep((held-.35)/1.2);
        const distanceRamp=smoothstep(dragDistance/360);
        const speedRamp=clamp(speed/26,0,1);
        const energy=clamp(timeRamp*(.42+.46*distanceRamp+.12*speedRamp),0,1);

        const rawSpin=(dx*.65-dy*.3)/50;
        vortex=clamp(vortex+rawSpin*.035,-1.05,1.05);

        warpTarget=energy*(42+28*distanceRamp+12*speedRamp);
        freq=.014+energy*.009;
        setNodeTransforms(p,energy,{dx,dy,spin:vortex});

        // Whole-field movement stays restrained. Most of the drama comes from
        // internal deformation, not the entire diagram drifting away.
        network.style.transform=`perspective(1000px) rotateX(${-p.ny*(1.3+energy*1.8)}deg) rotateY(${p.nx*(1.7+energy*2.2)}deg) scale(${(1+energy*.012).toFixed(3)})`;

        if(energy>.08){
          const count=Math.max(1,Math.round((speed/8)*energy));
          spawn(p.x,p.y,dx,dy,count,.7+energy*.9);
        }
      }else{
        // At rest the composition stays put. Pointer-follow is intentionally
        // tiny and never changes individual node positions.
        const tiltX=-p.ny*.7,tiltY=p.nx*.9;
        network.style.transform=`perspective(1000px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translate3d(${(p.nx*1.8).toFixed(2)}px,${(p.ny*1.4).toFixed(2)}px,0)`;
        warpTarget=0;freq=.014;
      }

      lastX=p.x;lastY=p.y;lastT=now;
    });

    function release(e){
      if(!drag)return;
      drag=false;
      suppressClickUntil=performance.now()+220;
      art.classList.remove('is-dragging');
      art.classList.add('snap-back');

      // Fast, decisive restoration on release.
      warp=0;warpTarget=0;freq=.014;
      disp.setAttribute('scale','0');
      resetTransforms();
      network.style.transform='';

      setTimeout(()=>art.classList.remove('snap-back'),170);
      try{art.releasePointerCapture(e.pointerId)}catch{}
    }

    art.addEventListener('pointerup',release);
    art.addEventListener('pointercancel',release);
    art.addEventListener('pointerleave',()=>{
      if(!drag){
        warp=0;warpTarget=0;freq=.014;
        disp.setAttribute('scale','0');
        network.style.transform='';
        resetTransforms();
      }
    });

    art.addEventListener('click',e=>{
      if(rebuilding||performance.now()<suppressClickUntil||dragged)return;
      if(clickTimer)clearTimeout(clickTimer);
      const p=local(e);
      clickTimer=setTimeout(()=>{
        burst(p,1);
        warpTarget=24;
        setTimeout(()=>{if(!drag){warpTarget=0}},170);
      },190);
    });

    art.addEventListener('dblclick',e=>{
      if(rebuilding)return;
      if(clickTimer){clearTimeout(clickTimer);clickTimer=null}
      rebuilding=true;
      art.classList.add('is-rebuilding');
      const p=local(e);
      burst(p,1.45);
      warpTarget=58;freq=.021;

      network.animate([
        {transform:'perspective(1000px) scale(1) rotate(0deg)',opacity:1,filter:'blur(0px)'},
        {offset:.34,transform:'perspective(1000px) scale(.72) rotate(6deg)',opacity:.82,filter:'blur(.4px)'},
        {offset:.58,transform:'perspective(1000px) scale(.24) rotate(14deg)',opacity:.48,filter:'blur(1px)'},
        {offset:.8,transform:'perspective(1000px) scale(1.045) rotate(-4deg)',opacity:1,filter:'blur(0px)'},
        {transform:'perspective(1000px) scale(1) rotate(0deg)',opacity:1,filter:'blur(0px)'}
      ],{duration:1180,easing:'cubic-bezier(.2,.76,.22,1)'});

      setTimeout(()=>{
        resetTransforms();
        warp=0;warpTarget=0;freq=.014;
        disp.setAttribute('scale','0');
        network.style.transform='';
        art.classList.remove('is-rebuilding');
        rebuilding=false;
      },1200);
    });
  }

  apply();
})();
