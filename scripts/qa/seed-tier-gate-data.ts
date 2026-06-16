import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CURRENT_ONBOARDING_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  MANIFEST_PATH,
  QA_SEED_ID,
  QA_TEST_PASSWORD,
  QA_USER_SPECS,
  type QaManifest,
} from './shared/constants';
import { assertSafeQaEnvironment } from './shared/envSafety';
import { createQaAdminClient, tryInsert } from './shared/supabaseAdmin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function projectPrefix(plan: string): string {
  switch (plan) {
    case 'free':
      return 'QA FREE';
    case 'starter':
      return 'QA STARTER';
    case 'professional':
      return 'QA PRO';
    case 'business':
      return 'QA BIZ';
    default:
      return 'QA';
  }
}

async function ensureAuthUser(admin: SupabaseClient, email: string): Promise<string> {
  const { data: listData, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;

  const existing = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing?.id) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: QA_TEST_PASSWORD,
      email_confirm: true,
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: QA_TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { qa_seed_id: QA_SEED_ID },
  });
  if (error || !data.user?.id) {
    throw error ?? new Error(`Failed creating auth user ${email}`);
  }
  return data.user.id;
}

async function upsertProfile(admin: SupabaseClient, userId: string, email: string): Promise<void> {
  const now = new Date().toISOString();
  const localPart = email.split('@')[0] ?? 'qa';
  const { error } = await admin.from('profiles').upsert(
    {
      id: userId,
      role: 'owner',
      display_name: localPart,
      first_name: localPart,
      last_name: 'Tester',
      agreement_accepted_at: now,
      agreement_version: CURRENT_TERMS_VERSION,
      onboarding_completed_at: now,
      onboarding_version: CURRENT_ONBOARDING_VERSION,
      updated_at: now,
    },
    { onConflict: 'id' },
  );
  if (error) throw new Error(`profiles upsert failed: ${error.message}`);
}

async function upsertUserPreferences(admin: SupabaseClient, userId: string): Promise<void> {
  const { error } = await admin.from('user_preferences').upsert(
    { user_id: userId },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`user_preferences upsert failed: ${error.message}`);
}

