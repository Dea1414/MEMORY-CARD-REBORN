// GANTI SCRIPT_URL DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwPTZGencaLuq6vKSvkZr8FMRUwGTPTKYC0ItXDXhxzEDATtC9NzgVhgP4rxgojMMiu/exec";

const allSymbols = ['🍎','🍌','🍒','🍇','🍕','🐱','🐶','🚗','🚀','⚽','🎮','💎','🌟','💣','👻'];
let currentUser = null;
let currentLevel = 1;
let totalScore = 0;
let lives = 3;
let timer = 0, timerInterval = null;

let scene, camera, renderer, raycaster, mouse;
let cards = [], flippedCards = [], matches = 0, targetMatches = 0;
let isProcessing = false;

// Event Listeners UI
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('btnAuth').addEventListener('click', handleAuth);
  document.getElementById('btnLeaderboard').addEventListener('click', showLeaderboard);
  document.getElementById('btnCloseLeaderboard').addEventListener('click', closeLeaderboard);
  document.getElementById('btnNextLevel').addEventListener('click', nextLevel);
  document.getElementById('btnRestart').addEventListener('click', restartGame);
});

// Autentikasi Login/Register
function handleAuth() {
  const u = document.getElementById('authUsername').value.trim();
  const p = document.getElementById('authPassword').value.trim();
  const msg = document.getElementById('authMsg');
  const btn = document.getElementById('btnAuth');

  if (!u || !p) {
    msg.innerText = "Isi username & password!";
    return;
  }

  btn.innerText = "Memproses...";
  btn.disabled = true;
  msg.innerText = "";

  const url = `${SCRIPT_URL}?action=login&username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`;

  fetch(url)
    .then(res => res.text())
    .then(text => {
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error("Respons dari server bukan JSON yang valid.");
      }
    })
    .then(data => {
      btn.innerText = "Masuk / Daftar";
      btn.disabled = false;
      if (data.status === 'success') {
        currentUser = u;
        document.getElementById('modalAuth').style.display = 'none';
        document.getElementById('ui').style.display = 'flex';
        initThreeJS();
        startLevel(1);
      } else {
        msg.innerText = data.message || "Gagal masuk.";
      }
    })
    .catch(err => {
      console.error(err);
      btn.innerText = "Masuk / Daftar";
      btn.disabled = false;
      msg.innerText = "Koneksi ke Google Sheets gagal! Periksa deployment Apps Script.";
    });
}

// Inisialisasi Game 3D
function initThreeJS() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(0, 5, 10);
  scene.add(light, new THREE.AmbientLight(0xffffff, 0.6));
  camera.position.z = 8;

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('resize', onWindowResize);

  animate();
}

// Memulai Level Game
function startLevel(lvl) {
  currentLevel = lvl;
  lives = 3;
  matches = 0;
  flippedCards = [];
  isProcessing = false;
  
  document.getElementById('level').innerText = currentLevel;
  updateLivesUI();
  document.getElementById('score').innerText = totalScore;
  
  clearInterval(timerInterval);
  timer = 0;
  document.getElementById('timer').innerText = timer;
  timerInterval = null;

  cards.forEach(c => scene.remove(c));
  cards = [];

  const numPairs = Math.min(3 + (lvl - 1), allSymbols.length);
  targetMatches = numPairs;

  const levelSymbols = allSymbols.slice(0, numPairs);
  const deck = [...levelSymbols, ...levelSymbols].sort(() => Math.random() - 0.5);

  const cols = deck.length > 12 ? 6 : (deck.length > 8 ? 4 : 3);
  const rows = Math.ceil(deck.length / cols);
  const spacingX = 1.3, spacingY = 1.6;

  deck.forEach((symbol, i) => {
    const group = new THREE.Group();

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,256,256);
    ctx.font = '90px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(symbol, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);

    const frontMat = new THREE.MeshBasicMaterial({ map: texture });
    const backMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
    const sideMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });

    const geometry = new THREE.BoxGeometry(1.1, 1.4, 0.05);
    const mesh = new THREE.Mesh(geometry, [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]);
    
    group.add(mesh);

    const col = i % cols;
    const row = Math.floor(i / cols);
    group.position.set(
      (col - (cols - 1) / 2) * spacingX,
      (-(row - (rows - 1) / 2) * spacingY),
      0
    );

    group.userData = { symbol, isFlipped: false, isMatched: false };
    scene.add(group);
    cards.push(group);
  });
}

function onPointerDown(e) {
  if (isModalActive() || isProcessing) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(cards.map(c => c.children[0]));
  if (intersects.length > 0) {
    flipCard(intersects[0].object.parent);
  }
}

