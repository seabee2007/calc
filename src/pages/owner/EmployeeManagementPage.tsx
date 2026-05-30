import React from 'react';
import EmployeeManagement from '../../components/owner/EmployeeManagement';
import { CC_PAGE_TITLE_MD } from '../../theme/pageTypography';

export default function EmployeeManagementPage() {
  return (
    <div className="mx-auto max-w-4xl py-6 pb-24 md:pb-8">
      <h1 className={`${CC_PAGE_TITLE_MD} mb-6`}>Team & employees</h1>
      <EmployeeManagement />
    </div>
  );
}
