# NVIDIA Flash Integration Guide

This document describes how to configure and use NVIDIA Flash models in your OpenHouse AI application.

## Prerequisites

1. **NVIDIA API Account**: Sign up at [https://build.nvidia.com/](https://build.nvidia.com/)
2. **API Key**: Generate an API key from your NVIDIA developer dashboard

## Configuration

### Environment Variables

Add the following to your `.env.production` file:

```bash
# NVIDIA Configuration
NVIDIA_API_KEY=nvapi-your-actual-api-key-here
```

### Model Configuration

The NVIDIA Flash model is configured in `packages/api/src/model-providers.ts`:

```typescript
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
```

## Usage

### Automatic Fallback System

The system includes an automatic fallback mechanism:

1. **Primary Model**: NVIDIA Flash (`nvidia/flash`)
2. **Fallback Model**: GPT-4.1 Mini (`gpt-4.1-mini`)

If NVIDIA Flash is unavailable (missing API key, rate limits, etc.), the system automatically falls back to OpenAI.

### Manual Model Selection

You can manually specify models in your code:

```typescript
import { createAIClient } from './ai-client';

// Use NVIDIA Flash specifically
const client = createAIClient('nvidia/flash');

// Or use automatic fallback
const client = createAIClient('nvidia/flash'); // Falls back to OpenAI if unavailable
```

### Cost Comparison

| Model | Input Token Cost | Output Token Cost | Context Window |
|-------|------------------|-------------------|----------------|
| NVIDIA Flash | $0.10 per 1M | $0.40 per 1M | 131K tokens |
| GPT-4.1 Mini | $0.15 per 1M | $0.60 per 1M | 128K tokens |

## Testing

Run the integration test:

```bash
cd property-assistant
npm run test:nvidia
```

Or manually:

```bash
cd property-assistant
node test-nvidia-integration.ts
```

## API Endpoints

### Chat API

The main chat endpoint (`/api/chat`) now supports NVIDIA Flash through the automatic fallback system.

### Embeddings

Embeddings continue to use OpenAI's `text-embedding-3-large` for consistency and performance.

## Error Handling

- **Missing API Key**: Falls back to OpenAI automatically
- **Rate Limits**: Retries with exponential backoff, then falls back
- **Network Errors**: Retries up to 3 times, then falls back

## Monitoring

Check the following in your logs:

- `MODEL_SWITCH`: Logs when falling back to different providers
- `COST_CALCULATION`: Tracks token usage and costs per provider
- `PERFORMANCE_METRICS`: Response times and success rates

## Benefits of NVIDIA Flash

1. **Cost Effective**: ~33% cheaper than GPT-4.1 Mini
2. **Large Context**: 131K token window vs 128K
3. **High Performance**: Optimized for long-context tasks
4. **Multi-Provider**: Reduces dependency on single provider

## Limitations

1. **Vision**: NVIDIA Flash doesn't support vision capabilities (use GPT-4o)
2. **Embeddings**: Still uses OpenAI for embeddings
3. **Availability**: Beta access may have limits

## Support

For issues with NVIDIA Flash:

1. Check [NVIDIA API Status](https://status.api.nvidia.com/)
2. Review [NVIDIA Documentation](https://docs.nvidia.com/)
3. Contact NVIDIA Support through their developer portal

For issues with the integration:

1. Check environment variables
2. Verify API key permissions
3. Review application logs for fallback messages