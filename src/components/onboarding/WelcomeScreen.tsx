import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import { ArrowRight } from 'lucide-react';

interface WelcomeScreenProps {
  onNext: () => void;
  onSkip: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext, onSkip }) => {
  const [showTitle, setShowTitle] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Start title animation after a brief delay
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 500);

    // Show content after title animation
    const contentTimer = setTimeout(() => {
      setShowContent(true);
    }, 3500);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(contentTimer);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 flex items-center justify-center relative overflow-hidden">
      <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {/* Title Animation */}
          {showTitle && !showContent && (
            <motion.div
              key="title"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ 
                duration: 1.2,
                ease: "easeInOut"
              }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <h1 className="text-7xl md:text-8xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 bg-clip-text text-transparent">
                Concrete Calc
              </h1>
            </motion.div>
          )}

          {/* Content */}
          {showContent && (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.8,
                ease: "easeOut"
              }}
              className="space-y-10"
            >
              {/* Welcome Message */}
              <div className="space-y-6">
                <motion.h2 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="text-4xl md:text-5xl font-bold text-gray-900"
                >
                  Welcome to Concrete Calc
                </motion.h2>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className="text-2xl text-gray-600 leading-relaxed"
                >
                  Let's get you started
                </motion.p>
                
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7, duration: 0.6 }}
                  className="text-xl text-gray-500"
                >
                  Take a moment to set up your profile for the best experience
                </motion.p>
              </div>

              {/* Action Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="space-y-4"
              >
                <Button
                  onClick={onNext}
                  size="lg"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xl py-6 px-8 shadow-lg hover:shadow-xl transition-all duration-300 rounded-lg"
                  icon={<ArrowRight size={24} />}
                >
                  Set Up Profile
                </Button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onSkip}
                  className="text-gray-600 hover:text-gray-800 text-lg font-medium transition-colors duration-200 underline underline-offset-2"
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