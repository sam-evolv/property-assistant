import { pgTable, serial, varchar, text, timestamp, integer, decimal, jsonb, index, uniqueIndex, uuid, doublePrecision, boolean } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo_url: text('logo_url'),
  brand: jsonb('brand').default(sql`'{}'::jsonb`).notNull(),
  contact: jsonb('contact').default(sql`'{}'::jsonb`).notNull(),
  description: text('description'),
  theme_color: text('theme_color').default('#3b82f6'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  slugIdx: index('slug_idx').on(table.slug),
}));

export const developments = pgTable('developments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  address: text('address'),
  description: text('description'),
  is_active: boolean('is_active').default(true).notNull(),
  created_by: uuid('created_by').references(() => admins.id),
  developer_user_id: uuid('developer_user_id'),
  system_instructions: text('system_instructions'),
  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 9, scale: 6 }),
  logo_url: text('logo_url'),
  important_docs_version: integer('important_docs_version').default(1).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('developments_tenant_idx').on(table.tenant_id),
  codeIdx: index('developments_code_idx').on(table.code),
  developerIdx: index('developments_developer_idx').on(table.developer_user_id),
  createdByIdx: index('developments_created_by_idx').on(table.created_by),
}));

export const houseTypes = pgTable('house_types', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  house_type_code: text('house_type_code').notNull(),
  name: text('name'),
  description: text('description'),
  total_floor_area_sqm: decimal('total_floor_area_sqm', { precision: 10, scale: 2 }),
  room_dimensions: jsonb('room_dimensions').default(sql`'{}'::jsonb`),
  dimensions: jsonb('dimensions'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('house_types_tenant_idx').on(table.tenant_id),
  developmentIdx: index('house_types_development_idx').on(table.development_id),
  tenantDevIdx: index('house_types_tenant_dev_idx').on(table.tenant_id, table.development_id),
  uniqueDevHouseType: uniqueIndex('unique_dev_house_type_idx').on(table.development_id, table.house_type_code),
}));

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('admins_tenant_idx').on(table.tenant_id),
  emailIdx: index('admins_email_idx').on(table.email),
}));

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  house_type_id: uuid('house_type_id').references(() => houseTypes.id),
  house_type_code: text('house_type_code'),
  document_type: text('document_type').notNull(),
  doc_kind: text('doc_kind'),
  discipline: text('discipline'),
  revision_code: varchar('revision_code', { length: 20 }),
  mapping_confidence: doublePrecision('mapping_confidence'),
  auto_mapped: boolean('auto_mapped').default(false).notNull(),
  needs_review: boolean('needs_review').default(false).notNull(),
  title: text('title').notNull(),
  file_name: text('file_name').notNull(),
  relative_path: text('relative_path').notNull(),
  storage_url: text('storage_url'),
  ai_tags: jsonb('ai_tags'),
  original_file_name: text('original_file_name'),
  mime_type: varchar('mime_type', { length: 100 }),
  size_kb: integer('size_kb'),
  file_url: text('file_url'),
  uploaded_by: uuid('uploaded_by').references(() => admins.id),
  version: integer('version').default(1).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  processing_status: varchar('processing_status', { length: 50 }).default('pending').notNull(),
  processing_error: text('processing_error'),
  chunks_count: integer('chunks_count').default(0),
  view_count: integer('view_count').default(0),
  download_count: integer('download_count').default(0),
  is_important: boolean('is_important').default(false).notNull(),
  must_read: boolean('must_read').default(false).notNull(),
  important_rank: integer('important_rank'),
  ai_classified: boolean('ai_classified').default(false).notNull(),
  ai_classified_at: timestamp('ai_classified_at', { withTimezone: true }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('documents_tenant_idx').on(table.tenant_id),
  developmentIdx: index('documents_development_idx').on(table.development_id),
  houseTypeIdx: index('documents_house_type_idx').on(table.house_type_id),
  docTypeIdx: index('documents_doc_type_idx').on(table.document_type),
  devHouseTypeIdx: index('documents_dev_house_type_idx').on(table.development_id, table.house_type_code, table.document_type),
  tenantDevIdx: index('documents_tenant_dev_idx').on(table.tenant_id, table.development_id),
  docKindIdx: index('documents_doc_kind_idx').on(table.development_id, table.doc_kind),
  disciplineIdx: index('documents_discipline_idx').on(table.tenant_id, table.development_id, table.discipline),
  archiveIdx: index('documents_archive_idx').on(table.tenant_id, table.development_id, table.discipline, table.created_at),
  needsReviewIdx: index('documents_needs_review_idx').on(table.needs_review),
  autoMappedConfidenceIdx: index('documents_auto_mapped_confidence_idx').on(table.auto_mapped, table.mapping_confidence),
}));

