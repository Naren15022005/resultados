'use strict';

let currentView     = 'grid';
let editingKey      = null;
let deletingKey     = null;
let editPendingFoto = undefined;
let currentData     = [];

let participantesRef;

// ── Admin gate ────────────────────────────────────────────────
function checkAdmin() {
    const SESSION_KEY = 'icfes_admin_ok';

    if (sessionStorage.getItem(SESSION_KEY) === '1') {
        showApp();
        return;
    }

    const gate  = document.getElementById('adminGate');
    const input = document.getElementById('adminPasswordInput');
    const error = document.getElementById('adminError');
    const btn   = document.getElementById('adminSubmitBtn');

    lucide.createIcons();

    function tryLogin() {
        if (input.value === ADMIN_PASSWORD) {
            sessionStorage.setItem(SESSION_KEY, '1');
            gate.style.display = 'none';
            showApp();
        } else {
            error.style.display = 'flex';
            input.value = '';
            input.focus();
        }
    }

    btn.addEventListener('click', tryLogin);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryLogin(); });
}

function showApp() {
    document.getElementById('mainContent').style.display = '';
    initFirebase();
    renderIcons();
}

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

    const sorted    = [...currentData].filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    const rankClass = ['rank-1', 'rank-2', 'rank-3'];

    const cards = data.map(p => {
        const rankIdx = sorted.findIndex(s => s.firebaseKey === p.firebaseKey);
        const badge   = rankIdx >= 0 && rankIdx < 3
            ? `<span class="rank-badge ${rankClass[rankIdx]}" style="position:absolute;top:12px;right:12px;">${rankIdx + 1}</span>`
            : '';
        return `
        <div class="p-card">
            <div class="p-card-header" style="position:relative;">
                ${badge}
                ${cardAvatar(p)}
                <div class="p-card-name">${p.nombre}</div>
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
                <div class="p-card-actions">
                    <button class="btn btn-primary btn-small" onclick="openEdit('${p.firebaseKey}')">
                        <i data-lucide="pencil" width="13" height="13"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-small" onclick="openDelete('${p.firebaseKey}')">
                        <i data-lucide="trash-2" width="13" height="13"></i>
                    </button>
                </div>
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

    const rows = data.map(p => `
        <div class="p-row">
            ${rowAvatar(p)}
            <div class="p-row-info">
                <div class="p-row-name">${p.nombre}</div>
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
            <div class="p-row-actions">
                <button class="btn btn-primary btn-small" onclick="openEdit('${p.firebaseKey}')">
                    <i data-lucide="pencil" width="13" height="13"></i> Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="openDelete('${p.firebaseKey}')">
                    <i data-lucide="trash-2" width="13" height="13"></i>
                </button>
            </div>
        </div>`).join('');

    container.innerHTML = `<div class="participants-list-view">${rows}</div>`;
    renderIcons();
}

// ── Edit modal ────────────────────────────────────────────────
window.openEdit = function(firebaseKey) {
    const p = currentData.find(p => p.firebaseKey === firebaseKey);
    if (!p) return;

    editingKey      = firebaseKey;
    editPendingFoto = undefined;

    document.getElementById('editModalTitle').textContent = `Editar — ${p.nombre}`;
    document.getElementById('editNombre').value    = p.nombre;
    document.getElementById('editEstimado').value  = p.estimado;
    document.getElementById('editResultado').value = p.resultado !== null ? p.resultado : '';
    document.getElementById('editFotoInput').value = '';

    const previewWrap = document.getElementById('editPreviewWrap');
    const previewImg  = document.getElementById('editPreview');
    const uploadText  = document.getElementById('editUploadText');

    if (p.foto) {
        previewImg.src = p.foto;
        previewWrap.classList.add('visible');
        uploadText.style.display = 'none';
    } else {
        previewWrap.classList.remove('visible');
        uploadText.style.display = '';
    }

    document.getElementById('editModal').classList.add('open');
};

window.closeModal = function() {
    document.getElementById('editModal').classList.remove('open');
    editingKey = null; editPendingFoto = undefined;
};

window.saveEdit = async function() {
    const estimado = parseInt(document.getElementById('editEstimado').value, 10);
    const resVal   = document.getElementById('editResultado').value;
    const resultado = resVal !== '' ? parseInt(resVal, 10) : null;

    if (isNaN(estimado) || estimado < 0 || estimado > 500) { alert('Estimado invalido (0–500)'); return; }
    if (resultado !== null && (isNaN(resultado) || resultado < 0 || resultado > 500)) { alert('Resultado invalido (0–500)'); return; }

    const updates = { estimado, resultado };
    if (editPendingFoto !== undefined) updates.foto = editPendingFoto;

    await participantesRef.child(editingKey).update(updates);
    closeModal();
};

document.getElementById('editFotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    editPendingFoto = await resizeImage(file);
    document.getElementById('editPreview').src = editPendingFoto;
    document.getElementById('editPreviewWrap').classList.add('visible');
    document.getElementById('editUploadText').style.display = 'none';
});

document.getElementById('editRemoveImg').addEventListener('click', () => {
    editPendingFoto = null;
    document.getElementById('editFotoInput').value = '';
    document.getElementById('editPreviewWrap').classList.remove('visible');
    document.getElementById('editUploadText').style.display = '';
});

// ── Delete modal ──────────────────────────────────────────────
window.openDelete = function(firebaseKey) {
    deletingKey = firebaseKey;
    document.getElementById('deleteModal').classList.add('open');
};

window.closeDeleteModal = function() {
    document.getElementById('deleteModal').classList.remove('open');
    deletingKey = null;
};

window.confirmDelete = async function() {
    if (!deletingKey) return;
    await participantesRef.child(deletingKey).remove();
    closeDeleteModal();
};

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
            editingKey = null; deletingKey = null; editPendingFoto = undefined;
        }
    });
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
checkAdmin();
