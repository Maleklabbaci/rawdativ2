// Supabase Edge Function : `slickpay-checkout`
// Intégration officielle SlickPay Algérie API v2 (CIB / Edahabia — SATIM)
// Basée sur la documentation officielle SlickPay v2 & le plugin officiel `Slick-Pay-Algeria/slickpay-wp` :
// - Supporte automatiquement les comptes `users` (`/api/v2/users/invoices` + auto-découverte RIB `/users/accounts`)
//   ET les comptes `merchants` (`/api/v2/merchants/invoices`) via `SLICKPAY_ACCOUNT_TYPE=auto|user|merchant`.
// - Signe `webhook_url` (`?order_id=...&sig=...`) + `webhook_signature` en HMAC-SHA256 avec `SLICKPAY_SECRET_KEY`.
// - Vérifie `data.completed == 1` auprès de SlickPay lors de l'action `verify` (polling / retour SATIM).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const OFFICIAL_PLAN_PRICES_DZD: Record<number, number> = {
  1: 1900,
  3: 5700,
  12: 19000,
};

const OFFICIAL_PROMO_DISCOUNTS_DZD: Record<string, number> = {
  RAWDHA300: 300,
  RAWDHA500: 500,
  RAWDHA900: 900,
};

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
  // En mode `auto`, on teste `users` (avec auto-découverte RIB) puis repli transparent sur `merchants`
  return ['users', 'merchants'];
}

function normalizeAlgerianPhone(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('213') && digits.length === 12) return `0${digits.slice(3)}`;
  if (digits.startsWith('00213') && digits.length === 14) return `0${digits.slice(5)}`;
  if (/^0[567]\d{8}$/.test(digits)) return digits;
  return '0550000000';
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

function isInvoicePaid(payload: Record<string, unknown>): boolean {
  const inner = (payload.data && typeof payload.data === 'object' ? payload.data : payload) as Record<string, unknown>;
  const completed = Number(inner.completed ?? payload.completed ?? 0);
  const status = String(inner.payment_status ?? inner.status ?? payload.payment_status ?? '').toLowerCase();
  return completed === 1 || status === 'paid' || status === 'completed';
}