export const document_versions = pgTable('document_versions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  document_id: uuid('document_id').references(() => documents.id).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  version: integer('version').notNull(),
  file_url: text('file_url').notNull(),
  uploaded_by: uuid('uploaded_by').references(() => admins.id),
  change_notes: text('change_notes'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index('doc_versions_document_idx').on(table.document_id),
  tenantIdx: index('doc_versions_tenant_idx').on(table.tenant_id),
}));

export const noticeboard_posts = pgTable('noticeboard_posts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  content: text('content').notNull(),
  author_id: uuid('author_id').references(() => admins.id),
  author_name: text('author_name'),
  author_unit: text('author_unit'),
  priority: integer('priority').default(0),
  start_date: timestamp('start_date', { withTimezone: true }),
  end_date: timestamp('end_date', { withTimezone: true }),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('noticeboard_tenant_idx').on(table.tenant_id),
  activeIdx: index('noticeboard_active_idx').on(table.active),
  datesIdx: index('noticeboard_dates_idx').on(table.start_date, table.end_date),
}));

export const notice_comments = pgTable('notice_comments', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  notice_id: uuid('notice_id').references(() => noticeboard_posts.id, { onDelete: 'cascade' }).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  unit_id: uuid('unit_id').references(() => units.id),
  author_name: text('author_name').notNull(),
  body: text('body').notNull(),
  is_deleted: boolean('is_deleted').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }),
}, (table) => ({
  noticeIdx: index('notice_comments_notice_idx').on(table.notice_id),
  noticeCreatedIdx: index('notice_comments_notice_created_idx').on(table.notice_id, table.created_at),
  tenantIdx: index('notice_comments_tenant_idx').on(table.tenant_id),
  developmentIdx: index('notice_comments_development_idx').on(table.development_id),
  unitIdx: index('notice_comments_unit_idx').on(table.unit_id),
}));

export const pois = pgTable('pois', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  meta: jsonb('meta').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  tenantIdx: index('pois_tenant_idx').on(table.tenant_id),
  categoryIdx: index('pois_category_idx').on(table.category),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  house_id: uuid('house_id').references(() => homeowners.id, { onDelete: 'set null' }),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  sender: varchar('sender', { length: 20 }),
  content: text('content').notNull(),
  user_message: text('user_message'),
  ai_message: text('ai_message'),
  question_topic: varchar('question_topic', { length: 100 }),
  source: varchar('source', { length: 50 }).default('chat').notNull(),
  metadata: jsonb('metadata'),
  token_count: integer('token_count').default(0),
  cost_usd: decimal('cost_usd', { precision: 10, scale: 6 }).default('0'),
  latency_ms: integer('latency_ms'),
  cited_document_ids: text('cited_document_ids').array(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('messages_tenant_idx').on(table.tenant_id),
  developmentIdx: index('messages_development_idx').on(table.development_id),
  houseIdx: index('messages_house_idx').on(table.house_id),
  houseCreatedIdx: index('messages_house_created_idx').on(table.house_id, table.created_at),
  userIdx: index('messages_user_idx').on(table.user_id),
  sourceIdx: index('messages_source_idx').on(table.source),
  tenantDevIdx: index('messages_tenant_dev_idx').on(table.tenant_id, table.development_id),
  questionTopicIdx: index('messages_question_topic_idx').on(table.question_topic),
}));

export const analytics_daily = pgTable('analytics_daily', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  metric: varchar('metric', { length: 100 }).notNull(),
  value: decimal('value', { precision: 15, scale: 2 }).notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('analytics_tenant_idx').on(table.tenant_id),
  metricIdx: index('analytics_metric_idx').on(table.metric),
  dateIdx: index('analytics_date_idx').on(table.date),
  tenantDateIdx: index('analytics_tenant_date_idx').on(table.tenant_id, table.date),
}));

export const feature_flags = pgTable('feature_flags', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  flag_key: varchar('flag_key', { length: 100 }).notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('feature_flags_tenant_idx').on(table.tenant_id),
  flagIdx: index('feature_flags_flag_idx').on(table.flag_key),
  uniqueTenantFlag: index('unique_tenant_flag_idx').on(table.tenant_id, table.flag_key),
}));

