import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { requireProductionWriteAccess } from '../lib/security/production-guard';

requireProductionWriteAccess('seed-amenities');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  });
  return response.data[0].embedding;
}

async function seedAmenities() {
  console.log('='.repeat(60));
  console.log('SEEDING LOCAL AMENITIES (via document_sections with embeddings)');
  console.log('='.repeat(60));

  const amenitySections = [
    {
      project_id: PROJECT_ID,
      content: 'Ballyvolane Shopping Centre is a 5-minute walk from Longview Park. It includes SuperValu supermarket, a pharmacy, Costa Coffee, and various retail stores. Open daily 8am-10pm.',
      metadata: { source: 'Local Amenities', title: 'Shopping Centre', type: 'Shopping', is_homeowner_facing: true }
    },
    {
      project_id: PROJECT_ID,
      content: 'St. Patricks Boys National School is a 10-minute walk from Longview Park. It is the local primary school serving the Ballyvolane area. Contact: 021-450-1234.',
      metadata: { source: 'Local Amenities', title: 'Education', type: 'Education', is_homeowner_facing: true }
    },
    {
      project_id: PROJECT_ID,
      content: `Public Transport near Longview Park:

Bus Routes:
- Bus Eireann Route 207 connects directly to Cork City Centre, running every 15 minutes during peak hours. The bus stop is just a 2-minute walk from Longview Park on Ballyhooly Road.
- Route 207A provides an express service to Cork Kent Station during morning and evening rush hours.

Cork City Centre is approximately 15 minutes by bus from Longview Park.

Taxi Services:
- Local taxi ranks are available at Ballyvolane Shopping Centre
- Cork Taxi Co-op: 021-427-2222
- ABC Taxis: 021-496-1961

Cork Kent Railway Station is approximately 20 minutes by car/taxi and provides mainline rail services to Dublin, Limerick, and other major cities.`,
      metadata: { source: 'Local Amenities', title: 'Public Transport', type: 'Transport', is_homeowner_facing: true }
    },
    {
      project_id: PROJECT_ID,
      content: 'Ballyhooly Road Medical Centre is 8 minutes walk from Longview Park. It provides GP services Monday to Friday 9am-6pm. For appointments call 021-450-5678.',
      metadata: { source: 'Local Amenities', title: 'Healthcare', type: 'Healthcare', is_homeowner_facing: true }
    },
    {
      project_id: PROJECT_ID,
      content: 'Glen River Park is a beautiful riverside park approximately 12 minutes walk from Longview Park. It features walking trails, a playground for children, and picnic areas.',
      metadata: { source: 'Local Amenities', title: 'Recreation', type: 'Recreation', is_homeowner_facing: true }
    },
    {
      project_id: PROJECT_ID,
      content: 'Centra Express convenience store is a 3-minute walk from Longview Park. It is open 24 hours for everyday essentials, newspapers, and quick groceries.',
      metadata: { source: 'Local Amenities', title: 'Convenience Store', type: 'Convenience', is_homeowner_facing: true }
    }
  ];

  console.log('Inserting amenity information with embeddings...');
  
  for (const section of amenitySections) {
    try {
      console.log(`Generating embedding for: ${section.metadata?.title}...`);
      const embedding = await generateEmbedding(section.content);
      
      const { error } = await supabase.from('document_sections').insert({
        ...section,
        embedding
      });
      
      if (error) {
        console.log(`Error: ${section.metadata?.title} - ${error.message}`);
      } else {
        console.log(`✓ ${section.metadata?.title} (${section.metadata?.type})`);
      }
    } catch (err) {
      console.error(`Failed to process ${section.metadata?.title}:`, err);
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
