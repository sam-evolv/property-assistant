export interface RoomDimension {
  length: number;
  width: number;
  area?: number;
}

export interface DimensionsData {
  [roomName: string]: RoomDimension;
}

export interface RoomInfoDimensions {
  type: 'dimensions';
  dimensions: DimensionsData;
  houseTypeCode: string;
  name: string | null;
}

export interface RoomInfoFloorplan {
  type: 'floorplan';
  url: string | null;
  houseTypeCode: string;
  name: string | null;
}

export type RoomInfoResult = RoomInfoDimensions | RoomInfoFloorplan;

export interface RoomInfoOptions {
  token?: string;
  unitUid?: string;
}

export async function getRoomInfo(
  houseTypeId: string,
  options?: RoomInfoOptions
): Promise<RoomInfoResult> {
  const params = new URLSearchParams();
  
  if (options?.token) {
    params.set('token', options.token);
  }
  if (options?.unitUid) {
    params.set('unitUid', options.unitUid);
  }
  
  const queryString = params.toString();
  const url = `/api/floorplan/${houseTypeId}${queryString ? `?${queryString}` : ''}`;
  
  const res = await fetch(url);
  
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Authentication required');
    }
    if (res.status === 403) {
      throw new Error('Not authorized to view this house type');
    }
    throw new Error('Failed to fetch room info');
  }
  
  const data = await res.json();

  if (data.dimensions && Object.keys(data.dimensions).length > 0) {
    return {
      type: 'dimensions',
      dimensions: data.dimensions as DimensionsData,
      houseTypeCode: data.houseTypeCode,
      name: data.name,
    };
  }

  return {
    type: 'floorplan',
    url: data.floorplanUrl,
    houseTypeCode: data.houseTypeCode,
    name: data.name,
  };
}

export function formatRoomDimension(roomName: string, dimension: RoomDimension): string {
  const area = dimension.area || (dimension.length * dimension.width);
  return `${roomName}: ${dimension.length}m × ${dimension.width}m (${area.toFixed(1)}m²)`;
}
