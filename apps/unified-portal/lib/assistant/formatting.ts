/**
 * Formatting utilities for assistant responses.
 *
 * `sanitizeForChat` neutralises unsupported or unsafe markdown (code blocks,
 * images, links, blockquotes, horizontal rules) and caps heading levels, while
 * preserving the inline and list markers the chat renderer styles: bold,
 * italic, inline code, h3/h4 headings, and ordered/unordered lists. It also
 * renumbers ordered lists so a model that emits "1." for every item (a very
 * common failure mode) renders 1, 2, 3 rather than 1, 1, 1.
 *
 * `renderChatMarkdown` turns that preserved markdown into safe HTML for the
 * chat bubbles. It HTML-escapes first, so model output can never inject markup,
 * then maps the supported markers to styled elements. Both the homeowner
 * (PurchaserChatTab) and care (AssistantScreen) bubbles render through it so the
 * markdown looks the same across the product.
 */

/**
 * Renumber ordered-list items so their numbers run sequentially.
 *
 * Models frequently emit "1." for every item, or restart numbering, especially
 * when each numbered item is followed by indented sub-bullets. The chat renderer
 * builds a separate <ol> per fragment, and each <ol> with list-decimal would
 * otherwise start again at 1, so the user sees 1, 1, 1, 1.
 *
 * This walks the text and rewrites the leading number of each ordered-list line
 * to an incrementing counter. Blank lines and sub-bullet lines (-, *) do not
 * break the sequence, so a numbered item with bullets under it still counts. Any
 * other non-list line ends the current list and resets the counter, so two
 * genuinely separate lists each start at 1.
 */
export function renumberOrderedLists(text: string): string {
  const lines = text.split('\n');
  const numberedRe = /^(\s*)\d+\.\s+(.+)$/;
  const bulletRe = /^(\s*)[-*•]\s+/;
  let counter = 0;
  let inOrdered = false;

  for (let i = 0; i < lines.length; i++) {
    const m = numberedRe.exec(lines[i]);
    if (m) {
      counter += 1;
      inOrdered = true;
      lines[i] = `${m[1]}${counter}. ${m[2]}`;
      continue;
    }
    if (inOrdered) {
      // Sub-bullets and blank lines belong to the current ordered item; they do
      // not break or reset the sequence.
      if (lines[i].trim() === '' || bulletRe.test(lines[i])) {
        continue;
      }
      // Any other content ends the ordered list; the next "1." starts fresh.
      inOrdered = false;
      counter = 0;
    }
  }

  return lines.join('\n');
}

export function sanitizeForChat(text: string): string {
  let result = text;

  // Flatten fenced code blocks to their inner text (code blocks are not rendered).
  result = result.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, content) => content.trim());

  // Images are not supported: drop them (must run before the link rule, since
  // an image is a link with a leading "!").
  result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // Links are not supported as links: keep the visible text, drop the URL.
  result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Cap heading levels: h3 and h4 are the only sizes the bubble renders, so
  // fold h1/h2/h5/h6 down. Markers are kept for the renderer to style.
  result = result.replace(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm, (_, hashes: string, rest: string) => {
    const level = hashes.length === 4 ? 4 : 3;
    return `${'#'.repeat(level)} ${rest}`;
  });

  // Horizontal rules are not supported: remove the line.
  result = result.replace(/^---+$/gm, '');
  result = result.replace(/^\*\*\*+$/gm, '');
  result = result.replace(/^___+$/gm, '');

  // Blockquotes are not supported: keep the text, drop the leading "> " marker.
  result = result.replace(/^>\s+(.+)$/gm, '$1');

  // Renumber ordered lists so repeated or restarted "1." items count correctly.
  result = renumberOrderedLists(result);

  // Collapse runs of blank lines and trim trailing whitespace per line.
  result = result.replace(/\n{3,}/g, '\n\n');
  result = result.split('\n').map((line) => line.trimEnd()).join('\n');
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

// A control char that never appears in chat text or in the markup we generate,
// used to fence stashed inline-code contents while the other passes run.
const CODE_SENTINEL = String.fromCharCode(0);

/**
 * Render the supported markdown subset to HTML for a chat bubble.
 *
 * Supports: bold, italic, inline code, h3/h4 headings, and ordered/unordered
 * lists. Everything else is treated as plain text. Callers pass the inline-code
 * background via `codeClassName` (light/dark differs by surface) and may pass a
 * `transformParagraph` hook to layer extra prose rules (auto-linking, smart
 * typography, etc.) onto paragraph text only.
 *
 * Safe to call on partial input during a word-by-word reveal: incomplete markers
 * (e.g. a "**" with no closing pair yet) are left as literal text until the
 * closing marker arrives, so nothing flashes or throws.
 */
