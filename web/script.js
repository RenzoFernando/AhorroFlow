/* ================= CONFIGURACIÓN ================= */
const DEFAULT_CONFIG = {
    startDate: getTodayString(),
    baseAmount: 500,
    increment: 500,
    target: 100000,
    activeDays: [1, 2, 3, 4, 5] // Lun-Vie
};

const PLAN_STORAGE_KEY = 'ahorroFlow_plan';
const CONFIG_STORAGE_KEY = 'ahorroFlow_config';

let savingsPlan = [];
let currentConfig = { ...DEFAULT_CONFIG };
let completionCelebrated = false;

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
const historySummary = document.getElementById('history-summary');
const clearProgressButton = document.getElementById('clear-progress-button');
const noticeModal = document.getElementById('notice-modal');
const noticeCard = document.getElementById('notice-card');
const noticeIcon = document.getElementById('notice-icon');
const noticeTitle = document.getElementById('notice-title');
const noticeMessage = document.getElementById('notice-message');
const noticeCancelButton = document.getElementById('notice-cancel-button');
const noticeConfirmButton = document.getElementById('notice-confirm-button');

let noticeConfirmAction = null;


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
    syncInputsWithConfig();

    // Cargar datos guardados o generar nuevo
    loadData();

    clearProgressButton.addEventListener('click', clearProgress);

    noticeConfirmButton.addEventListener('click', () => {
        const action = noticeConfirmAction;
        closeNotice();
        if (typeof action === 'function') action();
    });

    noticeCancelButton.addEventListener('click', closeNotice);

    noticeModal.addEventListener('click', (e) => {
        if (e.target === noticeModal) closeNotice();
    });

    // Cerrar modal al hacer click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
});

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function dateToKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function syncInputsWithConfig() {
    inputs.start.value = currentConfig.startDate;
    inputs.base.value = currentConfig.baseAmount;
    inputs.increment.value = currentConfig.increment;
    inputs.target.value = currentConfig.target;

    document.querySelectorAll('.day-check').forEach((checkbox) => {
        checkbox.checked = currentConfig.activeDays.includes(parseInt(checkbox.value, 10));
    });
}

/* ================= LÓGICA DE DATOS ================= */
function loadData() {
    const savedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
    const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);

    if (savedConfig) {
        try {
            currentConfig = normalizeConfig(JSON.parse(savedConfig));
        } catch (e) {
            currentConfig = { ...DEFAULT_CONFIG };
        }
    }

    if (savedPlan) {
        try {
            const parsedPlan = JSON.parse(savedPlan);

            // Recuperar objetos Date
            const restoredPlan = parsedPlan.map((item) => ({
                ...item,
                date: new Date(item.date),
                status: item.status || (item.completed ? 'completed' : 'pending')
            }));

            if (!savedConfig && restoredPlan.length > 0) {
                currentConfig = deriveConfigFromLegacyPlan(restoredPlan);
            }

            syncInputsWithConfig();
            rebuildPlanFromStatuses(restoredPlan);
            renderList();
            updateStats();
            return;
        } catch (e) {
            console.error("Error al cargar datos, regenerando...", e);
        }
    }

    currentConfig = normalizeConfig(currentConfig);
    syncInputsWithConfig();
    rebuildPlanFromStatuses([]);
    saveData();
    renderList();
    updateStats();
}

function normalizeConfig(config) {
    const normalizedDays = Array.isArray(config.activeDays)
        ? config.activeDays.map((day) => parseInt(day, 10)).filter((day) => day >= 0 && day <= 6)
        : [...DEFAULT_CONFIG.activeDays];

    return {
        startDate: config.startDate || getTodayString(),
        baseAmount: Math.max(0, parseInt(config.baseAmount, 10) || DEFAULT_CONFIG.baseAmount),
        increment: Math.max(0, parseInt(config.increment, 10) || DEFAULT_CONFIG.increment),
        target: Math.max(1, parseInt(config.target, 10) || DEFAULT_CONFIG.target),
        activeDays: normalizedDays.length > 0 ? [...new Set(normalizedDays)] : [...DEFAULT_CONFIG.activeDays]
    };
}

