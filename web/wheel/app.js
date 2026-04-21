const API_BASE = window.location.origin + '/api/wheel';

let user = null;
let characters = [];
let isSpinning = false;
let currentRotation = 0;

let bg = null;

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
  initBackgroundFx();
  await loadCharacters();
  checkAuth();
  loadRecentSpins();
  loadTopPlayers();
  drawWheel();
  setupEvents();
}

function initBackgroundFx() {
  const bgCanvas = document.getElementById('bgFx');
  if (!bgCanvas || !window.THREE) return;

  const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0, 0, 6.5);

  const geo = new THREE.IcosahedronGeometry(2.4, 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b5cf6,
    emissive: 0x2b0a6a,
    emissiveIntensity: 0.6,
    metalness: 0.75,
    roughness: 0.28,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  const rim = new THREE.PointLight(0xa78bfa, 18, 50);
  rim.position.set(3, 2, 6);
  scene.add(rim);

  const fill = new THREE.PointLight(0xfbbf24, 10, 40);
  fill.position.set(-3, -1.5, 5);
  scene.add(fill);

  const ambient = new THREE.AmbientLight(0x5533aa, 0.7);
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

  let t0 = performance.now();
  function tick(now) {
    const dt = (now - t0) / 1000;
    t0 = now;
    mesh.rotation.x += dt * 0.18;
    mesh.rotation.y += dt * 0.22;
    mesh.rotation.z += dt * 0.08;
    mesh.position.y = Math.sin(now / 1200) * 0.25;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  bg = { renderer, scene, camera, mesh };
}

async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/characters`);
    if (!res.ok) throw new Error();
    characters = await res.json();
  } catch {
    characters = getFallbackCharacters();
  }
}

function getFallbackCharacters() {
  const names = [
    {n:'Brainrot God',r:'common',c:'#94a3b8'},
    {n:'Tung Sahur',r:'common',c:'#94a3b8'},
    {n:'Brr Patapim',r:'common',c:'#94a3b8'},
    {n:'Bombardiro',r:'common',c:'#94a3b8'},
    {n:'Glorb',r:'common',c:'#94a3b8'},
    {n:'Trippi',r:'uncommon',c:'#22c55e'},
    {n:'Drago',r:'uncommon',c:'#22c55e'},
    {n:'Ninja',r:'rare',c:'#3b82f6'},
    {n:'Squalo',r:'rare',c:'#3b82f6'},
    {n:'Drago Gemma',r:'rare',c:'#3b82f6'},
    {n:'Phoenix',r:'epic',c:'#a855f7'},
    {n:'Titan',r:'epic',c:'#a855f7'},
    {n:'Supreme',r:'legendary',c:'#f59e0b'},
    {n:'Dio',r:'legendary',c:'#f59e0b'},
    {n:'Gorbzilla',r:'secret',c:'#ef4444'},
    {n:'Infinity',r:'secret',c:'#ef4444'},
  ];
  return names.map((x,i)=>({
    id:'c'+i, name:x.n, name_ar:x.n, rarity:x.r, rarity_ar:rarityNames[x.r],
    image_url:'', tier:0, weight:1, is_real:true, description:'', color:x.c
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
    <button class="btn-discord" onclick="logout()">خروج</button>
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
  const R = Math.min(W,H)/2 - 16;
  const count = characters.length;
  const slice = (2 * Math.PI) / count;
  const labelStep = Math.max(1, Math.ceil(count / 36));
  const fontSize = count > 120 ? 8 : count > 80 ? 9 : 11;

  ctx.clearRect(0,0,W,H);

  for (let i=0; i<count; i++) {
    const c = characters[i];
    const angle = i * slice;
    const color = rarityColors[c.rarity] || '#94a3b8';

    ctx.beginPath();
    ctx.moveTo(CX,CY);
    ctx.arc(CX,CY,R,angle,angle+slice);
    ctx.closePath();

    const grad = ctx.createRadialGradient(CX,CY,0,CX,CY,R);
    grad.addColorStop(0, adjustColor(color, 40));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(CX,CY);
    ctx.rotate(angle + slice/2);
    if (i % labelStep === 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${fontSize}px Tajawal,sans-serif`;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;

      const raw = String(c.name_ar || c.name || '');
      const maxLen = count > 120 ? 10 : count > 80 ? 12 : 16;
      const label = raw.length > maxLen ? raw.slice(0, maxLen - 1) + '…' : raw;
      ctx.fillText(label, R-20, 4);
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(CX,CY,48,0,Math.PI*2);
  ctx.fillStyle = '#0a0a1a';
  ctx.fill();
  ctx.strokeStyle = 'rgba(139,92,246,0.5)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function adjustColor(hex, amt) {
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

  const cooldownCheck = await fetch(`${API_BASE}/cooldown?discord_id=${user.id}`,{headers:{'Authorization':`Bearer ${user.token}`}});
  if (cooldownCheck.ok) {
    const cd = await cooldownCheck.json();
    if (cd.remaining > 0) {
      alert(`انتظر ${formatTime(cd.remaining)} قبل الدوران التالي!`);
      return;
    }
  }

  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('spinBtn').querySelector('.spin-text').textContent = '...';

  try {
    const res = await fetch(`${API_BASE}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ discord_id: user.id })
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();

    const idx = characters.findIndex(c => c.id === result.character_id);
    const count = characters.length;
    const slice = 360 / count;
    const targetAngle = idx * slice + slice/2;
    const extraSpins = 5 + Math.floor(Math.random()*3);
    const finalRotation = currentRotation + extraSpins * 360 + (360 - targetAngle) + (Math.random()*slice - slice/2);

    await animateSpin(finalRotation);
    currentRotation = finalRotation % 360;

    showResult(result);
    loadRecentSpins();
    loadMyCollection();
    checkCooldown();
  } catch (e) {
    alert('خطأ: ' + e.message);
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
    const duration = 6000;
    const startTime = performance.now();

    function easeOut(t) {
      const c = 1.0 - 0.001;
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = easeOut(t);
      const current = start + diff * eased;
      canvas.style.transform = `rotate(${current}deg)`;

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

  document.getElementById('resultImage').innerHTML =
    c.image_url ? `<img src="${c.image_url}" alt="">` :
    `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color}20;font-size:48px;">${getEmoji(c.rarity)}</div>`;

  document.getElementById('resultName').textContent = c.name_ar || c.name;
  document.getElementById('resultName').style.color = color;

  const rarityEl = document.getElementById('resultRarity');
  rarityEl.textContent = (c.rarity_ar || rarityNames[c.rarity] || c.rarity)?.toUpperCase();
  rarityEl.style.color = color;

  document.getElementById('resultDesc').textContent = c.description || '';
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
  const parts = Array.from({ length: 140 }, () => {
    const angle = (-Math.PI / 2) + (Math.random() * Math.PI) - (Math.PI / 2);
    const speed = 6 + Math.random() * 12;
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 3 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      color: colors[(Math.random() * colors.length) | 0],
      life: 1.2 + Math.random() * 0.8
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

      p.vy += 18 * dt;
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
          <div style="width:36px;height:36px;border-radius:8px;background:${color}20;display:flex;align-items:center;justify-content:center;border:2px solid ${color};">${getEmoji(c.rarity)}</div>
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
        <div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">${i+1}</div>
        <div class="player-info">
          <div class="name">${p.discord_tag || 'مجهول'}</div>
          <div class="rarity">${p.total_spins} دوران</div>
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
        <div class="collection-item" style="border-color:${color};">
          ${c.image_url ? `<img src="${c.image_url}" alt="">` : `<span style="font-size:24px;">${getEmoji(c.rarity)}</span>`}
        </div>`;
    }).join('');
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
    el.textContent = formatTime(remaining);
    if (remaining <= 0) {
      clearInterval(window._cdTimer);
      document.getElementById('cooldownCard').style.display = 'none';
    }
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
