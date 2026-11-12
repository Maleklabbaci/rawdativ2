import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ParentPushPayload = {
  crecheId?: string;
  title?: string;
  message?: string;
  targetScope?: 'all' | 'group' | 'child';
  targetGroup?: string;
  targetEnfantId?: string;
  announcementId?: string;
};

// Never send a server-side request to an arbitrary subscriber-supplied host.
function isSupportedPushSubscription(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const subscription = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 2048 ||
      typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string' ||
      !/^[A-Za-z0-9_-]{80,120}$/.test(subscription.keys.p256dh) || !/^[A-Za-z0-9_-]{20,40}$/.test(subscription.keys.auth)) return false;
  try {
    const url = new URL(subscription.endpoint);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    return host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host === 'web.push.apple.com' || host.endsWith('.push.apple.com') || host.endsWith('.notify.windows.com');
  } catch { return false; }
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@rawdha.dz';

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Configuration Supabase manquante.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') || '';
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) {
    return jsonResponse({ error: 'Session directrice requise.' }, 401);
  }

  const { data: account, error: accountError } = await adminClient.from('comptes').select('data').eq('id', userData.user.id).maybeSingle();
  if (accountError) return jsonResponse({ error: 'Vérification du compte indisponible.' }, 503);
  if (account?.data?.role !== 'directeur' || account?.data?.approvalStatus !== 'approved') {
    return jsonResponse({ error: 'Compte directrice actif requis.' }, 403);
  }

  const body = (await req.json().catch(() => ({}))) as ParentPushPayload;
  const crecheId = (body.crecheId || userData.user.id).trim();
  if (crecheId !== userData.user.id) {
    return jsonResponse({ error: 'Accès refusé pour cette crèche.' }, 403);
  }

  if (!['all', 'group', 'child'].includes(body.targetScope || '') ||
      (body.targetScope === 'child' && (typeof body.targetEnfantId !== 'string' || !body.targetEnfantId.trim())) ||
      (body.targetScope === 'group' && (typeof body.targetGroup !== 'string' || !body.targetGroup.trim()))) {
    return jsonResponse({ error: 'Destinataire invalide.' }, 400);
  }

  const title = (body.title || '').trim().slice(0, 120);
  const message = (body.message || '').trim().slice(0, 600);
  if (!title || !message) {
    return jsonResponse({ error: 'Titre et message requis.' }, 400);
  }

  if (!vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({
      sent: 0,
      configured: false,
      note: 'Ajoutez VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY dans les secrets Supabase pour activer le relais Web Push externe.',
    });
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const { data: links, error: linksError } = await adminClient
    .from('parent_link_requests')
    .select('id, linked_enfant_ids, push_subscription, push_enabled')
    .eq('creche_id', crecheId)
    .eq('status', 'approved')
    .eq('push_enabled', true);

  if (linksError) {
    return jsonResponse({ error: linksError.message }, 500);
  }

  let allowedChildIds: Set<string> | null = null;
  if (body.targetScope === 'child' && body.targetEnfantId) {
    allowedChildIds = new Set([body.targetEnfantId]);
  } else if (body.targetScope === 'group' && body.targetGroup) {
    const { data: childRows, error: childError } = await adminClient
      .from('enfants')
      .select('id, data')
      .eq('data->>crecheId', crecheId)
      .eq('data->>groupeAge', body.targetGroup);
    if (childError) return jsonResponse({ error: 'Destinataires indisponibles.' }, 503);
    allowedChildIds = new Set((childRows || []).map((r: { id: string }) => r.id));
  }

  let sent = 0;
  let failed = 0;

  for (const row of links || []) {
    const childIds: string[] = Array.isArray(row.linked_enfant_ids) ? row.linked_enfant_ids : [];
    if (allowedChildIds && !childIds.some((id) => allowedChildIds!.has(id))) {
      continue;
    }
    if (!isSupportedPushSubscription(row.push_subscription)) { failed += 1; continue; }

    try {
      await webpush.sendNotification(
        row.push_subscription,
        JSON.stringify({
          title,
          body: message,
          url: `/espace-parent?creche=${encodeURIComponent(crecheId)}`,
          tag: body.announcementId || `rawdha-ann-${Date.now()}`,
        }),
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await adminClient
          .from('parent_link_requests')
          .update({ push_enabled: false, push_subscription: null })
          .eq('id', row.id);
      }
    }
  }

  return jsonResponse({ sent, failed, configured: true });
});
