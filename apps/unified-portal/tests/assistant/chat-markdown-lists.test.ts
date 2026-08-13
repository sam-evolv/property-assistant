/**
 * Regression guards for ordered-list rendering in assistant replies.
 *
 * The bug: every numbered item was emitted as its own single-item <ol>, so a
 * three-point answer rendered as "1. … 1. … 1. …" in the homeowner bubble.
 * The cause was two-fold — indented sub-bullets did not match the list regex
 * (they ended the run and fell through as literal "- text" paragraphs), and a
 * blank line between items ended the run as well.
 *
 * Hermetic — pure string functions, no Supabase, no network.
 */

import { cleanForDisplay, normalizeWhitespace, renderChatMarkdown } from '../../lib/assistant/formatting';

const render = (markdown: string) => renderChatMarkdown(cleanForDisplay(markdown), { codeClassName: 'code' });

const countOccurrences = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('ordered lists number 1, 2, 3', () => {
  it('keeps numbered items with nested bullets in a single <ol>', () => {
    const html = render(
      [
        'Here are some tips to get you started:',
        '',
        '1. Choose the Right Plants:',
        '   - Opt for native plants as they suit the local climate.',
        '   - Use perennials that come back year after year.',
        '',
        '2. Mulching:',
        '   - Apply a layer of mulch to retain moisture.',
        '',
        '3. Automatic Irrigation:',
        '   - Install a drip irrigation system.',
      ].join('\n'),
    );

    // One list, three items — the browser's own counter then renders 1, 2, 3.
    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(countOccurrences(html, '<li>')).toBe(3 + 4); // 3 numbered + 4 nested bullets
    expect(html).toContain('list-decimal');
    // Sub-bullets nest inside their item instead of leaking out as plain text.
    expect(countOccurrences(html, '<ul')).toBe(3);
    expect(html).not.toContain('- Opt for native plants');
  });

  it('renumbers a list the model wrote as "1." every time', () => {
    const html = render(['1. First', '1. Second', '1. Third'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(countOccurrences(html, '<li>')).toBe(3);
    // No start override: the <ol> counter supplies 1, 2, 3.
    expect(html).not.toContain('start=');
  });

  it('does not split the list on blank lines between items', () => {
    const html = render(['1. First', '', '2. Second', '', '3. Third'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(countOccurrences(html, '<li>')).toBe(3);
  });

  it('accepts "1)" style markers', () => {
    const html = render(['1) First', '2) Second'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(countOccurrences(html, '<li>')).toBe(2);
  });

  it('resumes the count when a paragraph interrupts a numbered list', () => {
    const html = render(['1. First', '2. Second', '', 'A note in between.', '', '3. Third'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(2);
    expect(html).toContain('<ol start="3"');
  });
});

describe('list structure', () => {
  it('nests three levels deep', () => {
    const html = render(['- Top', '  - Middle', '    - Bottom'].join('\n'));

    expect(countOccurrences(html, '<ul')).toBe(3);
    expect(countOccurrences(html, '<li>')).toBe(3);
  });

  it('keeps a bullet list following a numbered list separate', () => {
    const html = render(['1. First', '2. Second', '', '- Loose bullet', '- Another bullet'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(countOccurrences(html, '<ul')).toBe(1);
    expect(countOccurrences(html, '<li>')).toBe(4);
  });

  it('folds a wrapped continuation line into the item above it', () => {
    const html = render(['1. First point', '   wrapped onto a second line', '2. Second point'].join('\n'));

    expect(countOccurrences(html, '<li>')).toBe(2);
    expect(html).toContain('First point wrapped onto a second line');
  });

  it('leaves a blank line before prose ending the list', () => {
    const html = render(['1. First', '2. Second', '', 'Closing thought.'].join('\n'));

    expect(countOccurrences(html, '<ol')).toBe(1);
    expect(html).toContain('<p>Closing thought.</p>');
  });
});

describe('streaming reveal safety', () => {
  it('renders every prefix of a list answer without throwing', () => {
    const full = ['Tips:', '', '1. Choose plants:', '   - Native species', '', '2. Mulching:'].join('\n');

    for (let length = 1; length <= full.length; length++) {
      const html = renderChatMarkdown(full.slice(0, length), { codeClassName: 'code' });
      expect(typeof html).toBe('string');
    }
  });

  it('leaves a bare marker with no text as plain text', () => {
    const html = renderChatMarkdown('1.', { codeClassName: 'code' });

    expect(html).not.toContain('<ol');
  });
});

describe('normalizeWhitespace', () => {
  it('preserves leading indentation so nesting depth survives', () => {
    const result = normalizeWhitespace(['1. Item', '    - Nested', '        - Deeper'].join('\n'));

    expect(result).toContain('\n    - Nested');
    expect(result).toContain('\n        - Deeper');
  });

  it('still collapses runs of spaces inside a line', () => {
    expect(normalizeWhitespace('word     word')).toBe('word  word');
  });
});
