import fetch from 'node-fetch';

const TENANT_HOST = 'seaview.localhost:5000';
const API_URL = 'http://localhost:5000/api/chat';

async function testChat() {
  console.log('\n🧪 Testing Seaview Chat System...\n');
  console.log('━'.repeat(70));

  const testQuestions = [
    'When are bins collected?',
    'Where is the nearest school?',
    'What are the parking rules?',
  ];

  for (const question of testQuestions) {
    console.log(`\n📝 Question: "${question}"`);
    console.log('-'.repeat(70));

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Host': TENANT_HOST,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: question,
            },
          ],
        }),
      });

      if (!response.ok) {
        console.error(`❌ Error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error(`   Response: ${errorText}`);
        continue;
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        console.log('✅ Streaming response received');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.substring(6);
                if (data === '[DONE]') {
                  console.log('\n✅ Stream completed');
                  break;
                }

                try {
                  const parsed = JSON.parse(data);
                  if (parsed.content) {
                    fullResponse += parsed.content;
                  }
                  if (parsed.citations) {
                    console.log(`\n📚 Citations: ${parsed.citations.join(', ')}`);
                  }
                  if (parsed.fallback) {
                    console.log('\n⚠️  FAQ Fallback Mode');
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }

        if (fullResponse) {
          console.log(`\n💬 AI Response:\n${fullResponse}`);
        }
      } else {
        const jsonResponse = await response.json();
        console.log('✅ JSON response received');
        console.log(`💬 AI Response:\n${jsonResponse.content || JSON.stringify(jsonResponse, null, 2)}`);
        
        if (jsonResponse.citations) {
          console.log(`\n📚 Citations: ${jsonResponse.citations.join(', ')}`);
        }
        if (jsonResponse.fallback) {
          console.log('\n⚠️  FAQ Fallback Mode');
        }
      }
    } catch (error) {
      console.error(`❌ Request failed:`, error);
    }

    console.log('\n' + '━'.repeat(70));
  }

  console.log('\n✅ Chat system test complete!\n');
}

testChat().catch(console.error);