async function upsertCompanySettings(admin: SupabaseClient, userId: string, email: string): Promise<void> {
  const prefix = email.split('@')[0] ?? 'QA';
  const { error } = await admin.from('company_settings').upsert(
    {
      user_id: userId,
      company_name: `${prefix} QA Company`,
      email,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`company_settings upsert failed: ${error.message}`);
}

async function upsertLegalAcceptance(admin: SupabaseClient, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin.from('user_legal_acceptances').upsert(
    {
      user_id: userId,
      terms_version: CURRENT_TERMS_VERSION,
      privacy_version: CURRENT_PRIVACY_VERSION,
      terms_accepted_at: now,
      privacy_accepted_at: now,
    },
    { onConflict: 'user_id,terms_version,privacy_version' },
  );
  if (error) {
    if (error.message.includes('does not exist')) {
      console.log('Skipped user_legal_acceptances: table not found');
      return;
    }
    throw new Error(`user_legal_acceptances upsert failed: ${error.message}`);
  }
}

async function upsertSubscription(
  admin: SupabaseClient,
  userId: string,
  subscription: (typeof QA_USER_SPECS)[number]['subscription'],
): Promise<void> {
  if (!subscription) {
    await admin.from('subscriptions').delete().eq('user_id', userId);
    return;
  }

  const now = new Date().toISOString();
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      plan_id: subscription.plan_id,
      status: subscription.status,
      stripe_subscription_id: subscription.stripe_subscription_id,
      stripe_customer_id: subscription.stripe_customer_id,
      current_period_start: now,
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: now,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

async function createProject(
  admin: SupabaseClient,
  userId: string,
  name: string,
  description: string,
): Promise<string | null> {
  const row = await tryInsert(admin, 'projects', {
    user_id: userId,
    name,
    description,
  });
  return row?.id ?? null;
}

async function seedEmployeeInvites(
  admin: SupabaseClient,
  employerId: string,
  count: number,
): Promise<void> {
  for (let i = 1; i <= count; i += 1) {
    await tryInsert(admin, 'employee_invites', {
      employer_id: employerId,
      email: `qa-invite-${employerId.slice(0, 8)}-${i}@arden.test`,
      role: 'employee',
    });
  }
}

async function seedProposal(admin: SupabaseClient, userId: string): Promise<void> {
  await tryInsert(admin, 'proposals', {
    user_id: userId,
    title: 'QA Tier Gate Proposal',
    template_type: 'classic',
    data: { qa_seed_id: QA_SEED_ID, sections: [] },
  });
}

async function seedProfessionalData(
  admin: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<void> {
  const estimate = await tryInsert(admin, 'estimates', {
    project_id: projectId,
    name: 'QA PRO Estimate',
    status: 'draft',
    created_by: userId,
  });
  if (estimate?.id) {
    await tryInsert(admin, 'estimate_versions', {
      estimate_id: estimate.id,
      project_id: projectId,
      version_number: 1,
      version_name: 'Version 1',
      estimate_type: 'detailed',
      status: 'draft',
      snapshot: { qa_seed_id: QA_SEED_ID },
      totals: {},
      created_by: userId,
    });
  }

  await tryInsert(admin, 'rfi_requests', {
    project_id: projectId,
    submitted_by: userId,
    title: 'QA RFI',
    question: 'Tier gate seed RFI question',
  });

  await tryInsert(admin, 'field_adjustment_requests', {
    project_id: projectId,
    submitted_by: userId,
    title: 'QA FAR',
    description: 'Tier gate seed field adjustment request',
  });

  await tryInsert(admin, 'qc_records', {
    project_id: projectId,
    date: new Date().toISOString().slice(0, 10),
    temperature: 72,
    humidity: 45,
    slump: 4,
    air_content: 6,
    cylinders_made: 2,
    notes: 'QA tier gate QC record',
  });

  await tryInsert(admin, 'change_orders', {
    project_id: projectId,
    user_id: userId,
    title: 'QA Change Order',
    scope_description: 'Tier gate seed change order',
    reason_for_change: 'QA harness',
    terms: 'Net 30',
    document_json: { qa_seed_id: QA_SEED_ID },
  });

  const board = await tryInsert(admin, 'planner_boards', {
    project_id: projectId,
    owner_id: userId,
    title: 'QA Planner Board',
  });
  if (board?.id) {
    const bucket = await tryInsert(admin, 'planner_buckets', {
      board_id: board.id,
      title: 'To Do',
      position: 0,
    });
    if (bucket?.id) {
      await tryInsert(admin, 'planner_tasks', {
        board_id: board.id,
        bucket_id: bucket.id,
        project_id: projectId,
        title: 'QA Planner Task',
        created_by: userId,
      });
    }
  }

  await tryInsert(admin, 'client_portals', {
    project_id: projectId,
    contractor_user_id: userId,
    client_name: 'QA Client',
    client_email: 'qa-client@arden.test',
    token: `qa-portal-${projectId.slice(0, 8)}`,
    is_active: true,
  });
}

async function seedBusinessData(admin: SupabaseClient, userId: string, projectId: string): Promise<void> {
  await tryInsert(admin, 'contract_documents', {
    project_id: projectId,
    user_id: userId,
    document_type: 'daily_report',
    title: 'QA Daily Report',
    status: 'draft',
    pack_key: 'GENERIC_RESIDENTIAL',
  });
}

async function seedUser(admin: SupabaseClient, spec: (typeof QA_USER_SPECS)[number]): Promise<QaManifest['users'][string]> {
  const userId = await ensureAuthUser(admin, spec.email);
  await upsertProfile(admin, userId, spec.email);
  await upsertUserPreferences(admin, userId);
  await upsertCompanySettings(admin, userId, spec.email);
  await upsertLegalAcceptance(admin, userId);
  await upsertSubscription(admin, userId, spec.subscription);

  const prefix = projectPrefix(spec.plan);
  const projectIds: string[] = [];

  for (let i = 1; i <= spec.activeProjectCount; i += 1) {
    const id = await createProject(
      admin,
      userId,
      `${prefix} Project ${String(i).padStart(3, '0')}`,
      `Active QA seed project ${i} (${QA_SEED_ID})`,
    );
    if (id) projectIds.push(id);
  }

  for (let i = 1; i <= spec.archivedProjectCount; i += 1) {
    const id = await createProject(
      admin,
      userId,
      `${prefix} Project ARCHIVED ${String(i).padStart(3, '0')}`,
      `Archived QA seed project ${i} (${QA_SEED_ID})`,
    );
    if (id) projectIds.push(id);
  }

  if (spec.inviteCount > 0) {
    await seedEmployeeInvites(admin, userId, spec.inviteCount);
  }

  if (spec.plan !== 'free') {
    await seedProposal(admin, userId);
  }

  const primaryProjectId = projectIds[0] ?? null;
  if (spec.seedProData && primaryProjectId) {
    await seedProfessionalData(admin, userId, primaryProjectId);
  }
  if (spec.seedBizData && primaryProjectId) {
    await seedBusinessData(admin, userId, primaryProjectId);
  }

  console.log(`Seeded ${spec.email} (${spec.plan}) — ${projectIds.length} projects`);

  return {
    id: userId,
    email: spec.email,
    plan: spec.plan,
    projectIds,
    primaryProjectId,
  };
}

async function main(): Promise<void> {
  await assertSafeQaEnvironment();
  const admin = createQaAdminClient();

  const manifest: QaManifest = {
    seedId: QA_SEED_ID,
    createdAt: new Date().toISOString(),
    users: {},
  };

  for (const spec of QA_USER_SPECS) {
    manifest.users[spec.email] = await seedUser(admin, spec);
  }

  const manifestFile = fileURLToPath(MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestFile), { recursive: true });
  await fs.writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('\nTier gate QA seed complete.');
  console.log(`Manifest: ${manifestFile}`);
  console.log('Users:');
  for (const spec of QA_USER_SPECS) {
    console.log(`  - ${spec.email} / ${QA_TEST_PASSWORD}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