export const audit_log = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id),
  type: varchar('type', { length: 50 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  actor: varchar('actor', { length: 255 }),
  actor_id: uuid('actor_id'),
  actor_role: varchar('actor_role', { length: 50 }),
  ip_address: varchar('ip_address', { length: 45 }),
  request_path: text('request_path'),
  request_payload: jsonb('request_payload'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('audit_log_type_idx').on(table.type),
  tenantIdx: index('audit_log_tenant_idx').on(table.tenant_id),
  createdAtIdx: index('audit_log_created_idx').on(table.created_at),
  actorIdx: index('audit_log_actor_idx').on(table.actor_id),
  ipIdx: index('audit_log_ip_idx').on(table.ip_address),
}));

export const units = pgTable('units', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  development_code: text('development_code').notNull(),
  unit_number: text('unit_number').notNull(),
  unit_code: text('unit_code').notNull(),
  unit_uid: text('unit_uid').notNull().unique(),
  address_line_1: text('address_line_1').notNull(),
  address_line_2: text('address_line_2'),
  city: text('city'),
  state_province: text('state_province'),
  postal_code: text('postal_code'),
  country: text('country'),
  eircode: text('eircode'),
  property_designation: text('property_designation'),
  property_type: text('property_type'),
  house_type_code: text('house_type_code').notNull(),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  square_footage: integer('square_footage'),
  floor_area_m2: decimal('floor_area_m2', { precision: 10, scale: 2 }),
  purchaser_name: text('purchaser_name'),
  purchaser_email: text('purchaser_email'),
  purchaser_phone: text('purchaser_phone'),
  consent_at: timestamp('consent_at', { withTimezone: true }),
  mrpn: text('mrpn'),
  electricity_account: text('electricity_account'),
  esb_eirgrid_number: text('esb_eirgrid_number'),
  latitude: decimal('latitude', { precision: 9, scale: 6 }),
  longitude: decimal('longitude', { precision: 9, scale: 6 }),
  last_chat_at: timestamp('last_chat_at', { withTimezone: true }),
  important_docs_agreed_version: integer('important_docs_agreed_version').default(0).notNull(),
  important_docs_agreed_at: timestamp('important_docs_agreed_at', { withTimezone: true }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('units_tenant_idx').on(table.tenant_id),
  developmentIdx: index('units_development_idx').on(table.development_id),
  devCodeUnitIdx: index('units_dev_code_unit_idx').on(table.development_code, table.unit_number),
  devCodeHouseTypeIdx: index('units_dev_code_house_type_idx').on(table.development_code, table.house_type_code),
  tenantDevIdx: index('units_tenant_dev_idx').on(table.tenant_id, table.development_id),
  unitUidIdx: index('units_unit_uid_idx').on(table.unit_uid),
}));

export const homeowners = pgTable('homeowners', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  house_type: varchar('house_type', { length: 100 }),
  address: text('address'),
  unique_qr_token: varchar('unique_qr_token', { length: 255 }).unique(),
  last_active: timestamp('last_active', { withTimezone: true }),
  total_chats: integer('total_chats').default(0),
  total_downloads: integer('total_downloads').default(0),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('homeowners_tenant_idx').on(table.tenant_id),
  developmentIdx: index('homeowners_development_idx').on(table.development_id),
  emailIdx: index('homeowners_email_idx').on(table.email),
  qrTokenIdx: index('homeowners_qr_token_idx').on(table.unique_qr_token),
  tenantDevIdx: index('homeowners_tenant_dev_idx').on(table.tenant_id, table.development_id),
  lastActiveIdx: index('homeowners_last_active_idx').on(table.last_active),
}));

export const qr_tokens = pgTable('qr_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  unit_id: uuid('unit_id').references(() => units.id).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  token: text('token'),
  token_hash: text('token_hash').notNull().unique(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  used_at: timestamp('used_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tokenHashIdx: index('qr_tokens_token_hash_idx').on(table.token_hash),
  unitIdx: index('qr_tokens_unit_idx').on(table.unit_id),
  tenantIdx: index('qr_tokens_tenant_idx').on(table.tenant_id),
  developmentIdx: index('qr_tokens_development_idx').on(table.development_id),
  tenantDevIdx: index('qr_tokens_tenant_dev_idx').on(table.tenant_id, table.development_id),
}));

export const faqs = pgTable('faqs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  category: varchar('category', { length: 100 }),
  keywords: text('keywords'),
  embedding: text('embedding'),
  priority: integer('priority').default(0),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('faqs_tenant_idx').on(table.tenant_id),
  categoryIdx: index('faqs_category_idx').on(table.category),
  activeIdx: index('faqs_active_idx').on(table.active),
}));

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 100 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  department: varchar('department', { length: 100 }),
  priority: integer('priority').default(0),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('contacts_tenant_idx').on(table.tenant_id),
  departmentIdx: index('contacts_department_idx').on(table.department),
}));

