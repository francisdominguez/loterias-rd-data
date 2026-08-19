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
// MEJORAS V5 (patrones más finos, sobre la V4)
// 1) Números repetidores: gap promedio entre apariciones de un número,
//    calculado sobre TODO el histórico de la lotería (no solo la fecha).
// 2) Espejos que se siguen: mide cuántas veces el espejo de un número
//    aparece en el sorteo INMEDIATAMENTE siguiente (todo el histórico).
// 3) Decenas: frecuencia agrupada en bloques 00-09, 10-19, ..., 90-99.
// 4) Comportamiento alrededor de la fecha: ventana ±3 días (ej. 15 a 21 de
//    agosto para el 18), combinando todos los años, además de la fecha exacta.
// 5) Número y palé arrastrado: comparación año por año (nunca mezclando
//    años distintos) entre el día anterior y la fecha analizada.
// 6) Matriz de números 00-99 con indicador de color según el puntaje final.
// 7) Puntaje mejorado y 100% transparente: 20% frecuencia + 20% años +
//    20% tendencia reciente + 15% ventana de fechas + 15% palés +
//    10% espejo/terminación (reemplaza la fórmula 40/25/35 de la V4).
// 8) "Ver por qué": cada número del ranking tiene un desplegable que explica,
//    en texto plano, cómo se armó su puntaje (nunca es una caja negra).
// Siguiente paso pendiente (no incluido en esta versión): backtesting —
// re-generar el ranking usando solo información disponible ANTES de cada
// sorteo histórico y medir qué tan bien (o mal) habría acertado, para saber
// si el método aporta algo real o si es equivalente a elegir al azar.
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

// Loterías cuya fila, en la pestaña "Próxima", está actualmente mostrando
// el formulario de captura (en vez de los números ya guardados) porque el
// usuario pulsó "Editar". Vive solo en memoria: se reinicia al recargar.
let upcomingEditing = new Set();

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
  buildUpcomingSummary();
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
  populateSimLotterySelect();
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
  const totalBadge = document.getElementById("total-records-badge");
  if (totalBadge) totalBadge.textContent = data.length;
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

// Nombres de días de la semana (índice = getUTCDay(): 0 = domingo).
const WEEKDAY_NAMES_ES = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Umbrales mínimos para animarse a decir "esta lotería no sortea tal día".
// Con muy pocos sorteos o un rango de fechas muy corto, la ausencia de un
// día de la semana en el histórico probablemente sea falta de datos
// cargados, no un patrón real de la lotería.
const MIN_SAMPLE_FOR_SCHEDULE_INFERENCE = 10;
const MIN_SPAN_DAYS_FOR_SCHEDULE_INFERENCE = 20;

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

// ============================================
// UTILIDADES DE DESPLAZAMIENTO DE FECHA (V5)
// Generaliza getPreviousCalendarDay para moverse N días calendario hacia
// adelante o atrás (aproximando febrero a 28 días, igual que en V4). Se usa
// para la "ventana alrededor de la fecha" (ej: 15 a 21 de agosto) y para el
// número/palé arrastrado (día anterior exacto).
// ============================================
function getNextCalendarDay(month, day) {
  if (day < DAYS_IN_MONTH[month - 1]) return { m: month, d: day + 1 };
  const nextMonth = month === 12 ? 1 : month + 1;
  return { m: nextMonth, d: 1 };
}

function shiftCalendarDay(month, day, offset) {
  let m = month, d = day;
  const steps = Math.abs(offset);
  for (let i = 0; i < steps; i++) {
    const next = offset > 0 ? getNextCalendarDay(m, d) : getPreviousCalendarDay(m, d);
    m = next.m; d = next.d;
  }
  return { m, d };
}

// ============================================
// V5 · NÚMEROS REPETIDORES
// Sobre TODO el histórico de la lotería (no solo la fecha filtrada, porque
// "repetidor" es un comportamiento de la lotería en general): mide, para
// cada número, cuántos sorteos pasan entre una aparición y la siguiente.
// ============================================
function computeGapStats(lottery) {
  const rowsAll = [...data].filter(r => r.lottery === lottery).sort((a, b) => a.date.localeCompare(b.date));
  const lastIndexSeen = {};
  const gaps = {};
  rowsAll.forEach((r, idx) => {
    const ns = [...new Set(r.numbers)];
    ns.forEach(n => {
      if (lastIndexSeen[n] !== undefined) {
        gaps[n] = gaps[n] || [];
        gaps[n].push(idx - lastIndexSeen[n]);
      }
      lastIndexSeen[n] = idx;
    });
  });
  return gaps;
}

function buildRepeatersSection(topRanked, gapStats) {
  const rowsHtml = topRanked.map(x => {
    const g = gapStats[x.n] || [];
    if (g.length === 0) {
      return `<tr><td><span class="num">${x.n}</span></td><td colspan="2" class="small muted">Solo apareció una vez en todo el histórico de esta lotería: no hay repeticiones que medir.</td></tr>`;
    }
    const avgGap = (g.reduce((a, b) => a + b, 0) / g.length).toFixed(1);
    const withinFew = g.filter(v => v <= 3).length;
    const rate = Math.round((withinFew / g.length) * 100);
    return `
      <tr>
        <td><span class="num">${x.n}</span></td>
        <td>Repite en promedio cada <strong>${avgGap}</strong> sorteos</td>
        <td class="small">${rate}% de sus repeticiones ocurrieron dentro de los 3 sorteos siguientes</td>
      </tr>
    `;
  }).join("");
  return `<table><tr><th>Número</th><th>Gap promedio entre apariciones</th><th>Repetición cercana</th></tr>${rowsHtml}</table>
    <div class="hint">Calculado sobre TODO el histórico de esta lotería (no solo esta fecha), contando sorteos de distancia entre una aparición y la siguiente.</div>`;
}

// ============================================
// V5 · ESPEJOS QUE SE SIGUEN
// Sobre todo el histórico de la lotería: cada vez que un número sale, mira
// si su espejo aparece en el SORTEO INMEDIATAMENTE SIGUIENTE.
// ============================================
function computeMirrorFollowStats(lottery) {
  const rowsAll = [...data].filter(r => r.lottery === lottery).sort((a, b) => a.date.localeCompare(b.date));
  const followCount = {}, totalCount = {};
  for (let i = 0; i < rowsAll.length - 1; i++) {
    const cur = [...new Set(rowsAll[i].numbers)];
    const next = new Set(rowsAll[i + 1].numbers);
    cur.forEach(n => {
      totalCount[n] = (totalCount[n] || 0) + 1;
      const mirror = mirrorOf(n);
      if (mirror !== n && next.has(mirror)) followCount[n] = (followCount[n] || 0) + 1;
    });
  }
  return { followCount, totalCount };
}

function buildMirrorFollowSection(topRanked, mirrorFollowStats) {
  const rowsHtml = topRanked.map(x => {
    const mirror = mirrorOf(x.n);
    if (mirror === x.n) {
      return `<tr><td><span class="num">${x.n}</span></td><td colspan="2" class="small muted">Es capicúa, no tiene espejo distinto.</td></tr>`;
    }
    const total = mirrorFollowStats.totalCount[x.n] || 0;
    const follows = mirrorFollowStats.followCount[x.n] || 0;
    const rate = total > 0 ? Math.round((follows / total) * 100) : 0;
    return `
      <tr>
        <td><span class="num">${x.n}</span> → <span class="num">${mirror}</span></td>
        <td><strong>${follows}</strong> de ${total} veces</td>
        <td class="small">${rate}% de las veces que salió ${x.n}, su espejo ${mirror} salió en el sorteo siguiente</td>
      </tr>
    `;
  }).join("");
  return `<table><tr><th>Número → Espejo</th><th>Veces que lo siguió</th><th>Tasa</th></tr>${rowsHtml}</table>
    <div class="hint">Calculado sobre todo el histórico de la lotería, sorteo por sorteo en orden cronológico.</div>`;
}

