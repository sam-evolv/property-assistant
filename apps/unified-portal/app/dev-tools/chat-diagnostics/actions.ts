'use server';

interface ChatDiagnosticsResult {
  success: boolean;
  data?: any;
  error?: string;
  latencyMs?: number;
}

export async function runChatDiagnostic(
  unitUid: string,
  message: string
): Promise<ChatDiagnosticsResult> {
  if (process.env.DEV_TOOLS !== 'true') {
    return { success: false, error: 'DEV_TOOLS not enabled' };
  }

  const testSecret = process.env.ASSISTANT_TEST_SECRET;
  if (!testSecret) {
    return { success: false, error: 'ASSISTANT_TEST_SECRET not configured' };
  }

  if (!message.trim()) {
    return { success: false, error: 'Message is required' };
  }

  const url = 'http://localhost:5000/api/chat';
  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Test-Mode': 'places-diagnostics',
        'X-Test-Secret': testSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message.trim(),
        unitUid: unitUid.trim() || undefined,
      }),
      cache: 'no-store',
    });

    const latencyMs = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return { 
        success: false, 
        error: `API returned non-JSON response (status ${response.status}): ${text.substring(0, 500)}`,
        latencyMs,
      };
    }

    const data = await response.json();
    return { success: true, data, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return { success: false, error: err.message || 'Request failed', latencyMs };
  }
}
