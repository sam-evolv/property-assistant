/**
 * Lightweight keyword classifier: does the user's message read as an
 * action request (schedule a viewing, add an applicant, cancel X) or
 * an info request (how many, what's the status)?
 *
 * Used by the chat route to suppress legacy followup chips on action
 * messages. The previous gate only suppressed when a draft frame was
 * emitted, but a tool returning needs_clarification doesn't emit a
 * draft, so chips like "Draft a follow-up email" leaked back through.
 *
 * Irish-English aware: "pencil in" is a real phrase letting agents
 * use, alongside the more universal verbs.
 */

const ACTION_KEYWORDS: string[] = [
  'schedule',
  'book',
  'create',
  'add',
  'remove',
  'delete',
  'cancel',
  'update',
  'change',
  'reschedule',
  'move',
  'mark',
  'log',
  'set up',
  'sign up',
  'put down',
  'pencil in',
];

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isActionMessage(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  for (const kw of ACTION_KEYWORDS) {
    const regex = new RegExp(`\\b${escapeForRegex(kw)}\\b`);
    if (regex.test(lower)) return true;
  }
  return false;
}
