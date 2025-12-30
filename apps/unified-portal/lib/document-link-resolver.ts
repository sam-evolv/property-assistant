import { createClient } from '@supabase/supabase-js';
import { getUnitInfo } from './unit-lookup';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function extractHouseTypeFromFilename(filename: string): string | null {
  const patterns = [
    /House-Type-([A-Z]{1,3}\d{1,2})/i,
    /Type-([A-Z]{1,3}\d{1,2})/i,
    /[-_]([A-Z]{1,3}\d{1,2})[-_]/i,
    /^([A-Z]{1,3}\d{1,2})[-_]/i,
  ];
  
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  
  return null;
}

function getMetadataHouseTypeCode(metadata: any): string | null {
  const drawingClassification = metadata?.drawing_classification || {};
  const fileName = metadata?.file_name || metadata?.source || '';
  
  return metadata?.house_type_code || 
         drawingClassification?.houseTypeCode || 
         extractHouseTypeFromFilename(fileName);
}

export interface ResolvedDocument {
  id: string;
  fileName: string;
  title: string;
  fileUrl: string;
  signedUrl: string;
  downloadUrl: string;
  discipline: string;
  houseTypeCode: string | null;
}

export interface DocumentLinkResult {
  found: boolean;
  document: ResolvedDocument | null;
  explanation: string;
}

export function detectDocumentLinkRequest(message: string): { isLinkRequest: boolean; documentHint: string | null } {
  const messageLower = message.toLowerCase();
  
  const linkPatterns = [
    /\b(download|link|view|preview|get|show|give|send)\s*(me\s*)?(a\s*)?(the\s*)?(download\s*)?(link|url|pdf|document|file|copy)\b/i,
    /\bcan\s+(i|you)\s+(get|have|download|view|see|access)\s+(the\s*)?(it|this|that|them)\b/i,
    /\b(where|how)\s+(can\s+i|do\s+i|to)\s+(find|get|download|access|view)\s+(it|them|the)\b/i,
    /\bgive\s+me\s+(a\s+)?(link|copy|download)\b/i,
    /\bsend\s+(me\s+)?(the|a)\s+(document|pdf|file|drawing)\b/i,
    /\bdownload\s+(link|it|the|that)\b/i,
  ];
  
  const isLinkRequest = linkPatterns.some(pattern => pattern.test(message));
  
  if (!isLinkRequest) {
    return { isLinkRequest: false, documentHint: null };
  }
  
  let documentHint: string | null = null;
  
  const documentTypes = [
    { keywords: ['elevation', 'elevations'], hint: 'elevation' },
    { keywords: ['floor plan', 'floorplan', 'floor plans'], hint: 'floor_plan' },
    { keywords: ['room size', 'room sizes', 'dimensions'], hint: 'room_sizes' },
    { keywords: ['site plan', 'site layout'], hint: 'site_plan' },
    { keywords: ['section', 'cross section'], hint: 'section' },
    { keywords: ['warranty', 'guarantee'], hint: 'warranty' },
    { keywords: ['fire', 'fire safety', 'smoke alarm'], hint: 'fire' },
    { keywords: ['parking', 'car park'], hint: 'parking' },
    { keywords: ['handover', 'completion'], hint: 'handover' },
    { keywords: ['manual', 'homeowner manual', 'home manual'], hint: 'manual' },
    { keywords: ['specification', 'spec', 'specs'], hint: 'specification' },
    { keywords: ['certificate', 'cert'], hint: 'certificate' },
    { keywords: ['drawing', 'drawings'], hint: 'drawing' },
    { keywords: ['snag', 'defect'], hint: 'snag' },
  ];
  
  for (const docType of documentTypes) {
    for (const keyword of docType.keywords) {
      if (messageLower.includes(keyword)) {
        documentHint = docType.hint;
        break;
      }
    }
    if (documentHint) break;
  }
  
  return { isLinkRequest, documentHint };
}

