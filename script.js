// --- 1. CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCQRX7XFYsFqHtPglFPPfvkFaswXc2vewc",
  authDomain: "pokerstats-caaa8.firebaseapp.com",
  projectId: "pokerstats-caaa8",
  storageBucket: "pokerstats-caaa8.firebasestorage.app",
  messagingSenderId: "1090382764377",
  appId: "1:1090382764377:web:8c6b75d35248f7d1d89448",
  measurementId: "G-ESX1LN3XV8"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // Prépare la connexion

// --- 2. SÉCURITÉ ADMIN ---
const ADMIN_EMAIL = "plessier.antoine10@gmail.com";

function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("Erreur : " + err.message));
}

// Vérifie qui est connecté pour afficher ou cacher le formulaire
auth.onAuthStateChanged(user => {
    const entryForm = document.querySelector('.entry-form');
    const resetBtn = document.querySelector('.btn-reset');
    
    if (user && user.email === ADMIN_EMAIL) {
        if(entryForm) entryForm.style.display = 'flex';
        if(resetBtn) resetBtn.style.display = 'block';
    } else {
        if(entryForm) entryForm.style.display = 'none';
        if(resetBtn) resetBtn.style.display = 'none';
    }
});

// --- 3. VARIABLES ET SYNCHRO ---
let sessions = [];
const START_BR = 500.00; 
const GOAL_BR = 1000.00;
const BIG_BLIND = 0.10; 
let previousBr = START_BR;

db.collection("sessions").orderBy("fullDate", "asc").onSnapshot((snapshot) => {
    sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateUI(); 
});

// --- 4. AUDIO ---
let audioCtx;
window.addEventListener('click', () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}, { once: true });

function playPop() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

// --- 5. LOGIQUE ---
function setTodayDate() {
    const inputDate = document.getElementById('input-date');
    if(inputDate) inputDate.value = new Date().toISOString().split('T')[0];
}

function addSession() {
    const handsInput = document.getElementById('input-hands');
    const gainInput = document.getElementById('input-gain');
    const dateInput = document.getElementById('input-date');
    
    const hands = parseInt(handsInput.value);
    const gain = parseFloat(gainInput.value);
    const rawDate = dateInput.value;

    if (isNaN(hands) || isNaN(gain) || !rawDate) return alert("Remplis tout !");

    db.collection("sessions").add({
        date: rawDate.split('-').reverse().slice(0,2).join('/'),
        fullDate: rawDate,
        hands: hands,
        gain: gain
    }).then(() => {
        playPop();
        handsInput.value = ''; gainInput.value = '';
    }).catch(() => alert("Action interdite : Tu n'es pas Antoine !"));
}

function deleteSession(id) {
    if(confirm("Supprimer ?")) db.collection("sessions").doc(id).delete();
}

function updateUI() {
    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    const historyBody = document.getElementById('history-list');
    const user = auth.currentUser;
    const isAntoine = user && user.email === ADMIN_EMAIL;

// --- NOUVELLE LOGIQUE D'AFFICHAGE ---
    let rows = []; // On crée une liste vide pour stocker nos lignes de tableau
    
    if(historyBody) {
        sessions.forEach((s) => { // On utilise forEach pour faire les calculs
            totalHands += s.hands; 
            currentProfitNet += s.gain;
            if (s.gain > 0) winningSessions++;
            handsLabels.push(totalHands);
            profitsNet.push(parseFloat(currentProfitNet.toFixed(2)));

            // On prépare la ligne HTML et on l'ajoute à notre liste "rows"
            rows.push(`<tr>
                <td style="color: #888;">${s.date}</td>
                <td>${s.hands.toLocaleString()}</td>
                <td style="color: ${s.gain >= 0 ? '#4ade80' : '#ff5555'}">${s.gain.toFixed(2)}€</td>
                <td>${isAntoine ? `<button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>` : ''}</td>
            </tr>`);
        });

        // ICI LA MAGIE : On inverse la liste des lignes avant de l'afficher !
        historyBody.innerHTML = rows.reverse().join('');
    }

    const brElem = document.getElementById('total-br');
    if(brElem) {
        const newBr = START_BR + currentProfitNet;
        animateValue('total-br', previousBr, newBr, 1000); 
        previousBr = newBr; 
    }
    
    document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    let winrate = totalHands > 0 ? (currentProfitNet / BIG_BLIND) / (totalHands / 100) : 0;
    document.getElementById('winrate').innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
    document.getElementById('winrate').style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    
    let successRate = sessions.length > 0 ? (winningSessions / sessions.length) * 100 : 0;
    document.getElementById('success-rate').innerText = successRate.toFixed(1) + "%";
    
    let prog = (currentProfitNet / (GOAL_BR - START_BR)) * 100;
    document.getElementById('br-progression-text').innerText = Math.min(100, Math.max(0, prog)).toFixed(1) + "%";
    document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, prog)) + "%";

    renderChart(handsLabels, profitsNet);
}

