import bcrypt from 'bcryptjs';

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword);
}

// A real bcrypt hash of a random string, made once. Comparing against it when
// the email is unknown (or has no password) takes as long as a real check, so
// response times don't reveal which emails have accounts.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash(`no-account-${Math.random()}`, 12);
  await bcrypt.compare(password, await dummyHash);
}
