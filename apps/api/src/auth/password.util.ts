import { BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

// Strong-ish password policy (closes L1): min length + basic complexity.
export function assertStrongPassword(password: string): void {
  if (typeof password !== 'string' || password.length < 12) {
    throw new BadRequestException('Password must be at least 12 characters.');
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    throw new BadRequestException('Password must contain letters and numbers.');
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const TEMP_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const TEMP_LOWER = 'abcdefghjkmnpqrstuvwxyz';
const TEMP_DIGITS = '23456789';
const TEMP_SYMBOLS = '!@#$%&*+-=?';

/** Generates a cryptographically random, manually shareable temporary password. */
export function generateTemporaryPassword(length = 16): string {
  if (length < 12) {
    throw new Error('Temporary password length must be at least 12 characters.');
  }

  const all = TEMP_UPPER + TEMP_LOWER + TEMP_DIGITS + TEMP_SYMBOLS;
  const pick = (chars: string) => chars[randomBytes(1)[0]! % chars.length]!;

  const chars = [
    pick(TEMP_UPPER),
    pick(TEMP_LOWER),
    pick(TEMP_DIGITS),
    pick(TEMP_SYMBOLS),
    ...Array.from({ length: length - 4 }, () => pick(all)),
  ];

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomBytes(1)[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join('');
}
