import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import MarketingHome from './MarketingHome';
import RouteFallback from '../routes/RouteFallback';

const OperationsDashboard = lazy(() => import('./OperationsDashboard'));

const Home: React.FC = () => {
  const { user, loading, profileLoading, isEmployee } = useAuth();

  if (loading || (user && profileLoading)) {
    return <RouteFallback />;
  }

  if (!user) return <MarketingHome />;
  if (isEmployee) return <Navigate to="/employee/dashboard" replace />;
  return (
    <Suspense fallback={<RouteFallback />}>
      <OperationsDashboard />
    </Suspense>
  );
};

export default Home;
