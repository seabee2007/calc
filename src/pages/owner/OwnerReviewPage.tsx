import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import OwnerReviewQueue from '../../components/owner/OwnerReviewQueue';
import { PLANNER_LINK } from '../../components/planner/plannerTheme';
import { CC_PAGE_TITLE_MD } from '../../theme/pageTypography';

export default function OwnerReviewPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-4xl py-6 pb-24 md:pb-8"
    >
      <Link
        to="/planner/hub"
        className={`mb-4 inline-flex items-center gap-1 ${PLANNER_LINK}`}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Back to Planner Hub
      </Link>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className={`mb-6 ${CC_PAGE_TITLE_MD}`}
      >
        Review queue
      </motion.h1>
      <OwnerReviewQueue />
    </motion.div>
  );
}