export function renderChatMarkdown(
  content: string,
  options: { codeClassName: string; transformParagraph?: (text: string) => string },
): string {
  if (!content) return '';

  // 1. Escape HTML. From here on, only the tags we generate are real markup.
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Defence in depth: strip unsupported markdown that may have slipped past
  //    the sanitiser (flatten code fences, drop images, links to plain text).
  html = html.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => code.trim());
  html = html.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');
  html = html.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 3. Inline code first: stash contents behind the sentinel so later passes
  //    cannot reparse them.
  const codeSpans: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, code) => {
    codeSpans.push(code);
    return `${CODE_SENTINEL}${codeSpans.length - 1}${CODE_SENTINEL}`;
  });

  // 4. Bold and italic. Markers never span a line break.
  html = html.replace(/\*\*\*([^*\n]+?)\*\*\*/g, '<strong class="font-semibold"><em>$1</em></strong>');
  html = html.replace(/___([^_\n]+?)___/g, '<strong class="font-semibold"><em>$1</em></strong>');
  html = html.replace(/\*\*([^*\n]+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/__([^_\n]+?)__/g, '<strong class="font-semibold">$1</strong>');
  // Italic on the residue. Require a non-space after the marker so "* item"
  // bullets and snake_case identifiers are left alone.
  html = html.replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?![_\w])/g, '$1<em>$2</em>');

  // 5. Block pass: headings and lists, line by line. Consecutive list lines of
  //    the same kind collapse into one <ul>/<ol>; a blank line or a different
  //    block ends the run. Ordered items carry their literal number through to
  //    an <li value="N">, so a list that fragments into several <ol> blocks
  //    (numbered item, then sub-bullets, then the next numbered item) still
  //    shows 1, 2, 3 rather than restarting each fragment at 1.
  const lines = html.split('\n');
  const blocks: { kind: 'block' | 'text'; value: string }[] = [];
  const bulletRe = /^[-*•]\s+(.+)$/;
  const numberedRe = /^(\d+)\.\s+(.+)$/;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h4 = /^####\s+(.+?)\s*$/.exec(line);
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h4) {
      blocks.push({ kind: 'block', value: `<h4 class="text-[15px] font-semibold mt-2 mb-1">${h4[1]}</h4>` });
      i++;
    } else if (h3) {
      blocks.push({ kind: 'block', value: `<h3 class="text-base font-semibold mt-3 mb-1">${h3[1]}</h3>` });
      i++;
    } else if (bulletRe.test(line) || numberedRe.test(line)) {
      const ordered = numberedRe.test(line);
      // Items keep their text and, for ordered lists, their literal number.
      const items: { text: string; num: number | null }[] = [];
      let firstNum: number | null = null;
      while (i < lines.length) {
        const bullet = bulletRe.exec(lines[i]);
        const numbered = numberedRe.exec(lines[i]);
        if (ordered && numbered) {
          const num = parseInt(numbered[1], 10);
          if (firstNum === null) firstNum = num;
          items.push({ text: numbered[2], num });
          i++;
        } else if (!ordered && bullet) {
          items.push({ text: bullet[1], num: null });
          i++;
        } else if (lines[i].trim() === '') {
          // A blank line between items is common in model output ("loose"
          // lists). Keep one list together when the next non-blank line
          // continues the same kind, so numbering runs 1, 2, 3 rather than
          // restarting a fresh <ol> per item. Otherwise the list ends here and
          // the blank line falls through to the block loop below.
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          const nextContinues =
            j < lines.length && (ordered ? numberedRe.test(lines[j]) : bulletRe.test(lines[j]));
          if (nextContinues) {
            i = j;
          } else {
            break;
          }
        } else {
          break;
        }
      }
      const tag = ordered ? 'ol' : 'ul';
      const listClass = ordered ? 'list-decimal' : 'list-disc';
      const startAttr = ordered && firstNum !== null && firstNum !== 1 ? ` start="${firstNum}"` : '';
      const lis = items
        .map((item) => {
          const valueAttr = ordered && item.num !== null ? ` value="${item.num}"` : '';
          return `<li${valueAttr}>${item.text}</li>`;
        })
        .join('');
      blocks.push({
        kind: 'block',
        value: `<${tag}${startAttr} class="${listClass} list-outside ml-5 space-y-1 my-2 marker:text-gold-500">${lis}</${tag}>`,
      });
    } else {
      blocks.push({ kind: 'text', value: line });
      i++;
    }
  }

  // 6. Group runs of text lines into paragraphs (blank line or block ends one).
  //    Prose rules apply to paragraph text only, then newlines become <br/>.
  const parts: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    let text = paragraph.join('\n');
    if (options.transformParagraph) {
      text = options.transformParagraph(text);
    }
    text = text.replace(/\n/g, '<br/>');
    parts.push(`<p>${text}</p>`);
    paragraph = [];
  };
  for (const block of blocks) {
    if (block.kind === 'block') {
      flushParagraph();
      parts.push(block.value);
    } else if (block.value.trim() === '') {
      flushParagraph();
    } else {
      paragraph.push(block.value);
    }
  }
  flushParagraph();

  let result = parts.length > 1 ? `<div class="space-y-2">${parts.join('')}</div>` : parts.join('');

  // 7. Restore inline code, kept verbatim and never reparsed.
  const sentinel = new RegExp(`${CODE_SENTINEL}(\\d+)${CODE_SENTINEL}`, 'g');
  result = result.replace(sentinel, (_match, idx) =>
    `<code class="px-1.5 py-0.5 rounded ${options.codeClassName} font-mono text-[13px]">${codeSpans[Number(idx)]}</code>`,
  );

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