function renderChart(labels, values) {
    const canvas = document.getElementById('myChart');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if (window.pokerChart) window.pokerChart.destroy();
    window.pokerChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit Net',
                data: values,
                clip: false, borderColor: '#60a5fa', borderWidth: 3,
                pointBackgroundColor: '#ffffff', pointBorderColor: '#3b82f6', pointBorderWidth: 2, pointRadius: 5,
                fill: 'start', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { grid: { color: 'rgba(59, 130, 246, 0.1)' }, ticks: { color: '#9ca3af' } },
                x: { type: 'linear', grid: { display: false }, min: labels[0], max: labels[labels.length - 1], ticks: { color: '#9ca3af' } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- 6. ANIMATIONS DE FOND (ÉTOILES & FUMÉE) ---
const bgCanvas = document.getElementById('bg-canvas');
const bgCtx = bgCanvas.getContext('2d');
// On garde stars et smokeTrail intacts, on ajoute juste la suite
let stars = [], smokeTrail = [], shootingStars = [], shootingStarTimer = 0, fireballs = [], fireballTimer = 0, mouse = { x: null, y: null };

function initBg() {
    bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
    stars = [];
    for (let i = 0; i < 50; i++) {
        stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, sx: (Math.random() - 0.5) * 0.5, sy: (Math.random() - 0.5) * 0.5 });
    }
}

window.addEventListener('mousemove', (e) => {
    mouse.x = e.x; mouse.y = e.y;
    for(let i = 0; i < 2; i++) {
        smokeTrail.push({ x: mouse.x, y: mouse.y, size: Math.random() * 5 + 2, speedX: (Math.random() - 0.5) * 0.8, speedY: (Math.random() - 1) * 0.4, opacity: 1 });
    }
});

function createShootingStar() {
    shootingStars.push({
        x: Math.random() * bgCanvas.width, 
        y: -10, 
        vx: (Math.random() - 0.5) * 4, 
        vy: Math.random() * 5 + 7, // Elle tombe vite
        trail: [] 
    });
}

function createFireball() {
    fireballs.push({
        x: Math.random() * bgCanvas.width, // Position horizontale aléatoire
        y: -30, // Commence bien au-dessus de l'écran
        vx: (Math.random() - 0.5) * 2, // Dérive latérale lente
        vy: Math.random() * 2 + 3, // Tombe plus lentement que les étoiles filantes (plus lourd)
        size: Math.random() * 4 + 3, // Taille variable (plus gros que les étoiles)
        trail: [] // Pour la traînée de feu
    });
}

