import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANIFEST_PATH,
  QA_USER_SPECS,
  type QaManifest,
} from './shared/constants';
import { assertSafeQaEnvironment } from './shared/envSafety';
import {
  createQaAdminClient,
  deleteWhereIn,
  deleteWhereUserIds,
} from './shared/supabaseAdmin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readManifest(): Promise<QaManifest | null> {
  const manifestFile = fileURLToPath(MANIFEST_PATH);
  try {
    const raw = await fs.readFile(manifestFile, 'utf8');
    return JSON.parse(raw) as QaManifest;
  } catch {
    console.warn('No QA manifest found — falling back to configured QA emails.');
    return null;
  }
}

async function main(): Promise<void> {
  await assertSafeQaEnvironment();
  const admin = createQaAdminClient();
  const manifest = await readManifest();

  const userIds = manifest
    ? Object.values(manifest.users).map((u) => u.id)
    : [];

  if (userIds.length === 0) {
    for (const email of QA_USER_SPECS.map((s) => s.email)) {
      const { data, error } = await admin.auth.admin.listUsers();
      if (error) throw error;
      const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (match?.id) userIds.push(match.id);
    }
  }

  if (userIds.length === 0) {
    console.log('No QA users to clean up.');
    return;
  }

  const projectIds = manifest
    ? Object.values(manifest.users).flatMap((u) => u.projectIds)
    : [];

  if (projectIds.length > 0) {
    const { data: boards } = await admin
      .from('planner_boards')
      .select('id')
      .in('project_id', projectIds);
    const boardIds = boards?.map((b) => b.id as string) ?? [];

    await deleteWhereIn(admin, 'estimate_line_items', 'project_id', projectIds);
    await deleteWhereIn(admin, 'estimate_versions', 'project_id', projectIds);
    await deleteWhereIn(admin, 'estimates', 'project_id', projectIds);
    await deleteWhereIn(admin, 'change_orders', 'project_id', projectIds);
    await deleteWhereIn(admin, 'qc_records', 'project_id', projectIds);
    await deleteWhereIn(admin, 'rfi_requests', 'project_id', projectIds);
    await deleteWhereIn(admin, 'field_adjustment_requests', 'project_id', projectIds);
    await deleteWhereIn(admin, 'planner_tasks', 'project_id', projectIds);
    if (boardIds.length > 0) {
      await deleteWhereIn(admin, 'planner_buckets', 'board_id', boardIds);
    }
    await deleteWhereIn(admin, 'planner_boards', 'project_id', projectIds);
    await deleteWhereIn(admin, 'client_portals', 'project_id', projectIds);
    await deleteWhereIn(admin, 'contract_documents', 'project_id', projectIds);
    await deleteWhereIn(admin, 'calculations', 'project_id', projectIds);
    await deleteWhereIn(admin, 'projects', 'id', projectIds);
  } else {
    for (const userId of userIds) {
      const { data: projects } = await admin
        .from('projects')
        .select('id,name')
        .eq('user_id', userId);
      const qaProjectIds =
        projects
          ?.filter((p) => typeof p.name === 'string' && p.name.startsWith('QA '))
          .map((p) => p.id as string) ?? [];
      if (qaProjectIds.length > 0) {
        await deleteWhereIn(admin, 'projects', 'id', qaProjectIds);
      }
    }
  }

  await deleteWhereUserIds(admin, 'employee_invites', 'employer_id', userIds);
  await deleteWhereUserIds(admin, 'proposals', 'user_id', userIds);
  await deleteWhereUserIds(admin, 'subscriptions', 'user_id', userIds);
  await deleteWhereUserIds(admin, 'user_legal_acceptances', 'user_id', userIds);
  await deleteWhereUserIds(admin, 'user_preferences', 'user_id', userIds);
  await deleteWhereUserIds(admin, 'company_settings', 'user_id', userIds);
  await deleteWhereUserIds(admin, 'profiles', 'id', userIds);

  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`Could not delete auth user ${userId}: ${error.message}`);
    }
  }

  const manifestFile = fileURLToPath(MANIFEST_PATH);
  try {
    await fs.unlink(manifestFile);
  } catch {
    // ignore
  }

  console.log(`Cleaned up ${userIds.length} QA tier-gate users.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
