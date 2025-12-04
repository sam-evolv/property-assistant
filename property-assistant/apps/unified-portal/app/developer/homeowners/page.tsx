import { requireRole } from '@/lib/supabase-server';
import { HomeownersList } from './list';
import { redirect } from 'next/navigation';
import { db } from '@openhouse/db/client';
import { units, developments } from '@openhouse/db/schema';
import { eq } from 'drizzle-orm';

export default async function HomeownersPage({ 
  searchParams 
}: { 
  searchParams: { developmentId?: string } 
}) {
  let session;
  
  try {
    session = await requireRole(['developer', 'super_admin']);
  } catch {
    redirect('/unauthorized');
  }

  let unitsData: any[] = [];
  let developmentData: any = null;
  
  try {
    if (searchParams.developmentId) {
      // Fetch units for specific development
      unitsData = await db.query.units.findMany({
        where: eq(units.development_id, searchParams.developmentId),
        with: { development: true }
      });
      
      // Fetch development info for important docs version
      const devResult = await db.query.developments.findFirst({
        where: eq(developments.id, searchParams.developmentId)
      });
      developmentData = devResult;
    } else {
      // Fetch all units for this tenant (includes all 75 residents)
      unitsData = await db.query.units.findMany({
        where: eq(units.tenant_id, session.tenantId),
        with: { development: true }
      });
      
      // Get the first development for version info (assuming single development)
      if (unitsData.length > 0 && unitsData[0].development) {
        developmentData = unitsData[0].development;
      }
    }
  } catch (error) {
    console.error('Failed to fetch units:', error);
  }

  return (
    <HomeownersList 
      session={session} 
      homeowners={unitsData} 
      development={developmentData}
      developmentId={searchParams.developmentId} 
    />
  );
}
