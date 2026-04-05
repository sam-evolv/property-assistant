export interface UserContext {
  id: string;
  auth_user_id: string;
  product: 'homeowner' | 'select' | 'care' | 'agent' | 'developer';
  context_type: 'unit' | 'installation' | 'agent_profile' | 'development' | 'organisation';
  context_id: string;
  display_name: string;
  display_subtitle: string | null;
  display_icon: string | null;
  context_aware: boolean;
  last_active_at: string | null;
  linked_at: string;
}
