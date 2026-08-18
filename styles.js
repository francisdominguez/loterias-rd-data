// ============================================
// BUGS ENCONTRADOS Y CORREGIDOS EN ESTA VERSIÓN
// (ver detalle completo en la respuesta al usuario)
// 1) Inyección HTML/atributo: los nombres de lotería (venidos de JSON
//    remoto o CSV importado) se insertaban sin escapar en innerHTML y
//    dentro de un atributo onclick con comillas simples escapadas a mano
//    -> un nombre con comillas dobles rompía el atributo. Se añadió
//    escapeHtml() y se reemplazó el onclick dinámico por delegación de
//    eventos con data-lottery.
// 2) refreshRemoteData() dependía del global implícito `event`, frágil
//    fuera de un handler inline. Ahora recibe el evento como parámetro.
// 3) Los datos remotos/cacheados se asignaban a `data` sin validar forma
//    (fecha, lotería, números 00-99). Un registro corrupto rompía toda la
//    app (freq[n], splitDate, etc.). Se añadió normalizeRecords(), igual
//    de estricta que la que ya usaba la importación CSV.
// 4) Tras importar un CSV, la cabecera (badge de origen de datos y
//    contador "Registros: N") quedaba desactualizada porque nunca se
//    llamaba a updateDataSourceBadge(), y el origen seguía marcado como
//    "remoto"/"seed" aunque ya había datos locales mezclados.
// 5) .danger:hover usaba un color (#a16161) que no correspondía al rojo
//    de .danger, rompiendo el patrón "oscurecer el mismo tono" del resto
//    de botones (ver styles.css).
// ============================================

// ============================================
// MEJORAS V4 (sobre la V4 Pro anterior)
// 1) Peso por antigüedad (recencyWeight): los sorteos recientes pesan más
//    en el puntaje, pero los antiguos nunca llegan a pesar 0 (RECENCY_FLOOR).
// 2) Puntaje del ranking de números ahora es transparente y normalizado
//    0-100: 40% frecuencia bruta + 25% años distintos + 35% frecuencia
//    ponderada por antigüedad (antes era c*2+years sin explicar el porqué).
// 3) Repetición entre años: se listan los años exactos en que salió cada
//    número del top, no solo el conteo.
// 4) Rachas: racha de años consecutivos más larga y si el patrón de un
//    número tiende a ser consecutivo o alterno.
// 5) Terminaciones: frecuencia del último dígito, que la V anterior no
//    calculaba en ningún lado pese a estar en el pedido original.
// 6) Números espejo (12↔21, 35↔53, capicúas como su propio espejo).
// 7) Palés cruzados: se marca en la tabla de palés cuáles tienen sus DOS
//    números dentro del top del ranking.
// 8) "Palés destacados estadísticamente": combina TODAS las parejas
//    posibles del top de números (no solo las que ya aparecieron juntas) y
//    las puntúa por fuerza individual + coincidencia histórica + espejo.
// 9) Comparación automática con el día calendario anterior (ej. 18 vs 17 de
//    agosto) por lotería: números/palés en común y quién subió o bajó.
// 10) Panel de confianza estadística según el tamaño real de la muestra
//     (sorteos y años), dejando explícito que nunca es una probabilidad de
//     acierto ni una predicción.
// El comparador por lotería (analizar una sola, ej. solo Loteka) ya existía
// vía el selector de loterías: cada lotería seleccionada genera su propio
// bloque independiente, nunca se mezclan números entre loterías distintas.
// ============================================

// ============================================
// DATOS INICIALES (respaldo estático)
// ============================================
const INITIAL = [
  {"date": "2025-08-18", "lottery": "Nacional Gana Más", "numbers": ["34", "71", "66"]},
  {"date": "2025-08-18", "lottery": "Nacional Noche", "numbers": ["00", "92", "73"]},
  {"date": "2025-08-18", "lottery": "Quiniela Palé", "numbers": ["35", "55", "07"]},
  {"date": "2025-08-18", "lottery": "Pega 3 Más", "numbers": ["33", "35", "39"]},
  {"date": "2025-08-18", "lottery": "Quiniela Real", "numbers": ["97", "29", "24"]},
  {"date": "2025-08-18", "lottery": "Quiniela Loteka", "numbers": ["90", "94", "06"]},
  {"date": "2025-08-18", "lottery": "Mega Chance", "numbers": ["78", "59", "98", "73", "93"]},
  {"date": "2024-08-18", "lottery": "Nacional Gana Más", "numbers": ["97", "39", "62"]},
  {"date": "2024-08-18", "lottery": "Nacional Noche", "numbers": ["05", "62", "81"]},
  {"date": "2024-08-18", "lottery": "Quiniela Palé", "numbers": ["86", "80", "55"]},
  {"date": "2024-08-18", "lottery": "La Primera", "numbers": ["34", "99", "43"]},
  {"date": "2024-08-18", "lottery": "La Primera Noche", "numbers": ["54", "39", "51"]},
  {"date": "2024-08-18", "lottery": "La Suerte", "numbers": ["42", "98", "14"]},
  {"date": "2024-08-18", "lottery": "La Suerte 6PM", "numbers": ["35", "09", "63"]},
  {"date": "2024-08-18", "lottery": "Lotedom", "numbers": ["90", "03", "81"]},
  {"date": "2024-08-18", "lottery": "New York Tarde", "numbers": ["32", "80", "35"]},
  {"date": "2023-08-18", "lottery": "Nacional Gana Más", "numbers": ["34", "71", "66"]},
  {"date": "2023-08-18", "lottery": "Nacional Noche", "numbers": ["56", "89", "12"]},
  {"date": "2023-08-18", "lottery": "La Primera", "numbers": ["67", "34", "90"]}
];

const KEY = "loteria_rd_v4";
const REMOTE_JSON_URL = "https://raw.githubusercontent.com/francisdominguez/loterias-rd-data/main/data.json";
const REMOTE_DATA_KEY = "loteria_rd_remote_timestamp";
const SELECTED_LOTTERIES_KEY = "loteria_rd_selected";
const SCHEDULE_KEY = "loteria_rd_schedule";

// Horarios APROXIMADOS de referencia pública (lunes a sábado). Varían los
// domingos/feriados y pueden cambiar según el operador, por eso son solo
// un punto de partida: el usuario los puede editar en Configuración y esa
// edición se guarda en localStorage, con prioridad sobre este valor por
// defecto. Las loterías sin horario confirmado quedan vacías a propósito
// (mejor no mostrar nada que mostrar una hora inventada).
const DEFAULT_SCHEDULE = {
  "Nacional Gana Más": "2:30 PM",
  "Nacional Noche": "9:00 PM",
  "Quiniela Palé": "8:55 PM",
  "Pega 3 Más": "8:55 PM",
  "Quiniela Real": "12:55 PM",
  "Quiniela Loteka": "7:55 PM",
  "Mega Chance": "7:55 PM",
  "La Primera": "12:00 PM",
  "La Suerte": "12:30 PM",
  "La Suerte 6PM": "6:00 PM",
  "Lotedom": "2:55 PM"
};

let lotterySchedule = {};

let data = [];
let dataSource = "seed";
let allLotteries = [];
let selectedLotteries = new Set();

