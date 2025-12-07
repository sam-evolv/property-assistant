import { createClient } from '@supabase/supabase-js';

// 1. SETUP (Admin Access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

async function heal() {
  console.log("🩹 STARTING CATALOG REPAIR...");

  // 2. LIST FILES IN STORAGE
  console.log("📂 Scanning 'development_docs' bucket...");
  const { data: files, error } = await supabase.storage.from('development_docs').list();

  if (error) {
    console.error("❌ Storage Error:", error.message);
    return;
  }

  if (!files || files.length === 0) {
    console.error("❌ No files found in Storage. Please upload a file first.");
    return;
  }

  console.log(`✅ Found ${files.length} files in storage.`);

  // 3. CREATE DB RECORDS FOR EACH FILE
  for (const file of files) {
    if (file.name === '.emptyFolderPlaceholder') continue;

    console.log(`   - Processing: ${file.name}`);

    // Check if exists
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('storage_path', file.name)
      .single();

    if (!existing) {
      // INSERT MISSING RECORD
      const { error: insertErr } = await supabase.from('documents').insert({
        project_id: PROJECT_ID,
        title: file.name, // Use filename as title
        storage_path: file.name,
        file_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/development_docs/${file.name}`
      });

      if (insertErr) console.error(`     ❌ Insert Failed: ${insertErr.message}`);
      else console.log(`     ✅ Created missing record.`);
    } else {
      console.log(`     - Record exists.`);
    }
  }

  console.log("\n🩹 REPAIR COMPLETE. Now run the 'force-feed' script.");
}

heal();