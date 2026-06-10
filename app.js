import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, off } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    // Elements
    const comisionInput = document.getElementById('comision');
    const recuperoInput = document.getElementById('recupero');
    const markupResult = document.getElementById('markup-result');
    const saveArea = document.getElementById('save-area');
    const newStoreName = document.getElementById('new-store-name');
    const newStoreImage = document.getElementById('new-store-image');
    const addToListBtn = document.getElementById('add-to-list-btn');
    const recargoActualInput = document.getElementById('recargo-actual');
    const recargoObjetivoInput = document.getElementById('recargo-objetivo');
    const ajusteResult = document.getElementById('ajuste-result');
    const tariffsList = document.getElementById('tariffs-list');

    // State
    let currentMarkupValue = null;
    let newStoreBase64 = null;
    let currentItems = {};
    let editingId = null;

    const parseInput = (val) => {
        if (!val) return 0;
        let str = val.toString().replace('%', '').replace(',', '.').trim();
        let num = parseFloat(str);
        return isNaN(num) ? 0 : num / 100;
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
            saveArea.style.display = 'none';
            currentMarkupValue = null;
        } else {
            currentMarkupValue = result;
            markupResult.textContent = `${result}%`;
            saveArea.style.display = 'block';
        }
    };

    const updateAdjustment = () => {
        const actual = parseInput(recargoActualInput.value) * 100;
        const objetivo = parseInput(recargoObjetivoInput.value) * 100;
        if (isNaN(actual) || isNaN(objetivo)) {
            ajusteResult.textContent = "---";
            return;
        }
        const adjustment = (((1 + (objetivo/100)) / (1 + (actual/100))) - 1) * 100;
        ajusteResult.textContent = `${adjustment.toFixed(2)}%`;
    };

    newStoreImage.onchange = (e) => {
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
                    newStoreBase64 = canvas.toDataURL('image/jpeg', 0.7);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    addToListBtn.onclick = async () => {
        const name = newStoreName.value.trim();
        if (!name) { alert("Por favor ingresa un nombre para la tienda."); return; }
        
        addToListBtn.disabled = true;
        addToListBtn.textContent = 'Guardando...';

        try {
            await push(tariffsRef, {
                name,
                comision: comisionInput.value,
                recupero: recuperoInput.value,
                image: newStoreBase64 || 'https://via.placeholder.com/60?text=Shop',
                markup: currentMarkupValue,
                timestamp: Date.now()
            });
            newStoreName.value = '';
            newStoreImage.value = '';
            newStoreBase64 = null;
            saveArea.style.display = 'none';
            comisionInput.value = '';
            recuperoInput.value = '';
            markupResult.textContent = '---';
        } catch (error) {
            console.error(error);
            alert("Error al guardar.");
        } finally {
            addToListBtn.disabled = false;
            addToListBtn.textContent = 'Guardar en Lista';
        }
    };

    const updateInlineMarkup = (id) => {
        const comInput = document.getElementById(`edit-com-${id}`);
        const recInput = document.getElementById(`edit-rec-${id}`);
        const preview = document.getElementById(`markup-preview-${id}`);
        const confirmBtn = tariffsList.querySelector(`[data-save-id="${id}"]`);

        if (!comInput || !recInput || !preview) return;

        const com = parseInput(comInput.value);
        const rec = parseInput(recInput.value);
        const markup = calculateMarkup(com, rec);

        if (markup === null) {
            preview.textContent = "Inválido";
            preview.style.color = "#ef4444";
            confirmBtn.disabled = true;
        } else {
            preview.textContent = `Markup: ${markup}%`;
            preview.style.color = "var(--primary)";
            confirmBtn.disabled = false;
        }
    };

    const renderList = () => {
        tariffsList.innerHTML = '';
        if (Object.keys(currentItems).length === 0) {
            tariffsList.innerHTML = '<p class="empty-msg">No hay aranceles guardados.</p>';
            return;
        }

        Object.entries(currentItems).reverse().forEach(([key, item]) => {
            const isEditing = editingId === key;
            const div = document.createElement('div');
            div.className = `tariff-item ${isEditing ? 'is-editing' : ''}`;
            
            if (isEditing) {
                div.innerHTML = `
                    <img src="${item.image}" class="tariff-img">
                    <div class="inline-edit-form">
                        <div class="input-col">
                            <label class="small-label">Nombre de la Tienda</label>
                            <input type="text" class="inline-input" id="edit-name-${key}" value="${item.name}">
                        </div>
                        <div class="inline-input-row">
                            <div class="input-col">
                                <label class="small-label">Comisión</label>
                                <input type="text" class="inline-input" id="edit-com-${key}" value="${item.comision}">
                            </div>
                            <div class="input-col">
                                <label class="small-label">Recupero</label>
                                <input type="text" class="inline-input" id="edit-rec-${key}" value="${item.recupero}">
                            </div>
                            <div class="input-col">
                                <label class="small-label">IVA</label>
                                <input type="text" class="inline-input" value="21%" disabled>
                            </div>
                        </div>
                        <div id="markup-preview-${key}" class="inline-markup-preview">Markup: ${item.markup}%</div>
                    </div>
                    <div class="tariff-actions">
                        <button class="action-btn confirm-btn" data-save-id="${key}">✓</button>
                        <button class="action-btn cancel-btn" data-cancel-id="${key}">✕</button>
                    </div>
                `;

                // Live updates for edit mode
                const cInput = div.querySelector(`#edit-com-${key}`);
                const rInput = div.querySelector(`#edit-rec-${key}`);
                cInput.oninput = () => updateInlineMarkup(key);
                rInput.oninput = () => updateInlineMarkup(key);
            } else {
                div.innerHTML = `
                    <img src="${item.image}" class="tariff-img">
                    <div class="tariff-info">
                        <div class="tariff-name">${item.name}</div>
                        <div class="tariff-details">Com: ${item.comision}% | Rec: ${item.recupero}% | IVA: 21%</div>
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
    };

    onValue(tariffsRef, (snapshot) => {
        currentItems = snapshot.val() || {};
        if (!editingId) renderList();
    });

    tariffsList.onclick = async (e) => {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        if (btn.hasAttribute('data-delete-id')) {
            const id = btn.getAttribute('data-delete-id');
            if (confirm("¿Eliminar este arancel?")) {
                await remove(ref(db, `tariffs/${id}`));
            }
        } 
        else if (btn.hasAttribute('data-edit-id')) {
            editingId = btn.getAttribute('data-edit-id');
            renderList();
        }
        else if (btn.hasAttribute('data-cancel-id')) {
            editingId = null;
            renderList();
        }
        else if (btn.hasAttribute('data-save-id')) {
            const id = btn.getAttribute('data-save-id');
            const newName = document.getElementById(`edit-name-${id}`).value.trim();
            const newComStr = document.getElementById(`edit-com-${id}`).value;
            const newRecStr = document.getElementById(`edit-rec-${id}`).value;

            if (!newName) { alert("El nombre no puede estar vacío."); return; }

            const com = parseInput(newComStr);
            const rec = parseInput(newRecStr);
            const markup = calculateMarkup(com, rec);

            if (markup === null) { alert("Valores inválidos."); return; }

            btn.disabled = true;
            try {
                await update(ref(db, `tariffs/${id}`), {
                    name: newName,
                    comision: newComStr,
                    recupero: newRecStr,
                    markup: markup,
                    timestamp: Date.now()
                });
                editingId = null;
                renderList();
            } catch (err) {
                console.error(err);
                alert("Error al actualizar.");
            } finally {
                btn.disabled = false;
            }
        }
    };

    comisionInput.oninput = updateMainCalculation;
    recuperoInput.oninput = updateMainCalculation;
    recargoActualInput.oninput = updateAdjustment;
    recargoObjetivoInput.oninput = updateAdjustment;
});
