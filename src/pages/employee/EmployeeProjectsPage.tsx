import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { fetchAssignedProjects } from '../../services/employeeService';
import EmployeeProjectCard from '../../components/employee/EmployeeProjectCard';

export default function EmployeeProjectsPage() {
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
      <h1 className="text-xl font-bold text-white mb-4">My projects</h1>
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
