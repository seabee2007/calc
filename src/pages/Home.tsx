import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import OperationsDashboard from './OperationsDashboard';
import MarketingHome from './MarketingHome';

const Home: React.FC = () => {
  const { user, loading, profileLoading, isEmployee } = useAuth();

  if (loading || (user && profileLoading)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return <MarketingHome />;
  if (isEmployee) return <Navigate to="/employee/dashboard" replace />;
  return <OperationsDashboard />;
};

export default Home;