export async function findDocumentForLink(
  unitUid: string,
  documentHint: string | null,
  conversationContext?: string,
  verifiedProjectId?: string,
  verifiedHouseTypeCode?: string
): Promise<DocumentLinkResult> {
  console.log('[DocumentLinkResolver] Finding document for:', { unitUid, documentHint, verifiedProjectId });
  
  const supabase = getSupabaseClient();
  
  let projectId = verifiedProjectId;
  let houseTypeCode = verifiedHouseTypeCode;
  
  if (!projectId) {
    const unitInfo = await getUnitInfo(unitUid);
    if (!unitInfo) {
      console.log('[DocumentLinkResolver] Could not get unit info');
      return {
        found: false,
        document: null,
        explanation: 'Unable to find your unit information.',
      };
    }
    projectId = unitInfo.development_id || undefined;
    houseTypeCode = houseTypeCode || unitInfo.house_type_code || undefined;
  }
  
  if (!projectId) {
    console.log('[DocumentLinkResolver] No project ID for unit');
    return {
      found: false,
      document: null,
      explanation: 'Unable to determine your development.',
    };
  }
  
  console.log('[DocumentLinkResolver] Looking in project:', projectId, 'houseType:', houseTypeCode);
  
  const normalizedHouseType = (houseTypeCode || '').toLowerCase().trim();
  
  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', projectId);
  
  if (error || !sections || sections.length === 0) {
    console.log('[DocumentLinkResolver] No documents found or error:', error?.message);
    return {
      found: false,
      document: null,
      explanation: 'No documents are currently available for your development.',
    };
  }
  
  console.log('[DocumentLinkResolver] Total sections fetched:', sections.length);
  
  const uniqueDocs = new Map<string, any>();
  for (const section of sections) {
    const metadata = section.metadata as any;
    if (!metadata?.file_url) continue;
    
    const key = metadata.file_name || metadata.file_url;
    if (!uniqueDocs.has(key)) {
      const docHouseType = getMetadataHouseTypeCode(metadata);
      const normalizedDocHouseType = (docHouseType || '').toLowerCase().trim();
      
      if (normalizedDocHouseType && normalizedHouseType) {
        if (normalizedDocHouseType !== normalizedHouseType) {
          continue;
        }
      }
      uniqueDocs.set(key, { ...metadata, house_type_code: docHouseType });
    }
  }
  
  const documents = Array.from(uniqueDocs.values());
  console.log('[DocumentLinkResolver] Unique documents found:', documents.length);
  
  if (documents.length === 0) {
    return {
      found: false,
      document: null,
      explanation: 'No documents match your house type.',
    };
  }
  
  let matchedDoc: any = null;
  const searchText = `${documentHint || ''} ${conversationContext || ''}`.toLowerCase();
  
  const searchPatterns: { 
    searchTerms: string[]; 
    docTerms: string[]; 
    excludeTerms?: string[];
    priority: number;
  }[] = [
    { 
      searchTerms: ['elevation'], 
      docTerms: ['elevation', 'elevations', '-elev-', '-elev.'],
      excludeTerms: ['furnishing', 'layout', 'floor plan', 'room size'],
      priority: 1 
    },
    { 
      searchTerms: ['floor plan', 'floor_plan', 'floorplan', 'layout'], 
      docTerms: ['floor plan', 'floor_plan', 'floorplan', 'layout', 'ground floor', 'first floor'],
      excludeTerms: ['elevation'],
      priority: 1 
    },
    { 
      searchTerms: ['room size', 'room_sizes', 'dimensions'], 
      docTerms: ['room size', 'room_sizes', 'dimensions'],
      priority: 1 
    },
    { 
      searchTerms: ['site plan', 'site_plan'], 
      docTerms: ['site plan', 'site_plan', 'site layout'],
      priority: 1 
    },
    { 
      searchTerms: ['section', 'cross section'], 
      docTerms: ['section', 'cross section', '-sec-'],
      excludeTerms: ['elevation', 'floor', 'layout'],
      priority: 2 
    },
    { searchTerms: ['warranty', 'guarantee'], docTerms: ['warranty', 'guarantee'], priority: 2 },
    { searchTerms: ['fire', 'smoke'], docTerms: ['fire', 'smoke'], priority: 2 },
    { searchTerms: ['manual', 'homeowner'], docTerms: ['manual', 'homeowner'], priority: 3 },
    { searchTerms: ['handover'], docTerms: ['handover'], priority: 3 },
    { searchTerms: ['parking', 'car'], docTerms: ['parking', 'car'], priority: 3 },
    { searchTerms: ['spec', 'specification'], docTerms: ['spec', 'specification'], priority: 3 },
    { searchTerms: ['cert', 'certificate'], docTerms: ['cert', 'certificate'], priority: 3 },
  ];
  
  for (const pattern of searchPatterns) {
    if (!pattern.searchTerms.some(kw => searchText.includes(kw))) continue;
    
    for (const doc of documents) {
      const docText = `${doc.file_name || ''} ${doc.title || ''} ${doc.discipline || ''} ${doc.drawing_type || ''}`.toLowerCase();
      
      if (pattern.excludeTerms?.some(exc => docText.includes(exc))) {
        continue;
      }
      
      if (pattern.docTerms.some(kw => docText.includes(kw))) {
        matchedDoc = doc;
        console.log('[DocumentLinkResolver] Matched by pattern:', pattern.searchTerms[0], 'Doc:', doc.file_name);
        break;
      }
    }
    if (matchedDoc) break;
  }
  
  if (!matchedDoc && documentHint) {
    const hintLower = documentHint.toLowerCase().replace('_', ' ');
    for (const doc of documents) {
      const docText = `${doc.file_name || ''} ${doc.title || ''} ${doc.discipline || ''} ${doc.drawing_type || ''}`.toLowerCase();
      if (docText.includes(hintLower)) {
        matchedDoc = doc;
        console.log('[DocumentLinkResolver] Matched by hint:', documentHint, 'Doc:', doc.file_name);
        break;
      }
    }
  }
  
  if (!matchedDoc) {
    console.log('[DocumentLinkResolver] No match found for:', documentHint);
    console.log('[DocumentLinkResolver] Available docs with types:', documents.map(d => `${d.file_name} (type: ${d.drawing_type || 'none'})`).join(', '));
    return {
      found: false,
      document: null,
      explanation: `I couldn't find the specific document you're looking for. Please check the Documents tab for all available documents.`,
    };
  }
  
  const fileUrl = matchedDoc.file_url || '';
  let signedUrl = fileUrl;
  let downloadUrl = fileUrl;
  
  if (fileUrl.includes('development_docs')) {
    try {
      const storagePath = fileUrl.split('/development_docs/').pop() || '';
      if (storagePath) {
        const { data: signedData } = await supabase.storage
          .from('development_docs')
          .createSignedUrl(storagePath, 3600);
        
        if (signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        }
        
        const { data: downloadData } = await supabase.storage
          .from('development_docs')
          .createSignedUrl(storagePath, 3600, { download: true });
        
        if (downloadData?.signedUrl) {
          downloadUrl = downloadData.signedUrl;
        }
      }
    } catch (urlError) {
      console.error('[DocumentLinkResolver] Error creating signed URL:', urlError);
    }
  }
  
  const docType = matchedDoc.drawing_type || matchedDoc.discipline || 'document';
  const docTitle = matchedDoc.title || matchedDoc.file_name || 'Document';
  
  console.log('[DocumentLinkResolver] Found document:', docTitle, 'Type:', docType);
  
  return {
    found: true,
    document: {
      id: matchedDoc.file_name,
      fileName: matchedDoc.file_name,
      title: docTitle,
      fileUrl: fileUrl,
      signedUrl: signedUrl,
      downloadUrl: downloadUrl,
      discipline: matchedDoc.discipline || 'general',
      houseTypeCode: matchedDoc.house_type_code || null,
    },
    explanation: `Here's the ${docType.replace('_', ' ')} document for your home.`,
  };
}