function animateBg() {
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    
    // --- TES POINTS LUMINEUX (ON NE TOUCHE À RIEN ICI) ---
    bgCtx.fillStyle = "rgba(59, 130, 246, 0.2)";
    stars.forEach(p => {
        p.x += p.sx; p.y += p.sy;
        if(p.x < 0 || p.x > bgCanvas.width) p.sx *= -1; if(p.y < 0 || p.y > bgCanvas.height) p.sy *= -1;
        bgCtx.beginPath(); bgCtx.arc(p.x, p.y, 2, 0, Math.PI * 2); bgCtx.fill();
    });

    // --- LA FUMÉE (RESTE INTACTE AUSSI) ---
    for (let i = 0; i < smokeTrail.length; i++) {
        let s = smokeTrail[i]; s.x += s.speedX; s.y += s.speedY; s.size += 0.6; s.opacity -= 0.012;
        if (s.opacity <= 0) { smokeTrail.splice(i, 1); i--; } 
        else {
            const gradient = bgCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
            gradient.addColorStop(0, `rgba(59, 130, 246, ${s.opacity * 0.15})`);
            gradient.addColorStop(0.7, `rgba(59, 130, 246, ${s.opacity * 0.05})`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            bgCtx.beginPath(); bgCtx.fillStyle = gradient; bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2); bgCtx.fill();
        }
    }

    // --- NOUVEAU : ÉTOILES FILANTES PASSAGÈRES ---
    shootingStarTimer++;
    if (shootingStarTimer > 800) { // Environ toutes les 15-20 secondes (très discret)
        createShootingStar();
        shootingStarTimer = 0;
    }

    shootingStars.forEach((s, idx) => {
        s.x += s.vx; s.y += s.vy;
        s.trail.push({x: s.x, y: s.y});
        if(s.trail.length > 15) s.trail.shift();

        // Dessin de la queue
        bgCtx.beginPath();
        bgCtx.strokeStyle = "rgba(147, 197, 253, 0.4)";
        bgCtx.lineWidth = 1;
        s.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
        bgCtx.stroke();

        // Suppression si sortie d'écran
        if(s.y > bgCanvas.height) shootingStars.splice(idx, 1);
    });

    // --- NOUVEAU : LES BOULES DE FEU PASSAGÈRES (JUSTE AVANT LA FIN) ---

// Timer : Fréquence augmentée (environ toutes les 10-20 secondes)
    fireballTimer++;
    if (fireballTimer > Math.random() * 1000 + 500) { 
        createFireball();
        fireballTimer = 0;
    }

    fireballs.forEach((fb, idx) => {
        fb.x += fb.vx; fb.y += fb.vy;
        
        // On garde une traînée plus longue pour l'effet de feu
        fb.trail.push({x: fb.x, y: fb.y, size: fb.size});
        if(fb.trail.length > 25) fb.trail.shift();

        // 1. DESSIN DE LA TRAÎNÉE (QUEUE DE FEU)
        if(fb.trail.length > 1) {
            bgCtx.beginPath();
            // Dégradé du rouge transparent vers le orange vif
            let fireGrad = bgCtx.createLinearGradient(fb.trail[0].x, fb.trail[0].y, fb.x, fb.y);
            fireGrad.addColorStop(0, "rgba(255, 50, 0, 0)"); // Queue qui disparaît
            fireGrad.addColorStop(1, "rgba(255, 140, 0, 0.6)"); // Corps de la flamme
            
            bgCtx.strokeStyle = fireGrad;
            // La traînée est épaisse comme la boule
            bgCtx.lineWidth = fb.size; 
            // Bords arrondis pour un aspect fluide
            bgCtx.lineCap = 'round';
            
            fb.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
            bgCtx.stroke();
        }

        // 2. DESSIN DE LA TÊTE (CŒUR INCANDESCENT)
        bgCtx.beginPath();
        bgCtx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2);
        // Cœur jaune/blanc très chaud
        bgCtx.fillStyle = "#ffddaa"; 
        // Gros halo ("glow") orange/rouge intense
        bgCtx.shadowColor = "#ff4500"; 
        bgCtx.shadowBlur = 25; 
        bgCtx.fill();
        bgCtx.shadowBlur = 0; // Reset du halo pour ne pas affecter le reste

        // Suppression si sortie d'écran loin en bas
        if(fb.y > bgCanvas.height + 50) fireballs.splice(idx, 1);
    });
    
    // --- FIN DU NOUVEAU BLOC ---

    requestAnimationFrame(animateBg);
}
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerText = (progress * (end - start) + start).toFixed(2) + "€";
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function resetData() {
    if(confirm("Tout supprimer ?")) {
        db.collection("sessions").get().then((q) => q.forEach((doc) => doc.ref.delete()));
    }
}

// On attend que le document soit prêt
document.addEventListener('DOMContentLoaded', () => {
    // On cible la première carte de stats (celle de la Bankroll)
    const bankrollCard = document.querySelector('.stat-card');

    if (bankrollCard) {
        bankrollCard.style.cursor = 'pointer'; // On montre que c'est cliquable

        bankrollCard.addEventListener('click', () => {
            // On ajoute la classe d'animation
            bankrollCard.classList.add('spinning');
            
            // On joue un petit son de "pop" si tu veux
            if (typeof playPop === "function") playPop();

            // On retire la classe après 600ms (durée de l'anim) pour pouvoir recommencer
            setTimeout(() => {
                bankrollCard.classList.remove('spinning');
            }, 600);
        });
    }
});

window.addEventListener('resize', initBg);
initBg(); animateBg(); setTodayDate();