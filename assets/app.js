// ══════════════════════════════════════════════════════════════
//  SCUDO CONTROL — app.js
//  Lógica principal da UI. Conecta Firebase Auth + Firestore
//  com os renders da interface.
// ══════════════════════════════════════════════════════════════

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider,
         signInWithPopup, signOut,
         onAuthStateChanged }                     from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }                           from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initDB, createVehicle, joinVehicle,
         getVehicleInfo,
         addFuel, deleteFuel,
         addManut, deleteManut,
         addPlano, deletePlano,
         addGasto, deleteGasto,
         setState, getState,
         onFuel, onManut, onPlano,
         onGastos, onState }                      from "./db.js";

// ── Firebase init ────────────────────────────────────────────
const app  = initializeApp(FIREBASE_CONFIG); // FIREBASE_CONFIG vem de firebase-config.js
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State global ─────────────────────────────────────────────
let currentUser    = null;
let currentVehicle = null;   // { id, name, ... }
let appState       = {};     // { km, placa }
let DATA = { fuel: [], manut: [], plano: [], gastos: [] };
let unsubs         = [];     // Firestore listeners para limpar depois

// ══════════════════════════════════════════════════════════════
//  AUTH FLOW
// ══════════════════════════════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const savedVid = localStorage.getItem("sc_vehicleId");
    if (savedVid) {
      try {
        const info = await getVehicleInfo(db, savedVid);
        if (info && info.members && info.members[user.uid]) {
          await startApp(savedVid, info);
          return;
        }
      } catch (e) { /* segue pro select */ }
    }
    showScreen("screen-vehicle");
  } else {
    currentUser = null;
    showScreen("screen-login");
  }
});

async function loginGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    alert("Erro no login: " + e.message);
  }
}

async function handleLogout() {
  if (!confirm("Sair da conta?")) return;
  unsubs.forEach(u => u());
  unsubs = [];
  localStorage.removeItem("sc_vehicleId");
  currentVehicle = null;
  DATA = { fuel: [], manut: [], plano: [], gastos: [] };
  await signOut(auth);
}

async function handleCreateVehicle() {
  const name = document.getElementById("inp-vehicle-name").value.trim();
  if (!name) { alert("Informe o nome do veículo"); return; }
  try {
    showLoading(true);
    const vid = await createVehicle(db, currentUser.uid, name);
    await startApp(vid, { name });
  } catch (e) {
    alert("Erro ao criar veículo: " + e.message);
  } finally {
    showLoading(false);
  }
}

async function handleJoinVehicle() {
  const code = document.getElementById("inp-vehicle-code").value.trim().toUpperCase();
  if (!code) { alert("Informe o código do veículo"); return; }
  try {
    showLoading(true);
    const info = await joinVehicle(db, currentUser.uid, code);
    await startApp(code, info);
  } catch (e) {
    alert(e.message);
  } finally {
    showLoading(false);
  }
}

async function startApp(vehicleId, vehicleInfo) {
  currentVehicle = { id: vehicleId, ...vehicleInfo };
  localStorage.setItem("sc_vehicleId", vehicleId);

  // Init DB layer
  initDB(db, vehicleId);

  // Load initial state
  appState = await getState();

  // Subscribe to realtime
  unsubs.forEach(u => u());
  unsubs = [
    onState(s  => { appState = s; refreshCurrentPage(); }),
    onFuel(arr  => { DATA.fuel  = arr; refreshCurrentPage(); }),
    onManut(arr => { DATA.manut = arr; refreshCurrentPage(); }),
    onPlano(arr => { DATA.plano = arr; refreshCurrentPage(); }),
    onGastos(arr=> { DATA.gastos= arr; refreshCurrentPage(); }),
  ];

  // Update vehicle badge
  document.getElementById("home-placa").textContent    = currentVehicle.name || "Scudo 2025";
  document.getElementById("vehicle-code-badge").textContent = "🚐 " + vehicleId;

  showScreen("screen-app");
  navTo("home");
}

// ══════════════════════════════════════════════════════════════
//  SCREEN SWITCHER
// ══════════════════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "flex";
}

