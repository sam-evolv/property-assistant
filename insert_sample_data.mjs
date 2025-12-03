import { v4 as uuidv4 } from 'uuid';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function insertSampleData() {
  const developmentId = '13238fe6-3376-41ed-ba0a-a33bdef136aa';
  const tenantId = '82bcb7e8-a8bc-4fa1-898e-dd2a7205273f';
  const fileName = 'Riverside_Gardens_Property_Information.pdf';
  
  // Sample text chunks from the Riverside Gardens document
  const sampleChunks = [
    "Riverside Gardens Development Overview: Riverside Gardens is a prestigious new development located at 123 River Boulevard in Dublin 2. This exclusive collection of 48 luxury apartments offers contemporary living with stunning views of the River Liffey. Each residence has been meticulously designed to provide the perfect blend of style, comfort, and sustainability.",
    
    "Premium Amenities - Building Features: 24-hour concierge and security service, Secure underground parking with electric vehicle charging stations, Residents' gym with state-of-the-art equipment, Rooftop terrace with panoramic city and river views, Bicycle storage and maintenance area, Package receiving and secure parcel lockers.",
    
    "Premium Amenities - Apartment Features: High-quality German kitchens with Miele appliances, Underfloor heating throughout, Floor-to-ceiling windows for maximum natural light, Smart home technology integration, Engineered oak flooring, Private balconies available in most units.",
    
    "Energy Efficiency: All apartments achieve an A2 Building Energy Rating (BER), ensuring low running costs and environmental impact. The development features solar panels, heat recovery ventilation, and high-performance insulation.",
    
    "Heating & Hot Water: Central heating system with individual apartment control. Hot water provided via energy-efficient heat pumps. Underfloor heating in bathrooms and main living areas.",
    
    "Internet & Connectivity: High-speed fiber optic broadband (1Gbps) included in all apartments. Full WiFi coverage in common areas. Pre-wired for smart home devices and systems.",
    
    "One Bedroom Apartments: 55-65 sqm. Perfect for professionals or first-time buyers. Open-plan living/kitchen area, spacious bedroom with fitted wardrobes, luxury bathroom.",
    
    "Two Bedroom Apartments: 75-85 sqm. Ideal for small families or those wanting extra space. Master bedroom with ensuite, second bedroom, main bathroom, large living/dining area.",
    
    "Three Bedroom Apartments: 95-110 sqm. Generous family homes with master ensuite, two additional bedrooms, family bathroom, spacious living areas, and premium finishes throughout.",
    
    "Penthouse Apartments: 120-145 sqm. Exclusive top-floor residences featuring private roof terraces, three bedrooms, two bathrooms, stunning city and river views.",
    
    "Prime Location & Transport: Riverside Gardens enjoys an enviable position in Dublin 2. Tara Street DART station is 5 minutes walk, Multiple Dublin Bus routes 2 minutes walk, Luas Red Line 8 minutes walk, Dublin City Centre 10 minutes walk.",
    
    "Local Amenities: Trinity College Dublin 12 minutes walk, Grand Canal 5 minutes walk, Multiple supermarkets and shops within 500m, Restaurants, cafes, and entertainment venues nearby, St. Stephen's Green 15 minutes walk.",
    
    "Property Management: Riverside Gardens Management Company Ltd. manages all common areas and building services. Development Manager: Michael O'Brien, Email: michael.obrien@riversidegardens.ie, Phone: +353 1 234 5678, Office Hours: Monday-Friday 9am-5pm.",
    
    "Service Charges: Estimated annual service charge ranges from €1,800 to €3,200 depending on apartment size. This covers building insurance, maintenance of common areas, concierge service, gym facilities, and landscaping.",
    
    "Electricity: Residents can choose their own electricity supplier. The development is connected to the ESB Networks grid. Smart meters are installed in all apartments.",
    
    "Gas: Natural gas is supplied via Gas Networks Ireland. Residents can select from various retail suppliers including Bord Gáis Energy, Energia, and SSE Airtricity.",
    
    "Water: Water supply and wastewater services provided by Irish Water. Charges may apply based on government policy.",
    
    "Telecommunications: The building is pre-wired for all major providers including Virgin Media, Eir, Sky, and Vodafone.",
    
    "Warranty & Guarantees: All apartments come with comprehensive warranties: Homebond structural guarantee (10 years), Premier Guarantee (10-year structural warranty), Manufacturer warranties on all appliances, Snag list completion guarantee, After-sales support from the developer for 12 months.",
  ];
  
  console.log('📝 Inserting sample document data...');
  
  // Insert document record
  const documentId = uuidv4();
  await pool.query(`
    INSERT INTO documents (id, tenant_id, development_id, title, file_url, file_name, size_kb, mime_type, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
  `, [documentId, tenantId, developmentId, 'Riverside Gardens Property Information', '/uploads/riverside-gardens-info.pdf', fileName, 6, 'application/pdf', 'completed']);
  
  console.log(`✅ Created document record: ${documentId}`);
  
  // Create training job record
  const jobId = uuidv4();
  await pool.query(`
    INSERT INTO training_jobs (id, tenant_id, development_id, file_name, file_type, status, progress, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
  `, [jobId, tenantId, developmentId, fileName, 'application/pdf', 'completed', 100]);
  
  console.log(`✅ Created training job: ${jobId}`);
  
  // Insert chunks
  for (let i = 0; i < sampleChunks.length; i++) {
    const chunkId = uuidv4();
    
    await pool.query(`
      INSERT INTO doc_chunks (id, tenant_id, development_id, document_id, content, source_type, source_id, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [chunkId, tenantId, developmentId, documentId, sampleChunks[i], 'document', documentId, JSON.stringify({ chunk_index: i })]);
  }
  
  console.log(`✅ Inserted ${sampleChunks.length} chunks into database`);
  console.log('\n🎉 Sample data insertion complete!');
  console.log(`Document ID: ${documentId}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`Chunks: ${sampleChunks.length}`);
  
  await pool.end();
}

insertSampleData().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
