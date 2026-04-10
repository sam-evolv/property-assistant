// Model Provider Configuration
// Centralized configuration for all AI model providers

export interface ModelProvider {
  id: string;
  name: string;
  apiKeyEnv: string;
  baseUrl?: string;
  models: ModelConfig[];
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  contextWindow?: number;
  maxTokens?: number;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export type ModelCapability = 'chat' | 'embedding' | 'vision' | 'reasoning' | 'summarization';

// OpenAI Configuration
export const OPENAI_PROVIDER: ModelProvider = {
  id: 'openai',
  name: 'OpenAI',
  apiKeyEnv: 'OPENAI_API_KEY',
  models: [
    {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
      provider: 'openai',
      capabilities: ['chat', 'reasoning', 'summarization'],
      contextWindow: 128000,
      maxTokens: 4096,
      costPerInputToken: 0.00000015,
      costPerOutputToken: 0.0000006
    },
    {
      id: 'text-embedding-3-large',
      name: 'Text Embedding 3 Large',
      provider: 'openai',
      capabilities: ['embedding'],
      contextWindow: 8192,
      maxTokens: 8192
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4 Omni',
      provider: 'openai',
      capabilities: ['chat', 'vision', 'reasoning', 'summarization'],
      contextWindow: 128000,
      maxTokens: 4096
    }
  ]
};

// NVIDIA Configuration
export const NVIDIA_PROVIDER: ModelProvider = {
  id: 'nvidia',
  name: 'NVIDIA',
  apiKeyEnv: 'NVIDIA_API_KEY',
  baseUrl: 'https://integrate.api.nvidia.com/v1',
  models: [
    {
      id: 'nvidia/flash',
      name: 'NVIDIA Flash',
      provider: 'nvidia',
      capabilities: ['chat', 'reasoning', 'summarization'],
      contextWindow: 131072,
      maxTokens: 4096,
      costPerInputToken: 0.0000001,
      costPerOutputToken: 0.0000004
    }
  ]
};

// Anthropic Configuration
export const ANTHROPIC_PROVIDER: ModelProvider = {
  id: 'anthropic',
  name: 'Anthropic',
  apiKeyEnv: 'ANTHROPIC_API_KEY',
  models: [
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      provider: 'anthropic',
      capabilities: ['chat', 'reasoning', 'summarization'],
      contextWindow: 200000,
      maxTokens: 4096
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      capabilities: ['chat', 'reasoning', 'summarization'],
      contextWindow: 200000,
      maxTokens: 4096
    }
  ]
};

// Default model configurations
export const DEFAULT_CHAT_MODEL = 'gpt-4.1-mini';
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large';

// Model registry
export const MODEL_PROVIDERS: ModelProvider[] = [
  OPENAI_PROVIDER,
  NVIDIA_PROVIDER,
  ANTHROPIC_PROVIDER
];

// Helper functions
export function getModelConfig(modelId: string): ModelConfig | undefined {
  for (const provider of MODEL_PROVIDERS) {
    const model = provider.models.find(m => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

export function getProviderConfig(providerId: string): ModelProvider | undefined {
  return MODEL_PROVIDERS.find(p => p.id === providerId);
}

export function getProviderForModel(modelId: string): ModelProvider | undefined {
  for (const provider of MODEL_PROVIDERS) {
    if (provider.models.some(m => m.id === modelId)) {
      return provider;
    }
  }
  return undefined;
}

export function getApiKeyForModel(modelId: string): string | undefined {
  const provider = getProviderForModel(modelId);
  if (!provider) return undefined;
  
  return process.env[provider.apiKeyEnv];
}

export function getBaseUrlForModel(modelId: string): string | undefined {
  const provider = getProviderForModel(modelId);
  return provider?.baseUrl;
}

// Model selection helper
export function getBestModelForTask(
  capability: ModelCapability,
  budget?: number,
  contextSize?: number
): ModelConfig | undefined {
  const availableModels = MODEL_PROVIDERS
    .flatMap(provider => provider.models)
    .filter(model => model.capabilities.includes(capability))
    .filter(model => !contextSize || (model.contextWindow && model.contextWindow >= contextSize));

  if (availableModels.length === 0) return undefined;

  // Sort by cost efficiency (if budget is provided) or by capability
  return availableModels.sort((a, b) => {
    if (budget && a.costPerInputToken && b.costPerInputToken) {
      return a.costPerInputToken - b.costPerInputToken;
    }
    // Default: prefer OpenAI models for stability
    return a.provider === 'openai' ? -1 : b.provider === 'openai' ? 1 : 0;
  })[0];
}