function deriveConfigFromLegacyPlan(plan) {
    const baseAmount = parseInt(plan[0]?.amount, 10) || DEFAULT_CONFIG.baseAmount;
    const increment = plan.length > 1
        ? Math.max(0, (parseInt(plan[1].amount, 10) || baseAmount) - baseAmount)
        : DEFAULT_CONFIG.increment;
    const lastAccumulated = parseInt(plan[plan.length - 1]?.accumulatedTarget, 10) || DEFAULT_CONFIG.target;
    const activeDays = [...new Set(plan.map((item) => item.date.getDay()))];

    return normalizeConfig({
        startDate: dateToKey(plan[0].date),
        baseAmount,
        increment,
        target: lastAccumulated,
        activeDays
    });
}

function getSelectedDays() {
    // Obtener días seleccionados
    return Array.from(document.querySelectorAll('.day-check'))
        .filter((cb) => cb.checked)
        .map((cb) => parseInt(cb.value, 10));
}

function generatePlan() {
    const base = parseInt(inputs.base.value, 10) || 0;
    const increment = parseInt(inputs.increment.value, 10) || 0;
    const target = parseInt(inputs.target.value, 10) || 100000;
    const startStr = inputs.start.value;
    const activeDays = getSelectedDays();

    if (activeDays.length === 0) {
        // Pequeña animación de error o alerta
        showNotice({
            title: 'Selecciona tus días',
            message: 'Elige al menos un día de la semana para generar el plan.',
            tone: 'warning'
        });
        return;
    }

    if (!startStr || base < 0 || increment < 0 || target <= 0) {
        showNotice({
            title: 'Revisa tu plan',
            message: 'Comprueba la fecha, el valor inicial, el incremento y la meta antes de continuar.',
            tone: 'warning'
        });
        return;
    }

    const nextConfig = normalizeConfig({
        startDate: startStr,
        baseAmount: base,
        increment,
        target,
        activeDays
    });

    const applyPlan = () => {
        currentConfig = nextConfig;
        completionCelebrated = false;
        rebuildPlanFromStatuses([]);
        syncInputsWithConfig();
        saveData();
        renderList();
        updateStats();
        closeModal();
    };

    const hasExistingPlan = savingsPlan.length > 0;
    const hasProgress = savingsPlan.some((item) => item.status !== 'pending');

    if (hasExistingPlan || hasProgress) {
        showNotice({
            title: 'Generar un nuevo plan',
            message: 'El plan actual será reemplazado y su progreso se reiniciará. ¿Quieres continuar?',
            confirmText: 'Generar plan',
            cancelText: 'Cancelar',
            tone: 'warning',
            onConfirm: applyPlan
        });
        return;
    }

    applyPlan();
}

function rebuildPlanFromStatuses(previousPlan) {
    const statusByDate = new Map(
        previousPlan.map((item) => [dateToKey(new Date(item.date)), item.status || (item.completed ? 'completed' : 'pending')])
    );

    savingsPlan = [];
    let currentAmount = currentConfig.baseAmount;
    let accumulatedTotal = 0;
    let currentDate = new Date(currentConfig.startDate + 'T00:00:00'); // Hora local segura
    let safetyCounter = 0;

    // Generar días hasta alcanzar la meta o límite de seguridad
    while (accumulatedTotal < currentConfig.target && safetyCounter < 5000) {
        const dayOfWeek = currentDate.getDay();

        if (currentConfig.activeDays.includes(dayOfWeek)) {
            const dateKey = dateToKey(currentDate);
            const status = statusByDate.get(dateKey) || 'pending';
            const amount = currentAmount;

            if (status !== 'skipped') {
                accumulatedTotal += amount;
                currentAmount += currentConfig.increment;
            }

            savingsPlan.push({
                id: dateKey,
                date: new Date(currentDate),
                amount,
                status,
                completed: status === 'completed',
                accumulatedTarget: accumulatedTotal
            });
        }

        // Avanzar un día
        currentDate.setDate(currentDate.getDate() + 1);
        safetyCounter++;
    }
}

