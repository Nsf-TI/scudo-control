// ══════════════════════════════════════════════════════════════
//  SCUDO CONTROL — Camada de Persistência (Firestore)
//  Substitui o antigo objeto localStorage DB
//  Interface: RemoteDB.{addFuel, listFuel, setState, getState, ...}
// ══════════════════════════════════════════════════════════════

import {
  getFirestore,
  doc, collection,
  getDoc, setDoc, addDoc, deleteDoc,
  onSnapshot,
  query, orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _db   = null;   // Firestore instance
let _vid  = null;   // current vehicleId

// Chamado pelo app.js após login + seleção de veículo
export function initDB(firestoreInstance, vehicleId) {
  _db  = firestoreInstance;
  _vid = vehicleId;
}

// ── helpers ─────────────────────────────────────────────────
function vehicleRef()           { return doc(_db, "vehicles", _vid); }
function col(name)              { return collection(_db, "vehicles", _vid, name); }
function docRef(name, id)       { return doc(_db, "vehicles", _vid, name, id); }

// ── STATE (km, placa) ────────────────────────────────────────
export async function getState() {
  const snap = await getDoc(vehicleRef());
  return snap.exists() ? (snap.data().state || {}) : {};
}

export async function setState(data) {
  await setDoc(vehicleRef(), { state: data }, { merge: true });
}

// ── GENERICS ─────────────────────────────────────────────────
async function addItem(colName, data) {
  const ref = await addDoc(col(colName), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

async function deleteItem(colName, id) {
  await deleteDoc(docRef(colName, id));
}

async function listItems(colName, orderField = "data") {
  // Usado apenas em leituras pontuais (o app usa onSnapshot)
  const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const q = query(col(colName), orderBy(orderField, "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── FUEL ─────────────────────────────────────────────────────
export const addFuel    = (data) => addItem("fuel",  data);
export const deleteFuel = (id)   => deleteItem("fuel", id);
export const listFuel   = ()     => listItems("fuel", "data");

// ── MANUT ────────────────────────────────────────────────────
export const addManut    = (data) => addItem("manut",  data);
export const deleteManut = (id)   => deleteItem("manut", id);
export const listManut   = ()     => listItems("manut", "data");

// ── PLANO ────────────────────────────────────────────────────
export const addPlano    = (data) => addItem("plano",  data);
export const deletePlano = (id)   => deleteItem("plano", id);
export const listPlano   = ()     => listItems("plano", "createdAt");

// ── GASTOS ───────────────────────────────────────────────────
export const addGasto    = (data) => addItem("gastos",  data);
export const deleteGasto = (id)   => deleteItem("gastos", id);
export const listGastos  = ()     => listItems("gastos", "data");

// ── REALTIME LISTENERS ───────────────────────────────────────
// Retorna função de unsubscribe. callback recebe array de docs.
export function onFuel(callback) {
  const q = query(col("fuel"), orderBy("data", "desc"));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function onManut(callback) {
  const q = query(col("manut"), orderBy("data", "desc"));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function onPlano(callback) {
  const q = query(col("plano"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function onGastos(callback) {
  const q = query(col("gastos"), orderBy("data", "desc"));
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

export function onState(callback) {
  return onSnapshot(vehicleRef(), snap => {
    if (snap.exists()) callback(snap.data().state || {});
  });
}

// ── VEHICLE MANAGEMENT ───────────────────────────────────────
import {
  setDoc as _setDoc,
  doc    as _doc,
  getDoc as _getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Gera código legível tipo SCU-83K2
function genVehicleId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "SCU-";
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

export async function createVehicle(db, uid, vehicleName) {
  const vid = genVehicleId();
  await setDoc(doc(db, "vehicles", vid), {
    name:      vehicleName,
    ownerUid:  uid,
    members:   { [uid]: true },
    createdAt: serverTimestamp(),
    state:     {}
  });
  return vid;
}

export async function joinVehicle(db, uid, vid) {
  const ref = doc(db, "vehicles", vid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Código de veículo não encontrado.");
  await updateDoc(ref, { [`members.${uid}`]: true });
  return snap.data();
}

export async function getVehicleInfo(db, vid) {
  const snap = await getDoc(doc(db, "vehicles", vid));
  if (!snap.exists()) return null;
  return { id: vid, ...snap.data() };
}
