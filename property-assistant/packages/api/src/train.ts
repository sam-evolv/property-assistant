import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, unauthorizedResponse } from './auth';
import { resolveTenantFromRequest } from './tenancy';
import { trainFromFile, getTenantJobs } from './train/index';
import { db } from '@openhouse/db/client';
import { sql } from 'drizzle-orm';
import { trainRateLimiter, getRateLimitKey } from './rate-limiter';
import { logger } from './logger';

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILE_COUNT = 10;
const MAX_CONCURRENT_TRAININGS = 2;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'application/json',
  'text/plain',
];

export async function handleTrainRequest(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    if (!verifyAdminAuth(req)) {
      return unauthorizedResponse();
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📥 TRAIN API - POST REQUEST RECEIVED');
    console.log('='.repeat(80));
    
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    console.log('FILES RECEIVED:', files.length);
    console.log('FILE DETAILS:', files.map(f => ({ 
      name: f.name, 
      size: f.size, 
      type: f.type 
    })));
    
    const developmentId = formData.get('developmentId') as string | null;
    
    if (!developmentId) {
      console.error('❌ No developmentId provided');
      return new Response(JSON.stringify({ error: 'developmentId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const devCheck = await db.execute<{ tenant_id: string }>(sql`
      SELECT tenant_id FROM developments WHERE id = ${developmentId}::uuid LIMIT 1
    `);
    
    if (!devCheck.rows || devCheck.rows.length === 0) {
      console.error('❌ Development not found');
      return new Response(JSON.stringify({ error: 'Development not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const tenantId = devCheck.rows[0].tenant_id as string;
    
    if (!tenantId) {
      console.error('❌ Development has no tenant_id');
      return new Response(JSON.stringify({ error: 'Development has no associated tenant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const rateLimitKey = getRateLimitKey(tenantId, 'train');
    const rateLimitResult = await trainRateLimiter.check(rateLimitKey);
    
    if (!rateLimitResult.allowed) {
      logger.warn('Train rate limit exceeded', { 
        tenantId, 
        developmentId,
        resetTime: rateLimitResult.resetTime 
      });
      
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Maximum 10 training operations per minute.' 
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      });
    }
    
    const requestTenant = await resolveTenantFromRequest(req.headers);
    if (requestTenant && requestTenant.id !== tenantId) {
      console.error('❌ Development does not belong to request tenant');
      return new Response(JSON.stringify({ error: 'Unauthorized: Development does not belong to tenant' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.log('✅ Tenant ID:', tenantId);
    console.log('✅ Development ID:', developmentId);

    if (!files || files.length === 0) {
      console.error('❌ No files provided in FormData');
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (files.length > MAX_FILE_COUNT) {
      console.error(`❌ Too many files: ${files.length} (max: ${MAX_FILE_COUNT})`);
      return new Response(JSON.stringify({ 
        error: `Too many files. Maximum ${MAX_FILE_COUNT} files allowed per upload.`,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('\n🔍 VALIDATING FILES...');
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    for (const file of files) {
      console.log(`  Checking: ${file.name} (${file.size} bytes, ${file.type})`);
      
      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `${file.name}: File too large (max 50MB)`;
        console.log(`    ❌ ${errorMsg}`);
        validationErrors.push(errorMsg);
        continue;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        const errorMsg = `${file.name}: Unsupported file type`;
        console.log(`    ❌ ${errorMsg}`);
        validationErrors.push(errorMsg);
        continue;
      }

      console.log(`    ✅ Valid`);
      validFiles.push(file);
    }

    console.log(`\n✅ Validation complete: ${validFiles.length} valid, ${validationErrors.length} errors`);

    if (validFiles.length === 0) {
      console.error('❌ No valid files to process');
      console.error('Validation errors:', validationErrors);
      return new Response(JSON.stringify({ 
        success: false,
        error: 'No valid files to process',
        validationErrors,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`\n🚀 Starting training for ${validFiles.length} file(s)...`);

    let totalChunks = 0;
    let totalInserted = 0;
    const successfulFiles: string[] = [];
    const failedFiles: { name: string; error: string }[] = [];
    const jobIds: string[] = [];

    for (let i = 0; i < validFiles.length; i += MAX_CONCURRENT_TRAININGS) {
      const batch = validFiles.slice(i, i + MAX_CONCURRENT_TRAININGS);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (file) => {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(new Uint8Array(arrayBuffer));
          console.log(`📦 Processing file: ${file.name} (${file.size} bytes, type: ${file.type})`);
          return trainFromFile(buffer, file.name, tenantId, developmentId!, file.type);
        })
      );

      batchResults.forEach((result, batchIndex) => {
        const file = batch[batchIndex];
        const fileName = file.name;
        
        if (result.status === 'fulfilled' && result.value.success) {
          totalChunks += result.value.chunks;
          totalInserted += result.value.inserted;
          successfulFiles.push(fileName);
          if (result.value.jobId) {
            jobIds.push(result.value.jobId);
          }
        } else {
          const errorMessage = result.status === 'rejected' 
            ? result.reason?.message || 'Unknown error'
            : result.value.error || 'Training failed';
          failedFiles.push({ name: fileName, error: errorMessage });
          if (result.status === 'fulfilled' && result.value.jobId) {
            jobIds.push(result.value.jobId);
          }
        }
      });
    }

    const response = {
      success: successfulFiles.length > 0,
      jobId: jobIds.length === 1 ? jobIds[0] : undefined,
      jobIds: jobIds.length > 1 ? jobIds : undefined,
      totalFiles: files.length,
      validFiles: validFiles.length,
      successfulFiles: successfulFiles.length,
      failedFiles: failedFiles.length,
      totalChunks,
      totalInserted,
      successfulFileNames: successfulFiles,
      failedFileDetails: failedFiles,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: successfulFiles.length > 0 ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Training API error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function handleGetTrainingJobs(req: NextRequest) {
  try {
    if (!verifyAdminAuth(req)) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const developmentId = searchParams.get('developmentId');

    if (!tenantId || !developmentId) {
      return NextResponse.json({
        error: 'tenantId and developmentId are required',
      }, { status: 400 });
    }

    const jobs = await getTenantJobs(tenantId, developmentId);

    return NextResponse.json({
      success: true,
      jobs,
    });
  } catch (error) {
    console.error('Get training jobs error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
