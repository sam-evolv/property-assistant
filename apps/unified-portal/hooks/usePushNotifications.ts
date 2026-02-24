'use client';

import { useEffect, useRef } from 'react';

interface UsePushNotificationsParams {
  unitUid: string;
  token: string | null;
  enabled?: boolean;
}

/**
 * Hook to initialize push notifications.
 *
 * Handles:
 * - Capacitor native push (iOS/Android) when running in a native wrapper
 * - Web Push API / Service Worker for PWA
 * - Registers the device token with the server
 */
export function usePushNotifications({ unitUid, token, enabled = true }: UsePushNotificationsParams) {
  const registered = useRef(false);

  useEffect(() => {
    if (!unitUid || !token || !enabled || registered.current) return;

    async function init() {
      try {
        // Try Capacitor native first
        const isNative = await tryCapacitorPush(unitUid, token!);
        if (isNative) {
          registered.current = true;
          return;
        }

        // Fallback to Web Push
        await tryWebPush(unitUid, token!);
        registered.current = true;
      } catch (error) {
        console.log('[PushNotifications] Init failed (non-critical):', error);
      }
    }

    init();
  }, [unitUid, token, enabled]);
}

async function tryCapacitorPush(unitUid: string, token: string): Promise<boolean> {
  try {
    // Dynamically import Capacitor to avoid build errors when not installed
    // @ts-ignore - @capacitor/core is an optional dependency, dynamically imported
    const { Capacitor } = await import('@capacitor/core');

    if (!Capacitor.isNativePlatform()) {
      return false;
    }

    // @ts-ignore - @capacitor/push-notifications is an optional dependency, dynamically imported
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.log('[PushNotifications] Permission not granted');
      return true; // Still native, just no permission
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Listen for token
    PushNotifications.addListener('registration', async (tokenData: any) => {
      await registerDeviceToken(unitUid, token, tokenData.value, Capacitor.getPlatform() as 'ios' | 'android');
    });

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    // Foreground notifications
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('[PushNotifications] Received in foreground:', notification.title);
    });

    // Notification taps
    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      const actionUrl = action.notification.data?.actionUrl;
      if (actionUrl && typeof window !== 'undefined') {
        window.location.hash = actionUrl;
      }
    });

    return true;
  } catch {
    // Capacitor not available
    return false;
  }
}

async function tryWebPush(unitUid: string, token: string): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!vapidPublicKey) {
      console.log('[PushNotifications] VAPID public key not configured');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    const subscriptionJson = subscription.toJSON();

    await registerDeviceToken(
      unitUid,
      token,
      subscriptionJson.endpoint || '',
      'web',
      subscriptionJson.endpoint,
      subscriptionJson.keys?.p256dh,
      subscriptionJson.keys?.auth
    );
  } catch (error) {
    console.log('[PushNotifications] Web push setup failed:', error);
  }
}

async function registerDeviceToken(
  unitUid: string,
  authToken: string,
  deviceToken: string,
  platform: 'ios' | 'android' | 'web',
  endpoint?: string,
  p256dh?: string,
  authKey?: string
) {
  try {
    await fetch('/api/notifications/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitUid,
        token: authToken,
        deviceToken,
        platform,
        endpoint,
        p256dh,
        auth_key: authKey,
      }),
    });
    console.log(`[PushNotifications] Device registered (${platform})`);
  } catch (error) {
    console.error('[PushNotifications] Failed to register device:', error);
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as any;
}
