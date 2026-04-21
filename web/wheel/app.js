const API_BASE = window.location.origin + '/api/wheel';

let user = null;
let characters = [];
let isSpinning = false;
let currentRotation = 0;

let bg = null;
let audioCtx = null;
let particles = [];
let particleCanvas = null;
let particleCtx = null;

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');

const rarityColors = {
  common: '#94a3b8',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
  secret: '#ef4444'
};

const rarityNames = {
  common: 'عادي',
  uncommon: 'غير شائع',
  rare: 'نادر',
  epic: 'ملحمي',
  legendary: 'أسطوري',
  secret: 'سري'
};

async function init() {
  initAudio();
  initParticles();
  initBackgroundFx();
  await loadCharacters();
  checkAuth();
  loadRecentSpins();
  loadTopPlayers();
  loadAchievements();
  loadAnalytics();
  drawWheel();
  setupEvents();
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) loader.style.opacity = '0';
    setTimeout(() => { if(loader) loader.remove(); }, 500);
  }, 1000);
}

function initParticles() {
  particleCanvas = document.createElement('canvas');
  particleCanvas.className = 'particle-canvas';
  particleCanvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2;';
  document.body.appendChild(particleCanvas);
  particleCtx = particleCanvas.getContext('2d');

  function resize() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  requestAnimationFrame(updateParticles);
}

function updateParticles() {
  particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= 0.02;
    p.rotation += p.vr;

    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }

    particleCtx.save();
    particleCtx.translate(p.x, p.y);
    particleCtx.rotate(p.rotation);
    particleCtx.fillStyle = p.color;
    particleCtx.globalAlpha = p.life;
    particleCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    particleCtx.restore();
  }

  requestAnimationFrame(updateParticles);
}

function emitParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 8,
      life: 1,
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
      color
    });
  }
}

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTickSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.frequency.setValueAtTime(800 + Math.random() * 200, audioCtx.currentTime);
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.05);
}

function playWinSound(rarity) {
  if (!audioCtx) return;
  const baseFreq = rarity === 'legendary' ? 880 : rarity === 'epic' ? 659 : rarity === 'rare' ? 523 : 440;
  const duration = rarity === 'legendary' ? 0.6 : rarity === 'epic' ? 0.5 : 0.3;
  
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), audioCtx.currentTime + i * 0.1);
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + duration);
    osc.start(audioCtx.currentTime + i * 0.1);
    osc.stop(audioCtx.currentTime + i * 0.1 + duration);
  }
}

function initBackgroundFx() {
  const bgCanvas = document.getElementById('bgFx');
  if (!bgCanvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // Create a floating brainrot-themed geometry
  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.TorusKnotGeometry(2, 0.6, 100, 16);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x8b5cf6,
    metalness: 0.9,
    roughness: 0.1,
    transmission: 0.5,
    thickness: 1,
    envMapIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.1
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  // Add floating particles
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);
  for(let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 20;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0x8b5cf6, size: 0.1, transparent: true, opacity: 0.5 });
  const points = new THREE.Points(particleGeo, particleMat);
  scene.add(points);

  const light1 = new THREE.PointLight(0x8b5cf6, 20, 100);
  light1.position.set(5, 5, 5);
  scene.add(light1);

  const light2 = new THREE.PointLight(0xec4899, 20, 100);
  light2.position.set(-5, -5, 5);
  scene.add(light2);

  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  }

  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  function animate() {
    t += 0.01;
    mesh.rotation.x += 0.005;
    mesh.rotation.y += 0.007;
    group.position.y = Math.sin(t) * 0.5;
    points.rotation.y += 0.001;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

  bg = { renderer, scene, camera, mesh };
}