export const issue_types = pgTable('issue_types', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  code: varchar('code', { length: 100 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  priority: varchar('priority', { length: 50 }).default('medium'),
  sla_hours: integer('sla_hours'),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('issue_types_tenant_idx').on(table.tenant_id),
  codeIdx: index('issue_types_code_idx').on(table.code),
  categoryIdx: index('issue_types_category_idx').on(table.category),
}));

export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  unit_id: uuid('unit_id').references(() => units.id),
  issue_type_id: uuid('issue_type_id').references(() => issue_types.id),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('open').notNull(),
  priority: varchar('priority', { length: 50 }).default('medium'),
  assigned_to: uuid('assigned_to').references(() => admins.id),
  reporter_name: varchar('reporter_name', { length: 255 }),
  reporter_email: varchar('reporter_email', { length: 255 }),
  reporter_phone: varchar('reporter_phone', { length: 50 }),
  photo_urls: jsonb('photo_urls').default(sql`'[]'::jsonb`),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  resolved_at: timestamp('resolved_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('tickets_tenant_idx').on(table.tenant_id),
  statusIdx: index('tickets_status_idx').on(table.status),
  unitIdx: index('tickets_unit_idx').on(table.unit_id),
  assignedIdx: index('tickets_assigned_idx').on(table.assigned_to),
}));

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  ticket_id: uuid('ticket_id').references(() => tickets.id),
  message_id: uuid('message_id').references(() => messages.id),
  rating: integer('rating'),
  comment: text('comment'),
  user_id: varchar('user_id', { length: 255 }),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('feedback_tenant_idx').on(table.tenant_id),
  ticketIdx: index('feedback_ticket_idx').on(table.ticket_id),
  ratingIdx: index('feedback_rating_idx').on(table.rating),
}));

export const ragChunks = pgTable('rag_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  house_type_code: text('house_type_code'),
  document_id: uuid('document_id').references(() => documents.id).notNull(),
  chunk_index: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('rag_chunks_tenant_idx').on(table.tenant_id),
  developmentIdx: index('rag_chunks_development_idx').on(table.development_id),
  documentIdx: index('rag_chunks_document_idx').on(table.document_id),
  devHouseTypeIdx: index('rag_chunks_dev_house_type_idx').on(table.development_id, table.house_type_code),
  tenantDevIdx: index('rag_chunks_tenant_dev_idx').on(table.tenant_id, table.development_id),
}));

export const doc_chunks = pgTable('doc_chunks', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  document_id: uuid('document_id').references(() => documents.id),
  chunk_index: integer('chunk_index').default(0),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  house_type_code: text('house_type_code'),
  doc_kind: text('doc_kind'),
  source_type: varchar('source_type', { length: 50 }).notNull(),
  source_id: uuid('source_id'),
  is_important: boolean('is_important').default(false).notNull(),
  token_count: integer('token_count').default(0),
  embedding_norm: doublePrecision('embedding_norm'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('doc_chunks_tenant_idx').on(table.tenant_id),
  developmentIdx: index('doc_chunks_development_idx').on(table.development_id),
  documentIdx: index('doc_chunks_document_idx').on(table.document_id),
  sourceIdx: index('doc_chunks_source_idx').on(table.source_type, table.source_id),
  tenantSourceIdx: index('doc_chunks_tenant_source_idx').on(table.tenant_id, table.source_type, table.source_id),
  tenantDevIdx: index('doc_chunks_tenant_dev_idx').on(table.tenant_id, table.development_id),
  devHouseTypeIdx: index('doc_chunks_dev_house_type_idx').on(table.development_id, table.house_type_code),
}));

export const search_cache = pgTable('search_cache', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  query: text('query').notNull(),
  filters: jsonb('filters').default(sql`'{}'::jsonb`),
  results: jsonb('results').notNull(),
  hit_count: integer('hit_count').default(0),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  userIdx: index('search_cache_user_idx').on(table.user_id),
  tenantIdx: index('search_cache_tenant_idx').on(table.tenant_id),
  queryIdx: index('search_cache_query_idx').on(table.tenant_id, table.query),
  expiresIdx: index('search_cache_expires_idx').on(table.expires_at),
}));