// ============================================
// FECHA POR DEFECTO = HOY (nunca hardcodeada)
// Solo se usa para rellenar los campos año/mes/día al cargar la página,
// por lo que usar el reloj local del dispositivo es correcto aquí (no se
// usa para comparar/ordenar fechas de sorteos, eso sigue siendo con
// splitDate()/compareDateStrings() sobre strings 'YYYY-MM-DD').
// ============================================
function setDefaultDateInputs() {
  const today = new Date();
  const monthEl = document.getElementById("month");
  const dayEl = document.getElementById("day");
  if (monthEl && !monthEl.value) monthEl.value = today.getMonth() + 1;
  if (dayEl && !dayEl.value) dayEl.value = today.getDate();
}

// ============================================
// HORARIOS DE SORTEO (editables por el usuario)
// ============================================
function loadSchedule() {
  const saved = safeParseJSON(localStorage.getItem(SCHEDULE_KEY)) || {};
  lotterySchedule = { ...DEFAULT_SCHEDULE, ...saved };
}

function getScheduleFor(lottery) {
  return (lotterySchedule[lottery] || "").trim();
}

function saveScheduleFromEditor() {
  const inputs = document.querySelectorAll("#schedule-editor [data-schedule-lottery]");
  inputs.forEach(inp => {
    lotterySchedule[inp.dataset.scheduleLottery] = inp.value.trim();
  });
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(lotterySchedule));
  renderLotterySelector();
  analyze();
  setStatus("✓ Horarios guardados.", true);
}

function renderScheduleEditor() {
  const container = document.getElementById("schedule-editor");
  if (!container) return;
  if (allLotteries.length === 0) {
    container.innerHTML = '<div class="muted small">Aún no hay loterías cargadas.</div>';
    return;
  }
  container.innerHTML = allLotteries
    .map(l => `
      <div class="schedule-row">
        <label class="small">${escapeHtml(l)}</label>
        <input type="text" data-schedule-lottery="${escapeHtml(l)}" value="${escapeHtml(getScheduleFor(l))}" placeholder="Ej: 8:55 PM">
      </div>
    `)
    .join("");
}

// ============================================
// INICIALIZACIÓN
// ============================================
async function initializeData() {
  setDefaultDateInputs();
  loadSchedule();
  const statusEl = document.getElementById("data-init-status");
  statusEl.innerHTML = '<div class="loading"><div class="spinner"></div><span>Cargando datos...</span></div>';

  const localData = localStorage.getItem(KEY);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(REMOTE_JSON_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const remoteData = await response.json();
      const normalized = normalizeRecords(remoteData);
      if (normalized.length > 0) {
        data = normalized;
        dataSource = "remote";
        localStorage.setItem(KEY, JSON.stringify(data));
        localStorage.setItem(REMOTE_DATA_KEY, new Date().toISOString());
        statusEl.innerHTML = '<div class="good" style="font-size:13px">✓ Datos descargados desde servidor remoto</div>';
      } else {
        throw new Error("JSON remoto vacío o sin registros válidos");
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    // Sin conexión o fallo remoto: usar caché local, o el respaldo estático, sin romper la app
    if (localData) {
      const normalized = normalizeRecords(safeParseJSON(localData));
      if (normalized.length > 0) {
        data = normalized;
        dataSource = "local";
        statusEl.innerHTML = '<div class="warning" style="font-size:13px">⚠️ Sin conexión: usando datos guardados localmente</div>';
      } else {
        data = INITIAL.map(x => ({...x}));
        dataSource = "seed";
        statusEl.innerHTML = '<div class="warning" style="font-size:13px">⚠️ Usando datos iniciales (respaldo)</div>';
      }
    } else {
      data = INITIAL.map(x => ({...x}));
      dataSource = "seed";
      statusEl.innerHTML = '<div class="warning" style="font-size:13px">⚠️ Usando datos iniciales (respaldo)</div>';
    }
  }

  buildLotteryList();
  updateDataSourceBadge();
  renderHistory();
  analyze();
}

// ============================================
// SELECTOR DE LOTERÍAS + BÚSQUEDA INTELIGENTE AND/OR
// ============================================
function normalizeText(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Determina si el nombre de una lotería coincide con el query flexible.
// Comas => operador OR entre grupos. Espacios dentro de un grupo => operador AND.
function lotteryMatchesQuery(lotteryName, query) {
  const q = (query || "").trim();
  if (!q) return true;
  const normalizedName = normalizeText(lotteryName);
  const orGroups = q.split(",").map(g => g.trim()).filter(Boolean);
  if (orGroups.length === 0) return true;

  return orGroups.some(group => {
    const words = group.split(/\s+/).map(normalizeText).filter(Boolean);
    if (words.length === 0) return false;
    return words.every(w => normalizedName.includes(w));
  });
}

// El filtro que se usa en analyze() es SIEMPRE la selección manual del
// dropdown (checklist + chips). El buscador de dentro del dropdown ya no
// actúa como un modo de filtro alterno: solo acota qué loterías se ven en
// la lista para poder encontrarlas más rápido, evitando el comportamiento
// dual confuso que había antes (a veces analizaba por texto, a veces por
// selección, según si el buscador tenía contenido).
function getActiveLotteryFilter() {
  return (lotteryName) => selectedLotteries.has(lotteryName);
}

// BUG corregido (causa real de "la app no hace nada"): el botón único
// "Seleccionar todas" era en realidad un toggle. Si ya estaban todas
// marcadas, al pulsarlo se DESmarcaban todas y esa selección vacía se
// guardaba en localStorage. En la siguiente visita la app arrancaba sin
// ninguna lotería seleccionada -y sin ningún aviso claro- así que todo
// salía vacío. Ahora hay dos acciones explícitas e inequívocas
// (Seleccionar todas / Vaciar selección) y, además, un estado vacío
// visible que explica qué hacer en vez de fallar en silencio.
function buildLotteryList() {
  const seen = new Set();
  allLotteries = [];
  data.forEach(r => {
    if (!seen.has(r.lottery)) {
      allLotteries.push(r.lottery);
      seen.add(r.lottery);
    }
  });

  const saved = localStorage.getItem(SELECTED_LOTTERIES_KEY);
  const savedList = saved ? safeParseJSON(saved) : null;
  if (Array.isArray(savedList) && savedList.length > 0) {
    selectedLotteries = new Set(savedList.filter(l => allLotteries.includes(l)));
  } else {
    // Por defecto, para que la app muestre algo útil de inmediato,
    // se seleccionan todas las loterías disponibles.
    selectedLotteries = new Set(allLotteries);
  }

  renderLotterySelector();
  renderSelectedChips();
  renderScheduleEditor();
}

function persistSelection() {
  localStorage.setItem(SELECTED_LOTTERIES_KEY, JSON.stringify([...selectedLotteries]));
}

function renderLotterySelector() {
  const query = document.getElementById("lottery-search")?.value || "";
  const selector = document.getElementById("lottery-selector");
  const visible = query.trim()
    ? allLotteries.filter(l => lotteryMatchesQuery(l, query))
    : allLotteries;

  if (visible.length === 0) {
    selector.innerHTML = '<div class="lottery-option muted">Sin coincidencias para esa búsqueda.</div>';
    return;
  }

  // BUG corregido: antes se armaba onclick="toggleLottery('...')" escapando
  // solo comillas simples a mano; un nombre con comillas dobles o "<"
  // rompía el atributo/HTML. Ahora se escapa con escapeHtml() y el click
  // se maneja por delegación de eventos (ver listener más abajo).
  selector.innerHTML = visible
    .map(lottery => {
      const hour = getScheduleFor(lottery);
      return `
      <div class="lottery-option ${selectedLotteries.has(lottery) ? "selected" : ""}"
           data-lottery="${escapeHtml(lottery)}">
        <span class="lottery-option-name">${selectedLotteries.has(lottery) ? "✓ " : ""}${escapeHtml(lottery)}</span>
        <span class="lottery-option-hour">${hour ? "🕒 " + escapeHtml(hour) : "Horario no confirmado"}</span>
      </div>
    `;
    })
    .join("");
}

// Chips con las loterías seleccionadas, mostradas arriba del dropdown.
function renderSelectedChips() {
  const container = document.getElementById("lottery-chips");
  const label = document.getElementById("lottery-dropdown-label");
  if (!container) return;

  const selected = allLotteries.filter(l => selectedLotteries.has(l));

  if (selected.length === 0) {
    container.innerHTML = '<span class="muted small" id="lottery-chips-empty">Ninguna lotería seleccionada todavía.</span>';
  } else {
    container.innerHTML = selected
      .map(l => `
        <span class="lottery-chip" data-lottery="${escapeHtml(l)}">
          ${escapeHtml(l)}
          <button type="button" title="Quitar" data-remove-lottery="${escapeHtml(l)}">×</button>
        </span>
      `)
      .join("");
  }

  if (label) {
    label.textContent = selected.length === 0
      ? "Seleccionar loterías…"
      : `${selected.length} de ${allLotteries.length} loterías seleccionadas`;
  }
}

function handleLotterySearch() {
  renderLotterySelector();
}

function toggleLottery(lottery) {
  if (selectedLotteries.has(lottery)) {
    selectedLotteries.delete(lottery);
  } else {
    selectedLotteries.add(lottery);
  }
  persistSelection();
  renderLotterySelector();
  renderSelectedChips();
  analyze();
}

function selectAllLotteries() {
  selectedLotteries = new Set(allLotteries);
  persistSelection();
  renderLotterySelector();
  renderSelectedChips();
  analyze();
}

function clearAllLotteries() {
  selectedLotteries.clear();
  persistSelection();
  renderLotterySelector();
  renderSelectedChips();
  analyze();
}

// ---- Dropdown abrir/cerrar ----
function toggleLotteryDropdown(forceOpen) {
  const dropdown = document.getElementById("lottery-dropdown");
  if (!dropdown) return;
  const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !dropdown.classList.contains("open");
  dropdown.classList.toggle("open", shouldOpen);
  if (shouldOpen) {
    document.getElementById("lottery-search")?.focus();
  }
}

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("lottery-dropdown");
  if (!dropdown) return;
  if (!dropdown.contains(e.target)) {
    dropdown.classList.remove("open");
  }
});

