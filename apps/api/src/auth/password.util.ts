import { BadRequestException } from '@nestjs/common';
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
