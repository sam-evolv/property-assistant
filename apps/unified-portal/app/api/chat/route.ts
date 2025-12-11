import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { db } from '@openhouse/db';
import { sql } from 'drizzle-orm';
import { messages, units } from '@openhouse/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { extractQuestionTopic } from '@/lib/question-topic-extractor';
import { findDrawingForQuestion, ResolvedDrawing } from '@/lib/drawing-resolver';
import { validateQRToken } from '@openhouse/api/qr-tokens';
import { createErrorLogger, logAnalyticsEvent } from '@openhouse/api';

const CONVERSATION_HISTORY_LIMIT = 4; // Load last 4 exchanges for context

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';
const DEFAULT_TENANT_ID = 'fdd1bd1a-97fa-4a1c-94b5-ae22dceb077d';
const DEFAULT_DEVELOPMENT_ID = '34316432-f1e8-4297-b993-d9b5c88ee2d8';
const MAX_CHUNKS = 20; // Limit context to top 20 most relevant chunks
const MAX_CONTEXT_CHARS = 80000; // Max characters in context (~20k tokens)

// SAFETY-CRITICAL PRE-FILTER: Intercept dangerous queries BEFORE they hit the LLM
// Uses both exact keywords and regex patterns for robust matching
function isSafetyCriticalQuery(message: string): { isCritical: boolean; matchedKeyword: string | null } {
  const lower = message.toLowerCase().replace(/['']/g, "'");

  const keywords = [
    "load bearing", "load-bearing", "loadbearing",
    "remove wall", "remove a wall", "remove the wall", "removing wall",
    "knock wall", "knock this wall", "knock down wall", "knock out wall",
    "tear down wall", "take out wall", "take down wall",
    "is this wall safe", "is the wall safe", "wall safe to",
    "safe to drill", "can i drill", "drill into wall", "drill into the wall", "drilling into",
    "gas leak", "smell of gas", "smells like gas", "smell gas", "smelling gas", "gas smell",
    "burning smell", "smell of burning", "smell smoke", "smells like burning", "something burning",
    "smells like it's burning", "smells like its burning", "like burning",
    "smoke coming from", "smoke from socket", "smoke from plug", "smoke from outlet",
    "smoke is coming", "smoke coming",
    "burning wire", "wire burning", "cable burning",
    "sparking", "sparks from", "electrical sparks", "arcing",
    "sparks are coming", "sparks coming",
    "electrical issue", "electrical problem", "electrical fault",
    "fuse tripping", "fuse keeps tripping", "breaker tripping", "breaker keeps tripping", "trips the fuse",
    "can i bypass", "bypass the", "bypass circuit",
    "fire risk", "fire hazard", "fire safety", "fire danger",
    "fire alarm", "smoke alarm", "smoke detector", "fire detector",
    "alarm keeps", "alarm beeping", "alarm chirping", "alarm going off",
    "mould", "mold", "black mould", "black mold", "mouldy", "moldy",
    "asbestos", "asbesto",
    "structural movement", "structural issue", "structural problem", "structural damage",
    "crack in wall", "cracks in wall", "crack in ceiling", "cracks in ceiling", "wall crack", "ceiling crack",
    "cracks appearing", "cracks in my ceiling", "ceiling cracks",
    "roof sagging", "sagging roof", "roof drooping", "ceiling sagging",
    "floor sagging", "floor seems to be sagging", "sagging floor",
    "leaking pipe", "pipe leaking", "burst pipe", "pipe burst", "pipe has burst",
    "major leak", "big leak", "serious leak", "water everywhere",
    "flooding", "flooded", "water flooding", "flooding in",
    "boiler issue", "boiler problem", "boiler not working", "boiler broken",
    "heating not working", "heating broken", "no heating", "no hot water",
    "heating won't work", "heating wont work", "radiators not working",
    "radiator leaking", "radiator leak",
    "gas boiler", "gas appliance", "gas cooker", "gas hob", "gas fire",
    "electrical socket", "plug socket", "power socket", "outlet problem",
    "wiring problem", "wiring issue", "faulty wiring", "old wiring",
    "wiring looks old", "wiring in my attic",
    "is it safe", "is this safe", "is it dangerous", "dangerous",
    "structural change", "structural work", "structural alteration",
    "carbon monoxide", "co alarm", "co detector", "co2 alarm", "monoxide detector", "monoxide alarm",
    "electrocuted", "electric shock", "got shocked", "zapped me",
    "got a shock", "got a shock from",
    "damp problem", "damp issue", "rising damp", "penetrating damp",
    "damp coming through", "damp on the wall", "damp through the wall",
    "water damage", "ceiling leak", "roof leak", "water coming through",
    "water is coming through", "leak in the ceiling",
    "party wall", "supporting wall", "can i remove", "can i knock",
    "subsidence", "foundation", "foundations", "ground movement"
  ];

  const patterns = [
    /\b(load[\s-]?bear|support(ing|ive)?\s+wall)\b/i,
    /\b(knock|remove|tear|take)\s*(down|out|through)?\s*(a|the|this)?\s*wall\b/i,
    /\bwall\s*(safe|ok|okay)\s*(to|for)\b/i,
    /\bdrill\s*(into|through|in)\b/i,
    /\b(smell|smelling|smells?)\s*(of\s*)?(gas|burning|smoke)\b/i,
    /\b(gas|smoke|burning)\s*smell\b/i,
    /\bsmoke\s*(is\s*)?(coming|from|out)\b/i,
    /\bspark(s|ing)?\s*(are\s*)?(from|coming)\b/i,
    /\b(fuse|breaker|circuit)\s*(keep|keeps)?\s*trip(ping|s)?\b/i,
    /\bbypass\s*(the|a)?\s*(fuse|breaker|circuit|safety)\b/i,
    /\b(fire|smoke|co|carbon\s*monoxide)\s*(alarm|detector)\b/i,
    /\balarm\s*(keep|keeps)?\s*(beep|chirp|sound|go)/i,
    /\b(mould|mold|mouldy|moldy)\b/i,
    /\bcracks?\s*(in|on|appearing)\s*(the\s*)?(my\s*)?(wall|ceiling|floor)\b/i,
    /\b(wall|ceiling|floor)\s*cracks?\b/i,
    /\b(roof|ceiling|floor)\s*(is\s*)?(sag|droop|bend|bow|seem)/i,
    /\bpipe\s*(has\s*)?(leak|burst|broke)\b/i,
    /\b(burst|broken|leaking)\s*pipe\b/i,
    /\bboiler\s*(not|isn't|isnt|won't|wont|broken|issue|problem)\b/i,
    /\b(no\s+)?(hot\s+water|heating)\s*(not\s+|won't\s+|wont\s+)?work/i,
    /\bheating\s+won'?t\s+work/i,
    /\belectric(al)?\s*(shock|socket|issue|problem|fault)\b/i,
    /\bgot\s+a\s+shock\s+from/i,
    /\bstructur(al|e)\s*(change|work|alteration|issue|problem|damage)\b/i,
    /\bcarbon\s*monoxide\b/i,
    /\bco\s*(alarm|detector|leak)\b/i,
    /\bsubsidence\b/i,
    /\bfoundation(s)?\s*(issue|problem|crack|damage)\b/i,
    /\b(is\s+)?(it|this|that)\s+(safe|dangerous|ok|okay)\b/i,
    /\bsafe\s+to\s+(drill|remove|knock|alter|change|modify)\b/i,
    /\bwiring\s*(in\s+my|looks?\s+old|is\s+old|frayed)\b/i,
    /\bdamp\s*(is\s*)?(coming|through)\b/i,
    /\bwater\s+is\s+coming\s+through\b/i,
    /\bsmells?\s+like\s+(it'?s?\s+)?burning\b/i,
    /\bsomething\s+smells?\s+like\b/i
  ];

  const matchedKeyword = keywords.find((kw) => lower.includes(kw));
  if (matchedKeyword) {
    return { isCritical: true, matchedKeyword };
  }

  for (const pattern of patterns) {
    if (pattern.test(message)) {
      return { isCritical: true, matchedKeyword: `pattern:${pattern.source.slice(0, 30)}` };
    }
  }

  return { isCritical: false, matchedKeyword: null };
}

// Standard safe response for safety-critical queries (bypasses LLM entirely)
const SAFETY_INTERCEPT_RESPONSE = `Thanks for flagging that, and I'm glad you asked. I cannot safely assess structural, electrical, gas, fire, or health risks from here. For anything that might affect safety or the structure of your home, you should contact a qualified professional such as your builder, management company, electrician, plumber, or relevant contractor.

If you believe there is any immediate risk to health, safety, or property (for example smells of gas, burning, sparking, major leak, or structural movement), please contact emergency services immediately on 999 or 112. Do not rely on this assistant for emergency guidance.

For non-urgent concerns, your homeowner manual includes contact details for reporting defects and maintenance issues. I'm happy to help you find that information if you'd like.`;

// HIGH-RISK TOPIC DETECTION: Detect safety/emergency questions that should not show document sources
function detectHighRiskTopic(message: string): { isHighRisk: boolean; category: string | null } {
  const messageLower = message.toLowerCase();
  
  // Emergency patterns - immediate danger
  if (/\b(emergency|ambulance|fire|choking|heart attack|can't breathe|bleeding|unconscious|999|112|help.*immediately)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'emergency' };
  }
  
  // Medical/health patterns
  if (/\b(hospital|doctor|gp|nhs|health|illness|sick|injured|injury|medical|symptoms?|diagnosis|prescription|medicine)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'medical' };
  }
  
  // Legal patterns
  if (/\b(solicitor|lawyer|legal|lawsuit|sue|court|contract dispute|liability|compensation|claim)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'legal' };
  }
  
  // Structural safety patterns
  if (/\b(crack|subsidence|structural|load.?bearing|foundation|collapse|dangerous.*building)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'structural' };
  }
  
  // Fire safety patterns  
  if (/\b(fire.*escape|fire.*alarm|smoke.*detector|fire.*door|fire.*safety|fire.*extinguisher)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'fire_safety' };
  }
  
  // Electrical/Gas safety patterns
  if (/\b(gas.*leak|gas.*smell|electric.*shock|electrical.*fault|boiler.*problem|carbon.*monoxide)\b/i.test(messageLower)) {
    return { isHighRisk: true, category: 'electrical_gas' };
  }
  
  return { isHighRisk: false, category: null };
}