async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/characters`);
    if (!res.ok) throw new Error();
    characters = await res.json();
    // Ensure Gorbzilla and others are present
    if (characters.length < 50) characters = getFallbackCharacters();
  } catch {
    characters = getFallbackCharacters();
  }
}

function getFallbackCharacters() {
  const names = [
    {n:'Gorbzilla',r:'secret',c:'#ef4444'},
    {n:'Eternal Dragon',r:'secret',c:'#ef4444'},
    {n:'Brainrot Cannon',r:'secret',c:'#ef4444'},
    {n:'Tung Omega',r:'legendary',c:'#f59e0b'},
    {n:'Brr Patapim Primordial',r:'legendary',c:'#f59e0b'},
    {n:'Supreme Sniper',r:'legendary',c:'#f59e0b'},
    {n:'Epic Phoenix',r:'epic',c:'#a855f7'},
    {n:'Titan Vapore',r:'epic',c:'#a855f7'},
    {n:'Rare Ninja',r:'rare',c:'#3b82f6'},
    {n:'Uncommon Trippi',r:'uncommon',c:'#22c55e'},
    {n:'Common Potato',r:'common',c:'#94a3b8'},
  ];
  // Fill to 150
  while(names.length < 150) {
    names.push({n:'Character ' + names.length, r:'common', c:'#94a3b8'});
  }
  return names.map((x,i)=>({
    id:'c'+i, name:x.n, name_ar:x.n, rarity:x.r, rarity_ar:rarityNames[x.r] || 'عادي',
    image_url:'', tier:x.r === 'secret' ? 6 : x.r === 'legendary' ? 5 : 1, weight: x.r === 'secret' ? 0 : 1, is_real:true, description:''
  }));
}

function checkAuth() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const name = params.get('name');
  const avatar = params.get('avatar');
  const id = params.get('id');

  if (token && id) {
    user = { id, tag: name, avatar_url: avatar, token };
    localStorage.setItem('wheel_user', JSON.stringify(user));
    window.history.replaceState({}, '', window.location.pathname);
    showUser();
    loadMyCollection();
    checkCooldown();
  } else {
    const saved = localStorage.getItem('wheel_user');
    if (saved) {
      user = JSON.parse(saved);
      showUser();
      loadMyCollection();
      checkCooldown();
    } else {
      document.getElementById('loginModal').classList.add('active');
    }
  }
}

function showUser() {
  document.getElementById('userBar').innerHTML = `
    <div class="user-chip">
      <img src="${user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
      <span>${user.tag}</span>
    </div>
    <button class="btn-discord" onclick="logout()" style="margin-right:1rem; background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2);">
      خروج
    </button>
  `;
}

function logout() {
  localStorage.removeItem('wheel_user');
  user = null;
  location.reload();
}

function setupEvents() {
  document.getElementById('loginBtn').onclick = () => {
    location.href = `${API_BASE}/auth/discord`;
  };
  document.getElementById('modalLoginBtn').onclick = () => {
    location.href = `${API_BASE}/auth/discord`;
  };
  document.getElementById('guestBtn').onclick = () => {
    document.getElementById('loginModal').classList.remove('active');
  };
  document.getElementById('spinBtn').onclick = spinWheel;
  document.getElementById('closeModal').onclick = () => {
    document.getElementById('resultModal').classList.remove('active');
  };
}

function drawWheel() {
  const W = canvas.width;
  const H = canvas.height;
  const CX = W/2, CY = H/2;
  const R = Math.min(W,H)/2 - 20;
  const count = characters.length;
  const slice = (2 * Math.PI) / count;
  
  ctx.clearRect(0,0,W,H);
  
  // Shadow
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  for (let i=0; i<count; i++) {
    const c = characters[i];
    const angle = i * slice;
    const color = rarityColors[c.rarity] || '#94a3b8';

    ctx.beginPath();
    ctx.moveTo(CX,CY);
    ctx.arc(CX,CY,R,angle,angle+slice);
    ctx.closePath();

    const grad = ctx.createRadialGradient(CX,CY,0,CX,CY,R);
    grad.addColorStop(0, adjustColor(color, -20));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Border for slice
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Labels (only every few if too many)
    const labelStep = count > 100 ? 5 : count > 50 ? 2 : 1;
    if (i % labelStep === 0) {
      ctx.save();
      ctx.translate(CX,CY);
      ctx.rotate(angle + slice/2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      const fontSize = count > 120 ? 8 : count > 80 ? 10 : 12;
      ctx.font = `bold ${fontSize}px Tajawal, sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      
      const raw = String(c.name_ar || c.name || '');
      const maxLen = count > 120 ? 8 : 12;
      const label = raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw;
      ctx.fillText(label, R - 25, 4);
      ctx.restore();
    }
  }

  // Outer rim
  ctx.beginPath();
  ctx.arc(CX,CY,R,0,Math.PI*2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 8;
  ctx.stroke();
  
  // Inner circle
  ctx.beginPath();
  ctx.arc(CX,CY,50,0,Math.PI*2);
  ctx.fillStyle = '#111';
  ctx.fill();
  ctx.strokeStyle = varColor('--accent');
  ctx.lineWidth = 4;
  ctx.stroke();
}

function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function adjustColor(hex, amt) {
  if(!hex.startsWith('#')) return hex;
  const num = parseInt(hex.replace('#',''),16);
  const r = Math.min(255, Math.max(0, (num>>16)+amt));
  const g = Math.min(255, Math.max(0, ((num>>8)&0x00FF)+amt));
  const b = Math.min(255, Math.max(0, (num&0x0000FF)+amt));
  return `rgb(${r},${g},${b})`;
}

