import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function seedAmenities() {
  console.log('='.repeat(60));
  console.log('SEEDING LOCAL AMENITIES (via document_sections)');
  console.log('='.repeat(60));

  // Since local_amenities table doesn't exist, we add amenity info as document sections
  // This allows the AI to answer questions about local area via RAG
  const amenitySections = [
    {
      project_id: PROJECT_ID,
      content: 'Ballyvolane Shopping Centre is a 5-minute walk from Longview Park. It includes SuperValu supermarket, a pharmacy, Costa Coffee, and various retail stores. Open daily 8am-10pm.',
      metadata: { source: 'Local Amenities', title: 'Shopping Centre', type: 'Shopping' }
    },
    {
      project_id: PROJECT_ID,
      content: 'St. Patricks Boys National School is a 10-minute walk from Longview Park. It is the local primary school serving the Ballyvolane area. Contact: 021-450-1234.',
      metadata: { source: 'Local Amenities', title: 'Education', type: 'Education' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Bus Stop for Route 207 is just a 2-minute walk from Longview Park. Bus Eireann Route 207 connects directly to Cork City Centre, running every 15 minutes during peak hours.',
      metadata: { source: 'Local Amenities', title: 'Public Transport', type: 'Transport' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Ballyhooly Road Medical Centre is 8 minutes walk from Longview Park. It provides GP services Monday to Friday 9am-6pm. For appointments call 021-450-5678.',
      metadata: { source: 'Local Amenities', title: 'Healthcare', type: 'Healthcare' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Glen River Park is a beautiful riverside park approximately 12 minutes walk from Longview Park. It features walking trails, a playground for children, and picnic areas.',
      metadata: { source: 'Local Amenities', title: 'Recreation', type: 'Recreation' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Centra Express convenience store is a 3-minute walk from Longview Park. It is open 24 hours for everyday essentials, newspapers, and quick groceries.',
      metadata: { source: 'Local Amenities', title: 'Convenience Store', type: 'Convenience' }
    }
  ];

  console.log('Inserting amenity information as document sections...');
  
  for (const section of amenitySections) {
    const { error } = await supabase.from('document_sections').insert(section);
    if (error) {
      console.log(`Error: ${section.metadata?.title} - ${error.message}`);
    } else {
      console.log(`✓ ${section.metadata?.title} (${section.metadata?.type})`);
    }
  }
  
  const { count } = await supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', PROJECT_ID);
  
  console.log(`\n✅ Total document sections: ${count}`);
  console.log('='.repeat(60));
}

seedAmenities().catch(console.error);
