import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// ── Types ──

export type ListingStatus = 'active' | 'sale_agreed' | 'sold';
export type EnquiryStatus = 'new' | 'contacted' | 'viewing_booked' | 'sale_agreed' | 'dead';
export type ContactStatus = 'active' | 'under_offer' | 'purchased' | 'inactive';

export interface Listing {
  id: string;
  agentId: string;
  tenantId: string;
  address: string;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  askingPrice: number | null;
  saleAgreedPrice: number | null;
  status: ListingStatus;
  listedDate: string | null;
  saleAgreedAt: string | null;
  contractsIssuedAt: string | null;
  soldAt: string | null;
  vendorName: string | null;
  vendorPhone: string | null;
  vendorSolicitorName: string | null;
  vendorSolicitorEmail: string | null;
  buyerName: string | null;
  buyerPhone: string | null;
  buyerSolicitorName: string | null;
  buyerSolicitorEmail: string | null;
  commissionRate: number | null;
  commissionStatus: string | null;
  commissionReceivedDate: string | null;
  berRating: string | null;
  daftUrl: string | null;
  lastViewedAt: string | null;
  totalViewings: number;
  totalEnquiries: number;
  createdAt: string;
}

export interface Enquiry {
  id: string;
  agentId: string;
  listingId: string | null;
  enquirerName: string | null;
  enquirerPhone: string | null;
  enquirerEmail: string | null;
  source: string | null;
  message: string | null;
  status: EnquiryStatus;
  receivedAt: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  listingAddress?: string;
}

export interface ViewingFeedback {
  id: string;
  listingId: string;
  viewerName: string | null;
  viewingDate: string;
  interestLevel: string | null;
  pricePerception: string | null;
  mainConcern: string | null;
  wouldViewAgain: boolean | null;
}

export interface AgentContact {
  id: string;
  agentId: string;
  name: string;
  phone: string | null;
  email: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  minBedrooms: number | null;
  preferredArea: string | null;
  hasMortgageApproval: boolean;
  mortgageExpiryDate: string | null;
  status: ContactStatus;
  notes: string | null;
  lastContactedAt: string | null;
  createdAt: string;
}

export interface HomeStats {
  agentId: string;
  activeListings: number;
  newEnquiries: number;
  followUpsDue: number;
  totalViewingsThisWeek: number;
  totalSold: number;
}

export interface PriceReviewCandidate {
  listingId: string;
  address: string;
  askingPrice: number;
  daysOnMarket: number;
  totalViewings: number;
  totalEnquiries: number;
  reviewUrgency: string;
}

// ── Service functions ──

export async function getIndependentHomeStats(agentId: string): Promise<HomeStats | null> {
  const { data } = await supabase
    .from('agent_home_stats')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();

  if (!data) {
    // Compute manually if view doesn't return data
    const [listings, enquiries, followUps] = await Promise.all([
      supabase.from('listings').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'active'),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).eq('status', 'new'),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('agent_id', agentId).lt('next_follow_up_at', new Date().toISOString()).neq('status', 'dead'),
    ]);
    return {
      agentId,
      activeListings: listings.count || 0,
      newEnquiries: enquiries.count || 0,
      followUpsDue: followUps.count || 0,
      totalViewingsThisWeek: 0,
      totalSold: 0,
    };
  }

  return {
    agentId: data.agent_id,
    activeListings: data.active_listings || 0,
    newEnquiries: data.new_enquiries || 0,
    followUpsDue: data.follow_ups_due || 0,
    totalViewingsThisWeek: data.total_viewings_this_week || 0,
    totalSold: data.total_sold || 0,
  };
}

export async function getPriceReviewCandidates(agentId: string): Promise<PriceReviewCandidate[]> {
  const { data } = await supabase
    .from('listing_price_review_candidates')
    .select('*')
    .eq('agent_id', agentId)
    .eq('review_urgency', 'high')
    .limit(5);

  return (data || []).map((r: any) => ({
    listingId: r.listing_id || r.id,
    address: r.address,
    askingPrice: r.asking_price,
    daysOnMarket: r.days_on_market,
    totalViewings: r.total_viewings,
    totalEnquiries: r.total_enquiries || 0,
    reviewUrgency: r.review_urgency,
  }));
}

export async function getListings(agentId: string, status?: ListingStatus): Promise<Listing[]> {
  let query = supabase
    .from('listings')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data } = await query;
  return (data || []).map(mapListing);
}

export async function getListingById(listingId: string): Promise<Listing | null> {
  const { data } = await supabase
    .from('listings')
    .select('*')
    .eq('id', listingId)
    .maybeSingle();

  return data ? mapListing(data) : null;
}