function updateDataSourceBadge() {
  const badge = document.getElementById("data-source-badge");
  let badgeClass, badgeText, badgeMeta;

  switch (dataSource) {
    case "remote":
      badgeClass = "remote";
      badgeText = "📡 Datos remoto";
      badgeMeta = `Sincronizado: ${formatTimestamp(localStorage.getItem(REMOTE_DATA_KEY))}`;
      break;
    case "local":
      badgeClass = "local";
      badgeText = "💾 Datos locales";
      badgeMeta = "Guardados en navegador";
      break;
    case "seed":
      badgeClass = "seed";
      badgeText = "🌱 Datos iniciales";
      badgeMeta = "Ejemplo incluido";
      break;
  }

  badge.className = `data-status ${badgeClass}`;
  badge.innerHTML = `<div>${badgeText}<br><span style="font-size:11px;opacity:.8">${badgeMeta}</span></div>`;
  badge.style.display = "flex";

  const headerMeta = document.querySelector("header .meta");
  headerMeta.textContent = badgeText + " • Registros: " + data.length + " • Loterías: " + allLotteries.length;

  document.getElementById("total-records").textContent = data.length;
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  // Solo aplica a un timestamp ISO de sincronización (no a una fecha de sorteo), es seguro usar Date aquí.
  try {
    return new Date(iso).toLocaleString('es-DO');
  } catch {
    return iso;
  }
}

// ============================================
// SINCRONIZACIÓN REMOTA CON BANNER DE ESTADO
// ============================================
function showSyncBanner(state, message) {
  const banner = document.getElementById("sync-banner");
  banner.className = `sync-banner show ${state}`;
  const icons = { syncing: "🔄", success: "✅", error: "⚠️" };
  banner.innerHTML = `<span>${icons[state] || ""}</span><span>${message}</span>`;
  if (state !== "syncing") {
    setTimeout(() => { banner.classList.remove("show"); }, 5000);
  }
}

