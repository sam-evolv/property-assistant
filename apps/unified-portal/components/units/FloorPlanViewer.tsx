'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Maximize2, Loader2, ExternalLink, Home } from 'lucide-react';

interface FloorPlanViewerProps {
  signedUrl: string;
  houseTypeCode?: string;
  className?: string;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

export default function FloorPlanViewer({
  signedUrl,
  houseTypeCode,
  className = '',
  onLoad,
  onError,
}: FloorPlanViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = useCallback(() => {
    setLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    const errorMsg = 'Failed to load floor plan';
    setError(errorMsg);
    setLoading(false);
    onError?.(errorMsg);
  }, [onError]);

  return (
    <div className={`relative rounded-lg overflow-hidden shadow-md border border-gray-200 bg-white ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse z-10">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading floor plan...</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
          <div className="flex flex-col items-center gap-3 text-gray-500 p-6 text-center">
            <FileText className="w-12 h-12 text-gray-400" />
            <p className="text-sm">{error}</p>
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Open in new tab <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Maximize2 className="w-5 h-5 text-amber-600" />
          <span className="font-medium text-gray-800">Floor Plan</span>
          {houseTypeCode && (
            <span className="text-sm text-gray-500 ml-1">({houseTypeCode})</span>
          )}
        </div>
        <a
          href={signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          Open <ExternalLink className="w-4 h-4" />
        </a>
      </div>
      
      <iframe
        src={signedUrl}
        className="w-full h-[600px] md:h-[600px] h-[80vh]"
        title={`Floor plan ${houseTypeCode ? `for ${houseTypeCode}` : ''}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}

interface RoomDimension {
  length?: number;
  width?: number;
  area?: number;
}

interface DimensionsTableProps {
  dimensions: Record<string, RoomDimension>;
  houseTypeCode?: string;
  className?: string;
}

export function DimensionsTable({
  dimensions,
  houseTypeCode,
  className = '',
}: DimensionsTableProps) {
  const formatRoomName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const roomEntries = Object.entries(dimensions).filter(
    ([_, dim]) => dim.area || (dim.length && dim.width)
  );

  if (roomEntries.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-lg overflow-hidden shadow-md border border-gray-200 bg-white ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Home className="w-5 h-5 text-amber-600" />
        <span className="font-medium text-gray-800">Room Dimensions</span>
        {houseTypeCode && (
          <span className="text-sm text-gray-500 ml-1">({houseTypeCode})</span>
        )}
      </div>
      
      <div className="divide-y divide-gray-100">
        {roomEntries.map(([roomKey, dim]) => {
          const area = dim.area || (dim.length && dim.width ? dim.length * dim.width : null);
          
          return (
            <div
              key={roomKey}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="font-medium text-gray-800">
                {formatRoomName(roomKey)}
              </span>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {dim.length && dim.width && (
                  <span className="font-mono">
                    {dim.length.toFixed(1)}m x {dim.width.toFixed(1)}m
                  </span>
                )}
                {area && (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                    {area.toFixed(1)} m²
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface FloorPlanWithDimensionsProps {
  unitId: string;
  token?: string;
  unitUid?: string;
  className?: string;
}

export function FloorPlanWithDimensions({
  unitId,
  token,
  unitUid,
  className = '',
}: FloorPlanWithDimensionsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<Record<string, RoomDimension> | null>(null);
  const [floorplanUrl, setFloorplanUrl] = useState<string | null>(null);
  const [houseTypeCode, setHouseTypeCode] = useState<string | null>(null);
  const [showFloorplan, setShowFloorplan] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (token) params.set('token', token);
        if (unitUid) params.set('unitUid', unitUid);
        
        const queryString = params.toString();
        const url = `/api/floorplans/${unitId}${queryString ? `?${queryString}` : ''}`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
          if (res.status === 401) {
            throw new Error('Authentication required');
          }
          if (res.status === 403) {
            throw new Error('Not authorized to view this floor plan');
          }
          throw new Error('Failed to load floor plan data');
        }
        
        const data = await res.json();
        
        setDimensions(data.dimensions);
        setFloorplanUrl(data.floorplanUrl);
        setHouseTypeCode(data.houseTypeCode);
        
        if (!data.dimensions || Object.keys(data.dimensions).length === 0) {
          setShowFloorplan(true);
        }
      } catch (err: any) {
        console.error('Failed to fetch floor plan data:', err);
        setError(err.message || 'Failed to load floor plan');
      } finally {
        setLoading(false);
      }
    }

    if (unitId) {
      fetchData();
    }
  }, [unitId, token, unitUid]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-50 rounded-lg ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
        <span className="text-gray-600">Loading floor plan...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 text-red-600 rounded-lg ${className}`}>
        {error}
      </div>
    );
  }

  const hasDimensions = dimensions && Object.keys(dimensions).length > 0;

  return (
    <div className={`space-y-4 ${className}`}>
      {hasDimensions && (
        <>
          <DimensionsTable
            dimensions={dimensions}
            houseTypeCode={houseTypeCode || undefined}
          />
          
          {floorplanUrl && !showFloorplan && (
            <button
              onClick={() => setShowFloorplan(true)}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              View Floor Plan PDF
            </button>
          )}
        </>
      )}
      
      {(showFloorplan || !hasDimensions) && floorplanUrl && (
        <FloorPlanViewer
          signedUrl={floorplanUrl}
          houseTypeCode={houseTypeCode || undefined}
        />
      )}
      
      {!hasDimensions && !floorplanUrl && (
        <div className="p-6 bg-gray-50 rounded-lg text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>No floor plan or dimensions available for this unit.</p>
        </div>
      )}
    </div>
  );
}
