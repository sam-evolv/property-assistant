const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultDocTypes = [
  { name: 'BER Certificate', category: 'Certification', description: 'Building Energy Rating certificate showing energy efficiency rating.', required: true },
  { name: 'BCMS Certificate', category: 'Certification', description: 'Building Control Management System certificate confirming compliance with building regulations.', required: true },
  { name: 'Fire Safety Certificate', category: 'Safety', description: 'Fire safety compliance certificate from local authority.', required: true },
  { name: 'Gas Safety Certificate', category: 'Safety', description: 'Gas safety inspection and certification document.', required: true },
  { name: 'Electrical Certificate', category: 'Certification', description: 'Electrical installation safety certificate.', required: true },
  { name: 'HomeBond Registration', category: 'Registration', description: 'HomeBond structural defects insurance registration document.', required: true },
  { name: 'Structural Warranty', category: 'Warranty', description: '10-year structural warranty documentation.', required: true },
];

async function seedDocTypes() {
  console.log('Fetching developments...');
  
  const { data: developments, error: devError } = await supabase
    .from('developments')
    .select('id, name, tenant_id');

  if (devError) {
    console.error('Error fetching developments:', devError);
    process.exit(1);
  }

  console.log(`Found ${developments.length} developments`);

  for (const dev of developments) {
    console.log(`\nSeeding document types for: ${dev.name}`);
    
    const { data: existing } = await supabase
      .from('compliance_document_types')
      .select('name')
      .eq('development_id', dev.id);

    const existingNames = new Set(existing?.map(e => e.name) || []);
    
    for (const docType of defaultDocTypes) {
      if (existingNames.has(docType.name)) {
        console.log(`  - ${docType.name} already exists, skipping`);
        continue;
      }

      const { error } = await supabase
        .from('compliance_document_types')
        .insert({
          tenant_id: dev.tenant_id,
          development_id: dev.id,
          name: docType.name,
          category: docType.category,
          description: docType.description,
          required: docType.required,
        });

      if (error) {
        console.error(`  - Error adding ${docType.name}:`, error.message);
      } else {
        console.log(`  + Added: ${docType.name}`);
      }
    }
  }

  console.log('\nSeeding complete!');
}

seedDocTypes().catch(console.error);
