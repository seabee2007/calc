import { motion } from 'framer-motion';
import OwnerReviewQueue from '../../components/owner/OwnerReviewQueue';
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