async function spinWheel() {
  if (isSpinning) return;
  if (!user) {
    document.getElementById('loginModal').classList.add('active');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ discord_id: user.id })
    });
    
    if (res.status === 403 || res.status === 400) {
      const err = await res.json();
      if(err.error?.includes('cooldown')) {
        alert('تحتاج للانتظار 3 أيام بين كل دورة!');
        return;
      }
    }
    
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('spinBtn').querySelector('.spin-text').textContent = '...';

    const idx = characters.findIndex(c => c.id === result.character_id);
    const count = characters.length;
    const slice = 360 / count;
    const targetAngle = idx * slice + slice/2;
    const extraSpins = 8 + Math.floor(Math.random()*4);
    const finalRotation = currentRotation + extraSpins * 360 + (360 - targetAngle) + (Math.random()*slice - slice/2);

    await animateSpin(finalRotation);
    currentRotation = finalRotation % 360;

    showResult(result);
    loadRecentSpins();
    loadMyCollection();
    loadAchievements();
    loadAnalytics();
    checkCooldown();
  } catch (e) {
    alert('خطأ في الاتصال أو الخادم. حاول مرة أخرى.');
    console.error(e);
  } finally {
    isSpinning = false;
    document.getElementById('spinBtn').disabled = false;
    document.getElementById('spinBtn').querySelector('.spin-text').textContent = 'دُرْ!';
  }
}

function animateSpin(targetRotation) {
  return new Promise(resolve => {
    const start = currentRotation;
    const diff = targetRotation - start;
    const duration = 8000;
    const startTime = performance.now();
    let lastTick = 0;

    function easeOut(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOut(t);
      const current = start + diff * eased;
      canvas.style.transform = `rotate(${current}deg)`;

      const tickStep = 360 / characters.length;
      if (Math.floor(current / tickStep) !== Math.floor(lastTick / tickStep)) {
        playTickSound();
        lastTick = current;
      }

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function showResult(result) {
  const c = result.character || characters.find(x => x.id === result.character_id) || {};
  const color = rarityColors[c.rarity] || '#94a3b8';
  playWinSound(c.rarity);

  document.getElementById('resultImage').innerHTML =
    c.image_url ? `<img src="${c.image_url}" alt="">` :
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color}20;font-size:64px;">${getEmoji(c.rarity)}</div>`;

  document.getElementById('resultName').textContent = c.name_ar || c.name;
  document.getElementById('resultName').style.color = color;

  const rarityEl = document.getElementById('resultRarity');
  rarityEl.textContent = (c.rarity_ar || rarityNames[c.rarity] || c.rarity)?.toUpperCase();
  rarityEl.style.color = color;

  document.getElementById('resultDesc').textContent = c.description || 'شخصية نادرة جداً من عالم برينروت!';
  document.getElementById('resultModal').classList.add('active');

  confettiBurst(color);
}

function confettiBurst(mainColor) {
  const canvas = document.getElementById('confetti');
  if (!canvas) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.display = 'block';

  const cctx = canvas.getContext('2d');
  cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const colors = [mainColor, '#a78bfa', '#fbbf24', '#22c55e', '#3b82f6', '#ef4444'];
  const parts = Array.from({ length: 150 }, () => {
    const angle = (-Math.PI / 2) + (Math.random() * Math.PI) - (Math.PI / 2);
    const speed = 8 + Math.random() * 15;
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 4 + Math.random() * 8,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.5,
      color: colors[(Math.random() * colors.length) | 0],
      life: 1.5 + Math.random() * 1.0
    };
  });

  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    cctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;

      p.vy += 20 * dt;
      p.x += p.vx * 60 * dt;
      p.y += p.vy * 60 * dt;
      p.rot += p.vr;
      p.life -= dt;

      cctx.save();
      cctx.translate(p.x, p.y);
      cctx.rotate(p.rot);
      cctx.fillStyle = p.color;
      cctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      cctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      cctx.restore();
    }

    if (alive > 0) {
      requestAnimationFrame(step);
    } else {
      canvas.style.display = 'none';
    }
  }

  requestAnimationFrame(step);
}

function getEmoji(rarity) {
  return { common:'⚪', uncommon:'🟢', rare:'🔵', epic:'🟣', legendary:'🟡', secret:'🔴' }[rarity] || '⚪';
}

async function loadRecentSpins() {
  try {
    const res = await fetch(`${API_BASE}/recent`);
    if (!res.ok) return;
    const data = await res.json();
    const list = document.getElementById('recentSpins');
    if (!data.length) { list.innerHTML = '<p class="empty">لا توجد نتائج بعد</p>'; return; }

    list.innerHTML = data.map(s => {
      const c = s.character || {};
      const color = rarityColors[c.rarity] || '#94a3b8';
      return `
        <div class="spin-item">
          <div style="width:40px;height:40px;border-radius:10px;background:${color}20;display:flex;align-items:center;justify-content:center;border:2px solid ${color}; font-size:20px;">
            ${getEmoji(c.rarity)}
          </div>
          <div class="spin-info">
            <div class="name">${c.name_ar || c.name || '?'}</div>
            <div class="rarity" style="color:${color}">${c.rarity_ar || rarityNames[c.rarity] || c.rarity}</div>
          </div>
          <div class="spin-time">${timeAgo(s.spun_at)}</div>
        </div>`;
    }).join('');
  } catch {}
}