function setItemStatus(index, nextStatus) {
    const item = savingsPlan[index];
    if (!item) return;

    // Alternar estado
    item.status = item.status === nextStatus ? 'pending' : nextStatus;
    item.completed = item.status === 'completed';

    // Optimización: Actualizar solo el elemento en el DOM en lugar de re-renderizar todo sería mejor,
    // pero re-renderizar es seguro y rápido para listas pequeñas.
    rebuildPlanFromStatuses(savingsPlan);
    saveData();
    renderList();
    updateStats(true);
}

function clearProgress() {
    const hasProgress = savingsPlan.some((item) => item.status !== 'pending');

    if (!hasProgress) {
        showNotice({
            title: 'Nada por limpiar',
            message: 'El plan actual todavía no tiene movimientos registrados.',
            tone: 'neutral'
        });
        return;
    }

    showNotice({
        title: 'Limpiar progreso',
        message: 'Se borrarán los estados de los aportes, pero conservarás la configuración actual del plan. ¿Quieres continuar?',
        confirmText: 'Limpiar',
        cancelText: 'Cancelar',
        tone: 'warning',
        onConfirm: () => {
            completionCelebrated = false;
            rebuildPlanFromStatuses([]);
            saveData();
            renderList();
            updateStats();
        }
    });
}

function saveData() {
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(savingsPlan));
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(currentConfig));
}

/* ================= INTERFAZ DE USUARIO ================= */
function renderList() {
    listContainer.innerHTML = '';

    if (savingsPlan.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">Genera un plan para comenzar.</div>';
        return;
    }

    const fragment = document.createDocumentFragment();

    savingsPlan.forEach((item, index) => {
        const dateStr = item.date.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
        const formattedDate = dateStr.replace(/^\w/, c => c.toUpperCase()); // Capitalizar

        const isCompleted = item.status === 'completed';
        const isSkipped = item.status === 'skipped';

        // Clases dinámicas
        const containerClasses = isCompleted
            ? 'saving-item is-completed'
            : isSkipped
                ? 'saving-item is-skipped'
                : 'saving-item glass-card';

        const div = document.createElement('article');
        div.className = containerClasses;

        div.innerHTML = `
            <div class="saving-main">
                <div class="saving-day">
                    <span>Día ${index + 1}</span>
                    <strong>${formattedDate}</strong>
                </div>

                <div class="saving-amount">
                    <strong>${formatter.format(item.amount)}</strong>
                    <span>${isSkipped ? 'Se mantiene para el siguiente día' : `Acum: ${formatter.format(item.accumulatedTarget)}`}</span>
                </div>
            </div>

            <!-- Checkbox Visual -->
            <div class="saving-actions" aria-label="Estado del día ${index + 1}">
                <button class="status-button save-button ${isCompleted ? 'is-active' : ''}" type="button" data-status="completed" aria-pressed="${isCompleted}">
                    <i class="fas fa-check" aria-hidden="true"></i>
                    <span>Ahorré</span>
                </button>
                <button class="status-button skip-button ${isSkipped ? 'is-active' : ''}" type="button" data-status="skipped" aria-pressed="${isSkipped}">
                    <i class="fas fa-xmark" aria-hidden="true"></i>
                    <span>No pude</span>
                </button>
            </div>
        `;

        div.querySelectorAll('.status-button').forEach((button) => {
            button.addEventListener('click', () => setItemStatus(index, button.dataset.status));
        });

        fragment.appendChild(div);
    });

    listContainer.appendChild(fragment);
}

