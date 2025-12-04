export interface APIResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface PaginatedResponse<T = any> extends APIResponse<T> {
  total?: number;
  page?: number;
  limit?: number;
}
