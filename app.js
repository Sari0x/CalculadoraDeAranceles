import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAVVpSUammfePWZUuwNfuzHCbLrbQFwx0U",
  authDomain: "calculadoradearanceles-80176.firebaseapp.com",
  projectId: "calculadoradearanceles-80176",
  storageBucket: "calculadoradearanceles-80176.firebasestorage.app",
  messagingSenderId: "186049471997",
  appId: "1:186049471997:web:4447893b1899683dfbe594",
  measurementId: "G-XY8D3CWMVX"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tariffsRef = ref(db, 'tariffs');

document.addEventListener('DOMContentLoaded', () => {
    const comisionInput = document.getElementById('comision');
    const recuperoInput = document.getElementById('recupero');
    const markupResult = document.getElementById('markup-result');
    const saveBtn = document.getElementById('save-tariff-btn');
    const recargoActualInput = document.getElementById('recargo-actual');
    const recargoObjetivoInput = document.getElementById('recargo-objetivo');
    const ajusteResult = document.getElementById('ajuste-result');
    const tariffsList = document.getElementById('tariffs-list');
    
    const saveModal = document.getElementById('save-modal');
    const storeNameInput = document.getElementById('store-name');
    const storeImageFile = document.getElementById('store-image-file');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const confirmSaveBtn = document.getElementById('confirm-save');
    const cancelSaveBtn = document.getElementById('cancel-save');

    let currentMarkup = null;
    let base64Image = null;
    let currentItems = {};
    let editingId = null;

    const parseInput = (val) => {
        if (!val) return 0;
        let str = val.toString().replace('%', '').replace(',', '.').trim();
        return parseFloat(str) / 100;
    };

    const calculateMarkup = (com, rec) => {
        const iva = 0.21;
        const descuento = com + rec;
        const descuentoConIVA = descuento + (descuento * iva);
        if (descuento >= 1 || descuentoConIVA >= 1) return null;
        return (((1 / (1 - descuentoConIVA)) - 1) * 100).toFixed(2);
    };

    const updateMainCalculation = () => {
        const com = parseInput(comisionInput.value);
        const rec = parseInput(recuperoInput.value);
        const result = calculateMarkup(com, rec);
        
        if (result === null) {
            markupResult.textContent = "Inválido";
            saveBtn.disabled = true;
            currentMarkup = null;
        } else {
            currentMarkup = result;
            markupResult.textContent = `${result}%`;
            saveBtn.disabled = false;
        }
    };

    const calculateAdjustment = () => {
        const actual = parseInput(recargoActualInput.value) * 100;
        const objetivo = parseInput(recargoObjetivoInput.value) * 100;
        if (isNaN(actual) || isNaN(objetivo)) {
            ajusteResult.textContent = "---";
            return;
        }
        const adjustment = (((1 + (objetivo/100)) / (1 + (actual/100))) - 1) * 100;
        ajusteResult.textContent = `${adjustment.toFixed(2)}%`;
    };

    storeImageFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 200;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    base64Image = canvas.toDataURL('image/jpeg', 0.7);
                    imagePreview.src = base64Image;
                    imagePreviewContainer.style.display = 'block';
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    saveBtn.onclick = () => {
        storeNameInput.value = '';
        storeImageFile.value = '';
        imagePreviewContainer.style.display = 'none';
        base64Image = null;
        saveModal.classList.add('active');
    };

    cancelSaveBtn.onclick = () => saveModal.classList.remove('active');

    confirmSaveBtn.onclick = async () => {
        const name = storeNameInput.value.trim();
        if (!name) { alert("Ingresa un nombre."); return; }
        
        confirmSaveBtn.disabled = true;
        try {
            await push(tariffsRef, {
                name,
                comision: comisionInput.value,
                recupero: recuperoInput.value,
                image: base64Image || 'https://via.placeholder.com/60?text=Shop',
                markup: currentMarkup,
                timestamp: Date.now()
            });
            saveModal.classList.remove('active');
        } catch (error) {
            console.error(error);
        } finally { confirmSaveBtn.disabled = false; }
    };

    onValue(tariffsRef, (snapshot) => {
        tariffsList.innerHTML = '';
        const data = snapshot.val();
        currentItems = data || {};
        if (!data) {
            tariffsList.innerHTML = '<p class="empty-msg">No hay aranceles guardados.</p>';
            return;
        }
        Object.entries(data).reverse().forEach(([key, item]) => {
            const isEditing = editingId === key;
            const div = document.createElement('div');
            div.className = `tariff-item ${isEditing ? 'is-editing' : ''}`;
            
            if (isEditing) {
                div.innerHTML = `
                    <img src="${item.image}" class="tariff-img">
                    <div class="inline-edit-form">
                        <input type="text" class="inline-input" id="edit-name-${key}" value="${item.name}">
                        <div class="inline-input-row">
                            <input type="text" class="inline-input" id="edit-com-${key}" value="${item.comision}">
                            <input type="text" class="inline-input" id="edit-rec-${key}" value="${item.recupero}">
                        </div>
                    </div>
                    <div class="tariff-actions">
                        <button class="action-btn confirm-btn" data-save-id="${key}">✓</button>
                        <button class="action-btn cancel-btn" data-cancel-id="${key}">✕</button>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <img src="${item.image}" class="tariff-img">
                    <div class="tariff-info">
                        <div class="tariff-name">${item.name}</div>
                        <div class="tariff-details">Com: ${item.comision}% | Rec: ${item.recupero}%</div>
                    </div>
                    <div class="tariff-val-container">
                        <div class="tariff-val">${item.markup}%</div>
                    </div>
                    <div class="tariff-actions">
                        <button class="action-btn edit-btn" data-edit-id="${key}">✎</button>
                        <button class="action-btn delete-btn" data-delete-id="${key}">✕</button>
                    </div>
                `;
            }
            tariffsList.appendChild(div);
        });
    });

    tariffsList.onclick = async (e) => {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        if (btn.hasAttribute('data-delete-id')) {
            const id = btn.getAttribute('data-delete-id');
            if (confirm("¿Eliminar?")) remove(ref(db, `tariffs/${id}`));
        } 
        else if (btn.hasAttribute('data-edit-id')) {
            editingId = btn.getAttribute('data-edit-id');
            // Re-render
            onValue(tariffsRef, () => {}, { onlyOnce: true }); 
        }
        else if (btn.hasAttribute('data-cancel-id')) {
            editingId = null;
        }
        else if (btn.hasAttribute('data-save-id')) {
            const id = btn.getAttribute('data-save-id');
            const newName = document.getElementById(`edit-name-${id}`).value.trim();
            const newComStr = document.getElementById(`edit-com-${id}`).value;
            const newRecStr = document.getElementById(`edit-rec-${id}`).value;

            if (!newName) return;

            const com = parseInput(newComStr);
            const rec = parseInput(newRecStr);
            const markup = calculateMarkup(com, rec);

            if (markup === null) { alert("Valores inválidos."); return; }

            await update(ref(db, `tariffs/${id}`), {
                name: newName,
                comision: newComStr,
                recupero: newRecStr,
                markup: markup
            });
            editingId = null;
        }
    };

    comisionInput.oninput = updateMainCalculation;
    recuperoInput.oninput = updateMainCalculation;
    recargoActualInput.oninput = calculateAdjustment;
    recargoObjetivoInput.oninput = calculateAdjustment;
});
