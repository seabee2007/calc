import { motion } from 'framer-motion';
import OwnerReviewQueue from '../../components/owner/OwnerReviewQueue';
import { PLANNER_PAGE_BG } from '../../components/planner/plannerTheme';
import AppPage from '../../components/ui/AppPage';
import PageHeader from '../../components/ui/PageHeader';

export default function OwnerReviewPage() {
  return (
    <div className={`${PLANNER_PAGE_BG} overflow-y-auto`}>
      <AppPage
        className="w-full !max-w-none pt-6"
        header={
          <PageHeader
            title="My Tasks"
            subtitle="Review submitted tasks, RFIs, adjustments, and change orders awaiting your action."
          />
        }
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <OwnerReviewQueue />
        </motion.div>
      </AppPage>
    </div>
  );
}
