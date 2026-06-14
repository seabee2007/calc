import React from 'react';
import { motion } from 'framer-motion';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';
import EmployeeManagement from '../../components/owner/EmployeeManagement';

export default function EmployeeManagementPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <AppPage
        data-testid="team-employees-page"
        header={
          <PageHeader
            title="Team & Employees"
            subtitle="Invite employees, manage roles, and assign team members to active projects."
          />
        }
      >
        <EmployeeManagement />
      </AppPage>
    </motion.div>
  );
}
