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

  btn.addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    applyLang();
  });
  applyLang();

  const art = document.getElementById('heroArt');
  const network = document.getElementById('networkField');
  const canvas = document.getElementById('fieldParticles');
  const disp = document.getElementById('fieldDisplace');
  const noise = document.getElementById('fieldNoise');
  const core = document.getElementById('coreSystem');
  const panels = {
    a: document.getElementById('panelA'),
    b: document.getElementById('panelB'),
    c: document.getElementById('panelC'),
    d: document.getElementById('panelD'),
  };
  const morph = document.getElementById('morphLayer');
  const flowLines = [...network.querySelectorAll('.flow-line')];
  const signalDots = [...network.querySelectorAll('.signal-dot')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = art && network && canvas && matchMedia('(pointer:fine)').matches && !reduced;

  if(!fine) return;

  const ctx = canvas.getContext('2d');
  let dpr = 1, w = 0, h = 0;
  let dragging = false;
  let rebuilding = false;
  let pointerInside = false;
  let dragDistance = 0;
  let pressTime = 0;
  let lastX = 0, lastY = 0, lastT = performance.now();
  let warp = 0, warpTarget = 0, freq = 0.009;
  const particles = [];
  const pieces = [
    {el: panels.a, x: -10, y: -8, rx: -2.5, ry: -2.2, scale: .02},
    {el: panels.b, x: 10, y: -6, rx: 2.4, ry: -2.0, scale: .018},
    {el: panels.c, x: -9, y: 8, rx: -2.1, ry: 2.1, scale: .018},
    {el: panels.d, x: 9, y: 9, rx: 2.3, ry: 2.0, scale: .02},
  ];

  function resize(){
    const r = art.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener('resize', resize, {passive:true});

  function local(e){
    const r = art.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    return {
      x, y,
      nx: x / r.width - .5,
      ny: y / r.height - .5,
      sx: x / r.width * 700,
      sy: y / r.height * 580,
    };
  }

  function spawn(x, y, dx = 0, dy = 0, count = 6, power = 1){
    for(let i = 0; i < count; i++){
      const a = Math.random() * Math.PI * 2;
      const speed = (.8 + Math.random() * 2.6) * power;
      particles.push({
        x, y,
        vx: Math.cos(a) * speed + dx * .04,
        vy: Math.sin(a) * speed + dy * .04,
        life: 1,
        size: 1.2 + Math.random() * 2.2,
        len: 6 + Math.random() * 14 + Math.hypot(dx, dy) * .1,
        color: Math.random() > .18 ? '77,124,255' : '132,220,200'
      });
    }
    if(particles.length > 320) particles.splice(0, particles.length - 320);
  }

  function pulseAt(x, y, power = 1){
    spawn(x, y, 0, 0, 18, 1.6 * power);
    if(core){
      core.animate([
        {transform: core.style.transform || 'translate(0px,0px) scale(1)'},
        {transform: `${core.style.transform || 'translate(0px,0px)'} scale(${1.03 + power * .02})`},
        {transform: core.style.transform || 'translate(0px,0px) scale(1)'}
      ], {duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)'});
    }
  }

  function setPieceTransform(piece, nx, ny, energy, dx = 0, dy = 0){
    if(!piece.el) return;
    const idleX = nx * piece.x;
    const idleY = ny * piece.y;
    const dragX = dx * piece.rx * energy * .11;
    const dragY = dy * piece.ry * energy * .11;
    const rotate = (nx * piece.rx + ny * piece.ry) * (1 + energy * 1.6);
    const scale = 1 + energy * piece.scale;
    piece.el.style.transform = `translate(${(idleX + dragX).toFixed(2)}px, ${(idleY + dragY).toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  }

  function applyScene(pointer, energy = 0, dx = 0, dy = 0){
    const nx = pointer.nx;
    const ny = pointer.ny;
    network.style.transform = `perspective(1000px) rotateX(${(-ny * (3.8 + energy * 1.4)).toFixed(2)}deg) rotateY(${(nx * (6.2 + energy * 2.1)).toFixed(2)}deg) translate3d(${(nx * 8 + dx * .02 * energy).toFixed(2)}px, ${(ny * 7 + dy * .02 * energy).toFixed(2)}px, 0)`;
    pieces.forEach(piece => setPieceTransform(piece, nx, ny, energy, dx, dy));

    if(core){
      const coreX = nx * 5 + dx * .018 * energy;
      const coreY = ny * 4 + dy * .018 * energy;
      const rotate = (dx - dy) * .02 * energy;
      const scale = 1 + energy * .055;
      core.style.transform = `translate(${coreX.toFixed(2)}px, ${coreY.toFixed(2)}px) rotate(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    }
    if(morph){
      morph.style.transform = `rotate(${(nx * 1.8 + energy * 1.6).toFixed(2)}deg)`;
    }

    flowLines.forEach((line, idx) => {
      const amp = energy * (idx % 2 === 0 ? 10 : -10);
      line.style.transform = `translate(${(dx * .01 * energy).toFixed(2)}px, ${(dy * .01 * energy).toFixed(2)}px) rotate(${(amp * .18).toFixed(2)}deg)`;
      line.style.opacity = (0.72 + energy * 0.2).toFixed(3);
    });
    signalDots.forEach((dot, idx) => {
      const sway = Math.sin((performance.now() / 260) + idx) * energy * 3;
      dot.style.transform = `translate(${(nx * 3 + sway).toFixed(2)}px, ${(ny * 3 - sway * .5).toFixed(2)}px) scale(${(1 + energy * .22).toFixed(3)})`;
    });
  }

  function resetScene(){
    network.style.transform = '';
    if(core) core.style.transform = '';
    if(morph) morph.style.transform = '';
    pieces.forEach(piece => { if(piece.el) piece.el.style.transform = ''; });
    flowLines.forEach(line => { line.style.transform = ''; line.style.opacity = ''; });
    signalDots.forEach(dot => dot.style.transform = '');
  }

  function currentEnergy(now){
    if(!dragging) return 0;
    const hold = Math.max(0, now - pressTime - 350);
    const timeFactor = Math.min(1, hold / 1200);
    const distanceFactor = Math.min(1, dragDistance / 240);
    return Math.min(1, timeFactor * .68 + distanceFactor * .42);
  }

  function animate(){
    warp += (warpTarget - warp) * .12;
    if(disp) disp.setAttribute('scale', warp.toFixed(2));
    if(noise) noise.setAttribute('baseFrequency', `${freq.toFixed(4)} ${(freq * 1.3).toFixed(4)}`);
    ctx.clearRect(0, 0, w, h);
    for(let i = particles.length - 1; i >= 0; i--){
      const p = particles[i];
      const px = p.x, py = p.y;
      p.x += p.vx; p.y += p.vy;
      p.vx *= .985; p.vy *= .985;
      p.life -= .02;
      if(p.life <= 0){ particles.splice(i, 1); continue; }
      const angle = Math.atan2(p.vy, p.vx);
      const len = Math.max(4, p.len * p.life);
      const tx = px - Math.cos(angle) * len;
      const ty = py - Math.sin(angle) * len;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(tx, ty);
      ctx.lineWidth = Math.max(.6, p.size * p.life);
      ctx.strokeStyle = `rgba(${p.color}, ${.8 * p.life})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${p.color}, .28)`;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);

  art.addEventListener('pointerenter', () => { pointerInside = true; });
  art.addEventListener('pointerleave', () => {
    pointerInside = false;
    if(!dragging && !rebuilding){
      warpTarget = 0;
      freq = .009;
      resetScene();
    }
  });

  art.addEventListener('pointerdown', e => {
    if(e.button !== 0 || rebuilding) return;
    const p = local(e);
    dragging = true;
    dragDistance = 0;
    pressTime = performance.now();
    lastX = p.x; lastY = p.y; lastT = pressTime;
    art.classList.add('is-dragging');
    art.setPointerCapture(e.pointerId);
    warpTarget = 10;
    freq = .0095;
    pulseAt(p.x, p.y, .9);
  });

  art.addEventListener('pointermove', e => {
    const p = local(e);
    const now = performance.now();
    const dx = p.x - lastX;
    const dy = p.y - lastY;
    const dt = Math.max(10, now - lastT);
    const speed = Math.min(46, Math.hypot(dx, dy) / dt * 70);
    if(dragging){
      dragDistance += Math.hypot(dx, dy);
      const energy = currentEnergy(now);
      warpTarget = 8 + energy * 36 + speed * .25;
      freq = .009 + energy * .007;
      applyScene(p, energy, dx, dy);
      if(now - pressTime > 320){
        spawn(p.x, p.y, dx, dy, Math.max(2, Math.round(speed / 10)), .8 + energy * .8);
      }
    } else {
      warpTarget = Math.min(6, speed * .08 + 1.6);
      freq = .009;
      applyScene(p, 0, dx, dy);
      if(Math.random() < .08) spawn(p.x, p.y, dx, dy, 1, .45);
    }
    lastX = p.x; lastY = p.y; lastT = now;
  });

  function release(e){
    if(!dragging) return;
    dragging = false;
    art.classList.remove('is-dragging');
    warpTarget = 0;
    freq = .009;
    resetScene();
    try { art.releasePointerCapture(e.pointerId); } catch {}
  }
  art.addEventListener('pointerup', release);
  art.addEventListener('pointercancel', release);

  art.addEventListener('click', e => {
    if(rebuilding) return;
    const p = local(e);
    pulseAt(p.x, p.y, 1.05);
    warpTarget = Math.max(warpTarget, 18);
    setTimeout(() => { if(!dragging) warpTarget = 0; }, 220);
  });

  art.addEventListener('dblclick', e => {
    if(rebuilding) return;
    rebuilding = true;
    const p = local(e);
    pulseAt(p.x, p.y, 1.25);
    warpTarget = 26;
    freq = .012;

    const targets = [panels.a, panels.b, panels.c, panels.d, core].filter(Boolean);
    targets.forEach((el, idx) => {
      const inward = [
        {x: 48, y: 36},
        {x: -48, y: 38},
        {x: 44, y: -34},
        {x: -44, y: -36},
        {x: 0, y: 0},
      ][idx];
      el.animate([
        {transform: el.style.transform || 'translate(0px,0px) scale(1)', opacity:1},
        {offset:.46, transform: `translate(${inward.x}px, ${inward.y}px) scale(${idx === 4 ? 1.08 : .95})`, opacity:.88},
        {offset:.74, transform: `translate(${(-inward.x * .25).toFixed(1)}px, ${(-inward.y * .25).toFixed(1)}px) scale(${idx === 4 ? 1.03 : 1.01})`, opacity:1},
        {transform: el.style.transform || 'translate(0px,0px) scale(1)', opacity:1}
      ], {duration: 1200, easing:'cubic-bezier(.22,.82,.2,1)'});
    });

    setTimeout(() => {
      rebuilding = false;
      warpTarget = pointerInside ? 0 : 0;
      freq = .009;
      resetScene();
    }, 1220);
  });
})();