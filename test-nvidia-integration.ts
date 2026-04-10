// Test script for NVIDIA Flash integration
import { createAIClient, getFallbackModel, isModelAvailable } from './packages/api/src/ai-client';
import { MODEL_PROVIDERS } from './packages/api/src/model-providers';

console.log('🧪 Testing NVIDIA Flash Integration\n');

// Test 1: Check model providers
console.log('📋 Available Model Providers:');
MODEL_PROVIDERS.forEach(provider => {
  console.log(`  • ${provider.name} (${provider.id})`);
  provider.models.forEach(model => {
    console.log(`    - ${model.name} (${model.id})`);
  });
});

console.log('\n🔍 Checking NVIDIA Flash Availability:');
const nvidiaFlashAvailable = isModelAvailable('nvidia/flash');
console.log(`  NVIDIA Flash available: ${nvidiaFlashAvailable ? '✅ YES' : '❌ NO'}`);

if (nvidiaFlashAvailable) {
  console.log('\n🚀 Testing NVIDIA Flash Client Creation:');
  try {
    const client = createAIClient('nvidia/flash');
    console.log('✅ NVIDIA Flash client created successfully');
    
    // Test a simple completion
    console.log('\n🧠 Testing NVIDIA Flash completion:');
    const response = await client.chat.completions.create({
      model: 'nvidia/flash',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello! Can you tell me a short joke?' }
      ],
      max_tokens: 50,
      temperature: 0.7
    });
    
    console.log('✅ NVIDIA Flash response received:');
    console.log(`   ${response.choices[0]?.message?.content || 'No response'}`);
    
  } catch (error) {
    console.log('❌ Error creating NVIDIA Flash client:');
    console.log(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} else {
  console.log('\n💡 To enable NVIDIA Flash:');
  console.log('   1. Get API key from https://build.nvidia.com/');
  console.log('   2. Set NVIDIA_API_KEY environment variable');
  console.log('   3. Restart your application');
}

console.log('\n🔄 Testing Fallback Mechanism:');
const fallbackModel = getFallbackModel('nvidia/flash', 'chat');
console.log(`   Fallback for NVIDIA Flash: ${fallbackModel}`);

console.log('\n✅ Integration test completed');