export const floorplan_vision = pgTable('floorplan_vision', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  house_type_id: uuid('house_type_id').references(() => houseTypes.id),
  document_id: uuid('document_id').references(() => documents.id),
  floor_name: text('floor_name'),
  room_name: text('room_name').notNull(),
  room_type: text('room_type'),
  canonical_room_name: text('canonical_room_name'),
  length_m: doublePrecision('length_m'),
  width_m: doublePrecision('width_m'),
  area_m2: doublePrecision('area_m2'),
  notes: text('notes'),
  raw_json: jsonb('raw_json'),
  confidence: doublePrecision('confidence'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantDevIdx: index('floorplan_vision_tenant_dev_idx').on(table.tenant_id, table.development_id),
  houseTypeIdx: index('floorplan_vision_house_type_idx').on(table.house_type_id),
  documentIdx: index('floorplan_vision_document_idx').on(table.document_id),
}));

export const training_jobs = pgTable('training_jobs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  file_name: varchar('file_name', { length: 500 }).notNull(),
  file_type: varchar('file_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).default('pending').notNull(),
  progress: integer('progress').default(0),
  total_chunks: integer('total_chunks').default(0),
  processed_chunks: integer('processed_chunks').default(0),
  error_message: text('error_message'),
  started_at: timestamp('started_at', { withTimezone: true }),
  completed_at: timestamp('completed_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('training_jobs_tenant_idx').on(table.tenant_id),
  developmentIdx: index('training_jobs_development_idx').on(table.development_id),
  statusIdx: index('training_jobs_status_idx').on(table.status),
  tenantStatusIdx: index('training_jobs_tenant_status_idx').on(table.tenant_id, table.status),
  tenantDevIdx: index('training_jobs_tenant_dev_idx').on(table.tenant_id, table.development_id),
}));

export const theme_config = pgTable('theme_config', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull().unique(),
  primary_color: varchar('primary_color', { length: 7 }).default('#3b82f6').notNull(),
  secondary_color: varchar('secondary_color', { length: 7 }).default('#8b5cf6'),
  accent_color: varchar('accent_color', { length: 7 }).default('#06b6d4'),
  logo_url: text('logo_url'),
  dark_mode: boolean('dark_mode').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('theme_config_tenant_idx').on(table.tenant_id),
}));

export const api_cache = pgTable('api_cache', {
  cache_key: text('cache_key').primaryKey(),
  value: jsonb('value'),
  expiry: timestamp('expiry'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  expiryIdx: index('api_cache_expiry_idx').on(table.expiry),
}));

export const rate_limits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').default(1),
  reset_time: timestamp('reset_time'),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  resetTimeIdx: index('rate_limits_reset_time_idx').on(table.reset_time),
}));

export const embedding_cache = pgTable('embedding_cache', {
  hash: text('hash').primaryKey(),
  embedding: vector('embedding', { dimensions: 1536 }),
  model: text('model').default('text-embedding-3-large'),
  created_at: timestamp('created_at').defaultNow(),
  last_accessed: timestamp('last_accessed').defaultNow(),
  access_count: integer('access_count').default(1),
}, (table) => ({
  createdIdx: index('embedding_cache_created_idx').on(table.created_at),
}));

export const important_docs_agreements = pgTable('important_docs_agreements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  unit_id: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }).notNull(),
  purchaser_id: uuid('purchaser_id'),
  development_id: uuid('development_id').references(() => developments.id, { onDelete: 'cascade' }).notNull(),
  tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  important_docs_version: integer('important_docs_version').notNull(),
  agreed_at: timestamp('agreed_at', { withTimezone: true }).defaultNow().notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unitIdx: index('important_docs_agreements_unit_idx').on(table.unit_id),
  developmentIdx: index('important_docs_agreements_development_idx').on(table.development_id),
  tenantIdx: index('important_docs_agreements_tenant_idx').on(table.tenant_id),
  agreedAtIdx: index('important_docs_agreements_agreed_at_idx').on(table.agreed_at),
  unitVersionIdx: index('important_docs_agreements_unit_version_idx').on(table.unit_id, table.important_docs_version),
}));

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  admins: many(admins),
  developments: many(developments),
  houseTypes: many(houseTypes),
  documents: many(documents),
  document_versions: many(document_versions),
  noticeboard_posts: many(noticeboard_posts),
  pois: many(pois),
  messages: many(messages),
  analytics_daily: many(analytics_daily),
  feature_flags: many(feature_flags),
  audit_logs: many(audit_log),
  units: many(units),
  homeowners: many(homeowners),
  faqs: many(faqs),
  contacts: many(contacts),
  issue_types: many(issue_types),
  tickets: many(tickets),
  feedback: many(feedback),
  ragChunks: many(ragChunks),
  doc_chunks: many(doc_chunks),
  training_jobs: many(training_jobs),
  theme_config: one(theme_config, {
    fields: [tenants.id],
    references: [theme_config.tenant_id],
  }),
}));

