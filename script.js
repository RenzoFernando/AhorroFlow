/* ================= CONFIGURACIÓN ================= */
const DEFAULT_CONFIG = {
    startDate: '2026-02-02',
    baseAmount: 500,
    increment: 500,
    target: 100000,
    activeDays: [1, 2, 3, 4, 5] // Lun-Vie
};

let savingsPlan = [];
const formatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
});

// Referencias DOM
const listContainer = document.getElementById('savings-list');
const displaySaved = document.getElementById('display-saved');
const displayGoal = document.getElementById('display-goal');
const progressBar = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');
const daysLeftText = document.getElementById('days-left-text');

// Referencias Modal
const modal = document.getElementById('config-modal');
const modalContent = document.getElementById('modal-content');

// Inputs
const inputs = {
    start: document.getElementById('start-date'),
    base: document.getElementById('base-amount'),
    increment: document.getElementById('increment-amount'),
    target: document.getElementById('target-goal')
};

/* ================= CICLO DE VIDA ================= */
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar inputs con valores por defecto
    inputs.start.value = DEFAULT_CONFIG.startDate;
    inputs.base.value = DEFAULT_CONFIG.baseAmount;
    inputs.increment.value = DEFAULT_CONFIG.increment;
    inputs.target.value = DEFAULT_CONFIG.target;

    // Cargar datos guardados o generar nuevo
    loadData();

    // Cerrar modal al hacer click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
});

/* ================= LÓGICA DE DATOS ================= */
function loadData() {
    const savedPlan = localStorage.getItem('ahorroFlow_plan');
    if (savedPlan) {
        try {
            savingsPlan = JSON.parse(savedPlan);
            // Recuperar objetos Date
            savingsPlan.forEach(item => item.date = new Date(item.date));
            renderList();
            updateStats();
        } catch (e) {
            console.error("Error al cargar datos, regenerando...", e);
            generatePlan();
        }
    } else {
        generatePlan();
    }
}

function generatePlan() {
    const base = parseInt(inputs.base.value) || 0;
    const increment = parseInt(inputs.increment.value) || 0;
    const target = parseInt(inputs.target.value) || 100000;
    const startStr = inputs.start.value;

    // Obtener días seleccionados
    const activeDays = Array.from(document.querySelectorAll('.day-check'))
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.value));

    if (activeDays.length === 0) {
        // Pequeña animación de error o alerta
        alert("Selecciona al menos un día.");
        return;
    }

    savingsPlan = [];
    let currentAmount = base;
    let accumulatedTotal = 0;
    let currentDate = new Date(startStr + 'T00:00:00'); // Hora local segura
    let safetyCounter = 0;

    // Generar días hasta alcanzar la meta o límite de seguridad
    while (accumulatedTotal < target && safetyCounter < 1000) {
        const dayOfWeek = currentDate.getDay();

        if (activeDays.includes(dayOfWeek)) {
            accumulatedTotal += currentAmount;

            savingsPlan.push({
                id: Date.now() + safetyCounter,
                date: new Date(currentDate),
                amount: currentAmount,
                completed: false,
                accumulatedTarget: accumulatedTotal
            });

            currentAmount += increment;
        }

        // Avanzar un día
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
    }

    saveData();
    renderList();
    updateStats();
    closeModal();
}

function toggleItem(index) {
    // Alternar estado
    savingsPlan[index].completed = !savingsPlan[index].completed;
    saveData();

    // Optimización: Actualizar solo el elemento en el DOM en lugar de re-renderizar todo sería mejor,
    // pero re-renderizar es seguro y rápido para listas pequeñas.
    renderList();
    updateStats();
}

function saveData() {
    localStorage.setItem('ahorroFlow_plan', JSON.stringify(savingsPlan));
}

