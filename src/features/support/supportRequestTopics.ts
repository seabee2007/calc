export type SupportRequestTopicId =
  | 'billing'
  | 'login'
  | 'project_setup'
  | 'estimate_proposal'
  | 'scheduling_planner'
  | 'file_import_export'
  | 'client_portal'
  | 'bug_report'
  | 'feature_request'
  | 'data_issue'
  | 'other';

export interface SupportRequestTopicOption {
  id: SupportRequestTopicId;
  label: string;
  defaultSubject: string;
  templateKind: 'default' | 'bug' | 'feature' | 'billing';
  requiresCustomSubject: boolean;
}

export const SUPPORT_REQUEST_TOPIC_OPTIONS: readonly SupportRequestTopicOption[] = [
  {
    id: 'billing',
    label: 'Billing or subscription',
    defaultSubject: 'Billing or subscription support',
    templateKind: 'billing',
    requiresCustomSubject: false,
  },
  {
    id: 'login',
    label: 'Login or account access',
    defaultSubject: 'Login or account access issue',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'project_setup',
    label: 'Project setup',
    defaultSubject: 'Project setup question',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'estimate_proposal',
    label: 'Estimate or proposal issue',
    defaultSubject: 'Estimate or proposal support',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'scheduling_planner',
    label: 'Scheduling or Planner Hub',
    defaultSubject: 'Scheduling or Planner Hub support',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'file_import_export',
    label: 'File import or export',
    defaultSubject: 'File import/export support',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'client_portal',
    label: 'Client portal',
    defaultSubject: 'Client portal support',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'bug_report',
    label: 'Bug report',
    defaultSubject: 'Bug report',
    templateKind: 'bug',
    requiresCustomSubject: false,
  },
  {
    id: 'feature_request',
    label: 'Feature request',
    defaultSubject: 'Feature request',
    templateKind: 'feature',
    requiresCustomSubject: false,
  },
  {
    id: 'data_issue',
    label: 'Data issue',
    defaultSubject: 'Data issue',
    templateKind: 'default',
    requiresCustomSubject: false,
  },
  {
    id: 'other',
    label: 'Other / Not listed',
    defaultSubject: '',
    templateKind: 'default',
    requiresCustomSubject: true,
  },
] as const;

export interface SupportTemplateContext {
  userEmail: string;
  browserInfo: string;
  planName?: string | null;
}

export function getSupportTopicOption(topicId: SupportRequestTopicId): SupportRequestTopicOption {
  return (
    SUPPORT_REQUEST_TOPIC_OPTIONS.find((option) => option.id === topicId) ??
    SUPPORT_REQUEST_TOPIC_OPTIONS[SUPPORT_REQUEST_TOPIC_OPTIONS.length - 1]!
  );
}

export function getDefaultSubjectForTopic(topicId: SupportRequestTopicId): string {
  return getSupportTopicOption(topicId).defaultSubject;
}

export function topicRequiresCustomSubject(topicId: SupportRequestTopicId): boolean {
  return getSupportTopicOption(topicId).requiresCustomSubject;
}

export function getBrowserInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown browser';
  return navigator.userAgent.slice(0, 500);
}

function defaultTemplate(ctx: SupportTemplateContext): string {
  return `Hello Arden Support,

I need help with:

[Describe what happened or what you need help with]

Page or feature:
[Example: Billing, Estimate Workspace, Planner Hub, Client Portal]

Steps I took:
1.
2.
3.

Expected result:
[What you expected to happen]

Actual result:
[What actually happened]

Error message, if any:
[Paste error message here]

Account email:
${ctx.userEmail}

Project name or ID, if applicable:
[Project name or ID]

Device/browser:
${ctx.browserInfo}

Thank you.`;
}

function bugTemplate(ctx: SupportTemplateContext): string {
  return `Hello Arden Support,

I found a bug.

What happened:
[Describe the issue]

Where it happened:
[Page, feature, or workflow]

Steps to reproduce:
1.
2.
3.

Expected result:
[What should have happened]

Actual result:
[What happened instead]

Error message, if any:
[Paste error here]

Account email:
${ctx.userEmail}

Device/browser:
${ctx.browserInfo}

Thank you.`;
}

function featureTemplate(ctx: SupportTemplateContext): string {
  return `Hello Arden Support,

I have a feature request.

Feature idea:
[Describe the feature]

Why it would help:
[Explain the problem it solves]

Where it should appear:
[Example: Estimates, Planner Hub, Dashboard, Client Portal]

Account email:
${ctx.userEmail}

Thank you.`;
}

function billingTemplate(ctx: SupportTemplateContext): string {
  const planLine = ctx.planName?.trim()
    ? ctx.planName.trim()
    : '[Your current plan]';

  return `Hello Arden Support,

I need help with billing or my subscription.

Issue:
[Describe the billing question or issue]

Current plan:
${planLine}

Account email:
${ctx.userEmail}

Stripe/customer reference if visible:
[Optional]

Thank you.`;
}

export function buildSupportMessageTemplate(
  topicId: SupportRequestTopicId,
  ctx: SupportTemplateContext,
): string {
  const kind = getSupportTopicOption(topicId).templateKind;
  if (kind === 'bug') return bugTemplate(ctx);
  if (kind === 'feature') return featureTemplate(ctx);
  if (kind === 'billing') return billingTemplate(ctx);
  return defaultTemplate(ctx);
}

export interface SupportTopicDefaults {
  topicId: SupportRequestTopicId;
  subject: string;
  message: string;
}

export function buildSupportTopicDefaults(
  topicId: SupportRequestTopicId,
  ctx: SupportTemplateContext,
): SupportTopicDefaults {
  return {
    topicId,
    subject: getDefaultSubjectForTopic(topicId),
    message: buildSupportMessageTemplate(topicId, ctx),
  };
}
