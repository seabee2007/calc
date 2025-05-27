import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Projects from './pages/Projects';
import Resources from './pages/Resources';
import MixDesigns from './pages/resources/MixDesigns';
import WeatherEffects from './pages/resources/WeatherEffects';
import Reinforcement from './pages/resources/Reinforcement';
import MixDesignAdvisor from './pages/MixDesignAdvisor';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ResetPassword from './pages/auth/ResetPassword';
import AuthGuard from './components/auth/AuthGuard';
import { useProjectStore } from './store';
import ConcreteChat from "./components/ConcreteChat";

function App() {
  const { loadProjects } = useProjectStore();

  useEffect(() => {
    loadProjects().catch(console.error);
  }, [loadProjects]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route
            path="calculator"
            element={
              <AuthGuard>
                <Calculator />
              </AuthGuard>
            }
          />
          <Route
            path="projects"
            element={
              <AuthGuard>
                <Projects />
              </AuthGuard>
            }
          />
          <Route
            path="mix-design-advisor"
            element={
              <AuthGuard>
                <MixDesignAdvisor />
              </AuthGuard>
            }
          />
          <Route path="resources" element={<Resources />} />
          <Route path="resources/mix-designs" element={<MixDesigns />} />
          <Route path="resources/weather-effects" element={<WeatherEffects />} />
          <Route path="resources/reinforcement" element={<Reinforcement />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/\" replace />} />
      </Routes>

      {/* Chat widget overlay, available on every page */}
      <ConcreteChat />
    </BrowserRouter>
  );
}

export default App;