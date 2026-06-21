import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAppAccess } from '../contexts/AppAccessContext';
import RouteFallback from '../routes/RouteFallback';
import AccessLoadingSurface from '../components/routing/AccessLoadingSurface';
import { AccessRedirect } from '../components/routing/AccessRedirect';
import { isOwnerAppAccess } from '../lib/appAccessRouting';

const OperationsDashboard = lazy(() => import('./OperationsDashboard'));

/** Owner workspace dashboard — only rendered at `/dashboard` behind OwnerGuard. */
const Home: React.FC = () => {
  const { user, loading, profileLoading } = useAuth();
  const { access, accessResolutionState, authSessionResolved } = useAppAccess();
  const location = useLocation();

  if (loading || !authSessionResolved || (user && profileLoading)) {
    return <AccessLoadingSurface />;
  }

  if (accessResolutionState === 'loading' || accessResolutionState === 'idle') {
    return <AccessLoadingSurface />;
  }

  if (accessResolutionState !== 'resolved' || !access) {
    return <AccessLoadingSurface />;
  }

  if (!isOwnerAppAccess(access)) {
    return (
      <AccessRedirect
        to={access.defaultRoute}
        reason="dashboard-non-owner-default-route"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  if (location.pathname !== '/dashboard') {
    return (
      <AccessRedirect
        to="/dashboard"
        reason="home-owner-canonical-dashboard"
        authSessionResolved={authSessionResolved}
        accessResolutionState={accessResolutionState}
      />
    );
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <OperationsDashboard />
    </Suspense>
  );
};

export default Home;
