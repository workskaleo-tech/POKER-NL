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
let previousBr = 0;

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

// --- 5. LOGIQUE D'AFFICHAGE ---
function updateUI() {
    const filterElem = document.getElementById('global-filter');
    const filterValue = filterElem ? filterElem.value : "ALL";

    let startBR, goalBR;
    if (filterValue === "NL10") {
        startBR = 500;
        goalBR = 1000;
    } else if (filterValue === "NL2") {
        startBR = 35;  
        goalBR = 500;  
    } else { 
        startBR = 35;  
        goalBR = 1000; 
    }

    const xpTitle = document.getElementById('xp-title-text');
    if(xpTitle) {
        xpTitle.innerText = `🏁 Départ ${startBR}€ ➔ 🎯 Objectif ${goalBR}€`;
    }

    let filteredSessions = sessions.filter(s => {
        const sessionStake = s.stake || "NL10";
        if (filterValue === "ALL") return true;
        return sessionStake === filterValue;
    });

    let handsLabels = [0]; let profitsNet = [0];  
    let totalHands = 0; let currentProfitNet = 0; let winningSessions = 0;
    let totalBB = 0; 
    
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
        totalBB += gainBB;

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
        const newBr = startBR + currentProfitNet;
        if (previousBr === 0) {
            setTimeout(() => { animateValue('total-br', startBR, newBr, 1500); }, 1200);
        } else if (Math.abs(previousBr - newBr) > 300) {
             brElem.innerText = newBr.toFixed(2) + "€";
        } else {
             animateValue('total-br', previousBr, newBr, 1000); 
        }
        previousBr = newBr; 
    }
    
    document.getElementById('total-volume').innerText = totalHands.toLocaleString();
    let winrate = totalHands > 0 ? totalBB / (totalHands / 100) : 0;
    const winrateElem = document.getElementById('winrate');
    winrateElem.innerText = (winrate >= 0 ? '+' : '') + winrate.toFixed(2) + " bb/100";
    winrateElem.style.color = winrate >= 0 ? '#4ade80' : '#ff5555';
    
    let successRate = filteredSessions.length > 0 ? (winningSessions / filteredSessions.length) * 100 : 0;
    document.getElementById('success-rate').innerText = successRate.toFixed(1) + "%";
    
    let prog = (currentProfitNet / (goalBR - startBR)) * 100;
    let displayProg = Math.min(100, Math.max(0, prog)); 
    document.getElementById('br-progression-text').innerText = displayProg.toFixed(1) + "%";
    document.getElementById('progress-bar-fill').style.width = displayProg + "%";

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
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut exporter les données.");
    }
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const downloadNode = document.createElement('a');
    downloadNode.href = url;
    downloadNode.download = "backup_poker_stats.json";
    downloadNode.style.display = 'none';
    document.body.appendChild(downloadNode);
    downloadNode.click();
    document.body.removeChild(downloadNode);
    URL.revokeObjectURL(url);
}

function importData() {
    if (!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) {
        return alert("Seul l'admin peut importer des données.");
    }

    // 🚀 ALERTE DE VÉRIFICATION
    alert("🚀 Le nouveau script TERMINATOR est bien activé !");

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json'; 
    input.style.display = 'none';
    document.body.appendChild(input); 
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return; 

        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        
        reader.onload = readerEvent => {
            try {
                const data = JSON.parse(readerEvent.target.result);
                let count = 0;
                data.forEach(s => {
                    let rawGain = String(s.gain).replace(',', '.');
                    let gainNumber = parseFloat(rawGain);

                    // 🛑 LE SCANNER TERMINATOR (Regex) 🛑
                    let sString = JSON.stringify(s);
                    let match = sString.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    
                    let displayDate = "00/00";
                    let isoDate = "2000-01-01T0000";

                    if (match) {
                        let jour = match[1], mois = match[2], annee = match[3];
                        displayDate = `${jour}/${mois}`; 
                        isoDate = `${annee}-${mois}-${jour}T${String(count).padStart(4, '0')}`;
                    }

                    db.collection("sessions").add({
                        date: displayDate,
                        fullDate: isoDate,
                        hands: parseInt(s.hands) || 0,
                        gain: gainNumber,
                        stake: "NL2"
                    });
                    count++;
                });
                alert("✅ VICTOIRE ! " + count + " sessions importées avec la bonne date !");
            } catch (err) {
                alert("❌ Erreur. Le fichier n'est pas un JSON valide.");
                console.error(err);
            }
        }
    };
    input.click(); 
    setTimeout(() => document.body.removeChild(input), 100); 
}

// --- 7. ANIMATIONS DE FOND ---
// (On garde tes animations d'étoiles et de boules de feu ici...)