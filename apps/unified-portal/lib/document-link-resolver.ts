import { createClient } from '@supabase/supabase-js';
import { getUnitInfo } from './unit-lookup';

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
      const docHouseType = metadata.house_type_code;
      const normalizedDocHouseType = (docHouseType || '').toLowerCase().trim();
      
      if (normalizedDocHouseType && normalizedHouseType) {
        if (normalizedDocHouseType !== normalizedHouseType) {
          continue;
        }
      }
      uniqueDocs.set(key, metadata);
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
