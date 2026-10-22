import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is not set (or is too short). Set a random 32+ character secret in your .env file — ' +
      'generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))"'
    );
  }
  return secret;
}

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  name: string;
  /** User.tokenVersion when the token was made; a reset or removal bumps it so old tokens stop working. */
  tv?: number;
  /** Session id: signing out records it in RevokedSession so this token stops working. Set by signToken. */
  jti?: string;
  /** Expiry (seconds since epoch), set by jsonwebtoken. */
  exp?: number;
  iat?: number;
}

// Web keeps the original 7-day cookie-only token. Mobile access tokens are
// short-lived (see src/lib/auth/refreshToken.ts) since they're paired with
// a long-lived refresh token instead.
export function signToken(payload: JwtPayload, expiresIn: string = '7d') {
  // Never copy jti/exp/iat from an older payload: each token gets its own.
  const { jti: _jti, exp: _exp, iat: _iat, ...claims } = payload;
  void _jti;
  void _exp;
  void _iat;
  return jwt.sign(claims, getSecret(), { expiresIn, jwtid: randomUUID() } as jwt.SignOptions);
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, getSecret()) as JwtPayload;
  } catch {
    return null;
  }
}
