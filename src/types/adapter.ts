import { VaultEntryType } from './vault';

export interface AdapterConfig {
  id: string;
  name: string;
  enabled: boolean;
  credentials?: Record<string, string>;
}

export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface DataAdapter {
  readonly id: string;
  readonly name: string;
  initialize(config: AdapterConfig): Promise<void>;
  authenticate(): Promise<AdapterResult<void>>;
  fetchData<T>(query: DataQuery): Promise<AdapterResult<T[]>>;
  transformData<TInput, TOutput>(raw: TInput): AdapterResult<TOutput>;
  healthCheck(): Promise<AdapterResult<{ status: 'ok' | 'degraded' | 'down' }>>;
}

export interface DataQuery {
  entityType: VaultEntryType;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}
