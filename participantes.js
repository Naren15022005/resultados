'use strict';

const MY_KEY = 'icfes_my_key';

let currentView     = 'grid';
let deletingKey     = null;
let currentData     = [];
let participantesRef;

// ── Firebase ──────────────────────────────────────────────────
function initFirebase() {
    try { firebase.initializeApp(FIREBASE_CONFIG); } catch (e) { /* ya inicializado */ }

    const db = firebase.database();
    participantesRef = db.ref('participantes');

    firebase.database().ref('.info/connected').on('value', (snap) => {
        const el = document.getElementById('connectionDot');
        if (!el) return;
        const ok = snap.val() === true;
        el.style.background = ok ? 'var(--success)' : 'var(--danger)';
        el.style.boxShadow  = ok ? '0 0 8px var(--success)' : '0 0 8px var(--danger)';
        el.title            = ok ? 'Conectado en tiempo real' : 'Sin conexion';
    });

    participantesRef.on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        currentData = Object.entries(raw)
            .map(([key, val]) => ({ ...val, firebaseKey: key }))
            .sort((a, b) => new Date(a.fechaRegistro) - new Date(b.fechaRegistro));
        render();
    });
}

// ── Utilities ─────────────────────────────────────────────────
function initials(nombre) {
    return nombre.trim().split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function renderIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function resizeImage(file, maxSize = 200, quality = 0.75) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let { width, height } = img;
                if (width > height) {
                    if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
                } else {
                    if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function formatDate(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function cardAvatar(p) {
    if (p.foto) return `<img src="${p.foto}" alt="${p.nombre}" class="p-card-avatar">`;
    return `<div class="p-card-avatar-placeholder">${initials(p.nombre)}</div>`;
}

function rowAvatar(p) {
    if (p.foto) return `<img src="${p.foto}" alt="${p.nombre}" class="p-row-avatar">`;
    return `<div class="p-row-avatar-placeholder">${initials(p.nombre)}</div>`;
}

function diffBadge(estimado, resultado) {
    if (resultado === null) return '<span style="color:var(--text-dim);">—</span>';
    const d   = resultado - estimado;
    const cls = d > 0 ? 'positive' : d < 0 ? 'negative' : 'neutral';
    const sym = d > 0 ? '+' : '';
    return `<span class="difference ${cls}">${sym}${d}</span>`;
}

// ── Summary ───────────────────────────────────────────────────
function renderSummary() {
    const total        = currentData.length;
    const conResultado = currentData.filter(p => p.resultado !== null).length;
    const sinResultado = total - conResultado;
    const promEst      = total ? Math.round(currentData.reduce((s, p) => s + p.estimado, 0) / total) : 0;
    const promRes      = conResultado
        ? Math.round(currentData.filter(p => p.resultado !== null).reduce((s, p) => s + p.resultado, 0) / conResultado)
        : null;

    document.getElementById('summaryBar').innerHTML = `
        <div class="summary-pill"><i data-lucide="users" width="13" height="13"></i> ${total} participante${total !== 1 ? 's' : ''}</div>
        <div class="summary-pill"><i data-lucide="check-circle" width="13" height="13"></i> ${conResultado} con resultado</div>
        <div class="summary-pill"><i data-lucide="clock" width="13" height="13"></i> ${sinResultado} sin resultado</div>
        <div class="summary-pill"><i data-lucide="bar-chart-2" width="13" height="13"></i> Prom. est.: ${promEst}</div>
        ${promRes !== null ? `<div class="summary-pill"><i data-lucide="target" width="13" height="13"></i> Prom. real: ${promRes}</div>` : ''}
    `;
    renderIcons();
}

// ── Main render ───────────────────────────────────────────────
function render() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const data  = currentData.filter(p => !query || p.nombre.toLowerCase().includes(query));
    renderSummary();
    const container = document.getElementById('participantsContainer');
    currentView === 'grid' ? renderGrid(container, data) : renderList(container, data);
}

function renderGrid(container, data) {
    if (data.length === 0) {
        container.innerHTML = `
            <div class="participants-grid">
                <div class="empty-grid">
                    <div class="empty-grid-icon"><i data-lucide="users" width="52" height="52"></i></div>
                    <p>No hay participantes aun.</p>
                </div>
            </div>`;
        renderIcons();
        return;
    }

    const myKey     = localStorage.getItem(MY_KEY);
    const sorted    = [...currentData].filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    const rankClass = ['rank-1', 'rank-2', 'rank-3'];

    const cards = data.map(p => {
        const isMe    = p.firebaseKey === myKey;
        const rankIdx = sorted.findIndex(s => s.firebaseKey === p.firebaseKey);
        const badge   = rankIdx >= 0 && rankIdx < 3
            ? `<span class="rank-badge ${rankClass[rankIdx]}" style="position:absolute;top:12px;right:12px;">${rankIdx + 1}</span>`
            : '';

        return `
        <div class="p-card${isMe ? ' p-card--mine' : ''}">
            <div class="p-card-header" style="position:relative;">
                ${badge}
                ${isMe ? `<span class="mine-tag"><i data-lucide="user" width="11" height="11"></i> Tu</span>` : ''}
                ${cardAvatar(p)}
                <div class="p-card-name">${p.nombre}</div>
                ${p.carrera ? `<div class="p-card-career"><i data-lucide="graduation-cap" width="11" height="11"></i>${p.carrera}</div>` : ''}
                <div class="p-card-date">${formatDate(p.fechaRegistro)}</div>
            </div>
            <div class="p-card-body">
                <div class="p-score-row">
                    <span class="p-score-label">Estimado</span>
                    <span class="p-score-value">${p.estimado}</span>
                </div>
                ${p.resultado !== null ? `
                    <div class="p-score-row">
                        <span class="p-score-label">Resultado</span>
                        <span class="p-score-value">${p.resultado}</span>
                    </div>
                    <div class="p-score-row">
                        <span class="p-score-label">Diferencia</span>
                        ${diffBadge(p.estimado, p.resultado)}
                    </div>
                ` : `<div class="p-no-result">Sin resultado aun</div>`}
                ${isMe ? `
                <div class="p-card-actions">
                    <button class="btn btn-danger btn-small" style="flex:1;justify-content:center;" onclick="openDelete('${p.firebaseKey}')">
                        <i data-lucide="trash-2" width="13" height="13"></i> Eliminar mi registro
                    </button>
                </div>` : ''}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="participants-grid">${cards}</div>`;
    renderIcons();
}

function renderList(container, data) {
    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:60px 20px;">
                <div class="empty-state-icon"><i data-lucide="users" width="48" height="48"></i></div>
                <p>No hay participantes aun.</p>
            </div>`;
        renderIcons();
        return;
    }

    const myKey = localStorage.getItem(MY_KEY);

    const rows = data.map(p => {
        const isMe = p.firebaseKey === myKey;
        return `
        <div class="p-row${isMe ? ' p-row--mine' : ''}">
            ${rowAvatar(p)}
            <div class="p-row-info">
                <div class="p-row-name">
                    ${p.nombre}
                    ${isMe ? `<span class="mine-tag" style="margin-left:8px;"><i data-lucide="user" width="10" height="10"></i> Tu</span>` : ''}
                </div>
                ${p.carrera ? `<div class="p-row-career"><i data-lucide="graduation-cap" width="10" height="10"></i>${p.carrera}</div>` : ''}
                <div class="p-row-sub">${formatDate(p.fechaRegistro)}</div>
            </div>
            <div class="p-row-scores">
                <div class="p-row-score">
                    <div class="p-row-score-label">Estimado</div>
                    <div class="p-row-score-value">${p.estimado}</div>
                </div>
                <div class="p-row-score">
                    <div class="p-row-score-label">Resultado</div>
                    <div class="p-row-score-value">${p.resultado !== null ? p.resultado : '—'}</div>
                </div>
                <div class="p-row-score">
                    <div class="p-row-score-label">Diferencia</div>
                    <div class="p-row-score-value">${diffBadge(p.estimado, p.resultado)}</div>
                </div>
            </div>
            ${isMe ? `
            <div class="p-row-actions">
                <button class="btn btn-danger btn-small" onclick="openDelete('${p.firebaseKey}')">
                    <i data-lucide="trash-2" width="13" height="13"></i>
                </button>
            </div>` : ''}
        </div>`;
    }).join('');

    container.innerHTML = `<div class="participants-list-view">${rows}</div>`;
    renderIcons();
}

// ── Delete modal ──────────────────────────────────────────────
window.openDelete = function(firebaseKey) {
    // Doble check: solo puede eliminar el propio
    if (firebaseKey !== localStorage.getItem(MY_KEY)) return;
    deletingKey = firebaseKey;
    document.getElementById('deleteModal').classList.add('open');
};

window.closeDeleteModal = function() {
    document.getElementById('deleteModal').classList.remove('open');
    deletingKey = null;
};

window.confirmDelete = async function() {
    if (!deletingKey || deletingKey !== localStorage.getItem(MY_KEY)) return;
    await participantesRef.child(deletingKey).remove();
    localStorage.removeItem(MY_KEY);
    localStorage.removeItem('icfes_2026_hoy_date');
    closeDeleteModal();
};

document.getElementById('deleteModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('deleteModal')) closeDeleteModal();
});

// ── View toggle ───────────────────────────────────────────────
document.getElementById('btnGrid').addEventListener('click', () => {
    currentView = 'grid';
    document.getElementById('btnGrid').classList.add('active');
    document.getElementById('btnList').classList.remove('active');
    render();
});

document.getElementById('btnList').addEventListener('click', () => {
    currentView = 'list';
    document.getElementById('btnList').classList.add('active');
    document.getElementById('btnGrid').classList.remove('active');
    render();
});

document.getElementById('searchInput').addEventListener('input', render);

// ── Boot ──────────────────────────────────────────────────────
initFirebase();
renderIcons();
