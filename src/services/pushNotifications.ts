import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  type PermissionStatus,
  type PushNotificationSchema,
  type ActionPerformed,
} from '@capacitor/push-notifications';
import { supabase } from '../supabase';

export type PushSetupResult =
  | { status: 'unavailable' }
  | { status: 'denied' }
  | { status: 'registered' }
  | { status: 'error'; error: Error };

const APP_VERSION = '1.0.2';
let listenersConfigured = false;

/**
 * Les notifications push ne sont proposées que par l’APK Android.
 * La version web conserve les notifications internes sans demander de permission navigateur.
 */
export function isAndroidNativeApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

async function saveDeviceToken(userId: string, token: string) {
  const { error } = await supabase
    .from('push_devices')
    .upsert(
      {
        user_id: userId,
        token,
        platform: 'android',
        app_version: APP_VERSION,
        device_name: navigator.userAgent.slice(0, 240),
        enabled: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) throw error;
}

function dispatchForegroundNotification(notification: PushNotificationSchema) {
  window.dispatchEvent(
    new CustomEvent('rawdha:push-received', {
      detail: notification,
    }),
  );
}

function dispatchPushAction(action: ActionPerformed) {
  window.dispatchEvent(
    new CustomEvent('rawdha:push-action', {
      detail: action.notification.data || {},
    }),
  );
}

/**
 * Initialise une seule fois les écouteurs natifs puis demande l’autorisation Android.
 * Aucun jeton FCM n’est stocké avant l’accord explicite de l’utilisateur.
 */
export async function registerAndroidPushNotifications(userId: string): Promise<PushSetupResult> {
  if (!isAndroidNativeApp()) return { status: 'unavailable' };

  try {
    let permission: PermissionStatus = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') return { status: 'denied' };

    if (!listenersConfigured) {
      await PushNotifications.createChannel({
        id: 'rawdha_alerts',
        name: 'Alertes Rawdha+',
        description: 'Annonces et informations importantes de Rawdha+',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'default',
      });

      await PushNotifications.addListener('registration', async (token) => {
        const activeUserId = window.sessionStorage.getItem('rawdha_push_user_id');
        if (!activeUserId) return;

        try {
          await saveDeviceToken(activeUserId, token.value);
          console.info('Rawdha+ : appareil Android enregistré pour les notifications.');
        } catch (error) {
          console.error('Rawdha+ : impossible d’enregistrer l’appareil Android.', error);
        }
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Rawdha+ : échec d’enregistrement Firebase.', error);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        dispatchForegroundNotification(notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        dispatchPushAction(action);
      });

      listenersConfigured = true;
    }

    window.sessionStorage.setItem('rawdha_push_user_id', userId);
    await PushNotifications.register();
    return { status: 'registered' };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/** Supprime l’association locale après la déconnexion de Rawdha+. */
export function clearPushSessionUser() {
  window.sessionStorage.removeItem('rawdha_push_user_id');
}
