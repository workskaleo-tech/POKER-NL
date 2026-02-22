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
const auth = firebase.auth();

// --- 2. SÉCURITÉ ADMIN ---
const ADMIN_EMAIL = "plessier.antoine10@gmail.com";

function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert("Erreur : " + err.message));
}

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
let previousBr = START_BR;

db.collection("sessions").orderBy("fullDate", "asc").onSnapshot((snapshot) => {
    sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateUI(); 
});

// --- 4. FONCTIONS UTILS ---
function setTodayDate() {
    const inputDate = document.getElementById('input-date');
    const inputTime = document.getElementById('input-time');
    const now = new Date();
    if(inputDate) inputDate.value = now.toISOString().split('T')[0];
    if(inputTime) inputTime.value = now.toTimeString().slice(0,5); 
}

function addSession() {
    const handsInput = document.getElementById('input-hands');
    const gainInput = document.getElementById('input-gain');
    const dateInput = document.getElementById('input-date');
    const timeInput = document.getElementById('input-time');
    const stakeInput = document.getElementById('input-stake');
    
    const hands = parseInt(handsInput.value);
    const gain = parseFloat(gainInput.value);
    const rawDate = dateInput.value;
    const rawTime = timeInput.value;
    const stake = stakeInput ? stakeInput.value : "NL10";

    if (isNaN(hands) || isNaN(gain) || !rawDate || !rawTime) return alert("Remplis tout !");

    db.collection("sessions").add({
        date: rawDate.split('-').reverse().slice(0,2).join('/'),
        fullDate: rawDate + "T" + rawTime, 
        hands: hands,
        gain: gain,
        stake: stake
    }).then(() => {
        if(typeof playPop === "function") playPop();
        handsInput.value = ''; gainInput.value = '';
    });
}

function deleteSession(id) {
    if(confirm("Supprimer ?")) db.collection("sessions").doc(id).delete();
}

// --- 5. LOGIQUE D'AFFICHAGE (AVEC POLICES FINES ET FILTRES) ---
function updateUI() {
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";

    let filteredSessions = sessions.filter(s => {
        const sessionStake = s.stake || "NL10";
        if (filterValue === "ALL") return true;
        return sessionStake === filterValue;
    });

    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    const historyBody = document.getElementById('history-list');
    const user = auth.currentUser;
    const isAntoine = user && user.email === ADMIN_EMAIL;
    let rows = [];

    filteredSessions.forEach((s) => { 
        totalHands += s.hands; 
        currentProfitNet += s.gain;
        if (s.gain > 0) winningSessions++;
        
        handsLabels.push(totalHands);
        profitsNet.push(parseFloat(currentProfitNet.toFixed(2)));

        const sessionStake = s.stake || "NL10";
        const bbValue = (sessionStake === "NL2") ? 0.02 : 0.10;
        const gainBB = s.gain / bbValue;

        rows.push(`<tr>
            <td style="color: #888; font-weight: 400;">${s.date} <br><small style="font-weight:400; color:#3b82f6;">${sessionStake}</small></td>
            <td style="font-weight: 400;">${s.hands.toLocaleString()}</td>
            <td style="color: ${s.gain >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">${s.gain.toFixed(2)}€</td>
            <td style="color: ${gainBB >= 0 ? '#4ade80' : '#ff5555'}; font-weight: 400;">
                ${gainBB.toFixed(1)} BB
            </td>
            <td>${isAntoine ? `<button class="btn-delete" onclick="deleteSession('${s.id}')">✕</button>` : ''}</td>
        </tr>`);
    });

    if(historyBody) historyBody.innerHTML = rows.reverse().join('');

    const brElem = document.getElementById('total-br');
    if(brElem) {
        const newBr = START_BR + currentProfitNet;
        animateValue('total-br', previousBr, newBr, 1000); 
        previousBr = newBr; 
    }
    
    document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    
    const currentBB = (filterValue === "NL2") ? 0.02 : 0.10;
    let winrate = totalHands > 0 ? (currentProfitNet / currentBB) / (totalHands / 100) : 0;
    const winrateElem = document.getElementById('winrate');
    winrateElem.innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
    winrateElem.style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    
    let successRate = filteredSessions.length > 0 ? (winningSessions / filteredSessions.length) * 100 : 0;
    document.getElementById('success-rate').innerText = successRate.toFixed(1) + "%";
    
    let prog = (currentProfitNet / (GOAL_BR - START_BR)) * 100;
    document.getElementById('br-progression-text').innerText = Math.min(100, Math.max(0, prog)).toFixed(1) + "%";
    document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, prog)) + "%";

    renderChart(handsLabels, profitsNet);
}

