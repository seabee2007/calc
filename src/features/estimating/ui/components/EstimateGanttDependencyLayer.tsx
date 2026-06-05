import type { GanttDependencyConnector } from '../estimateGanttDependenciesDisplay';

interface Props {
  connectors: GanttDependencyConnector[];
  width: number;
  height: number;
}

export default function EstimateGanttDependencyLayer({
  connectors,
  width,
  height,
}: Props) {
  if (connectors.length === 0 || width <= 0 || height <= 0) return null;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
      width={width}
      height={height}
      aria-hidden
    >
      {connectors.map((connector) => (
        <path
          key={connector.id}
          d={connector.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-400/60 dark:text-slate-500/60"
        >
          <title>{connector.tooltip}</title>
        </path>
      ))}
    </svg>
  );
}