function updateStats(celebrate = false) {
    const totalSaved = savingsPlan
        .filter((item) => item.status === 'completed')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const completedItems = savingsPlan.filter((item) => item.status === 'completed').length;
    const skippedItems = savingsPlan.filter((item) => item.status === 'skipped').length;
    const pendingItems = savingsPlan.filter((item) => item.status === 'pending').length;
    const percent = Math.min(100, (totalSaved / currentConfig.target) * 100);

    // Animación de números (simple)
    displaySaved.innerText = formatter.format(totalSaved);
    displayGoal.innerText = formatter.format(currentConfig.target);

    progressBar.style.width = `${percent}%`;
    progressText.innerText = `${Math.round(percent)}%`;

    historySummary.innerText = `${completedItems} ahorrados · ${pendingItems} pendientes · ${skippedItems} no pude`;

    if (totalSaved >= currentConfig.target) {
        daysLeftText.innerText = 'Meta cumplida';

        if (celebrate && !completionCelebrated) {
            completionCelebrated = true;
            triggerConfetti();
            showNotice({
                title: 'Meta cumplida',
                message: `Completaste tu plan y alcanzaste ${formatter.format(currentConfig.target)} de ahorro.`,
                tone: 'success'
            });
        }
    } else {
        daysLeftText.innerText = `Faltan ${pendingItems} aportes`;
    }
}

/* ================= UTILIDADES UI ================= */
function showNotice({
    title,
    message,
    confirmText = 'Aceptar',
    cancelText = '',
    tone = 'neutral',
    onConfirm = null
}) {
    noticeTitle.innerText = title;
    noticeMessage.innerText = message;
    noticeConfirmButton.innerText = confirmText;
    noticeConfirmAction = onConfirm;

    noticeCard.dataset.tone = tone;

    const icons = {
        neutral: 'fa-circle-info',
        warning: 'fa-triangle-exclamation',
        success: 'fa-circle-check'
    };

    noticeIcon.innerHTML = `<i class="fas ${icons[tone] || icons.neutral}"></i>`;

    if (cancelText) {
        noticeCancelButton.innerText = cancelText;
        noticeCancelButton.classList.remove('hidden');
    } else {
        noticeCancelButton.classList.add('hidden');
    }

    noticeModal.classList.remove('hidden');
    noticeModal.setAttribute('aria-hidden', 'false');

    requestAnimationFrame(() => {
        noticeModal.classList.add('is-open');
        noticeCard.classList.add('is-open');
        noticeConfirmButton.focus();
    });
}

function closeNotice() {
    noticeModal.classList.remove('is-open');
    noticeCard.classList.remove('is-open');
    noticeModal.setAttribute('aria-hidden', 'true');
    noticeConfirmAction = null;

    setTimeout(() => {
        noticeModal.classList.add('hidden');
    }, 180);
}

function openModal() {
    syncInputsWithConfig();
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.classList.add('is-open');
        modalContent.classList.add('is-open');
    });
}

function closeModal() {
    modal.classList.remove('is-open');
    modalContent.classList.remove('is-open');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 180);
}

function triggerConfetti() {
    const colors = ['#2f7d5d', '#68a67f', '#b4d0bd', '#d9eadf'];
    const container = document.body;

    for(let i = 0; i < 18; i++) {
        const conf = document.createElement('div');
        const size = Math.random() * 6 + 4; // 4px a 10px

        conf.style.cssText = `
            position: fixed;
            left: ${Math.random() * 100}vw;
            top: -20px;
            width: ${size}px;
            height: ${size}px;
            background-color: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            z-index: 9999;
            pointer-events: none;
            transition: top 2.2s ease-out, transform 2.2s linear, opacity 2.2s ease-out;
            opacity: 0.9;
        `;

        container.appendChild(conf);

        // Disparar animación
        requestAnimationFrame(() => {
            conf.style.top = '105vh';
            conf.style.transform = `rotate(${Math.random() * 420}deg) translateX(${Math.random() * 70 - 35}px)`;
            conf.style.opacity = '0';
        });

        setTimeout(() => conf.remove(), 2300);
    }
}