// --- 6. CHART ET AUDIO ---
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

let audioCtx;
function playPop() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

// --- 8. EXPORT ET IMPORT DES DONNÉES ---

function exportData() {
    // Sécurité : Vérifie que c'est bien l'admin
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut exporter les données.");
    }
    
    // Crée un fichier JSON avec toutes tes sessions actuelles (Sauvegarde)
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sessions));
    const downloadNode = document.createElement('a');
    downloadNode.setAttribute("href", dataStr);
    downloadNode.setAttribute("download", "backup_poker_stats.json");
    document.body.appendChild(downloadNode);
    downloadNode.click();
    downloadNode.remove();
}

function importData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut importer des données.");
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'; 
    
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        
        reader.onload = readerEvent => {
            try {
                const data = JSON.parse(readerEvent.target.result);
                let count = 0;
                
                data.forEach(s => {
                    // 1. ASTUCE VIRGULE : Transforme "5,47" en "5.47"
                    let rawGain = String(s.gain).replace(',', '.');
                    let gainNumber = parseFloat(rawGain);

                    // 2. ASTUCE DATE : On coupe tout ce qu'il y a après l'espace pour jeter l'heure
                    let rawString = String(s.date);
                    let datePart = rawString.split(' ')[0]; // Garde uniquement "24/09/2025"
                    
                    // Format pour l'affichage (ex: "24/09")
                    let displayDate = datePart.split('/').slice(0, 2).join('/');
                    
                    // Format pour le tri Firebase (ex: "2025-09-24T0001")
                    // On utilise "count" pour que les sessions d'un même jour gardent l'ordre exact de ton fichier !
                    let parts = datePart.split('/'); 
                    let isoDate = `${parts[2]}-${parts[1]}-${parts[0]}T${String(count).padStart(4, '0')}`;

                    db.collection("sessions").add({
                        date: displayDate,
                        fullDate: isoDate,
                        hands: parseInt(s.hands),
                        gain: gainNumber,
                        stake: "NL2" // Forcé en NL2
                    });
                    
                    count++;
                });
                
                alert("✅ MAGIQUE ! " + count + " sessions importées dans l'ordre de ton fichier.");
            } catch (err) {
                alert("❌ Erreur. Le fichier n'est pas un JSON valide.");
                console.error(err);
            }
        }
    };
    
    input.click(); 
}

