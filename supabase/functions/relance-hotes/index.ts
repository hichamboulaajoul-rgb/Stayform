// Fonction relance-hotes
//
// Envoie, via Resend, un e-mail aux hôtes inscrits qui n'ont encore créé aucun contrat,
// pour les aider à créer le premier. Utilisée par l'onglet « Relances » de admin.html.
//
// Actions (POST, JSON) :
//   { action: "preview" }                  admin : liste des hôtes à relancer + aperçu de l'e-mail
//   { action: "send", user_ids: [...] }    admin : envoie l'e-mail aux hôtes choisis (100 max)
//   { action: "unsubscribe", token }       public : appelé par desinscription.html
//
// Déploiement : verify_jwt peut rester activé (la page de désinscription envoie la clé anon) ;
// les actions admin vérifient elles-mêmes le jeton et profiles.role = 'admin'.
// Secrets utilisés : RESEND_API_KEY (déjà présent pour send-checkin-email),
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY (fournis par Supabase).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY);

const SITE = "https://stayform.link";
const FROM = "Hicham de Stayform <noreply@stayform.link>";
const KIND = "relance_sans_contrat";
const RESEND_WAIT_DAYS = 7; // pas deux relances au même hôte en moins de 7 jours
const MAX_PER_SEND = 100;   // limite d'un envoi groupé Resend
const WHATSAPP = "212694962765";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ── Lien de désinscription signé (HMAC de l'identifiant de l'hôte) ──
async function sign(userId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("unsub:" + userId)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "").slice(0, 32);
}
async function unsubscribeUrl(userId: string) {
  return `${SITE}/desinscription.html?t=${userId}.${await sign(userId)}`;
}

// ── Contenu de l'e-mail ──
function firstName(name: string | null) {
  const n = (name || "").trim().split(/\s+/)[0] || "";
  return n.length > 40 ? "" : n;
}

