import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// Простое файловое хранилище пользователей: data/users.json.
// Подходит для одного сервера / одного контейнера с примонтированной папкой data.
// Для нескольких серверов замените функции readUsers/writeUsers на вашу БД.

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COOKIE = 'ps_session';
const MAX_AGE = 60 * 60 * 24 * 30;

let chain = Promise.resolve();
function locked(fn) {
  const r = chain.then(fn, fn);
  chain = r.catch(() => {});
  return r;
}

async function readUsers() {
  try { return JSON.parse(await fs.readFile(USERS_FILE, 'utf8')); } catch { return []; }
}
async function writeUsers(list) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${USERS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), { mode: 0o600 });
  await fs.rename(tmp, USERS_FILE);
}

let secretCache;
async function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (secretCache) return secretCache;
  const file = path.join(DATA_DIR, 'secret.key');
  try { secretCache = (await fs.readFile(file, 'utf8')).trim(); } catch {}
  if (!secretCache) {
    secretCache = crypto.randomBytes(32).toString('hex');
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, secretCache, { mode: 0o600 });
  }
  return secretCache;
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

export const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254;

export function publicUser(u) {
  return { id: u.id, email: u.email, created: u.created };
}

export function registerUser(email, password) {
  return locked(async () => {
    const users = await readUsers();
    if (users.some((u) => u.email === email)) {
      const err = new Error('Пользователь с такой почтой уже зарегистрирован');
      err.code = 'EXISTS';
      throw err;
    }
    const user = { id: crypto.randomUUID(), email, hash: hashPassword(password), created: new Date().toISOString() };
    users.push(user);
    await writeUsers(users);
    return user;
  });
}

export async function loginUser(email, password) {
  const users = await readUsers();
  const user = users.find((u) => u.email === email);
  // выполняем хеширование даже для несуществующего пользователя, чтобы не выдавать наличие аккаунта по времени
  const ok = checkPassword(password, user ? user.hash : hashPassword('dummy-password'));
  return user && ok ? user : null;
}

export async function findUser(id) {
  return (await readUsers()).find((u) => u.id === id) || null;
}

/* ── Сессионный cookie ── */
async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export async function sessionCookie(user, req) {
  const token = await sign({ uid: user.id, exp: Date.now() + MAX_AGE * 1000 });
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isHttps(req) ? '; Secure' : ''}`;
}
export function clearCookie(req) {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps(req) ? '; Secure' : ''}`;
}
function isHttps(req) {
  return (req.headers.get('x-forwarded-proto') || new URL(req.url).protocol.replace(':', '')) === 'https';
}

export async function getSessionUser(req) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [body, mac] = m[1].split('.');
  if (!body || !mac) return null;
  const expected = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!uid || exp < Date.now()) return null;
    return await findUser(uid);
  } catch { return null; }
}

/* ── Ограничитель частоты запросов (в памяти процесса) ── */
const buckets = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 10000) buckets.clear();
  return arr.length > max;
}
export const clientIp = (req) => (req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();

export async function readJson(req) {
  if (!(req.headers.get('content-type') || '').includes('application/json')) return null;
  try { return await req.json(); } catch { return null; }
}
