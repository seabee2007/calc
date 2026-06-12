import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface EmailEventInsert {
  userId?: string | null;
  projectId?: string | null;
  proposalId?: string | null;
  templateKey: string;
  toEmail: string;
  fromEmail: string;
  subject: string;
  status: string;
  errorMessage?: string | null;
  resendEmailId?: string | null;
  metadata?: Record<string, unknown>;
  sentAt?: string | null;
}

export async function insertEmailEvent(
  admin: SupabaseClient,
  input: EmailEventInsert,
): Promise<{ id: string } | null> {
  const { data, error } = await admin
    .from("email_events")
    .insert({
      user_id: input.userId ?? null,
      project_id: input.projectId ?? null,
      proposal_id: input.proposalId ?? null,
      template_key: input.templateKey,
      to_email: input.toEmail,
      from_email: input.fromEmail,
      subject: input.subject,
      status: input.status,
      error_message: input.errorMessage ?? null,
      resend_email_id: input.resendEmailId ?? null,
      metadata: input.metadata ?? {},
      sent_at: input.sentAt ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("insertEmailEvent failed", error.message);
    return null;
  }
  return { id: data.id as string };
}

export async function updateEmailEvent(
  admin: SupabaseClient,
  id: string,
  patch: Partial<{
    status: string;
    error_message: string | null;
    resend_email_id: string | null;
    sent_at: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  const { error } = await admin.from("email_events").update(patch).eq("id", id);
  if (error) console.error("updateEmailEvent failed", error.message);
}

export async function findLatestSuppressedRecipient(
  admin: SupabaseClient,
  toEmail: string,
): Promise<{ status: string } | null> {
  const { data, error } = await admin
    .from("email_events")
    .select("status")
    .ilike("to_email", toEmail.trim())
    .in("status", ["bounced", "complained"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { status: data.status as string };
}

export async function updateEmailEventByResendId(
  admin: SupabaseClient,
  resendEmailId: string,
  patch: Partial<{
    status: string;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  const { data: existing, error: fetchError } = await admin
    .from("email_events")
    .select("id, metadata, status")
    .eq("resend_email_id", resendEmailId)
    .maybeSingle();

  if (fetchError || !existing) return;

  const mergedMetadata = {
    ...(existing.metadata as Record<string, unknown> | null ?? {}),
    ...(patch.metadata ?? {}),
  };

  const { error } = await admin
    .from("email_events")
    .update({
      status: patch.status ?? existing.status,
      metadata: mergedMetadata,
    })
    .eq("id", existing.id);

  if (error) console.error("updateEmailEventByResendId failed", error.message);
}
