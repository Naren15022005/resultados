'use strict';

// Restricciones por dispositivo (localStorage)
const HOY_DATE_KEY = 'icfes_2026_hoy_date';
const RES_DATE_KEY = 'icfes_2026_res_date_';

let participantesRef;
let currentData = []; // sincronizado en tiempo real desde Firebase

// ── Firebase ──────────────────────────────────────────────────
function initFirebase() {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    participantesRef = db.ref('participantes');

    // Indicador de conexion
    firebase.database().ref('.info/connected').on('value', (snap) => {
        const el = document.getElementById('connectionDot');
        if (!el) return;
        const ok = snap.val() === true;
        el.style.background    = ok ? 'var(--success)' : 'var(--danger)';
        el.style.boxShadow     = ok ? '0 0 8px var(--success)' : '0 0 8px var(--danger)';
        el.title               = ok ? 'Conectado en tiempo real' : 'Sin conexion';
    });

    // Listener principal — se dispara cada vez que alguien cambia datos
    participantesRef.on('value', (snapshot) => {
        const raw = snapshot.val() || {};
        currentData = Object.entries(raw)
            .map(([key, val]) => ({ ...val, firebaseKey: key }))
            .sort((a, b) => new Date(a.fechaRegistro) - new Date(b.fechaRegistro));

        renderParticipantesHoy();

        const activeId = document.querySelector('.tab-content.active')?.id;
        if (activeId === 'ranking')    renderRanking();
        if (activeId === 'resultados') renderResultados();
        if (activeId === 'album')      renderAlbum();
    });
}

// ── Utilities ─────────────────────────────────────────────────
function getHoyDate() { return new Date().toISOString().split('T')[0]; }
function yaIngresoHoy() { return localStorage.getItem(HOY_DATE_KEY) === getHoyDate(); }
function puedeIngresarResultado(nombre) { return localStorage.getItem(RES_DATE_KEY + nombre.toLowerCase()) !== getHoyDate(); }

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

