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
  | 'log_rental_viewing'
  | 'create_applicant'
  | 'flag_applicant_preferred'
  | 'draft_application_invitation'
  | 'draft_vendor_update'
  | 'draft_viewing_followup_buyer'
  | 'draft_offer_response'
  | 'draft_price_reduction_notice'
  | 'draft_chain_update_to_buyer'
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
  /**
   * Populated when a single extracted action fans out to multiple draft rows
   * (today only draft_price_reduction_notice). targetId is the first row so
   * existing consumers keep working; targetIds is the full list.
   */
  targetIds?: string[];
  /**
   * Count of recipients — used by the natural-language summary
   * ("drafted the notice for 3 buyers").
   */
  recipientCount?: number;
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
  /**
   * Session 4B: sequential execution returns ids that later actions in the
   * same batch might reference. log_rental_viewing emits created applicant
   * ids keyed by lowercased name, plus the rental_viewing_id; subsequent
   * flag_applicant_preferred / draft_application_invitation actions resolve
   * their applicant_name / letting_property_id against this map.
   */
  meta?: {
    rentalViewingId?: string;
    applicantsByName?: Record<string, string>;
    lettingPropertyId?: string;
    applicationId?: string;
    draftId?: string;
  };
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
    name: 'draft_viewing_followup_buyer',
    description:
      'Draft a follow-up email to a buyer (or pair of attendees) after a viewing. Choose this when the agent describes a viewing they want to follow up on, or when a log_viewing action is also firing and the agent mentions thanking the attendees / sending more info. Reference anything specific the buyer cared about (e.g. garden, commute, schools) directly in the body so it does not read like a template.',
    input_schema: {
      type: 'object',
      properties: {
        viewing_id: {
          type: 'string',
          description:
            'The logged viewing id if known, otherwise a short human reference like "14 Oakfield viewing this morning". Leave empty if the voice capture does not reference a viewing.',
        },
        recipient_id: {
          type: 'string',
          description:
            'Buyer identifier. A contact id, a listing id whose buyer_name matches, or a name like "Murphys" if nothing stronger is available.',
        },
        subject: {
          type: 'string',
          description:
            'Short natural subject line, e.g. "Great to meet you at 14 Oakfield".',
        },
        body: {
          type: 'string',
          description:
            'Full email body in Irish peer-to-peer tone. Reference specific things the agent mentioned during the viewing. No em dashes, no emoji.',
        },
        tone: {
          type: 'string',
          enum: ['warm', 'straightforward'],
        },
        include_similar_properties: {
          type: 'boolean',
          description:
            'True when the buyer said the property was not quite right but they are still looking.',
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['recipient_id', 'body', 'tone', 'include_similar_properties', '_confidence'],
    },
  },
  {
    name: 'draft_offer_response',
    description:
      'Draft a reply to a buyer who has put in an offer. Use for accept, counter, reject, or acknowledge-and-pass-to-vendor. For a counter the new amount must be clearly in the body. For a reject the tone stays professional and leaves the door open without being mealy-mouthed. For acknowledge the body is a short "thanks, I will come back once I have spoken to the vendor".',
    input_schema: {
      type: 'object',
      properties: {
        offer_id: {
          type: 'string',
          description:
            'The offer record id if known, otherwise a human reference like "Murphys offer on 14 Oakfield".',
        },
        recipient_id: {
          type: 'string',
          description: 'Buyer or buyer-solicitor identifier.',
        },
        action: {
          type: 'string',
          enum: ['accept', 'counter', 'reject', 'acknowledge'],
        },
        counter_amount: {
          type: 'number',
          description: 'Only when action=counter. EUR. Omit for other actions.',
        },
        counter_conditions: {
          type: 'string',
          description:
            'Optional extra conditions attached to a counter (e.g. "subject to contract by end of month"). Empty string otherwise.',
        },
        subject: {
          type: 'string',
          description: 'Short subject line that makes the action clear.',
        },
        body: {
          type: 'string',
          description:
            'Email body. Irish peer-to-peer tone, no em dashes, no emoji. For counters include the amount and any conditions explicitly. For acknowledge the body is short.',
        },
        tone: {
          type: 'string',
          enum: ['warm', 'firm'],
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['offer_id', 'recipient_id', 'action', 'body', 'tone', '_confidence'],
    },
  },
  {
    name: 'draft_price_reduction_notice',
    description:
      'Draft a price reduction notice to active buyers who have viewed or enquired about a specific property. One email per recipient, each read personally (e.g. "Hi Mary,"). Use when the agent says something like "the vendor dropped to 450, tell anyone who viewed".',
    input_schema: {
      type: 'object',
      properties: {
        property_id: {
          type: 'string',
          description: 'Listing id or short reference like "14 Oakfield".',
        },
        old_price: {
          type: 'number',
          description: 'Previous asking price in EUR.',
        },
        new_price: {
          type: 'number',
          description: 'Updated asking price in EUR.',
        },
        recipient_ids: {
          type: 'array',
          description:
            'Array of buyer identifiers (ids or names) who should receive the notice. Each row becomes its own independently-sendable draft.',
          items: { type: 'string' },
        },
        subject: {
          type: 'string',
          description: 'Short subject line, e.g. "Price update on 14 Oakfield".',
        },
        body_template: {
          type: 'string',
          description:
            'Body template, personalised per recipient. Use the literal token {first_name} where the buyer greeting should go; the server swaps it in. Irish peer-to-peer tone, no em dashes.',
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: [
        'property_id',
        'old_price',
        'new_price',
        'recipient_ids',
        'body_template',
        '_confidence',
      ],
    },
  },
  {
    name: 'draft_chain_update_to_buyer',
    description:
      'Proactive update to a buyer whose chain is moving (or not moving). Triggered by the agent mentioning survey, solicitor instructed, contracts issued, contracts exchanged, completion, or a delay. Tone is reassuring by default and straightforward if the update is factual.',
    input_schema: {
      type: 'object',
      properties: {
        buyer_id: { type: 'string' },
        property_id: { type: 'string' },
        update_type: {
          type: 'string',
          enum: [
            'survey_completed',
            'solicitor_instructed',
            'contracts_issued',
            'delay_expected',
            'contracts_exchanged',
            'custom',
          ],
        },
        custom_detail: {
          type: 'string',
          description:
            'Only when update_type=custom. Empty string otherwise.',
        },
        subject: { type: 'string' },
        body: {
          type: 'string',
          description:
            'Email body. Irish peer-to-peer tone. State what just happened and what the next step is. No em dashes.',
        },
        tone: {
          type: 'string',
          enum: ['reassuring', 'straightforward'],
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: [
        'buyer_id',
        'property_id',
        'update_type',
        'body',
        'tone',
        '_confidence',
      ],
    },
  },
  {
    name: 'log_rental_viewing',
    description:
      'Log a rental viewing that has just happened (or was recounted) for a letting agent. Trigger phrases: "X people came to see", "showed 14 Oakfield today", "viewing for [rental property]". Always populate attendees with every person or couple mentioned, even if only by surname like "the O\'Sheas".',
    input_schema: {
      type: 'object',
      properties: {
        letting_property_id: {
          type: 'string',
          description:
            'A letting property id or a short reference like "14 Oakfield" or "the Rathmines one". The server fuzzy-matches against agent_letting_properties, so a human reference is fine — but keep the _confidence for this field below 0.7 if you are not sure which property was meant.',
        },
        viewing_date: {
          type: 'string',
          description:
            'ISO 8601 datetime of the viewing. Default to now in Europe/Dublin if the agent is describing a viewing that just happened.',
        },
        viewing_type: {
          type: 'string',
          enum: ['individual', 'group', 'open_house'],
        },
        attendees: {
          type: 'array',
          description: 'Every person or couple who attended the viewing.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contact_if_known: { type: 'string' },
              was_preferred: {
                type: 'boolean',
                description:
                  'Set true when the agent clearly says this attendee was their standout (e.g. "the O\'Sheas were miles ahead"). Otherwise false or omit.',
              },
              notes: {
                type: 'string',
                description:
                  'Anything specific the agent mentioned about this attendee (jobs, pets, move-in date, etc.). This seeds the bare applicant record.',
              },
              employment_status: {
                type: 'string',
                enum: ['employed', 'self_employed', 'student', 'unemployed', 'retired', 'unknown'],
              },
              employer: { type: 'string' },
            },
            required: ['name'],
          },
        },
        interest_level: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
        },
        feedback: { type: 'string' },
        next_action: { type: 'string' },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: [
        'letting_property_id',
        'viewing_date',
        'viewing_type',
        'attendees',
        'interest_level',
        'feedback',
        'next_action',
        '_confidence',
      ],
    },
  },
  {
    name: 'create_applicant',
    description:
      'Create an applicant record outside a viewing — phone enquiries, walk-ins, referrals. Do NOT use this for attendees at a viewing (log_rental_viewing creates those automatically).',
    input_schema: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        employment_status: {
          type: 'string',
          enum: ['employed', 'self_employed', 'student', 'unemployed', 'retired', 'unknown'],
        },
        employer: { type: 'string' },
        annual_income: { type: 'number' },
        household_size: { type: 'number' },
        has_pets: { type: 'boolean' },
        pet_details: { type: 'string' },
        smoker: { type: 'boolean' },
        budget_monthly: { type: 'number' },
        source: {
          type: 'string',
          enum: ['daft', 'myhome', 'rent_ie', 'facebook', 'walk_in', 'word_of_mouth', 'other', 'unknown'],
        },
        notes: { type: 'string' },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['full_name', '_confidence'],
    },
  },
  {
    name: 'flag_applicant_preferred',
    description:
      'Mark one attendee of a just-logged rental viewing as the agent\'s preferred applicant. Use this when the agent says things like "the O\'Sheas were miles ahead", "prefer the young couple". Always refer to the applicant by the same name used in the attendees list of the matching log_rental_viewing action.',
    input_schema: {
      type: 'object',
      properties: {
        applicant_name: {
          type: 'string',
          description:
            'Name or surname exactly as used in the log_rental_viewing attendees list. The server matches against that list, then falls back to recent applicants for the agent.',
        },
        rental_viewing_ref: {
          type: 'string',
          description:
            'Optional hint tying this preference to a specific viewing — a property reference like "14 Oakfield" is fine. If omitted, the server uses the most recent log_rental_viewing in the same batch.',
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['applicant_name', '_confidence'],
    },
  },
  {
    name: 'draft_application_invitation',
    description:
      'Draft the "please complete the application form" email to a preferred applicant for a specific rental property. Use when the agent says "ask them to apply", "send them the form", "invite them to apply". Creates an application record in status=invited alongside the draft.',
    input_schema: {
      type: 'object',
      properties: {
        applicant_name: {
          type: 'string',
          description:
            'Name or surname of the applicant to invite. The server matches against same-batch created applicants first, then the agent\'s recent applicants list.',
        },
        letting_property_id: {
          type: 'string',
          description:
            'Letting property the application is for. Short reference (e.g. "14 Oakfield") is fine — the server resolves it.',
        },
        subject: { type: 'string' },
        body: {
          type: 'string',
          description:
            'Full email body, Irish peer-to-peer tone, no em dashes, no emoji. Reference the property by address, greet the applicant by first name, and include the placeholder link token {application_link} exactly once where the application URL belongs.',
        },
        tone: {
          type: 'string',
          enum: ['warm', 'straightforward'],
        },
        _confidence: CONFIDENCE_SCHEMA,
      },
      required: ['applicant_name', 'letting_property_id', 'body', 'tone', '_confidence'],
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
    case 'log_rental_viewing': {
      const property = action.fields?.letting_property_id;
      return property ? `Log rental viewing at ${property}` : 'Log rental viewing';
    }
    case 'create_applicant': {
      const name = action.fields?.full_name;
      return name ? `Create applicant: ${name}` : 'Create applicant';
    }
    case 'flag_applicant_preferred': {
      const name = action.fields?.applicant_name;
      return name ? `Flag ${name} as preferred` : 'Flag preferred applicant';
    }
    case 'draft_application_invitation': {
      const name = action.fields?.applicant_name;
      return name ? `Invite ${name} to apply` : 'Draft application invitation';
    }
    case 'draft_vendor_update': {
      const vendor = action.fields?.vendor_id;
      return vendor ? `Draft vendor update for ${vendor}` : 'Draft vendor update';
    }
    case 'draft_viewing_followup_buyer': {
      const recipient = action.fields?.recipient_id;
      return recipient ? `Draft viewing follow-up for ${recipient}` : 'Draft viewing follow-up';
    }
    case 'draft_offer_response': {
      const actionKind = action.fields?.action;
      const recipient = action.fields?.recipient_id;
      const suffix = recipient ? ` for ${recipient}` : '';
      if (actionKind === 'accept') return `Draft offer acceptance${suffix}`;
      if (actionKind === 'counter') return `Draft counter-offer${suffix}`;
      if (actionKind === 'reject') return `Draft offer decline${suffix}`;
      return `Draft offer acknowledgement${suffix}`;
    }
    case 'draft_price_reduction_notice': {
      const count = Array.isArray(action.fields?.recipient_ids)
        ? action.fields.recipient_ids.length
        : 0;
      const property = action.fields?.property_id;
      const scope = count > 0 ? ` for ${count} buyer${count === 1 ? '' : 's'}` : '';
      return property
        ? `Draft price reduction notice on ${property}${scope}`
        : `Draft price reduction notice${scope}`;
    }
    case 'draft_chain_update_to_buyer': {
      const buyer = action.fields?.buyer_id;
      return buyer ? `Draft chain update for ${buyer}` : 'Draft chain update';
    }
    case 'create_reminder':
      return 'Set reminder';
    default:
      return action.type;
  }
}

export const LOW_CONFIDENCE_THRESHOLD = 0.7;
