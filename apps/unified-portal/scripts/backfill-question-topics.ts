import { db } from '@openhouse/db';
import { messages } from '@openhouse/db/schema';
import { sql, isNull, or, eq } from 'drizzle-orm';
import { extractQuestionTopic } from '../lib/question-topic-extractor';

async function backfillQuestionTopics() {
  console.log('Starting question topic backfill...');
  
  const unclassified = await db.select({
    id: messages.id,
    user_message: messages.user_message,
    question_topic: messages.question_topic,
  })
    .from(messages)
    .where(
      sql`${messages.user_message} IS NOT NULL AND ${messages.user_message} != '' AND (${messages.question_topic} IS NULL OR ${messages.question_topic} = 'general_inquiry')`
    );

  console.log(`Found ${unclassified.length} messages to classify`);

  let updated = 0;
  let skipped = 0;

  for (const msg of unclassified) {
    if (!msg.user_message || msg.user_message.trim() === '') {
      skipped++;
      continue;
    }

    try {
      const topic = await extractQuestionTopic(msg.user_message);
      
      await db.execute(
        sql`UPDATE messages SET question_topic = ${topic} WHERE id = ${msg.id}`
      );
      
      console.log(`[${updated + 1}] "${msg.user_message.substring(0, 50)}..." → ${topic}`);
      updated++;
    } catch (error) {
      console.error(`Error processing message ${msg.id}:`, error);
    }
  }

  console.log(`\nBackfill complete: ${updated} updated, ${skipped} skipped`);
}

backfillQuestionTopics()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