export interface FloorPlanAttachment {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  signedUrl: string;
  downloadUrl: string;
  discipline: string;
  docType: string;
  houseTypeCode: string | null;
}

export interface FloorPlanFallbackResult {
  found: boolean;
  attachments: FloorPlanAttachment[];
  explanation: string;
}

export async function findFloorPlanDocuments(
  unitUid: string,
  verifiedProjectId?: string,
  verifiedHouseTypeCode?: string
): Promise<FloorPlanFallbackResult> {
  console.log('[FloorPlanFallback] Finding floor plans for:', { unitUid, verifiedProjectId, verifiedHouseTypeCode });
  
  const supabase = getSupabaseClient();
  
  let projectId = verifiedProjectId;
  let houseTypeCode = verifiedHouseTypeCode;
  
  if (!projectId) {
    const unitInfo = await getUnitInfo(unitUid);
    if (!unitInfo) {
      console.log('[FloorPlanFallback] Could not get unit info');
      return {
        found: false,
        attachments: [],
        explanation: 'Unable to find your unit information.',
      };
    }
    projectId = unitInfo.development_id || undefined;
    houseTypeCode = houseTypeCode || unitInfo.house_type_code || undefined;
  }
  
  if (!projectId) {
    return {
      found: false,
      attachments: [],
      explanation: 'Unable to determine your development.',
    };
  }
  
  const normalizedHouseType = (houseTypeCode || '').toLowerCase().trim();
  console.log('[FloorPlanFallback] Project:', projectId, 'HouseType:', normalizedHouseType);
  
  // SECURITY: Require house type to prevent cross-unit document disclosure
  if (!normalizedHouseType) {
    console.log('[FloorPlanFallback] No house type - cannot safely filter floor plans');
    return {
      found: false,
      attachments: [],
      explanation: 'Unable to determine your house type for floor plans.',
    };
  }
  
  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', projectId);
  
  if (error || !sections || sections.length === 0) {
    console.log('[FloorPlanFallback] No documents found:', error?.message);
    return {
      found: false,
      attachments: [],
      explanation: 'No documents available for your development.',
    };
  }
  
  // Categorize documents by priority: unit-specific > house-type-specific
  const unitSpecificDocs = new Map<string, any>();
  const houseTypeSpecificDocs = new Map<string, any>();
  
  for (const section of sections) {
    const metadata = section.metadata as any;
    if (!metadata?.file_url) continue;
    
    const key = metadata.file_name || metadata.file_url;
    
    const docHouseType = getMetadataHouseTypeCode(metadata);
    const normalizedDocHouseType = (docHouseType || '').toLowerCase().trim();
    const docUnitId = metadata.unit_id || metadata.unit_uid;
    const docType = (metadata.doc_type || '').toLowerCase();
    const discipline = (metadata.discipline || '').toLowerCase();
    const drawingType = (metadata.drawing_type || '').toLowerCase();
    const tags = (metadata.tags || []).map((t: string) => t.toLowerCase());
    const fileName = (metadata.file_name || '').toLowerCase();
    
    // SECURITY: Skip documents for other house types
    if (normalizedDocHouseType && normalizedDocHouseType !== normalizedHouseType) {
      continue;
    }
    
    // Priority 1: Metadata-based floor plan detection (preferred)
    const isFloorPlanByMetadata = 
      docType === 'floorplan' || 
      docType === 'floor_plan' ||
      drawingType === 'floor_plan' ||
      drawingType === 'room_sizes' ||
      tags.includes('floorplan') ||
      tags.includes('floor_plan') ||
      tags.includes('floor plan');
    
    // Priority 2: Discipline-based (architectural drawings)
    const isArchitecturalDrawing = discipline === 'architectural' || discipline === 'floorplan';
    
    // Exclude elevations, sections, foundations (not room dimensions)
    const isExcludedType = 
      /elevation/i.test(fileName) ||
      /section/i.test(fileName) ||
      /foundation/i.test(fileName) ||
      drawingType === 'elevation' ||
      drawingType === 'section';
    
    // Priority 3: Filename-based detection (fallback) - only for floor plan patterns, NOT elevations/sections
    // Patterns handle both spaces and hyphens in filenames
    const FLOOR_PLAN_ONLY_PATTERNS = [
      /ground[-\s]*(and[-\s]*first)?[-\s]*floor/i,  // Ground Floor, Ground-Floor, Ground and First Floor
      /first[-\s]*(and[-\s]*second)?[-\s]*floor/i,  // First Floor, First and Second Floor
      /floor[-\s]*plan/i,
      /layout/i,
      /ga[-\s]*plan/i,
      /g\/f[-\s]*plan/i,
    ];
    const isFloorPlanByFilename = FLOOR_PLAN_ONLY_PATTERNS.some(p => p.test(fileName));
    
    // Also match architectural discipline with house-type match for floor plans
    const isArchitecturalFloorPlan = isArchitecturalDrawing && 
      (normalizedDocHouseType === normalizedHouseType) &&
      !isExcludedType;
    
    // Must match at least one floor plan indicator and not be excluded
    if (!isFloorPlanByMetadata && !isFloorPlanByFilename && !isArchitecturalFloorPlan) {
      continue;
    }
    if (isExcludedType && !isFloorPlanByMetadata) {
      continue;
    }
    
    const docEntry = {
      ...metadata,
      house_type_code: docHouseType,
      isUnitSpecific: !!docUnitId && docUnitId === unitUid,
      isHouseTypeMatch: normalizedDocHouseType === normalizedHouseType,
    };
    
    // Categorize by priority
    if (docUnitId && docUnitId === unitUid) {
      if (!unitSpecificDocs.has(key)) {
        unitSpecificDocs.set(key, docEntry);
      }
    } else if (normalizedDocHouseType === normalizedHouseType) {
      if (!houseTypeSpecificDocs.has(key)) {
        houseTypeSpecificDocs.set(key, docEntry);
      }
    }
    // Note: We do NOT include scheme-wide docs without house_type_code 
    // to prevent cross-unit document disclosure
  }
  
  // Priority: unit-specific first, then house-type-specific
  let selectedDocs: Map<string, any>;
  if (unitSpecificDocs.size > 0) {
    selectedDocs = unitSpecificDocs;
    console.log('[FloorPlanFallback] Using', unitSpecificDocs.size, 'unit-specific floor plans');
  } else if (houseTypeSpecificDocs.size > 0) {
    selectedDocs = houseTypeSpecificDocs;
    console.log('[FloorPlanFallback] Using', houseTypeSpecificDocs.size, 'house-type-specific floor plans');
  } else {
    console.log('[FloorPlanFallback] No floor plans found for house type:', normalizedHouseType);
    return {
      found: false,
      attachments: [],
      explanation: 'No floor plan documents found for your home.',
    };
  }
  
  console.log('[FloorPlanFallback] Found', selectedDocs.size, 'floor plan documents');
  
  const attachments: FloorPlanAttachment[] = [];
  
  for (const [key, doc] of Array.from(selectedDocs.entries())) {
    const fileUrl = doc.file_url || '';
    let signedUrl = fileUrl;
    let downloadUrl = fileUrl;
    
    if (fileUrl.includes('development_docs')) {
      try {
        const storagePath = fileUrl.split('/development_docs/').pop() || '';
        if (storagePath) {
          const { data: signedData } = await supabase.storage
            .from('development_docs')
            .createSignedUrl(storagePath, 3600);
          
          if (signedData?.signedUrl) {
            signedUrl = signedData.signedUrl;
          }
          
          const { data: downloadData } = await supabase.storage
            .from('development_docs')
            .createSignedUrl(storagePath, 3600, { download: true });
          
          if (downloadData?.signedUrl) {
            downloadUrl = downloadData.signedUrl;
          }
        }
      } catch (urlError) {
        console.error('[FloorPlanFallback] Error creating signed URL:', urlError);
      }
    }
    
    attachments.push({
      id: doc.file_name || key,
      title: doc.title || doc.file_name || 'Floor Plan',
      fileName: doc.file_name || key,
      fileUrl,
      signedUrl,
      downloadUrl,
      discipline: doc.discipline || 'architectural',
      docType: doc.drawing_type || 'floor_plan',
      houseTypeCode: doc.house_type_code || null,
    });
  }
  
  attachments.sort((a, b) => {
    if (a.houseTypeCode && !b.houseTypeCode) return -1;
    if (!a.houseTypeCode && b.houseTypeCode) return 1;
    return 0;
  });
  
  const explanation = attachments.length === 1
    ? "I can't provide exact room dimensions, but here's your floor plan where you can find the measurements:"
    : "I can't provide exact room dimensions, but here are your floor plans where you can find the measurements:";
  
  return {
    found: true,
    attachments: attachments.slice(0, 5),
    explanation,
  };
}
