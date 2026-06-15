import React from 'react';
import EmployeeDashboard from '../../components/employee/EmployeeDashboard';
import { useEmployeePageTitle } from '../../components/employee/EmployeePageTitleContext';

export default function EmployeeDashboardPage() {
  useEmployeePageTitle('Dashboard');
  return <EmployeeDashboard />;
}
