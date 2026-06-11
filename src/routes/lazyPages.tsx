import { lazy, Suspense, type ComponentType, type Dispatch, type LazyExoticComponent, type SetStateAction } from 'react';
import RouteFallback from './RouteFallback';

function lazyPage(
  factory: () => Promise<{ default: ComponentType<object> }>,
): LazyExoticComponent<ComponentType<object>> {
  return lazy(factory);
}

function lazyWithProps<P extends object>(
  factory: () => Promise<{ default: ComponentType<P> }>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(factory) as LazyExoticComponent<ComponentType<P>>;
}

/** Wrap a lazy component in Suspense for use in route `element` props. */
export function LazyRoute({
  Page,
}: {
  Page: LazyExoticComponent<ComponentType<object>>;
}) {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Page />
    </Suspense>
  );
}

// Calculators
export const LazyConcreteCalculatorPage = lazyPage(
  () => import('../pages/calculators/ConcreteCalculatorPage'),
);
export const LazyReinforcementCalculatorPage = lazyPage(
  () => import('../pages/calculators/ReinforcementCalculatorPage'),
);
export const LazyLaborCalculatorPage = lazyPage(
  () => import('../pages/calculators/LaborCalculatorPage'),
);
export const LazyGeneralTradeLaborCalculatorPage = lazyPage(
  () => import('../pages/calculators/GeneralTradeLaborCalculatorPage'),
);
export const LazyCustomEstimatePage = lazyPage(
  () => import('../pages/calculators/CustomEstimatePage'),
);

// Field & safety tools
export const LazySafetyMeetingToolPage = lazyPage(
  () => import('../pages/tools/SafetyMeetingToolPage'),
);
export const LazyConcreteInspectionChecklistPage = lazyPage(
  () => import('../pages/tools/ConcreteInspectionChecklistPage'),
);
export const LazyContractBuilderPage = lazyPage(
  () => import('../features/documents/ui/DocumentBuilderPage'),
);

// Project management & proposals
export const LazyProjects = lazyPage(() => import('../pages/Projects/Projects'));
export const LazySettings = lazyPage(() => import('../pages/Settings'));
export const LazyPourPlanner = lazyPage(() => import('../pages/PourPlanner'));
export const LazyMixDesignAdvisor = lazyPage(() => import('../pages/MixDesignAdvisor'));
export const LazyProposalGenerator = lazyPage(() => import('../pages/ProposalGenerator'));
export const LazyProposals = lazyPage(() => import('../pages/Proposals'));
export const LazyPublicProposal = lazyPage(() => import('../pages/PublicProposal'));
export const LazyPublicChangeOrder = lazyPage(() => import('../pages/PublicChangeOrder'));
export const LazyPublicContract = lazyPage(
  () => import('../features/documents/ui/PublicContractPage'),
);
export const LazyClientPortal = lazyPage(() => import('../pages/ClientPortal'));
export const LazyClientInvitePage = lazyPage(() => import('../pages/ClientInvitePage'));

// Onboarding & chat
export const LazyOnboardingFlow = lazyWithProps<{ onComplete: () => void }>(
  () => import('../components/onboarding/OnboardingFlow'),
);
export const LazyConcreteChat = lazyPage(() => import('../components/ConcreteChat'));

// Resources (accepts chatStore from App)
export const LazyResources = lazyWithProps<{
  chatStore: { isVisible: boolean; setIsVisible: Dispatch<SetStateAction<boolean>> };
}>(() => import('../pages/Resources'));
export const LazyMixDesigns = lazyPage(() => import('../pages/resources/MixDesigns'));
export const LazyWeatherEffects = lazyPage(() => import('../pages/resources/WeatherEffects'));
export const LazyReinforcement = lazyPage(() => import('../pages/resources/Reinforcement'));
export const LazyProperFinishing = lazyPage(() => import('../pages/resources/ProperFinishing'));
export const LazyCommonProblems = lazyPage(() => import('../pages/resources/CommonProblems'));
export const LazyAdmixtures = lazyPage(() => import('../pages/resources/Admixtures'));
export const LazyExternalResources = lazyPage(
  () => import('../pages/resources/ExternalResources'),
);

