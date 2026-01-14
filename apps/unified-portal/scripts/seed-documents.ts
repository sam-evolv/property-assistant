import { createClient } from '@supabase/supabase-js';
import { requireProductionWriteAccess } from '../lib/security/production-guard';

requireProductionWriteAccess('seed-documents');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function seedDocuments() {
  console.log('='.repeat(60));
  console.log('SEEDING DOCUMENT SECTIONS FOR RAG');
  console.log('='.repeat(60));

  const docSections = [
    {
      project_id: PROJECT_ID,
      content: 'Welcome to Longview Park, a prestigious development of 77 premium homes in Ballyvolane, Cork. Your new home features modern A-rated energy efficiency, triple-glazed windows, and a state-of-the-art Daikin Altherma heat pump system.',
      metadata: { source: 'Home User Guide', title: 'Welcome to Your New Home' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Your Daikin Altherma heat pump provides efficient heating and hot water. The optimal temperature setting is 21°C. The heat pump operates most efficiently when set to a constant temperature. For technical support, contact Daikin Ireland at 01-642-3430.',
      metadata: { source: 'Heat Pump Manual', title: 'Heat Pump Operation' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Waste collection for Longview Park is every Tuesday. General waste (black bin) is collected weekly. Recycling (green bin) alternates with compost (brown bin) weekly. Bins should be placed at the curb by 7am. For missed collections, contact Cork City Council at 021-492-4000.',
      metadata: { source: 'Waste Collection Schedule', title: 'Bin Collection Days' }
    },
    {
      project_id: PROJECT_ID,
      content: 'The estate is managed by Premier Property Management. Annual management fee covers common area maintenance, landscaping, and street lighting. Contact: info@premierproperty.ie or 021-123-4567. Parking: Each home has allocated parking. Visitors should use designated visitor spaces.',
      metadata: { source: 'Estate Management', title: 'Estate Rules and Contacts' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Ballyvolane Shopping Centre is a 5-minute walk with SuperValu, pharmacy, and cafes. St. Patricks School is 10 minutes walk. Bus Route 207 connects to Cork City Centre every 15 minutes from the stop 2 minutes away. Glen River Park offers beautiful walking trails 12 minutes away. Ballyhooly Road Medical Centre is 8 minutes walk for GP services.',
      metadata: { source: 'Local Area Guide', title: 'Nearby Amenities' }
    },
    {
      project_id: PROJECT_ID,
      content: 'Emergency Services: 999 or 112. Gas Emergency (Gas Networks Ireland): 1800-20-50-50. ESB Emergency: 1800-37-29-99. Irish Water: 1800-27-84-78. Estate Management Emergency: 087-123-4567. Nearest A&E: Cork University Hospital, approximately 15 minutes by car.',
      metadata: { source: 'Emergency Information', title: 'Emergency Contacts' }
    }
  ];

  console.log('Inserting document sections...');
  
  for (const section of docSections) {
    const { error } = await supabase.from('document_sections').insert(section);
    if (error) {
      console.log(`Error: ${section.metadata?.title} - ${error.message}`);
    } else {
      console.log(`✓ ${section.metadata?.title}`);
    }
  }
  
  const { count } = await supabase
    .from('document_sections')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', PROJECT_ID);
  
  console.log(`\n✅ Total document sections: ${count}`);
  console.log('='.repeat(60));
}

seedDocuments().catch(console.error);