function flipCard(card) {
  if (!timerInterval) {
    timerInterval = setInterval(() => { timer++; document.getElementById('timer').innerText = timer; }, 1000);
  }
  
  if (card.userData.isFlipped || card.userData.isMatched || flippedCards.length >= 2) return;

  card.userData.isFlipped = true;
  new TWEEN.Tween(card.rotation).to({ y: Math.PI }, 300).start();
  flippedCards.push(card);

  if (flippedCards.length === 2) {
    checkMatch();
  }
}

function checkMatch() {
  isProcessing = true;
  const [c1, c2] = flippedCards;

  if (c1.userData.symbol === c2.userData.symbol) {
    c1.userData.isMatched = c2.userData.isMatched = true;
    flippedCards = [];
    matches++;
    totalScore += 100;
    document.getElementById('score').innerText = totalScore;
    isProcessing = false;

    if (matches === targetMatches) {
      clearInterval(timerInterval);
      setTimeout(handleLevelWin, 500);
    }
  } else {
    setTimeout(() => {
      new TWEEN.Tween(c1.rotation).to({ y: 0 }, 300).start();
      new TWEEN.Tween(c2.rotation).to({ y: 0 }, 300).start();
      c1.userData.isFlipped = false;
      c2.userData.isFlipped = false;
      flippedCards = [];
      
      lives--;
      updateLivesUI();
      
      if (lives <= 0) {
        clearInterval(timerInterval);
        handleGameOver();
      }
      isProcessing = false;
    }, 800);
  }
}

function updateLivesUI() {
  document.getElementById('lives').innerText = '❤️'.repeat(Math.max(0, lives));
}

function handleLevelWin() {
  const timeBonus = Math.max(0, 100 - timer * 2);
  totalScore += timeBonus;
  document.getElementById('score').innerText = totalScore;
  
  saveScoreToSheet();

  if (currentLevel >= 10) {
    alert("🎉 SELAMAT! Anda Menyelesaikan Seluruh 10 Level!");
    showLeaderboard();
  } else {
    document.getElementById('winLevelNo').innerText = currentLevel;
    document.getElementById('winBonus').innerText = timeBonus;
    document.getElementById('modalLevelWin').style.display = 'block';
  }
}

function nextLevel() {
  document.getElementById('modalLevelWin').style.display = 'none';
  startLevel(currentLevel + 1);
}

function handleGameOver() {
  saveScoreToSheet();
  document.getElementById('loseLevelNo').innerText = currentLevel;
  document.getElementById('finalScore').innerText = totalScore;
  document.getElementById('modalGameOver').style.display = 'block';
}

function restartGame() {
  document.getElementById('modalGameOver').style.display = 'none';
  totalScore = 0;
  startLevel(1);
}

function isModalActive() {
  return document.getElementById('modalAuth').style.display === 'block' ||
         document.getElementById('modalLevelWin').style.display === 'block' ||
         document.getElementById('modalGameOver').style.display === 'block' ||
         document.getElementById('modalLeaderboard').style.display === 'block';
}

function saveScoreToSheet() {
  if (!currentUser) return;
  const url = `${SCRIPT_URL}?action=saveScore&username=${encodeURIComponent(currentUser)}&level=${currentLevel}&score=${totalScore}`;
  fetch(url);
}

function showLeaderboard() {
  document.getElementById('modalLeaderboard').style.display = 'block';
  const container = document.getElementById('leaderboardContent');
  container.innerHTML = "Memuat data...";

  fetch(`${SCRIPT_URL}?action=getLeaderboard`)
    .then(res => res.json())
    .then(data => {
      if (!data || data.length === 0) {
        container.innerHTML = "<p>Belum ada skor tercatat.</p>";
        return;
      }

      let html = `<table>
        <tr>
          <th>#</th>
          <th>User</th>
          <th>Level</th>
          <th>Skor</th>
        </tr>`;
      
      data.forEach((item, index) => {
        html += `<tr>
          <td><b>${index + 1}</b></td>
          <td>${item.username}</td>
          <td>Lvl ${item.level}</td>
          <td>${item.score}</td>
        </tr>`;
      });

      html += `</table>`;
      container.innerHTML = html;
    })
    .catch(() => {
      container.innerHTML = "<p style='color: #ef4444;'>Gagal memuat leaderboard.</p>";
    });
}

function closeLeaderboard() {
  document.getElementById('modalLeaderboard').style.display = 'none';
}

function animate(time) {
  requestAnimationFrame(animate);
  TWEEN.update(time);
  if (renderer && scene && camera) renderer.render(scene, camera);
}

function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
