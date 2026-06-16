import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppPage from '../components/ui/AppPage';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import BillingSubscriptionPanel from '../components/subscription/BillingSubscriptionPanel';
import { PAGE_GUTTER, PREMIUM_PAGE_MAX_WIDTH } from '../theme/appTheme';

export default function BillingPage() {
  const navigate = useNavigate();

  return (
    <AppPage maxWidthClass={PREMIUM_PAGE_MAX_WIDTH} gutterClass={PAGE_GUTTER}>
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/settings')}
        >
          Back to Settings
        </Button>
      </div>
      <PageHeader
        title="Billing & Subscription"
        subtitle="Manage your Arden Project OS plan, upgrades, and Stripe billing details."
      />
      <BillingSubscriptionPanel />
    </AppPage>
  );
}
