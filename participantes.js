'use strict';

const APP_KEY = 'icfes_2026_data';

let currentView     = 'grid';
let editingId       = null;
let deletingId      = null;
let editPendingFoto = undefined;

// ── Data ──────────────────────────────────────────────────────
function getData()      { const s = localStorage.getItem(APP_KEY); return s ? JSON.parse(s) : []; }
function saveData(data) { localStorage.setItem(APP_KEY, JSON.stringify(data)); }

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

// ── Avatar helpers ────────────────────────────────────────────
function cardAvatar(p) {
    if (p.foto) return `<img src="${p.foto}" alt="${p.nombre}" class="p-card-avatar">`;
    return `<div class="p-card-avatar-placeholder">${initials(p.nombre)}</div>`;
}

function rowAvatar(p) {
    if (p.foto) return `<img src="${p.foto}" alt="${p.nombre}" class="p-row-avatar">`;
    return `<div class="p-row-avatar-placeholder">${initials(p.nombre)}</div>`;
}

function diffBadge(estimado, resultado) {
    if (resultado === null) return '—';
    const d   = resultado - estimado;
    const cls = d > 0 ? 'positive' : d < 0 ? 'negative' : 'neutral';
    const sym = d > 0 ? '+' : '';
    return `<span class="difference ${cls}">${sym}${d}</span>`;
}

// ── Summary ───────────────────────────────────────────────────
function renderSummary(data) {
    const total        = data.length;
    const conResultado = data.filter(p => p.resultado !== null).length;
    const sinResultado = total - conResultado;
    const promEst      = total ? Math.round(data.reduce((s, p) => s + p.estimado, 0) / total) : 0;
    const promRes      = conResultado
        ? Math.round(data.filter(p => p.resultado !== null).reduce((s, p) => s + p.resultado, 0) / conResultado)
        : null;

    document.getElementById('summaryBar').innerHTML = `
        <div class="summary-pill"><i data-lucide="users" width="13" height="13"></i> ${total} participante${total !== 1 ? 's' : ''}</div>
        <div class="summary-pill"><i data-lucide="check-circle" width="13" height="13"></i> ${conResultado} con resultado</div>
        <div class="summary-pill"><i data-lucide="clock" width="13" height="13"></i> ${sinResultado} sin resultado</div>
        <div class="summary-pill"><i data-lucide="bar-chart-2" width="13" height="13"></i> Prom. estimado: ${promEst}</div>
        ${promRes !== null ? `<div class="summary-pill"><i data-lucide="target" width="13" height="13"></i> Prom. real: ${promRes}</div>` : ''}
    `;
    renderIcons();
}

// ── Main render ───────────────────────────────────────────────
function render() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    const data  = getData().filter(p => !query || p.nombre.toLowerCase().includes(query));
    renderSummary(getData());
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

    const rankClass = ['rank-1', 'rank-2', 'rank-3'];
    const sorted    = [...data].sort((a, b) => (b.resultado ?? -1) - (a.resultado ?? -1));

    const cards = data.map(p => {
        const rankIdx = sorted.findIndex(s => s.id === p.id);
        const badge   = p.resultado !== null && rankIdx < 3
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
                    <button class="btn btn-primary btn-small" onclick="openEdit(${p.id})">
                        <i data-lucide="pencil" width="13" height="13"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-small" onclick="openDelete(${p.id})">
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
                <button class="btn btn-primary btn-small" onclick="openEdit(${p.id})">
                    <i data-lucide="pencil" width="13" height="13"></i> Editar
                </button>
                <button class="btn btn-danger btn-small" onclick="openDelete(${p.id})">
                    <i data-lucide="trash-2" width="13" height="13"></i>
                </button>
            </div>
        </div>`).join('');

    container.innerHTML = `<div class="participants-list-view">${rows}</div>`;
    renderIcons();
}

// ── Edit modal ────────────────────────────────────────────────
window.openEdit = function(id) {
    const p = getData().find(p => p.id === id);
    if (!p) return;

    editingId       = id;
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
    editingId = null; editPendingFoto = undefined;
};

window.saveEdit = function() {
    const data = getData();
    const p    = data.find(p => p.id === editingId);
    if (!p) return;

    const estimado  = parseInt(document.getElementById('editEstimado').value, 10);
    const resVal    = document.getElementById('editResultado').value;
    const resultado = resVal !== '' ? parseInt(resVal, 10) : null;

    if (isNaN(estimado) || estimado < 0 || estimado > 500) { alert('Estimado invalido (0–500)'); return; }
    if (resultado !== null && (isNaN(resultado) || resultado < 0 || resultado > 500)) { alert('Resultado invalido (0–500)'); return; }

    p.estimado  = estimado;
    p.resultado = resultado;
    if (editPendingFoto !== undefined) p.foto = editPendingFoto;

    saveData(data);
    closeModal();
    render();
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
window.openDelete = function(id) {
    deletingId = id;
    document.getElementById('deleteModal').classList.add('open');
};

window.closeDeleteModal = function() {
    document.getElementById('deleteModal').classList.remove('open');
    deletingId = null;
};

window.confirmDelete = function() {
    if (!deletingId) return;
    saveData(getData().filter(p => p.id !== deletingId));
    closeDeleteModal();
    render();
};

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('open');
            editingId = null; deletingId = null; editPendingFoto = undefined;
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
render();
renderIcons();
