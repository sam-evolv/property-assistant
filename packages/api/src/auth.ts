import { NextRequest, NextResponse } from 'next/server';

export function verifyAdminAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.warn('⚠️  ADMIN_API_KEY not set. Admin endpoints are UNPROTECTED!');
    return true;
  }

  if (!authHeader) {
    return false;
  }

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === adminKey;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: 'Unauthorized. Admin access required.' },
    { status: 401 }
  );
}
