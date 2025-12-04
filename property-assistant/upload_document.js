const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function uploadDocument() {
  const form = new FormData();
  
  // Add the PDF file
  const fileStream = fs.createReadStream('Riverside_Gardens_Property_Information.pdf');
  form.append('files', fileStream, 'Riverside_Gardens_Property_Information.pdf');
  
  // Add development ID
  form.append('developmentId', '13238fe6-3376-41ed-ba0a-a33bdef136aa');
  
  // Upload to the train API
  const response = await fetch('http://localhost:3001/api/train', {
    method: 'POST',
    body: form,
    headers: {
      ...form.getHeaders(),
    },
  });
  
  const result = await response.json();
  console.log('Upload result:', JSON.stringify(result, null, 2));
  
  if (result.success) {
    console.log(`✅ Successfully uploaded ${result.successfulFiles} file(s)`);
    console.log(`📊 Total chunks: ${result.totalChunks}, Inserted: ${result.totalInserted}`);
    if (result.jobId) {
      console.log(`🔧 Job ID: ${result.jobId}`);
    }
  } else {
    console.error('❌ Upload failed:', result.error);
  }
}

uploadDocument().catch(console.error);