function showLoading(on) {
  document.getElementById("loading-overlay").style.display = on ? "flex" : "none";
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
const fmtBRL = (n, short = false) => {
  if (n == null || isNaN(n)) return "R$ 0,00";
  if (short && Math.abs(n) >= 1000) return "R$ " + (n / 1000).toFixed(1).replace(".", ",") + "k";
  return "R$ " + Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtN   = (n, d = 1) => n != null && !isNaN(n) ? Number(n).toFixed(d).replace(".", ",") : "—";
const fmtKM  = n => n ? Number(n).toLocaleString("pt-BR") + " km" : "—";
const fmtDate = iso => { if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const today  = () => new Date().toISOString().split("T")[0];

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════
let currentPage = "home";

function navTo(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById("page-" + id).classList.add("active");
  const navEl = document.getElementById("nav-" + id);
  if (navEl) navEl.classList.add("active");
  currentPage = id;
  window.scrollTo(0, 0);
  renderPage(id);
}

function refreshCurrentPage() { renderPage(currentPage); }

function renderPage(id) {
  if (id === "home")   renderHome();
  if (id === "fuel")   renderFuel();
  if (id === "manut")  renderManut();
  if (id === "gastos") renderGastos();
  if (id === "plan")   renderPlan();
  if (id === "manual") renderManual();
}

// ══════════════════════════════════════════════════════════════
//  MODALS
// ══════════════════════════════════════════════════════════════
function openModal(id) {
  const km_ = appState.km || "";
  if (id === "modal-fuel")  { document.getElementById("f-data").value = today(); document.getElementById("f-km").value = km_; }
  if (id === "modal-manut") { document.getElementById("m-data").value = today(); document.getElementById("m-km").value = km_; }
  if (id === "modal-gasto") { document.getElementById("g-data").value = today(); }
  if (id === "modal-plan")  { document.getElementById("p-ultima-dt").value = today(); }
  if (id === "modal-km")    { document.getElementById("km-val").value = km_; document.getElementById("km-placa").value = appState.placa || ""; }
  document.getElementById(id).classList.add("open");
}

function closeModal(id) { document.getElementById(id).classList.remove("open"); }

function overlayClose(e, id) { if (e.target.classList.contains("overlay")) closeModal(id); }

// ══════════════════════════════════════════════════════════════
//  KM / PLACA
// ══════════════════════════════════════════════════════════════
async function saveKm() {
  const v = parseInt(document.getElementById("km-val").value);
  const placa = document.getElementById("km-placa").value.trim();
  if (!v || v < 0) { alert("Informe uma quilometragem válida"); return; }
  const newState = { ...appState, km: v };
  if (placa) newState.placa = placa;
  await setState(newState);
  closeModal("modal-km");
}

// ══════════════════════════════════════════════════════════════
//  FUEL
// ══════════════════════════════════════════════════════════════
async function saveFuel() {
  const data   = document.getElementById("f-data").value;
  const km     = parseFloat(document.getElementById("f-km").value);
  const litros = parseFloat(document.getElementById("f-litros").value);
  const preco  = parseFloat(document.getElementById("f-preco").value);
  const tipo   = document.getElementById("f-tipo").value;
  const posto  = document.getElementById("f-posto").value.trim();
  if (!data || !km || !litros || !preco) { alert("Preencha todos os campos obrigatórios"); return; }

  let consumo = null;
  if (DATA.fuel.length > 0) {
    const last = DATA.fuel[0];
    const diff = km - last.km;
    if (diff > 0) consumo = diff / litros;
  }

  await addFuel({ data, km, litros, preco, tipo, posto, consumo, total: litros * preco });

  // Atualiza km no state se maior
  if (km > (appState.km || 0)) await setState({ ...appState, km });

  closeModal("modal-fuel");
}

function calcFuelPreview() {
  const km     = parseFloat(document.getElementById("f-km").value);
  const litros = parseFloat(document.getElementById("f-litros").value);
  const el     = document.getElementById("f-preview");
  if (km && litros && DATA.fuel.length > 0) {
    const diff = km - DATA.fuel[0].km;
    if (diff > 0) { el.style.display = "block"; el.textContent = `📊 Consumo estimado: ${fmtN(diff / litros)} km/L neste abastecimento`; return; }
  }
  el.style.display = "none";
}

async function delFuel(id) {
  if (!confirm("Remover abastecimento?")) return;
  await deleteFuel(id);
}

function renderFuel() {
  const fuels = DATA.fuel;
  const wrap  = document.getElementById("fuel-list-wrap");

  if (fuels.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon-wrap" style="background:var(--blue-dim)">⛽</div><div class="empty-title">Nenhum abastecimento</div><div class="empty-sub">Registre seus abastecimentos para acompanhar o consumo do veículo</div><button class="btn-empty" onclick="openModal('modal-fuel')">+ Adicionar abastecimento</button></div>`;
    ["f-stat-media","f-stat-litros","f-stat-total","f-stat-preco"].forEach(id => document.getElementById(id).textContent = "—");
    return;
  }

  const totalLitros = fuels.reduce((s, f) => s + f.litros, 0);
  const totalReais  = fuels.reduce((s, f) => s + f.total, 0);
  const consumos    = fuels.filter(f => f.consumo).map(f => f.consumo);
  const media       = consumos.length ? consumos.reduce((s, c) => s + c, 0) / consumos.length : null;

  document.getElementById("f-stat-media").textContent  = media ? fmtN(media) + " km/L" : "—";
  document.getElementById("f-stat-litros").textContent = fmtN(totalLitros) + "L";
  document.getElementById("f-stat-total").textContent  = fmtBRL(totalReais, true);
  document.getElementById("f-stat-preco").textContent  = fuels[0] ? "R$ " + fmtN(fuels[0].preco, 2) + "/L" : "—";

  const tipos = { diesel_s10: "Diesel S10", diesel_s500: "Diesel S500", diesel_aditivado: "Diesel Aditivado" };

  wrap.innerHTML = `<div class="list-wrap">` + fuels.map(f => `
    <div class="list-row">
      <div class="row-icon" style="background:var(--blue-dim)">⛽</div>
      <div class="row-body">
        <div class="row-title">${fmtDate(f.data)} · ${fmtKM(f.km)}</div>
        <div class="row-sub">${f.litros}L · ${tipos[f.tipo] || f.tipo}${f.posto ? " · " + f.posto : ""}</div>
        ${f.consumo ? `<div class="row-sub2" style="color:var(--green)">📊 ${fmtN(f.consumo)} km/L</div>` : ""}
      </div>
      <div class="row-right">
        <div class="row-value" style="color:var(--blue)">R$ ${fmtN(f.preco, 2)}/L</div>
        <div class="row-value-sub">${fmtBRL(f.total)}</div>
        <button class="del-btn" onclick="delFuel('${f.id}')">✕</button>
      </div>
    </div>
  `).join("") + `</div>`;
}

// ══════════════════════════════════════════════════════════════
//  MANUTENÇÃO
// ══════════════════════════════════════════════════════════════
const MANUT_LABELS = { oleo:"Troca de Óleo", filtro_ar:"Filtro de Ar", filtro_comb:"Filtro de Combustível", filtro_cabine:"Filtro de Cabine", correia:"Correia", pneu:"Pneus", freio:"Freios", bateria:"Bateria", arrefecimento:"Arrefecimento", suspensao:"Suspensão", eletrica:"Elétrica", revisao:"Revisão Programada", urgente:"Reparo Urgente", outro:"Manutenção" };
const MANUT_ICONS  = { oleo:"🛢️", filtro_ar:"🌬️", filtro_comb:"⛽", filtro_cabine:"🌿", correia:"⚙️", pneu:"🔴", freio:"🔶", bateria:"⚡", arrefecimento:"💧", suspensao:"🔩", eletrica:"⚡", revisao:"📋", urgente:"🚨", outro:"🔧" };

async function saveManut() {
  const tipo    = document.getElementById("m-tipo").value;
  const data    = document.getElementById("m-data").value;
  const km      = parseFloat(document.getElementById("m-km").value);
  const custo   = parseFloat(document.getElementById("m-custo").value) || 0;
  const desc    = document.getElementById("m-desc").value.trim();
  const oficina = document.getElementById("m-oficina").value.trim();
  if (!data || !km) { alert("Preencha data e KM"); return; }
  await addManut({ tipo, data, km, custo, desc, oficina });
  if (km > (appState.km || 0)) await setState({ ...appState, km });
  closeModal("modal-manut");
}

async function delManut(id) {
  if (!confirm("Remover manutenção?")) return;
  await deleteManut(id);
}

let manutTab = "pend";
function switchManutTab(t) {
  manutTab = t;
  document.getElementById("tab-pend").classList.toggle("active", t === "pend");
  document.getElementById("tab-real").classList.toggle("active", t === "real");
  document.getElementById("manut-tab-pend").style.display = t === "pend" ? "block" : "none";
  document.getElementById("manut-tab-real").style.display = t === "real" ? "block" : "none";
}

const REVISAO_INTERVALS = [
  { tipo:"oleo",        nome:"Troca de óleo do motor",   km: 15000 },
  { tipo:"filtro_ar",   nome:"Filtro de ar do motor",    km: 30000 },
  { tipo:"filtro_comb", nome:"Filtro de combustível",    km: 30000 },
  { tipo:"filtro_cabine",nome:"Filtro de cabine",        km: 20000 },
  { tipo:"correia",     nome:"Correia auxiliar",         km: 60000 },
  { tipo:"revisao",     nome:"Revisão programada (15k)", km: 15000 },
  { tipo:"revisao",     nome:"Revisão programada (30k)", km: 30000 },
];

function renderManut() {
  const items = DATA.manut;
  const km    = appState.km || 0;
  const planos = DATA.plano;

  // PENDENTES
  const pendentes = planos.filter(p => {
    if (p.intervaloKm && p.ultimaKm != null) {
      const diff = (p.ultimaKm + p.intervaloKm) - km;
      if (diff <= p.intervaloKm * 0.2) return true;
    }
    if (p.ultimaDt && p.intMeses) {
      const prox = new Date(p.ultimaDt);
      prox.setMonth(prox.getMonth() + p.intMeses);
      const diffM = (prox - new Date()) / (1000 * 60 * 60 * 24 * 30);
      if (diffM <= 2) return true;
    }
    return false;
  });

  const pendEl = document.getElementById("manut-pend-list");
  if (pendentes.length === 0) {
    const manualPend = REVISAO_INTERVALS.filter(r => {
      const lastManut = items.filter(m => m.tipo === r.tipo).sort((a, b) => b.km - a.km)[0];
      const lastKm = lastManut ? lastManut.km : 0;
      return ((lastKm + r.km) - km) <= r.km * 0.3;
    }).slice(0, 5);

    if (manualPend.length === 0) {
      pendEl.innerHTML = `<div class="empty-state"><div class="empty-icon-wrap" style="background:var(--green-dim)">✅</div><div class="empty-title">Tudo em dia!</div><div class="empty-sub">Nenhuma manutenção pendente no momento</div></div>`;
    } else {
      pendEl.innerHTML = "<div class='list-wrap'>" + manualPend.map(r => {
        const lastManut = items.filter(m => m.tipo === r.tipo).sort((a, b) => b.km - a.km)[0];
        const lastKm = lastManut ? lastManut.km : 0;
        const proxKm = lastKm + r.km;
        const diff = proxKm - km;
        const isOverdue = diff <= 0;
        return `<div class="maint-card">
          <div class="maint-card-header">
            <div class="maint-card-icon">${MANUT_ICONS[r.tipo] || "🔧"}</div>
            <div style="flex:1"><div class="maint-card-name">${r.nome}</div><div class="maint-card-sub">Previsto em ${proxKm.toLocaleString("pt-BR")} km</div></div>
            <span class="badge ${isOverdue ? "badge-urgent" : "badge-warn"}">${isOverdue ? "VENCIDA" : "Normal"}</span>
          </div>
          <div class="maint-card-alert" style="color:${isOverdue ? "var(--red)" : "var(--green)"}">
            ${isOverdue ? "⚠️" : "▲"} Faltam ${Math.abs(diff).toLocaleString("pt-BR")} km
          </div>
        </div>`;
      }).join("") + "</div>";
    }
  } else {
    pendEl.innerHTML = "<div class='list-wrap'>" + pendentes.map(p => {
      let diffText = "", isOverdue = false;
      if (p.intervaloKm && p.ultimaKm != null) {
        const diff = (p.ultimaKm + p.intervaloKm) - km;
        isOverdue = diff < 0;
        diffText = isOverdue ? `VENCIDA! ${Math.abs(diff).toLocaleString("pt-BR")} km atrás` : `Faltam ${diff.toLocaleString("pt-BR")} km`;
      }
      return `<div class="maint-card">
        <div class="maint-card-header">
          <div class="maint-card-icon">⚙️</div>
          <div style="flex:1"><div class="maint-card-name">${p.item}</div><div class="maint-card-sub">Intervalo: ${p.intervaloKm ? p.intervaloKm.toLocaleString("pt-BR") + " km" : ""}</div></div>
          <span class="badge ${isOverdue ? "badge-urgent" : "badge-warn"}">${isOverdue ? "VENCIDA" : "Próximo"}</span>
        </div>
        <div class="maint-card-alert" style="color:${isOverdue ? "var(--red)" : "var(--yellow)"}">▲ ${diffText}</div>
      </div>`;
    }).join("") + "</div>";
  }

  // REALIZADAS
  const realEl = document.getElementById("manut-real-list");
  if (items.length === 0) {
    realEl.innerHTML = `<div class="empty-state"><div class="empty-icon-wrap" style="background:var(--orange-dim)">🔧</div><div class="empty-title">Nenhuma manutenção</div><div class="empty-sub">Registre manutenções realizadas</div><button class="btn-empty" onclick="openModal('modal-manut')">+ Registrar</button></div>`;
    return;
  }
  realEl.innerHTML = "<div class='list-wrap'>" + items.map(m => `
    <div class="list-row">
      <div class="row-icon" style="background:var(--orange-dim)">${MANUT_ICONS[m.tipo] || "🔧"}</div>
      <div class="row-body">
        <div class="row-title">${MANUT_LABELS[m.tipo] || m.tipo}</div>
        <div class="row-sub">${fmtDate(m.data)} · ${fmtKM(m.km)}${m.oficina ? " · " + m.oficina : ""}</div>
        ${m.desc ? `<div class="row-sub2">${m.desc}</div>` : ""}
      </div>
      <div class="row-right">
        ${m.custo ? `<div class="row-value" style="color:var(--orange)">${fmtBRL(m.custo)}</div>` : ""}
        <button class="del-btn" onclick="delManut('${m.id}')">✕</button>
      </div>
    </div>
  `).join("") + "</div>";
}

// ══════════════════════════════════════════════════════════════
//  PLANO
// ══════════════════════════════════════════════════════════════
async function savePlan() {
  const item = document.getElementById("p-item").value.trim();
  if (!item) { alert("Informe o nome da peça/item"); return; }
  await addPlano({
    item,
    cat:        document.getElementById("p-cat").value,
    ultimaKm:   parseFloat(document.getElementById("p-ultima-km").value) || null,
    intervaloKm:parseFloat(document.getElementById("p-int-km").value) || null,
    ultimaDt:   document.getElementById("p-ultima-dt").value || null,
    intMeses:   parseInt(document.getElementById("p-int-meses").value) || null,
    obs:        document.getElementById("p-obs").value.trim()
  });
  closeModal("modal-plan");
}

async function delPlan(id) {
  if (!confirm("Remover planejamento?")) return;
  await deletePlano(id);
}

function renderPlan() {
  const planos = DATA.plano;
  const km     = appState.km || 0;
  const el     = document.getElementById("plan-list");

  if (planos.length === 0) {
    el.innerHTML = `<div class="empty-state" style="margin:0"><div class="empty-icon-wrap" style="background:var(--teal-dim)">📅</div><div class="empty-title">Nenhum planejamento</div><div class="empty-sub">Adicione peças para monitorar quando devem ser trocadas</div><button class="btn-empty" onclick="openModal('modal-plan')">+ Adicionar</button></div>`;
    return;
  }

  const cats = {};
  planos.forEach(p => { if (!cats[p.cat]) cats[p.cat] = []; cats[p.cat].push(p); });

  el.innerHTML = Object.entries(cats).map(([cat, items]) => `
    <div style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0 6px;font-size:13px;font-weight:600;color:var(--text2)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
        ${cat}
      </div>
      ${items.map(p => renderPlanCard(p, km)).join("")}
    </div>
  `).join("");
}

function renderPlanCard(p, km) {
  let pct = 0, faltam = "", progColor = "pf-green";
  let status = "ok";
  if (p.ultimaKm != null && p.intervaloKm) {
    const proxKm = p.ultimaKm + p.intervaloKm;
    const diff   = proxKm - km;
    pct = Math.min(100, Math.max(0, ((km - p.ultimaKm) / p.intervaloKm) * 100));
    if (diff < 0)       { status = "overdue"; faltam = `VENCIDA! ${Math.abs(diff).toLocaleString("pt-BR")} km atrás`; progColor = "pf-red"; }
    else if (pct >= 85) { status = "soon";    faltam = `Faltam ${diff.toLocaleString("pt-BR")} km`;                  progColor = "pf-orange"; }
    else if (pct >= 60) {                     faltam = `Faltam ${diff.toLocaleString("pt-BR")} km`;                  progColor = "pf-yellow"; }
    else                {                     faltam = `Faltam ${diff.toLocaleString("pt-BR")} km`; }
  }
  let porDataText = "";
  if (p.ultimaDt && p.intMeses) {
    const prox  = new Date(p.ultimaDt);
    prox.setMonth(prox.getMonth() + p.intMeses);
    const diffM = Math.round((prox - new Date()) / (1000 * 60 * 60 * 24 * 30));
    porDataText = `Por data: ${fmtDate(prox.toISOString().split("T")[0])} (${diffM > 0 ? "faltam " + diffM + " meses" : "VENCIDA"})`;
  }
  const bc = status === "overdue" ? "badge-urgent" : status === "soon" ? "badge-warn" : "badge-ok";
  const bt = status === "overdue" ? "VENCIDA" : status === "soon" ? "PRÓXIMO" : "OK";
  return `<div class="plan-card">
    <div class="plan-card-header">
      <div>
        <div class="plan-card-name">${p.item}</div>
        ${p.intervaloKm ? `<div class="plan-card-interval">Intervalo: ${p.intervaloKm.toLocaleString("pt-BR")} km${p.intMeses ? " · " + p.intMeses + " meses" : ""}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="badge ${bc}">${bt}</span>
        <button class="del-btn" onclick="delPlan('${p.id}')">✕</button>
      </div>
    </div>
    ${p.intervaloKm ? `<div class="plan-progress-row"><span>Progresso do ciclo</span><span style="font-weight:600">${Math.round(pct)}%</span></div><div class="progress-bar"><div class="progress-fill ${progColor}" style="width:${pct}%"></div></div>` : ""}
    <div class="plan-card-footer">
      <span>⊙ Última: ${p.ultimaKm ? p.ultimaKm.toLocaleString("pt-BR") + " km" : "Nunca"}</span>
      ${faltam ? `<span>⏱ ${faltam}</span>` : ""}
    </div>
    ${porDataText ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${porDataText}</div>` : ""}
    ${p.obs ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">${p.obs}</div>` : ""}
  </div>`;
}

// ══════════════════════════════════════════════════════════════
//  GASTOS
// ══════════════════════════════════════════════════════════════
let gastosPeriod = "total";

async function saveGasto() {
  const cat   = document.getElementById("g-cat").value;
  const data  = document.getElementById("g-data").value;
  const valor = parseFloat(document.getElementById("g-valor").value);
  const desc  = document.getElementById("g-desc").value.trim();
  if (!data || !valor) { alert("Preencha data e valor"); return; }
  await addGasto({ cat, data, valor, desc });
  closeModal("modal-gasto");
}

async function delGasto(id) {
  if (!confirm("Remover gasto?")) return;
  await deleteGasto(id);
}

function setGastosPeriod(p, el) {
  gastosPeriod = p;
  document.querySelectorAll("#gastos-period-chips .chip").forEach(c => c.classList.remove("active"));
  el.classList.add("active");
  const labels = { total: "Total geral", semana: "Esta semana", mes: "Este mês", ano: "Este ano" };
  document.getElementById("gastos-periodo-label").textContent = labels[p];
  renderGastos();
}

function filterByPeriod(items, dateField) {
  if (gastosPeriod === "total") return items;
  const now = new Date();
  return items.filter(item => {
    const d = new Date(item[dateField]);
    if (gastosPeriod === "semana") {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay()); s.setHours(0, 0, 0, 0);
      return d >= s;
    }
    if (gastosPeriod === "mes") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (gastosPeriod === "ano") return d.getFullYear() === now.getFullYear();
    return true;
  });
}

const catIcon  = c => ({ pneu:"🔴", freio:"🔶", eletrica:"⚡", funilaria:"🔨", vidro:"🪟", ipva:"📋", seguro:"🛡️", multa:"🚨", lavagem:"🧽", outro:"📦" }[c] || "📦");
const catLabel = c => ({ pneu:"Pneus", freio:"Freios", eletrica:"Elétrica", funilaria:"Funilaria/Pintura", vidro:"Vidros", ipva:"IPVA/Licenciamento", seguro:"Seguro", multa:"Multa", lavagem:"Lavagem", outro:"Outros" }[c] || "Outros");

function renderGastos() {
  const fuel   = filterByPeriod(DATA.fuel, "data");
  const manut  = filterByPeriod(DATA.manut, "data").filter(m => m.custo > 0);
  const outros = filterByPeriod(DATA.gastos, "data");

  const tFuel  = fuel.reduce((s, f) => s + f.total, 0);
  const tManut = manut.reduce((s, m) => s + m.custo, 0);
  const tOutros= outros.reduce((s, g) => s + g.valor, 0);
  const total  = tFuel + tManut + tOutros;

  document.getElementById("gastos-total-val").textContent = fmtBRL(total);
  document.getElementById("g-cat-fuel").textContent       = fmtBRL(tFuel, true);
  document.getElementById("g-cat-manut").textContent      = fmtBRL(tManut, true);
  document.getElementById("g-cat-outros").textContent     = fmtBRL(tOutros, true);

  const allItems = [
    ...fuel.map(f  => ({ type:"fuel",  data:f.data, title:`Abastecimento · ${f.litros}L`, sub:`${fmtDate(f.data)} · ${fmtKM(f.km)}${f.posto?" · "+f.posto:""}`, valor:f.total, icon:"⛽", iconBg:"var(--blue-dim)", color:"var(--blue)", id:f.id })),
    ...manut.map(m => ({ type:"manut", data:m.data, title:MANUT_LABELS[m.tipo]||m.tipo, sub:`${fmtDate(m.data)} · ${fmtKM(m.km)}${m.oficina?" · "+m.oficina:""}`, valor:m.custo, icon:MANUT_ICONS[m.tipo]||"🔧", iconBg:"var(--orange-dim)", color:"var(--orange)", id:m.id })),
    ...outros.map(g=> ({ type:"gasto", data:g.data, title:catLabel(g.cat), sub:`${fmtDate(g.data)}${g.desc?" · "+g.desc:""}`, valor:g.valor, icon:catIcon(g.cat), iconBg:"var(--purple-dim)", color:"var(--purple)", id:g.id })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  const wrap = document.getElementById("gastos-list-wrap");
  if (allItems.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon-wrap" style="background:var(--purple-dim)">📋</div><div class="empty-title">Nenhum gasto</div><div class="empty-sub">Registre abastecimentos, manutenções e outros gastos</div><button class="btn-empty" onclick="openModal('modal-gasto')">+ Adicionar gasto</button></div>`;
    return;
  }
  wrap.innerHTML = "<div class='list-wrap'>" + allItems.map(g => `
    <div class="list-row">
      <div class="row-icon" style="background:${g.iconBg}">${g.icon}</div>
      <div class="row-body"><div class="row-title">${g.title}</div><div class="row-sub">${g.sub}</div></div>
      <div class="row-right">
        <div class="row-value" style="color:${g.color}">${fmtBRL(g.valor)}</div>
        ${g.type === "gasto" ? `<button class="del-btn" onclick="delGasto('${g.id}')">✕</button>` : ""}
      </div>
    </div>
  `).join("") + "</div>";
}

// ══════════════════════════════════════════════════════════════
//  HOME
// ══════════════════════════════════════════════════════════════
function renderHome() {
  const km    = appState.km || 0;
  const fuels = DATA.fuel;
  const manut = DATA.manut;

  document.getElementById("stat-km").textContent = km.toLocaleString("pt-BR") + " km";

  const consumos = fuels.filter(f => f.consumo);
  const media = consumos.length ? consumos.reduce((s, c) => s + c.consumo, 0) / consumos.length : null;
  document.getElementById("stat-media").textContent     = media ? fmtN(media) + " km/L" : "— km/L";
  document.getElementById("stat-last-fuel").textContent = fuels.length > 0 ? `${fmtDate(fuels[0].data)} · ${fmtKM(fuels[0].km)}` : "—";

  const now = new Date();
  const mesAtual = item => { const d = new Date(item.data); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); };
  const gMes = [
    ...DATA.fuel.filter(mesAtual).map(f => f.total),
    ...DATA.manut.filter(m => mesAtual(m) && m.custo > 0).map(m => m.custo),
    ...DATA.gastos.filter(mesAtual).map(g => g.valor)
  ].reduce((s, v) => s + v, 0);
  document.getElementById("stat-gastos-mes").textContent = fmtBRL(gMes);

  const hasFuel = fuels.length > 0;
  document.getElementById("home-cta-block").style.display    = hasFuel ? "none" : "block";
  document.getElementById("home-content-block").style.display= hasFuel ? "block" : "none";

  if (hasFuel) {
    const planos  = DATA.plano;
    const nextEl  = document.getElementById("home-next-manut");
    if (planos.length === 0) {
      nextEl.innerHTML = `<div class="list-row"><div class="row-body"><div class="row-sub" style="color:var(--text3)">Nenhum planejamento. <span style="color:var(--orange);cursor:pointer" onclick="navTo('plan')">Adicionar</span></div></div></div>`;
    } else {
      nextEl.innerHTML = planos.slice(0, 4).map(p => {
        let badge = "";
        if (p.intervaloKm && p.ultimaKm != null) {
          const diff = (p.ultimaKm + p.intervaloKm) - km;
          const pct  = ((km - p.ultimaKm) / p.intervaloKm) * 100;
          const txt  = diff < 0 ? "VENCIDA" : `${diff.toLocaleString("pt-BR")} km`;
          badge = `<span class="badge ${diff < 0 ? "badge-urgent" : pct >= 70 ? "badge-warn" : "badge-normal"}">${txt}</span>`;
        }
        return `<div class="next-manut-item"><div class="next-manut-left"><span class="next-manut-icon">⚙️</span><span class="next-manut-name">${p.item}</span></div>${badge}</div>`;
      }).join("");
    }

    const oils   = manut.filter(m => m.tipo === "oleo").sort((a, b) => b.km - a.km);
    const oilCard = document.getElementById("home-oil-card");
    if (oils.length > 0) {
      const last      = oils[0];
      const proxKm    = last.km + 15000;
      const diff      = proxKm - km;
      const pct       = Math.min(100, Math.max(0, ((km - last.km) / 15000) * 100));
      const color     = pct < 60 ? "pf-green" : pct < 80 ? "pf-yellow" : pct < 95 ? "pf-orange" : "pf-red";
      const textColor = pct < 60 ? "var(--green)" : pct < 80 ? "var(--yellow)" : pct < 95 ? "var(--orange)" : "var(--red)";
      oilCard.innerHTML = `
        <div class="oil-progress-header"><div class="oil-progress-title">Troca de Óleo</div><div class="oil-progress-pct" style="color:${textColor}">${Math.round(pct)}% do ciclo</div></div>
        <div class="oil-progress-sub">Próxima em ${proxKm.toLocaleString("pt-BR")} km</div>
        <div class="progress-bar"><div class="progress-fill ${color}" style="width:${pct}%"></div></div>
        <div class="oil-progress-footer">Última troca: ${fmtKM(last.km)} (${fmtDate(last.data)}) · Intervalo: 15.000 km</div>`;
    } else {
      oilCard.innerHTML = `<div style="font-size:13px;color:var(--text2)">Próxima em 15.000 km <span style="float:right;color:var(--green)">0% do ciclo</span></div>
        <div class="progress-bar" style="margin-top:8px"><div class="progress-fill pf-green" style="width:0%"></div></div>
        <div style="font-size:11px;color:var(--text3);margin-top:8px">Última troca: Não registrada · Intervalo: 15.000 km</div>`;
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  MANUAL
// ══════════════════════════════════════════════════════════════
const MANUAL = [
  { emoji:"🛢️", name:"Óleo & Filtros", bg:"rgba(234,179,8,0.12)", items:[{n:"Óleo do Motor (5W-30 ACEA C3)",i:"15.000 km ou 12 meses"},{n:"Filtro de Óleo",i:"15.000 km ou 12 meses"},{n:"Filtro de Ar do Motor",i:"30.000 km ou 24 meses"},{n:"Filtro de Combustível (Diesel)",i:"30.000 km ou 24 meses"},{n:"Filtro de Ar da Cabine (Pólen)",i:"20.000 km ou 12 meses"}]},
  { emoji:"⚙️", name:"Transmissão", bg:"rgba(59,130,246,0.12)", items:[{n:"Correia do Alternador / Acessórios",i:"60.000 km ou 4 anos"},{n:"Correia Dentada de Distribuição",i:"100.000 km ou 6 anos"},{n:"Tensor e Roda da Correia",i:"100.000 km ou 6 anos"},{n:"Óleo da Caixa de Câmbio Manual",i:"60.000 km ou 4 anos"}]},
  { emoji:"💧", name:"Motor & Arrefecimento", bg:"rgba(20,184,166,0.12)", items:[{n:"Líquido de Arrefecimento (Troca)",i:"60.000 km ou 4 anos"},{n:"Velas de Incandescência",i:"60.000 km"},{n:"Fluido da Direção Hidráulica",i:"Verificar a cada 30.000 km"},{n:"Filtro do DPF / FAP",i:"Verificar a cada 60.000 km"}]},
  { emoji:"🛑", name:"Sistema de Freios", bg:"rgba(239,68,68,0.12)", items:[{n:"Fluido de Freio DOT 4",i:"24 meses (independente de KM)"},{n:"Pastilhas Dianteiras",i:"Verificar a cada 30.000 km"},{n:"Pastilhas Traseiras",i:"Verificar a cada 40.000 km"},{n:"Discos de Freio",i:"Verificar a cada 60.000 km"}]},
  { emoji:"🔩", name:"Suspensão & Direção", bg:"rgba(168,85,247,0.12)", items:[{n:"Alinhamento e Balanceamento",i:"20.000 km ou ao trocar pneus"},{n:"Amortecedores",i:"Verificar a cada 60.000 km"},{n:"Rolamentos de Roda",i:"Verificar a cada 60.000 km"},{n:"Terminais de Direção",i:"Verificar a cada 40.000 km"}]},
  { emoji:"⚡", name:"Elétrica & Bateria", bg:"rgba(234,179,8,0.10)", items:[{n:"Bateria",i:"3 a 5 anos (verificar carga anualmente)"},{n:"Iluminação Geral",i:"Verificar a cada 20.000 km"}]},
  { emoji:"🔴", name:"Pneus (225/65 R16C)", bg:"rgba(239,68,68,0.10)", items:[{n:"Substituição (profundidade mín.)",i:"1,6 mm (mínimo legal)"},{n:"Rodízio de Pneus",i:"A cada 10.000 km"},{n:"Calibragem",i:"Mensal — 3,0 bar diant. / 3,5 bar tras."}]},
  { emoji:"📋", name:"Revisões Programadas", bg:"rgba(249,115,22,0.12)", items:[{n:"1ª Revisão",i:"15.000 km ou 12 meses"},{n:"2ª Revisão",i:"30.000 km ou 24 meses"},{n:"3ª Revisão",i:"45.000 km ou 36 meses"},{n:"4ª Revisão",i:"60.000 km ou 48 meses"},{n:"5ª Revisão",i:"75.000 km ou 60 meses"},{n:"6ª Revisão",i:"90.000 km ou 72 meses"}]},
];

function renderManual() {
  const el = document.getElementById("manual-content");
  el.innerHTML = MANUAL.map((sec, i) => `
    <div class="manual-group" id="mg-${i}">
      <div class="manual-group-header" onclick="toggleManual(${i})">
        <div class="manual-group-left">
          <div class="manual-group-icon" style="background:${sec.bg}">${sec.emoji}</div>
          <div><div class="manual-group-name">${sec.name}</div><div class="manual-group-count">${sec.items.length} itens</div></div>
        </div>
        <div class="manual-chevron">⌄</div>
      </div>
      <div class="manual-group-body">
        ${sec.items.map(item => `<div class="manual-row"><div class="manual-row-name">${item.n}</div><div class="manual-row-interval">${item.i}</div></div>`).join("")}
      </div>
    </div>
  `).join("");
}

function toggleManual(i) { document.getElementById("mg-" + i).classList.toggle("open"); }

// ══════════════════════════════════════════════════════════════
//  EXPOSE TO GLOBAL (called from HTML onclick)
// ══════════════════════════════════════════════════════════════
Object.assign(window, {
  loginGoogle, handleLogout, handleCreateVehicle, handleJoinVehicle,
  navTo, openModal, closeModal, overlayClose,
  saveKm, saveFuel, saveManut, savePlan, saveGasto,
  delFuel, delManut, delPlan, delGasto,
  calcFuelPreview, switchManutTab, setGastosPeriod, toggleManual,
});
