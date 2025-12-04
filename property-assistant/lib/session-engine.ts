import { SignJWT, jwtVerify } from 'jose';
import { UserRole } from './tenancy-context';

const JWT_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || 'openhouse-ai-session-secret-change-in-production'
);

const JWT_ALG = 'HS256';
const JWT_EXPIRY = '7d';

export interface SessionPayload {
  tenant_id: string;
  development_id?: string;
  unit_id?: string;
  house_type_code?: string;
  role: UserRole;
  user_id: string;
  email: string;
  impersonated_by?: string;
  iat?: number;
  exp?: number;
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const jwt = await new SignJWT(payload as Record<string, any>)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  return jwt;
}

export async function verifySession(token: string): Promise<SessionPayload> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET, {
      algorithms: [JWT_ALG],
    });

    return verified.payload as SessionPayload;
  } catch (error) {
    throw new Error('Invalid or expired session token');
  }
}

export async function refreshSession(token: string): Promise<string> {
  const payload = await verifySession(token);
  
  const { iat, exp, ...rest } = payload;
  
  return signSession(rest);
}

export function extractSessionFromCookie(cookieString: string, cookieName: string = 'session'): string | null {
  const cookies = cookieString.split(';').map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith(`${cookieName}=`));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1];
}

export function createSessionCookie(token: string, options: { 
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  path?: string;
} = {}): string {
  const {
    maxAge = 60 * 60 * 24 * 7,
    secure = process.env.NODE_ENV === 'production',
    httpOnly = true,
    sameSite = 'lax',
    path = '/',
  } = options;

  const parts = [
    `session=${token}`,
    `Max-Age=${maxAge}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ];

  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');

  return parts.join('; ');
}

export function deleteSessionCookie(): string {
  return `session=; Max-Age=0; Path=/; SameSite=lax`;
}

export async function createImpersonationSession(
  originalPayload: SessionPayload,
  impersonatorId: string
): Promise<string> {
  return signSession({
    ...originalPayload,
    impersonated_by: impersonatorId,
  });
}
