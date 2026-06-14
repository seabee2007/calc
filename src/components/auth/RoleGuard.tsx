import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE,
} from '../../pages/auth/postAuthRouting';
import type { UserRole } from '../../types/fieldPlanner';
import { isEmployeeRole, isOwnerRole } from '../../types/fieldPlanner';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackTo?: string;
}

export default function RoleGuard({
  children,
  allowedRoles,
  fallbackTo = '/',
}: RoleGuardProps) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile?.role) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ message: FIELD_PORTAL_ACCESS_VERIFY_FAILED_MESSAGE }}
      />
    );
  }

  const role = profile.role;
  if (!allowedRoles.includes(role)) {
    if (isEmployeeRole(role)) {
      return <Navigate to="/employee/dashboard" replace />;
    }
    if (isOwnerRole(role)) {
      return <Navigate to={fallbackTo} replace />;
    }
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}

export function OwnerGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowedRoles={['owner', 'admin']} fallbackTo="/employee/dashboard">
      {children}
    </RoleGuard>
  );
}

export function EmployeeGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard
      allowedRoles={['employee', 'foreman', 'project_manager']}
      fallbackTo="/"
    >
      {children}
    </RoleGuard>
  );
}
