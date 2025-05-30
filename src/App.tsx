import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Projects from './pages/Projects';
import Resources from './pages/Resources';
import MixDesigns from './pages/resources/MixDesigns';
import WeatherEffects from './pages/resources/WeatherEffects';
import Reinforcement from './pages/resources/Reinforcement';
import ProperFinishing from './pages/resources/ProperFinishing';
import CommonProblems from './pages/resources/CommonProblems';
import Admixtures from './pages/resources/Admixtures';
import ExternalResources from './pages/resources/ExternalResources';
import MixDesignAdvisor from './pages/MixDesignAdvisor';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ResetPassword from './pages/auth/ResetPassword';
import AuthGuard from './components/auth/AuthGuard';
import { useProjectStore } from './store';
import ConcreteChat from "./components/ConcreteChat";

export const useChatStore = () => {
  const [isVisible, setIsVisible] = React.useState(true);
  return { isVisible, setIsVisible };
};

function App() {
  const { loadProjects } = useProjectStore();
  const chatStore = useChatStore();
  const { isDark } = useThemeStore();

  useEffect(() => {
    loadProjects().catch(console.error);
  }, [loadProjects]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

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
          <Route path="resources" element={<Resources chatStore={chatStore} />} />
          <Route path="resources/mix-designs" element={<MixDesigns />} />
          <Route path="resources/weather-effects" element={<WeatherEffects />} />
          <Route path="resources/reinforcement" element={<Reinforcement />} />
          <Route path="resources/proper-finishing" element={<ProperFinishing />} />
          <Route path="resources/common-problems" element={<CommonProblems />} />
          <Route path="resources/admixtures" element={<Admixtures />} />
          <Route path="resources/external-resources" element={<ExternalResources />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/\" replace />} />
      </Routes>

      {chatStore.isVisible && (
        <div className="fixed bottom-4 right-4 z-50">
          <ConcreteChat />
        </div>
      )}
    </BrowserRouter>
  );
}

export default App;