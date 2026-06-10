import React, { useEffect, useState, Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import Button from './components/ui/Button';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Calculator from './pages/Calculator';
import Login from './pages/auth/Login';
import SignUp from './pages/auth/SignUp';
import ResetPassword from './pages/auth/ResetPassword';
import AuthCallbackPage from './pages/auth/AuthCallbackPage';
import AuthGuard from './components/auth/AuthGuard';
import { OwnerGuard, EmployeeGuard } from './components/auth/RoleGuard';
import { LegacyTaskDetailRedirect } from './components/routing/LegacyPlannerRedirects';
import PlannerIndexRedirect from './components/routing/PlannerIndexRedirect';
import { useProjectStore, useSettingsStore, usePreferencesStore } from './store';
import { useAuth } from './hooks/useAuth';
import { ProposalService } from './lib/proposalService';
import { seedTrackedProposalsCache } from './hooks/useTrackedProposals';
import { soundService } from './services/soundService';
import RouteFallback from './routes/RouteFallback';
import FullscreenExperienceTipHost from './components/onboarding/FullscreenExperienceTipHost';
import DefinitionsHelpHost from './features/help/DefinitionsHelpHost';
import {
  LazyRoute,
  LazyConcreteCalculatorPage,
  LazyReinforcementCalculatorPage,
  LazyLaborCalculatorPage,
  LazyGeneralTradeLaborCalculatorPage,
  LazyCustomEstimatePage,
  LazySafetyMeetingToolPage,
  LazyConcreteInspectionChecklistPage,
  LazyContractBuilderPage,
  LazyProjects,
  LazySettings,
  LazyPourPlanner,
  LazyMixDesignAdvisor,
  LazyProposalGenerator,
  LazyProposals,
  LazyPublicProposal,
  LazyPublicChangeOrder,
  LazyPublicContract,
  LazyClientPortal,
  LazyClientInvitePage,
  LazyResources,
  LazyMixDesigns,
  LazyWeatherEffects,
  LazyReinforcement,
  LazyProperFinishing,
  LazyCommonProblems,
  LazyAdmixtures,
  LazyExternalResources,
  LazyOwnerReviewPage,
  LazyEmployeeManagementPage,
  LazyPlannerWorkspaceLayout,
  LazyPlannerProjectShell,
  LazyPlannerHubPage,
  LazyScheduleWorkspacePage,
  LazyPlannerAllRfisPage,
  LazyPlannerAllFarsPage,
  LazyPlannerAllChangeOrdersPage,
  LazyPlannerBoardPage,
  LazyPlannerChartsPage,
  LazyPlannerSchedulePage,
  LazyPlannerDocumentsPage,
  LazyPlannerRFIsPage,
  LazyPlannerAdjustmentsPage,
  LazyPlannerChangeOrdersPage,
  LazyChangeOrderBuilderPage,
  LazyEstimateWorkspacePage,
  LazyPlannerTeamPage,
  LazyEmployeeTaskPlannerRedirect,
  LazyEmployeeLayout,
  LazyEmployeeDashboardPage,
  LazyEmployeeTasksPage,
  LazyEmployeeProjectsPage,
  LazyEmployeeMessagesPage,
  LazyEmployeeUploadsPage,
  LazyOnboardingFlow,
  LazyConcreteChat,
  LazyActivityEstimatePreview,
  LazyProductionRateReviewPage,
} from './routes/lazyPages';

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
            <Button variant="primary" onClick={() => window.location.reload()}>
              Reload App
            </Button>
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

  const isNativePlatform = Capacitor.isNativePlatform();
  if (import.meta.env.DEV) {
    console.log('[Capacitor] isNativePlatform', isNativePlatform);
  }

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await soundService.initialize();

        if (user && !authLoading) {
          await Promise.all([
            loadProjects().catch((e) => console.error('Error loading projects:', e)),
            loadCompanySettings().catch((e) => console.error('Error loading settings:', e)),
            loadPreferences().catch((e) => console.error('Error loading preferences:', e)),
            ProposalService.getAll()
              .then((data) => {
                if (user.id) seedTrackedProposalsCache(user.id, data);
              })
              .catch((e) => console.error('Error prefetching proposals:', e)),
          ]);

          if (!isNativePlatform) {
            await Promise.all([
              migrateSettings().catch((e) => console.error('Error migrating settings:', e)),
              migratePreferences().catch((e) =>
                console.error('Error migrating preferences:', e),
              ),
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
  }, [user, authLoading, isNativePlatform, loadProjects, loadCompanySettings, loadPreferences, migrateSettings, migratePreferences]);

  useEffect(() => {
    const checkOnboarding = () => {
      try {
        if (user && !authLoading) {
          const isTestOnboarding = location.pathname === '/test-onboarding';

          let onboardingCompleted = false;

          if (isNativePlatform) {
            onboardingCompleted = !isTestOnboarding;
          } else {
            try {
              onboardingCompleted = localStorage.getItem('onboarding_completed') === 'true';
            } catch (e) {
              console.warn('Error reading onboarding status:', e);
              onboardingCompleted = true;
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
  }, [user, authLoading, location.pathname, isNativePlatform]);

  const isLoggedOutLanding = location.pathname === '/' && !user && !authLoading;
  const isOnboardingActive =
    onboardingChecked && ((showOnboarding && user) || location.pathname === '/test-onboarding');

  useEffect(() => {
    const shouldUseDark = isLoggedOutLanding || isDark || isOnboardingActive;

    if (shouldUseDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark, isLoggedOutLanding, isOnboardingActive]);

  const handleOnboardingComplete = () => {
    try {
      setShowOnboarding(false);
      if (!isNativePlatform) {
        localStorage.setItem('onboarding_completed', 'true');
      }
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
      setShowOnboarding(false);
    }
  };

  if (initError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">{initError}</h1>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!onboardingChecked || authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if ((showOnboarding && user) || location.pathname === '/test-onboarding') {
    return (
      <Suspense fallback={<RouteFallback />}>
        <LazyOnboardingFlow onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return (
    <AppErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
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
              path="calculator/concrete"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyConcreteCalculatorPage} />
                </AuthGuard>
              }
            />
            <Route
              path="calculator/reinforcement"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyReinforcementCalculatorPage} />
                </AuthGuard>
              }
            />
            <Route
              path="calculator/labor"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyLaborCalculatorPage} />
                </AuthGuard>
              }
            />
            <Route
              path="calculator/general-trade-labor"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyGeneralTradeLaborCalculatorPage} />
                </AuthGuard>
              }
            />
            <Route
              path="calculator/custom"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyCustomEstimatePage} />
                </AuthGuard>
              }
            />
            <Route
              path="projects"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyProjects} />
                </AuthGuard>
              }
            />
            <Route
              path="projects/:projectId/tasks/:taskId"
              element={
                <AuthGuard>
                  <LegacyTaskDetailRedirect />
                </AuthGuard>
              }
            />
            <Route
              path="employees"
              element={
                <AuthGuard>
                  <OwnerGuard>
                    <LazyRoute Page={LazyEmployeeManagementPage} />
                  </OwnerGuard>
                </AuthGuard>
              }
            />
            <Route
              path="owner/review"
              element={
                <AuthGuard>
                  <OwnerGuard>
                    <LazyRoute Page={LazyOwnerReviewPage} />
                  </OwnerGuard>
                </AuthGuard>
              }
            />
            <Route path="dispatch" element={<Navigate to="/" replace />} />
            <Route path="qc" element={<Navigate to="/" replace />} />
            <Route
              path="pour-planner"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyPourPlanner} />
                </AuthGuard>
              }
            />
            <Route
              path="mix-design-advisor"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyMixDesignAdvisor} />
                </AuthGuard>
              }
            />
            <Route
              path="proposal-generator"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyProposalGenerator} />
                </AuthGuard>
              }
            />
            <Route
              path="proposals"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyProposals} />
                </AuthGuard>
              }
            />
            <Route
              path="settings"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazySettings} />
                </AuthGuard>
              }
            />
            <Route
              path="tools/safety-meeting"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazySafetyMeetingToolPage} />
                </AuthGuard>
              }
            />
            <Route
              path="tools/concrete-inspection"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyConcreteInspectionChecklistPage} />
                </AuthGuard>
              }
            />
            <Route
              path="tools/contract-builder"
              element={
                <AuthGuard>
                  <LazyRoute Page={LazyContractBuilderPage} />
                </AuthGuard>
              }
            />
            <Route
              path="resources"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <LazyResources chatStore={chatStore} />
                </Suspense>
              }
            />
            <Route path="resources/mix-designs" element={<LazyRoute Page={LazyMixDesigns} />} />
            <Route
              path="resources/weather-effects"
              element={<LazyRoute Page={LazyWeatherEffects} />}
            />
            <Route path="resources/reinforcement" element={<LazyRoute Page={LazyReinforcement} />} />
            <Route
              path="resources/proper-finishing"
              element={<LazyRoute Page={LazyProperFinishing} />}
            />
            <Route path="resources/common-problems" element={<LazyRoute Page={LazyCommonProblems} />} />
            <Route path="resources/admixtures" element={<LazyRoute Page={LazyAdmixtures} />} />
            <Route
              path="resources/external-resources"
              element={<LazyRoute Page={LazyExternalResources} />}
            />
          </Route>
          <Route
            element={
              <AuthGuard>
                <LazyRoute Page={LazyPlannerWorkspaceLayout} />
              </AuthGuard>
            }
          >
            <Route path="planner/hub" element={<LazyRoute Page={LazyPlannerHubPage} />} />
            <Route path="planner/schedule" element={<LazyRoute Page={LazyScheduleWorkspacePage} />} />
            <Route path="planner/rfis" element={<LazyRoute Page={LazyPlannerAllRfisPage} />} />
            <Route path="planner/fars" element={<LazyRoute Page={LazyPlannerAllFarsPage} />} />
            <Route
              path="planner/change-orders"
              element={<LazyRoute Page={LazyPlannerAllChangeOrdersPage} />}
            />
            <Route path="projects/:projectId/planner" element={<LazyRoute Page={LazyPlannerProjectShell} />}>
              <Route index element={<PlannerIndexRedirect />} />
              <Route path="board" element={<LazyRoute Page={LazyPlannerBoardPage} />} />
              <Route path="charts" element={<LazyRoute Page={LazyPlannerChartsPage} />} />
              <Route path="schedule" element={<LazyRoute Page={LazyPlannerSchedulePage} />} />
              <Route path="documents" element={<LazyRoute Page={LazyPlannerDocumentsPage} />} />
              <Route path="rfis" element={<LazyRoute Page={LazyPlannerRFIsPage} />} />
              <Route path="adjustments" element={<LazyRoute Page={LazyPlannerAdjustmentsPage} />} />
              <Route path="change-orders" element={<LazyRoute Page={LazyPlannerChangeOrdersPage} />} />
              <Route
                path="change-orders/:changeOrderId"
                element={<LazyRoute Page={LazyChangeOrderBuilderPage} />}
              />
              <Route path="estimate/:estimateTab" element={<LazyRoute Page={LazyEstimateWorkspacePage} />} />
              <Route path="estimate" element={<LazyRoute Page={LazyEstimateWorkspacePage} />} />
              <Route path="team" element={<LazyRoute Page={LazyPlannerTeamPage} />} />
            </Route>
            <Route
              path="employee/tasks"
              element={
                <EmployeeGuard>
                  <LazyRoute Page={LazyEmployeeTasksPage} />
                </EmployeeGuard>
              }
            />
            <Route
              path="employee/tasks/:taskId"
              element={
                <EmployeeGuard>
                  <LazyRoute Page={LazyEmployeeTaskPlannerRedirect} />
                </EmployeeGuard>
              }
            />
          </Route>
          <Route
            element={
              <AuthGuard>
                <EmployeeGuard>
                  <LazyRoute Page={LazyEmployeeLayout} />
                </EmployeeGuard>
              </AuthGuard>
            }
          >
            <Route path="/employee/dashboard" element={<LazyRoute Page={LazyEmployeeDashboardPage} />} />
            <Route path="/employee/projects" element={<LazyRoute Page={LazyEmployeeProjectsPage} />} />
            <Route path="/employee/messages" element={<LazyRoute Page={LazyEmployeeMessagesPage} />} />
            <Route path="/employee/uploads" element={<LazyRoute Page={LazyEmployeeUploadsPage} />} />
          </Route>
          <Route path="/proposal/:token" element={<LazyRoute Page={LazyPublicProposal} />} />
          <Route path="/change-order/:token" element={<LazyRoute Page={LazyPublicChangeOrder} />} />
          <Route path="/contract/:token" element={<LazyRoute Page={LazyPublicContract} />} />
          <Route path="/client/project/:token" element={<LazyRoute Page={LazyClientPortal} />} />
          <Route path="/invite/:token" element={<LazyRoute Page={LazyClientInvitePage} />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/test-onboarding"
            element={
              <Suspense fallback={<RouteFallback />}>
                <LazyOnboardingFlow onComplete={handleOnboardingComplete} />
              </Suspense>
            }
          />
          {/* Dev-only routes — only rendered in development builds */}
          {import.meta.env.DEV && (
            <>
              <Route path="/dev/activity-preview" element={<LazyRoute Page={LazyActivityEstimatePreview} />} />
              <Route path="/dev/production-rate-review" element={<LazyRoute Page={LazyProductionRateReviewPage} />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        {chatStore.isVisible &&
          !location.pathname.startsWith('/proposal/') &&
          !location.pathname.startsWith('/client/project/') && (
            <Suspense fallback={null}>
              <LazyConcreteChat />
            </Suspense>
          )}

        <FullscreenExperienceTipHost />
        <DefinitionsHelpHost />
      </Suspense>
    </AppErrorBoundary>
  );
}

export default App;
