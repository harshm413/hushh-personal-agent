import { DataAdapter, AdapterConfig } from './interface';

class AdapterRegistry {
  private adapters: Map<string, DataAdapter> = new Map();

  register(adapter: DataAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): DataAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): DataAdapter[] {
    return Array.from(this.adapters.values());
  }

  async initializeAll(configs: AdapterConfig[]): Promise<void> {
    for (const config of configs) {
      const adapter = this.adapters.get(config.id);
      if (adapter && config.enabled) await adapter.initialize(config);
    }
  }
}

export const adapterRegistry = new AdapterRegistry();
