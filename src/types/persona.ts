import { VaultEntryType } from './vault';

export interface PersonaConfig {
  id: string;
  name: string;
  avatar: string;
  systemPrompt: string;
  behavioralRules: string[];
  allowedDataScopes: VaultEntryType[];
  description: string;
}

export type PersonaScope = 'kai' | 'nav' | 'both';