// --- 7. ANIMATIONS DE FOND (ÉTOILES, FUMÉE, BOULES DE FEU) ---
const bgCanvas = document.getElementById('bg-canvas');
if (bgCanvas) {
    const bgCtx = bgCanvas.getContext('2d');
    let stars = [], smokeTrail = [], shootingStars = [], shootingStarTimer = 0, fireballs = [], fireballTimer = 0, mouse = { x: null, y: null };

    function initBg() {
        bgCanvas.width = window.innerWidth; bgCanvas.height = window.innerHeight;
        stars = [];
        for (let i = 0; i < 50; i++) {
            stars.push({ x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height, sx: (Math.random() - 0.5) * 0.5, sy: (Math.random() - 0.5) * 0.5 });
        }
    }

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX; mouse.y = e.clientY;
        for(let i = 0; i < 2; i++) {
            smokeTrail.push({ x: mouse.x, y: mouse.y, size: Math.random() * 5 + 2, speedX: (Math.random() - 0.5) * 0.8, speedY: (Math.random() - 1) * 0.4, opacity: 1 });
        }
    });

    function createShootingStar() {
        shootingStars.push({
            x: Math.random() * bgCanvas.width, 
            y: -10, 
            vx: (Math.random() - 0.5) * 4, 
            vy: Math.random() * 5 + 7,
            trail: [] 
        });
    }

    function createFireball() {
        fireballs.push({
            x: Math.random() * bgCanvas.width, 
            y: -30, 
            vx: (Math.random() - 0.5) * 2, 
            vy: Math.random() * 2 + 3, 
            size: Math.random() * 4 + 3, 
            trail: [] 
        });
    }

    function animateBg() {
        bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        
        // Étoiles de fond
        bgCtx.fillStyle = "rgba(59, 130, 246, 0.2)";
        stars.forEach(p => {
            p.x += p.sx; p.y += p.sy;
            if(p.x < 0 || p.x > bgCanvas.width) p.sx *= -1; if(p.y < 0 || p.y > bgCanvas.height) p.sy *= -1;
            bgCtx.beginPath(); bgCtx.arc(p.x, p.y, 2, 0, Math.PI * 2); bgCtx.fill();
        });

        // Fumée de souris
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

        // Étoiles filantes
        shootingStarTimer++;
        if (shootingStarTimer > 800) { 
            createShootingStar();
            shootingStarTimer = 0;
        }

        shootingStars.forEach((s, idx) => {
            s.x += s.vx; s.y += s.vy;
            s.trail.push({x: s.x, y: s.y});
            if(s.trail.length > 15) s.trail.shift();

            bgCtx.beginPath();
            bgCtx.strokeStyle = "rgba(147, 197, 253, 0.4)";
            bgCtx.lineWidth = 1;
            s.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
            bgCtx.stroke();

            if(s.y > bgCanvas.height) shootingStars.splice(idx, 1);
        });

        // Boules de feu
        fireballTimer++;
        if (fireballTimer > Math.random() * 1000 + 500) { 
            createFireball();
            fireballTimer = 0;
        }

        fireballs.forEach((fb, idx) => {
            fb.x += fb.vx; fb.y += fb.vy;
            fb.trail.push({x: fb.x, y: fb.y, size: fb.size});
            if(fb.trail.length > 25) fb.trail.shift();

            if(fb.trail.length > 1) {
                bgCtx.beginPath();
                let fireGrad = bgCtx.createLinearGradient(fb.trail[0].x, fb.trail[0].y, fb.x, fb.y);
                fireGrad.addColorStop(0, "rgba(255, 50, 0, 0)");
                fireGrad.addColorStop(1, "rgba(255, 140, 0, 0.6)");
                bgCtx.strokeStyle = fireGrad;
                bgCtx.lineWidth = fb.size; 
                bgCtx.lineCap = 'round';
                fb.trail.forEach(t => bgCtx.lineTo(t.x, t.y));
                bgCtx.stroke();
            }

            bgCtx.beginPath();
            bgCtx.arc(fb.x, fb.y, fb.size, 0, Math.PI * 2);
            bgCtx.fillStyle = "#ffddaa"; 
            bgCtx.shadowColor = "#ff4500"; 
            bgCtx.shadowBlur = 25; 
            bgCtx.fill();
            bgCtx.shadowBlur = 0;

            if(fb.y > bgCanvas.height + 50) fireballs.splice(idx, 1);
        });

        requestAnimationFrame(animateBg);
    }

    window.addEventListener('resize', initBg);
    initBg(); 
    animateBg();
}

// Initialisation au démarrage
setTodayDate();

document.addEventListener('DOMContentLoaded', () => {
    const bankrollCard = document.querySelector('.stat-card');
    if (bankrollCard) {
        bankrollCard.style.cursor = 'pointer'; 
        bankrollCard.addEventListener('click', () => {
            bankrollCard.classList.add('spinning');
            if (typeof playPop === "function") playPop();
            setTimeout(() => { bankrollCard.classList.remove('spinning'); }, 600);
        });
    }
});