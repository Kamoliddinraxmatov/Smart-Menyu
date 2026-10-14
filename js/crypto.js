// Shifrlash yordamchilari (brauzerning o'z WebCrypto'si, tashqi kutubxonasiz).
//  - Restoran ma'lumotlari: AES-GCM 256 (har restoranga alohida kalit)
//  - Ruxsatnoma (litsenziya): egasining ECDSA P-256 imzosi
//  - Restoran kalitini planshetga yetkazish: ECDH P-256 (planshetning shaxsiy kaliti hech qachon chiqmaydi)
const C = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64 = (buf) => {
  const a = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
  return btoa(s);
};
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// --- AES-GCM ---
export async function genDataKey() {
  return b64(rand(32));
}
export function importDataKey(raw) {
  return C.importKey("raw", unb64(raw), "AES-GCM", false, ["encrypt", "decrypt"]);
}
// Natija: "iv.ct" (base64). AAD sifatida mavzu nomi: shifrlangan xabarni boshqa mavzuga ko'chirib bo'lmaydi.
export async function seal(key, text, aad = "") {
  const iv = rand(12);
  const ct = await C.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, enc.encode(text));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function open(key, sealed, aad = "") {
  const [iv, ct] = String(sealed).split(".");
  if (!iv || !ct) throw new Error("format");
  const pt = await C.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(aad) }, key, unb64(ct));
  return dec.decode(pt);
}

// --- Imzo (ECDSA P-256) ---
const SIG = { name: "ECDSA", namedCurve: "P-256" };
const SIGN_ALG = { name: "ECDSA", hash: "SHA-256" };
export function importVerifyKey(jwk) {
  return C.importKey("jwk", jwk, SIG, false, ["verify"]);
}
export function importSignKey(jwk) {
  return C.importKey("jwk", jwk, SIG, false, ["sign"]);
}
export async function sign(privKey, text) {
  return b64(await C.sign(SIGN_ALG, privKey, enc.encode(text)));
}
export async function verify(pubKey, text, sig) {
  try { return await C.verify(SIGN_ALG, pubKey, unb64(sig), enc.encode(text)); } catch { return false; }
}

// --- Parol bilan himoyalash (egasining kaliti uchun) ---
export async function passKey(password, salt, iterations = 310000) {
  const base = await C.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return C.deriveKey({ name: "PBKDF2", salt: typeof salt === "string" ? unb64(salt) : salt, iterations, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// --- ECDH: restoran kalitini aniq bir planshet uchun "o'rash" ---
const DH = { name: "ECDH", namedCurve: "P-256" };
export function genDeviceKeys() {
  return C.generateKey(DH, false, ["deriveKey"]); // shaxsiy kalit eksport qilinmaydi
}
export function exportPub(pub) {
  return C.exportKey("jwk", pub).then(({ kty, crv, x, y }) => ({ kty, crv, x, y }));
}
async function wrapKey(privKey, pubJwk) {
  const pub = await C.importKey("jwk", pubJwk, DH, false, []);
  return C.deriveKey({ name: "ECDH", public: pub }, privKey, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
// Egasi tomoni: bir martalik (ephemeral) kalit bilan har planshetga o'rash
export async function newEphemeral() {
  const kp = await C.generateKey(DH, true, ["deriveKey"]);
  return { priv: kp.privateKey, pub: await exportPub(kp.publicKey) };
}
export async function wrapFor(ephPriv, devicePubJwk, rawKey, aad) {
  return seal(await wrapKey(ephPriv, devicePubJwk), rawKey, aad);
}
// Planshet tomoni
export async function unwrapWith(devicePriv, ephPubJwk, wrapped, aad) {
  return open(await wrapKey(devicePriv, ephPubJwk), wrapped, aad);
}

// Planshet kodi: ochiq kalitning qisqa "barmoq izi" (masalan 4F2K-9QZT)
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export async function fingerprint(pubJwk) {
  const h = new Uint8Array(await C.digest("SHA-256", enc.encode(`${pubJwk.x}.${pubJwk.y}`)));
  let bits = 0, val = 0, out = "";
  for (const b of h) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5 && out.length < 8) { out += B32[(val >> (bits - 5)) & 31]; bits -= 5; }
    if (out.length >= 8) break;
  }
  return out;
}
export const prettyId = (id) => `${id.slice(0, 4)}-${id.slice(4, 8)}`;

// --- Qurilma kaliti IndexedDB'da (localStorage'dan farqli, CryptoKey'ni eksport qilib bo'lmaydigan holda saqlaydi) ---
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("smartmenyu", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
export async function kvGet(k) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("kv").objectStore("kv").get(k);
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}
export async function kvSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").put(v, k);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
export async function kvDel(k) {
  const db = await idb();
  return new Promise((res) => {
    const tx = db.transaction("kv", "readwrite");
    tx.objectStore("kv").delete(k);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}
