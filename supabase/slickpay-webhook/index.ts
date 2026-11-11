// Supabase Edge Function : `slickpay-webhook` (`verify_jwt = false`)
// Réception en arrière-plan 24h/24 des notifications de paiement SlickPay API v2 (SATIM CIB / Edahabia),
// même si la directrice ferme son navigateur immédiatement après le code OTP bancaire.
//
// Triple sécurité :
// 1. Vérification HMAC-SHA256 en temps constant (`?sig=` dans `webhook_url`, en-tête `webhook-signature`,
//    champ `webhook_signature` ou HMAC du corps brut signé avec `SLICKPAY_SECRET_KEY`).
// 2. Contre-vérification serveur-à-serveur obligatoire `GET /api/v2/{users|merchants}/invoices/{id}`
//    confirmant `data.completed == 1` directement auprès de SlickPay.
// 3. Activation PostgreSQL transactionnelle et 100 % idempotente `confirm_slickpay_subscription_order`
//    (`FOR UPDATE`) + diffusion temps réel Supabase Realtime vers l'écran en attente.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type SlickPayApiScope = 'users' | 'merchants';

function resolveSlickPayDomain(): string {
  const env = (Deno.env.get('SLICKPAY_ENV') || 'production').trim().toLowerCase();
  return env === 'sandbox' || env === 'dev'
    ? 'https://devapi.slick-pay.com/api/v2'
    : 'https://prodapi.slick-pay.com/api/v2';
}

function resolvePreferredScopes(): SlickPayApiScope[] {
  const configured = (Deno.env.get('SLICKPAY_ACCOUNT_TYPE') || 'auto').trim().toLowerCase();
  if (configured === 'merchant' || configured === 'merchants') return ['merchants'];
  if (configured === 'user' || configured === 'users') return ['users'];
  return ['users', 'merchants'];
}

async function computeHmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualString(a: string, b: string): boolean {
  const cleanA = a.trim().toLowerCase();
  const cleanB = b.trim().toLowerCase();
  if (!cleanA || cleanA.length !== cleanB.length) return false;
  let diff = 0;
  for (let i = 0; i < cleanA.length; i += 1) {
    diff |= cleanA.charCodeAt(i) ^ cleanB.charCodeAt(i);
  }
  return diff === 0;
}

function extractOrderIdFromPayload(url: URL, body: Record<string, unknown>): string {
  const fromQuery = (url.searchParams.get('order_id') || '').trim();
  if (fromQuery) return fromQuery;

  const meta = body.webhook_meta_data ?? (body.data as Record<string, unknown> | undefined)?.webhook_meta_data;
  if (Array.isArray(meta)) {
    for (const entry of meta) {
      if (entry && typeof entry === 'object' && 'order_id' in entry) {
        const candidate = String((entry as Record<string, unknown>).order_id || '').trim();
        if (candidate) return candidate;
      }
    }
  } else if (meta && typeof meta === 'object' && 'order_id' in (meta as Record<string, unknown>)) {
    const candidate = String((meta as Record<string, unknown>).order_id || '').trim();
    if (candidate) return candidate;
  }
  return String(body.order_id || '').trim();
}

