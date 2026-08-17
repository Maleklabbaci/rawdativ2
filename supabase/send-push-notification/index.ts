import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const FCM_PROJECT_ID = 'rawdah-notifications';
const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 600;

type PushRequest = {
  target?: string;
  title?: string;
  message?: string;
  page?: string;
  url?: string;
  notificationId?: string;
};

type PushDevice = { id: string; token: string };

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

async function firebaseAccessToken(serviceAccountJson: string) {
  const serviceAccount = JSON.parse(serviceAccountJson) as {
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };

  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('La configuration Firebase est incomplète.');
  }

  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: FIREBASE_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const tokenResponse = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const tokenPayload = await tokenResponse.json() as { access_token?: string; error_description?: string };
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(tokenPayload.error_description || 'Firebase a refusé l’authentification serveur.');
  }

  return tokenPayload.access_token;
}

async function sendToDevice(token: string, accessToken: string, payload: Required<Pick<PushRequest, 'title' | 'message'>> & { page: string; url: string; notificationId: string }) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: payload.title, body: payload.message },
        data: {
          page: payload.page,
          url: payload.url,
          notificationId: payload.notificationId,
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'rawdha_alerts',
            sound: 'default',
          },
        },
      },
    }),
  });

  const responseBody = await response.text();
  return { ok: response.ok, status: response.status, responseBody };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Méthode non autorisée.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Non authentifié.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return jsonResponse({ error: 'Session invalide.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile, error: callerError } = await adminClient
      .from('comptes')
      .select('data')
      .eq('id', caller.id)
      .maybeSingle();
    if (callerError) return jsonResponse({ error: callerError.message }, 500);
    if ((callerProfile?.data as Record<string, unknown> | null)?.role !== 'admin') {
      return jsonResponse({ error: 'Accès refusé : réservé aux administrateurs.' }, 403);
    }

    const input = await req.json() as PushRequest;
    const title = text(input.title, MAX_TITLE_LENGTH);
    const message = text(input.message, MAX_MESSAGE_LENGTH);
    const target = text(input.target, 80) || 'all_directeurs';
    const page = text(input.page, 40) || 'notifications';
    const url = text(input.url, 500);
    const notificationId = text(input.notificationId, 120);
    if (!title || !message) return jsonResponse({ error: 'Titre et message obligatoires.' }, 400);

    let devices: PushDevice[] = [];
    if (target === 'all_directeurs') {
      const { data: accounts, error: accountsError } = await adminClient
        .from('comptes')
        .select('id, data');
      if (accountsError) return jsonResponse({ error: accountsError.message }, 500);
      const directeurIds = (accounts || [])
        .filter((account) => (account.data as Record<string, unknown> | null)?.role === 'directeur')
        .map((account) => account.id);
      if (directeurIds.length) {
        const { data, error } = await adminClient
          .from('push_devices')
          .select('id, token')
          .in('user_id', directeurIds)
          .eq('enabled', true);
        if (error) return jsonResponse({ error: error.message }, 500);
        devices = (data || []) as PushDevice[];
      }
    } else {
      const { data, error } = await adminClient
        .from('push_devices')
        .select('id, token')
        .eq('user_id', target)
        .eq('enabled', true);
      if (error) return jsonResponse({ error: error.message }, 500);
      devices = (data || []) as PushDevice[];
    }

    if (!devices.length) {
      await adminClient.from('push_delivery_logs').insert({
        sent_by: caller.id,
        target,
        title,
        attempted_count: 0,
        delivered_count: 0,
        failed_count: 0,
      });
      return jsonResponse({ attempted: 0, delivered: 0, failed: 0, message: 'Aucun appareil Android autorisé pour ce destinataire.' });
    }

    const { data: serviceAccountJson, error: secretError } = await adminClient.rpc('get_firebase_service_account');
    if (secretError || !serviceAccountJson) {
      return jsonResponse({ error: secretError?.message || 'Secret Firebase indisponible.' }, 500);
    }
    const accessToken = await firebaseAccessToken(serviceAccountJson);

    let delivered = 0;
    let failed = 0;
    const invalidDeviceIds: string[] = [];
    const sharedPayload = { title, message, page, url, notificationId };
    for (let index = 0; index < devices.length; index += 15) {
      const batch = devices.slice(index, index + 15);
      const results = await Promise.all(batch.map(async (device) => ({
        device,
        result: await sendToDevice(device.token, accessToken, sharedPayload),
      })));
      for (const { device, result } of results) {
        if (result.ok) {
          delivered += 1;
        } else {
          failed += 1;
          if (result.status === 404 || result.responseBody.includes('UNREGISTERED')) invalidDeviceIds.push(device.id);
          console.error('Firebase push failed', result.status, result.responseBody.slice(0, 500));
        }
      }
    }

    if (invalidDeviceIds.length) {
      await adminClient.from('push_devices').update({ enabled: false, updated_at: new Date().toISOString() }).in('id', invalidDeviceIds);
    }

    await adminClient.from('push_delivery_logs').insert({
      sent_by: caller.id,
      target,
      title,
      attempted_count: devices.length,
      delivered_count: delivered,
      failed_count: failed,
    });

    return jsonResponse({ attempted: devices.length, delivered, failed });
  } catch (error) {
    console.error('Rawdha+ push delivery error', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Erreur inconnue.' }, 500);
  }
});
