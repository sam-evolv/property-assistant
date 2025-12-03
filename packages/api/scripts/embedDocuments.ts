import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql } from 'drizzle-orm';
import { Client } from 'pg';
import { developments, documents, ragChunks } from '@openhouse/db/schema';
import * as schema from '@openhouse/db/schema';
import { chunkText } from '../src/train/chunk';
import { embedChunks } from '../src/train/embed';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

async function embedDocuments() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: npm run embed-docs -- <developmentCode>');
    console.error('Example: npm run embed-docs -- LV-PARK');
    process.exit(1);
  }
  
  const developmentCode = args[0];
  
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }
  
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const db = drizzle(client, { schema });
    
    console.log(`🔍 Searching for development: ${developmentCode}`);
    
    const development = await db
      .select()
      .from(developments)
      .where(eq(developments.code, developmentCode))
      .limit(1);
    
    if (development.length === 0) {
      console.error(`❌ Development not found: ${developmentCode}`);
      process.exit(1);
    }
    
    const dev = development[0];
    console.log(`✅ Found development: ${dev.name} (ID: ${dev.id})\n`);
    
    console.log('📄 Finding documents without embeddings...');
    
    const docsToEmbed = await db
      .select({
        id: documents.id,
        title: documents.title,
        file_name: documents.file_name,
        relative_path: documents.relative_path,
        house_type_code: documents.house_type_code,
        document_type: documents.document_type,
      })
      .from(documents)
      .where(and(
        eq(documents.development_id, dev.id),
        eq(documents.status, 'active')
      ));
    
    console.log(`✅ Found ${docsToEmbed.length} documents\n`);
    
    if (docsToEmbed.length === 0) {
      console.log('No documents to process. Exiting.');
      return;
    }
    
    let totalChunks = 0;
    let totalDocuments = 0;
    
    for (const doc of docsToEmbed) {
      console.log(`\n📄 Processing: ${doc.title} (${doc.file_name})`);
      
      const existingChunks = await db
        .select()
        .from(ragChunks)
        .where(eq(ragChunks.document_id, doc.id))
        .limit(1);
      
      if (existingChunks.length > 0) {
        console.log('  ⏭️  Already has embeddings, skipping...');
        continue;
      }
      
      let textContent = '';
      
      if (doc.relative_path) {
        const assetsPath = path.join(process.cwd(), 'assets', doc.relative_path);
        
        if (fs.existsSync(assetsPath)) {
          const ext = path.extname(doc.file_name).toLowerCase();
          
          if (ext === '.txt') {
            textContent = fs.readFileSync(assetsPath, 'utf-8');
          } else {
            console.log(`  ⚠️  Unsupported file type: ${ext} (skipping text extraction for now)`);
            textContent = `Document: ${doc.title}\nType: ${doc.document_type}\nHouse Type: ${doc.house_type_code || 'N/A'}`;
          }
        } else {
          console.log(`  ⚠️  File not found: ${assetsPath}`);
          textContent = `Document: ${doc.title}\nType: ${doc.document_type}\nHouse Type: ${doc.house_type_code || 'N/A'}`;
        }
      } else {
        textContent = `Document: ${doc.title}\nType: ${doc.document_type}\nHouse Type: ${doc.house_type_code || 'N/A'}`;
      }
      
      console.log(`  📝 Extracted ${textContent.length} characters of text`);
      
      const chunks = await chunkText(textContent, CHUNK_SIZE, CHUNK_OVERLAP);
      
      console.log(`  ✂️  Created ${chunks.length} chunks`);
      
      if (chunks.length === 0) {
        console.log('  ⚠️  No chunks created, skipping...');
        continue;
      }
      
      const embeddingResults = await embedChunks(chunks);
      
      console.log(`  🧠 Generated ${embeddingResults.length} embeddings`);
      
      for (const result of embeddingResults) {
        const embeddingVector = `[${result.embedding.join(',')}]`;
        
        await db.execute(sql`
          INSERT INTO rag_chunks (
            tenant_id, 
            development_id, 
            house_type_code, 
            document_id, 
            chunk_index, 
            content, 
            embedding
          ) VALUES (
            ${dev.tenant_id}::uuid,
            ${dev.id}::uuid,
            ${doc.house_type_code},
            ${doc.id}::uuid,
            ${result.chunk.index},
            ${result.chunk.content},
            ${embeddingVector}::vector(1536)
          )
        `);
      }
      
      console.log(`  ✅ Stored ${embeddingResults.length} chunks in rag_chunks`);
      
      totalChunks += embeddingResults.length;
      totalDocuments++;
    }
    
    console.log('\n📊 Embedding Summary:');
    console.log(`  ✅ Documents processed: ${totalDocuments}`);
    console.log(`  🧠 Total chunks embedded: ${totalChunks}`);
    console.log(`  📁 Total documents scanned: ${docsToEmbed.length}`);
    
  } catch (error) {
    console.error('\n❌ Error during embedding:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  embedDocuments();
}

export { embedDocuments };
