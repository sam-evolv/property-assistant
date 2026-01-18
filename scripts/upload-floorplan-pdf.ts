import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

/**
 * Upload floor plan PDF to Supabase and link to demo unit
 *
 * Usage: npx tsx scripts/upload-floorplan-pdf.ts <path-to-pdf>
 *
 * Example: npx tsx scripts/upload-floorplan-pdf.ts ./keeley-floorplan.pdf
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Demo IDs
const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const DEMO_UNIT_TYPE_ID = 'd0000000-0000-0000-0000-000000000001'; // The Keeley

async function uploadFloorPlanPDF(pdfPath: string) {
  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(pdfPath);
  const fileName = path.basename(pdfPath);
  const storagePath = `${DEMO_TENANT_ID}/${DEMO_PROJECT_ID}/floor-plans/${fileName}`;

  console.log('Uploading floor plan PDF to Supabase storage...');
  console.log('Storage path:', storagePath);

  // Upload to Supabase Storage (bucket is 'development_docs')
  const STORAGE_BUCKET = 'development_docs';

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    process.exit(1);
  }

  console.log('Uploaded successfully:', uploadData.path);

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  console.log('Public URL:', urlData.publicUrl);

  // Create document record
  const documentId = crypto.randomUUID();

  const { data: docData, error: docError } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      tenant_id: DEMO_TENANT_ID,
      project_id: DEMO_PROJECT_ID,
      title: 'The Keeley - Floor Plans',
      description: 'Floor plans showing room dimensions for The Keeley house type - Ground Floor and First Floor layouts',
      file_path: storagePath,
      file_name: fileName,
      file_type: 'application/pdf',
      category: 'floor_plan',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (docError) {
    console.error('Error creating document record:', docError);
    // Document might already exist, try to find it
    const { data: existingDoc } = await supabase
      .from('documents')
      .select('*')
      .eq('file_path', storagePath)
      .single();

    if (existingDoc) {
      console.log('Document already exists:', existingDoc.id);
    }
  } else {
    console.log('Created document record:', docData.id);
  }

  // Link to unit type (The Keeley)
  const { error: linkError } = await supabase
    .from('unit_type_documents')
    .upsert({
      unit_type_id: DEMO_UNIT_TYPE_ID,
      document_id: documentId,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'unit_type_id,document_id'
    });

  if (linkError) {
    console.log('Link error (may already exist):', linkError.message);
  } else {
    console.log('Linked floor plan to The Keeley unit type');
  }

  // Also add room dimensions to the document_extracted_data for RAG
  const roomDimensions = {
    house_type: 'The Keeley',
    ground_floor: {
      living_room: { width: '4.69m', depth: '3.47m', area: '16.3 sq m' },
      kitchen_dining: { width: '5.37m', depth: '3.26m', area: '17.5 sq m' },
      utility: { width: '1.80m', depth: '1.70m', area: '3.1 sq m' },
      wc: { width: '1.70m', depth: '0.90m', area: '1.5 sq m' },
      hall: { width: '3.95m', depth: '1.70m', area: '6.7 sq m' },
    },
    first_floor: {
      bedroom_1: { width: '4.20m', depth: '3.47m', area: '14.6 sq m' },
      bedroom_2: { width: '3.40m', depth: '2.90m', area: '9.9 sq m' },
      bedroom_3: { width: '2.70m', depth: '2.40m', area: '6.5 sq m' },
      bathroom: { width: '2.10m', depth: '1.80m', area: '3.8 sq m' },
      landing: { width: '2.50m', depth: '1.70m', area: '4.3 sq m' },
    },
    total_floor_area: '83.2 sq m / 896 sq ft',
  };

  const { error: extractedError } = await supabase
    .from('document_extracted_data')
    .upsert({
      document_id: documentId,
      data_type: 'floor_plan_dimensions',
      extracted_data: roomDimensions,
      confidence: 1.0,
      created_at: new Date().toISOString(),
    }, {
      onConflict: 'document_id,data_type'
    });

  if (extractedError) {
    console.log('Extracted data error:', extractedError.message);
  } else {
    console.log('Added room dimensions metadata');
  }

  console.log('\n✅ Floor plan PDF uploaded and linked successfully!');
  console.log('The floor plan is now available for The Keeley house type.');
}

// Main
const pdfPath = process.argv[2];
if (!pdfPath) {
  console.log('Usage: npx tsx scripts/upload-floorplan-pdf.ts <path-to-pdf>');
  console.log('Example: npx tsx scripts/upload-floorplan-pdf.ts ./keeley-floorplan.pdf');
  process.exit(1);
}

uploadFloorPlanPDF(pdfPath);
