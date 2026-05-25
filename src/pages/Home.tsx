import React from 'react';
import { useAuth } from '../hooks/useAuth';
import OperationsDashboard from './OperationsDashboard';
import MarketingHome from './MarketingHome';

const Home: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="text-center py-16 text-white">
        <p>Loading…</p>
      </div>
    );
  }

  if (user) {
    return <OperationsDashboard />;
  }

  return <MarketingHome />;
};

export default Home;
