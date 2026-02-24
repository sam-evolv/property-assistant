/**
 * Firebase Cloud Messaging integration.
 * Handles sending push notifications to iOS (via APNs), Android, and Web.
 *
 * Setup required:
 * 1. Create Firebase project at console.firebase.google.com
 * 2. Add iOS app with your bundle ID
 * 3. Upload APNs key (from Apple Developer account → Keys → Create key with APNs)
 * 4. Download Firebase Admin SDK service account JSON
 * 5. Set FIREBASE_SERVICE_ACCOUNT env var
 */

import { createClient } from '@supabase/supabase-js';

// Lazy-loaded firebase-admin to avoid build issues when not configured
// @ts-ignore - firebase-admin is an optional dependency, lazy-loaded at runtime
let firebaseAdmin: typeof import('firebase-admin') | null = null;

async function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;

  try {
    // @ts-ignore - firebase-admin is an optional dependency, lazy-loaded at runtime
    const admin = await import('firebase-admin');

    if (!admin.apps.length) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!serviceAccountJson) {
        console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled');
        return null;
      }

      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseAdmin = admin;
    return admin;
  } catch (error) {
    console.warn('[FCM] firebase-admin not available — push notifications disabled:', error);
    return null;
  }
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  category?: string;
}

function getSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Send push notification to a specific device token
 */
export async function sendPush(token: string, payload: PushPayload): Promise<boolean> {
  const admin = await getFirebaseAdmin();
  if (!admin) {
    console.log('[FCM] Push skipped — Firebase not configured');
    return false;
  }

  try {
    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      apns: {
        payload: {
          aps: {
            badge: payload.badge ?? undefined,
            sound: payload.sound || 'default',
            'content-available': 1,
          },
        },
      },
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
        },
      },
    };

    await admin.messaging().send(message as any);
    return true;
  } catch (error: any) {
    if (
      error.code === 'messaging/invalid-registration-token' ||
      error.code === 'messaging/registration-token-not-registered'
    ) {
      await deactivateToken(token);
    }
    console.error('[FCM] Push send failed:', error.message || error);
    return false;
  }
}

/**
 * Send push to multiple tokens (batch).
 * FCM supports up to 500 tokens per batch.
 */
export async function sendPushBatch(
  tokens: string[],
  payload: PushPayload
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const admin = await getFirebaseAdmin();
  if (!admin) {
    return { success: 0, failure: tokens.length, invalidTokens: [] };
  }

  // FCM limit is 500 tokens per multicast
  const batchSize = 500;
  let totalSuccess = 0;
  let totalFailure = 0;
  const allInvalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);

    const message = {
      tokens: batch,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      apns: {
        payload: {
          aps: {
            sound: payload.sound || 'default',
            'content-available': 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message as any);

      response.responses.forEach((resp: any, idx: number) => {
        if (!resp.success && resp.error) {
          if (
            resp.error.code === 'messaging/invalid-registration-token' ||
            resp.error.code === 'messaging/registration-token-not-registered'
          ) {
            allInvalidTokens.push(batch[idx]);
          }
        }
      });

      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    } catch (error) {
      console.error('[FCM] Batch send failed:', error);
      totalFailure += batch.length;
    }
  }

  // Clean up invalid tokens
  if (allInvalidTokens.length > 0) {
    await deactivateTokens(allInvalidTokens);
  }

  return {
    success: totalSuccess,
    failure: totalFailure,
    invalidTokens: allInvalidTokens,
  };
}

async function deactivateToken(token: string) {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase
      .from('push_device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('token', token);
  } catch (error) {
    console.error('[FCM] Failed to deactivate token:', error);
  }
}

async function deactivateTokens(tokens: string[]) {
  try {
    const supabase = getSupabaseServiceClient();
    await supabase
      .from('push_device_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in('token', tokens);
  } catch (error) {
    console.error('[FCM] Failed to deactivate tokens:', error);
  }
}