export async function createListing(listing: {
  agentId: string;
  tenantId: string;
  address: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  askingPrice?: number;
  vendorName?: string;
  vendorPhone?: string;
  daftUrl?: string;
}): Promise<Listing | null> {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      agent_id: listing.agentId,
      tenant_id: listing.tenantId,
      address: listing.address,
      property_type: listing.propertyType || null,
      bedrooms: listing.bedrooms || null,
      bathrooms: listing.bathrooms || null,
      asking_price: listing.askingPrice || null,
      vendor_name: listing.vendorName || null,
      vendor_phone: listing.vendorPhone || null,
      daft_url: listing.daftUrl || null,
      status: 'active',
      listed_date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create listing:', error);
    return null;
  }
  return mapListing(data);
}

export async function updateListing(listingId: string, updates: Record<string, any>): Promise<boolean> {
  const { error } = await supabase
    .from('listings')
    .update(updates)
    .eq('id', listingId);
  return !error;
}

export async function getEnquiries(agentId: string, listingId?: string): Promise<Enquiry[]> {
  let query = supabase
    .from('enquiries')
    .select('*, listings(address)')
    .eq('agent_id', agentId)
    .order('received_at', { ascending: false });

  if (listingId) {
    query = query.eq('listing_id', listingId);
  }

  const { data } = await query;
  return (data || []).map((e: any) => ({
    id: e.id,
    agentId: e.agent_id,
    listingId: e.listing_id,
    enquirerName: e.enquirer_name,
    enquirerPhone: e.enquirer_phone,
    enquirerEmail: e.enquirer_email,
    source: e.source,
    message: e.message,
    status: e.status || 'new',
    receivedAt: e.received_at,
    lastContactedAt: e.last_contacted_at,
    nextFollowUpAt: e.next_follow_up_at,
    listingAddress: e.listings?.address || null,
  }));
}

export async function getRecentEnquiries(agentId: string, limit: number = 3): Promise<Enquiry[]> {
  const { data } = await supabase
    .from('enquiries')
    .select('*, listings(address)')
    .eq('agent_id', agentId)
    .eq('status', 'new')
    .order('received_at', { ascending: false })
    .limit(limit);

  return (data || []).map((e: any) => ({
    id: e.id,
    agentId: e.agent_id,
    listingId: e.listing_id,
    enquirerName: e.enquirer_name,
    enquirerPhone: e.enquirer_phone,
    enquirerEmail: e.enquirer_email,
    source: e.source,
    message: e.message,
    status: e.status || 'new',
    receivedAt: e.received_at,
    lastContactedAt: e.last_contacted_at,
    nextFollowUpAt: e.next_follow_up_at,
    listingAddress: e.listings?.address || null,
  }));
}

export async function updateEnquiryStatus(enquiryId: string, status: EnquiryStatus, contactInfo?: {
  lastContactedAt?: string;
  nextFollowUpAt?: string;
}): Promise<boolean> {
  const updates: Record<string, any> = { status };
  if (contactInfo?.lastContactedAt) updates.last_contacted_at = contactInfo.lastContactedAt;
  if (contactInfo?.nextFollowUpAt) updates.next_follow_up_at = contactInfo.nextFollowUpAt;

  const { error } = await supabase
    .from('enquiries')
    .update(updates)
    .eq('id', enquiryId);
  return !error;
}

export async function createViewingFeedback(feedback: {
  listingId: string;
  agentId: string;
  tenantId: string;
  viewerName?: string;
  viewingDate: string;
  interestLevel: string;
  pricePerception: string;
  mainConcern?: string;
  wouldViewAgain: boolean;
}): Promise<boolean> {
  const { error } = await supabase
    .from('viewing_feedback')
    .insert({
      listing_id: feedback.listingId,
      agent_id: feedback.agentId,
      tenant_id: feedback.tenantId,
      viewer_name: feedback.viewerName || null,
      viewing_date: feedback.viewingDate,
      interest_level: feedback.interestLevel,
      price_perception: feedback.pricePerception,
      main_concern: feedback.mainConcern || null,
      would_view_again: feedback.wouldViewAgain,
    });

  if (!error) {
    // Update listing's last_viewed_at
    await supabase
      .from('listings')
      .update({ last_viewed_at: feedback.viewingDate })
      .eq('id', feedback.listingId);
  }

  return !error;
}

