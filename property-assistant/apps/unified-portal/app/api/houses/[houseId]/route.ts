import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/supabase-server';
import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { houseId: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const houseId = params.houseId;
    const body = await request.json();

    const existingHouse = await db.query.units.findFirst({
      where: eq(units.id, houseId),
      with: {
        development: true,
      },
    });

    if (!existingHouse) {
      return NextResponse.json({ error: 'House not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && existingHouse.development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updateData: any = {};
    
    if (body.unit_number !== undefined) updateData.unit_number = body.unit_number;
    if (body.address_line_1 !== undefined) updateData.address_line_1 = body.address_line_1;
    if (body.address_line_2 !== undefined) updateData.address_line_2 = body.address_line_2;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state_province !== undefined) updateData.state_province = body.state_province;
    if (body.postal_code !== undefined) updateData.postal_code = body.postal_code;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.house_type_code !== undefined) updateData.house_type_code = body.house_type_code;
    if (body.bedrooms !== undefined) updateData.bedrooms = body.bedrooms;
    if (body.bathrooms !== undefined) updateData.bathrooms = body.bathrooms;
    if (body.square_footage !== undefined) updateData.square_footage = body.square_footage;
    if (body.purchaser_name !== undefined) updateData.purchaser_name = body.purchaser_name;
    if (body.purchaser_email !== undefined) updateData.purchaser_email = body.purchaser_email;
    if (body.purchaser_phone !== undefined) updateData.purchaser_phone = body.purchaser_phone;
    if (body.purchase_date !== undefined) updateData.purchase_date = body.purchase_date;
    if (body.move_in_date !== undefined) updateData.move_in_date = body.move_in_date;

    updateData.updated_at = new Date().toISOString();

    await db
      .update(units)
      .set(updateData)
      .where(eq(units.id, houseId));

    const updatedHouse = await db.query.units.findFirst({
      where: eq(units.id, houseId),
    });

    return NextResponse.json({ house: updatedHouse });
  } catch (error) {
    console.error('[House Update Error]:', error);
    return NextResponse.json(
      { error: 'Failed to update house' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { houseId: string } }
) {
  try {
    const session = await requireRole(['developer', 'super_admin']);
    const houseId = params.houseId;

    const existingHouse = await db.query.units.findFirst({
      where: eq(units.id, houseId),
      with: {
        development: true,
      },
    });

    if (!existingHouse) {
      return NextResponse.json({ error: 'House not found' }, { status: 404 });
    }

    if (session.role !== 'super_admin' && existingHouse.development.tenant_id !== session.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await db.delete(units).where(eq(units.id, houseId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[House Delete Error]:', error);
    return NextResponse.json(
      { error: 'Failed to delete house' },
      { status: 500 }
    );
  }
}
