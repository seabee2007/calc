import React from 'react';
import { useAuth } from '../hooks/useAuth';
import OperationsDashboard from './OperationsDashboard';
import MarketingHome from './MarketingHome';

const Home: React.FC = () => {
  const { user } = useAuth();
  return user ? <OperationsDashboard /> : <MarketingHome />;
};

export default Home;