// ── Data operations (Firebase) ────────────────────────────────
async function createParticipant(nombre, estimado, foto, carrera, albumFoto) {
    if (yaIngresoHoy()) return { yaIngreso: true };

    const exists = currentData.some(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    if (exists) return { exists: true };

    const ref = await participantesRef.push({
        nombre:        nombre.trim(),
        estimado:      parseInt(estimado, 10),
        resultado:     null,
        foto:          foto || null,
        carrera:       carrera?.trim() || null,
        albumFoto:     albumFoto || null,
        fechaRegistro: new Date().toISOString()
    });

    localStorage.setItem(HOY_DATE_KEY, getHoyDate());
    localStorage.setItem('icfes_my_key', ref.key);
    return { success: true };
}

async function updateResultado(firebaseKey, nombre, resultado) {
    if (!puedeIngresarResultado(nombre)) return { yaIngreso: true };

    await participantesRef.child(firebaseKey).update({ resultado: parseInt(resultado, 10) });
    localStorage.setItem(RES_DATE_KEY + nombre.toLowerCase(), getHoyDate());
    return { success: true };
}

function deleteParticipant(firebaseKey) {
    participantesRef.child(firebaseKey).remove();
}

// ── Migración localStorage → Firebase ────────────────────────
function checkLocalMigration() {
    const banner = document.getElementById('migrationBanner');
    if (!banner) return;
    const stored = localStorage.getItem('icfes_2026_data');
    if (!stored) { banner.style.display = 'none'; return; }
    try {
        const old = JSON.parse(stored);
        if (!old || old.length === 0) { banner.style.display = 'none'; return; }
        banner.style.display = 'flex';
        document.getElementById('migrationCount').textContent = old.length;
    } catch (e) { banner.style.display = 'none'; }
}

window.runMigration = async function() {
    const stored = localStorage.getItem('icfes_2026_data');
    if (!stored) return;
    const old = JSON.parse(stored);
    const btn = document.getElementById('migrationBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader" width="15" height="15"></i> Subiendo...';
    renderIcons();

    for (const p of old) {
        const exists = currentData.some(d => d.nombre.toLowerCase() === p.nombre.toLowerCase());
        if (!exists) {
            await participantesRef.push({
                nombre:        p.nombre,
                estimado:      p.estimado,
                resultado:     p.resultado ?? null,
                foto:          p.foto || null,
                fechaRegistro: p.fechaRegistro || new Date().toISOString()
            });
        }
    }
    localStorage.removeItem('icfes_2026_data');
    document.getElementById('migrationBanner').style.display = 'none';
};

// ── Render: Tab Hoy ───────────────────────────────────────────
function renderParticipantesHoy() {
    const container = document.getElementById('participantesHoy');
    if (!container) return;
    checkLocalMigration();

    if (currentData.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="target" width="48" height="48"></i></div>
                <p>Aun no hay participantes. ¡Se el primero!</p>
            </div>`;
        renderIcons();
        return;
    }

    const myKey = localStorage.getItem('icfes_my_key');

    container.innerHTML = currentData.map(p => `
        <div class="participant-item">
            <div class="participant-left">
                ${avatarEl(p.foto, p.nombre, 'participant-avatar')}
                <div class="participant-info">
                    <div class="participant-name">${p.nombre}</div>
                    ${p.carrera ? `<div class="participant-career"><i data-lucide="graduation-cap" width="11" height="11"></i>${p.carrera}</div>` : ''}
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
            ${p.firebaseKey === myKey ? `
            <button class="btn btn-danger btn-small" onclick="deleteParticipantBtn('${p.firebaseKey}')">
                <i data-lucide="trash-2" width="13" height="13"></i>
            </button>` : ''}
        </div>
    `).join('');
    renderIcons();
}

// ── Render: Tab Resultados ────────────────────────────────────
function renderResultados() {
    const buscar      = document.getElementById('buscarNombre').value.toLowerCase().trim();
    const container   = document.getElementById('resultadosContainer');
    const comparacion = document.getElementById('comparacionContainer');

    if (!buscar) { container.innerHTML = ''; comparacion.innerHTML = ''; return; }

    const filtered = currentData.filter(p => p.nombre.toLowerCase().includes(buscar));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="error-message"><i data-lucide="x-circle" width="16" height="16"></i> No encontramos ningun participante con ese nombre.</div>`;
        comparacion.innerHTML = '';
        renderIcons();
        return;
    }

    container.innerHTML = filtered.map(p => {
        const puedeHoy = puedeIngresarResultado(p.nombre);
        const safeKey  = p.firebaseKey.replace(/-/g, '_');
        const inputId  = `res_${safeKey}`;
        return `
            <div class="result-block">
                <div class="flex-avatar-row">
                    ${avatarEl(p.foto, p.nombre, 'participant-avatar')}
                    <div>
                        <h3 style="margin:0;">${p.nombre}</h3>
                        ${p.carrera ? `<div class="participant-career" style="margin-top:4px;"><i data-lucide="graduation-cap" width="11" height="11"></i>${p.carrera}</div>` : ''}
                    </div>
                </div>
                <div class="resultado-display">
                    <strong>Estimado: ${p.estimado}</strong>
                    ${p.carrera ? `&nbsp;·&nbsp;<span style="color:var(--accent);font-size:0.9em;">${p.carrera}</span>` : ''}
                </div>
                ${p.resultado !== null ? `
                    <div class="info-message">
                        <i data-lucide="info" width="16" height="16"></i>
                        <span>Ya ingresaste tu resultado: <strong>${p.resultado}</strong> — vuelve manana para actualizar.</span>
                    </div>
                ` : puedeHoy ? `
                    <div class="form-group" style="margin-top:14px;">
                        <label for="${inputId}">Tu resultado final (0–500)</label>
                        <input type="number" id="${inputId}" min="0" max="500" placeholder="385">
                    </div>
                    <button class="btn btn-success" onclick="setResultadoBtn('${p.firebaseKey}', '${inputId}')">
                        <i data-lucide="check-circle" width="16" height="16"></i> Guardar Resultado
                    </button>
                ` : `
                    <div class="warning-message">
                        <i data-lucide="clock" width="16" height="16"></i>
                        Ya ingresaste tu resultado hoy. Vuelve manana para actualizar.
                    </div>
                `}
            </div>`;
    }).join('');

    // Tabla comparacion
    const conResultados = currentData.filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    if (conResultados.length > 0) {
        const rows = conResultados.map(p => {
            const diff = p.resultado - p.estimado;
            const cls  = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
            const sym  = diff > 0 ? '+' : '';
            return `
                <tr>
                    <td>
                        <div class="table-avatar-cell">${avatarEl(p.foto, p.nombre, 'ranking-avatar')}
                            <div>
                                <strong>${p.nombre}</strong>
                                ${p.carrera ? `<div style="font-size:0.75em;color:var(--accent);margin-top:1px;">${p.carrera}</div>` : ''}
                            </div>
                        </div>
                    </td>
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
    } else {
        comparacion.innerHTML = '';
    }
    renderIcons();
}

// ── Render: Tab Ranking ───────────────────────────────────────
function renderRanking() {
    const conResultados = currentData.filter(p => p.resultado !== null).sort((a, b) => b.resultado - a.resultado);
    const container  = document.getElementById('rankingContainer');
    const statsGrid  = document.getElementById('statsGrid');

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

    const promEst = Math.round(currentData.reduce((s, p) => s + p.estimado, 0) / currentData.length);
    const promRes = Math.round(conResultados.reduce((s, p) => s + p.resultado, 0) / conResultados.length);
    const maxRes  = Math.max(...conResultados.map(p => p.resultado));
    const minRes  = Math.min(...conResultados.map(p => p.resultado));

    statsGrid.innerHTML = `
        <div class="stat-card"><div class="stat-label">Prom. Estimado</div><div class="stat-value">${promEst}</div></div>
        <div class="stat-card"><div class="stat-label">Prom. Real</div><div class="stat-value">${promRes}</div></div>
        <div class="stat-card"><div class="stat-label">Maximo</div><div class="stat-value">${maxRes}</div></div>
        <div class="stat-card"><div class="stat-label">Minimo</div><div class="stat-value">${minRes}</div></div>`;

    const rankClass = ['rank-1', 'rank-2', 'rank-3'];
    const rows = conResultados.map((p, i) => {
        const diff = p.resultado - p.estimado;
        const cls  = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
        const sym  = diff > 0 ? '+' : '';
        return `
            <tr>
                <td style="text-align:center;"><span class="rank-badge ${rankClass[i] || ''}">${i + 1}</span></td>
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
        </table>
        ${buildCareerRankingHTML(conResultados)}`;
    renderIcons();
}

function buildCareerRankingHTML(conResultados) {
    const byCarrera = {};
    conResultados.forEach(p => {
        if (!p.carrera) return;
        const key = p.carrera.trim();
        if (!byCarrera[key]) byCarrera[key] = [];
        byCarrera[key].push(p);
    });

    const entries = Object.entries(byCarrera);
    if (entries.length === 0) return '';

    entries.forEach(([, arr]) => arr.sort((a, b) => b.resultado - a.resultado));
    entries.sort((a, b) => b[1][0].resultado - a[1][0].resultado);

    const cards = entries.map(([carrera, participants]) => {
        const rows = participants.map((p, i) => `
            <div class="career-row${i === 0 ? ' career-winner-row' : ''}">
                ${avatarEl(p.foto, p.nombre, 'ranking-avatar')}
                <div class="career-row-info">
                    <div class="career-row-name">${p.nombre}</div>
                    <div class="career-row-score">${p.resultado} pts</div>
                </div>
                ${i === 0
                    ? `<span class="career-crown"><i data-lucide="crown" width="16" height="16"></i></span>`
                    : `<span style="color:var(--text-dim);font-size:0.8em;">#${i + 1}</span>`}
            </div>`).join('');
        return `
        <div class="career-card">
            <div class="career-card-title">
                <i data-lucide="graduation-cap" width="14" height="14"></i>
                ${carrera}
            </div>
            ${rows}
        </div>`;
    }).join('');

    return `
        <div class="career-section-title">
            <i data-lucide="graduation-cap" width="18" height="18"></i>
            Ranking por Carrera
        </div>
        <div class="career-cards-grid">${cards}</div>`;
}

// ── Render: Tab Álbum ─────────────────────────────────────────
function renderAlbum() {
    const container = document.getElementById('albumContainer');
    if (!container) return;
    const withAlbum = currentData.filter(p => p.albumFoto);
    if (withAlbum.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i data-lucide="image" width="48" height="48"></i></div>
                <p>Aun no hay fotos en el álbum.</p>
            </div>`;
        renderIcons();
        return;
    }
    container.innerHTML = `<div class="album-grid">${withAlbum.map(p => `
        <div class="album-card" onclick="openLightbox('${p.firebaseKey}')">
            <img src="${p.albumFoto}" alt="${p.nombre}" loading="lazy">
            <div class="album-card-overlay">
                <div class="album-card-name">${p.nombre}</div>
                ${p.carrera ? `<div class="album-card-career">${p.carrera}</div>` : ''}
                ${p.resultado !== null ? `<div class="album-card-score">${p.resultado} pts</div>` : ''}
            </div>
        </div>`).join('')}</div>`;
    renderIcons();
}

window.openLightbox = function(firebaseKey) {
    const p = currentData.find(p => p.firebaseKey === firebaseKey);
    if (!p || !p.albumFoto) return;
    document.getElementById('lightboxImg').src = p.albumFoto;
    document.getElementById('lightboxInfo').innerHTML = `
        <div style="font-weight:700;font-size:1em;">${p.nombre}</div>
        ${p.carrera ? `<div style="color:var(--accent);font-size:0.85em;">${p.carrera}</div>` : ''}
        ${p.resultado !== null ? `<div style="color:var(--success);font-size:0.85em;">${p.resultado} pts</div>` : ''}`;
    document.getElementById('lightbox').classList.add('open');
};

window.closeLightbox = function() {
    document.getElementById('lightbox').classList.remove('open');
};

// ── Button handlers ───────────────────────────────────────────
window.setResultadoBtn = async function(firebaseKey, inputId) {
    const resultado = document.getElementById(inputId)?.value;
    if (!resultado) { alert('Ingresa tu resultado'); return; }

    const p   = currentData.find(p => p.firebaseKey === firebaseKey);
    if (!p) return;

    const res = await updateResultado(firebaseKey, p.nombre, resultado);
    const msg = document.getElementById('resultadosMessage');

    if (res.yaIngreso) {
        msg.innerHTML = `<div class="warning-message"><i data-lucide="clock" width="16" height="16"></i> Ya ingresaste tu resultado hoy. Vuelve manana para actualizar.</div>`;
    } else if (res.success) {
        msg.innerHTML = `<div class="success-message"><i data-lucide="check-circle" width="16" height="16"></i> Resultado registrado correctamente.</div>`;
        setTimeout(() => msg.innerHTML = '', 5000);
    }
    renderIcons();
};

window.deleteParticipantBtn = function(firebaseKey) {
    if (confirm('¿Eliminar este registro?')) deleteParticipant(firebaseKey);
};

// ── Image upload ──────────────────────────────────────────────
let pendingFoto = null;
let pendingAlbumFoto = null;

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

    // Album photo upload
    const albumFileInput   = document.getElementById('albumFotoInput');
    const albumUploadArea  = document.getElementById('albumUploadArea');
    const albumPreviewWrap = document.getElementById('albumPreviewWrap');
    const albumPreviewImg  = document.getElementById('albumPreview');
    const removeAlbumBtn   = document.getElementById('removeAlbumBtn');
    const albumUploadText  = document.getElementById('albumUploadText');

    async function handleAlbumFile(file) {
        if (!file || !file.type.startsWith('image/')) return;
        pendingAlbumFoto    = await resizeImage(file, 400, 0.8);
        albumPreviewImg.src = pendingAlbumFoto;
        albumPreviewWrap.classList.add('visible');
        albumUploadText.style.display = 'none';
    }

    albumFileInput.addEventListener('change', (e) => handleAlbumFile(e.target.files[0]));
    albumUploadArea.addEventListener('dragover',  (e) => { e.preventDefault(); albumUploadArea.classList.add('drag-over'); });
    albumUploadArea.addEventListener('dragleave', ()  => albumUploadArea.classList.remove('drag-over'));
    albumUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        albumUploadArea.classList.remove('drag-over');
        handleAlbumFile(e.dataTransfer.files[0]);
    });
    removeAlbumBtn.addEventListener('click', () => {
        pendingAlbumFoto = null;
        albumFileInput.value = '';
        albumPreviewWrap.classList.remove('visible');
        albumUploadText.style.display = '';
    });
}

document.getElementById('formHoy').addEventListener('submit', async function(e) {
    e.preventDefault();
    const nombre   = document.getElementById('nombre').value;
    const estimado = document.getElementById('estimado').value;
    const carrera  = document.getElementById('carrera').value;
    const msg      = document.getElementById('hoyMessage');

    const result = await createParticipant(nombre, estimado, pendingFoto, carrera, pendingAlbumFoto);

    if (result.exists) {
        msg.innerHTML = `<div class="error-message"><i data-lucide="x-circle" width="16" height="16"></i> Ese nombre ya esta registrado.</div>`;
    } else if (result.yaIngreso) {
        msg.innerHTML = `<div class="warning-message"><i data-lucide="clock" width="16" height="16"></i> Ya ingresaste tu estimado hoy. Vuelve manana para poner tu resultado.</div>`;
    } else if (result.success) {
        msg.innerHTML = `<div class="success-message"><i data-lucide="check-circle" width="16" height="16"></i> Estimado guardado. Vuelve manana para ingresar tu resultado.</div>`;
        this.reset();
        pendingFoto = null;
        pendingAlbumFoto = null;
        document.getElementById('imagePreviewWrap').classList.remove('visible');
        document.getElementById('uploadText').style.display = '';
        document.getElementById('albumPreviewWrap').classList.remove('visible');
        document.getElementById('albumUploadText').style.display = '';
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
        if (tab === 'album')   renderAlbum();
    });
});

document.getElementById('buscarNombre').addEventListener('input', renderResultados);

// ── Boot ──────────────────────────────────────────────────────
setupImageUpload();
initFirebase();
renderIcons();
