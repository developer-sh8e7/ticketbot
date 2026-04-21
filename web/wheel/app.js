/**
 * ========================================
 * ULTRA-LIGHT BRAINROT ENGINE v4.0
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

  // Hide loader
  setTimeout(() => {
    const loader = document.getElementById('loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }, 800);
}

async function loadCharacters() {
  try {
    const res = await fetch(`${API_BASE}/characters`);
    characters = await res.json();
    drawWheel();
  } catch (e) { console.error('Failed to load characters', e); }
}

function drawWheel() {
  if (!characters.length) return;
  const numSectors = characters.length;
  const arcSize = (Math.PI * 2) / numSectors;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = canvas.width / 2 - 10;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  characters.forEach((char, i) => {
    const angle = currentRotation + i * arcSize;
    
    // Draw Sector
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#111' : '#0a0a0a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw Accent Line
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, angle, angle + arcSize);
    ctx.strokeStyle = rarityColors[char.rarity] || '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw Text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + arcSize / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Inter';
    ctx.fillText(char.name, radius - 40, 6);
    ctx.restore();
  });
}

function spin() {
  if (isSpinning || !user) return;
  
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
      alert(data.error);
      isSpinning = false;
      spinBtn.disabled = false;
      return;
    }

    const winnerIndex = characters.findIndex(c => c.id === data.character_id);
    const numSectors = characters.length;
    const arcSize = (Math.PI * 2) / numSectors;
    
    const targetRotation = (Math.PI * 2 * 10) + (Math.PI * 1.5) - (winnerIndex * arcSize) - (arcSize / 2);
    const startRotation = currentRotation % (Math.PI * 2);
    const startTime = performance.now();
    const duration = 7000; // 7 seconds for premium feel

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Custom easeOutQuart for smooth stopping
      const ease = 1 - Math.pow(1 - progress, 4);
      
      currentRotation = startRotation + (targetRotation - startRotation) * ease;
      drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        isSpinning = false;
        showResult(data.character);
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
  document.getElementById('resultName').innerText = char.name;
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
      <div style="display:flex; align-items:center; gap:12px;">
        <img src="${user.avatar}" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--accent);">
        <span style="font-weight:600; font-size:0.9rem;">${user.name}</span>
        <button onclick="logout()" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:0.8rem;">Logout</button>
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
      return;
    }
    const d = Math.floor(seconds / (24*3600));
    const h = Math.floor((seconds % (24*3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const timeStr = `${d}d ${h}h ${m}m ${s}s`;
    display.innerText = timeStr;
    centerText.innerText = `Wait ${d}d`;
    seconds--;
  }
  update();
  countdownInterval = setInterval(update, 1000);
}

async function loadRecentSpins() {
  const res = await fetch(`${API_BASE}/recent`);
  const data = await res.json();
  const list = document.getElementById('recentSpins');
  list.innerHTML = data.map(s => `
    <div class="list-entry">
      <i data-lucide="user" style="width:14px; color:#94a3b8;"></i>
      <div style="flex:1;">
        <div style="font-weight:600;">${s.character_name}</div>
        <div style="font-size:0.7rem; color:${rarityColors[s.rarity]}">${s.rarity.toUpperCase()}</div>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function loadTopPlayers() {
  const res = await fetch(`${API_BASE}/top`);
  const data = await res.json();
  const list = document.getElementById('topPlayers');
  list.innerHTML = data.map((p, i) => `
    <div class="list-entry">
      <span style="font-weight:800; color:var(--accent); width:20px;">${i+1}</span>
      <div style="flex:1; font-weight:600;">${p.discord_tag}</div>
      <div style="font-size:0.75rem; opacity:0.6;">${p.total_spins} spins</div>
    </div>
  `).join('');
}

async function loadMyCollection() {
  if (!user) return;
  const res = await fetch(`${API_BASE}/collection?discord_id=${user.id}`);
  const data = await res.json();
  const grid = document.getElementById('myCollection');
  if (!data.length) {
    grid.innerHTML = '<div style="font-size:0.8rem; opacity:0.5;">No loot yet</div>';
    return;
  }
  const latest = data[0];
  grid.innerHTML = `
    <div class="loot-box" style="border-color:${rarityColors[latest.rarity]}">
      <i data-lucide="package" style="color:${rarityColors[latest.rarity]}"></i>
      <div>
        <div style="font-weight:700;">${latest.name}</div>
        <div style="font-size:0.7rem; color:${rarityColors[latest.rarity]}">${latest.rarity.toUpperCase()}</div>
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
