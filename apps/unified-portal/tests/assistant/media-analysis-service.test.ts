import { strict as assert } from 'node:assert';
import {
  buildHousingReasoningPrompt,
  normalizeMediaAnalysisOutput,
  sanitizeAnalysisText,
} from '../../lib/assistant/mediaAnalysisService';

const prompt = buildHousingReasoningPrompt({
  developmentName: 'Longview Park',
  developmentCode: 'LVP',
  unitLabel: '12A',
  propertyType: 'house',
  messageText: 'There is a damp patch on the ceiling near the stairwell.',
  mediaCount: 2,
});

assert.match(prompt, /JSON only/i, 'prompt should force JSON-only output');
assert.match(prompt, /do not invent/i, 'prompt should forbid invention');
assert.match(prompt, /residentMessage/i, 'prompt should mention residentMessage');
assert.match(prompt, /developerSummary/i, 'prompt should mention developerSummary');
assert.match(prompt, /urgent/i, 'prompt should mention urgent escalation handling');

assert.equal(
  sanitizeAnalysisText('Ceiling leak — urgent — above the window.'),
  'Ceiling leak - urgent - above the window.',
);

const normalized = normalizeMediaAnalysisOutput({
  residentMessage: 'We should have a plumber look at it — soon.',
  developerSummary: 'Possible plumbing leak in the first-floor ceiling.',
  action: 'escalate_issue',
  structured: {
    issue_type: 'plumbing',
    issue_category: 'plumbing',
    room: 'stairs',
    visible_features: ['Water staining on ceiling'],
    severity_score: 0.87,
    severity_label: 'high',
    confidence_score: 0.87,
    safety_risk: true,
    safety_risk_type: 'water near electrics',
    likely_trade: 'plumber',
    likely_system: 'pipe run',
    potential_causes: ['Active leak in an upstairs pipe run.'],
    recommended_action: 'Arrange a plumber to inspect the ceiling leak.',
    resident_guidance: 'Keep the area clear and avoid using the room if the leak worsens.',
    needs_more_info: false,
    more_info_requested: [],
    should_create_issue: true,
    should_escalate: true,
    escalation_level: 'urgent',
    requires_human_review: true,
    warranty_relevant: true,
    similar_issue_check_required: false,
    developer_summary: 'Possible plumbing leak in the first-floor ceiling.',
  },
});

assert.equal(normalized.residentMessage, 'We should have a plumber look at it - soon.');
assert.equal(normalized.action, 'escalate_issue');
assert.equal(normalized.structured.issue_type, 'plumbing');
assert.equal(normalized.structured.safety_risk, true);
assert.equal(normalized.structured.severity_label, 'high');
