import React, { useEffect, useState, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Resources from './pages/Resources';
import MixDesigns from './pages/resources/MixDesigns';
import WeatherEffects from './pages/resources/WeatherEffects';
import Reinforcement from './pages/resources/Reinforcement';
import ProperFinishing from './pages/resources/ProperFinishing';
import CommonProblems from './pages/resources/CommonProblems';
import Admixtures from './pages/resources/Admixtures';
import ExternalResources from './pages/resources/ExternalResources';
import MixDesignAdvisor from './pages/MixDesignAdvisor';
import ProposalGenerator from './pages/ProposalGenerator';
import Proposals from './pages/Proposals';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ResetPassword from './pages/auth/ResetPassword';
import AuthGuard from './components/auth/AuthGuard';
import OnboardingFlow from './components/onboarding/OnboardingFlow';
import { useProjectStore, useSettingsStore, usePreferencesStore } from './store';
import { useAuth } from './hooks/useAuth';
import ConcreteChat from "./components/ConcreteChat";
import { soundService } from './services/soundService';

// Error boundary component
class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const useChatStore = () => {
  const [isVisible, setIsVisible] = React.useState(true);
  return { isVisible, setIsVisible };
};

function App() {
  const { user, loading: authLoading } = useAuth();
  const { loadProjects } = useProjectStore();
  const { loadCompanySettings, migrateSettings } = useSettingsStore();
  const { loadPreferences, migratePreferences } = usePreferencesStore();
  const chatStore = useChatStore();
  const { isDark } = useThemeStore();
  const location = useLocation();
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if we're in a Capacitor WebView
  const isCapacitorWebView = 'Capacitor' in window;

  // Initialize app state
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize sound service first
        await soundService.initialize();
        
        if (user && !authLoading) {
          // Load all user data in parallel
          await Promise.all([
            loadProjects().catch(e => console.error('Error loading projects:', e)),
            loadCompanySettings().catch(e => console.error('Error loading settings:', e)),
            loadPreferences().catch(e => console.error('Error loading preferences:', e))
          ]);
          
          // Only attempt migrations in web environment
          if (!isCapacitorWebView) {
            await Promise.all([
              migrateSettings().catch(e => console.error('Error migrating settings:', e)),
              migratePreferences().catch(e => console.error('Error migrating preferences:', e))
            ]);
          }
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setInitError('Failed to initialize app. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [user, authLoading, isCapacitorWebView]);

  // Check if onboarding should be shown
  useEffect(() => {
    const checkOnboarding = () => {
      try {
        if (user && !authLoading) {
          const isTestOnboarding = location.pathname === '/test-onboarding';
          
          // For mobile, we'll use a different storage mechanism
          let onboardingCompleted = false;
          
          if (isCapacitorWebView) {
            // In WebView, default to completed unless explicitly testing
            onboardingCompleted = !isTestOnboarding;
          } else {
            try {
              onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
            } catch (e) {
              console.warn('Error reading onboarding status:', e);
              onboardingCompleted = true; // Fail safe
            }
          }
          
          setShowOnboarding(!onboardingCompleted || isTestOnboarding);
          setOnboardingChecked(true);
        } else if (!user && !authLoading) {
          setOnboardingChecked(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setOnboardingChecked(true);
        setShowOnboarding(false);
      }
    };
    
    checkOnboarding();
  }, [user, authLoading, location.pathname, isCapacitorWebView]);

  // Handle theme changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleOnboardingComplete = () => {
    try {
      setShowOnboarding(false);
      if (!isCapacitorWebView) {
        localStorage.setItem('onboarding_completed', 'true');
      }
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
      // Even if storage fails, we can proceed
      setShowOnboarding(false);
    }
  };

  // Show error state
  if (initError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">{initError}</h1>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (!onboardingChecked || authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Show onboarding for new users
  if ((showOnboarding && user) || location.pathname === '/test-onboarding') {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <OnboardingFlow onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return (
    <AppErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
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
            <Route
              path="proposal-generator"
              element={
                <AuthGuard>
                  <ProposalGenerator />
                </AuthGuard>
              }
            />
            <Route
              path="proposals"
              element={
                <AuthGuard>
                  <Proposals />
                </AuthGuard>
              }
            />
            <Route
              path="settings"
              element={
                <AuthGuard>
                  <Settings />
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
          <Route path="/test-onboarding" element={<OnboardingFlow onComplete={handleOnboardingComplete} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {chatStore.isVisible && (
          <div className="fixed bottom-4 right-4 z-50">
            <ConcreteChat />
          </div>
        )}
      </Suspense>
    </AppErrorBoundary>
  );
}

export default App;