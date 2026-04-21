/**
 * ========================================
 * ADVANCED BRAINROT WHEEL ENGINE v3.0
 * ========================================
 */

const API_BASE = window.location.origin + '/api/wheel';

let user = null;
let characters = [];
let isSpinning = false;
let currentRotation = 0;

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
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  secret: 'Secret'
};

async function init() {
  initBackground();
  await loadCharacters();
  checkAuth();
  loadRecentSpins();
  loadTopPlayers();
  drawWheel();
  setupEvents();

  // Hide loader with a smooth fade
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 800);
    }
  }, 1500);
}

function initBackground() {
  if (!window.THREE) return;
  const bgCanvas = document.getElementById('bgCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  const group = new THREE.Group();
  scene.add(group);

  const geometry = new THREE.IcosahedronGeometry(2, 1);
  const material = new THREE.MeshPhongMaterial({
    color: 0x8b5cf6,
    wireframe: true,
    transparent: true,
    opacity: 0.2
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);

  const light = new THREE.PointLight(0xffffff, 1, 100);
  light.position.set(10, 10, 10);
  scene.add(light);

  const ambient = new THREE.AmbientLight(0x404040);
  scene.add(ambient);

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function animate() {
    mesh.rotation.x += 0.002;
    mesh.rotation.y += 0.003;
    group.rotation.z += 0.001;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}

async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/characters`);
    if (!res.ok) throw new Error();
    characters = await res.json();
    if (characters.length === 0) throw new Error();
  } catch (e) {
    console.error('Failed to load characters, using fallback');
    characters = generateFallbackChars();
  }
}

function generateFallbackChars() {
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'secret'];
  return Array.from({ length: 150 }, (_, i) => ({
    id: `f-${i}`,
    name: `برينروت #${i}`,
    rarity: rarities[Math.floor(Math.random() * rarities.length)],
    image_url: ''
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
    localStorage.setItem('wheel_user_v2', JSON.stringify(user));
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    const saved = localStorage.getItem('wheel_user_v2');
    if (saved) user = JSON.parse(saved);
  }

  updateUserUI();
  if (user) {
    loadMyCollection();
    loadAnalytics();
    checkCooldown();
  }
}

function updateUserUI() {
  const area = document.getElementById('userArea');
  const centerHint = document.getElementById('centerCountdown');
  if (user) {
    area.innerHTML = `
      <div class="user-profile">
        <img src="${user.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
        <span>${user.tag}</span>
        <button onclick="logout()" style="background:none; border:none; color:#ef4444; font-size:12px; cursor:pointer; font-weight:700; margin-right:10px;">Logout</button>
      </div>
    `;
    centerHint.textContent = 'Ready to Spin';
  } else {
    centerHint.textContent = 'Login to Spin';
  }
}

function logout() {
  localStorage.removeItem('wheel_user_v2');
  location.reload();
}

function setupEvents() {
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    location.href = `${API_BASE}/auth/discord`;
  });
  document.getElementById('spinBtn').onclick = spin;
  document.getElementById('closeModal').onclick = () => {
    document.getElementById('resultModal').classList.remove('active');
  };
}

function drawWheel() {
  const W = canvas.width, H = canvas.height;
  const CX = W/2, CY = H/2;
  const R = Math.min(W,H)/2 - 40;
  const count = characters.length;
  const slice = (Math.PI * 2) / count;

  ctx.clearRect(0,0,W,H);

  // Background glow
  const outerGlow = ctx.createRadialGradient(CX,CY,R*0.8, CX,CY,R+20);
  outerGlow.addColorStop(0, 'rgba(139, 92, 246, 0)');
  outerGlow.addColorStop(1, 'rgba(139, 92, 246, 0.2)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(CX,CY,R+40,0,Math.PI*2);
  ctx.fill();

  for (let i = 0; i < count; i++) {
    const c = characters[i];
    const angle = i * slice;
    const color = rarityColors[c.rarity] || '#94a3b8';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(CX,CY);
    ctx.arc(CX,CY,R,angle,angle + slice);
    ctx.closePath();

    const grad = ctx.createRadialGradient(CX,CY,0, CX,CY,R);
    grad.addColorStop(0, adjustColor(color, -40));
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Labels
    const labelStep = count > 120 ? 6 : count > 80 ? 4 : count > 40 ? 2 : 1;
    if (i % labelStep === 0) {
      ctx.translate(CX,CY);
      ctx.rotate(angle + slice/2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${count > 100 ? '10px' : '14px'} var(--font-main)`;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 4;
      const text = c.name || '';
      ctx.fillText(text.slice(0, 15), R - 30, 5);
    }
    ctx.restore();
  }

  // Ring
  ctx.beginPath();
  ctx.arc(CX,CY,R,0,Math.PI*2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(CX,CY,R - 5,0,Math.PI*2);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function adjustColor(hex, amt) {
  if (!hex.startsWith('#')) return hex;
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amt));
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
  return `rgb(${r},${g},${b})`;
}

async function spin() {
  if (isSpinning) return;
  if (!user) {
    location.href = `${API_BASE}/auth/discord`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/spin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${user.token}` },
      body: JSON.stringify({ discord_id: user.id })
    });

    if (!res.ok) {
      const err = await res.json();
      if (err.error?.includes('cooldown')) {
        alert('يرجى الانتظار! لم يحن موعد الدورة القادمة بعد.');
        return;
      }
      throw new Error();
    }

    const result = await res.json();
    const targetIdx = characters.findIndex(c => c.id === result.character_id);
    if (targetIdx === -1) throw new Error();

    isSpinning = true;
    document.getElementById('spinBtn').disabled = true;

    const count = characters.length;
    const sliceAngle = 360 / count;
    const targetAngle = targetIdx * sliceAngle + sliceAngle/2;
    const rotations = 10 + Math.floor(Math.random() * 5);
    const finalAngle = currentRotation + (rotations * 360) + (360 - (targetAngle % 360)) + (currentRotation % 360);

    animateRotation(finalAngle, () => {
      isSpinning = false;
      document.getElementById('spinBtn').disabled = false;
      currentRotation = finalAngle % 360;
      showResult(result);
      loadRecentSpins();
      loadMyCollection();
      loadAnalytics();
      checkCooldown();
    });

  } catch (e) {
    alert('حدث خطأ في الاتصال بالخادم. حاول لاحقاً.');
    isSpinning = false;
  }
}

