import { useMemo } from 'react';
import { useProjects } from './useProjects';
import LaborEstimateDetails from '../../components/projects/LaborEstimateDetails';

export default function LaborSection() {
  const { currentProject, handlers } = useProjects();

  const latestConcrete = useMemo(() => {
    if (!currentProject?.calculations?.length) return undefined;
    return [...currentProject.calculations]
      .filter((c) => (c.result?.volume ?? 0) > 0)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];
  }, [currentProject?.calculations]);

  if (!currentProject) return null;

  const estimate = currentProject.laborEstimates?.[0];

  return (
    <div className="mt-8">
      <LaborEstimateDetails
        estimate={estimate}
        latestCalculation={latestConcrete}
        onOpenCalculator={() =>
          handlers.navigateToLaborCalculator(currentProject.id)
        }
      />
    </div>
  );
}
