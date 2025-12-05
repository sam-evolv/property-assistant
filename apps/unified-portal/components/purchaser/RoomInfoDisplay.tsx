'use client';

import { useState, useEffect } from 'react';
import { Home, Maximize2, Loader2 } from 'lucide-react';
import { getRoomInfo, RoomInfoResult, DimensionsData, RoomDimension } from '@/lib/room-info';

interface RoomInfoDisplayProps {
  houseTypeId: string;
  isDarkMode?: boolean;
  token?: string;
  unitUid?: string;
}

export default function RoomInfoDisplay({
  houseTypeId,
  isDarkMode = false,
  token,
  unitUid,
}: RoomInfoDisplayProps) {
  const [roomInfo, setRoomInfo] = useState<RoomInfoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRoomInfo() {
      try {
        setLoading(true);
        setError(null);
        const info = await getRoomInfo(houseTypeId, { token, unitUid });
        setRoomInfo(info);
      } catch (err: any) {
        console.error('Failed to fetch room info:', err);
        setError(err.message || 'Unable to load room information');
      } finally {
        setLoading(false);
      }
    }

    if (houseTypeId) {
      fetchRoomInfo();
    }
  }, [houseTypeId, token, unitUid]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>Loading room information...</span>
      </div>
    );
  }

  if (error || !roomInfo) {
    return (
      <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-600'}`}>
        {error || 'Room information not available'}
      </div>
    );
  }

  if (roomInfo.type === 'dimensions') {
    return (
      <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow-lg'}`}>
        <div className="flex items-center gap-2 mb-4">
          <Home className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
          <h2 className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Room Measurements
          </h2>
          {roomInfo.name && (
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              ({roomInfo.name})
            </span>
          )}
        </div>
        
        <div className="grid gap-3">
          {Object.entries(roomInfo.dimensions).map(([room, vals]) => (
            <RoomDimensionRow
              key={room}
              roomName={room}
              dimension={vals}
              isDarkMode={isDarkMode}
            />
          ))}
        </div>
      </div>
    );
  }

  if (roomInfo.type === 'floorplan' && roomInfo.url) {
    return (
      <div className={`rounded-xl overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow-lg'}`}>
        <div className={`flex items-center gap-2 p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <Maximize2 className={`w-5 h-5 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} />
          <h2 className={`font-bold text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Floor Plan
          </h2>
          {roomInfo.name && (
            <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              ({roomInfo.name})
            </span>
          )}
        </div>
        <iframe
          src={roomInfo.url}
          className="w-full h-[600px]"
          title={`Floor plan for ${roomInfo.houseTypeCode}`}
        />
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
      No room measurements or floor plan available for this house type.
    </div>
  );
}

function RoomDimensionRow({
  roomName,
  dimension,
  isDarkMode,
}: {
  roomName: string;
  dimension: RoomDimension;
  isDarkMode: boolean;
}) {
  const area = dimension.area || (dimension.length * dimension.width);
  const formattedRoom = roomName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg ${isDarkMode ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
      <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        {formattedRoom}
      </span>
      <div className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
        <span className="font-mono">{dimension.length}m × {dimension.width}m</span>
        <span className={`ml-2 px-2 py-0.5 rounded ${isDarkMode ? 'bg-amber-900/40 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
          {area.toFixed(1)}m²
        </span>
      </div>
    </div>
  );
}
