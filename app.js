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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tariffsRef = ref(db, 'tariffs');

// DOM Elements
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
const editIdInput = document.getElementById('edit-id');
const confirmSaveBtn = document.getElementById('confirm-save');
const cancelSaveBtn = document.getElementById('cancel-save');

// State
let currentMarkup = null;
let base64Image = null;
let currentItems = {};

// Helper: Normalize inputs
const parseInput = (val) => {
    if (!val) return 0;
    return parseFloat(val.toString().replace(',', '.')) / 100;
};

// 1. Logic: Tariff Calculator
const calculateTariff = () => {
    const comision = parseInput(comisionInput.value);
    const recupero = parseInput(recuperoInput.value);
    const iva = 0.21;

    const descuento = comision + recupero;
    const descuentoConIVA = descuento + (descuento * iva);

    if (descuento >= 1 || descuentoConIVA >= 1) {
        markupResult.textContent = "Inválido";
        saveBtn.disabled = true;
        currentMarkup = null;
        return;
    }

    const final = ((1 / (1 - descuentoConIVA)) - 1) * 100;
    currentMarkup = final.toFixed(2);
    markupResult.textContent = `${currentMarkup}%`;
    saveBtn.disabled = false;
};

// 2. Logic: Adjustment Calculator
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

// 3. UI: Handle Image with Base64
storeImageFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        // Redimensionar imagen para que no ocupe tanto espacio en la DB
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

                base64Image = canvas.toDataURL('image/jpeg', 0.7); // Comprimir al 70%
                imagePreview.src = base64Image;
                imagePreviewContainer.style.display = 'block';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// 4. UI: Modal Actions
saveBtn.addEventListener('click', () => {
    editIdInput.value = '';
    storeNameInput.value = '';
    storeImageFile.value = '';
    imagePreviewContainer.style.display = 'none';
    base64Image = null;
    confirmSaveBtn.textContent = 'Guardar';
    saveModal.classList.add('active');
});

cancelSaveBtn.addEventListener('click', () => {
    saveModal.classList.remove('active');
});

confirmSaveBtn.addEventListener('click', async () => {
    const name = storeNameInput.value.trim();
    const editId = editIdInput.value;

    if (!name) {
        alert("Por favor ingresa un nombre.");
        return;
    }

    confirmSaveBtn.disabled = true;
    confirmSaveBtn.textContent = 'Guardando...';

    try {
        const data = {
            name,
            image: base64Image || (editId ? currentItems[editId].image : 'https://via.placeholder.com/60?text=Shop'),
            markup: currentMarkup || (editId ? currentItems[editId].markup : '0.00'),
            timestamp: Date.now()
        };

        if (editId) {
            await update(ref(db, `tariffs/${editId}`), data);
        } else {
            await push(tariffsRef, data);
        }

        saveModal.classList.remove('active');
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Hubo un error al guardar en la base de datos.");
    } finally {
        confirmSaveBtn.disabled = false;
        confirmSaveBtn.textContent = editId ? 'Actualizar' : 'Guardar';
    }
});

// 5. Firebase: Listen for changes
onValue(tariffsRef, (snapshot) => {
    tariffsList.innerHTML = '';
    const data = snapshot.val();
    currentItems = data || {};

    if (!data) {
        tariffsList.innerHTML = '<p class="empty-msg">No hay aranceles guardados.</p>';
        return;
    }

    Object.entries(data).reverse().forEach(([key, item]) => {
        const div = document.createElement('div');
        div.className = 'tariff-item';
        div.innerHTML = `
            <button class="edit-btn" data-id="${key}">✎</button>
            <button class="delete-btn" data-id="${key}">✕</button>
            <img src="${item.image}" class="tariff-img" onerror="this.src='https://via.placeholder.com/60?text=Shop'">
            <div class="tariff-name">${item.name}</div>
            <div class="tariff-val">${item.markup}%</div>
        `;
        tariffsList.appendChild(div);
    });

    // Event Delegation
    tariffsList.onclick = (e) => {
        const id = e.target.getAttribute('data-id');
        if (!id) return;

        if (e.target.classList.contains('delete-btn')) {
            if (confirm("¿Eliminar este arancel?")) {
                remove(ref(db, `tariffs/${id}`));
            }
        } else if (e.target.classList.contains('edit-btn')) {
            const item = currentItems[id];
            editIdInput.value = id;
            storeNameInput.value = item.name;
            base64Image = item.image;
            imagePreview.src = item.image;
            imagePreviewContainer.style.display = 'block';
            confirmSaveBtn.textContent = 'Actualizar';
            saveModal.classList.add('active');
        }
    };
});

// Event Listeners
comisionInput.addEventListener('input', calculateTariff);
recuperoInput.addEventListener('input', calculateTariff);
recargoActualInput.addEventListener('input', calculateAdjustment);
recargoObjetivoInput.addEventListener('input', calculateAdjustment);
