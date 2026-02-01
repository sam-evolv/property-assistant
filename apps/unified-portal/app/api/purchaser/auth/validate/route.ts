import { NextRequest, NextResponse } from 'next/server';
import { signQRToken } from '@openhouse/api/qr-tokens';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 60000;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (record) {
    if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
      failedAttempts.delete(ip);
      return true;
    }
    if (record.count >= RATE_LIMIT_MAX) {
      return false;
    }
  }
  return true;
}

function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  
  if (record) {
    if (now - record.lastAttempt > RATE_LIMIT_WINDOW) {
      failedAttempts.set(ip, { count: 1, lastAttempt: now });
    } else {
      record.count++;
      record.lastAttempt = now;
    }
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: now });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  
  if (!checkRateLimit(ip)) {
    console.log('[Purchaser Auth] Rate limited IP:', ip);
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment and try again.' },
      { status: 429 }
    );
  }
  
  try {
    const body = await req.json();
    const { code, accessCode } = body;
    const inputCode = code || accessCode;

    if (!inputCode || typeof inputCode !== 'string') {
      return NextResponse.json(
        { error: 'Please enter your OpenHouse code' },
        { status: 400 }
      );
    }

    const trimmedCode = inputCode.trim().toUpperCase();
    
    if (trimmedCode.length < 3) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: 'Invalid code. Please check and try again.' },
        { status: 400 }
      );
    }

    console.log('[Purchaser Auth] Validating code');

    const supabase = getSupabaseAdmin();
    let unit: any = null;
    let handoverDate: string | null = null;

    // NEW SECURE FORMAT: XX-NNN-XXXX (e.g., AV-001-ACF7, RP-017-7363)
    const secureCodePattern = /^[A-Z]{2,3}-\d{3}-[A-Z0-9]{4}$/;
    
    // LEGACY FORMAT: PREFIX-NNN (e.g., LV-PARK-001, RA-PARK-017)
    const legacyCodePattern = /^([A-Z]+-[A-Z]+)-(\d{1,3})$/;

    // Try direct lookup by unit_uid first (this is the access code in XX-NNN-XXXX format)
    const { data: directUnit, error: directError } = await supabase
      .from('units')
      .select(`
        id, 
        project_id,
        development_id,
        tenant_id,
        unit_uid,
        address, 
        purchaser_name, 
        house_type_code, 
        bedrooms, 
        bathrooms,
        handover_date
      `)
      .eq('unit_uid', trimmedCode)
      .single();
    
    if (directError && directError.code !== 'PGRST116') {
      console.log('[Purchaser Auth] unit_uid lookup error:', directError.message);
    }
    
    if (directUnit && !directError) {
      console.log('[Purchaser Auth] Found unit by unit_uid:', directUnit.unit_uid);
      
      // Fetch project name separately if needed
      let devName = 'Unknown';
      const devId = directUnit.development_id || directUnit.project_id;
      if (directUnit.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', directUnit.project_id)
          .single();
        if (project) devName = project.name;
      }
      
      handoverDate = directUnit.handover_date;
      
      unit = {
        id: directUnit.id,
        development_id: devId,
        address: directUnit.address,
        purchaser_name: directUnit.purchaser_name,
        tenant_id: directUnit.tenant_id,
        development_name: devName,
        house_type_code: directUnit.house_type_code,
        bedrooms: directUnit.bedrooms,
        bathrooms: directUnit.bathrooms,
        unit_uid: directUnit.unit_uid,
      };
    }
    
    if (!unit && legacyCodePattern.test(trimmedCode)) {
      // Legacy format fallback
      const legacyMatch = trimmedCode.match(legacyCodePattern);
      if (legacyMatch) {
        const [, prefix, unitNumStr] = legacyMatch;
        const unitNum = parseInt(unitNumStr, 10);
        
        const prefixToProjectName: Record<string, string> = {
          'LV-PARK': 'Longview Park',
          'RA-PARK': 'Rathard Park',
          'RA-LAWN': 'Rathard Lawn',
          'OH-PARK': 'OpenHouse Park',
        };
        
        const expectedProjectName = prefixToProjectName[prefix];
        if (expectedProjectName) {
          const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('id, name')
            .ilike('name', expectedProjectName)
            .single();
          
          if (projectData && !projectError) {
            const { data: projectUnits } = await supabase
              .from('units')
              .select('id, project_id, address, purchaser_name, house_type_code, bedrooms, bathrooms, unit_uid, handover_date')
              .eq('project_id', projectData.id);
            
            const matchedUnit = projectUnits?.find((u: any) => {
              const addr = u.address?.trim();
              if (!addr) return false;
              
              if (/^\d+$/.test(addr)) {
                return parseInt(addr, 10) === unitNum;
              }
              
              const unitMatch = addr.match(/^Unit\s+(\d+)/i);
              if (unitMatch) {
                return parseInt(unitMatch[1], 10) === unitNum;
              }
              
              const addrMatch = addr.match(/^(\d+)\s/);
              return addrMatch && parseInt(addrMatch[1], 10) === unitNum;
            });
            
            if (matchedUnit) {
              console.log('[Purchaser Auth] Found unit by legacy code match');
              handoverDate = matchedUnit.handover_date;
              
              unit = {
                id: matchedUnit.id,
                development_id: matchedUnit.project_id,
                address: matchedUnit.address,
                purchaser_name: matchedUnit.purchaser_name,
                tenant_id: projectData.id,
                development_name: projectData.name,
                house_type_code: matchedUnit.house_type_code,
                bedrooms: matchedUnit.bedrooms,
                bathrooms: matchedUnit.bathrooms,
                unit_uid: matchedUnit.unit_uid || trimmedCode,
              };
            }
          }
        }
      }
    }

    if (!unit) {
      recordFailedAttempt(ip);
      console.log('[Purchaser Auth] Code not found');
      return NextResponse.json(
        { error: 'Invalid code. Please check and try again.' },
        { status: 404 }
      );
    }

    console.log('[Purchaser Auth] Valid code for unit:', unit.id, 'Development:', unit.development_name);

    const tokenResult = signQRToken({
      supabaseUnitId: unit.id,
      projectId: unit.development_id,
    });

    // Determine portal type based on handover status
    // If handover_date exists and is in the past, grant Purchaser Assistant (Property Assistant)
    // Otherwise grant Pre-Handover Portal
    const now = new Date();
    const isHandedOver = handoverDate ? new Date(handoverDate) <= now : false;
    const portalType = isHandedOver ? 'property_assistant' : 'pre_handover';
    
    console.log('[Purchaser Auth] Handover date:', handoverDate, '| Is handed over:', isHandedOver, '| Portal type:', portalType);

    const sessionData = {
      unitId: unit.id,
      unitUid: unit.unit_uid || trimmedCode,
      accessCode: unit.unit_uid || trimmedCode,
      developmentId: unit.development_id,
      developmentName: unit.development_name,
      developmentLogoUrl: null,
      purchaserName: unit.purchaser_name || 'Homeowner',
      address: unit.address || '',
      houseType: unit.house_type_code || '',
      bedrooms: unit.bedrooms || null,
      bathrooms: unit.bathrooms || null,
      latitude: null,
      longitude: null,
      token: tokenResult.token,
      handoverDate: handoverDate,
      isHandedOver: isHandedOver,
      portalType: portalType,
    };

    return NextResponse.json({
      success: true,
      session: sessionData,
      portalType: portalType,
    });
  } catch (error: any) {
    console.error('[Purchaser Auth] Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
