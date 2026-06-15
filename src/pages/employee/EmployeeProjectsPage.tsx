import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import EmployeeProjectCard from '../../components/employee/EmployeeProjectCard';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

export default function EmployeeProjectsPage() {
  useEmployeePageTitle('Projects');
  const { user } = useAuth();
  const [projects, setProjects] = useState<
    { id: string; name: string; jobsite_city?: string; jobsite_state?: string }[]
  >([]);

  useEffect(() => {
    if (!user) return;
    void fetchAssignedProjects(user.id).then(setProjects);
  }, [user]);

  return (
    <div>
      <div className="space-y-2">
        {projects.map((p) => (
          <EmployeeProjectCard
            key={p.id}
            id={p.id}
            name={p.name}
            city={p.jobsite_city}
            state={p.jobsite_state}
          />
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-slate-500">No projects assigned.</p>
        )}
      </div>
    </div>
  );
}
