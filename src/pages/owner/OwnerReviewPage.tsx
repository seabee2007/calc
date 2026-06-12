import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import OwnerReviewQueue from '../../components/owner/OwnerReviewQueue';
import { PLANNER_LINK } from '../../components/planner/plannerTheme';
import { CC_PAGE_HERO_SUBTITLE, CC_PAGE_HERO_TITLE } from '../../theme/pageTypography';
import { PREMIUM_PAGE_MAX_WIDTH } from '../../theme/appTheme';

export default function OwnerReviewPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={`w-full ${PREMIUM_PAGE_MAX_WIDTH} pb-24 text-slate-900 md:pb-8 dark:text-slate-100`}
    >
      <Link
        to="/planner/hub"
        className={`mb-4 inline-flex items-center gap-1 ${PLANNER_LINK}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Planner Hub
      </Link>
      <div className="mb-6">
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className={CC_PAGE_HERO_TITLE}
        >
          Review queue
        </motion.h1>
        <p className={CC_PAGE_HERO_SUBTITLE}>
          Approve field submissions, RFIs, adjustments, and change orders awaiting your action.
        </p>
      </div>
      <OwnerReviewQueue />
    </motion.div>
  );
}