export const developmentsRelations = relations(developments, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [developments.tenant_id],
    references: [tenants.id],
  }),
  creator: one(admins, {
    fields: [developments.created_by],
    references: [admins.id],
  }),
  houseTypes: many(houseTypes),
  units: many(units),
  documents: many(documents),
  ragChunks: many(ragChunks),
  doc_chunks: many(doc_chunks),
  training_jobs: many(training_jobs),
  messages: many(messages),
  homeowners: many(homeowners),
}));

export const houseTypesRelations = relations(houseTypes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [houseTypes.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [houseTypes.development_id],
    references: [developments.id],
  }),
  documents: many(documents),
}));

export const featureFlagsRelations = relations(feature_flags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [feature_flags.tenant_id],
    references: [tenants.id],
  }),
}));

export const auditLogRelations = relations(audit_log, ({ one }) => ({
  tenant: one(tenants, {
    fields: [audit_log.tenant_id],
    references: [tenants.id],
  }),
}));

export const adminsRelations = relations(admins, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [admins.tenant_id],
    references: [tenants.id],
  }),
  posts: many(noticeboard_posts),
  uploaded_versions: many(document_versions),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documents.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [documents.development_id],
    references: [developments.id],
  }),
  houseType: one(houseTypes, {
    fields: [documents.house_type_id],
    references: [houseTypes.id],
  }),
  uploader: one(admins, {
    fields: [documents.uploaded_by],
    references: [admins.id],
  }),
  versions: many(document_versions),
  ragChunks: many(ragChunks),
  chunks: many(doc_chunks),
}));

export const documentVersionsRelations = relations(document_versions, ({ one }) => ({
  document: one(documents, {
    fields: [document_versions.document_id],
    references: [documents.id],
  }),
  tenant: one(tenants, {
    fields: [document_versions.tenant_id],
    references: [tenants.id],
  }),
  uploader: one(admins, {
    fields: [document_versions.uploaded_by],
    references: [admins.id],
  }),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [units.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [units.development_id],
    references: [developments.id],
  }),
  tickets: many(tickets),
}));

export const ragChunksRelations = relations(ragChunks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [ragChunks.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [ragChunks.development_id],
    references: [developments.id],
  }),
  document: one(documents, {
    fields: [ragChunks.document_id],
    references: [documents.id],
  }),
}));

export const homeownersRelations = relations(homeowners, ({ one }) => ({
  tenant: one(tenants, {
    fields: [homeowners.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [homeowners.development_id],
    references: [developments.id],
  }),
}));

export const qrTokensRelations = relations(qr_tokens, ({ one }) => ({
  unit: one(units, {
    fields: [qr_tokens.unit_id],
    references: [units.id],
  }),
  tenant: one(tenants, {
    fields: [qr_tokens.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [qr_tokens.development_id],
    references: [developments.id],
  }),
}));

export const faqsRelations = relations(faqs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [faqs.tenant_id],
    references: [tenants.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contacts.tenant_id],
    references: [tenants.id],
  }),
}));

export const issueTypesRelations = relations(issue_types, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [issue_types.tenant_id],
    references: [tenants.id],
  }),
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [tickets.tenant_id],
    references: [tenants.id],
  }),
  unit: one(units, {
    fields: [tickets.unit_id],
    references: [units.id],
  }),
  issue_type: one(issue_types, {
    fields: [tickets.issue_type_id],
    references: [issue_types.id],
  }),
  assignee: one(admins, {
    fields: [tickets.assigned_to],
    references: [admins.id],
  }),
  feedback: many(feedback),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  tenant: one(tenants, {
    fields: [feedback.tenant_id],
    references: [tenants.id],
  }),
  ticket: one(tickets, {
    fields: [feedback.ticket_id],
    references: [tickets.id],
  }),
  message: one(messages, {
    fields: [feedback.message_id],
    references: [messages.id],
  }),
}));

export const docChunksRelations = relations(doc_chunks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [doc_chunks.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [doc_chunks.development_id],
    references: [developments.id],
  }),
  document: one(documents, {
    fields: [doc_chunks.document_id],
    references: [documents.id],
  }),
}));

