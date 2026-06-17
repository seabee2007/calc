export function EstimateGuideContent() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-base font-semibold text-white">How to Fill Out This Estimate</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          A conceptual estimate captures the big picture before detailed pricing. Work through these
          steps to build a clear, defensible budget your team can refine later.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Steps</h4>
        <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-slate-300">
          <li>
            <span className="font-medium text-slate-100">Name your estimate.</span> Replace the
            default title with something specific to this project or revision so you can find it
            later.
          </li>
          <li>
            <span className="font-medium text-slate-100">Describe the scope.</span> Use the basis of
            estimate field to explain what is included, the design stage, and any major assumptions
            behind the numbers.
          </li>
          <li>
            <span className="font-medium text-slate-100">Add supporting detail.</span> Enter at least
            one line item, assumption, exclusion, or allowance note so the budget reflects real project
            context—not just a placeholder total.
          </li>
          <li>
            <span className="font-medium text-slate-100">Review scenarios and risks.</span> Compare
            alternate scenarios and note contingency drivers once the core estimate is in place.
          </li>
          <li>
            <span className="font-medium text-slate-100">Save when you are ready.</span> Use Quick
            Actions to save, duplicate, export, generate, or move the estimate forward after the
            details above are filled in.
          </li>
        </ol>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-950/50 p-4">
        <h4 className="text-sm font-semibold text-white">Quick Actions</h4>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Use Quick Actions when you want to save, duplicate, export, generate, or move the estimate
          forward. Start by filling out the estimate details first, then use Quick Actions when you are
          ready to act on the estimate.
        </p>
      </section>

      <section>
        <h4 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Tips</h4>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-300">
          <li>Keep assumptions and exclusions visible so stakeholders understand what the total includes.</li>
          <li>Update the basis of estimate whenever scope or design stage changes.</li>
          <li>Use the Definitions tab to look up unfamiliar estimating terms while you work.</li>
        </ul>
      </section>
    </div>
  );
}
