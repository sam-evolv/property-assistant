export interface PromptContext {
  developmentName?: string;
  systemInstructions?: string;
  chunks: Array<{
    content: string;
    documentId: string | null;
    chunkIndex: number;
  }>;
  userMessage: string;
  homeownerName?: string;
  unitNumber?: string;
  houseType?: string;
}

export function buildRAGPrompt(context: PromptContext): string {
  const { developmentName, systemInstructions, chunks, userMessage, homeownerName, unitNumber, houseType } = context;

  const baseSystemPrompt = `You are a helpful AI assistant for ${developmentName || 'this development'}. Your role is to answer questions based ONLY on the provided document context.

CRITICAL RULES:
1. Answer ONLY using information from the provided context documents
2. If the answer is not in the context, say "I don't have information about that in the available documents"
3. Be helpful, accurate, and concise
4. Provide direct answers without unnecessary formalities
5. Never make up or infer information not present in the context

${systemInstructions ? `\nADDITIONAL INSTRUCTIONS:\n${systemInstructions}\n` : ''}

CONTEXT DOCUMENTS:
${chunks.map((chunk, idx) => `[Doc-${idx + 1}]
${chunk.content}
`).join('\n')}

When answering, remember:
- Only use information from the context above
- Be conversational and natural
- Be truthful about what you don't know`;

  return baseSystemPrompt;
}

export function formatSystemMessage(context: PromptContext): {
  role: 'system';
  content: string;
} {
  return {
    role: 'system',
    content: buildRAGPrompt(context),
  };
}

export function extractCitations(message: string): string[] {
  const citationRegex = /\[Doc-(\d+)\]/g;
  const citations: string[] = [];
  let match;

  while ((match = citationRegex.exec(message)) !== null) {
    citations.push(match[1]);
  }

  return [...new Set(citations)];
}

export function buildSourcesFromCitations(
  citations: string[],
  chunks: Array<{
    documentId: string | null;
    chunkIndex: number;
  }>
): Array<{
  documentId: string;
  chunkIndex: number;
}> {
  return citations
    .map((citationIdx) => {
      const idx = parseInt(citationIdx) - 1;
      if (idx >= 0 && idx < chunks.length && chunks[idx].documentId) {
        return {
          documentId: chunks[idx].documentId!,
          chunkIndex: chunks[idx].chunkIndex,
        };
      }
      return null;
    })
    .filter((source): source is { documentId: string; chunkIndex: number } => source !== null);
}
