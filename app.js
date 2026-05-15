'use strict';

const APP_KEY      = 'icfes_2026_data';
const HOY_DATE_KEY = 'icfes_2026_hoy_date';
const RES_DATE_KEY = 'icfes_2026_res_date_';

// ── Utilities ─────────────────────────────────────────────────
function getHoyDate() { return new Date().toISOString().split('T')[0]; }
function getData()    { const s = localStorage.getItem(APP_KEY); return s ? JSON.parse(s) : []; }
function saveData(d)  { localStorage.setItem(APP_KEY, JSON.stringify(d)); }

function initials(nombre) {
    return nombre.trim().split(' ').slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function renderIcons() {
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Image helpers ─────────────────────────────────────────────
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

function avatarEl(foto, nombre, cssClass) {
    if (foto) return `<img src="${foto}" alt="${nombre}" class="${cssClass}">`;
    const tag = cssClass.includes('ranking') ? 'span' : 'div';
    return `<${tag} class="${cssClass.replace('avatar', 'avatar-placeholder')}">${initials(nombre)}</${tag}>`;
}

// ── State ─────────────────────────────────────────────────────
function yaIngresoHoy()               { return localStorage.getItem(HOY_DATE_KEY) === getHoyDate(); }
function puedeIngresarResultado(n)    { return localStorage.getItem(RES_DATE_KEY + n.toLowerCase()) !== getHoyDate(); }

// ── Data operations ───────────────────────────────────────────
function createParticipant(nombre, estimado, foto) {
    const data = getData();
    if (data.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())) return { exists: true };
    if (yaIngresoHoy()) return { yaIngreso: true };

    data.push({ id: Date.now(), nombre: nombre.trim(), estimado: parseInt(estimado, 10), resultado: null, foto: foto || null, fechaRegistro: new Date().toISOString() });
    saveData(data);
    localStorage.setItem(HOY_DATE_KEY, getHoyDate());
    return { success: true };
}

function updateResultado(nombre, resultado) {
    const data = getData();
    const p = data.find(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (!p) return { error: true };
    if (!puedeIngresarResultado(nombre)) return { yaIngreso: true };
    p.resultado = parseInt(resultado, 10);
    saveData(data);
    localStorage.setItem(RES_DATE_KEY + nombre.toLowerCase(), getHoyDate());
    return { success: true };
}

function deleteParticipant(id) { saveData(getData().filter(p => p.id !== id)); }

// ── Render: Tab Hoy ───────────────────────────────────────────
function renderParticipantesHoy() {
    const data = getData();
    const container = document.getElementById('participantesHoy');

    if (data.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="target" width="48" height="48"></i></div>
                <p>Aun no hay participantes. ¡Se el primero!</p>
            </div>`;
        renderIcons();
        return;
    }

    container.innerHTML = data.map(p => `
        <div class="participant-item">
            <div class="participant-left">
                ${avatarEl(p.foto, p.nombre, 'participant-avatar')}
                <div class="participant-info">
                    <div class="participant-name">${p.nombre}</div>
                    <div class="participant-estimado">
                        <span class="score-item">
                            <i data-lucide="target" width="13" height="13"></i>
                            Estimado: <strong>${p.estimado}</strong>
                        </span>
                        ${p.resultado !== null ? `
                        <span class="score-item result-ok">
                            <i data-lucide="check-circle" width="13" height="13"></i>
                            Resultado: <strong>${p.resultado}</strong>
                        </span>` : ''}
                    </div>
                </div>
            </div>
            <button class="btn btn-danger btn-small" onclick="deleteParticipantBtn(${p.id})">
                <i data-lucide="trash-2" width="13" height="13"></i> Eliminar
            </button>
        </div>
    `).join('');
    renderIcons();
}

// ── Render: Tab Resultados ────────────────────────────────────
function renderResultados() {
    const buscar    = document.getElementById('buscarNombre').value.toLowerCase().trim();
    const data      = getData();
    const container = document.getElementById('resultadosContainer');
    const comparacion = document.getElementById('comparacionContainer');

    if (!buscar) { container.innerHTML = ''; comparacion.innerHTML = ''; return; }

    const filtered = data.filter(p => p.nombre.toLowerCase().includes(buscar));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="error-message"><i data-lucide="x-circle" width="16" height="16"></i> No encontramos ningun participante con ese nombre.</div>`;
        comparacion.innerHTML = '';
        renderIcons();
        return;
    }

    container.innerHTML = filtered.map(p => {
        const puedeHoy = puedeIngresarResultado(p.nombre);
        return `
            <div class="result-block">
                <div class="flex-avatar-row">
                    ${avatarEl(p.foto, p.nombre, 'participant-avatar')}
                    <h3>${p.nombre}</h3>
                </div>
                <div class="resultado-display">
                    <strong>Tu estimacion: ${p.estimado}</strong>
                </div>
                ${p.resultado !== null ? `
                    <div class="info-message">
                        <i data-lucide="info" width="16" height="16"></i>
                        <span>Ya ingresaste tu resultado: <strong>${p.resultado}</strong> — vuelve manana para actualizar.</span>
                    </div>
                ` : puedeHoy ? `
                    <div class="form-group" style="margin-top:14px;">
                        <label for="res${p.id}">Tu resultado final (0–500)</label>
                        <input type="number" id="res${p.id}" min="0" max="500" placeholder="385">
                    </div>
                    <button class="btn btn-success" onclick="setResultadoBtn(${p.id},'res${p.id}')">
                        <i data-lucide="check-circle" width="16" height="16"></i> Guardar Resultado
                    </button>
                ` : `
                    <div class="warning-message">
                        <i data-lucide="clock" width="16" height="16"></i>
                        Ya ingresaste tu resultado hoy. Vuelve manana para actualizar.
                    </div>
                `}
            </div>
        `;
    }).join('');

    const conResultados = data.filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    if (conResultados.length === 0) { comparacion.innerHTML = ''; renderIcons(); return; }

    const rows = conResultados.map(p => {
        const diff = p.resultado - p.estimado;
        const cls  = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const sym  = diff > 0 ? '+' : '';
        return `
            <tr>
                <td><div class="table-avatar-cell">${avatarEl(p.foto, p.nombre, 'ranking-avatar')}<strong>${p.nombre}</strong></div></td>
                <td style="text-align:center;"><strong>${p.estimado}</strong></td>
                <td style="text-align:center;"><strong>${p.resultado}</strong></td>
                <td style="text-align:center;"><span class="difference ${cls}">${sym}${diff}</span></td>
            </tr>`;
    }).join('');

    comparacion.innerHTML = `
        <h3 class="section-h3" style="margin-top:24px;">Comparacion de todos</h3>
        <table class="comparison-table">
            <thead><tr><th>Nombre</th><th>Estimado</th><th>Resultado</th><th>Diferencia</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    renderIcons();
}

// ── Render: Tab Ranking ───────────────────────────────────────
function renderRanking() {
    const data = getData();
    const conResultados = data.filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    const container = document.getElementById('rankingContainer');
    const statsGrid = document.getElementById('statsGrid');

    if (conResultados.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="trophy" width="48" height="48"></i></div>
                <p>Aun no hay resultados registrados.</p>
            </div>`;
        statsGrid.innerHTML = '';
        renderIcons();
        return;
    }

    const promEst = Math.round(data.reduce((s, p) => s + p.estimado, 0) / data.length);
    const promRes = Math.round(conResultados.reduce((s, p) => s + p.resultado, 0) / conResultados.length);
    const maxRes  = Math.max(...conResultados.map(p => p.resultado));
    const minRes  = Math.min(...conResultados.map(p => p.resultado));

    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Prom. Estimado</div>
            <div class="stat-value">${promEst}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Prom. Real</div>
            <div class="stat-value">${promRes}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Maximo</div>
            <div class="stat-value">${maxRes}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Minimo</div>
            <div class="stat-value">${minRes}</div>
        </div>`;

    const rankClass = ['rank-1', 'rank-2', 'rank-3'];
    const rows = conResultados.map((p, i) => {
        const diff = p.resultado - p.estimado;
        const cls  = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const sym  = diff > 0 ? '+' : '';
        const badge = `<span class="rank-badge ${rankClass[i] || ''}">${i + 1}</span>`;
        return `
            <tr>
                <td style="text-align:center;">${badge}</td>
                <td><div class="table-avatar-cell">${avatarEl(p.foto, p.nombre, 'ranking-avatar')}<span>${p.nombre}</span></div></td>
                <td style="text-align:center;"><strong>${p.estimado}</strong></td>
                <td style="text-align:center;"><strong>${p.resultado}</strong></td>
                <td style="text-align:center;"><span class="difference ${cls}">${sym}${diff}</span></td>
            </tr>`;
    }).join('');

    container.innerHTML = `
        <table class="comparison-table">
            <thead><tr><th></th><th>Nombre</th><th>Estimado</th><th>Resultado</th><th>Diferencia</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    renderIcons();
}

// ── Button handlers ───────────────────────────────────────────
window.setResultadoBtn = function(id, inputId) {
    const resultado = document.getElementById(inputId).value;
    if (!resultado) { alert('Ingresa tu resultado'); return; }

    const p   = getData().find(p => p.id === id);
    const res = updateResultado(p.nombre, resultado);
    const msg = document.getElementById('resultadosMessage');

    if (res.yaIngreso) {
        msg.innerHTML = `<div class="warning-message"><i data-lucide="clock" width="16" height="16"></i> Ya ingresaste tu resultado hoy. Vuelve manana para actualizar.</div>`;
    } else if (res.success) {
        msg.innerHTML = `<div class="success-message"><i data-lucide="check-circle" width="16" height="16"></i> Resultado registrado correctamente.</div>`;
        renderResultados();
        setTimeout(() => msg.innerHTML = '', 5000);
    }
    renderIcons();
};

window.deleteParticipantBtn = function(id) {
    if (confirm('¿Eliminar este registro?')) {
        deleteParticipant(id);
        renderParticipantesHoy();
    }
};

// ── Image upload (form Hoy) ───────────────────────────────────
let pendingFoto = null;

function setupImageUpload() {
    const fileInput   = document.getElementById('fotoInput');
    const uploadArea  = document.getElementById('uploadArea');
    const previewWrap = document.getElementById('imagePreviewWrap');
    const previewImg  = document.getElementById('imagePreview');
    const removeBtn   = document.getElementById('removeImageBtn');
    const uploadText  = document.getElementById('uploadText');

    async function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        pendingFoto    = await resizeImage(file);
        previewImg.src = pendingFoto;
        previewWrap.classList.add('visible');
        uploadText.style.display = 'none';
    }

    fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
    uploadArea.addEventListener('dragover',  (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', ()  => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFile(e.dataTransfer.files[0]);
    });
    removeBtn.addEventListener('click', () => {
        pendingFoto = null;
        fileInput.value = '';
        previewWrap.classList.remove('visible');
        uploadText.style.display = '';
    });
}

