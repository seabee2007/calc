import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import {
  ONBOARDING_BRAND_GRADIENT,
  ONBOARDING_CARD,
  ONBOARDING_PRIMARY_BUTTON,
  ONBOARDING_SKIP_BUTTON,
  ONBOARDING_SUBTITLE,
  ONBOARDING_TITLE,
} from './onboardingTheme';

interface WelcomeScreenProps {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext, onSkip }) => {
  const [showTitle, setShowTitle] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 500);

    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, 3500);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(contentTimer);
    };
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden py-8">
      <div className="relative z-10 mx-auto w-full max-w-lg px-2 text-center">
        <AnimatePresence mode="wait">
          {!showTitle && !showContent ? (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-24"
              aria-hidden
            />
          ) : null}

          {showTitle && !showContent && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{
                duration: 1.2,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <h1 className={`text-6xl font-bold sm:text-7xl md:text-8xl ${ONBOARDING_BRAND_GRADIENT}`}>
                Arden Project OS
              </h1>
            </motion.div>
          )}

          {showContent && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                ease: 'easeOut',
              }}
              className={`${ONBOARDING_CARD} space-y-10`}
            >
              <div className="space-y-6">
                <motion.h2
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className={ONBOARDING_TITLE}
                >
                  Welcome to Arden Project OS
                </motion.h2>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className={`${ONBOARDING_SUBTITLE} text-2xl`}
                >
                  Let&apos;s get you started
                </motion.p>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="text-lg text-slate-400"
                >
                  Take a moment to set up your profile for the best experience
                </motion.p>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="space-y-4"
              >
                <button type="button" onClick={onNext} className={`${ONBOARDING_PRIMARY_BUTTON} w-full py-4 text-lg`}>
                  Set Up Profile
                  <ArrowRight className="h-6 w-6" />
                </button>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSkip}
                  className={`${ONBOARDING_SKIP_BUTTON} w-full text-lg underline underline-offset-2`}
                >
                  Skip for now
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default WelcomeScreen;
