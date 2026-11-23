import crypto from 'node:crypto';
import { PLATFORM_CONFIG } from '../shared/config.ts';
import type { SettingDef } from '../shared/GameModule.ts';

export function stripHtml(input: string): string {
  return input.replace(/[<>]/g, '').trim();
}

export function sanitizeNickname(raw: unknown, existingNames: string[]): string {
  let clean = stripHtml(String(raw ?? '')).slice(0, PLATFORM_CONFIG.limits.nicknameMax);
  if (clean.length < PLATFORM_CONFIG.limits.nicknameMin) {
    clean = `Player${Math.floor(100 + Math.random() * 900)}`;
  }
  const lowerExisting = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!lowerExisting.has(clean.toLowerCase())) {
    return clean;
  }
  let suffix = 2;
  while (suffix < 99) {
    const candidate = `${clean.slice(0, PLATFORM_CONFIG.limits.nicknameMax - 4)} (${suffix})`;
    if (!lowerExisting.has(candidate.toLowerCase())) {
      return candidate;
    }
    suffix += 1;
  }
  return `${clean.slice(0, 10)}${Math.floor(10 + Math.random() * 89)}`;
}

export function sanitizeRoomName(raw: unknown, hostNickname: string): string {
  const clean = stripHtml(String(raw ?? '')).slice(0, PLATFORM_CONFIG.limits.roomNameMax);
  if (clean.length < PLATFORM_CONFIG.limits.roomNameMin) {
    return `${hostNickname}'s room`.slice(0, PLATFORM_CONFIG.limits.roomNameMax);
  }
  return clean;
}

export function filterChatText(raw: unknown): string {
  let clean = stripHtml(String(raw ?? '')).slice(0, PLATFORM_CONFIG.limits.chatMaxChars);
  for (const word of PLATFORM_CONFIG.chatFilterWords) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    clean = clean.replace(re, '***');
  }
  return clean;
}

export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return true;
  if (!password) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

export function clampSettingValue(def: SettingDef, raw: unknown): unknown {
  if (def.type === 'boolean') {
    return Boolean(raw);
  }
  if (def.type === 'number') {
    const num = Number(raw);
    if (Number.isNaN(num)) return def.defaultValue;
    const min = def.min ?? -Infinity;
    const max = def.max ?? Infinity;
    return Math.max(min, Math.min(max, num));
  }
  if (def.type === 'select' && def.options) {
    const found = def.options.find((o) => o.value === raw || String(o.value) === String(raw));
    return found ? found.value : def.defaultValue;
  }
  return raw ?? def.defaultValue;
}