// BUG corregido: la función usaba el global implícito `event` (window.event)
// para saber qué botón la disparó. Eso solo funciona por comportamiento
// heredado de los navegadores en handlers inline y se rompe (ReferenceError)
// en scripts con "use strict"/módulos o si se llama programáticamente.
// Ahora recibe el evento explícito: onclick="refreshRemoteData(event)".
async function refreshRemoteData(evt) {
  const btn = evt.currentTarget;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Sincronizando...";
  showSyncBanner("syncing", "Sincronizando con el repositorio remoto...");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(REMOTE_JSON_URL, {
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const remoteData = await response.json();
      const normalized = normalizeRecords(remoteData);
      if (normalized.length > 0) {
        data = normalized;
        dataSource = "remote";
        localStorage.setItem(KEY, JSON.stringify(data));
        localStorage.setItem(REMOTE_DATA_KEY, new Date().toISOString());
        buildLotteryList();
        updateDataSourceBadge();
        renderHistory();
        analyze();
        setStatus(`✓ ${data.length} registros actualizados desde el servidor`, true);
        showSyncBanner("success", `Actualizado con éxito — ${data.length} registros cargados`);
      } else {
        setStatus("✗ El JSON remoto llegó vacío o con formato inválido", false);
        showSyncBanner("error", "Datos remotos inválidos: se mantiene el caché local");
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (err) {
    // Fallback: intenta LocalStorage; si no hay, se queda con lo que ya está cargado en memoria (seed o lo previo)
    const localData = localStorage.getItem(KEY);
    if (localData) {
      const normalized = normalizeRecords(safeParseJSON(localData));
      if (normalized.length > 0) {
        data = normalized;
        if (dataSource !== "remote") dataSource = "local";
      }
      // si el caché también está corrupto, se mantiene lo que ya había en memoria (seed o lo previo)
    }
    buildLotteryList();
    updateDataSourceBadge();
    renderHistory();
    analyze();
    setStatus("✗ Error de red: no se pudo conectar al servidor remoto", false);
    showSyncBanner("error", "Error de red: usando caché local / datos de respaldo");
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

// ============================================
// UTILIDADES DE FECHA SIN ZONA HORARIA
// Nunca usar new Date() para comparar fechas de sorteos: se parte el string
// 'YYYY-MM-DD' directamente para evitar desfases UTC vs Local en móviles.
// ============================================
function splitDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

// Compara dos fechas 'YYYY-MM-DD' sin objetos Date (funciona porque el formato
// zero-padded hace que la comparación lexicográfica de string equivalga a la cronológica).
function compareDateStrings(a, b) {
  return b.localeCompare(a); // orden descendente (más reciente primero)
}

// Días por mes (año no bisiesto para febrero; es una aproximación suficiente
// para calcular "el día anterior" al comparar fechas como 17/18 de agosto,
// donde el caso 29 de febrero es un borde poco relevante para este uso).
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Devuelve {m, d} del día calendario anterior a (month, day), cruzando de
// mes cuando corresponde (ej: 1 de marzo -> 28 de febrero). Se usa SOLO para
// la comparación automática de fechas (V4), nunca para ordenar/comparar
// fechas reales de sorteos (eso sigue siendo compareDateStrings sobre strings).
function getPreviousCalendarDay(month, day) {
  if (day > 1) return { m: month, d: day - 1 };
  const prevMonth = month === 1 ? 12 : month - 1;
  return { m: prevMonth, d: DAYS_IN_MONTH[prevMonth - 1] };
}

// ============================================
// PESO POR ANTIGÜEDAD (V4)
// Da más importancia a los sorteos recientes SIN eliminar los antiguos del
// cálculo: el peso decae con la distancia en años pero nunca baja de
// RECENCY_FLOOR, así un dato de hace 10 años sigue contando, solo que menos
// que uno de este año. currentYear usa el reloj real: aquí es correcto
// porque solo mide "qué tan viejo es un dato", no se usa para ordenar ni
// comparar fechas de sorteos entre sí.
// ============================================
const RECENCY_DECAY = 0.15;
const RECENCY_FLOOR = 0.35;
const currentYearForWeights = new Date().getFullYear();

function recencyWeight(year) {
  const yearsAgo = Math.max(0, currentYearForWeights - Number(year));
  const w = 1 / (1 + yearsAgo * RECENCY_DECAY);
  return Math.max(RECENCY_FLOOR, w);
}

// ============================================
// ANÁLISIS Y CÁLCULOS
// Genera un bloque de resultados INDEPENDIENTE por cada lotería
// seleccionada (nunca mezcla números de loterías distintas entre sí).
// ============================================
function analyze() {
  const m = +document.getElementById("month").value;
  const d = +document.getElementById("day").value;
  const top = +document.getElementById("top").value;

  const summaryEl = document.getElementById("summary");
  const resultsEl = document.getElementById("results-container");

  // Se preserva el orden de allLotteries para que los bloques salgan
  // siempre en un orden estable, no en el orden en que fueron clicadas.
  const selected = allLotteries.filter(l => selectedLotteries.has(l));

  if (selected.length === 0) {
    summaryEl.innerHTML = "";
    resultsEl.innerHTML = `
      <section class="card">
        <div class="empty">👆 Selecciona al menos una lotería arriba para ver sus resultados.</div>
      </section>
    `;
    return;
  }

  let totalRows = 0;
  const yearsSeen = new Set();
  const blocks = selected.map(lottery => {
    const block = buildLotteryResultBlock(lottery, m, d, top);
    totalRows += block.rowCount;
    block.years.forEach(yr => yearsSeen.add(yr));
    return block.html;
  });

  summaryEl.innerHTML = `
    <div><div class="stat">${selected.length}</div><div class="stat-label">Loterías analizadas</div></div>
    <div><div class="stat">${totalRows}</div><div class="stat-label">Sorteos encontrados</div></div>
    <div><div class="stat">${pad(d)}/${pad(m)}</div><div class="stat-label">Día/Mes analizado (todos los años)</div></div>
    <div><div class="stat">${yearsSeen.size}</div><div class="stat-label">Años distintos con datos</div></div>
  `;

  resultsEl.innerHTML = blocks.join("");
}

// Calcula ranking, palés e insights para UNA sola lotería y devuelve el
// bloque HTML ya armado, junto con la cantidad de sorteos encontrados.
// Combina TODOS los años del histórico para el día/mes dado: comparar por
// año exacto no aporta nada aquí, es una sola muestra por año; lo que
// tiene valor estadístico es acumular ese día/mes a través de los años.
function buildLotteryResultBlock(lottery, m, d, top) {
  const lotteryFilter = (l) => l === lottery;

  const rows = data.filter(r => {
    const { m: month, d: day } = splitDate(r.date);
    return month === m && day === d && lotteryFilter(r.lottery);
  });

  const years = [...new Set(rows.map(r => r.date.substring(0, 4)))];
  const hour = getScheduleFor(lottery);

  let html = `<section class="card lottery-result-block">
    <div class="lottery-result-header">
      <h3>🎰 ${escapeHtml(lottery)}${hour ? ` <span class="lottery-hour-tag">🕒 ${escapeHtml(hour)}</span>` : ""}</h3>
      <span class="badge-count">${rows.length} sorteo${rows.length === 1 ? "" : "s"} · ${years.length} año${years.length === 1 ? "" : "s"}</span>
    </div>`;

  if (rows.length === 0) {
    html += '<div class="empty">No hay datos para esta lotería en ese día/mes, en ningún año del histórico.</div></section>';
    return { html, rowCount: 0, years: [] };
  }

  if (years.length <= 1) {
    html += `<div class="hint">Ya se están comparando TODOS los años de tu histórico para este día/mes — es que solo tienes ${years.length} año cargado para esta lotería en esa fecha. Importa más historial (CSV) o actualiza los datos remotos para comparar más años.</div>`;
  }

  const freq = {}, pair = {}, yearFreq = {}, weightedFreq = {}, terminationFreq = {};

  rows.forEach(r => {
    const ns = [...new Set(r.numbers)];
    const yr = r.date.substring(0, 4);
    const w = recencyWeight(yr);
    ns.forEach(n => {
      freq[n] = (freq[n] || 0) + 1;
      weightedFreq[n] = (weightedFreq[n] || 0) + w;
      yearFreq[n] ??= {};
      yearFreq[n][yr] = (yearFreq[n][yr] || 0) + 1;
      const term = n.slice(-1);
      terminationFreq[term] = (terminationFreq[term] || 0) + 1;
    });

    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const p = [ns[i], ns[j]].sort().join("–");
        pair[p] = (pair[p] || 0) + 1;
      }
    }
  });

  const maxFreq = Math.max(...Object.values(freq), 1);
  const maxWeighted = Math.max(...Object.values(weightedFreq), 0.0001);
  const maxYears = Math.max(...Object.values(yearFreq).map(y => Object.keys(y).length), 1);

  // Puntaje transparente del ranking de números (V4):
  //   40% frecuencia histórica bruta + 25% cantidad de años distintos
  //   + 35% frecuencia ponderada por antigüedad (peso por antigüedad, ver
  //   recencyWeight). Cada componente se normaliza 0-100 contra el máximo
  //   observado en ESTA lotería/fecha antes de combinarlo, para que el
  //   puntaje final también quede en escala 0-100 y sea comparable entre
  //   números. Nunca se usa para afirmar que un número "va a salir".
  const ranked = Object.entries(freq)
    .map(([n, c]) => {
      const years = Object.keys(yearFreq[n] || {}).length;
      const wFreq = weightedFreq[n] || 0;
      const freqPct = (c / maxFreq) * 100;
      const yearsPct = (years / maxYears) * 100;
      const weightedPct = (wFreq / maxWeighted) * 100;
      const score = freqPct * 0.40 + yearsPct * 0.25 + weightedPct * 0.35;
      return { n, c, years, wFreq, freqPct, yearsPct, weightedPct, score, yearsList: Object.keys(yearFreq[n] || {}).sort() };
    })
    .sort((a, b) => b.score - a.score || b.c - a.c || a.n.localeCompare(b.n));

  const pairs = Object.entries(pair)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const allPossibleNumbers = Array.from({length: 100}, (_, i) => pad(i));
  const hotNumbers = new Set(ranked.map(x => x.n));
  const coldNumbers = allPossibleNumbers.filter(n => !hotNumbers.has(n));

  // Ranking con barras de progreso CSS: los 5 más calientes resaltan en rojo/naranja
  const topRanked = ranked.slice(0, top);
  const topNumberSet = new Set(topRanked.map(x => x.n));

  html += '<div class="lottery-result-sub">🔥 Ranking estadístico (puntaje: 40% frecuencia + 25% años distintos + 35% ponderado por antigüedad)</div>';
  html += `
    <table>
      <tr><th>#</th><th>Número</th><th>Frecuencia</th><th>Años</th><th>Puntaje</th></tr>
      ${topRanked.map((x, i) => {
        const stars = generateStars(x.score, 100);
        const ranking_class = i < 3 ? "hot" : i < 8 ? "recommended" : "";
        const barClass = i < 5 ? "bar-hot" : "bar-normal";
        const widthPct = Math.max(6, (x.c / maxFreq) * 100);
        return `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td><span class="num ${ranking_class}">${x.n}</span></td>
            <td>
              <div class="progress-bar-container">
                <div class="progress-bar">
                  <div class="progress-fill ${barClass}" style="width: ${widthPct}%">
                    ${x.c}
                  </div>
                </div>
                <div class="frequency-count">${x.c}</div>
              </div>
            </td>
            <td><strong>${x.years}</strong></td>
            <td><span class="stars">${stars}</span> <span class="small muted">${x.score.toFixed(1)}</span></td>
          </tr>
        `;
      }).join("")}
    </table>
  `;

  html += '<div class="lottery-result-sub">🔁 Repetición entre años</div>';
  html += buildRepetitionSection(topRanked.slice(0, 10), years.length);

  html += '<div class="lottery-result-sub">📉 Rachas por número</div>';
  html += buildStreakSection(topRanked.slice(0, 10), years);

  html += '<div class="lottery-result-sub">#️⃣ Terminaciones</div>';
  html += buildTerminationSection(terminationFreq, rows.length);

  html += '<div class="lottery-result-sub">🪞 Números espejo</div>';
  html += buildMirrorSection(topRanked.slice(0, 8), freq);

  html += '<div class="lottery-result-sub">💡 Recomendaciones inteligentes</div>';
  html += renderIntelligentRecommendations(ranked, coldNumbers.slice(0, 5), m, d, lotteryFilter);

  html += '<div class="lottery-result-sub">🎯 Palés frecuentes</div>';
  if (pairs.length) {
    html += `
      <table>
        <tr><th>#</th><th>Palé</th><th>Apariciones</th><th>Tipo</th></tr>
        ${pairs.slice(0, top).map((x, i) => {
          const [a, b] = x[0].split("–");
          const crossed = topNumberSet.has(a) && topNumberSet.has(b);
          return `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td><span class="num">${x[0]}</span></td>
            <td><strong>${x[1]}</strong></td>
            <td>${crossed ? '<span class="lottery-hour-tag">🔗 Palé cruzado</span>' : '<span class="small muted">—</span>'}</td>
          </tr>
        `;}).join("")}
      </table>
      <div class="hint">🔗 "Palé cruzado" = sus dos números están AMBOS en el top del ranking estadístico de esta fecha.</div>
    `;
  } else {
    html += '<div class="empty">No hay palés suficientes.</div>';
  }

  html += '<div class="lottery-result-sub">🎯 Palés destacados estadísticamente (candidatos)</div>';
  html += buildPaleCandidatesSection(topRanked.slice(0, 8), pair);

  html += '<div class="lottery-result-sub">📅 Comparación con el día anterior</div>';
  html += buildDateComparisonSection(m, d, lottery, ranked, pairs);

  html += buildConfidencePanel(rows.length, years.length);

  html += '</section>';
  return { html, rowCount: rows.length, years };
}

// ============================================
// REPETICIÓN ENTRE AÑOS (V4)
// Para cada número del top, muestra en qué años concretos apareció en esa
// fecha, para detectar de un vistazo si se repite seguido o de forma salteada.
// ============================================
function buildRepetitionSection(topRanked, totalYears) {
  if (topRanked.length === 0 || totalYears === 0) {
    return '<div class="empty">Sin datos suficientes.</div>';
  }
  return `
    <table>
      <tr><th>Número</th><th>Años en los que apareció</th><th>Presencia</th></tr>
      ${topRanked.map(x => `
        <tr>
          <td><span class="num">${x.n}</span></td>
          <td class="small">${x.yearsList.join(", ")}</td>
          <td><strong>${x.years}</strong> de ${totalYears} años</td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ============================================
// RACHAS (V4)
// A partir de los años (ordenados) en que cada número apareció en esta
// fecha, calcula la racha de años CONSECUTIVOS más larga y si el patrón es
// más bien consecutivo o alterno (salteado). Es descriptivo, no predictivo.
// ============================================
function buildStreakSection(topRanked, allYearsForDate) {
  if (topRanked.length === 0) return '<div class="empty">Sin datos suficientes.</div>';
  const sortedAllYears = [...allYearsForDate].sort();

  const rowsHtml = topRanked.map(x => {
    const ys = x.yearsList.map(Number).sort((a, b) => a - b);
    let longestStreak = 1, currentStreak = 1;
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] === ys[i - 1] + 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }
    if (ys.length <= 1) longestStreak = ys.length;
    const pattern = ys.length <= 1 ? "—" : (longestStreak >= Math.ceil(ys.length * 0.6) ? "Tiende a ser consecutivo" : "Tiende a ser alterno/salteado");
    const lastYear = sortedAllYears[sortedAllYears.length - 1];
    const ausente = ys.length > 0 && String(ys[ys.length - 1]) !== lastYear;
    return `
      <tr>
        <td><span class="num">${x.n}</span></td>
        <td><strong>${longestStreak}</strong> año${longestStreak === 1 ? "" : "s"} seguido${longestStreak === 1 ? "" : "s"}</td>
        <td class="small">${pattern}</td>
        <td class="small">${ausente ? `Ausente desde ${ys[ys.length - 1]}` : "Presente en el último año con datos"}</td>
      </tr>
    `;
  }).join("");

  return `<table><tr><th>Número</th><th>Racha más larga</th><th>Patrón</th><th>Últimos años</th></tr>${rowsHtml}</table>`;
}

// ============================================
// TERMINACIONES (V4)
// Frecuencia del último dígito de cada número, sobre todos los sorteos
// filtrados por fecha/lotería (no solo del top de números).
// ============================================
function buildTerminationSection(terminationFreq, totalRows) {
  const entries = Object.entries(terminationFreq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (entries.length === 0) return '<div class="empty">Sin datos suficientes.</div>';
  const max = Math.max(...entries.map(e => e[1]), 1);
  return `
    <table>
      <tr><th>Terminación</th><th>Apariciones</th><th></th></tr>
      ${entries.map(([term, count]) => `
        <tr>
          <td><span class="num">…${term}</span></td>
          <td><strong>${count}</strong></td>
          <td>
            <div class="progress-bar"><div class="progress-fill bar-normal" style="width:${Math.max(6, (count / max) * 100)}%">${count}</div></div>
          </td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ============================================
// NÚMEROS ESPEJO (V4)
// El espejo de un número de 2 cifras es el mismo número con las cifras
// invertidas (12 <-> 21, 35 <-> 53). Si ambas cifras son iguales (33, 44),
// el número es su propio espejo. Se muestra, para cada número del top, si
// su espejo también tuvo actividad en esta misma fecha/lotería.
// ============================================
function mirrorOf(n) {
  const chars = n.split("");
  return chars.reverse().join("").padStart(2, "0").slice(-2);
}

function buildMirrorSection(topRanked, freq) {
  if (topRanked.length === 0) return '<div class="empty">Sin datos suficientes.</div>';
  const rowsHtml = topRanked.map(x => {
    const mirror = mirrorOf(x.n);
    const isSelfMirror = mirror === x.n;
    const mirrorFreq = freq[mirror] || 0;
    return `
      <tr>
        <td><span class="num">${x.n}</span></td>
        <td>${isSelfMirror ? '<span class="small muted">Es capicúa (su propio espejo)</span>' : `<span class="num">${mirror}</span>`}</td>
        <td>${isSelfMirror ? "—" : `<strong>${mirrorFreq}</strong> aparición${mirrorFreq === 1 ? "" : "es"}`}</td>
      </tr>
    `;
  }).join("");
  return `<table><tr><th>Número</th><th>Espejo</th><th>Frecuencia del espejo en esta fecha</th></tr>${rowsHtml}</table>
    <div class="hint">Se calcula invirtiendo las cifras del número (ej: 35 → 53). No implica ninguna relación causal entre ambos.</div>`;
}

// ============================================
// PALÉS DESTACADOS ESTADÍSTICAMENTE — "buscar palés candidatos" (V4)
// Genera TODAS las combinaciones posibles entre los números del top y las
// puntúa combinando: puntaje individual de cada número (ya calculado en
// `ranked`) + si la pareja ya apareció junta históricamente en esta fecha
// (bonus) + si son números espejo entre sí (bonus menor, es solo un patrón
// numérico, no una relación estadística real). Nunca se llaman "más
// probables": son "palés destacados estadísticamente".
// ============================================
function buildPaleCandidatesSection(topRanked, pairMap) {
  if (topRanked.length < 2) return '<div class="empty">Se necesitan al menos 2 números en el top para generar combinaciones.</div>';

  const maxIndividualScore = Math.max(...topRanked.map(x => x.score), 0.0001);
  const candidates = [];

  for (let i = 0; i < topRanked.length; i++) {
    for (let j = i + 1; j < topRanked.length; j++) {
      const a = topRanked[i], b = topRanked[j];
      const key = [a.n, b.n].sort().join("–");
      const historicAppearances = pairMap[key] || 0;
      const isMirror = mirrorOf(a.n) === b.n;

      // Puntaje del candidato: 40% puntaje individual del número A + 40% del
      // número B (normalizados 0-100) + 15% si el palé ya salió junto
      // históricamente en esta fecha + 5% si son números espejo.
      const indivScorePct = ((a.score / maxIndividualScore) + (b.score / maxIndividualScore)) / 2 * 100;
      const historicBonus = Math.min(100, historicAppearances * 25);
      const mirrorBonus = isMirror ? 100 : 0;
      const score = indivScorePct * 0.80 + historicBonus * 0.15 + mirrorBonus * 0.05;

      candidates.push({ key, a: a.n, b: b.n, historicAppearances, isMirror, score });
    }
  }

  candidates.sort((x, y) => y.score - x.score || y.historicAppearances - x.historicAppearances || x.key.localeCompare(y.key));
  const top10 = candidates.slice(0, 10);

  return `
    <table>
      <tr><th>#</th><th>Palé</th><th>¿Ya salieron juntos?</th><th>Espejo</th><th>Puntaje</th></tr>
      ${top10.map((c, i) => `
        <tr>
          <td><strong>${i + 1}</strong></td>
          <td><span class="num recommended">${c.key}</span></td>
          <td class="small">${c.historicAppearances > 0 ? `Sí, ${c.historicAppearances} vez${c.historicAppearances === 1 ? "" : "es"}` : "No, es una combinación nueva"}</td>
          <td class="small">${c.isMirror ? "Sí" : "—"}</td>
          <td><strong>${c.score.toFixed(1)}</strong></td>
        </tr>
      `).join("")}
    </table>
    <div class="hint">Puntaje = 80% fuerza estadística individual de ambos números + 15% si ya aparecieron juntos en esta fecha + 5% si son números espejo. Son combinaciones destacadas del histórico analizado, no una predicción de resultado.</div>
  `;
}

// ============================================
// COMPARACIÓN AUTOMÁTICA CON EL DÍA ANTERIOR (V4)
// Ej: si se analiza el 18 de agosto, compara automáticamente contra el 17
// de agosto para la misma lotería: números y palés en común, y cuáles
// números subieron o bajaron en frecuencia de una fecha a otra.
// ============================================
function buildDateComparisonSection(month, day, lottery, currentRanked, currentPairs) {
  const prev = getPreviousCalendarDay(month, day);
  const prevRows = data.filter(r => {
    const { m: rm, d: rd } = splitDate(r.date);
    return rm === prev.m && rd === prev.d && r.lottery === lottery;
  });

  if (prevRows.length === 0) {
    return `<div class="empty">Sin datos para el ${pad(prev.d)}/${pad(prev.m)} (día anterior) en esta lotería, no se puede comparar.</div>`;
  }

  const prevFreq = {};
  prevRows.forEach(r => {
    [...new Set(r.numbers)].forEach(n => { prevFreq[n] = (prevFreq[n] || 0) + 1; });
  });

  const currentFreq = {};
  currentRanked.forEach(x => { currentFreq[x.n] = x.c; });

  const currentTop = new Set(currentRanked.slice(0, 10).map(x => x.n));
  const prevTop = new Set(Object.entries(prevFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(x => x[0]));
  const common = [...currentTop].filter(n => prevTop.has(n));

  const allNums = new Set([...Object.keys(currentFreq), ...Object.keys(prevFreq)]);
  const up = [], down = [];
  allNums.forEach(n => {
    const cur = currentFreq[n] || 0, prv = prevFreq[n] || 0;
    if (cur > prv) up.push({ n, delta: cur - prv });
    else if (prv > cur) down.push({ n, delta: prv - cur });
  });
  up.sort((a, b) => b.delta - a.delta);
  down.sort((a, b) => b.delta - a.delta);

  const prevPairSet = new Set();
  prevRows.forEach(r => {
    const ns = [...new Set(r.numbers)];
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      prevPairSet.add([ns[i], ns[j]].sort().join("–"));
    }
  });
  const commonPairs = currentPairs.map(x => x[0]).filter(p => prevPairSet.has(p)).slice(0, 5);

  return `
    <div class="insights-grid">
      <div class="insight-card">
        <strong>Números en el top de ambas fechas</strong>
        <div>${common.length ? common.map(n => `<span class="num">${n}</span>`).join(" ") : "Ninguno en común"}</div>
      </div>
      <div class="insight-card">
        <strong>📈 Subieron vs. el ${pad(prev.d)}/${pad(prev.m)}</strong>
        <div>${up.slice(0, 5).map(x => `<span class="num">${x.n}</span> (+${x.delta})`).join(" ") || "Sin cambios"}</div>
      </div>
      <div class="insight-card">
        <strong>📉 Bajaron vs. el ${pad(prev.d)}/${pad(prev.m)}</strong>
        <div>${down.slice(0, 5).map(x => `<span class="num">${x.n}</span> (-${x.delta})`).join(" ") || "Sin cambios"}</div>
      </div>
      <div class="insight-card">
        <strong>Palés en común</strong>
        <div>${commonPairs.length ? commonPairs.map(p => `<span class="num">${p}</span>`).join(" ") : "Ninguno en común"}</div>
      </div>
    </div>
  `;
}

// ============================================
// PANEL DE CONFIANZA ESTADÍSTICA (V4)
// Clasifica el tamaño de muestra (sorteos/años analizados) en baja/media/alta
// confianza. Es solo una indicación de cuánto histórico respalda el análisis,
// NUNCA una probabilidad de acierto ni una predicción.
// ============================================
function buildConfidencePanel(rowCount, yearCount) {
  let level, cls, msg;
  if (yearCount < 3 || rowCount < 5) {
    level = "Baja"; cls = "warning";
    msg = "Muy pocos sorteos/años en el histórico para esta fecha y lotería. Los patrones que se ven pueden deberse simplemente al azar de una muestra chica.";
  } else if (yearCount < 6 || rowCount < 15) {
    level = "Media"; cls = "warning";
    msg = "Hay histórico razonable, pero sigue siendo una muestra limitada. Trata estos números como referencia, no como certeza.";
  } else {
    level = "Alta (relativa)"; cls = "good";
    msg = "Hay bastante histórico acumulado para esta fecha y lotería, lo que hace el patrón más estable estadísticamente. Aun así, cada sorteo es independiente y aleatorio: el histórico no cambia las probabilidades del próximo.";
  }
  return `
    <div class="${cls} small" style="margin-top:12px">
      📊 <strong>Confianza estadística: ${level}</strong> (${rowCount} sorteos, ${yearCount} años) — ${msg}
    </div>
  `;
}

function generateStars(score, maxScore) {
  const starCount = Math.min(5, Math.ceil((score / maxScore) * 5));
  return "⭐".repeat(starCount) + "☆".repeat(5 - starCount);
}

// ============================================
// RECOMENDACIONES INTELIGENTES: ÍNDICE DE ATRASO + FRECUENCIA
// Analiza TODO el histórico filtrado (todos los años) para el mismo día/mes,
// ordena los sorteos de más reciente a más antiguo (sin new Date()) y calcula:
//   - Frecuencia: veces que salió el número en esa fecha específica
//   - Atraso: cantidad de sorteos transcurridos desde su última aparición
// Puntuación = combinación ponderada de ambos factores (Top 3 real, no estático).
// ============================================
function buildAtrasoStats(month, day, lotteryFilter) {
  const matched = data.filter(r => {
    const { m: rm, d: rd } = splitDate(r.date);
    return rm === month && rd === day && lotteryFilter(r.lottery);
  });

  // Orden descendente por fecha (más reciente primero) usando comparación de strings,
  // válido porque el formato YYYY-MM-DD zero-padded ordena igual lexicográfica y cronológicamente.
  matched.sort((a, b) => compareDateStrings(a.date, b.date));

  const freq = {};
  const lastSeenIndex = {}; // índice del sorteo (0 = más reciente) donde apareció por última vez

  matched.forEach((r, idx) => {
    const uniqueNums = [...new Set(r.numbers)];
    uniqueNums.forEach(n => {
      freq[n] = (freq[n] || 0) + 1;
      if (!(n in lastSeenIndex)) lastSeenIndex[n] = idx;
    });
  });

  const totalSorteos = matched.length;
  const allNums = Array.from({length: 100}, (_, i) => pad(i));

  const stats = allNums.map(n => {
    const frequency = freq[n] || 0;
    const atraso = frequency > 0 ? lastSeenIndex[n] : totalSorteos;
    return { n, frequency, atraso };
  });

  return { stats, totalSorteos };
}

function scoreRecommendations(stats, totalSorteos) {
  if (totalSorteos === 0) return [];
  return stats
    .map(s => {
      const atrasoPct = Math.min(100, (s.atraso / totalSorteos) * 100);
      const freqPct = (s.frequency / totalSorteos) * 100;
      // Peso: 55% índice de atraso, 45% frecuencia histórica en esa fecha
      const score = atrasoPct * 0.55 + freqPct * 0.45;
      return { ...s, atrasoPct, freqPct, score };
    })
    .sort((a, b) => b.score - a.score || b.atraso - a.atraso || a.n.localeCompare(b.n));
}

function renderIntelligentRecommendations(ranked, coldNumbers, month, day, lotteryFilter) {
  if (ranked.length === 0) {
    return '<div class="empty">Sin datos para mostrar insights.</div>';
  }

  const { stats, totalSorteos } = buildAtrasoStats(month, day, lotteryFilter);
  const recommended = scoreRecommendations(stats, totalSorteos).slice(0, 3);

  const topHot = ranked.slice(0, 3);
  const coldNums = coldNumbers.join(", ");

  let html = '<div class="insights-grid">';

  html += '<div class="insight-card">';
  html += '<strong>🔥 Top 3 Calientes</strong>';
  topHot.forEach(n => {
    html += `<div style="color:#991b1b">🔥 ${n.n} (${n.c} veces)</div>`;
  });
  html += '</div>';

  html += '<div class="insight-card">';
  html += '<strong>❄️ Números Fríos</strong>';
  html += `<div style="color:#164e63">Nunca han salido en esta fecha: ${coldNums}</div>`;
  html += '</div>';

  html += '<div class="insight-card">';
  html += '<strong>📊 Dispersión</strong>';
  const unique = Math.round((ranked.length / 100) * 100);
  html += `<div>${unique}% de números han salido en esta fecha</div>`;
  html += `<div style="margin-top:4px;color:#64748b">${totalSorteos} sorteos históricos analizados (todos los años)</div>`;
  html += '</div>';

  html += '</div>'; // cierra insights-grid

  // TOP 3 recomendados: algoritmo real de Índice de Atraso + Frecuencia
  html += '<div class="insight-card" style="margin-top:12px">';
  html += '<strong>✨ TOP 3 Recomendados (Índice de Atraso + Frecuencia)</strong>';
  if (recommended.length === 0 || totalSorteos === 0) {
    html += '<div class="muted">No hay suficiente histórico para calcular el índice de atraso.</div>';
  } else {
    html += '<div class="rec-top3">';
    recommended.forEach(r => {
      html += `
        <div class="rec-chip">
          <span class="big">${r.n}</span>
          <span class="sub">Atraso: ${r.atraso} sorteo${r.atraso === 1 ? "" : "s"}</span>
          <span class="sub">Frecuencia: ${r.frequency}</span>
          <span class="sub">Puntaje: ${r.score.toFixed(1)}</span>
        </div>
      `;
    });
    html += '</div>';
  }
  html += '</div>';

  return html;
}

// ============================================
// UTILIDADES
// ============================================
function pad(n) {
  return String(n).padStart(2, "0");
}

function validateDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// Parseo de JSON "seguro": nunca lanza, devuelve null si el texto es inválido.
function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// Escapa caracteres especiales de HTML. Se usa en todo texto que provenga
// de datos externos (JSON remoto o CSV importado) antes de insertarlo en
// innerHTML, para que un nombre de lotería malicioso/corrupto no pueda
// inyectar HTML o romper atributos.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// BUG corregido: antes `data = remoteData` (o los datos cacheados) se
// asignaba directamente sin validar su forma. Un registro remoto sin
// "date"/"numbers", con fecha mal formada o con números fuera de 00-99
// rompía el resto de la app (splitDate revienta con undefined, o los
// números quedaban sin el padding de 2 dígitos que usa todo el cálculo
// de frecuencias). Aplica la MISMA validación que ya usaba importCSV,
// descartando en silencio cualquier registro inválido.
function normalizeRecords(rawList) {
  if (!Array.isArray(rawList)) return [];
  const clean = [];

  rawList.forEach(r => {
    if (!r || typeof r !== "object") return;

    const date = String(r.date ?? "").trim();
    const lottery = String(r.lottery ?? "").trim();
    if (!validateDate(date) || !lottery) return;
    if (!Array.isArray(r.numbers) || r.numbers.length === 0) return;

    let corrupted = false;
    const numbers = r.numbers.map(n => {
      const cleaned = String(n).replace(/\D/g, "");
      if (cleaned.length === 0 || cleaned.length > 2) {
        corrupted = true;
        return null;
      }
      return pad(parseInt(cleaned, 10));
    });
    if (corrupted) return;

    clean.push({ date, lottery, numbers });
  });

  return clean;
}

// ============================================
// IMPORTACIÓN CSV BLINDADA
// - Limpia espacios en blanco (.trim())
// - Valida fecha con regex ^\d{4}-\d{2}-\d{2}
// - Fuerza pad() en todos los números (2 dígitos)
// - Informa registros exitosos vs fallidos por corrupción
// ============================================
function importCSV() {
  const file = document.getElementById("file").files[0];
  if (!file) {
    setStatus("Selecciona un CSV.", false);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);

    let added = 0, skipped = 0;
    const errors = [];

    lines.forEach((line, i) => {
      if (i === 0 && line.toLowerCase().includes("fecha")) return;

      const parts = line.split(",").map(x => x.trim());

      if (parts.length < 4) {
        skipped++;
        errors.push(`Fila ${i + 1}: formato incorrecto (se esperaban al menos 4 columnas)`);
        return;
      }

      const [dateStrRaw, lotteryRaw, ...numStrsRaw] = parts;
      const dateStr = dateStrRaw.trim();
      const lottery = lotteryRaw.trim();
      const numStrs = numStrsRaw.map(x => x.trim());

      if (!validateDate(dateStr)) {
        skipped++;
        errors.push(`Fila ${i + 1}: fecha inválida "${dateStr}" (formato requerido YYYY-MM-DD)`);
        return;
      }

      if (!lottery) {
        skipped++;
        errors.push(`Fila ${i + 1}: nombre de lotería vacío`);
        return;
      }

      let corrupted = false;
      const numbers = numStrs
        .filter(n => n.length > 0)
        .map(n => {
          const cleaned = n.replace(/\D/g, "");
          if (cleaned.length === 0 || cleaned.length > 2) {
            corrupted = true;
            return null;
          }
          return pad(parseInt(cleaned, 10)); // fuerza siempre 2 dígitos, ej: "5" -> "05"
        });

      if (corrupted || numbers.some(n => n === null)) {
        skipped++;
        errors.push(`Fila ${i + 1}: número corrupto o fuera de rango (00-99)`);
        return;
      }

      if (numbers.length === 0) {
        skipped++;
        errors.push(`Fila ${i + 1}: sin números válidos`);
        return;
      }

      data.push({ date: dateStr, lottery, numbers });
      added++;
    });

    // BUG corregido: antes se llamaba a save() (que ya re-analiza y re-renderiza
    // la historia) ANTES de buildLotteryList(), y nunca se llamaba a
    // updateDataSourceBadge(). Resultado: la cabecera ("Registros: N" y el
    // badge de origen) quedaba desactualizada tras importar, y el origen
    // seguía marcado como "remoto"/"seed" aunque ya había datos locales
    // mezclados con el CSV importado.
    if (added > 0) {
      dataSource = "local";
      buildLotteryList();
      save();
      updateDataSourceBadge();
      const msg = `✓ ${added} registro${added === 1 ? "" : "s"} importado${added === 1 ? "" : "s"} correctamente.` +
        (skipped > 0 ? ` ${skipped} fila${skipped === 1 ? "" : "s"} rechazada${skipped === 1 ? "" : "s"} por corrupción.` : "");
      setStatus(msg, true);
    } else {
      setStatus(`✗ No se importó ningún registro. ${skipped} fila(s) con errores de formato.`, false);
    }

    if (errors.length > 0) {
      console.warn("Detalle de filas rechazadas en la importación CSV:", errors);
    }

    document.getElementById("file").value = "";
  };

  reader.readAsText(file);
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
  renderHistory();
  analyze();
}

function downloadCSV() {
  const csv =
    "fecha,loteria,n1,n2,n3\n" +
    data
      .map(r => [r.date, r.lottery, ...r.numbers].join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "historico_loterias_rd.csv";
  link.click();
}

function resetData() {
  if (confirm("¿Restaurar la base de datos a datos iniciales?")) {
    data = INITIAL.map(x => ({...x}));
    dataSource = "seed";
    localStorage.removeItem(KEY);
    localStorage.removeItem(REMOTE_DATA_KEY);
    localStorage.removeItem(SELECTED_LOTTERIES_KEY);
    const searchInput = document.getElementById("lottery-search");
    if (searchInput) searchInput.value = "";
    buildLotteryList();
    updateDataSourceBadge();
    save();
    setStatus("✓ Base de datos restaurada.", true);
  }
}

function setStatus(message, isSuccess = false) {
  const el = document.getElementById("status");
  el.textContent = message;
  el.className = isSuccess ? "success" : "error";
}

// BUG corregido: r.date y r.lottery se insertaban sin escapar en innerHTML.
// Estos campos pueden venir de un JSON remoto o de un CSV importado, así
// que se escapan con escapeHtml() antes de renderizarlos.
function renderHistory() {
  const rows = [...data].sort((a, b) => compareDateStrings(a.date, b.date));
  document.getElementById("total-records").textContent = data.length;
  document.getElementById("history").innerHTML =
    rows.length > 0
      ? `<table><tr><th>Fecha</th><th>Lotería</th><th>Resultado</th></tr>${rows
          .map(
            r =>
              `<tr><td>${escapeHtml(r.date)}</td><td>${escapeHtml(r.lottery)}</td><td>${r.numbers
                .map(n => `<span class="num">${escapeHtml(n)}</span>`)
                .join("")}</td></tr>`
          )
          .join("")}</table>`
      : '<div class="empty">Sin registros.</div>';
}

function toggleHistory() {
  const section = document.querySelector(".history-section");
  section.classList.toggle("visible");
}

function toggleSettings() {
  const section = document.querySelector(".settings-section");
  section.classList.toggle("visible");
}

// ============================================
// BOOTSTRAP
// ============================================

// Delegación de eventos para el selector de loterías: reemplaza el onclick
// dinámico que antes se armaba concatenando el nombre de la lotería (ver
// nota de bug en renderLotterySelector).
document.getElementById("lottery-selector")?.addEventListener("click", (e) => {
  const option = e.target.closest(".lottery-option[data-lottery]");
  if (!option) return;
  toggleLottery(option.dataset.lottery);
});

// Delegación para el botón "×" de cada chip de lotería seleccionada.
document.getElementById("lottery-chips")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-lottery]");
  if (!btn) return;
  toggleLottery(btn.dataset.removeLottery);
});

document.addEventListener("DOMContentLoaded", initializeData);