export const trainingJobsRelations = relations(training_jobs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [training_jobs.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [training_jobs.development_id],
    references: [developments.id],
  }),
}));

export const themeConfigRelations = relations(theme_config, ({ one }) => ({
  tenant: one(tenants, {
    fields: [theme_config.tenant_id],
    references: [tenants.id],
  }),
}));

export const unit_intelligence_profiles = pgTable('unit_intelligence_profiles', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  profile_scope: varchar('profile_scope', { length: 20 }).notNull().default('house_type'),
  unit_id: uuid('unit_id').references(() => units.id),
  house_type_code: text('house_type_code'),
  version: integer('version').default(1).notNull(),
  is_current: boolean('is_current').default(true).notNull(),
  status: varchar('status', { length: 20 }).default('draft').notNull(),
  quality_score: doublePrecision('quality_score').default(0),
  floor_area_total_sqm: decimal('floor_area_total_sqm', { precision: 10, scale: 2 }),
  rooms: jsonb('rooms').default(sql`'{}'::jsonb`),
  suppliers: jsonb('suppliers').default(sql`'{}'::jsonb`),
  ber_rating: text('ber_rating'),
  heating: text('heating'),
  hvac: jsonb('hvac').default(sql`'{}'::jsonb`),
  field_confidence: jsonb('field_confidence').default(sql`'{}'::jsonb`),
  extraction_passes: jsonb('extraction_passes').default(sql`'[]'::jsonb`),
  source_document_ids: uuid('source_document_ids').array(),
  lineage: jsonb('lineage').default(sql`'[]'::jsonb`),
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  superseded_by: uuid('superseded_by'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('intel_profiles_tenant_idx').on(table.tenant_id),
  developmentIdx: index('intel_profiles_development_idx').on(table.development_id),
  tenantDevIdx: index('intel_profiles_tenant_dev_idx').on(table.tenant_id, table.development_id),
  houseTypeIdx: index('intel_profiles_house_type_idx').on(table.house_type_code),
  scopeIdx: index('intel_profiles_scope_idx').on(table.profile_scope),
  currentIdx: index('intel_profiles_current_idx').on(table.is_current),
  unitIdx: index('intel_profiles_unit_idx').on(table.unit_id),
}));

export const unitRoomDimensions = pgTable('unit_room_dimensions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  developmentId: uuid('development_id').references(() => developments.id, { onDelete: 'cascade' }).notNull(),
  houseTypeId: uuid('house_type_id').references(() => houseTypes.id, { onDelete: 'cascade' }).notNull(),
  unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }),

  roomName: text('room_name').notNull(),
  roomKey: text('room_key').notNull(),
  floor: text('floor'),

  lengthM: decimal('length_m', { precision: 6, scale: 2 }),
  widthM: decimal('width_m', { precision: 6, scale: 2 }),
  areaSqm: decimal('area_sqm', { precision: 7, scale: 2 }),
  ceilingHeightM: decimal('ceiling_height_m', { precision: 5, scale: 2 }),

  source: text('source').notNull().default('unknown'),
  verified: boolean('verified').notNull().default(false),

  notes: text('notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantDevHouseIdx: index('idx_urd_tenant_dev_house').on(
    table.tenantId,
    table.developmentId,
    table.houseTypeId,
  ),
  roomKeyIdx: index('idx_urd_room_key').on(table.roomKey),
  unitIdx: index('idx_urd_unit').on(table.unitId),
  uniqueHouseRoomFloorSource: uniqueIndex('uniq_urd_house_room_floor_source').on(
    table.houseTypeId,
    table.unitId,
    table.roomKey,
    table.floor,
    table.source,
  ),
}));

export const unit_room_dimensions = unitRoomDimensions;

export const intel_extractions = pgTable('intel_extractions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id).notNull(),
  document_id: uuid('document_id').references(() => documents.id).notNull(),
  extraction_method: varchar('extraction_method', { length: 50 }).notNull(),
  model_version: text('model_version'),
  raw_output: jsonb('raw_output').default(sql`'{}'::jsonb`),
  structured_data: jsonb('structured_data').default(sql`'{}'::jsonb`),
  rooms_extracted: jsonb('rooms_extracted').default(sql`'[]'::jsonb`),
  suppliers_extracted: jsonb('suppliers_extracted').default(sql`'[]'::jsonb`),
  confidence_scores: jsonb('confidence_scores').default(sql`'{}'::jsonb`),
  cost_cents: integer('cost_cents').default(0),
  processing_time_ms: integer('processing_time_ms'),
  page_range: text('page_range'),
  error_message: text('error_message'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('intel_extractions_tenant_idx').on(table.tenant_id),
  developmentIdx: index('intel_extractions_development_idx').on(table.development_id),
  documentIdx: index('intel_extractions_document_idx').on(table.document_id),
  methodIdx: index('intel_extractions_method_idx').on(table.extraction_method),
  statusIdx: index('intel_extractions_status_idx').on(table.status),
}));