export async function getViewingFeedback(listingId: string): Promise<ViewingFeedback[]> {
  const { data } = await supabase
    .from('viewing_feedback')
    .select('*')
    .eq('listing_id', listingId)
    .order('viewing_date', { ascending: false });

  return (data || []).map((f: any) => ({
    id: f.id,
    listingId: f.listing_id,
    viewerName: f.viewer_name,
    viewingDate: f.viewing_date,
    interestLevel: f.interest_level,
    pricePerception: f.price_perception,
    mainConcern: f.main_concern,
    wouldViewAgain: f.would_view_again,
  }));
}

export async function getAgentContacts(agentId: string): Promise<AgentContact[]> {
  const { data } = await supabase
    .from('agent_contacts')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false });

  return (data || []).map(mapContact);
}

export async function createAgentContact(contact: {
  agentId: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  budgetMin?: number;
  budgetMax?: number;
  minBedrooms?: number;
  preferredArea?: string;
  notes?: string;
}): Promise<AgentContact | null> {
  const { data, error } = await supabase
    .from('agent_contacts')
    .insert({
      agent_id: contact.agentId,
      tenant_id: contact.tenantId,
      name: contact.name,
      phone: contact.phone || null,
      email: contact.email || null,
      budget_min: contact.budgetMin || null,
      budget_max: contact.budgetMax || null,
      min_bedrooms: contact.minBedrooms || null,
      preferred_area: contact.preferredArea || null,
      notes: contact.notes || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create contact:', error);
    return null;
  }
  return mapContact(data);
}

export async function getCommissionStats(agentId: string) {
  const { data } = await supabase
    .from('listings')
    .select('asking_price, sale_agreed_price, commission_rate, commission_status, commission_received_date, status')
    .eq('agent_id', agentId);

  const listings = data || [];
  const projected = listings
    .filter((l: any) => ['active', 'sale_agreed'].includes(l.status))
    .reduce((sum: number, l: any) => sum + ((l.asking_price || 0) * ((l.commission_rate || 1) / 100)), 0);

  const received = listings
    .filter((l: any) => l.commission_status === 'received')
    .reduce((sum: number, l: any) => sum + ((l.sale_agreed_price || l.asking_price || 0) * ((l.commission_rate || 1) / 100)), 0);

  return { projected: Math.round(projected), received: Math.round(received), total: Math.round(projected + received), listings };
}

export async function updateAgentProfile(agentId: string, updates: {
  agent_type?: string;
  bio?: string;
  location?: string;
  specialisations?: string[];
}): Promise<boolean> {
  const { error } = await supabase
    .from('agent_profiles')
    .update(updates)
    .eq('id', agentId);
  return !error;
}

// ── Mapping helpers ──

function mapListing(data: any): Listing {
  return {
    id: data.id,
    agentId: data.agent_id,
    tenantId: data.tenant_id,
    address: data.address,
    propertyType: data.property_type,
    bedrooms: data.bedrooms,
    bathrooms: data.bathrooms,
    askingPrice: data.asking_price ? Number(data.asking_price) : null,
    saleAgreedPrice: data.sale_agreed_price ? Number(data.sale_agreed_price) : null,
    status: data.status || 'active',
    listedDate: data.listed_date,
    saleAgreedAt: data.sale_agreed_at,
    contractsIssuedAt: data.contracts_issued_at,
    soldAt: data.sold_at,
    vendorName: data.vendor_name,
    vendorPhone: data.vendor_phone,
    vendorSolicitorName: data.vendor_solicitor_name,
    vendorSolicitorEmail: data.vendor_solicitor_email,
    buyerName: data.buyer_name,
    buyerPhone: data.buyer_phone,
    buyerSolicitorName: data.buyer_solicitor_name,
    buyerSolicitorEmail: data.buyer_solicitor_email,
    commissionRate: data.commission_rate ? Number(data.commission_rate) : null,
    commissionStatus: data.commission_status,
    commissionReceivedDate: data.commission_received_date,
    berRating: data.ber_rating,
    daftUrl: data.daft_url,
    lastViewedAt: data.last_viewed_at,
    totalViewings: data.total_viewings || 0,
    totalEnquiries: data.total_enquiries || 0,
    createdAt: data.created_at,
  };
}

function mapContact(data: any): AgentContact {
  return {
    id: data.id,
    agentId: data.agent_id,
    name: data.name,
    phone: data.phone,
    email: data.email,
    budgetMin: data.budget_min ? Number(data.budget_min) : null,
    budgetMax: data.budget_max ? Number(data.budget_max) : null,
    minBedrooms: data.min_bedrooms,
    preferredArea: data.preferred_area,
    hasMortgageApproval: data.has_mortgage_approval || false,
    mortgageExpiryDate: data.mortgage_expiry_date,
    status: data.status || 'active',
    notes: data.notes,
    lastContactedAt: data.last_contacted_at,
    createdAt: data.created_at,
  };
}