// Owner
export const LazyOwnerReviewPage = lazyPage(() => import('../pages/owner/OwnerReviewPage'));
export const LazyEmployeeManagementPage = lazyPage(
  () => import('../pages/owner/EmployeeManagementPage'),
);

// Planner
export const LazyPlannerWorkspaceLayout = lazyPage(
  () => import('../components/layout/PlannerWorkspaceLayout'),
);
export const LazyPlannerProjectShell = lazyPage(
  () => import('../pages/planner/PlannerProjectShell'),
);
export const LazyPlannerHubPage = lazyPage(() => import('../pages/planner/PlannerHubPage'));
export const LazyScheduleWorkspacePage = lazyPage(
  () => import('../pages/planner/ScheduleWorkspacePage'),
);
export const LazyPlannerAllRfisPage = lazyPage(
  () => import('../pages/planner/PlannerAllRfisPage'),
);
export const LazyPlannerAllFarsPage = lazyPage(
  () => import('../pages/planner/PlannerAllFarsPage'),
);
export const LazyPlannerAllChangeOrdersPage = lazyPage(
  () => import('../pages/planner/PlannerAllChangeOrdersPage'),
);
export const LazyPlannerBoardPage = lazyPage(() => import('../pages/planner/PlannerBoardPage'));
export const LazyPlannerChartsPage = lazyPage(() => import('../pages/planner/PlannerChartsPage'));
export const LazyPlannerSchedulePage = lazyPage(
  () => import('../pages/planner/PlannerSchedulePage'),
);
export const LazyPlannerDocumentsPage = lazyPage(
  () => import('../pages/planner/PlannerDocumentsPage'),
);
export const LazyPlannerRFIsPage = lazyPage(() => import('../pages/planner/PlannerRFIsPage'));
export const LazyPlannerAdjustmentsPage = lazyPage(
  () => import('../pages/planner/PlannerAdjustmentsPage'),
);
export const LazyPlannerChangeOrdersPage = lazyPage(
  () => import('../pages/planner/PlannerChangeOrdersPage'),
);
export const LazyChangeOrderBuilderPage = lazyPage(
  () => import('../pages/planner/ChangeOrderBuilderPage'),
);
export const LazyEstimateWorkspacePage = lazyPage(
  () => import('../pages/planner/EstimateWorkspacePage'),
);
export const LazyPlannerTeamPage = lazyPage(() => import('../pages/planner/PlannerTeamPage'));
export const LazyEmployeeTaskPlannerRedirect = lazyPage(
  () => import('../pages/employee/EmployeeTaskPlannerRedirect'),
);

// Employee portal
export const LazyEmployeeLayout = lazyPage(() => import('../components/layout/EmployeeLayout'));
export const LazyEmployeeDashboardPage = lazyPage(
  () => import('../pages/employee/EmployeeDashboardPage'),
);
export const LazyEmployeeTasksPage = lazyPage(() => import('../pages/employee/EmployeeTasksPage'));
export const LazyEmployeeProjectsPage = lazyPage(
  () => import('../pages/employee/EmployeeProjectsPage'),
);
export const LazyEmployeeMessagesPage = lazyPage(
  () => import('../pages/employee/EmployeeMessagesPage'),
);
export const LazyEmployeeUploadsPage = lazyPage(
  () => import('../pages/employee/EmployeeUploadsPage'),
);

// Dev-only routes (never rendered in production builds)
export const LazyActivityEstimatePreview = lazyPage(
  () => import('../features/estimating/ui/dev/ActivityEstimatePreview'),
);
export const LazyProductionRateReviewPage = lazyPage(
  () => import('../features/estimating/ui/dev/ProductionRateReviewPage'),
);
export const LazyAdobeRejectedRecoveryPage = lazyPage(
  () => import('../features/estimating/ui/dev/AdobeRejectedRecoveryPage'),
);
