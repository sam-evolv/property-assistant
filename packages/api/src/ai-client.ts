// AI Client Factory
// Unified client creation for multiple AI providers

import OpenAI from 'openai';
import { 
  MODEL_PROVIDERS, 
  getModelConfig, 
  getProviderConfig, 
  getApiKeyForModel, 
  getBaseUrlForModel 
} from './model-providers';

export interface AIClient {
  chat: {
    completions: {
      create: (params: any) => Promise<any>;
    };
  };
  embeddings?: {
    create: (params: any) => Promise<any>;
  };
  images?: {
    create: (params: any) => Promise<any>;
  };
}

export function createAIClient(modelId: string): AIClient {
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig) {
    throw new Error(`Model ${modelId} not found in configuration`);
  }

  const apiKey = getApiKeyForModel(modelId);
  if (!apiKey) {
    throw new Error(`API key not found for model ${modelId}. Please set ${getProviderConfig(modelConfig.provider)?.apiKeyEnv} environment variable`);
  }

  const baseUrl = getBaseUrlForModel(modelId);

  switch (modelConfig.provider) {
    case 'openai':
      return new OpenAI({
        apiKey,
        baseURL: baseUrl,
      }) as unknown as AIClient;

    case 'nvidia':
      // NVIDIA uses OpenAI-compatible API
      return new OpenAI({
        apiKey,
        baseURL: baseUrl || 'https://integrate.api.nvidia.com/v1',
      }) as unknown as AIClient;

    case 'anthropic':
      // Anthropic would require a different client implementation
      // For now, we'll use OpenAI compatibility mode
      return new OpenAI({
        apiKey,
        baseURL: baseUrl,
      }) as unknown as AIClient;

    default:
      throw new Error(`Unsupported provider: ${modelConfig.provider}`);
  }
}

// Helper function to get the appropriate client for a given capability
export function getClientForTask(
  capability: 'chat' | 'embedding' | 'vision' | 'reasoning',
  preferredModel?: string
): AIClient {
  const modelId = preferredModel || getDefaultModelForCapability(capability);
  return createAIClient(modelId);
}

// Get default model for a capability
export function getDefaultModelForCapability(capability: string): string {
  switch (capability) {
    case 'chat':
    case 'reasoning':
      return 'gpt-4.1-mini';
    case 'embedding':
      return 'text-embedding-3-large';
    case 'vision':
      return 'gpt-4o';
    default:
      return 'gpt-4.1-mini';
  }
}

// Cost calculation helper
export function calculateCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const modelConfig = getModelConfig(modelId);
  if (!modelConfig) return 0;

  const inputCost = (modelConfig.costPerInputToken || 0) * inputTokens;
  const outputCost = (modelConfig.costPerOutputToken || 0) * outputTokens;
  
  return inputCost + outputCost;
}

// Model availability check
export function isModelAvailable(modelId: string): boolean {
  try {
    const apiKey = getApiKeyForModel(modelId);
    return !!apiKey;
  } catch {
    return false;
  }
}

// Fallback model selection
export function getFallbackModel(
  preferredModel: string,
  capability: string
): string {
  if (isModelAvailable(preferredModel)) {
    return preferredModel;
  }

  // Fallback logic
  const availableModels = MODEL_PROVIDERS
    .flatMap(provider => provider.models)
    .filter(model => model.capabilities.includes(capability as any))
    .filter(model => isModelAvailable(model.id));

  if (availableModels.length === 0) {
    throw new Error(`No available models found for capability: ${capability}`);
  }

  // Prefer OpenAI models for stability
  const openaiModel = availableModels.find(m => m.provider === 'openai');
  if (openaiModel) {
    return openaiModel.id;
  }

  return availableModels[0].id;
}