// GDPR PROTECTION: Detect questions about other residents' homes/units
function detectOtherUnitQuestion(message: string, userUnitAddress: string | null): { isAboutOtherUnit: boolean; mentionedUnit: string | null } {
  const messageLower = message.toLowerCase();
  
  // Patterns that indicate asking about a specific unit/address
  const unitPatterns = [
    /(?:number|no\.?|#|unit|house|flat|apartment)\s*(\d+)/gi,
    /(\d+)\s*(?:longview|park|street|road|avenue|lane|drive|close|way|court|gardens)/gi,
    /(?:my\s+)?neighbour'?s?\s+(?:house|home|unit|place)/gi,
    /(?:next\s+door|across\s+the\s+(?:road|street)|down\s+the\s+(?:road|street))/gi,
    /(?:who\s+lives?\s+(?:at|in)|what'?s?\s+(?:at|in))\s+(?:number|no\.?|#)?\s*\d+/gi,
    /(?:tell\s+me\s+about|information\s+(?:on|about))\s+(?:number|no\.?|#|unit|house)?\s*\d+/gi,
  ];
  
  let mentionedUnit: string | null = null;
  
  for (const pattern of unitPatterns) {
    const matches = message.match(pattern);
    if (matches && matches.length > 0) {
      mentionedUnit = matches[0];
      
      // If user has a known address, check if they're asking about their OWN unit
      if (userUnitAddress) {
        const userAddressLower = userUnitAddress.toLowerCase();
        // Extract numbers from user's address
        const userUnitNumbers: string[] = userAddressLower.match(/\d+/g) || [];
        const mentionedNumbers: string[] = mentionedUnit.toLowerCase().match(/\d+/g) || [];
        
        // If the mentioned number matches the user's unit number, it's about THEIR home - allow it
        if (mentionedNumbers.length > 0 && userUnitNumbers.length > 0) {
          const firstMentioned = mentionedNumbers[0];
          if (firstMentioned && userUnitNumbers.includes(firstMentioned)) {
            return { isAboutOtherUnit: false, mentionedUnit: null };
          }
        }
      }
      
      return { isAboutOtherUnit: true, mentionedUnit };
    }
  }
  
  // Check for neighbour-related questions
  if (/\b(neighbour|neighbor|neighbours|neighbors|next\s*door|other\s+(unit|home|house|flat|apartment)s?)\b/i.test(messageLower)) {
    // Allow general community questions
    if (/\b(community|area|estate|development|scheme|facilities|amenities)\b/i.test(messageLower)) {
      return { isAboutOtherUnit: false, mentionedUnit: null };
    }
    // But block specific questions about neighbours' homes
    if (/\b(their|who|what|how\s+(big|large|many)|layout|floor\s*plan|bedrooms?|rooms?)\b/i.test(messageLower)) {
      return { isAboutOtherUnit: true, mentionedUnit: 'neighbour' };
    }
  }
  
  return { isAboutOtherUnit: false, mentionedUnit: null };
}

// Fetch user's unit details for GDPR context
async function getUserUnitDetails(unitUid: string): Promise<{ address: string | null; houseType: string | null }> {
  if (!unitUid) return { address: null, houseType: null };
  
  try {
    const { data, error } = await supabase
      .from('units')
      .select('address_line_1, house_type')
      .eq('id', unitUid)
      .single();
    
    if (error || !data) {
      console.log('[Chat] Could not fetch unit details for GDPR context');
      return { address: null, houseType: null };
    }
    
    return {
      address: data.address_line_1 || null,
      houseType: data.house_type || null,
    };
  } catch (err) {
    console.error('[Chat] Error fetching unit details:', err);
    return { address: null, houseType: null };
  }
}

// Parse embedding from Supabase (may be string, array, or object)
function parseEmbedding(emb: any): number[] | null {
  if (!emb) return null;
  
  // Already an array
  if (Array.isArray(emb)) return emb;
  
  // String format: "[0.1, 0.2, ...]" or "0.1,0.2,..."
  if (typeof emb === 'string') {
    try {
      // Try JSON parse first
      const parsed = JSON.parse(emb);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Try comma-separated format
      const cleaned = emb.replace(/[\[\]]/g, '').trim();
      if (cleaned) {
        const nums = cleaned.split(',').map(s => parseFloat(s.trim()));
        if (nums.length > 0 && !isNaN(nums[0])) return nums;
      }
    }
  }
  
  // Object with values property
  if (typeof emb === 'object' && emb.values) {
    return Array.isArray(emb.values) ? emb.values : null;
  }
  
  return null;
}

// Calculate cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Clean markdown formatting from AI responses (remove asterisks, keep clean text)
function cleanMarkdownFormatting(text: string): string {
  return text
    // Remove bold/italic markdown: **text** or *text* -> text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove any remaining standalone asterisks used for bullets (replace with dash)
    .replace(/^\s*\*\s+/gm, '- ')
    // Clean up any double asterisks that might be left
    .replace(/\*\*/g, '')
    .replace(/\*/g, '');
}

// Check if message is a follow-up that needs context (must have pronouns/anaphora)
function isFollowUpQuestion(message: string): boolean {
  const trimmed = message.trim().toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;
  
  // STRICT: Only treat as follow-up if it has anaphoric pronouns (referring to previous topic)
  const hasAnaphoricPronouns = /\b(them|they|it|its|those|these|the same)\b/i.test(trimmed);
  
  // Short messages with anaphoric pronouns definitely need context
  const isShort = wordCount <= 8;
  
  // Explicit follow-up patterns (not just any question)
  const followUpPatterns = [
    /^(and|but|also|what about|how about|tell me more|more info|more details)/i,
    /^(who|what|where|when|how|why)\s+(makes?|is|are|does|do|about)\s+(them|it|those|these)\b/i,
  ];
  
  const matchesExplicitPattern = followUpPatterns.some(p => p.test(trimmed));
  
  // Only return true if there are anaphoric pronouns or explicit follow-up patterns
  return (isShort && hasAnaphoricPronouns) || matchesExplicitPattern;
}

// Load recent conversation history for a user (only if properly identified)
async function loadConversationHistory(userId: string, tenantId: string, developmentId: string): Promise<{ userMessage: string; aiMessage: string }[]> {
  // SECURITY: Never load history for anonymous or unidentified users to prevent cross-session leakage
  if (!userId || userId === 'anonymous' || userId.length < 10) {
    console.log('[Chat] Skipping history load - user not properly identified');
    return [];
  }
  
  try {
    // Scope history to specific user within tenant/development for isolation
    const recentMessages = await db
      .select({
        userMessage: messages.user_message,
        aiMessage: messages.ai_message,
        createdAt: messages.created_at,
      })
      .from(messages)
      .where(
        and(
          eq(messages.user_id, userId),
          eq(messages.tenant_id, tenantId),
          eq(messages.development_id, developmentId)
        )
      )
      .orderBy(desc(messages.created_at))
      .limit(CONVERSATION_HISTORY_LIMIT);
    
    // Reverse to get chronological order (oldest first)
    return recentMessages
      .filter(m => m.userMessage && m.aiMessage)
      .reverse()
      .map(m => ({
        userMessage: m.userMessage || '',
        aiMessage: m.aiMessage || '',
      }));
  } catch (error) {
    console.error('[Chat] Error loading conversation history:', error);
    return [];
  }
}

// Expand a follow-up query with context from previous messages
function expandQueryWithContext(currentMessage: string, history: { userMessage: string; aiMessage: string }[]): string {
  if (history.length === 0) return currentMessage;
  
  // Get the most recent exchange for context
  const lastExchange = history[history.length - 1];
  
  // Build a context-aware query for semantic search
  const contextQuery = `Previous topic: ${lastExchange.userMessage}\nCurrent question: ${currentMessage}`;
  
  console.log('[Chat] Expanded query for semantic search:', contextQuery.slice(0, 100) + '...');
  return contextQuery;
}

export async function POST(request: NextRequest) {
  console.log('\n============================================================');
  console.log('[Chat] RAG CHAT API - SEMANTIC SEARCH MODE');
  console.log('[Chat] PROJECT_ID:', PROJECT_ID);
  console.log('============================================================');

  const startTime = Date.now();
  
  // TEST MODE: Allow test harness to get JSON responses instead of streaming
  const { searchParams } = new URL(request.url);
  const testMode = searchParams.get('test_mode') === 'json';
  if (testMode) {
    console.log('[Chat] TEST MODE ENABLED - will return JSON instead of streaming');
  }

  try {
    const body = await request.json();
    const { message, unitUid: clientUnitUid, userId } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // SAFETY-CRITICAL PRE-FILTER: Intercept dangerous queries BEFORE they hit the LLM or RAG
    const safetyCheck = isSafetyCriticalQuery(message);
    if (safetyCheck.isCritical) {
      console.log('[Chat] SAFETY INTERCEPT: Query blocked by pre-filter, matched keyword:', safetyCheck.matchedKeyword);
      
      // Log the safety intercept for analytics/monitoring
      try {
        await db.insert(messages).values({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: userId || 'anonymous',
          content: message,
          user_message: message,
          ai_message: SAFETY_INTERCEPT_RESPONSE,
          question_topic: 'safety_intercept',
          sender: 'conversation',
          source: 'purchaser_portal',
          token_count: 0,
          cost_usd: '0',
          latency_ms: Date.now() - startTime,
          metadata: {
            safetyIntercept: true,
            matchedKeyword: safetyCheck.matchedKeyword,
            unitUid: clientUnitUid || null,
            userId: userId || null,
          },
        });
        console.log('[Chat] Safety intercept logged to database');
      } catch (logError) {
        console.error('[Chat] Failed to log safety intercept:', logError);
      }
      
      // Return standard safe response WITHOUT calling RAG or LLM
      return NextResponse.json({
        success: true,
        answer: SAFETY_INTERCEPT_RESPONSE,
        source: 'safety_intercept',
        safetyIntercept: true,
        isNoInfo: false,
      });
    }

    const token = request.headers.get('x-qr-token');
    let validatedUnitUid: string | null = null;

    if (token) {
      try {
        const payload = await validateQRToken(token);
        if (payload && payload.supabaseUnitId) {
          validatedUnitUid = payload.supabaseUnitId;
          console.log('[Chat] Token validated, unit derived from token:', validatedUnitUid);
        } else {
          console.log('[Chat] Token validation failed - drawings will not be accessible');
        }
      } catch (tokenError) {
        console.log('[Chat] Token validation error - drawings will not be accessible:', tokenError);
      }
    } else {
      console.log('[Chat] No token provided - drawings will not be accessible for security');
    }

    console.log('🔍 Search Query:', message);

    // Establish effective unit UID with fallback chain for drawing lookup
    const effectiveUnitUid = validatedUnitUid || clientUnitUid || null;
    console.log('[Chat] Effective unit UID for drawings:', effectiveUnitUid || 'none');

    // GDPR PROTECTION: Fetch user's unit details and check for questions about other units
    const userUnitDetails = effectiveUnitUid 
      ? await getUserUnitDetails(effectiveUnitUid)
      : { address: null, houseType: null };
    
    console.log('[Chat] User unit address:', userUnitDetails.address || 'unknown');
    
    const gdprCheck = detectOtherUnitQuestion(message, userUnitDetails.address);
    
    // HIGH-RISK TOPIC DETECTION: Check if this is a safety/emergency question
    const highRiskCheck = detectHighRiskTopic(message);
    if (highRiskCheck.isHighRisk) {
      console.log('[Chat] HIGH-RISK TOPIC detected:', highRiskCheck.category);
    }
    
    if (gdprCheck.isAboutOtherUnit) {
      console.log('[Chat] GDPR BLOCK: Question about other unit detected:', gdprCheck.mentionedUnit);
      
      const gdprResponse = userUnitDetails.address
        ? `I'm afraid I can only provide information about your own home at ${userUnitDetails.address}, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes. Is there anything I can help you with regarding your own property or the development as a whole?`
        : `I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes. Is there anything I can help you with regarding your own property or the development as a whole?`;
      
      // Save the GDPR-blocked interaction to database for analytics
      try {
        await db.insert(messages).values({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: validatedUnitUid || userId || 'anonymous',
          content: message,
          user_message: message,
          ai_message: gdprResponse,
          question_topic: 'gdpr_blocked',
          sender: 'conversation',
          source: 'purchaser_portal',
          token_count: 0,
          cost_usd: '0',
          latency_ms: Date.now() - startTime,
          metadata: {
            unitUid: validatedUnitUid || null,
            userId: userId || null,
            gdprBlocked: true,
            mentionedUnit: gdprCheck.mentionedUnit,
          },
        });
      } catch (dbError) {
        console.error('[Chat] Failed to save GDPR-blocked message:', dbError);
      }
      
      return NextResponse.json({
        success: true,
        answer: gdprResponse,
        source: 'gdpr_protection',
        gdprBlocked: true,
      });
    }

    // STEP 0: Load conversation history for context-aware responses
    // Use validated unit UID (from QR token) as the primary user identifier for session isolation
    const conversationUserId = validatedUnitUid || userId || '';
    const conversationHistory = await loadConversationHistory(conversationUserId, DEFAULT_TENANT_ID, DEFAULT_DEVELOPMENT_ID);
    console.log('[Chat] Loaded', conversationHistory.length, 'previous exchanges for context');
    
    // Check if this is a follow-up question that needs context expansion
    const needsContext = isFollowUpQuestion(message) && conversationHistory.length > 0;
    const searchQuery = needsContext 
      ? expandQueryWithContext(message, conversationHistory)
      : message;
    
    if (needsContext) {
      console.log('[Chat] Follow-up detected, using expanded query for semantic search');
    }

    // STEP 1: Generate embedding for the search query (may be expanded with context)
    console.log('[Chat] Generating query embedding...');
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchQuery,
      dimensions: 1536,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('[Chat] Query embedding generated');

    // STEP 2: Semantic search using cosine similarity on ALL chunks
    // First, get list of superseded document IDs to filter out from RAG
    let supersededDocIds = new Set<string>();
    try {
      const { rows: superseded } = await db.execute(sql`
        SELECT id FROM documents 
        WHERE tenant_id = ${DEFAULT_TENANT_ID}::uuid 
        AND is_superseded = true
      `);
      supersededDocIds = new Set((superseded as any[]).map(r => r.id));
      if (supersededDocIds.size > 0) {
        console.log('[Chat] Filtering out', supersededDocIds.size, 'superseded documents from RAG');
      }
    } catch (e) {
      console.log('[Chat] Could not check superseded docs:', e);
    }
    
    // Fetch ALL chunks with embeddings for proper semantic search
    console.log('[Chat] Loading all document chunks with embeddings...');
    const { data: allChunks, error: fetchError } = await supabase
      .from('document_sections')
      .select('id, content, metadata, embedding')
      .eq('project_id', PROJECT_ID);

    if (fetchError) {
      console.error('[Chat] Error fetching chunks:', fetchError.message);
      throw new Error('Failed to load documents');
    }

    console.log('[Chat] Loaded', allChunks?.length || 0, 'total chunks');

    // Calculate similarity scores for ALL chunks
    let chunks: any[] = [];
    if (allChunks && allChunks.length > 0) {
      console.log('[Chat] Computing semantic similarity scores...');
      
      // Filter out superseded documents before scoring
      // Also filter out technical/engineering documents that are NOT homeowner-facing
      const EXCLUDED_DISCIPLINES = [
        'structural', 'engineering', 'electrical', 'mechanical', 'plumbing',
        'mep', 'hvac', 'fire_strategy', 'fire_engineering', 'gas', 'construction',
        'as_built', 'detailed_design', 'technical', 'contractor'
      ];
      
      const EXCLUDED_FILENAME_PATTERNS = [
        /structural/i, /engineer/i, /\bSE\b/, /\bMEP\b/, /electrical.*schematic/i,
        /gas.*schematic/i, /fire.*strategy/i, /construction.*issue/i, /as.?built/i,
        /detailed.*design/i, /contractor.*manual/i, /internal.*spec/i,
        /load.*calc/i, /beam.*calc/i, /foundation/i, /reinforcement/i
      ];
      
      const activeChunks = allChunks.filter(chunk => {
        const docId = chunk.metadata?.document_id;
        const discipline = (chunk.metadata?.discipline || '').toLowerCase();
        const fileName = (chunk.metadata?.file_name || chunk.metadata?.source || '').toLowerCase();
        
        // Exclude superseded documents
        if (docId && supersededDocIds.has(docId)) {
          return false;
        }
        
        // Exclude technical/engineering disciplines
        if (EXCLUDED_DISCIPLINES.some(d => discipline.includes(d))) {
          return false;
        }
        
        // Exclude files with technical/engineering patterns in filename
        if (EXCLUDED_FILENAME_PATTERNS.some(pattern => pattern.test(fileName))) {
          return false;
        }
        
        // Default to include if is_homeowner_facing is true or not set (assume safe)
        // Only exclude if explicitly marked as not homeowner-facing
        if (chunk.metadata?.is_homeowner_facing === false) {
          return false;
        }
        
        return true;
      });
      
      if (activeChunks.length < allChunks.length) {
        console.log('[Chat] Filtered to', activeChunks.length, 'chunks after removing superseded + technical docs (from', allChunks.length, ')');
      }
      
      const scoredChunks = activeChunks.map(chunk => {
        // Parse and calculate semantic similarity using embeddings
        let similarity = 0;
        const parsedEmbedding = parseEmbedding(chunk.embedding);
        if (parsedEmbedding) {
          similarity = cosineSimilarity(queryEmbedding, parsedEmbedding);
        }
        
        // Boost score for keyword matches (hybrid search)
        const keywords = message.toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
        const contentLower = (chunk.content || '').toLowerCase();
        const metadataStr = JSON.stringify(chunk.metadata || {}).toLowerCase();
        
        let keywordBoost = 0;
        keywords.forEach((kw: string) => {
          if (contentLower.includes(kw)) keywordBoost += 0.05;
          if (metadataStr.includes(kw)) keywordBoost += 0.03;
        });
        
        // Combined score: semantic similarity + keyword boost
        const finalScore = similarity + keywordBoost;
        
        return {
          id: chunk.id,
          content: chunk.content,
          metadata: chunk.metadata,
          similarity,
          keywordBoost,
          score: finalScore,
        };
      });
      
      // Sort by score and take top chunks
      scoredChunks.sort((a, b) => b.score - a.score);
      
      // MINIMUM RELEVANCE THRESHOLD - if top chunks aren't relevant enough, treat as "no info"
      // This prevents forcing irrelevant context into the prompt
      const MIN_RELEVANCE_SIMILARITY = 0.25; // Raw cosine similarity threshold
      const topChunkSimilarity = scoredChunks[0]?.similarity || 0;
      
      if (topChunkSimilarity < MIN_RELEVANCE_SIMILARITY) {
        console.log('[Chat] Top chunk similarity', topChunkSimilarity.toFixed(3), 'below threshold', MIN_RELEVANCE_SIMILARITY);
        console.log('[Chat] Treating as "no relevant information found"');
        // Don't add any chunks - this will trigger the "no documents" prompt
      } else {
        // Take top chunks that fit within context limit
        let totalChars = 0;
        for (const chunk of scoredChunks) {
          if (chunks.length >= MAX_CHUNKS) break;
          if (totalChars + chunk.content.length > MAX_CONTEXT_CHARS) break;
          chunks.push(chunk);
          totalChars += chunk.content.length;
        }
      }
      
      console.log('[Chat] Selected', chunks.length, 'most relevant chunks');
      if (chunks.length > 0) {
        console.log('[Chat] Top chunk scores:', chunks.slice(0, 3).map(c => ({
          score: c.score.toFixed(3),
          similarity: c.similarity.toFixed(3),
          source: c.metadata?.file_name || 'unknown'
        })));
      }
    }

    // STEP 3: Build System Message with relevant context only
    let systemMessage: string;
    
    // Check if this is the first message in the conversation (for greeting logic)
    const isFirstMessage = conversationHistory.length === 0;

    if (chunks && chunks.length > 0) {
      const referenceData = chunks
        .map((chunk: any) => chunk.content)
        .join('\n---\n');

      const sources = Array.from(new Set(chunks.map((c: any) => c.metadata?.file_name || c.metadata?.source || 'Document')));

      systemMessage = `You are a friendly on-site concierge for a residential development. Think of yourself as a helpful neighbour who knows the estate inside out - approachable, calm, and practical.

PERSONALITY & TONE:
- Be warm and conversational, like a friendly local who genuinely wants to help
- Use clear, natural Irish/UK English (favour "colour" over "color", "centre" over "center", etc.)
- Keep answers concise: 2-5 short paragraphs maximum for most questions
- No corporate jargon or over-the-top enthusiasm - just calm, practical helpfulness

GREETING BEHAVIOUR:
${isFirstMessage ? `- This is the homeowner's first message. Start with a brief, warm welcome (one sentence max), then answer their question directly.` : `- This is a follow-up message. Do NOT repeat any welcome or greeting - just answer the question directly.`}

ANSWERING STYLE:
- Get straight to the point - answer the question first, then add helpful context if needed
- Only use bullet points or headings when they genuinely improve clarity, not by default
- Reference the homeowner's house type or development context when it's clearly useful, but don't repeat their full address every time

FORMATTING RULES (CRITICAL):
- NEVER use asterisks (*) or markdown formatting in your responses
- For section headings, just use the title followed by a colon on its own line (e.g. "Walls:" not "**Walls:**")
- For emphasis, use plain language rather than bold or italics
- Use simple dashes (-) for bullet points, not asterisks
- Keep formatting clean and professional - no special characters for styling

REFERENCE DATA (from: ${sources.join(', ')}):
--- BEGIN REFERENCE DATA ---
${referenceData}
--- END REFERENCE DATA ---

CRITICAL - NO GUESSING (ACCURACY REQUIREMENT):
- ONLY answer based on the REFERENCE DATA provided above. Do NOT make up, guess, or infer information that is not explicitly stated.
- If the answer is NOT in the reference data, you MUST say: "I don't have that information to hand. I'd recommend contacting your developer or management company directly for accurate details."
- NEVER fabricate specifications, dates, contact details, prices, or any factual claims
- If you're uncertain whether something is accurate, err on the side of caution and direct the user to verify with the appropriate party
- It is better to admit you don't know than to provide incorrect information

CRITICAL - HIGH-RISK TOPICS (SAFETY & LEGAL REQUIREMENT):
You are NOT qualified to advise on the following topics. For these, provide only general guidance and redirect to appropriate professionals:

- MEDICAL/HEALTH: If anyone mentions illness, injury, or health concerns, say: "I'm not able to give medical advice. For health concerns, please contact your GP or call NHS 111. For emergencies, call 999 or 112 immediately."

- LEGAL MATTERS: For questions about contracts, warranties, liability, or legal disputes, say: "I can't provide legal advice. For legal questions about your property, please consult a solicitor."

- STRUCTURAL SAFETY: If asked about cracks, subsidence, load-bearing walls, or structural concerns, say: "I can't assess structural safety - that requires a professional inspection. Please contact a structural engineer or your developer's warranty provider."

- FIRE SAFETY: For questions about fire alarms, escape routes, fire doors, or fire compliance, say: "Fire safety is critical and requires professional assessment. Please contact your local fire service for guidance or check with your management company."

- ELECTRICAL/GAS: For electrical faults, gas smells, boiler issues, or utility concerns, say: "Electrical and gas issues can be dangerous. Please contact a registered electrician (for electrical) or Gas Networks Ireland / Gas Emergency 0800 111 999 (for gas). For suspected gas leaks, leave the property and call the emergency line immediately."

- EMERGENCIES: If anyone mentions an emergency, fire, flood, or danger, say: "For emergencies, please call 999 or 112 immediately. Your safety is the priority."

SAFETY & LIABILITY RULES (MANDATORY):

You must never give structural, electrical, plumbing, gas, heating system repair, load-bearing, or fire-safety advice beyond quoting official documents.

You must never tell a user that a wall is safe to remove, drill into, or modify.

You must never confirm whether any installation, appliance, or structural element is working correctly, safe, compliant, or permissible to alter.

You must never diagnose defects, hazards, or risks.

If asked about safety-critical topics, you must respond ONLY with:

High-level educational information (non-prescriptive)

References to official documents

A clear redirection to qualified professionals or emergency services

If a user asks a safety-critical question (structural, electrical, gas, load-bearing, fire risk, mould, leaks, heating failure, appliance failure, or anything that could cause harm), respond with this pattern:

Acknowledge the concern

Say you cannot give safety or structural advice

Point to the correct professional route (builder, electrician, fire service, warranty provider)

If relevant, reference the homeowner manual section on reporting defects

You must NOT guess or infer safety information from drawings, floor plans, or general documents.
If something is unclear or not explicitly stated, you MUST say you do not know.

Emergency rule:
If a user indicates immediate danger (smell of gas, burning smell, electrical arcing, sparking, major leak, structural movement), instruct them to immediately contact emergency services (999 or 112) or a licensed professional. Do not provide further guidance.

CRITICAL - ROOM DIMENSIONS (LIABILITY REQUIREMENT):
- NEVER provide specific room dimensions, measurements, or sizes (in metres, feet, or any unit)
- If asked about room sizes, dimensions, floor area, or measurements, respond with:
  "I've popped the floor plan below for you - that'll have the accurate room dimensions."
- Do NOT quote any measurements from the documents - always direct users to check the official drawings themselves

CRITICAL - GDPR PRIVACY PROTECTION (LEGAL REQUIREMENT):
- You MUST ONLY discuss information about the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- NEVER provide any information about other residents' homes, units, or properties under any circumstances
- If asked about another unit, neighbour's home, or any other resident's property, respond with:
  "I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes."
- You ARE allowed to discuss: general development/estate information, community amenities, shared facilities, local area information
- You are NOT allowed to discuss: any specific unit that is not the logged-in user's home, other residents' details, neighbour's properties`;

      console.log('[Chat] Context loaded:', referenceData.length, 'chars from', chunks.length, 'chunks');
    } else {
      systemMessage = `You are a friendly on-site concierge for a residential development. Unfortunately, there are no documents uploaded yet for this development that answer this question. 

CRITICAL - NO GUESSING (ACCURACY REQUIREMENT):
- You do NOT have reference data for this question. You MUST say: "I don't have that information to hand. I'd recommend contacting your developer or management company directly for accurate details."
- NEVER make up, guess, or infer any information whatsoever
- Do not provide any factual claims about the property, development, or any specifications

CRITICAL - HIGH-RISK TOPICS (SAFETY & LEGAL REQUIREMENT):
You are NOT qualified to advise on the following topics:

- MEDICAL/HEALTH: Say: "I'm not able to give medical advice. For health concerns, please contact your GP or call NHS 111. For emergencies, call 999 or 112 immediately."
- LEGAL MATTERS: Say: "I can't provide legal advice. For legal questions about your property, please consult a solicitor."
- STRUCTURAL SAFETY: Say: "I can't assess structural safety - that requires a professional inspection. Please contact a structural engineer or your developer's warranty provider."
- FIRE SAFETY: Say: "Fire safety is critical and requires professional assessment. Please contact your local fire service for guidance or check with your management company."
- ELECTRICAL/GAS: Say: "Electrical and gas issues can be dangerous. Please contact a registered electrician (for electrical) or Gas Networks Ireland / Gas Emergency 0800 111 999 (for gas). For suspected gas leaks, leave the property and call the emergency line immediately."
- EMERGENCIES: Say: "For emergencies, please call 999 or 112 immediately. Your safety is the priority."

SAFETY & LIABILITY RULES (MANDATORY):

You must never give structural, electrical, plumbing, gas, heating system repair, load-bearing, or fire-safety advice beyond quoting official documents.

You must never tell a user that a wall is safe to remove, drill into, or modify.

You must never confirm whether any installation, appliance, or structural element is working correctly, safe, compliant, or permissible to alter.

You must never diagnose defects, hazards, or risks.

If asked about safety-critical topics, you must respond ONLY with:

High-level educational information (non-prescriptive)

References to official documents

A clear redirection to qualified professionals or emergency services

If a user asks a safety-critical question (structural, electrical, gas, load-bearing, fire risk, mould, leaks, heating failure, appliance failure, or anything that could cause harm), respond with this pattern:

Acknowledge the concern

Say you cannot give safety or structural advice

Point to the correct professional route (builder, electrician, fire service, warranty provider)

If relevant, reference the homeowner manual section on reporting defects

You must NOT guess or infer safety information from drawings, floor plans, or general documents.
If something is unclear or not explicitly stated, you MUST say you do not know.

Emergency rule:
If a user indicates immediate danger (smell of gas, burning smell, electrical arcing, sparking, major leak, structural movement), instruct them to immediately contact emergency services (999 or 112) or a licensed professional. Do not provide further guidance.

CRITICAL - GDPR PRIVACY PROTECTION (LEGAL REQUIREMENT):
- You MUST ONLY discuss information about the logged-in homeowner's own unit${userUnitDetails.address ? ` (${userUnitDetails.address})` : ''}
- NEVER provide any information about other residents' homes, units, or properties under any circumstances
- If asked about another unit, neighbour's home, or any other resident's property, respond with:
  "I'm afraid I can only provide information about your own home, or general information about the development and community. For privacy reasons under EU GDPR guidelines, I'm not able to share details about other residents' homes."`;
      console.log('[Chat] No relevant documents found for this query');
      
      // Log unanswered event for "what couldn't be answered" insights
      logAnalyticsEvent({
        tenantId: DEFAULT_TENANT_ID,
        developmentId: DEFAULT_DEVELOPMENT_ID,
        eventType: 'unanswered',
        eventCategory: 'no_relevant_docs',
        eventData: { reason: 'low_similarity_or_no_chunks' },
        sessionId: validatedUnitUid || userId,
      }).catch(() => {}); // Don't fail chat if analytics fails
    }

    // STEP 4: Extract question topic and find drawing BEFORE streaming (parallel with RAG)
    const questionTopicPromise = extractQuestionTopic(message);
    
    let drawing: ResolvedDrawing | null = null;
    let drawingExplanation = '';
    
    // Check if this is an ambiguous dimension question that needs clarification
    const isAmbiguousSizeQuestion = /\b(how\s*(big|large)|size|dimensions?)\s*(of|is)?\s*(my|the)?\s*(house|home|property)\b/i.test(message) ||
      /\b(what|how)\s+.*(house|home|property)\s*.*(size|dimensions?|big|large)\b/i.test(message);
    
    // Start drawing lookup in parallel with topic extraction
    const drawingPromise = effectiveUnitUid 
      ? findDrawingForQuestion(effectiveUnitUid, await questionTopicPromise).catch(err => {
          console.error('[Chat] Error finding drawing:', err);
          return { found: false, drawing: null, explanation: '' };
        })
      : Promise.resolve({ found: false, drawing: null, explanation: '' });

    const [questionTopic, drawingResult] = await Promise.all([
      questionTopicPromise,
      drawingPromise
    ]);

    console.log('[Chat] Question topic:', questionTopic);
    
    // Log analytics event (anonymised - no PII)
    logAnalyticsEvent({
      tenantId: DEFAULT_TENANT_ID,
      developmentId: DEFAULT_DEVELOPMENT_ID,
      eventType: 'chat_question',
      eventCategory: questionTopic || 'unknown',
      eventData: {
        hasContext: chunks.length > 0,
        chunkCount: chunks.length,
        topSimilarity: chunks[0]?.similarity?.toFixed(3) || 0,
      },
      sessionId: validatedUnitUid || conversationUserId,
    }).catch(() => {}); // Don't fail chat if analytics fails
    
    // If question is ambiguous about internal vs external, offer clarification
    if (isAmbiguousSizeQuestion && effectiveUnitUid) {
      console.log('[Chat] Ambiguous size question detected - offering clarification');
      
      const clarificationResponse = "Would you like to see the internal floor plans (showing room layouts and dimensions) or the external elevations (showing the outside appearance of your home)?";
      
      // Save clarification interaction
      try {
        await db.insert(messages).values({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: conversationUserId || 'anonymous',
          content: message,
          user_message: message,
          ai_message: clarificationResponse,
          question_topic: 'clarification_needed',
          sender: 'conversation',
          source: 'purchaser_portal',
          token_count: 0,
          cost_usd: '0',
          latency_ms: Date.now() - startTime,
          metadata: {
            unitUid: effectiveUnitUid,
            clarificationType: 'drawing_type',
          },
        });
      } catch (dbError) {
        console.error('[Chat] Failed to save clarification message:', dbError);
      }
      
      return NextResponse.json({
        success: true,
        answer: clarificationResponse,
        source: 'clarification',
        clarification: {
          type: 'drawing_type',
          options: [
            { id: 'internal', label: 'Internal Floor Plans', description: 'Room layouts and dimensions' },
            { id: 'external', label: 'External Elevations', description: 'Outside appearance of your home' },
          ],
        },
      });
    }

    if (drawingResult.found && drawingResult.drawing) {
      drawing = drawingResult.drawing;
      drawingExplanation = drawingResult.explanation;
      console.log('[Chat] Found drawing:', drawing.fileName, 'Type:', drawing.drawingType);
    }

    // Check for dimension question BEFORE streaming - may need to override response
    const isDimensionQuestion = questionTopic === 'room_sizes' || 
      /\b(dimension|size|measurement|square\s*(feet|meters|m2|ft2)|how\s*(big|large)|floor\s*area)\b/i.test(message);
    
    const shouldOverrideForLiability = isDimensionQuestion && drawing && drawing.drawingType === 'room_sizes';

    // STEP 5: Generate Response with STREAMING
    console.log('[Chat] Generating streaming response with GPT-4o-mini...');
    
    // Build messages array with conversation history for context
    const chatMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemMessage },
    ];
    
    // Add recent conversation history so the AI understands follow-up questions
    if (conversationHistory.length > 0) {
      console.log('[Chat] Including', conversationHistory.length, 'previous exchanges in context');
      for (const exchange of conversationHistory) {
        chatMessages.push({ role: 'user', content: exchange.userMessage });
        chatMessages.push({ role: 'assistant', content: exchange.aiMessage });
      }
    }
    
    // Add the current user message
    chatMessages.push({ role: 'user', content: message });

    // If liability override needed, return immediately without streaming
    if (shouldOverrideForLiability) {
      const liabilityAnswer = "I've popped the floor plan below for you - that'll have the accurate room dimensions.";
      console.log('[Chat] Dimension question detected - enforced floor plan response for liability');
      
      // Save to database
      try {
        await db.insert(messages).values({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: conversationUserId || 'anonymous',
          content: message,
          user_message: message,
          ai_message: liabilityAnswer,
          question_topic: questionTopic,
          sender: 'conversation',
          source: 'purchaser_portal',
          token_count: 0,
          cost_usd: '0',
          latency_ms: Date.now() - startTime,
          metadata: {
            unitUid: validatedUnitUid || null,
            userId: userId || null,
            chunksUsed: chunks?.length || 0,
            model: 'gpt-4o-mini',
            liabilityOverride: true,
          },
        });
      } catch (dbError) {
        console.error('[Chat] Failed to save message:', dbError);
      }

      return NextResponse.json({
        success: true,
        answer: liabilityAnswer,
        source: 'liability_override',
        chunksUsed: chunks?.length || 0,
        drawing: drawing ? {
          fileName: drawing.fileName,
          drawingType: drawing.drawingType,
          drawingDescription: drawing.drawingDescription,
          houseTypeCode: drawing.houseTypeCode,
          previewUrl: drawing.signedUrl,
          downloadUrl: drawing.downloadUrl,
          explanation: drawingExplanation,
        } : undefined,
      });
    }

    // TEST MODE: Return JSON response instead of streaming for test harness
    if (testMode) {
      console.log('[Chat] TEST MODE: Generating non-streaming response...');
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: chatMessages,
        temperature: 0.3,
        max_tokens: 800,
        stream: false,
      });
      
      const fullAnswer = cleanMarkdownFormatting(completion.choices[0]?.message?.content || '');
      const latencyMs = Date.now() - startTime;
      console.log('[Chat] TEST MODE: Response generated. Length:', fullAnswer.length, 'Latency:', latencyMs, 'ms');
      
      // Save to database
      try {
        await db.insert(messages).values({
          tenant_id: DEFAULT_TENANT_ID,
          development_id: DEFAULT_DEVELOPMENT_ID,
          user_id: conversationUserId || 'anonymous',
          content: message,
          user_message: message,
          ai_message: fullAnswer,
          question_topic: questionTopic,
          sender: 'conversation',
          source: 'purchaser_portal',
          token_count: completion.usage?.total_tokens || 0,
          cost_usd: '0',
          latency_ms: latencyMs,
          metadata: {
            unitUid: validatedUnitUid || null,
            userId: userId || null,
            chunksUsed: chunks?.length || 0,
            model: 'gpt-4o-mini',
            testMode: true,
          },
        });
      } catch (dbError) {
        console.error('[Chat] Failed to save message:', dbError);
      }
      
      return NextResponse.json({
        success: true,
        answer: fullAnswer,
        source: chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents',
        chunksUsed: chunks?.length || 0,
        safetyIntercept: false,
      });
    }

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      temperature: 0.3,
      max_tokens: 800,
      stream: true,
    });

    // Create a TransformStream for the response
    const encoder = new TextEncoder();
    let fullAnswer = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata as first chunk (including sources for transparency)
          // IMPORTANT: Don't show sources for high-risk topics (safety redirects don't use documents)
          // For normal queries, show the top 3 most relevant unique document sources
          const sourceDocumentsMap = new Map<string, { name: string; date: string | null; similarity: number }>();
          
          // Detect if question is about floor plans/drawings
          const isDrawingQuestion = /\b(floor\s*plan|drawing|layout|dimensions?|room\s*size|measurements?|square\s*(feet|metres?|meters?))\b/i.test(message);
          
          // Document types that should only appear for relevant questions
          const isFloorPlanDocument = (fileName: string): boolean => {
            const lowerName = fileName.toLowerCase();
            // Floor plans have patterns like: HD-RS-BD, -01-A, drawing numbers, etc.
            return /\b(hd-rs|bd\d+|-\d+-[a-z]\.pdf|floor.*plan|elevation|section.*drawing)/i.test(lowerName) ||
                   /^\d+[a-z]*-.*-\d+-[a-z]\.pdf$/i.test(fileName);
          };
          
          const isTechnicalDatasheet = (fileName: string): boolean => {
            const lowerName = fileName.toLowerCase();
            // Technical datasheets, certifications, spec sheets from manufacturers
            return /\b(sds|datasheet|data.*sheet|bba.*cert|cert\b|technical.*spec|kpro|facade|floplast|pyroplex|kilsaran|ozeo|ecowatt|ohme)\b/i.test(lowerName);
          };
          
          // Skip sources entirely for high-risk safety topics (AI gives a redirect, not document-based answer)
          if (!highRiskCheck.isHighRisk && chunks && chunks.length > 0) {
            // Only include chunks from the top sources - take unique documents from the top-scoring chunks
            for (const c of chunks) {
              const fileName = c.metadata?.file_name || c.metadata?.source || 'Document';
              
              // Filter out irrelevant document types based on question context
              if (!isDrawingQuestion && isFloorPlanDocument(fileName)) {
                continue; // Skip floor plans for non-drawing questions
              }
              if (isTechnicalDatasheet(fileName)) {
                continue; // Skip manufacturer datasheets - they're rarely what users want to see
              }
              
              // Only add if we haven't seen this document, or if this chunk has higher similarity
              if (!sourceDocumentsMap.has(fileName) || (c.similarity > sourceDocumentsMap.get(fileName)!.similarity)) {
                const uploadedAt = c.metadata?.uploaded_at || c.created_at;
                const dateStr = uploadedAt ? new Date(uploadedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) : null;
                sourceDocumentsMap.set(fileName, { name: fileName, date: dateStr, similarity: c.similarity || 0 });
              }
              // Stop after collecting 3 relevant unique sources
              if (sourceDocumentsMap.size >= 3) break;
            }
          }
          // Sort by similarity and take top 3, removing the similarity field before sending
          const sourceDocuments = Array.from(sourceDocumentsMap.values())
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3)
            .map(({ name, date }) => ({ name, date }));
          
          const metadata = {
            type: 'metadata',
            source: chunks && chunks.length > 0 ? 'semantic_search' : 'no_documents',
            chunksUsed: chunks?.length || 0,
            sources: sourceDocuments,
            drawing: drawing ? {
              fileName: drawing.fileName,
              drawingType: drawing.drawingType,
              drawingDescription: drawing.drawingDescription,
              houseTypeCode: drawing.houseTypeCode,
              previewUrl: drawing.signedUrl,
              downloadUrl: drawing.downloadUrl,
              explanation: drawingExplanation,
            } : null,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

          // Stream the AI response (clean asterisks from each chunk)
          for await (const chunk of stream) {
            const rawContent = chunk.choices[0]?.delta?.content || '';
            if (rawContent) {
              // Clean markdown formatting from streamed content
              const content = cleanMarkdownFormatting(rawContent);
              fullAnswer += content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content })}\n\n`));
            }
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          controller.close();

          // Save to database after streaming completes
          const latencyMs = Date.now() - startTime;
          console.log('[Chat] Streaming complete. Answer length:', fullAnswer.length, 'Latency:', latencyMs, 'ms');

          try {
            await db.insert(messages).values({
              tenant_id: DEFAULT_TENANT_ID,
              development_id: DEFAULT_DEVELOPMENT_ID,
              user_id: conversationUserId || 'anonymous',
              content: message,
              user_message: message,
              ai_message: fullAnswer,
              question_topic: questionTopic,
              sender: 'conversation',
              source: 'purchaser_portal',
              token_count: 0, // Not available in streaming mode
              cost_usd: '0',
              latency_ms: latencyMs,
              metadata: {
                unitUid: validatedUnitUid || null,
                userId: userId || null,
                chunksUsed: chunks?.length || 0,
                model: 'gpt-4o-mini',
                streaming: true,
              },
            });
            console.log('[Chat] Message saved to database');
          } catch (dbError) {
            console.error('[Chat] Failed to save message:', dbError);
          }
        } catch (error) {
          console.error('[Chat] Streaming error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Streaming failed' })}\n\n`));
          controller.close();
        }
      },
    });

    console.log('============================================================\n');

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[Chat] Error:', error);
    
    // Log error to database for observability
    const errorLogger = createErrorLogger('/api/chat', DEFAULT_TENANT_ID, DEFAULT_DEVELOPMENT_ID);
    const isTimeout = error instanceof Error && error.message.includes('timeout');
    const isLLM = error instanceof Error && (error.message.includes('OpenAI') || error.message.includes('rate limit'));
    
    if (isTimeout) {
      await errorLogger.timeout(error instanceof Error ? error.message : 'Chat timeout');
    } else if (isLLM) {
      await errorLogger.llm(error instanceof Error ? error.message : 'LLM error', undefined, { endpoint: '/api/chat' });
    } else {
      await errorLogger.supabase(error instanceof Error ? error.message : 'Chat failed', undefined, { endpoint: '/api/chat' });
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