/* ================= INTERFAZ DE USUARIO ================= */
function renderList() {
    listContainer.innerHTML = '';

    if (savingsPlan.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-400 text-xs py-10">Genera un plan para comenzar</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    savingsPlan.forEach((item, index) => {
        const dateStr = item.date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
        const formattedDate = dateStr.replace(/^\w/, c => c.toUpperCase()); // Capitalizar

        const isCompleted = item.completed;

        // Clases dinámicas
        const containerClasses = isCompleted
            ? 'bg-emerald-50/40 border-emerald-100'
            : 'glass-card hover:border-emerald-200';

        const textOpacity = isCompleted ? 'opacity-50' : 'opacity-100';
        const priceColor = isCompleted ? 'text-emerald-600' : 'text-gray-700';

        const div = document.createElement('div');
        div.className = `${containerClasses} p-3 rounded-xl flex items-center justify-between cursor-pointer group mb-2 border transition-all select-none`;
        div.onclick = () => toggleItem(index);

        div.innerHTML = `
            <div class="flex items-center gap-3 ${textOpacity} transition-opacity duration-300">
                <!-- Checkbox Visual -->
                <div class="bubble-checkbox relative w-6 h-6 flex items-center justify-center">
                    <input type="checkbox" class="peer sr-only" ${isCompleted ? 'checked' : ''}>
                    <div class="bubble-bg absolute inset-0 rounded-full border-2 border-gray-200 peer-checked:border-emerald-400 bg-white transition-all duration-300"></div>
                    <i class="fas fa-check text-white text-[10px] relative z-10 bubble-icon opacity-0 transition-all duration-300"></i>
                </div>
                
                <div class="flex flex-col">
                    <span class="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none mb-0.5">Día ${index + 1}</span>
                    <span class="text-xs font-semibold text-gray-600 leading-tight">${formattedDate}</span>
                </div>
            </div>
            
            <div class="text-right ${textOpacity} transition-opacity duration-300">
                <span class="block text-sm font-bold ${priceColor}">${formatter.format(item.amount)}</span>
                <span class="text-[9px] text-gray-400 font-medium">Acum: ${formatter.format(item.accumulatedTarget)}</span>
            </div>
        `;

        fragment.appendChild(div);
    });

    listContainer.appendChild(fragment);
}

function updateStats() {
    const totalGoal = savingsPlan.reduce((acc, curr) => acc + curr.amount, 0);
    const totalSaved = savingsPlan.filter(i => i.completed).reduce((acc, curr) => acc + curr.amount, 0);
    const remainingItems = savingsPlan.filter(i => !i.completed).length;

    const percent = totalGoal > 0 ? (totalSaved / totalGoal) * 100 : 0;

    // Animación de números (simple)
    displaySaved.innerText = formatter.format(totalSaved);
    displayGoal.innerText = formatter.format(totalGoal);

    progressBar.style.width = `${percent}%`;
    progressText.innerText = `${Math.round(percent)}%`;

    if (remainingItems === 0 && totalGoal > 0) {
        daysLeftText.innerHTML = '<span class="text-emerald-300 font-bold drop-shadow-sm">¡Completado! 🎉</span>';
        triggerConfetti();
    } else {
        daysLeftText.innerText = `Faltan ${remainingItems} días`;
    }
}

/* ================= UTILIDADES UI ================= */
function openModal() {
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    });
}

function closeModal() {
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function triggerConfetti() {
    const colors = ['#34d399', '#f472b6', '#60a5fa', '#fbbf24'];
    const container = document.body;

    for(let i=0; i<40; i++) {
        const conf = document.createElement('div');
        const size = Math.random() * 6 + 4; // 4px a 10px

        conf.style.cssText = `
            position: fixed;
            left: ${Math.random() * 100}vw;
            top: -20px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${colors[Math.floor(Math.random()*colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            z-index: 9999;
            pointer-events: none;
            transition: top 3s ease-out, transform 3s linear;
        `;

        container.appendChild(conf);

        // Disparar animación
        requestAnimationFrame(() => {
            conf.style.top = '110vh';
            conf.style.transform = `rotate(${Math.random() * 720}deg) translateX(${Math.random() * 100 - 50}px)`;
        });

        setTimeout(() => conf.remove(), 3000);
    }
}