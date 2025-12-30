export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@openhouse/db/client';
import { admins } from '@openhouse/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const { email, preferredRole } = await req.json();
    
    if (!email || !preferredRole) {
      return NextResponse.json({ error: 'Email and preferredRole are required' }, { status: 400 });
    }
    
    try {
      await db.execute(sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS preferred_role VARCHAR(50)`);
    } catch (e) {
      console.log('Column may already exist:', e);
    }
    
    const result = await db.update(admins)
      .set({ preferred_role: preferredRole })
      .where(eq(admins.email, email))
      .returning({ email: admins.email, role: admins.role, preferred_role: admins.preferred_role });
    
    if (result.length === 0) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      admin: result[0],
      message: `Updated ${email} preferred_role to ${preferredRole}`
    });
  } catch (error: any) {
    console.error('Error updating preferred role:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
