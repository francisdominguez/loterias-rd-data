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

let data = [];
let dataSource = "seed";
let allLotteries = [];
let selectedLotteries = new Set();

// ============================================
// INICIALIZACIÓN
// ============================================
async function initializeData() {
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

// Devuelve la función-filtro de lotería activa: si hay texto en el buscador,
// se usa la lógica AND/OR; si está vacío, se usa la selección manual (checklist).
function getActiveLotteryFilter() {
  const query = (document.getElementById("lottery-search")?.value || "").trim();
  if (query) {
    return (lotteryName) => lotteryMatchesQuery(lotteryName, query);
  }
  return (lotteryName) => selectedLotteries.has(lotteryName);
}

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
  if (saved) {
    selectedLotteries = new Set(JSON.parse(saved));
  } else {
    selectedLotteries = new Set(allLotteries);
  }

  renderLotterySelector();
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
    .map(lottery => `
      <div class="lottery-option ${selectedLotteries.has(lottery) ? "selected" : ""}"
           data-lottery="${escapeHtml(lottery)}">
        ${escapeHtml(lottery)}
      </div>
    `)
    .join("");
}

function handleLotterySearch() {
  renderLotterySelector();
  analyze();
}

function toggleLottery(lottery) {
  if (selectedLotteries.has(lottery)) {
    selectedLotteries.delete(lottery);
  } else {
    selectedLotteries.add(lottery);
  }
  localStorage.setItem(SELECTED_LOTTERIES_KEY, JSON.stringify([...selectedLotteries]));
  renderLotterySelector();
  analyze();
}

function toggleAllLotteries() {
  if (selectedLotteries.size === allLotteries.length) {
    selectedLotteries.clear();
  } else {
    selectedLotteries = new Set(allLotteries);
  }
  localStorage.setItem(SELECTED_LOTTERIES_KEY, JSON.stringify([...selectedLotteries]));
  renderLotterySelector();
  analyze();
}

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

// ============================================
// ANÁLISIS Y CÁLCULOS
// ============================================
function analyze() {
  const y = +document.getElementById("year").value;
  const m = +document.getElementById("month").value;
  const d = +document.getElementById("day").value;
  const top = +document.getElementById("top").value;

  const lotteryFilter = getActiveLotteryFilter();

  const rows = data.filter(r => {
    const { y: year, m: month, d: day } = splitDate(r.date);
    return year === y && month === m && day === d && lotteryFilter(r.lottery);
  });

  const freq = {}, pair = {}, yearFreq = {};

  rows.forEach(r => {
    const ns = [...new Set(r.numbers)];
    ns.forEach(n => {
      freq[n] = (freq[n] || 0) + 1;
      const yr = r.date.substring(0, 4);
      yearFreq[n] ??= {};
      yearFreq[n][yr] = (yearFreq[n][yr] || 0) + 1;
    });

    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const p = [ns[i], ns[j]].sort().join("–");
        pair[p] = (pair[p] || 0) + 1;
      }
    }
  });

  const maxFreq = Math.max(...Object.values(freq), 1);
  const ranked = Object.entries(freq)
    .map(([n, c]) => {
      const years = Object.keys(yearFreq[n] || {}).length;
      const score = c * 2 + years;
      return [n, c, years, score];
    })
    .sort((a, b) => b[3] - a[3] || b[1] - a[1] || a[0].localeCompare(b[0]));

  const pairs = Object.entries(pair)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const allPossibleNumbers = Array.from({length: 100}, (_, i) => pad(i));
  const hotNumbers = new Set(ranked.map(x => x[0]));
  const coldNumbers = allPossibleNumbers.filter(n => !hotNumbers.has(n));

  document.getElementById("summary").innerHTML = `
    <div><div class="stat">${rows.length}</div><div class="stat-label">Sorteos</div></div>
    <div><div class="stat">${ranked.length}</div><div class="stat-label">Números distintos</div></div>
    <div><div class="stat">${ranked[0]?.[0] || "—"}</div><div class="stat-label">Top estadístico</div></div>
    <div><div class="stat">${pairs[0]?.[0] || "—"}</div><div class="stat-label">Palé líder</div></div>
  `;

  // Ranking con barras de progreso CSS: los 5 más calientes resaltan en rojo/naranja
  if (ranked.length) {
    document.getElementById("ranking").innerHTML = `
      <table>
        <tr><th>#</th><th>Número</th><th>Frecuencia</th><th>Años</th><th>Puntaje</th></tr>
        ${ranked.slice(0, top).map((x, i) => {
          const stars = generateStars(x[3], 5);
          const ranking_class = i < 3 ? "hot" : i < 8 ? "recommended" : "";
          const barClass = i < 5 ? "bar-hot" : "bar-normal";
          const widthPct = Math.max(6, (x[1] / maxFreq) * 100);
          return `
            <tr>
              <td><strong>${i + 1}</strong></td>
              <td><span class="num ${ranking_class}">${x[0]}</span></td>
              <td>
                <div class="progress-bar-container">
                  <div class="progress-bar">
                    <div class="progress-fill ${barClass}" style="width: ${widthPct}%">
                      ${x[1]}
                    </div>
                  </div>
                  <div class="frequency-count">${x[1]}</div>
                </div>
              </td>
              <td><strong>${x[2]}</strong></td>
              <td><span class="stars">${stars}</span></td>
            </tr>
          `;
        }).join("")}
      </table>
    `;
  } else {
    document.getElementById("ranking").innerHTML = '<div class="empty">No hay datos para esa fecha/loterías seleccionadas.</div>';
  }

  renderIntelligentRecommendations(ranked, coldNumbers.slice(0, 5), m, d, lotteryFilter);

  if (pairs.length) {
    document.getElementById("pairs").innerHTML = `
      <table>
        <tr><th>#</th><th>Palé</th><th>Apariciones</th></tr>
        ${pairs.slice(0, top).map((x, i) => `
          <tr>
            <td><strong>${i + 1}</strong></td>
            <td><span class="num">${x[0]}</span></td>
            <td><strong>${x[1]}</strong></td>
          </tr>
        `).join("")}
      </table>
    `;
  } else {
    document.getElementById("pairs").innerHTML = '<div class="empty">No hay palés suficientes.</div>';
  }
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
    document.getElementById("insights").innerHTML = '<div class="empty">Sin datos para mostrar insights.</div>';
    return;
  }

  const { stats, totalSorteos } = buildAtrasoStats(month, day, lotteryFilter);
  const recommended = scoreRecommendations(stats, totalSorteos).slice(0, 3);

  const topHot = ranked.slice(0, 3);
  const coldNums = coldNumbers.join(", ");

  let html = '<div class="insights-grid">';

  html += '<div class="insight-card">';
  html += '<strong>🔥 Top 3 Calientes</strong>';
  topHot.forEach(n => {
    html += `<div style="color:#991b1b">🔥 ${n[0]} (${n[1]} veces)</div>`;
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

  document.getElementById("insights").innerHTML = html;
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

document.addEventListener("DOMContentLoaded", initializeData);
