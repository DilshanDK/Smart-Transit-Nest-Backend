import * as crypto from 'crypto';

/**
 * Generates a cryptographically secure random uppercase alphanumeric string
 * @param length The length of the random string component
 */
export function generateShortId(length: number = 6): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}
