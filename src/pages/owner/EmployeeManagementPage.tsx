import React from 'react';
import EmployeeManagement from '../../components/owner/EmployeeManagement';

export default function EmployeeManagementPage() {
  return (
    <div className="mx-auto max-w-4xl py-6 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold text-black dark:text-black mb-6 drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">Team & employees</h1>
      <EmployeeManagement />
    </div>
  );
}