function buildEmail(name: string | null, unsubUrl: string) {
  const prenom = firstName(name);
  const subject = prenom ? `${prenom}, votre premier contrat Stayform en 3 minutes` : "Votre premier contrat Stayform en 3 minutes";
  const hello = prenom ? `Bonjour ${esc(prenom)},` : "Bonjour,";
  const step = (n: number, title: string, text: string) => `
    <tr><td style="padding:0 0 14px;vertical-align:top;width:34px;">
      <div style="width:26px;height:26px;border-radius:50%;background:#24423A;color:#fff;font-weight:700;font-size:13px;line-height:26px;text-align:center;">${n}</div>
    </td><td style="padding:0 0 14px 6px;vertical-align:top;">
      <div style="font-weight:700;color:#16241E;font-size:15px;">${title}</div>
      <div style="color:#5B6B63;font-size:14px;line-height:1.5;">${text}</div>
    </td></tr>`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#F3ECDD;">
<div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="background:#16241E;border-radius:14px 14px 0 0;padding:22px 28px;">
    <div style="color:#F3ECDD;font-size:22px;font-weight:700;letter-spacing:-0.3px;">stayform</div>
    <div style="color:rgba(243,236,221,0.75);font-size:13px;margin-top:2px;">Le check-in digital des hôtes au Maroc</div>
  </div>
  <div style="background:#ffffff;border-radius:0 0 14px 14px;padding:28px;">
    <p style="margin:0 0 14px;color:#16241E;font-size:16px;font-weight:600;">${hello}</p>
    <p style="margin:0 0 14px;color:#33433B;font-size:15px;line-height:1.6;">Merci de vous être inscrit sur Stayform ! J'ai vu que vous n'aviez pas encore créé votre premier contrat. Rien de compliqué, voici les 3 étapes :</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 8px;">
      ${step(1, "Ajoutez votre hébergement", "Collez votre lien Airbnb, ou ajoutez-le à la main.")}
      ${step(2, "Configurez vos règles", "Depuis votre hébergement : vos infos (CNIE, téléphone) et vos règles.")}
      ${step(3, "Envoyez votre lien de check-in", "Votre voyageur remplit tout depuis son téléphone. Vous recevez le contrat signé et la fiche de police en PDF.")}
    </table>
    <p style="margin:0 0 22px;color:#33433B;font-size:15px;line-height:1.6;">Vos premiers contrats sont offerts. Le guide pas à pas du tableau de bord vous accompagne à chaque étape.</p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${SITE}" style="display:inline-block;background:#24423A;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px;">Créer mon premier contrat</a>
    </div>
    <p style="margin:0 0 6px;color:#33433B;font-size:14px;line-height:1.6;">Vous bloquez quelque part ? Répondez simplement à cet e-mail ou écrivez-moi sur <a href="https://wa.me/${WHATSAPP}" style="color:#24423A;font-weight:600;">WhatsApp</a> au +212 694 962 765. Je vous aide personnellement.</p>
    <p style="margin:18px 0 0;color:#16241E;font-size:14px;">Hicham<br><span style="color:#5B6B63;">Fondateur de Stayform</span></p>
  </div>
  <p style="text-align:center;color:#8A8F87;font-size:11px;line-height:1.6;margin:16px 0 0;">
    Vous recevez cet e-mail car vous avez créé un compte sur stayform.link.<br>
    <a href="${unsubUrl}" style="color:#8A8F87;">Ne plus recevoir ces e-mails</a>
  </p>
</div></body></html>`;
  const text = `${prenom ? `Bonjour ${prenom},` : "Bonjour,"}

Merci de vous être inscrit sur Stayform ! J'ai vu que vous n'aviez pas encore créé votre premier contrat. Voici les 3 étapes :

1. Ajoutez votre hébergement (collez votre lien Airbnb, ou ajoutez-le à la main)
2. Configurez vos règles (vos infos CNIE, téléphone, et vos règles)
3. Envoyez votre lien de check-in : votre voyageur remplit tout depuis son téléphone, vous recevez le contrat signé et la fiche de police en PDF.

Vos premiers contrats sont offerts : ${SITE}

Vous bloquez ? Répondez à cet e-mail ou écrivez-moi sur WhatsApp au +212 694 962 765.

Hicham, fondateur de Stayform

Ne plus recevoir ces e-mails : ${unsubUrl}`;
  return { subject, html, text };
}

// ── Hôtes sans contrat ──
type Candidate = { id: string; email: string; name: string | null; created_at: string; last_sent: string | null };

async function hostIdsWithGuests() {
  const ids = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("guests").select("host_id").range(from, from + 999);
    if (error) throw error;
    (data || []).forEach((g: { host_id: string }) => g.host_id && ids.add(g.host_id));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function candidates(): Promise<Candidate[]> {
  const [{ data: profiles, error: pErr }, withGuests, { data: optouts, error: oErr }, { data: sent, error: sErr }] = await Promise.all([
    supabase.from("profiles").select("id, email, name, role, created_at").order("created_at", { ascending: false }),
    hostIdsWithGuests(),
    supabase.from("email_optout").select("user_id"),
    supabase.from("host_emails").select("user_id, created_at").eq("kind", KIND).is("error", null).order("created_at", { ascending: false }),
  ]);
  if (pErr) throw pErr;
  if (oErr) throw oErr;
  if (sErr) throw sErr;
  const opted = new Set((optouts || []).map((o: { user_id: string }) => o.user_id));
  const lastSent = new Map<string, string>();
  (sent || []).forEach((s: { user_id: string; created_at: string }) => { if (!lastSent.has(s.user_id)) lastSent.set(s.user_id, s.created_at); });
  return (profiles || [])
    .filter((p: any) => p.role !== "admin" && p.email && !withGuests.has(p.id) && !opted.has(p.id))
    .map((p: any) => ({ id: p.id, email: p.email, name: p.name, created_at: p.created_at, last_sent: lastSent.get(p.id) || null }));
}

function recentlySent(c: Candidate) {
  return !!c.last_sent && Date.now() - new Date(c.last_sent).getTime() < RESEND_WAIT_DAYS * 86400000;
}

// ── Admin ──
async function requireAdmin(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  return profile && profile.role === "admin" ? data.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "JSON invalide" }, 400); }

  try {
    // Désinscription (public, lien signé)
    if (body.action === "unsubscribe") {
      const [userId, sig] = String(body.token || "").split(".");
      if (!/^[0-9a-f-]{36}$/i.test(userId || "") || !sig || sig !== await sign(userId)) {
        return json({ error: "Lien de désinscription invalide" }, 400);
      }
      const { error } = await supabase.from("email_optout").upsert({ user_id: userId }, { onConflict: "user_id" });
      if (error) throw error;
      return json({ success: true });
    }

    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "Accès réservé aux administrateurs" }, 403);

    if (body.action === "preview") {
      const list = await candidates();
      const sample = buildEmail("Prénom", `${SITE}/desinscription.html`);
      return json({ candidates: list, sample, from: FROM, reply_to: admin.email, wait_days: RESEND_WAIT_DAYS, max: MAX_PER_SEND });
    }

    if (body.action === "send") {
      if (!RESEND_API_KEY) return json({ error: "RESEND_API_KEY manquant dans les secrets Supabase" }, 500);
      const wanted = new Set<string>(Array.isArray(body.user_ids) ? body.user_ids.map(String) : []);
      const all = await candidates();
      const targets = all.filter((c) => wanted.has(c.id) && !recentlySent(c));
      const skipped = wanted.size - targets.length;
      if (!targets.length) return json({ sent: 0, skipped, failed: 0 });
      if (targets.length > MAX_PER_SEND) return json({ error: `Maximum ${MAX_PER_SEND} hôtes par envoi` }, 400);

      const emails = await Promise.all(targets.map(async (c) => {
        const url = await unsubscribeUrl(c.id);
        const { subject, html, text } = buildEmail(c.name, url);
        return {
          from: FROM,
          to: [c.email],
          reply_to: admin.email ? [admin.email] : undefined,
          subject, html, text,
          headers: { "List-Unsubscribe": `<${url}>` },
          tags: [{ name: "kind", value: KIND }],
        };
      }));

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(emails),
      });
      const out = await res.json().catch(() => ({}));
      const ids: (string | null)[] = res.ok && Array.isArray(out.data) ? out.data.map((d: any) => d?.id ?? null) : [];
      const errMsg = res.ok ? null : String(out.message || out.error || `Resend HTTP ${res.status}`).slice(0, 300);

      await supabase.from("host_emails").insert(targets.map((c, i) => ({
        user_id: c.id, email: c.email, kind: KIND, sent_by: admin.id,
        resend_id: ids[i] ?? null,
        error: errMsg,
      })));

      if (!res.ok) return json({ error: "Resend a refusé l'envoi : " + errMsg, sent: 0, skipped, failed: targets.length }, 502);
      return json({ sent: targets.length, skipped, failed: 0 });
    }

    return json({ error: "Action inconnue" }, 400);
  } catch (e: any) {
    console.error("relance-hotes error:", e);
    return json({ error: e?.message || "Erreur serveur" }, 500);
  }
});