export const unitIntelligenceProfilesRelations = relations(unit_intelligence_profiles, ({ one }) => ({
  tenant: one(tenants, {
    fields: [unit_intelligence_profiles.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [unit_intelligence_profiles.development_id],
    references: [developments.id],
  }),
  unit: one(units, {
    fields: [unit_intelligence_profiles.unit_id],
    references: [units.id],
  }),
}));

export const intelExtractionsRelations = relations(intel_extractions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [intel_extractions.tenant_id],
    references: [tenants.id],
  }),
  development: one(developments, {
    fields: [intel_extractions.development_id],
    references: [developments.id],
  }),
  document: one(documents, {
    fields: [intel_extractions.document_id],
    references: [documents.id],
  }),
}));

export const analytics_events = pgTable('analytics_events', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  event_type: varchar('event_type', { length: 50 }).notNull(),
  event_data: jsonb('event_data').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('analytics_events_tenant_idx').on(table.tenant_id),
  developmentIdx: index('analytics_events_development_idx').on(table.development_id),
  eventTypeIdx: index('analytics_events_type_idx').on(table.event_type),
  createdAtIdx: index('analytics_events_created_at_idx').on(table.created_at),
  tenantDevCreatedIdx: index('analytics_events_tenant_dev_created_idx').on(table.tenant_id, table.development_id, table.created_at),
}));

export const document_processing_logs = pgTable('document_processing_logs', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  document_id: uuid('document_id').references(() => documents.id),
  tenant_id: uuid('tenant_id').references(() => tenants.id).notNull(),
  event_type: varchar('event_type', { length: 50 }).notNull(),
  message: text('message'),
  details: jsonb('details').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  documentIdx: index('doc_processing_logs_document_idx').on(table.document_id),
  tenantIdx: index('doc_processing_logs_tenant_idx').on(table.tenant_id),
  eventTypeIdx: index('doc_processing_logs_event_type_idx').on(table.event_type),
  createdAtIdx: index('doc_processing_logs_created_at_idx').on(table.created_at),
}));

// Users table - syncs with Supabase auth.users for RLS
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),  // Matches auth.users.id
  tenant_id: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email'),
  role: text('role').notNull().default('user'),  // user, tenant_admin, platform_admin
  metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index('users_tenant_idx').on(table.tenant_id),
  emailIdx: index('users_email_idx').on(table.email),
  roleIdx: index('users_role_idx').on(table.role),
}));

// User-to-development mapping for multi-development access control
export const userDevelopments = pgTable('user_developments', {
  user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  development_id: uuid('development_id').notNull().references(() => developments.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),  // member, manager, admin
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  developmentIdx: index('user_developments_development_idx').on(table.development_id, table.user_id),
  userIdx: index('user_developments_user_idx').on(table.user_id, table.development_id),
}));

// Relations for users
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenant_id],
    references: [tenants.id],
  }),
  userDevelopments: many(userDevelopments),
}));

// Relations for userDevelopments
export const userDevelopmentsRelations = relations(userDevelopments, ({ one }) => ({
  user: one(users, {
    fields: [userDevelopments.user_id],
    references: [users.id],
  }),
  development: one(developments, {
    fields: [userDevelopments.development_id],
    references: [developments.id],
  }),
}));

// Purchaser document agreements - tracks when purchasers acknowledge must-read documents
export const purchaserAgreements = pgTable('purchaser_agreements', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  unit_id: uuid('unit_id').notNull(),
  development_id: uuid('development_id').references(() => developments.id),
  purchaser_name: text('purchaser_name'),
  purchaser_email: text('purchaser_email'),
  agreed_at: timestamp('agreed_at', { withTimezone: true }).defaultNow().notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent'),
  important_docs_acknowledged: jsonb('important_docs_acknowledged').default(sql`'[]'::jsonb`),
  docs_version: integer('docs_version').default(1),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  unitIdx: index('purchaser_agreements_unit_idx').on(table.unit_id),
  developmentIdx: index('purchaser_agreements_development_idx').on(table.development_id),
  agreedAtIdx: index('purchaser_agreements_agreed_at_idx').on(table.agreed_at),
}));
