# Assistant Operating System

Central governance layer for the OpenHouse AI assistant that prevents hallucinations, enforces source priority, and handles emergency triage.

## Features

### Intent Classification

Classifies user messages into categories:
- `scheme_fact` - Questions about the development/scheme
- `unit_fact` - Questions about the user's specific home
- `document_answer` - Requests for documents/certificates
- `location_amenities` - Nearby places and amenities
- `how_to_playbook` - How-to instructions
- `sensitive_subjective` - Subjective opinions or complaints
- `emergency` - Safety/emergency situations

### Emergency Triage (3 Tiers)

**Tier 1 - Life Safety**
- Fire, gas smell, sparking, electrocution
- Flooding near electrical equipment
- Carbon monoxide detection
- Response: Advise 999/112 and immediate safety steps

**Tier 2 - Property Emergency**
- Major leak, burst pipe
- Power outage
- Heating failure in cold conditions
- Alarm faults
- Response: Advise scheme emergency contact or managing agent

**Tier 3 - Non-Urgent**
- Minor defects, snagging
- Small leaks, cosmetic issues
- Response: Standard reporting channels

### Source Priority

1. Structured Data (scheme_profile, unit_profile)
2. Smart Archive (validated documents)
3. Google Places (location queries)
4. Playbooks (how-to guides)
5. Escalation (when no source available)

### Answer Modes

- `grounded` - Only factual information from verified sources
- `guided` - Helpful guidance based on available context
- `neutral` - Non-committal for sensitive topics

### Warranty Boundaries

- Appliance issues: Manufacturer/retailer warranty
- Structural issues: Developer/NHBC warranty
- Never mentions specific time periods unless sourced from documents

## Usage

```typescript
import { 
  classifyIntent, 
  getAnswerStrategy,
  detectEmergencyTier,
  getTier1Response,
  getTier2Response,
} from '@/lib/assistant/os';

// Classify user intent
const intent = classifyIntent(userMessage);

// Get answer strategy
const strategy = getAnswerStrategy(intent);

// Handle emergencies
if (intent.emergencyTier === 1) {
  return getTier1Response();
}
```

## Feature Flag

Set `FEATURE_ASSISTANT_OS=false` to disable and fall back to legacy behavior.

## Testing Scenarios

### Emergency Triage Tests

| Input | Expected Tier |
|-------|---------------|
| "I smell gas in the kitchen" | Tier 1 |
| "Sparks coming from socket" | Tier 1 |
| "Carbon monoxide alarm beeping" | Tier 1 |
| "Major leak, water everywhere" | Tier 2 |
| "No power in the flat" | Tier 2 |
| "Boiler broken, no heating" | Tier 2 |
| "Small crack in the wall" | Tier 3 |
| "Door handle is loose" | Tier 3 |
| "What are bin days?" | null |

### Warranty Boundary Tests

| Input | Expected Type |
|-------|---------------|
| "Dishwasher not working" | appliance |
| "Washing machine broken" | appliance |
| "Crack in the wall" | structural |
| "Damp problem" | structural |
| "Something is broken" | unknown |

### No Hallucination Tests

- Responses should not contain:
  - Specific times (e.g., "9am-5pm") unless from documents
  - Phone numbers unless from scheme_profile
  - Fee amounts unless from documents
  - Deadline dates unless from documents