async function loadTopPlayers() {
  try {
    const res = await fetch(`${API_BASE}/top`);
    if (!res.ok) return;
    const data = await res.json();
    const list = document.getElementById('topPlayers');
    if (!data.length) { list.innerHTML = '<p class="empty">لا يوجد لاعبين بعد</p>'; return; }

    list.innerHTML = data.map((p,i) => `
      <div class="player-item">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:#fff;border:2px solid rgba(255,255,255,0.2);">
          ${i+1}
        </div>
        <div class="player-info">
          <div class="name">${p.discord_tag || 'مجهول'}</div>
          <div class="rarity">${p.total_spins} دورة</div>
        </div>
      </div>`).join('');
  } catch {}
}

async function loadMyCollection() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/collection?discord_id=${user.id}`,{headers:{'Authorization':`Bearer ${user.token}`}});
    if (!res.ok) return;
    const data = await res.json();
    const grid = document.getElementById('myCollection');
    if (!data.length) { grid.innerHTML = '<p class="empty">لم تدُر العجلة بعد</p>'; return; }

    grid.innerHTML = data.map(c => {
      const color = rarityColors[c.rarity] || '#94a3b8';
      return `
        <div class="collection-item" style="border-color:${color}; box-shadow: 0 0 10px ${color}40;">
          ${c.image_url ? `<img src="${c.image_url}" alt="">` : `<span style="font-size:28px;">${getEmoji(c.rarity)}</span>`}
        </div>`;
    }).join('');
  } catch {}
}

async function loadAchievements() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/achievements?discord_id=${user.id}`,{headers:{'Authorization':`Bearer ${user.token}`}});
    if (!res.ok) return;
    const data = await res.json();
    const grid = document.getElementById('achievementsGrid');
    if (!data.length) { grid.innerHTML = '<p class="empty">لا توجد إنجازات بعد</p>'; return; }

    grid.innerHTML = data.map(a => `
      <div class="achievement-item ${a.unlocked ? 'unlocked' : 'locked'}">
        <div class="achievement-icon">${a.icon || '🏆'}</div>
        <div class="achievement-info">
          <div class="achievement-name">${a.name_ar || a.name}</div>
          <div class="achievement-desc">${a.description || ''}</div>
        </div>
        <div class="achievement-xp">+${a.reward_xp} XP</div>
      </div>
    `).join('');
  } catch {}
}

async function loadAnalytics() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/analytics?discord_id=${user.id}`,{headers:{'Authorization':`Bearer ${user.token}`}});
    if (!res.ok) return;
    const data = await res.json();
    const content = document.getElementById('analyticsContent');

    const rarityAr = { common:'عادي', uncommon:'غير شائع', rare:'نادر', epic:'ملحمي', legendary:'أسطوري', secret:'سري' };
    const total = data.total_spins || 0;

    let html = `
      <div class="stat-row">
        <span class="stat-label">إجمالي الدورات</span>
        <span class="stat-value">${total}</span>
      </div>
    `;

    for (const [rarity, count] of Object.entries(data.rarity_distribution || {})) {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      html += `
        <div style="margin-top:0.5rem;">
          <div class="stat-row" style="border:none;padding:4px 0;">
            <span class="stat-label">${rarityAr[rarity] || rarity}</span>
            <span class="stat-value">${count} (${pct}%)</span>
          </div>
          <div class="rarity-bar">
            <div class="rarity-fill ${rarity}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }

    content.innerHTML = html;
  } catch {}
}

async function checkCooldown() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/cooldown?discord_id=${user.id}`,{headers:{'Authorization':`Bearer ${user.token}`}});
    if (!res.ok) return;
    const cd = await res.json();
    const card = document.getElementById('cooldownCard');
    if (cd.remaining > 0) {
      card.style.display = 'block';
      startCountdown(cd.remaining);
    } else {
      card.style.display = 'none';
    }
  } catch {}
}

function startCountdown(seconds) {
  const el = document.getElementById('countdown');
  let remaining = seconds;
  clearInterval(window._cdTimer);
  window._cdTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(window._cdTimer);
      document.getElementById('cooldownCard').style.display = 'none';
      return;
    }
    el.textContent = formatTime(remaining);
  }, 1000);
}

function formatTime(s) {
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff/60)} د`;
  if (diff < 86400) return `${Math.floor(diff/3600)} س`;
  return `${Math.floor(diff/86400)} ي`;
}

init();