async function resolveDefaultUserAccountUuid(
  domain: string,
  publicKey: string,
  configuredUuid: string
): Promise<string | undefined> {
  if (configuredUuid) return configuredUuid;
  try {
    const res = await fetch(`${domain}/users/accounts`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${publicKey}`,
      },
    });
    if (!res.ok) return undefined;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const list = Array.isArray(json.data) ? json.data : [];
    for (const acc of list) {
      if (acc && typeof acc === 'object' && 'uuid' in acc) {
        const uuid = String((acc as Record<string, unknown>).uuid || '').trim();
        if (uuid) return uuid;
      }
    }
  } catch {
    // Ignore auto-discovery error; SlickPay falls back to default account if set
  }
  return undefined;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const slickpayPublicKey = (Deno.env.get('SLICKPAY_PUBLIC_KEY') || '').trim();
    const slickpaySecretKey = (Deno.env.get('SLICKPAY_SECRET_KEY') || '').trim();
    const configuredAccountUuid = (Deno.env.get('SLICKPAY_ACCOUNT_UUID') || '').trim();

    if (!slickpayPublicKey || !slickpaySecretKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Clés SlickPay non configurées sur le serveur Supabase (SLICKPAY_PUBLIC_KEY / SLICKPAY_SECRET_KEY).',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData?.user?.id) {
      return new Response(JSON.stringify({ ok: false, error: 'Authentification requise.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || 'create');
    const domain = resolveSlickPayDomain();

    // ========================================================================
    // ACTION 1 : VÉRIFIER LE STATUT D'UNE FACTURE (RETOUR SATIM OU POLLING ARRIÈRE-PLAN)
    // ========================================================================
    if (action === 'verify') {
      const orderId = String(body.orderId || '').trim();
      if (!orderId) {
        return new Response(JSON.stringify({ ok: false, error: 'Identifiant de commande manquant.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: order, error: orderErr } = await adminClient
        .from('slickpay_subscription_orders')
        .select('*')
        .eq('id', orderId)
        .eq('director_id', authData.user.id)
        .maybeSingle();

      if (orderErr || !order) {
        return new Response(JSON.stringify({ ok: false, error: 'Commande introuvable.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (order.status === 'paid') {
        return new Response(
          JSON.stringify({
            ok: true,
            status: 'paid',
            orderId: order.id,
            invoiceId: order.slickpay_invoice_id,
            newEndDate: order.new_end_date,
            planMonths: order.plan_months,
            amountDzd: order.amount_dzd,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!order.slickpay_invoice_id) {
        return new Response(
          JSON.stringify({
            ok: true,
            status: order.status,
            orderId: order.id,
            paymentUrl: order.payment_url || undefined,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const storedRaw = (order.raw_slickpay_response || {}) as Record<string, unknown>;
      const storedScope = storedRaw._api_scope === 'merchants' ? 'merchants' : storedRaw._api_scope === 'users' ? 'users' : null;
      const scopesToCheck: SlickPayApiScope[] = storedScope ? [storedScope] : resolvePreferredScopes();

      let verifyJson: Record<string, unknown> = {};
      let verifyOk = false;

      for (const scope of scopesToCheck) {
        const verifyRes = await fetch(
          `${domain}/${scope}/invoices/${encodeURIComponent(String(order.slickpay_invoice_id))}`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              Authorization: `Bearer ${slickpayPublicKey}`,
            },
          }
        );
        const parsed = (await verifyRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (verifyRes.ok) {
          verifyJson = { ...parsed, _api_scope: scope };
          verifyOk = true;
          break;
        }
      }

      if (verifyOk && isInvoicePaid(verifyJson)) {
        const { data: confirmData, error: confirmErr } = await adminClient.rpc(
          'confirm_slickpay_subscription_order',
          {
            p_order_id: order.id,
            p_slickpay_invoice_id: String(order.slickpay_invoice_id),
            p_raw_response: verifyJson,
          }
        );
        if (confirmErr) {
          throw new Error(confirmErr.message);
        }
        return new Response(
          JSON.stringify({
            ok: true,
            status: 'paid',
            orderId: order.id,
            invoiceId: order.slickpay_invoice_id,
            newEndDate: (confirmData as Record<string, unknown>)?.newEndDate,
            planMonths: order.plan_months,
            amountDzd: order.amount_dzd,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
          .eq('id', order.id);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          status: rejectionReason ? 'failed' : 'pending',
          orderId: order.id,
          invoiceId: order.slickpay_invoice_id,
          paymentUrl: order.payment_url || undefined,
          rejectionReason: rejectionReason || undefined,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================================================
    // ACTION 2 : CRÉER UNE FACTURE SLICKPAY SATIM (CIB / EDAHABIA)
    // ========================================================================
    const planMonths = Number(body.planMonths || 1);
    if (!OFFICIAL_PLAN_PRICES_DZD[planMonths]) {
      return new Response(JSON.stringify({ ok: false, error: 'Durée d’abonnement invalide.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const couponCode = String(body.couponCode || '').trim().toUpperCase();
    const discount =
      couponCode && OFFICIAL_PROMO_DISCOUNTS_DZD[couponCode] ? OFFICIAL_PROMO_DISCOUNTS_DZD[couponCode] : 0;
    const amountDzd = Math.max(100, OFFICIAL_PLAN_PRICES_DZD[planMonths] - discount);

    const { data: compteRow } = await adminClient
      .from('comptes')
      .select('data')
      .eq('id', authData.user.id)
      .maybeSingle();

    const profile = ((compteRow?.data as Record<string, unknown>) || {}) as Record<string, unknown>;
    const prenom = String(profile.prenom || body.prenom || 'Directrice').trim() || 'Directrice';
    const nom = String(profile.nom || body.nom || 'Rawdha').trim().toUpperCase() || 'RAWDHA';
    const fullName = `${prenom} ${nom}`.trim();
    const crecheName = String(profile.nomCreche || body.crecheName || 'Crèche Rawdha+').trim();
    const email = String(profile.email || authData.user.email || 'contact@rawdha.dz').trim();
    const phone = normalizeAlgerianPhone(String(profile.telephone || body.telephone || ''));
    const address = String(profile.ville || 'Algérie').trim() || 'Algérie';

    const rawReturnOrigin = String(body.returnOrigin || '').trim();
    let safeReturnOrigin = 'https://rawdha.dz';
    try {
      const parsedUrl = new URL(rawReturnOrigin);
      if (
        parsedUrl.protocol === 'https:' ||
        parsedUrl.hostname === 'localhost' ||
        parsedUrl.hostname === '127.0.0.1'
      ) {
        safeReturnOrigin = parsedUrl.origin;
      }
    } catch {
      // Fallback safe origin
    }

    const orderId = `spk_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const returnUrl = `${safeReturnOrigin}/abonnement?slickpay_order=${encodeURIComponent(orderId)}`;
    const webhookSignature = await computeHmacSha256Hex(slickpaySecretKey, orderId);
    // Double transport du jeton HMAC : dans l'URL du webhook ET dans `webhook_signature` + `webhook_meta_data`
    const webhookUrl = `${supabaseUrl}/functions/v1/slickpay-webhook?order_id=${encodeURIComponent(
      orderId
    )}&sig=${encodeURIComponent(webhookSignature)}`;

    const { error: insertErr } = await adminClient.from('slickpay_subscription_orders').insert({
      id: orderId,
      director_id: authData.user.id,
      director_name: fullName,
      creche_name: crecheName,
      email,
      telephone: phone,
      plan_months: planMonths,
      amount_dzd: amountDzd,
      coupon_code: discount > 0 ? couponCode : null,
      status: 'pending',
    });

    if (insertErr) {
      throw new Error(insertErr.message);
    }

    const planLabel = planMonths === 12 ? '12 mois (Annuel)' : `${planMonths} mois`;
    const scopes = resolvePreferredScopes();
    let slickJson: Record<string, unknown> = {};
    let paymentUrl = '';
    let invoiceId = '';
    let usedScope: SlickPayApiScope = scopes[0];
    let lastStatus = 500;

    for (const scope of scopes) {
      const payload: Record<string, unknown> = {
        amount: amountDzd,
        url: returnUrl,
        name: fullName,
        firstname: prenom,
        lastname: nom,
        phone,
        email,
        address,
        note: `Abonnement Rawdha+ (${planLabel}) — ${crecheName}`,
        items: [
          {
            name: `Abonnement Rawdha+ — ${planLabel}`,
            price: amountDzd,
            quantity: 1,
          },
        ],
        webhook_url: webhookUrl,
        webhook_signature: webhookSignature,
        webhook_meta_data: [
          {
            order_id: orderId,
            director_id: authData.user.id,
            plan_months: planMonths,
          },
        ],
      };

      if (scope === 'users') {
        const accountUuid = await resolveDefaultUserAccountUuid(
          domain,
          slickpayPublicKey,
          configuredAccountUuid
        );
        if (accountUuid) {
          payload.account = accountUuid;
        }
      }

      const slickRes = await fetch(`${domain}/${scope}/invoices`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${slickpayPublicKey}`,
        },
        body: JSON.stringify(payload),
      });

      lastStatus = slickRes.status;
      slickJson = (await slickRes.json().catch(() => ({}))) as Record<string, unknown>;
      paymentUrl = String(slickJson.url || '').trim();
      invoiceId = slickJson.id !== undefined && slickJson.id !== null ? String(slickJson.id) : '';

      if (slickRes.ok && paymentUrl) {
        usedScope = scope;
        break;
      }
    }

    if (!paymentUrl) {
      const apiMsg = String(slickJson.message || slickJson.error || `Erreur passerelle SlickPay (HTTP ${lastStatus})`);
      await adminClient
        .from('slickpay_subscription_orders')
        .update({
          status: 'failed',
          rejection_reason: apiMsg,
          raw_slickpay_response: slickJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      const hint = apiMsg.toLowerCase().includes('server error')
        ? 'Vérifiez qu’un compte bancaire / RIB actif est bien configuré sur votre espace SlickPay.'
        : apiMsg;
      return new Response(
        JSON.stringify({ ok: false, error: `SlickPay : ${hint}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await adminClient
      .from('slickpay_subscription_orders')
      .update({
        slickpay_invoice_id: invoiceId,
        payment_url: paymentUrl,
        raw_slickpay_response: { ...slickJson, _api_scope: usedScope },
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({
        ok: true,
        orderId,
        invoiceId,
        paymentUrl,
        amountDzd,
        planMonths,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur interne SlickPay.';
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
