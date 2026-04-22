/**
 * Voice action contract shared between extraction (Claude tool schemas)
 * and execution (Supabase writes + undo reversal payloads).
 *
 * Session 1 ships three action types:
 *   - log_viewing
 *   - draft_vendor_update
 *   - create_reminder
 *
 * Extending later: add a new entry to ACTION_TOOLS and handle it in
 * /api/agent/intelligence/execute-actions.
 */

export type VoiceActionType =
  | 'log_viewing'
  | 'draft_vendor_update'
  | 'create_reminder';

export type ConfidenceMap = Record<string, number>;

export interface ExtractedAction {
  id: string;
  type: VoiceActionType | string;
  fields: Record<string, any>;
  confidence: ConfidenceMap;
}

export interface ExecutedAction {
  id: string;
  type: VoiceActionType | string;
  success: boolean;
  targetId?: string;
  message: string;
  error?: string;
  /**
   * Session 3: when the user has turned on auto-send for the draft_type and
   * every gate passes (confidence, active hours, trust floor, global kill
   * switch), the server returns a plan here. The client renders a countdown
   * and either fires send-draft when it elapses or cancels and flips the
   * draft back to pending_review.
   */
  autoSendPlan?: {
    draftId: string;
    draftType: string;
    countdownSeconds: number;
    recipientName: string;
  } | null;
  /**
   * When auto-send was considered but blocked by a gate, the human-friendly
   * reason shows as a one-liner under the action in the confirmation card.
   */
  autoSendHold?: string | null;
}

const CONFIDENCE_SCHEMA = {
  type: 'object',
  description:
    'Map each field name in the tool input to a confidence score between 0 and 1. Fields below 0.7 render with an amber underline in the UI so the user can double-check them.',
  additionalProperties: { type: 'number' },
};

/**
 * Anthropic tool definitions — the model emits a tool_use block per extracted
 * action. Every tool schema includes a required `_confidence` field so the UI
 * can distinguish confident values from guesses.
 */
export const ACTION_TOOLS = [
  {
    name: 'log_viewing',
    description:
      'Log a viewing that has just happened or is being recounted. Use when the agent describes attendees, a property, and any feedback from the viewing.',
    input_schema: {
      type: 'object',
      properties: {
        property_id: {
          type: 'string',
          description:
            'The listing id or a short human reference to the property (e.g. "14 Oakfield") when the id is not known.',
        },
        attendees: {
          type: 'array',
          description: 'People who attended the viewing.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contact_if_known: {
                type: 'string',
                description: 'Phone or email if mentioned. Leave empty otherwise.',
              },
            },
            required: ['name'],
          },
        },
        viewing_date: {
          type: 'string',
          description:
            'ISO 8601 datetime of the viewing. Default to now in Europe/Dublin if the transcript does not state a time.',
        },
        interest_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        objections: {
          type: 'string',
          description: 'Concerns raised by the attendees. Empty string if none.',
        },
        feedback: {
          type: 'string',
          description: 'Overall feedback the attendees gave.',
        },
        next_action: {
          type: 'string',
          description:
            'What the agent plans to do next (e.g. "follow up Monday").',
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: [
        'property_id',
        'attendees',
        'viewing_date',
        'interest_level',
        'feedback',
        '_confidence',
      ],
    },
  },
  {
    name: 'draft_vendor_update',
    description:
      'Draft an update to the vendor of a property. Does not send — the draft is stored for review in a later session.',
    input_schema: {
      type: 'object',
      properties: {
        vendor_id: {
          type: 'string',
          description:
            'The listing id whose vendor should receive the update, or a property reference if the id is unknown.',
        },
        update_summary: {
          type: 'string',
          description:
            'What the agent wants to tell the vendor. Casual Irish peer-to-peer tone. No em dashes.',
        },
        tone: {
          type: 'string',
          enum: ['casual', 'formal'],
        },
        send_method: {
          type: 'string',
          enum: ['email', 'whatsapp', 'sms'],
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: [
        'vendor_id',
        'update_summary',
        'tone',
        'send_method',
        '_confidence',
      ],
    },
  },
  {
    name: 'create_reminder',
    description:
      'Create a reminder / task the agent wants to be nudged on later.',
    input_schema: {
      type: 'object',
      properties: {
        reminder_text: { type: 'string' },
        due_date: {
          type: 'string',
          description:
            'ISO 8601 datetime in Europe/Dublin when the agent wants to be reminded.',
        },
        related_entity_id: {
          type: 'string',
          description:
            'Optional — a listing id, viewing id, or contact id this reminder relates to.',
        },
        related_entity_type: {
          type: 'string',
          enum: ['listing', 'viewing', 'contact', 'vendor', 'none'],
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['reminder_text', 'due_date', '_confidence'],
    },
  },
] as const;

/**
 * Human-facing labels used by the confirmation card header.
 */
export function actionLabel(action: ExtractedAction): string {
  switch (action.type) {
    case 'log_viewing':
      return 'Log viewing';
    case 'draft_vendor_update': {
      const vendor = action.fields?.vendor_id;
      return vendor ? `Draft vendor update for ${vendor}` : 'Draft vendor update';
    }
    case 'create_reminder':
      return 'Set reminder';
    default:
      return action.type;
  }
}

export const LOW_CONFIDENCE_THRESHOLD = 0.7;
