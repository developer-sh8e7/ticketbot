/**
 * ========================================
 * PREMIUM BRAINROT ENGINE v5.0 (No Arabic)
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

async function init() {
  await loadCharacters();
  checkAuth();
  loadRecentSpins();
  loadTopPlayers();
  drawWheel();
  setupEvents();

  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 600);
    }
  }, 1000);
}

async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/characters`);
    const data = await res.json();
    // STRICT FILTER: Only use the English 'name' field
    characters = data.map(c => ({
      ...c,
      displayName: c.name.replace(/[^\x00-\x7F]/g, "") || "Unknown Agent"
    }));
    drawWheel();
  } catch (e) { console.error('Data sync failed', e); }
}

function drawWheel() {
  if (!characters.length) return;
  const numSectors = characters.length;
  const arcSize = (Math.PI * 2) / numSectors;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 20;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  characters.forEach((char, i) => {
    const angle = currentRotation + i * arcSize;
    
    // Sector Background
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#0a0a10' : '#050508';
    ctx.fill();
    
    // Inner Glow Line
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, angle, angle + arcSize);
    ctx.strokeStyle = (rarityColors[char.rarity] || '#fff') + '33';
    ctx.lineWidth = 15;
    ctx.stroke();

    // Solid Outer Line
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.strokeStyle = rarityColors[char.rarity] || '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Sector Text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = '900 20px Outfit';
    // Use the displayName which has been scrubbed of Arabic
    ctx.fillText(char.displayName.toUpperCase(), radius - 45, 8);
    ctx.restore();
  });

  // Center Cap
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a15';
  ctx.fill();
  ctx.strokeStyle = varColor('--accent');
  ctx.lineWidth = 3;
  ctx.stroke();
}

function varColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function spin() {
  if (isSpinning) return;
  
  // AUTO-LOGIN: If not logged in, redirect to Discord immediately
  if (!user) {
    window.location.href = '/api/wheel/auth/discord';
    return;
  }
  
  isSpinning = true;
  const spinBtn = document.getElementById('spinBtn');
  spinBtn.disabled = true;

  fetch(`${API_BASE}/spin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ discord_id: user.id, discord_tag: user.name, discord_avatar: user.avatar })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert("Intelligence Report: " + data.error);
      isSpinning = false;
      spinBtn.disabled = false;
      return;
    }

    const winnerIndex = characters.findIndex(c => c.id === data.character_id);
    const numSectors = characters.length;
    const arcSize = (Math.PI * 2) / numSectors;
    
    // Calculate target rotation with momentum
    const rotations = 12 + Math.floor(Math.random() * 5);
    const targetRotation = (Math.PI * 2 * rotations) + (Math.PI * 1.5) - (winnerIndex * arcSize) - (arcSize / 2);
    const startRotation = currentRotation % (Math.PI * 2);
    const startTime = performance.now();
    const duration = 8500; // Slower, more dramatic spin

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Luxurious Ease-Out
      const ease = 1 - Math.pow(1 - progress, 5);
      
      currentRotation = startRotation + (targetRotation - startRotation) * ease;
      drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isSpinning = false;
        // Scrub result name too
        const safeName = data.character.name.replace(/[^\x00-\x7F]/g, "");
        showResult({ ...data.character, name: safeName });
        updateUserUI();
      }
    }
    requestAnimationFrame(animate);
  })
  .catch(() => {
    isSpinning = false;
    spinBtn.disabled = false;
  });
}

function showResult(char) {
  const modal = document.getElementById('resultModal');
  document.getElementById('resultName').innerText = char.name.toUpperCase();
  document.getElementById('resultRarity').innerText = char.rarity;
  document.getElementById('resultRarity').style.color = rarityColors[char.rarity];
  modal.classList.add('active');
}

function checkAuth() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (token) {
    user = {
      token,
      id: params.get('id'),
      name: params.get('name'),
      avatar: params.get('avatar')
    };
    localStorage.setItem('wheel_user', JSON.stringify(user));
    window.history.replaceState({}, document.title, "/wheel/");
  } else {
    const saved = localStorage.getItem('wheel_user');
    if (saved) user = JSON.parse(saved);
  }
  updateUserUI();
}

function updateUserUI() {
  const userArea = document.getElementById('userArea');
  if (user) {
    userArea.innerHTML = `
      <div style="display:flex; align-items:center; gap:15px; background:rgba(255,255,255,0.05); padding:8px 20px; border-radius:50px; border:1px solid var(--border);">
        <img src="${user.avatar}" style="width:34px; height:34px; border-radius:50%; border:2px solid var(--accent);">
        <span style="font-weight:800; font-size:0.9rem; letter-spacing:0.5px;">${user.name}</span>
        <button onclick="logout()" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:0.7rem; font-weight:900; margin-left:10px;">LOGOUT</button>
      </div>
    `;
    fetchCooldown();
    loadMyCollection();
  }
}

async function fetchCooldown() {
  if (!user) return;
  const res = await fetch(`${API_BASE}/cooldown?discord_id=${user.id}`);
  const data = await res.json();
  
  const spinBtn = document.getElementById('spinBtn');
  const centerText = document.getElementById('centerCountdown');
  
  if (data.remaining > 0) {
    spinBtn.disabled = true;
    startCountdown(data.remaining);
  } else {
    spinBtn.disabled = false;
    centerText.innerText = 'READY';
  }
}

let countdownInterval;
function startCountdown(seconds) {
  clearInterval(countdownInterval);
  const row = document.getElementById('cooldownRow');
  const display = document.getElementById('countdown');
  const centerText = document.getElementById('centerCountdown');
  row.style.display = 'block';

  function update() {
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      document.getElementById('spinBtn').disabled = false;
      centerText.innerText = 'READY';
      row.style.display = 'none';
      return;
    }
    const d = Math.floor(seconds / (24*3600));
    const h = Math.floor((seconds % (24*3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const timeStr = `${d}D ${h}H ${m}M ${s}S`;
    display.innerText = timeStr;
    centerText.innerText = `WAIT ${d}D`;
    seconds--;
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

async function loadRecentSpins() {
  const res = await fetch(`${API_BASE}/recent`);
  const data = await res.json();
  const list = document.getElementById('recentSpins');
  list.innerHTML = data.map(s => {
    // Scrub Arabic from recent list
    const safeName = s.character_name.replace(/[^\x00-\x7F]/g, "");
    return `
      <div class="list-entry">
        <i data-lucide="target" style="width:14px; color:#94a3b8;"></i>
        <div style="flex:1;">
          <div class="entry-name">${safeName.toUpperCase()}</div>
          <div class="entry-meta" style="color:${rarityColors[s.rarity]}">${s.rarity.toUpperCase()}</div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

async function loadTopPlayers() {
  const res = await fetch(`${API_BASE}/top`);
  const data = await res.json();
  const list = document.getElementById('topPlayers');
  list.innerHTML = data.map((p, i) => `
    <div class="list-entry">
      <span style="font-weight:900; color:var(--accent); width:25px; font-size:1.1rem;">#${i+1}</span>
      <div style="flex:1; font-weight:800; font-size:0.9rem;">${p.discord_tag}</div>
      <div style="font-size:0.75rem; font-weight:900; opacity:0.6;">${p.total_spins} HEISTS</div>
    </div>
  `).join('');
}

async function loadMyCollection() {
  if (!user) return;
  const res = await fetch(`${API_BASE}/collection?discord_id=${user.id}`);
  const data = await res.json();
  const grid = document.getElementById('myCollection');
  if (!data.length) {
    grid.innerHTML = '<div style="font-size:0.8rem; opacity:0.4; font-weight:900;">NO DATA ACQUIRED</div>';
    return;
  }
  const latest = data[0];
  const safeName = latest.name.replace(/[^\x00-\x7F]/g, "");
  grid.innerHTML = `
    <div class="loot-box" style="border-color:${rarityColors[latest.rarity]}">
      <i data-lucide="database" style="color:${rarityColors[latest.rarity]}"></i>
      <div>
        <div style="font-weight:900; font-size:1rem; letter-spacing:0.5px;">${safeName.toUpperCase()}</div>
        <div style="font-size:0.75rem; font-weight:900; color:${rarityColors[latest.rarity]}">${latest.rarity.toUpperCase()}</div>
      </div>
    </div>
  `;
  lucide.createIcons();
}

function setupEvents() {
  document.getElementById('spinBtn').addEventListener('click', spin);
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('resultModal').classList.remove('active');
  });
}

function logout() {
  localStorage.removeItem('wheel_user');
  location.reload();
}

window.onload = init;
