/**
 * Playbooks Module
 * 
 * Deterministic, high-value fallback responses for the assistant.
 */

export {
  type PlaybookTopic,
  type PlaybookSection,
  type PlaybookTemplate,
  type SchemeContext,
  PLAYBOOKS,
  getPlaybook,
  getAllPlaybooks,
  detectPlaybookTopic,
} from '../playbook-templates';

export {
  type RenderOptions,
  type PlaybookResponse,
  renderPlaybook,
  renderPlaybookByTopic,
  renderPlaybookSection,
  generatePlaybookResponse,
} from '../renderPlaybook';
