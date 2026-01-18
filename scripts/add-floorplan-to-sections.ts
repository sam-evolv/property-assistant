import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Demo IDs
const DEMO_TENANT_ID = 'a0000000-0000-0000-0000-000000000001';
const DEMO_PROJECT_ID = 'b0000000-0000-0000-0000-000000000001';
const HOUSE_TYPE_CODE = 'KEELEY';

async function addFloorPlanToSections() {
  console.log('=== ADD FLOOR PLAN TO DOCUMENT_SECTIONS ===\n');

  // The floor plan PDF URL in storage
  const storagePath = `${DEMO_TENANT_ID}/${DEMO_PROJECT_ID}/floor-plans/keeley-floorplan.pdf`;
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/development_docs/${storagePath}`;

  console.log('1. Floor plan URL:', fileUrl);

  // Check if floor plan already exists in document_sections
  console.log('\n2. Checking existing document_sections...');
  const { data: existingSections, error: checkError } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', DEMO_PROJECT_ID)
    .limit(10);

  if (checkError) {
    console.log('  Error checking sections:', checkError.message);
  } else {
    console.log('  Existing sections for project:', existingSections?.length || 0);
    existingSections?.forEach((s, i) => {
      const meta = s.metadata as any;
      console.log(`  ${i + 1}. ${meta?.file_name || 'no filename'} (house_type: ${meta?.house_type_code || 'none'})`);
    });
  }

  // Create document section entry for floor plan
  // This is what the findFloorPlanDocuments function looks for
  console.log('\n3. Adding floor plan to document_sections...');

  const floorPlanMetadata = {
    file_name: 'keeley-floorplan.pdf',
    file_url: fileUrl,
    title: 'The Keeley - Floor Plans',
    house_type_code: HOUSE_TYPE_CODE,
    discipline: 'architectural',
    drawing_type: 'floor_plan',
    doc_type: 'floorplan',
    tags: ['floorplan', 'floor_plan', 'room_sizes', 'dimensions'],
    source: 'keeley-floorplan.pdf',
  };

  // Generate a unique section ID
  const sectionId = crypto.randomUUID();

  // First check existing sections to understand the structure
  const { data: sampleSection } = await supabase
    .from('document_sections')
    .select('*')
    .limit(1)
    .single();

  if (sampleSection) {
    console.log('  Sample section columns:', Object.keys(sampleSection));
  }

  // Insert - document_sections has: id, project_id, unit_type_id, content, embedding, metadata
  const { data: insertData, error: insertError } = await supabase
    .from('document_sections')
    .insert({
      id: sectionId,
      project_id: DEMO_PROJECT_ID,
      unit_type_id: 'd0000000-0000-0000-0000-000000000001', // The Keeley unit type
      content: `Floor plan for The Keeley house type showing ground floor and first floor layouts with room dimensions.

Ground Floor:
- Living Room: 4.69m x 3.47m (16.3 sq m)
- Kitchen/Dining: 5.37m x 3.26m (17.5 sq m)
- Utility: 1.80m x 1.70m (3.1 sq m)
- WC: 1.70m x 0.90m (1.5 sq m)
- Hall: 1.70m x 3.95m (6.7 sq m)

First Floor:
- Bedroom 1 (Master): 4.20m x 3.47m (14.6 sq m)
- Bedroom 2: 3.40m x 2.90m (9.9 sq m)
- Bedroom 3: 2.70m x 2.40m (6.5 sq m)
- Bathroom: 2.10m x 1.80m (3.8 sq m)
- Landing: 2.50m x 1.70m (4.3 sq m)

Total Floor Area: 83.2 sq m (896 sq ft)`,
      metadata: floorPlanMetadata,
    })
    .select()
    .single();

  if (insertError) {
    console.log('  Insert error:', insertError.message);

    // Try to check what columns exist
    if (insertError.message.includes('column')) {
      console.log('\n  Checking document_sections table structure...');
      const { data: sample } = await supabase
        .from('document_sections')
        .select('*')
        .limit(1);
      if (sample && sample.length > 0) {
        console.log('  Sample columns:', Object.keys(sample[0]));
      }
    }
  } else {
    console.log('  ✅ Floor plan added to document_sections:', insertData.id);
  }

  // Verify the floor plan can now be found
  console.log('\n4. Verifying floor plan is findable...');
  const { data: verifySections, error: verifyError } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', DEMO_PROJECT_ID);

  if (verifyError) {
    console.log('  Verify error:', verifyError.message);
  } else {
    const floorPlans = verifySections?.filter((s: any) => {
      const meta = s.metadata as any;
      const fileName = (meta?.file_name || '').toLowerCase();
      const docType = (meta?.doc_type || '').toLowerCase();
      const houseType = (meta?.house_type_code || '').toLowerCase();

      return (
        (docType === 'floorplan' || fileName.includes('floor')) &&
        houseType === HOUSE_TYPE_CODE.toLowerCase()
      );
    });

    console.log('  Floor plans found for KEELEY:', floorPlans?.length || 0);
    floorPlans?.forEach((fp: any) => {
      const meta = fp.metadata as any;
      console.log('  -', meta.file_name, '| URL:', meta.file_url?.substring(0, 60) + '...');
    });
  }

  console.log('\n✅ Done! The floor plan should now attach to room dimension questions.');
}

addFloorPlanToSections();
