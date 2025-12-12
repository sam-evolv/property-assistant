import { createClient } from '@supabase/supabase-js';
import { DrawingType, getDrawingTypeForQuestion } from './drawing-classifier';
import { getHouseTypeForUnit } from './unit-lookup';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROJECT_ID = '57dc3919-2725-4575-8046-9179075ac88e';

export interface ResolvedDrawing {
  id: string;
  fileName: string;
  fileUrl: string;
  signedUrl: string;
  downloadUrl: string;
  drawingType: DrawingType;
  drawingDescription: string;
  houseTypeCode: string;
}

export interface DrawingResolverResult {
  found: boolean;
  drawing: ResolvedDrawing | null;
  explanation: string;
}

export async function getUnitHouseType(unitId: string): Promise<string | null> {
  return getHouseTypeForUnit(unitId);
}

export async function findDrawingForQuestion(
  unitUid: string,
  questionTopic: string
): Promise<DrawingResolverResult> {
  console.log('[DrawingResolver] Finding drawing for:', { unitUid, questionTopic });
  
  const drawingTypes = getDrawingTypeForQuestion(questionTopic);
  
  if (drawingTypes.length === 0) {
    return {
      found: false,
      drawing: null,
      explanation: '',
    };
  }
  
  const houseTypeCode = await getUnitHouseType(unitUid);
  
  if (!houseTypeCode) {
    console.log('[DrawingResolver] No house type found for unit:', unitUid);
    return {
      found: false,
      drawing: null,
      explanation: 'Unable to determine your house type.',
    };
  }
  
  console.log('[DrawingResolver] House type:', houseTypeCode, 'Looking for:', drawingTypes);
  
  const { data: sections, error } = await supabase
    .from('document_sections')
    .select('id, metadata')
    .eq('project_id', PROJECT_ID)
    .filter('metadata->>house_type_code', 'eq', houseTypeCode)
    .limit(50);
  
  if (error) {
    console.error('[DrawingResolver] Supabase query error:', error);
    return {
      found: false,
      drawing: null,
      explanation: 'Error searching for drawings.',
    };
  }
  
  if (!sections || sections.length === 0) {
    console.log('[DrawingResolver] No drawings found for house type:', houseTypeCode);
    return {
      found: false,
      drawing: null,
      explanation: `No drawings available for your house type (${houseTypeCode}).`,
    };
  }
  
  const uniqueDrawings = new Map<string, any>();
  for (const section of sections) {
    const metadata = section.metadata as any;
    const key = metadata.file_name;
    if (key && !uniqueDrawings.has(key)) {
      uniqueDrawings.set(key, metadata);
    }
  }
  
  let matchedDrawing: any = null;
  const drawingsList = Array.from(uniqueDrawings.values());
  
  for (const drawingType of drawingTypes) {
    for (const metadata of drawingsList) {
      if (metadata.drawing_type === drawingType) {
        matchedDrawing = metadata;
        break;
      }
    }
    if (matchedDrawing) break;
  }
  
  if (!matchedDrawing && drawingsList.length > 0) {
    matchedDrawing = drawingsList[0];
  }
  
  if (!matchedDrawing) {
    return {
      found: false,
      drawing: null,
      explanation: `No suitable drawings found for house type ${houseTypeCode}.`,
    };
  }
  
  const fileUrl = matchedDrawing.file_url || '';
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
      console.error('[DrawingResolver] Error creating signed URL:', urlError);
    }
  }
  
  const drawingType = matchedDrawing.drawing_type || 'floor_plan';
  const explanation = generateDrawingExplanation(drawingType, houseTypeCode, questionTopic);
  
  console.log('[DrawingResolver] Found drawing:', matchedDrawing.file_name);
  
  return {
    found: true,
    drawing: {
      id: matchedDrawing.file_name,
      fileName: matchedDrawing.file_name,
      fileUrl: fileUrl,
      signedUrl: signedUrl,
      downloadUrl: downloadUrl,
      drawingType: drawingType,
      drawingDescription: matchedDrawing.drawing_description || '',
      houseTypeCode: houseTypeCode,
    },
    explanation: explanation,
  };
}

function generateDrawingExplanation(
  drawingType: DrawingType,
  houseTypeCode: string,
  questionTopic: string
): string {
  const explanations: Record<DrawingType, string> = {
    room_sizes: `I've found the Room Sizes drawing for your house type (${houseTypeCode}). This document shows the dimensions and floor areas for each room, which should help answer your question.`,
    floor_plan: `I've attached the Floor Plan for your house type (${houseTypeCode}). This shows the layout of rooms and can help you understand the space and dimensions.`,
    elevation: `Here are the Elevation drawings for your house type (${houseTypeCode}). These show the external appearance of your home from different angles.`,
    site_plan: `I've found the Site Plan for your development. This shows how your property sits within the overall scheme.`,
    section: `Here's a Section drawing for your house type (${houseTypeCode}). This shows a cross-section view of the building construction.`,
    detail: `I've found a Construction Detail drawing for your house type (${houseTypeCode}).`,
    other: `I've found a relevant drawing for your house type (${houseTypeCode}).`,
  };
  
  return explanations[drawingType] || explanations.other;
}
