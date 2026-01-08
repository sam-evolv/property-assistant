/**
 * Formatting utilities for assistant responses
 * 
 * Sanitizes markdown and ensures clean output for chat display.
 */

export function sanitizeForChat(text: string): string {
  let result = text;
  
  result = result.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, content) => content.trim());
  
  result = result.replace(/`([^`\n]+)`/g, '$1');
  
  result = result.replace(/\*\*\*([^*]+)\*\*\*/g, '$1');
  result = result.replace(/___([^_]+)___/g, '$1');
  
  result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
  result = result.replace(/__([^_]+)__/g, '$1');
  
  result = result.replace(/(?<!\*)\*(?!\*)([^*\n]+)(?<!\*)\*(?!\*)/g, '$1');
  result = result.replace(/(?<!_)_(?!_)([^_\n]+)(?<!_)_(?!_)/g, '$1');
  
  result = result.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  
  result = result.replace(/^---+$/gm, '');
  result = result.replace(/^\*\*\*+$/gm, '');
  result = result.replace(/^___+$/gm, '');
  
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  
  result = result.replace(/^>\s+(.+)$/gm, '$1');
  
  result = result.replace(/^\d+\.\s+/gm, '- ');
  
  result = result.replace(/\n{3,}/g, '\n\n');
  
  result = result.split('\n').map(line => line.trimEnd()).join('\n');
  
  result = result.trim();
  
  return result;
}

export function removeEmDashes(text: string): string {
  return text.replace(/—/g, '-');
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\t/g, '  ')
    .replace(/ {3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function cleanForDisplay(text: string): string {
  let result = sanitizeForChat(text);
  result = removeEmDashes(result);
  result = normalizeWhitespace(result);
  return result;
}

export function hasMarkdownTokens(text: string): boolean {
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,
    /__[^_]+__/,
    /(?<!\*)\*(?!\*)[^*\n]+(?<!\*)\*(?!\*)/,
    /(?<!_)_(?!_)[^_\n]+(?<!_)_(?!_)/,
    /```[\s\S]*?```/,
    /`[^`]+`/,
    /^#{1,6}\s+/m,
    /^---+$/m,
    /\[([^\]]+)\]\([^)]+\)/,
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
}
