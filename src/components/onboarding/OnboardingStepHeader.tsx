import { motion } from 'framer-motion';
import { ONBOARDING_SUBTITLE, ONBOARDING_TITLE } from './onboardingTheme';

interface OnboardingStepHeaderProps {
  title: string;
  description: string;
}

export default function OnboardingStepHeader({ title, description }: OnboardingStepHeaderProps) {
  return (
    <div className="mb-8">
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${ONBOARDING_TITLE} mb-4`}
      >
        {title}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={ONBOARDING_SUBTITLE}
      >
        {description}
      </motion.p>
    </div>
  );
}
