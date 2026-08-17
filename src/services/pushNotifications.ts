import { Capacitor } from '@capacitor/core';
import {
  LocalNotifications,
  type ActionPerformed as LocalNotificationActionPerformed,
} from '@capacitor/local-notifications';
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

const APP_VERSION = '1.0.3';
const FOREGROUND_CHANNEL_ID = 'rawdha_foreground_alerts';
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

function dispatchPushData(data: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent('rawdha:push-action', {
      detail: data,
    }),
  );
}

function dispatchPushAction(action: ActionPerformed) {
  dispatchPushData(action.notification.data || {});
}

/**
 * Android ne crée pas forcément une entrée système pour un push reçu pendant
 * que l’application est ouverte. Cette alerte locale rend le message visible
 * dans le tiroir Android sans modifier le traitement Firebase d’origine.
 */
async function presentForegroundSystemNotification(notification: PushNotificationSchema) {
  try {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display === 'prompt') {
      permission = await LocalNotifications.requestPermissions();
    }

    if (permission.display !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now() % 2_000_000_000,
          title: notification.title || 'Rawdha+',
          body: notification.body || 'Vous avez une nouvelle information.',
          channelId: FOREGROUND_CHANNEL_ID,
          extra: notification.data || {},
          schedule: { at: new Date(Date.now() + 300), allowWhileIdle: true },
          isExactNotification: false,
          autoCancel: true,
          foreground: true,
        },
      ],
    });
  } catch (error) {
    // Une alerte interne reste visible dans Rawdha+ si Android bloque une alerte système.
    console.error('Rawdha+ : impossible d’afficher la notification système.', error);
  }
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

      await LocalNotifications.createChannel({
        id: FOREGROUND_CHANNEL_ID,
        name: 'Alertes Rawdha+',
        description: 'Alertes visibles lorsque Rawdha+ est ouverte',
        importance: 5,
        visibility: 1,
        vibration: true,
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

      await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        dispatchForegroundNotification(notification);
        await presentForegroundSystemNotification(notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        dispatchPushAction(action);
      });

      await LocalNotifications.addListener(
        'localNotificationActionPerformed',
        (action: LocalNotificationActionPerformed) => {
          dispatchPushData(action.notification.extra || {});
        },
      );

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
