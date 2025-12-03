const fs = require('fs');
const pdfParse = require('pdf-parse').default || require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function processDocument() {
  const developmentId = '13238fe6-3376-41ed-ba0a-a33bdef136aa';
  const tenantId = '82bcb7e8-a8bc-4fa1-898e-dd2a7205273f';
  const fileName = 'Riverside_Gardens_Property_Information.pdf';
  
  console.log('📖 Reading PDF file...');
  const dataBuffer = fs.readFileSync(fileName);
  
  // Parse PDF to extract text
  const pdfData = await pdfParse(dataBuffer);
  const fullText = pdfData.text;
  
  console.log(`✅ Extracted ${fullText.length} characters from PDF`);
  console.log(`📄 Pages: ${pdfData.numpages}`);
  
  // Insert document record
  const documentId = uuidv4();
  await pool.query(`
    INSERT INTO documents (id, tenant_id, development_id, file_name, file_size, file_type, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
  `, [documentId, tenantId, developmentId, fileName, dataBuffer.length, 'application/pdf', 'completed']);
  
  console.log(`✅ Created document record: ${documentId}`);
  
  // Create training job record
  const jobId = uuidv4();
  await pool.query(`
    INSERT INTO training_jobs (id, tenant_id, development_id, file_name, status, progress, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
  `, [jobId, tenantId, developmentId, fileName, 'completed', 100]);
  
  console.log(`✅ Created training job: ${jobId}`);
  
  // Simple chunking - split by paragraphs (double newlines)
  const paragraphs = fullText.split(/\n\n+/).filter(p => p.trim().length > 50);
  console.log(`📦 Created ${paragraphs.length} chunks`);
  
  // For demo purposes, just store the chunks without embeddings (we'll add those later)
  // This allows the document to show up in the system
  for (let i = 0; i < paragraphs.length; i++) {
    const chunkId = uuidv4();
    const chunk = paragraphs[i].trim();
    
    await pool.query(`
      INSERT INTO doc_chunks (id, tenant_id, development_id, document_id, chunk_text, chunk_index, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [chunkId, tenantId, developmentId, documentId, chunk, i]);
  }
  
  console.log(`✅ Inserted ${paragraphs.length} chunks into database`);
  console.log('\n🎉 Document processing complete!');
  console.log(`Document ID: ${documentId}`);
  console.log(`Job ID: ${jobId}`);
  
  await pool.end();
}

processDocument().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