function animateRotation(target, callback) {
  const start = performance.now();
  const duration = 8000;
  const initialRotation = currentRotation;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function frame(now) {
    const elapsed = now - start;
    const t = Math.min(elapsed / duration, 1);
    const eased = easeOut(t);
    const current = initialRotation + (target - initialRotation) * eased;
    canvas.style.transform = `rotate(${current}deg)`;

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      callback();
    }
  }
  requestAnimationFrame(frame);
}

function showResult(result) {
  const c = result.character || characters.find(x => x.id === result.character_id) || {};
  const color = rarityColors[c.rarity] || '#fff';

  const imgEl = document.getElementById('resultImage');
  if (c.image_url) imgEl.innerHTML = `<img src="${c.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:20px;">`;
  else imgEl.textContent = '🎁';

  document.getElementById('resultName').textContent = c.name;
  document.getElementById('resultName').style.color = color;
  document.getElementById('resultRarity').textContent = rarityNames[c.rarity] || c.rarity;
  document.getElementById('resultRarity').style.color = color;
  document.getElementById('resultDesc').textContent = 'You won a rare loot from the Brainrot world!';

  document.getElementById('resultModal').classList.add('active');
}

async function loadRecentSpins() {
  try {
    const res = await fetch(`${API_BASE}/recent`);
    const data = await res.json();
    const list = document.getElementById('recentSpins');
    list.innerHTML = data.map(s => `
      <div class="list-entry">
        <div class="entry-icon" style="color:${rarityColors[s.rarity]}">${getEmoji(s.rarity)}</div>
        <div class="entry-info">
          <div class="entry-name">${s.character_name}</div>
          <div class="entry-meta">${rarityNames[s.rarity]} • ${timeAgo(s.spun_at)}</div>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function loadTopPlayers() {
  try {
    const res = await fetch(`${API_BASE}/top`);
    const data = await res.json();
    const list = document.getElementById('topPlayers');
    list.innerHTML = data.map((p, i) => `
      <div class="list-entry">
        <div class="entry-icon" style="background:var(--accent); font-weight:900; font-size:1rem;">${i+1}</div>
        <div class="entry-info">
          <div class="entry-name">${p.discord_tag}</div>
          <div class="entry-meta">${p.total_spins} successful spins</div>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function loadMyCollection() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/collection?discord_id=${user.id}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
    const data = await res.json();
    const grid = document.getElementById('myCollection');
    grid.innerHTML = data.map(c => `
      <div class="coll-box" title="${c.name_ar || c.name}" style="border-color:${rarityColors[c.rarity]}">
        ${getEmoji(c.rarity)}
      </div>
    `).join('');
  } catch {}
}

async function loadAnalytics() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/analytics?discord_id=${user.id}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
    const data = await res.json();
    const area = document.getElementById('analyticsContent');
    area.innerHTML = `
      <div class="stat-line">
        <span class="stat-lbl">Total Spins:</span>
        <span class="stat-val">${data.total_spins}</span>
      </div>
      <div class="stat-line">
        <span class="stat-lbl">Best Rarity:</span>
        <span class="stat-val" style="color:${rarityColors[data.best_rarity]}">${rarityNames[data.best_rarity] || 'None'}</span>
      </div>
    `;
  } catch {}
}

async function checkCooldown() {
  if (!user) return;
  try {
    const res = await fetch(`${API_BASE}/cooldown?discord_id=${user.id}`, { headers: { 'Authorization': `Bearer ${user.token}` } });
    const cd = await res.json();
    if (cd.remaining > 0) {
      document.getElementById('cooldownRow').style.display = 'flex';
      startTimer(cd.remaining);
    }
  } catch {}
}

function startTimer(sec) {
  const el = document.getElementById('countdown');
  const centerEl = document.getElementById('centerCountdown');
  let rem = sec;
  const interval = setInterval(() => {
    rem--;
    if (rem <= 0) {
      clearInterval(interval);
      document.getElementById('cooldownRow').style.display = 'none';
      if(user) centerEl.textContent = 'Ready to Spin';
    }
    const h = Math.floor(rem/3600), m = Math.floor((rem%3600)/60), s = rem%60;
    const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    el.textContent = timeStr;
    centerEl.textContent = `Wait ${timeStr}`;
    document.getElementById('spinBtn').disabled = true;
  }, 1000);
}

function getEmoji(r) {
  return { common:'⚪', uncommon:'🟢', rare:'🔵', epic:'🟣', legendary:'🟡', secret:'🔴' }[r] || '❓';
}

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Now';
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${Math.floor(diff/86400)}d`;
}

init();