document.getElementById('formHoy').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nombre   = document.getElementById('nombre').value;
    const estimado = document.getElementById('estimado').value;
    const msg      = document.getElementById('hoyMessage');

    const result = createParticipant(nombre, estimado, pendingFoto);

    if (result.exists) {
        msg.innerHTML = `<div class="error-message"><i data-lucide="x-circle" width="16" height="16"></i> Ese nombre ya esta registrado.</div>`;
    } else if (result.yaIngreso) {
        msg.innerHTML = `<div class="warning-message"><i data-lucide="clock" width="16" height="16"></i> Ya ingresaste tu estimado hoy. Vuelve manana para poner tu resultado.</div>`;
    } else if (result.success) {
        msg.innerHTML = `<div class="success-message"><i data-lucide="check-circle" width="16" height="16"></i> Estimado guardado. Vuelve manana para ingresar tu resultado.</div>`;
        this.reset();
        pendingFoto = null;
        document.getElementById('imagePreviewWrap').classList.remove('visible');
        document.getElementById('uploadText').style.display = '';
        renderParticipantesHoy();
        setTimeout(() => msg.innerHTML = '', 5000);
    }
    renderIcons();
});

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(tab).classList.add('active');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        if (tab === 'ranking') renderRanking();
    });
});

document.getElementById('buscarNombre').addEventListener('input', renderResultados);

// ── Boot ──────────────────────────────────────────────────────
setupImageUpload();
renderParticipantesHoy();
renderIcons();