function isInvoicePaid(payload: Record<string, unknown>): boolean {
  const inner = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
  const completed = Number(inner.completed ?? payload.completed ?? 0);
  const status = String(inner.payment_status ?? inner.status ?? payload.payment_status ?? '').toLowerCase();
  return completed === 1 || status === 'paid' || status === 'completed';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const slickpayPublicKey = (Deno.env.get('SLICKPAY_PUBLIC_KEY') || '').trim();
    const slickpaySecretKey = (Deno.env.get('SLICKPAY_SECRET_KEY') || '').trim();

    if (!slickpayPublicKey || !slickpaySecretKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Server secrets missing' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const reqUrl = new URL(req.url);
    const rawText = req.method === 'POST' ? await req.text().catch(() => '') : '';
    let body: Record<string, unknown> = {};
    if (rawText) {
      try {
        body = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    let orderId = extractOrderIdFromPayload(reqUrl, body);

    // Repli : si SlickPay envoie uniquement `id` (identifiant de facture SlickPay), retrouver la commande liée
    const incomingInvoiceId = String(
      body.id ?? (body.data as Record<string, unknown> | undefined)?.id ?? reqUrl.searchParams.get('invoice_id') ?? ''
    ).trim();

    if (!orderId && incomingInvoiceId) {
      const { data: byInvoice } = await adminClient
        .from('slickpay_subscription_orders')
        .select('id')
        .eq('slickpay_invoice_id', incomingInvoiceId)
        .maybeSingle();
      if (byInvoice?.id) orderId = String(byInvoice.id);
    }

    if (!orderId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing order_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const expectedOrderHmac = await computeHmacSha256Hex(slickpaySecretKey, orderId);
    const expectedBodyHmac = rawText ? await computeHmacSha256Hex(slickpaySecretKey, rawText) : '';

    const candidateSignatures = [
      reqUrl.searchParams.get('sig') || '',
      req.headers.get('webhook-signature') || '',
      req.headers.get('x-webhook-signature') || '',
      req.headers.get('x-slickpay-signature') || '',
      req.headers.get('signature') || '',
      String(body.webhook_signature || ''),
      String(body.signature || ''),
    ].filter(Boolean);

    const signatureValid = candidateSignatures.some(
      cand =>
        timingSafeEqualString(cand, expectedOrderHmac) ||
        (expectedBodyHmac ? timingSafeEqualString(cand, expectedBodyHmac) : false)
    );

    if (!signatureValid) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid webhook signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: order } = await adminClient
      .from('slickpay_subscription_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (order.status === 'paid') {
      return new Response(JSON.stringify({ ok: true, alreadyPaid: true, orderId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const invoiceId = String(order.slickpay_invoice_id || incomingInvoiceId || '').trim();
    if (!invoiceId) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing invoice id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const storedRaw = (order.raw_slickpay_response || {}) as Record<string, unknown>;
    const storedScope =
      storedRaw._api_scope === 'merchants'
        ? 'merchants'
        : storedRaw._api_scope === 'users'
          ? 'users'
          : null;
    const scopesToCheck: SlickPayApiScope[] = storedScope ? [storedScope] : resolvePreferredScopes();
    const domain = resolveSlickPayDomain();

    let verifyJson: Record<string, unknown> = {};
    let verifyOk = false;

    for (const scope of scopesToCheck) {
      const verifyRes = await fetch(`${domain}/${scope}/invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${slickpayPublicKey}`,
        },
      });
      const parsed = (await verifyRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (verifyRes.ok) {
        verifyJson = { ...parsed, _api_scope: scope };
        verifyOk = true;
        break;
      }
    }

    if (!verifyOk || !isInvoicePaid(verifyJson)) {
      const dataObj = (verifyJson.data && typeof verifyJson.data === 'object'
        ? verifyJson.data
        : verifyJson) as Record<string, unknown>;
      const rejectionReason = String(dataObj.rejection_reason || '').trim();
      if (rejectionReason) {
        await adminClient
          .from('slickpay_subscription_orders')
          .update({
            status: 'failed',
            rejection_reason: rejectionReason,
            raw_slickpay_response: verifyJson,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId);
      }
      return new Response(
        JSON.stringify({ ok: true, status: rejectionReason ? 'failed' : 'pending', orderId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { data: confirmData, error: confirmErr } = await adminClient.rpc(
      'confirm_slickpay_subscription_order',
      {
        p_order_id: orderId,
        p_slickpay_invoice_id: invoiceId,
        p_raw_response: verifyJson,
      }
    );

    if (confirmErr) {
      throw new Error(confirmErr.message);
    }

    return new Response(JSON.stringify({ ok: true, status: 'paid', result: confirmData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook error';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
