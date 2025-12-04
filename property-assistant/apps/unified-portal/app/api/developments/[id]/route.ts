import { NextRequest } from 'next/server';
import { 
  handleGetDevelopment, 
  handleUpdateDevelopment, 
  handleDeleteDevelopment 
} from '@openhouse/api/developments';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleGetDevelopment(req, params.id);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleUpdateDevelopment(req, params.id);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  return handleDeleteDevelopment(req, params.id);
}