// ============================================
// V5 · DECENAS
// Agrupa los números 00-99 en 10 decenas y suma la frecuencia de la fecha
// analizada dentro de cada una.
// ============================================
function buildDecadeSection(freq) {
  const decades = Array.from({ length: 10 }, (_, i) => ({ label: `${i}0–${i}9`, count: 0 }));
  Object.entries(freq).forEach(([n, c]) => {
    const decadeIdx = Math.floor(Number(n) / 10);
    decades[decadeIdx].count += c;
  });
  const max = Math.max(...decades.map(x => x.count), 1);
  return `
    <table>
      <tr><th>Decena</th><th>Frecuencia total</th><th></th></tr>
      ${decades.map(x => `
        <tr>
          <td><strong>${x.label}</strong></td>
          <td>${x.count}</td>
          <td><div class="progress-bar"><div class="progress-fill bar-normal" style="width:${Math.max(6, (x.count / max) * 100)}%">${x.count}</div></div></td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ============================================
// V5 · COMPORTAMIENTO ALREDEDOR DE LA FECHA
// En vez de mirar solo el 18 de agosto, mira una ventana (por defecto ±3
// días: 15 a 21 de agosto) a través de todos los años, y muestra qué
// números tienen más presencia combinada en esos días cercanos.
// ============================================
// sourceRows: dataset sobre el que se calcula (por defecto, todo `data`).
// El Simulador de Jugadas (V8) le pasa un subconjunto ya recortado a "solo
// datos anteriores a la fecha simulada", para que la ventana ±3 días del
// backtest tampoco se filtre con información del futuro.
function computeWindowStats(month, day, lottery, radius = 3, sourceRows = data) {
  const offsets = [];
  for (let off = -radius; off <= radius; off++) offsets.push(off);
  const combinedFreq = {};
  const perOffsetLabel = [];
  offsets.forEach(off => {
    const { m, d } = shiftCalendarDay(month, day, off);
    const matched = sourceRows.filter(r => {
      const { m: rm, d: rd } = splitDate(r.date);
      return rm === m && rd === d && r.lottery === lottery;
    });
    perOffsetLabel.push({ off, label: `${pad(d)}/${pad(m)}`, count: matched.length });
    matched.forEach(r => {
      [...new Set(r.numbers)].forEach(n => { combinedFreq[n] = (combinedFreq[n] || 0) + 1; });
    });
  });
  return { combinedFreq, perOffsetLabel };
}

function buildWindowSection(windowStats, exactFreq) {
  const entries = Object.entries(windowStats.combinedFreq)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);
  const rangeLabel = `${windowStats.perOffsetLabel[0].label} → ${windowStats.perOffsetLabel[windowStats.perOffsetLabel.length - 1].label}`;
  if (entries.length === 0) return '<div class="empty">Sin datos en la ventana de fechas cercanas.</div>';
  return `
    <div class="hint">Ventana analizada: ${rangeLabel} (todos los años combinados).</div>
    <table>
      <tr><th>Número</th><th>Frecuencia en la ventana</th><th>Frecuencia solo en la fecha exacta</th></tr>
      ${entries.map(([n, c]) => `
        <tr>
          <td><span class="num">${n}</span></td>
          <td><strong>${c}</strong></td>
          <td class="small">${exactFreq[n] || 0}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

// ============================================
// V5.1 · ¿ESTA LOTERÍA SORTEA TODOS LOS DÍAS?
// Mira TODO el histórico cargado de la lotería (sin filtrar por fecha) y
// junta qué días de la semana tienen al menos un registro. Si, con muestra
// suficiente, algún día de la semana nunca aparece, es razonable asumir que
// esa lotería no sortea ese día — así "0 resultados en la fecha exacta" dej
// de sentirse como un error de carga cuando en realidad es un día sin
// sorteo. Requiere un mínimo de sorteos Y de rango de fechas para no sacar
// conclusiones de un histórico todavía muy chico.
// ============================================
function computeDrawDaysOfWeek(lottery) {
  const rowsAll = data.filter(r => r.lottery === lottery);
  if (rowsAll.length === 0) return null;

  const present = new Set();
  let minDate = rowsAll[0].date, maxDate = rowsAll[0].date;
  rowsAll.forEach(r => {
    const { y, m, d } = splitDate(r.date);
    present.add(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
    if (r.date < minDate) minDate = r.date;
    if (r.date > maxDate) maxDate = r.date;
  });

  const spanDays = Math.round(
    (new Date(maxDate + "T00:00:00Z") - new Date(minDate + "T00:00:00Z")) / 86400000
  );

  return { present, sampleSize: rowsAll.length, spanDays };
}

// Devuelve el HTML del aviso (o "" si sortea todos los días, o si todavía
// no hay muestra suficiente para afirmarlo con confianza).
function buildNonDailyScheduleNotice(lottery) {
  const stats = computeDrawDaysOfWeek(lottery);
  if (!stats || stats.present.size >= 7) return "";
  if (
    stats.sampleSize < MIN_SAMPLE_FOR_SCHEDULE_INFERENCE ||
    stats.spanDays < MIN_SPAN_DAYS_FOR_SCHEDULE_INFERENCE
  ) {
    return "";
  }

  const allDows = [0, 1, 2, 3, 4, 5, 6];
  const drawDays = allDows.filter(dow => stats.present.has(dow)).map(dow => WEEKDAY_NAMES_ES[dow]);
  const skipDays = allDows.filter(dow => !stats.present.has(dow)).map(dow => WEEKDAY_NAMES_ES[dow]);

  return `
    <div class="warning">
      ℹ️ Según tu histórico cargado (${stats.sampleSize} sorteos en un rango de ${stats.spanDays} días), <strong>${escapeHtml(lottery)}</strong> nunca tiene registros los <strong>${skipDays.join(" ni los ")}</strong>. Sortea normalmente ${drawDays.join(", ")}. Si la fecha que estás buscando cae justo en un día sin sorteo, 0 resultados en la fecha exacta es esperable — no un fallo de carga de datos.
    </div>
  `;
}

// ============================================
// V5 · NÚMERO Y PALÉ ARRASTRADO
// Compara, año por año, el sorteo del día anterior con el de la fecha
// analizada: si un número (o un palé) salió en ambos DENTRO DEL MISMO AÑO,
// se cuenta como "arrastrado".
// ============================================
function computeDragStats(month, day, lottery) {
  const prev = getPreviousCalendarDay(month, day);
  const curRows = data.filter(r => { const { m, d: dd } = splitDate(r.date); return m === month && dd === day && r.lottery === lottery; });
  const prevRows = data.filter(r => { const { m, d: dd } = splitDate(r.date); return m === prev.m && dd === prev.d && r.lottery === lottery; });

  const curByYear = {}, prevByYear = {};
  curRows.forEach(r => { curByYear[r.date.substring(0, 4)] = [...new Set(r.numbers)]; });
  prevRows.forEach(r => { prevByYear[r.date.substring(0, 4)] = [...new Set(r.numbers)]; });

  const draggedNumbers = {};
  const draggedPairs = {};
  let yearsWithBoth = 0;

  Object.keys(curByYear).forEach(yr => {
    if (!prevByYear[yr]) return;
    yearsWithBoth++;
    const curSet = new Set(curByYear[yr]);
    const prevSet = new Set(prevByYear[yr]);

    curByYear[yr].forEach(n => {
      if (prevSet.has(n)) draggedNumbers[n] = (draggedNumbers[n] || 0) + 1;
    });

    const curPairs = new Set();
    for (let i = 0; i < curByYear[yr].length; i++)
      for (let j = i + 1; j < curByYear[yr].length; j++)
        curPairs.add([curByYear[yr][i], curByYear[yr][j]].sort().join("–"));

    const prevPairs = new Set();
    for (let i = 0; i < prevByYear[yr].length; i++)
      for (let j = i + 1; j < prevByYear[yr].length; j++)
        prevPairs.add([prevByYear[yr][i], prevByYear[yr][j]].sort().join("–"));

    curPairs.forEach(p => { if (prevPairs.has(p)) draggedPairs[p] = (draggedPairs[p] || 0) + 1; });
  });

  return { draggedNumbers, draggedPairs, yearsWithBoth, prev };
}

function buildDragSection(dragStats) {
  if (dragStats.yearsWithBoth === 0) {
    return `<div class="empty">No hay años con datos tanto del ${pad(dragStats.prev.d)}/${pad(dragStats.prev.m)} como de la fecha analizada para esta lotería.</div>`;
  }
  const numberEntries = Object.entries(dragStats.draggedNumbers).sort((a, b) => b[1] - a[1]);
  const pairEntries = Object.entries(dragStats.draggedPairs).sort((a, b) => b[1] - a[1]);

  const numbersHtml = numberEntries.length
    ? `<table><tr><th>Número</th><th>Años arrastrado</th></tr>${numberEntries.map(([n, c]) => `<tr><td><span class="num">${n}</span></td><td><strong>${c}</strong> de ${dragStats.yearsWithBoth} año${dragStats.yearsWithBoth === 1 ? "" : "s"}</td></tr>`).join("")}</table>`
    : '<div class="empty">Ningún número se repitió del día anterior al analizado en el mismo año.</div>';

  const pairsHtml = pairEntries.length
    ? `<table><tr><th>Palé</th><th>Años arrastrado</th></tr>${pairEntries.map(([p, c]) => `<tr><td><span class="num">${p}</span></td><td><strong>${c}</strong> de ${dragStats.yearsWithBoth} año${dragStats.yearsWithBoth === 1 ? "" : "s"}</td></tr>`).join("")}</table>`
    : '<div class="empty">Ningún palé se repitió del día anterior al analizado en el mismo año.</div>';

  return `
    <div class="lottery-result-sub">🔥 Número arrastrado (salió el ${pad(dragStats.prev.d)}/${pad(dragStats.prev.m)} y de nuevo en la fecha analizada, mismo año)</div>
    ${numbersHtml}
    <div class="lottery-result-sub">🎯 Palé arrastrado</div>
    ${pairsHtml}
    <div class="hint">Se compara año por año (no se mezclan años distintos): solo cuenta cuando AMBAS fechas tienen datos en el mismo año.</div>
  `;
}

// ============================================
// V5 · MATRIZ DE NÚMEROS 00-99
// Grilla completa con un indicador de color por número, combinando el
// puntaje final (frecuencia + años + tendencia + ventana + palés + espejo)
// ya calculado en `ranked`. Los números sin datos en esta fecha se muestran
// como "sin datos", nunca como si tuvieran puntaje 0 por mala suerte.
// ============================================
function buildNumberMatrix(rankedFull) {
  const scoreByNumber = {};
  rankedFull.forEach(x => { scoreByNumber[x.n] = x.score; });
  const cells = Array.from({ length: 100 }, (_, i) => pad(i));
  return `
    <div style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:8px">
      ${cells.map(n => {
        const score = scoreByNumber[n];
        let cls = "";
        if (score === undefined) cls = "";
        else if (score >= 66) cls = "hot";
        else if (score >= 33) cls = "recommended";
        else cls = "cold";
        const title = score === undefined ? "Sin datos en esta fecha" : `Puntaje ${score.toFixed(0)}`;
        return `<span class="num ${cls}" style="text-align:center;margin:0;font-size:11px;padding:6px 2px" title="${title}">${n}</span>`;
      }).join("")}
    </div>
    <div class="hint">🔥 Puntaje alto · ✨ Puntaje medio · ❄️ Puntaje bajo o sin marcar · sin color = sin ninguna aparición en esta fecha/lotería. Pasa el mouse sobre un número para ver su puntaje exacto.</div>
  `;
}

// ============================================
// V5 · "EXPLICAR POR QUÉ ESTE NÚMERO ESTÁ ARRIBA"
// Convierte los componentes del puntaje de un número en una explicación en
// texto plano, para que el ranking deje de ser una caja negra.
// ============================================
function explainNumberScore(x, month, day, paleCount, terminationRank) {
  const bullets = [];
  bullets.push(`Apareció <strong>${x.c}</strong> ${x.c === 1 ? "vez" : "veces"} en los sorteos analizados para el ${pad(day)}/${pad(month)} (todos los años).`);
  bullets.push(`Presente en <strong>${x.years}</strong> año${x.years === 1 ? "" : "s"} distinto${x.years === 1 ? "" : "s"}: ${x.yearsList.join(", ")}.`);
  bullets.push(`Forma <strong>${paleCount}</strong> palé${paleCount === 1 ? "" : "s"} distinto${paleCount === 1 ? "" : "s"} en esta fecha.`);
  if (terminationRank) {
    bullets.push(`Su terminación (…${x.n.slice(-1)}) es ${terminationRank}.`);
  }
  bullets.push(`Componentes del puntaje (0-100 cada uno): frecuencia ${x.freqPct.toFixed(0)} · años ${x.yearsPct.toFixed(0)} · tendencia reciente ${x.weightedPct.toFixed(0)} · ventana de fechas ${x.windowPct.toFixed(0)} · palés ${x.paleScorePct.toFixed(0)} · espejo/terminación ${x.mirrorTermPct.toFixed(0)}.`);
  return `
    <details style="margin-top:4px">
      <summary style="cursor:pointer;color:#0f766e;font-weight:700;font-size:12px">🔬 Ver por qué el ${x.n} tiene puntaje ${x.score.toFixed(1)}</summary>
      <ul class="small" style="margin:6px 0 0 18px;padding:0">
        ${bullets.map(b => `<li style="margin-bottom:3px">${b}</li>`).join("")}
      </ul>
    </details>
  `;
}

// ============================================
// NÚCLEO DEL RANKING (extraído para poder reutilizarlo también en el
// Simulador de Jugadas / backtesting — V8).
// `rows` = sorteos de ESA lotería que ya caen en el día/mes buscado (todos
// los años combinados). `windowSourceRows` = dataset sobre el que se calcula
// la ventana ±3 días; en el análisis normal es todo `data`, pero en el
// backtest del simulador es solo lo anterior a la fecha simulada, para que
// el puntaje del backtest jamás use información posterior a esa fecha.
// Misma fórmula de siempre: 20% frecuencia + 20% años + 20% tendencia
// reciente + 15% ventana de fechas + 15% palés + 10% espejo/terminación.
// ============================================
function computeLotteryRanking(rows, lottery, m, d, windowSourceRows = data) {
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

  const windowStats = computeWindowStats(m, d, lottery, 3, windowSourceRows);
  const paleFreqPerNumber = {};
  Object.entries(pair).forEach(([key, count]) => {
    const [a, b] = key.split("–");
    paleFreqPerNumber[a] = (paleFreqPerNumber[a] || 0) + count;
    paleFreqPerNumber[b] = (paleFreqPerNumber[b] || 0) + count;
  });
  const paleCountPerNumber = {};
  Object.keys(pair).forEach(key => {
    const [a, b] = key.split("–");
    paleCountPerNumber[a] = (paleCountPerNumber[a] || 0) + 1;
    paleCountPerNumber[b] = (paleCountPerNumber[b] || 0) + 1;
  });
  const maxWindow = Math.max(...Object.values(windowStats.combinedFreq), 1);
  const maxPaleFreq = Math.max(...Object.values(paleFreqPerNumber), 1);
  const maxTermination = Math.max(...Object.values(terminationFreq), 1);

  const ranked = Object.entries(freq)
    .map(([n, c]) => {
      const years = Object.keys(yearFreq[n] || {}).length;
      const wFreq = weightedFreq[n] || 0;
      const freqPct = (c / maxFreq) * 100;
      const yearsPct = (years / maxYears) * 100;
      const weightedPct = (wFreq / maxWeighted) * 100;
      const windowPct = ((windowStats.combinedFreq[n] || 0) / maxWindow) * 100;
      const paleScorePct = ((paleFreqPerNumber[n] || 0) / maxPaleFreq) * 100;
      const mirror = mirrorOf(n);
      const mirrorPct = ((freq[mirror] || 0) / maxFreq) * 100;
      const termPct = ((terminationFreq[n.slice(-1)] || 0) / maxTermination) * 100;
      const mirrorTermPct = (mirrorPct + termPct) / 2;
      const score = freqPct * 0.20 + yearsPct * 0.20 + weightedPct * 0.20 + windowPct * 0.15 + paleScorePct * 0.15 + mirrorTermPct * 0.10;
      return {
        n, c, years, wFreq, freqPct, yearsPct, weightedPct, windowPct, paleScorePct, mirrorTermPct, score,
        yearsList: Object.keys(yearFreq[n] || {}).sort()
      };
    })
    .sort((a, b) => b.score - a.score || b.c - a.c || a.n.localeCompare(b.n));

  const pairs = Object.entries(pair)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return {
    freq, pair, yearFreq, weightedFreq, terminationFreq, windowStats,
    paleFreqPerNumber, paleCountPerNumber,
    maxFreq, maxWeighted, maxYears, maxWindow, maxPaleFreq, maxTermination,
    ranked, pairs
  };
}

// ============================================
// RESUMEN LIMPIO / "PRÓXIMA LOTERÍA" (pestaña dedicada)
// Una sola tabla, sin acordeones ni jerga: Hora · Lotería · Top 3 · Palé.
// Usa la fecha y hora REALES del dispositivo del usuario (no la fecha que
// esté puesta en la pestaña de Análisis) para marcar cuál sorteo es el
// siguiente en el reloj. Reutiliza computeLotteryRanking tal cual, así que
// el número que muestra es exactamente el mismo que en la pestaña de
// Análisis para esa lotería y fecha — nunca se recalcula distinto.
// ============================================
function parseScheduleTimeToMinutes(str) {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((str || "").trim());
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

// ---- Método A: frecuencia bruta simple sobre TODO el histórico de la
// lotería (sin ponderar por año ni filtrar por fecha exacta) ----
function computeRawTopNumber(lottery) {
  const rows = data.filter(r => r.lottery === lottery);
  if (rows.length === 0) return null;
  const freq = {};
  rows.forEach(r => [...new Set(r.numbers)].forEach(n => { freq[n] = (freq[n] || 0) + 1; }));
  const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return { n: top[0], c: top[1], total: rows.length };
}

// ---- Método B: número más "atrasado" (más sorteos consecutivos sin
// salir), sobre TODO el histórico ordenado cronológicamente ----
function computeMostOverdueNumber(lottery) {
  const rows = data.filter(r => r.lottery === lottery).sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length === 0) return null;
  const lastSeen = {};
  rows.forEach((r, idx) => [...new Set(r.numbers)].forEach(n => { lastSeen[n] = idx; }));
  let best = null;
  for (let i = 0; i < 100; i++) {
    const n = pad(i);
    const idx = lastSeen[n];
    const sorteosAtras = idx == null ? rows.length : (rows.length - 1 - idx);
    if (!best || sorteosAtras > best.sorteosAtras) best = { n, sorteosAtras };
  }
  return best;
}

// Fecha de HOY (reloj del dispositivo) como string 'YYYY-MM-DD', en el mismo
// formato que usa todo el histórico. Se usa exclusivamente para guardar los
// resultados que el usuario va registrando en la pestaña "Próxima" a medida
// que se publican — nunca para comparar/ordenar fechas de sorteos pasados.
function todayDateStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Cuántos números trae normalmente cada lotería (3 en la mayoría, 5 en Mega
// Chance, etc.), inferido del histórico ya cargado: se usa para saber
// cuántas casillas mostrar en el formulario de captura de resultados. Si la
// lotería es nueva y no hay ningún sorteo previo, se asume 3 por defecto.
function getTypicalNumberCount(lottery) {
  const rows = data.filter(r => r.lottery === lottery);
  if (rows.length === 0) return 3;
  const counts = {};
  rows.forEach(r => { counts[r.numbers.length] = (counts[r.numbers.length] || 0) + 1; });
  let best = 3, bestCount = -1;
  Object.entries(counts).forEach(([len, c]) => {
    if (c > bestCount) { bestCount = c; best = Number(len); }
  });
  return best;
}

// Guarda (o reemplaza, si ya existía) el resultado de HOY para una lotería.
// Se usa desde el formulario de captura de la pestaña "Próxima". Reutiliza
// save() para persistir en localStorage y refrescar Datos/Análisis, igual
// que cualquier otra fuente de datos (CSV, remoto, seed).
function saveTodayResult(lottery, numbers) {
  const dateStr = todayDateStr();
  data = data.filter(r => !(r.date === dateStr && r.lottery === lottery));
  data.push({ date: dateStr, lottery, numbers });
  dataSource = "local";
  upcomingEditing.delete(lottery);
  updateDataSourceBadge();
  save();
  buildUpcomingSummary();
  showSyncBanner("success", `✓ Resultado de hoy guardado para ${lottery}: ${numbers.join(" - ")}`);
}

// Delegación de eventos del formulario/botones de captura de resultados en
// la pestaña "Próxima" (ver listeners al final del archivo, junto a los
// demás data-* de delegación).
function handleUpcomingResultsClick(e) {
  const editBtn = e.target.closest("[data-edit-result]");
  if (editBtn) {
    upcomingEditing.add(editBtn.dataset.editResult);
    buildUpcomingSummary();
    return;
  }
  const cancelBtn = e.target.closest("[data-cancel-result]");
  if (cancelBtn) {
    upcomingEditing.delete(cancelBtn.dataset.cancelResult);
    buildUpcomingSummary();
    return;
  }
}

// Si el usuario copia el resultado completo de la página de la lotería
// (ej. "34 71 66", "34-71-66" o "347166") y lo pega en la primera casilla,
// lo reparte automáticamente en esa y las siguientes casillas del mismo
// formulario, en vez de pegar todo el texto en una sola. Un pegado normal
// de 1-2 dígitos se deja pasar tal cual.
function handleUpcomingResultsPaste(e) {
  const input = e.target.closest(".result-num-input");
  if (!input) return;
  const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
  const digitsOnly = text.replace(/\D/g, "");
  if (digitsOnly.length <= 2) return;

  e.preventDefault();
  const form = input.closest("form");
  const inputs = [...form.querySelectorAll(".result-num-input")];
  const startIdx = inputs.indexOf(input);
  const groups = digitsOnly.match(/\d{1,2}/g) || [];
  groups.forEach((g, i) => {
    const target = inputs[startIdx + i];
    if (target) target.value = g.padStart(2, "0");
  });
}

function handleUpcomingResultsSubmit(e) {
  const form = e.target.closest("[data-result-lottery]");
  if (!form) return;
  e.preventDefault();

  const lottery = form.dataset.resultLottery;
  const errorEl = form.querySelector(".today-result-error");
  const inputs = [...form.querySelectorAll(".result-num-input")];

  const numbers = [];
  let invalid = false;
  inputs.forEach(inp => {
    const cleaned = inp.value.replace(/\D/g, "");
    if (cleaned.length === 0 || cleaned.length > 2) {
      invalid = true;
      return;
    }
    numbers.push(pad(parseInt(cleaned, 10)));
  });

  if (invalid || numbers.length === 0) {
    if (errorEl) {
      errorEl.textContent = "Revisa los números: cada casilla necesita 1 o 2 dígitos (00-99).";
      errorEl.style.display = "block";
    }
    return;
  }

  saveTodayResult(lottery, numbers);
}

// Convierte una diferencia en minutos (>= 0) a un texto corto tipo "en 42
// min" o "en 1 h 15 min". Se usa solo para la cuenta regresiva del bloque
// destacado de la próxima lotería.
function formatCountdown(diffMinutes) {
  if (diffMinutes <= 0) return "¡Es ahora!";
  if (diffMinutes < 60) return `En ${diffMinutes} min`;
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  return m === 0 ? `En ${h} h` : `En ${h} h ${m} min`;
}

function buildUpcomingSummary() {
  const container = document.getElementById("upcoming-results");
  if (!container) return;

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const todayStr = todayDateStr();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const universe = allLotteries.length ? allLotteries : Object.keys(lotterySchedule);
  if (universe.length === 0) {
    container.innerHTML = '<div class="empty">Aún no hay loterías cargadas.</div>';
    return;
  }

  const rows = universe.map(lottery => {
    const timeStr = getScheduleFor(lottery);
    const rowsForDate = data.filter(r => {
      const { m, d } = splitDate(r.date);
      return m === month && d === day && r.lottery === lottery;
    });
    let top3 = [], paleTop = null;
    if (rowsForDate.length) {
      const rk = computeLotteryRanking(rowsForDate, lottery, month, day, data);
      top3 = rk.ranked.slice(0, 3).map(x => x.n);
      paleTop = rk.pairs.length ? rk.pairs[0][0] : null;
    }
    const raw = computeRawTopNumber(lottery);
    const overdue = computeMostOverdueNumber(lottery);
    const todayRecord = data.find(r => r.date === todayStr && r.lottery === lottery) || null;
    return { lottery, timeStr, minutes: parseScheduleTimeToMinutes(timeStr), top3, paleTop, raw, overdue, todayRecord };
  });

  rows.sort((a, b) => {
    if (a.minutes == null && b.minutes == null) return a.lottery.localeCompare(b.lottery);
    if (a.minutes == null) return 1;
    if (b.minutes == null) return -1;
    return a.minutes - b.minutes;
  });

  // nextIsTomorrow: si NINGÚN sorteo de hoy queda pendiente, el primer
  // findIndex (con hora >= ahora) no encuentra nada y caemos al primer
  // sorteo con horario configurado del día siguiente. Se distingue de un
  // "próximo" real de hoy para no mostrar una cuenta regresiva de minutos
  // sin sentido (o negativa) en el bloque destacado.
  let nextIdx = rows.findIndex(r => r.minutes != null && r.minutes >= nowMinutes);
  let nextIsTomorrow = false;
  if (nextIdx === -1) {
    nextIdx = rows.findIndex(r => r.minutes != null);
    nextIsTomorrow = true;
  }

  const nowLabel = now.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit" });

  // ---- Bloque destacado "Próximo sorteo" ----
  // Antes, la única marca visual de "próxima lotería" era un fondo apenas
  // más claro (#f0fdfa vs #fff) dentro de una grilla de 2 columnas, y esa
  // tarjeta podía caer en cualquier posición de la grilla (ordenada por
  // hora, no por relevancia), mezclada entre sorteos de hoy que ya pasaron.
  // Fácil de pasar por alto. Este bloque separado, arriba de la lista,
  // resuelve eso: siempre es lo primero que se ve, con cuenta regresiva.
  let heroHtml = "";
  if (nextIdx !== -1) {
    const nextRow = rows[nextIdx];
    const countdownLabel = nextIsTomorrow
      ? `Mañana · ${escapeHtml(nextRow.timeStr)}`
      : formatCountdown(nextRow.minutes - nowMinutes);

    const pickGroups = [];
    if (nextRow.top3.length) {
      pickGroups.push(`
        <div class="next-hero-pick-group">
          <span class="next-hero-tag">Top</span>
          ${nextRow.top3.map(n => `<span class="num recommended">${n}</span>`).join("")}
        </div>
      `);
    }
    if (nextRow.paleTop) {
      pickGroups.push(`
        <div class="next-hero-pick-group">
          <span class="next-hero-tag">Palé</span>
          <span class="num">${nextRow.paleTop}</span>
        </div>
      `);
    }

    const picksHtml = pickGroups.length
      ? `<div class="next-hero-picks">${pickGroups.join("")}</div>`
      : `<div class="next-hero-empty">Sin patrón para el ${pad(day)}/${pad(month)} todavía — mira la pestaña Análisis para el histórico completo de esta lotería.</div>`;

    const alreadyLoggedHtml = nextRow.todayRecord
      ? `<div class="next-hero-empty">✓ Ya registraste el resultado de hoy para esta lotería.</div>`
      : "";

    heroHtml = `
      <div class="next-hero">
        <div class="next-hero-top">
          <span class="next-hero-eyebrow"><span class="next-pulse-dot" aria-hidden="true"></span>Próximo sorteo</span>
          <span class="next-hero-countdown">${escapeHtml(countdownLabel)}</span>
        </div>
        <div class="next-hero-main">
          <span class="next-hero-name">${escapeHtml(nextRow.lottery)}</span>
          <span class="next-hero-time">🕒 ${nextRow.timeStr ? escapeHtml(nextRow.timeStr) : "Hora no configurada"}</span>
        </div>
        ${picksHtml}
        ${alreadyLoggedHtml}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="hint" style="margin-bottom:8px">🕐 Hora de tu dispositivo: <b>${escapeHtml(nowLabel)}</b> · fecha usada: ${pad(day)}/${pad(month)}</div>
    ${heroHtml}
    <div class="up-list">
      ${rows.map((r, i) => {
        const isNext = i === nextIdx;
        const top3Html = r.top3.length
          ? r.top3.map(n => `<span class="num num-sm${isNext ? " recommended" : ""}">${n}</span>`).join("")
          : '<span class="small muted">Sin sorteo exacto hoy</span>';
        const paleHtml = r.paleTop ? `<span class="num num-sm">${r.paleTop}</span>` : '<span class="small muted">—</span>';
        const rawHtml = r.raw ? `<span class="num num-sm">${r.raw.n}</span> <span class="small muted">(${r.raw.c}/${r.raw.total})</span>` : '<span class="small muted">—</span>';
        const overdueHtml = r.overdue ? `<span class="num num-sm cold">${r.overdue.n}</span> <span class="small muted">(${r.overdue.sorteosAtras} sorteos)</span>` : '<span class="small muted">—</span>';
        const resultHtml = buildTodayResultCell(r.lottery, r.todayRecord);
        return `
          <div class="up-card${isNext ? " next" : ""}">
            <div class="up-head">
              <span class="up-name">${escapeHtml(r.lottery)}${isNext ? ' <span class="up-next-flag">▶ Próxima</span>' : ""}</span>
              <span class="up-time">${r.timeStr ? escapeHtml(r.timeStr) : "—"}</span>
            </div>
            <div class="up-row-line"><span class="up-tag">Top 3</span>${top3Html}</div>
            <div class="up-row-line"><span class="up-tag">Palé</span>${paleHtml}</div>
            <details class="up-more">
              <summary>Más frecuente / atrasado</summary>
              <div class="up-more-body">
                <div class="up-row-line"><span class="up-tag">Frecuente</span>${rawHtml}</div>
                <div class="up-row-line"><span class="up-tag">Atrasado</span>${overdueHtml}</div>
              </div>
            </details>
            <div class="up-result">${resultHtml}</div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="hint" style="margin-top:8px">"Top 3/Palé" = puntaje ponderado del ${pad(day)}/${pad(month)} a través de los años. "Frecuente/Atrasado" = todo el historial, sin filtrar por fecha. Frecuencia pasada, no predicción.</div>
  `;
}

// Arma la celda "Resultado de hoy" para una lotería: si ya se registró el
// resultado de la fecha de hoy, muestra los números guardados con un botón
// para editarlos; si no, muestra el formulario de captura (con tantas
// casillas como números suele traer esa lotería). El modo edición se
// controla con el Set en memoria `upcomingEditing`.
function buildTodayResultCell(lottery, todayRecord) {
  const isEditing = upcomingEditing.has(lottery);
  const checkLink = `<a href="https://loteriasdominicanas.com/" target="_blank" rel="noopener" class="up-check-link">🔗 Ver resultado</a>`;

  if (todayRecord && !isEditing) {
    return `
      <div class="today-result-display">
        ${todayRecord.numbers.map(n => `<span class="num">${escapeHtml(n)}</span>`).join("")}
        <button type="button" class="secondary small-btn" data-edit-result="${escapeHtml(lottery)}">✏️ Editar</button>
        ${checkLink}
      </div>
    `;
  }

  const count = todayRecord ? todayRecord.numbers.length : getTypicalNumberCount(lottery);
  const existing = todayRecord ? todayRecord.numbers : [];

  return `
    <form class="today-result-form" data-result-lottery="${escapeHtml(lottery)}">
      <div class="today-result-inputs">
        ${Array.from({ length: count }).map((_, i) => `<input type="text" inputmode="numeric" maxlength="2" class="result-num-input" placeholder="00" value="${escapeHtml(existing[i] || "")}">`).join("")}
      </div>
      <div class="today-result-actions">
        <button type="submit" class="small-btn">💾 Guardar</button>
        ${todayRecord ? `<button type="button" class="secondary small-btn" data-cancel-result="${escapeHtml(lottery)}">Cancelar</button>` : ""}
        ${checkLink}
      </div>
      <div class="today-result-error small error" style="display:none"></div>
    </form>
  `;
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
    // BUG corregido: antes esta sección se cortaba acá con solo un mensaje
    // vacío. Ahora, en vez de dejar al usuario sin nada, se muestra (1) un
    // aviso si la lotería simplemente no sortea todos los días —para que 0
    // resultados en la fecha exacta no se sienta como un error de carga— y
    // (2) un resumen de la ventana ±3 días, que sí suele tener datos aunque
    // la fecha exacta no los tenga.
    html += buildNonDailyScheduleNotice(lottery);
    html += `<div class="empty">No hay sorteos para esta lotería exactamente el ${pad(d)}/${pad(m)}, en ningún año del histórico cargado.</div>`;

    const windowStats = computeWindowStats(m, d, lottery, 3);
    const hasWindowData = Object.keys(windowStats.combinedFreq).length > 0;
    if (hasWindowData) {
      html += `<div class="lottery-result-sub">🗓️ Como la fecha exacta no tiene datos, se muestra en su lugar la ventana ±3 días alrededor del ${pad(d)}/${pad(m)}</div>`;
      html += buildWindowSection(windowStats, {});
    }

    html += "</section>";
    return { html, rowCount: 0, years: [] };
  }

  if (years.length <= 1) {
    html += `<div class="hint">Ya se están comparando TODOS los años de tu histórico para este día/mes — es que solo tienes ${years.length} año cargado para esta lotería en esa fecha. Importa más historial (CSV) o actualiza los datos remotos para comparar más años.</div>`;
  }

  const rk = computeLotteryRanking(rows, lottery, m, d, data);
  const { freq, pair, terminationFreq, windowStats, paleCountPerNumber, maxFreq, maxTermination, ranked, pairs } = rk;

  const allPossibleNumbers = Array.from({length: 100}, (_, i) => pad(i));
  const hotNumbers = new Set(ranked.map(x => x.n));
  const coldNumbers = allPossibleNumbers.filter(n => !hotNumbers.has(n));

  // Ranking con barras de progreso CSS: los 5 más calientes resaltan en rojo/naranja
  const topRanked = ranked.slice(0, top);
  const topNumberSet = new Set(topRanked.map(x => x.n));

  html += '<div class="lottery-result-sub">🔥 Ranking estadístico (puntaje: 20% frecuencia + 20% años + 20% tendencia reciente + 15% ventana de fechas + 15% palés + 10% espejo/terminación)</div>';
  html += `
    <table>
      <tr><th>#</th><th>Número</th><th>Frecuencia</th><th>Años</th><th>Puntaje</th></tr>
      ${topRanked.map((x, i) => {
        const stars = generateStars(x.score, 100);
        const ranking_class = i < 3 ? "hot" : i < 8 ? "recommended" : "";
        const barClass = i < 5 ? "bar-hot" : "bar-normal";
        const widthPct = Math.max(6, (x.c / maxFreq) * 100);
        const termFreq = terminationFreq[x.n.slice(-1)] || 0;
        const termLabel = termFreq >= maxTermination ? "la terminación más frecuente en esta fecha" : termFreq >= maxTermination * 0.6 ? "una terminación bastante frecuente en esta fecha" : "una terminación poco frecuente en esta fecha";
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
            <td>
              <span class="stars">${stars}</span> <span class="small muted">${x.score.toFixed(1)}</span>
              ${explainNumberScore(x, m, d, paleCountPerNumber[x.n] || 0, termLabel)}
            </td>
          </tr>
        `;
      }).join("")}
    </table>
  `;

  // ---- Resumen dinámico: lo más accionable, en una frase, antes de bajar a detalle ----
  const top3 = topRanked.slice(0, 3).map(x => x.n);
  if (top3.length) {
    html += `<div class="good small">📌 En resumen para <b>${escapeHtml(lottery)}</b>: los números con mejor puntaje son ${top3.map(n => `<b>${n}</b>`).join(", ")}. Abre los paneles de abajo para ver el detalle completo (repetidores, espejos, decenas, rachas, comparaciones y más).</div>`;
  }

  // ---- Palés frecuentes (visible por defecto) ----
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

  // ---- Recomendaciones inteligentes (visible por defecto) ----
  html += '<div class="lottery-result-sub">💡 Recomendaciones inteligentes</div>';
  html += renderIntelligentRecommendations(ranked, coldNumbers.slice(0, 5), m, d, lotteryFilter);

  // ---- Panel de confianza (visible por defecto) ----
  html += buildConfidencePanel(rows.length, years.length);

  // ---- Paneles secundarios: agrupados en acordeones colapsables ----
  html += '<div class="lottery-result-sub">📂 Más análisis y patrones</div>';
  html += '<div class="hint" style="margin-bottom:8px">Todo lo de arriba ya resume lo más accionable. Estos paneles amplían el detalle estadístico número por número — ábrelos solo si quieres profundizar.</div>';

  html += wrapAcc("🎯 Palés destacados estadísticamente (candidatos)", buildPaleCandidatesSection(topRanked.slice(0, 8), pair));
  html += wrapAcc("📅 Comparación con el día anterior", buildDateComparisonSection(m, d, lottery, ranked, pairs));
  html += wrapAcc("🔄 Números repetidores", buildRepeatersSection(topRanked.slice(0, 10), computeGapStats(lottery)));
  html += wrapAcc("↔️ Espejos que se siguen", buildMirrorFollowSection(topRanked.slice(0, 8), computeMirrorFollowStats(lottery)));
  html += wrapAcc("🪞 Números espejo", buildMirrorSection(topRanked.slice(0, 8), freq));
  html += wrapAcc("🔢 Decenas", buildDecadeSection(freq));
  html += wrapAcc("#️⃣ Terminaciones", buildTerminationSection(terminationFreq, rows.length));
  html += wrapAcc("📅 Comportamiento alrededor de la fecha", buildWindowSection(windowStats, freq));
  html += wrapAcc("🔥 Arrastre (día anterior → fecha analizada)", buildDragSection(computeDragStats(m, d, lottery)));
  html += wrapAcc("🔁 Repetición entre años", buildRepetitionSection(topRanked.slice(0, 10), years.length));
  html += wrapAcc("📉 Rachas por número", buildStreakSection(topRanked.slice(0, 10), years));
  html += wrapAcc("📊 Matriz de números 00–99", buildNumberMatrix(ranked));

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
// V8 · SIMULADOR DE JUGADAS (BACKTESTING)
// Dado una lotería y una fecha objetivo, genera el ranking y los palés
// candidatos usando EXCLUSIVAMENTE sorteos anteriores a esa fecha (nunca la
// fecha objetivo ni nada posterior) — igual que si se hubiera calculado el
// día antes del sorteo real. Si el usuario ya cargó el resultado real de
// esa fecha (vía CSV o datos remotos), lo compara automáticamente contra el
// ranking generado. Reutiliza el mismo motor de puntaje que el análisis
// normal (computeLotteryRanking), solo que alimentado con un dataset
// recortado en el tiempo en vez de con todo `data`.
// ============================================
function runSimulation(lottery, targetDateStr, top) {
  const { m, d } = splitDate(targetDateStr);

  // Recorte estricto: SOLO sorteos con fecha anterior a la simulada, de
  // cualquier lotería (computeWindowStats/computeLotteryRanking ya filtran
  // por lotería puertas adentro). Comparación de strings 'YYYY-MM-DD'
  // funciona cronológicamente, igual que en el resto de la app.
  const cutoffRows = data.filter(r => r.date < targetDateStr);

  const rowsForDayMonth = cutoffRows.filter(r => {
    const { m: rm, d: rd } = splitDate(r.date);
    return rm === m && rd === d && r.lottery === lottery;
  });

  const yearsUsed = [...new Set(rowsForDayMonth.map(r => r.date.substring(0, 4)))];
  const ranking = computeLotteryRanking(rowsForDayMonth, lottery, m, d, cutoffRows);
  const topRanked = ranking.ranked.slice(0, top);
  const topPales = ranking.pairs.slice(0, 10);

  // Resultado real de esa fecha (si el usuario ya lo cargó). Puede haber
  // más de una fila si hubo una importación duplicada; se combinan todos
  // los números vistos para esa lotería+fecha en un solo conjunto.
  const actualRows = data.filter(r => r.lottery === lottery && r.date === targetDateStr);
  let actualNumbers = null;
  if (actualRows.length > 0) {
    const set = new Set();
    actualRows.forEach(r => r.numbers.forEach(n => set.add(n)));
    actualNumbers = [...set];
  }

  let actualPairKeys = [];
  if (actualNumbers) {
    for (let i = 0; i < actualNumbers.length; i++) {
      for (let j = i + 1; j < actualNumbers.length; j++) {
        actualPairKeys.push([actualNumbers[i], actualNumbers[j]].sort().join("–"));
      }
    }
  }

  const numberHits = actualNumbers ? topRanked.filter(x => actualNumbers.includes(x.n)) : [];
  const numberMisses = actualNumbers ? actualNumbers.filter(n => !topRanked.some(x => x.n === n)) : [];
  const paleHits = actualNumbers ? topPales.filter(([key]) => actualPairKeys.includes(key)) : [];

  return {
    lottery, m, d, top, targetDateStr,
    sampleSize: rowsForDayMonth.length,
    yearsUsed,
    topRanked, topPales,
    actualNumbers, numberHits, numberMisses, paleHits
  };
}

function buildSimulationResultHtml(sim) {
  const hour = getScheduleFor(sim.lottery);
  let html = `<section class="card lottery-result-block">
    <div class="lottery-result-header">
      <h3>🧪 ${escapeHtml(sim.lottery)}${hour ? ` <span class="lottery-hour-tag">🕒 ${escapeHtml(hour)}</span>` : ""}</h3>
      <span class="badge-count">${sim.sampleSize} sorteo${sim.sampleSize === 1 ? "" : "s"} usado${sim.sampleSize === 1 ? "" : "s"} · ${sim.yearsUsed.length} año${sim.yearsUsed.length === 1 ? "" : "s"} previo${sim.yearsUsed.length === 1 ? "" : "s"}</span>
    </div>
    <div class="hint">Simulando el ${pad(sim.d)}/${pad(sim.m)}/${sim.targetDateStr.substring(0, 4)}: el ranking y los palés de abajo se calcularon usando ÚNICAMENTE sorteos anteriores al ${sim.targetDateStr} (jamás la fecha simulada ni nada posterior), exactamente como si se hubiera generado el día antes del sorteo real.</div>`;

  if (sim.sampleSize === 0) {
    html += `<div class="empty">No hay sorteos anteriores al ${sim.targetDateStr} para esta lotería en ese día/mes — no se puede generar un ranking de backtest sin al menos algún año previo cargado.</div></section>`;
    return html;
  }

  const hitSet = new Set(sim.numberHits.map(x => x.n));
  html += `<div class="lottery-result-sub">🔥 Ranking generado (top ${sim.top}, solo con datos previos)</div>
    <table>
      <tr><th>#</th><th>Número</th><th>Puntaje</th><th>${sim.actualNumbers ? "¿Salió?" : ""}</th></tr>
      ${sim.topRanked.map((x, i) => `
        <tr>
          <td><strong>${i + 1}</strong></td>
          <td><span class="num ${sim.actualNumbers && hitSet.has(x.n) ? "hot" : ""}">${x.n}</span></td>
          <td><span class="stars">${generateStars(x.score, 100)}</span> <span class="small muted">${x.score.toFixed(1)}</span></td>
          <td>${sim.actualNumbers ? (hitSet.has(x.n) ? '<span class="success">✓ acertado</span>' : '<span class="small muted">—</span>') : ""}</td>
        </tr>
      `).join("")}
    </table>`;

  html += `<div class="lottery-result-sub">🎯 Palés candidatos (top 10, solo con datos previos)</div>`;
  if (sim.topPales.length === 0) {
    html += '<div class="empty">No hay suficientes palés en el histórico previo a esta fecha.</div>';
  } else {
    const paleHitKeys = new Set(sim.paleHits.map(([key]) => key));
    html += `
      <table>
        <tr><th>#</th><th>Palé</th><th>Apariciones previas</th><th>${sim.actualNumbers ? "¿Salió?" : ""}</th></tr>
        ${sim.topPales.map(([key, count], i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td><span class="num ${sim.actualNumbers && paleHitKeys.has(key) ? "hot" : ""}">${key}</span></td>
            <td><strong>${count}</strong></td>
            <td>${sim.actualNumbers ? (paleHitKeys.has(key) ? '<span class="success">✓ acertado</span>' : '<span class="small muted">—</span>') : ""}</td>
          </tr>
        `).join("")}
      </table>`;
  }

  if (!sim.actualNumbers) {
    html += `<div class="warning">ℹ️ Todavía no tienes cargado el resultado real del ${sim.targetDateStr} para esta lotería, así que arriba solo se ve la predicción generada por el backtest. Importa ese resultado (CSV) o actualiza los datos remotos y vuelve a simular para ver la comparación número por número.</div>`;
  } else {
    const hitCount = sim.numberHits.length;
    const paleHitCount = sim.paleHits.length;
    html += `
      <div class="lottery-result-sub">📋 Comparación contra el resultado real</div>
      <div class="insights-grid">
        <div class="insight-card"><strong>Resultado real</strong>${sim.actualNumbers.map(n => `<span class="num">${escapeHtml(n)}</span>`).join(" ")}</div>
        <div class="insight-card"><strong>Números acertados en el top ${sim.top}</strong>${hitCount} de ${sim.actualNumbers.length}${sim.numberMisses.length ? ` · no estaban en el top: ${sim.numberMisses.map(n => escapeHtml(n)).join(", ")}` : ""}</div>
        <div class="insight-card"><strong>Palés acertados en el top 10</strong>${paleHitCount} de ${sim.topPales.length ? "los candidatos" : "0 candidatos"}</div>
      </div>
      <div class="warning">⚠️ Un backtest puntual no demuestra que el método funcione ni prediga nada: es solo la comparación de UN sorteo. Para saber si esto aporta algo real hace falta correr la simulación sobre muchas fechas distintas y mirar el acierto promedio — ver la nota de "backtesting" en los comentarios del código como próximo paso pendiente.</div>
    `;
  }

  html += "</section>";
  return html;
}

function runSimulationFromUI() {
  const lottery = document.getElementById("sim-lottery")?.value || "";
  const targetDateStr = document.getElementById("sim-date")?.value || "";
  const top = +(document.getElementById("sim-top")?.value || 10);
  const resultsEl = document.getElementById("sim-results");
  if (!resultsEl) return;

  if (!lottery) {
    resultsEl.innerHTML = '<div class="empty">Elige una lotería para simular.</div>';
    return;
  }
  if (!validateDate(targetDateStr)) {
    resultsEl.innerHTML = '<div class="empty">Elige una fecha válida para simular.</div>';
    return;
  }

  const sim = runSimulation(lottery, targetDateStr, top);
  resultsEl.innerHTML = buildSimulationResultHtml(sim);
}

function populateSimLotterySelect() {
  const selects = document.querySelectorAll("select.single-lottery-select");
  selects.forEach(sel => {
    const previous = sel.value;
    sel.innerHTML = allLotteries.length
      ? allLotteries.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("")
      : '<option value="">Sin loterías cargadas</option>';
    if (allLotteries.includes(previous)) sel.value = previous;
  });
}

// ============================================
// V9 · TENDENCIA RECIENTE (idea tomada de portales como elboletoganador.com)
// El resto de la app compara "este día/mes contra TODOS los años" — útil
// para el patrón de largo plazo, pero no responde "¿qué viene pasando
// ÚLTIMAMENTE en esta lotería?". Esta sección mira solo los últimos N
// sorteos CRONOLÓGICOS de la lotería (por defecto 60, como el "Top 10 en 60
// sorteos" de esos portales) y calcula:
//   1) Los números más frecuentes en esa ventana reciente.
//   2) Qué decenas y terminaciones llevan MÁS sorteos sin aparecer dentro de
//      esa misma ventana ("atraso"), que es la idea de "números/decenas/
//      terminaciones atrasadas" que usan varios portales de estadísticas de
//      lotería en RD.
// No se incluyó su "Tabla de Unidades" tal cual: no quedó claro en el sitio
// si mide algo distinto de la terminación (último dígito) que ya cubrimos
// aquí, así que se dejó afuera para no duplicar con un nombre inventado.
// ============================================
function getRecentDraws(lottery, windowSize) {
  return [...data]
    .filter(r => r.lottery === lottery)
    .sort((a, b) => a.date.localeCompare(b.date)) // cronológico ascendente
    .slice(-windowSize);
}

function computeRecentHotNumbers(recentDraws) {
  const freq = {};
  recentDraws.forEach(r => {
    [...new Set(r.numbers)].forEach(n => { freq[n] = (freq[n] || 0) + 1; });
  });
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// keyFn agrupa cada número (ej: decena o terminación); allKeys son todos los
// grupos posibles, para que un grupo que nunca salió en la ventana también
// aparezca (con "atraso" = tamaño total de la ventana), en vez de faltar
// silenciosamente.
function computeOverdueStats(recentDraws, keyFn, allKeys) {
  const lastSeenIndex = {};
  recentDraws.forEach((r, idx) => {
    [...new Set(r.numbers)].forEach(n => {
      lastSeenIndex[keyFn(n)] = idx; // se sobreescribe con el índice más reciente
    });
  });
  const total = recentDraws.length;
  return allKeys
    .map(key => {
      const idx = lastSeenIndex[key];
      const seen = idx !== undefined;
      return { key, seen, overdue: seen ? total - 1 - idx : total };
    })
    .sort((a, b) => b.overdue - a.overdue || a.key.localeCompare(b.key));
}

function buildRecentTrendHtml(lottery, windowSize) {
  const recentDraws = getRecentDraws(lottery, windowSize);
  if (recentDraws.length === 0) {
    return '<div class="empty">No hay sorteos cargados para esta lotería.</div>';
  }
  const usedWindow = recentDraws.length;
  const hot = computeRecentHotNumbers(recentDraws).slice(0, 10);

  const decadeKeys = Array.from({ length: 10 }, (_, i) => `${i}0–${i}9`);
  const decadeOf = n => { const idx = Math.floor(Number(n) / 10); return `${idx}0–${idx}9`; };
  const decadeOverdue = computeOverdueStats(recentDraws, decadeOf, decadeKeys);

  const termKeys = Array.from({ length: 10 }, (_, i) => String(i));
  const termOf = n => n.slice(-1);
  const termOverdue = computeOverdueStats(recentDraws, termOf, termKeys);

  let html = `<div class="hint">Ventana analizada: los últimos ${usedWindow} sorteo${usedWindow === 1 ? "" : "s"} cargados de esta lotería, en orden cronológico${usedWindow < windowSize ? ` (pediste ${windowSize}, pero el histórico cargado de esta lotería solo tiene ${usedWindow})` : ""}.</div>`;

  html += '<div class="lottery-result-sub">🔥 Números más frecuentes en la ventana reciente</div>';
  html += hot.length
    ? `<table><tr><th>Número</th><th>Apariciones</th></tr>${hot.map(([n, c]) => `<tr><td><span class="num hot">${n}</span></td><td><strong>${c}</strong> de ${usedWindow}</td></tr>`).join("")}</table>`
    : '<div class="empty">Sin datos.</div>';

  html += '<div class="lottery-result-sub">❄️ Decenas más atrasadas</div>';
  html += `<table><tr><th>Decena</th><th>Atraso</th></tr>${decadeOverdue.map(x => `
    <tr>
      <td><span class="num cold">${x.key}</span></td>
      <td>${x.seen ? `<strong>${x.overdue}</strong> sorteo${x.overdue === 1 ? "" : "s"} sin salir` : "no salió en ningún sorteo de la ventana"}</td>
    </tr>
  `).join("")}</table>`;

  html += '<div class="lottery-result-sub">❄️ Terminaciones más atrasadas</div>';
  html += `<table><tr><th>Terminación</th><th>Atraso</th></tr>${termOverdue.map(x => `
    <tr>
      <td><span class="num cold">…${x.key}</span></td>
      <td>${x.seen ? `<strong>${x.overdue}</strong> sorteo${x.overdue === 1 ? "" : "s"} sin salir` : "no salió en ningún sorteo de la ventana"}</td>
    </tr>
  `).join("")}</table>`;

  html += '<div class="warning">⚠️ "Atraso" = cuántos sorteos de esta ventana pasaron desde la última vez que apareció ese grupo. Es la misma idea de "números/decenas atrasadas" que usan varios portales de estadísticas de lotería en RD: describe el histórico cargado, no predice ni cambia la probabilidad matemática del próximo sorteo.</div>';

  return html;
}

function runRecentTrendFromUI() {
  const lottery = document.getElementById("recent-lottery")?.value || "";
  const windowSize = Math.max(1, +(document.getElementById("recent-window")?.value || 60));
  const resultsEl = document.getElementById("recent-results");
  if (!resultsEl) return;

  if (!lottery) {
    resultsEl.innerHTML = '<div class="empty">Elige una lotería.</div>';
    return;
  }

  resultsEl.innerHTML = `<section class="card lottery-result-block">
    <div class="lottery-result-header"><h3>🕐 ${escapeHtml(lottery)}</h3></div>
    ${buildRecentTrendHtml(lottery, windowSize)}
  </section>`;
}

// ============================================
// UTILIDADES
// ============================================
// ============================================
// ACORDEONES (paneles secundarios)
// Los ~4 paneles más accionables (ranking, recomendaciones, palés
// frecuentes, confianza) se muestran siempre abiertos. El resto de
// paneles analíticos (repetidores, espejos, decenas, matriz, rachas,
// terminaciones, comparaciones, etc.) se agrupan en <details> colapsables
// para que el bloque de resultados no se sienta abrumador de entrada,
// sin perder ningún dato: todo sigue a un clic de distancia.
// ============================================
function wrapAcc(title, innerHtml, open = false) {
  return `
    <details class="acc"${open ? " open" : ""}>
      <summary class="acc-summary">${title}</summary>
      <div class="acc-body">${innerHtml}</div>
    </details>
  `;
}

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
  const totalBadgeH = document.getElementById("total-records-badge");
  if (totalBadgeH) totalBadgeH.textContent = data.length;
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

// ============================================
// NAVEGACIÓN POR PESTAÑAS
// Reemplaza el modelo anterior de "todo apilado en una sola página larga +
// botón de engranaje flotante" por pestañas reales: solo un panel visible
// a la vez, para que la app no se sienta abrumadora. toggleHistory() y
// toggleSettings() se conservan como alias (por compatibilidad con
// cualquier llamada existente) y ahora simplemente cambian de pestaña.
// ============================================
function switchTab(name) {
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.tabPanel === name);
  });
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  if (name === "upcoming") buildUpcomingSummary();
  const active = document.querySelector(`.tab-panel[data-tab-panel="${name}"]`);
  if (active) active.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleHistory() {
  switchTab("data");
}

function toggleSettings() {
  switchTab("settings");
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

// Delegación para el formulario de "Resultado de hoy" en la pestaña
// Próxima (botones Editar/Cancelar y el submit del formulario de captura).
// El contenedor #upcoming-results existe desde el HTML inicial y solo se le
// reemplaza el innerHTML en cada buildUpcomingSummary(), así que basta con
// enganchar los listeners una sola vez aquí.
document.getElementById("upcoming-results")?.addEventListener("click", handleUpcomingResultsClick);
document.getElementById("upcoming-results")?.addEventListener("submit", handleUpcomingResultsSubmit);
document.getElementById("upcoming-results")?.addEventListener("paste", handleUpcomingResultsPaste, true);

document.addEventListener("DOMContentLoaded", initializeData);
