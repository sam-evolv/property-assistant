import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getResendClient, sendOnboardingSubmissionNotification } from '@/lib/resend';

export const dynamic = 'force-dynamic';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      db: { schema: 'public' }
    }
  );
}

async function ensureOnboardingSubmissionsTable(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS onboarding_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        developer_id UUID,
        developer_email TEXT NOT NULL,
        developer_name TEXT,
        company_name TEXT,
        development_name TEXT NOT NULL,
        development_address TEXT NOT NULL,
        county TEXT NOT NULL,
        estimated_units INTEGER NOT NULL,
        expected_handover_date TIMESTAMPTZ,
        planning_reference TEXT,
        planning_pack_url TEXT,
        master_spreadsheet_url TEXT,
        supporting_documents_urls JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
  });
  
  if (error) {
    console.log('[OnboardingSubmit] Table creation RPC not available, table may already exist');
  }
}

async function ensureStorageBucket(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some(b => b.name === 'onboarding-files');
  
  if (!exists) {
    const { error } = await supabase.storage.createBucket('onboarding-files', {
      public: false,
      fileSizeLimit: 52428800, // 50MB
    });
    if (error && !error.message.includes('already exists')) {
      console.error('[OnboardingSubmit] Failed to create bucket:', error);
    }
  }
}

async function uploadFile(
  supabase: ReturnType<typeof getSupabaseAdmin>, 
  file: File, 
  submissionId: string,
  folder: string
): Promise<string | null> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `${submissionId}/${folder}/${timestamp}_${safeName}`;
  
  const { data, error } = await supabase.storage
    .from('onboarding-files')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
  
  if (error) {
    console.error('[OnboardingSubmit] File upload error:', error);
    return null;
  }
  
  return data?.path || null;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const authClient = createRouteHandlerClient({ cookies: () => cookieStore });
    const supabaseAdmin = getSupabaseAdmin();
    
    const { data: { session }, error: sessionError } = await authClient.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.error('[OnboardingSubmit] No valid session:', sessionError);
      return NextResponse.json({ error: 'Authentication required. Please log in again.' }, { status: 401 });
    }
    
    const user = session.user;
    const developerEmail = user.email || '';
    const developerName = user.user_metadata?.full_name || '';
    const companyName = user.user_metadata?.company_name || '';
    let tenantId = user.user_metadata?.tenant_id || '';
    let developerId = null;
    
    const { data: admin } = await supabaseAdmin
      .from('admins')
      .select('id, tenant_id')
      .eq('email', developerEmail)
      .single();
    
    if (admin) {
      developerId = admin.id;
      tenantId = tenantId || admin.tenant_id;
    }
    
    if (!tenantId) {
      console.error('[OnboardingSubmit] SECURITY: No tenant context for user:', developerEmail);
      return NextResponse.json({ error: 'No tenant context. Please complete signup first.' }, { status: 403 });
    }
    
    await ensureStorageBucket(supabaseAdmin);
    
    const formData = await request.formData();
    
    const developmentName = formData.get('developmentName') as string;
    const developmentAddress = formData.get('developmentAddress') as string;
    const county = formData.get('county') as string;
    const estimatedUnits = parseInt(formData.get('estimatedUnits') as string);
    const expectedHandoverDate = formData.get('expectedHandoverDate') as string;
    const planningReference = formData.get('planningReference') as string;
    const planningPackUrl = formData.get('planningPackUrl') as string;
    const notes = formData.get('notes') as string;
    
    if (!developmentName || !developmentAddress || !county || !estimatedUnits) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    const submissionId = crypto.randomUUID();
    
    let masterSpreadsheetUrl: string | null = null;
    const masterFile = formData.get('masterSpreadsheet') as File | null;
    if (masterFile && masterFile.size > 0) {
      masterSpreadsheetUrl = await uploadFile(supabaseAdmin, masterFile, submissionId, 'spreadsheet');
    }
    
    const supportingDocsUrls: string[] = [];
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (key.startsWith('supportingDoc_') && value instanceof File && value.size > 0) {
        const url = await uploadFile(supabaseAdmin, value, submissionId, 'documents');
        if (url) supportingDocsUrls.push(url);
      }
    }
    
    const { data: submission, error: insertError } = await supabaseAdmin
      .from('onboarding_submissions')
      .insert({
        id: submissionId,
        tenant_id: tenantId,
        developer_id: developerId,
        developer_email: developerEmail || 'unknown@email.com',
        developer_name: developerName,
        company_name: companyName,
        development_name: developmentName,
        development_address: developmentAddress,
        county,
        estimated_units: estimatedUnits,
        expected_handover_date: expectedHandoverDate || null,
        planning_reference: planningReference || null,
        planning_pack_url: planningPackUrl || null,
        master_spreadsheet_url: masterSpreadsheetUrl,
        supporting_documents_urls: supportingDocsUrls,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[OnboardingSubmit] Insert error:', insertError);
      
      if (insertError.code === '42P01') {
        return NextResponse.json({ 
          error: 'Database table not ready. Please contact support.' 
        }, { status: 500 });
      }
      
      return NextResponse.json({ error: 'Failed to save submission' }, { status: 500 });
    }
    
    try {
      await sendOnboardingSubmissionNotification({
        developerEmail,
        developerName,
        companyName,
        developmentName,
        developmentAddress,
        county,
        estimatedUnits,
        expectedHandoverDate,
        planningReference,
        planningPackUrl,
        notes,
        hasSpreadsheet: !!masterSpreadsheetUrl,
        supportingDocsCount: supportingDocsUrls.length,
      });
    } catch (emailError) {
      console.error('[OnboardingSubmit] Email notification failed:', emailError);
    }
    
    return NextResponse.json({ 
      success: true, 
      submissionId: submission.id,
      message: 'Submission received successfully' 
    });
    
  } catch (error) {
    console.error('[OnboardingSubmit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
