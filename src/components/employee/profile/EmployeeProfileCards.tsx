import React from 'react';

export function EmployeeProfileSection({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
      data-testid={testId}
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function EmployeeProfileField({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value || '—'}</dd>
    </div>
  );
}

export function EmployeeProfileHeader({
  initials,
  fullName,
  jobTitle,
  companyName,
  roleLabel,
}: {
  initials: string;
  fullName: string;
  jobTitle: string | null;
  companyName: string;
  roleLabel: string;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-950 p-4"
      data-testid="employee-profile-header"
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-lg font-semibold text-cyan-300"
        aria-hidden
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-semibold text-white">{fullName}</h1>
        {jobTitle ? <p className="mt-0.5 text-sm text-slate-400">{jobTitle}</p> : null}
        {companyName ? <p className="mt-1 text-sm text-slate-300">{companyName}</p> : null}
        <span className="mt-2 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

export function EmployeeCompanyStrip({
  companyName,
  phone,
  logoUrl,
}: {
  companyName: string;
  phone: string;
  logoUrl: string | null;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3"
      data-testid="employee-company-strip"
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-semibold text-slate-400">
          {companyName.charAt(0).toUpperCase() || 'C'}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{companyName || 'Your company'}</p>
        {phone ? <p className="truncate text-xs text-slate-400">{phone}</p> : null}
      </div>
    </div>
  );
}
