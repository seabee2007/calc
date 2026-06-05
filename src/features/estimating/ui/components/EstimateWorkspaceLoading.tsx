export default function EstimateWorkspaceLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent dark:border-cyan-400"
        role="status"
        aria-label="Loading estimate workspace"
      />
    </div>
  );
}
