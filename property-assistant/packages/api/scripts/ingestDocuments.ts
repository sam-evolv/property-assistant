import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, isNull } from 'drizzle-orm';
import { Client } from 'pg';
import { tenants, developments, houseTypes, documents } from '@openhouse/db/schema';
import * as schema from '@openhouse/db/schema';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface FileInfo {
  filePath: string;
  fileName: string;
  relativePath: string;
  houseTypeCode: string | null;
  documentType: string;
}

function inferDocumentType(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('floor') || lowerName.includes('plan')) {
    return 'floorplan';
  }
  if (lowerName.includes('elev')) {
    return 'elevation';
  }
  if (lowerName.includes('kitchen')) {
    return 'kitchen_layout';
  }
  if (lowerName.includes('electrical')) {
    return 'electrical_layout';
  }
  if (lowerName.includes('manual')) {
    return 'general_manual';
  }
  if (lowerName.includes('brochure')) {
    return 'brochure';
  }
  if (lowerName.includes('planning')) {
    return 'planning';
  }
  
  return 'other';
}

function walkDirectory(rootPath: string, assetsRoot: string, developmentCode: string): FileInfo[] {
  const files: FileInfo[] = [];
  
  function walk(currentPath: string, parentFolder: string | null) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walk(fullPath, entry.name);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.pdf', '.docx', '.doc', '.csv', '.txt'].includes(ext)) {
          let houseTypeCode: string | null = parentFolder;
          
          if (parentFolder && (parentFolder.toUpperCase() === 'GENERAL' || parentFolder.toUpperCase() === 'COMMON')) {
            houseTypeCode = null;
          }
          
          const relativePath = path.relative(assetsRoot, fullPath).replace(/\\/g, '/');
          
          files.push({
            filePath: fullPath,
            fileName: entry.name,
            relativePath,
            houseTypeCode,
            documentType: inferDocumentType(entry.name),
          });
        }
      }
    }
  }
  
  walk(rootPath, null);
  return files;
}

async function ingestDocuments() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: npm run ingest-docs -- <developmentCode> <rootPath>');
    console.error('Example: npm run ingest-docs -- LV-PARK ./assets/LV-PARK');
    process.exit(1);
  }
  
  const developmentCode = args[0];
  const rootPath = args[1];
  
  if (!fs.existsSync(rootPath)) {
    console.error(`❌ Directory not found: ${rootPath}`);
    process.exit(1);
  }
  
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
    
    const assetsRoot = path.dirname(rootPath);
    console.log(`📂 Scanning directory: ${rootPath}`);
    
    const fileInfos = walkDirectory(rootPath, assetsRoot, developmentCode);
    console.log(`✅ Found ${fileInfos.length} documents\n`);
    
    const houseTypeCodes = [...new Set(fileInfos.map(f => f.houseTypeCode).filter(Boolean))];
    console.log(`🏠 House types found: ${houseTypeCodes.join(', ') || 'None'}\n`);
    
    for (const code of houseTypeCodes) {
      if (!code) continue;
      
      const existing = await db
        .select()
        .from(houseTypes)
        .where(and(
          eq(houseTypes.development_id, dev.id),
          eq(houseTypes.house_type_code, code)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(houseTypes).values({
          tenant_id: dev.tenant_id,
          development_id: dev.id,
          house_type_code: code,
          name: `${code} House Type`,
        });
        console.log(`  ✅ Created house type: ${code}`);
      } else {
        console.log(`  ⏭️  House type already exists: ${code}`);
      }
    }
    
    console.log('\n📄 Ingesting documents...\n');
    
    let inserted = 0;
    let skipped = 0;
    let updated = 0;
    
    for (const fileInfo of fileInfos) {
      let houseTypeId: string | null = null;
      
      if (fileInfo.houseTypeCode) {
        const houseType = await db
          .select()
          .from(houseTypes)
          .where(and(
            eq(houseTypes.development_id, dev.id),
            eq(houseTypes.house_type_code, fileInfo.houseTypeCode)
          ))
          .limit(1);
        
        if (houseType.length > 0) {
          houseTypeId = houseType[0].id;
        }
      }
      
      const existing = await db
        .select()
        .from(documents)
        .where(and(
          eq(documents.development_id, dev.id),
          eq(documents.file_name, fileInfo.fileName),
          fileInfo.houseTypeCode 
            ? eq(documents.house_type_code, fileInfo.houseTypeCode)
            : isNull(documents.house_type_code)
        ))
        .limit(1);
      
      if (existing.length === 0) {
        await db.insert(documents).values({
          tenant_id: dev.tenant_id,
          development_id: dev.id,
          house_type_id: houseTypeId,
          house_type_code: fileInfo.houseTypeCode,
          document_type: fileInfo.documentType,
          title: path.parse(fileInfo.fileName).name,
          file_name: fileInfo.fileName,
          relative_path: fileInfo.relativePath,
          file_url: `/assets/${fileInfo.relativePath}`,
        });
        
        inserted++;
        console.log(`  ✅ Inserted: ${fileInfo.relativePath}`);
      } else {
        skipped++;
      }
    }
    
    console.log('\n📊 Ingestion Summary:');
    console.log(`  ✅ Inserted: ${inserted}`);
    console.log(`  ⏭️  Skipped (already exist): ${skipped}`);
    console.log(`  📁 Total files processed: ${fileInfos.length}`);
    
  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n✅ Database connection closed');
  }
}

if (require.main === module) {
  ingestDocuments();
}

export { ingestDocuments };
