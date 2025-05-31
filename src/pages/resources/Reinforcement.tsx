import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const Reinforcement: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/resources')}
            icon={<ArrowLeft size={20} />}
            className="text-white hover:text-blue-200 mb-4"
          >
            Back to Resources
          </Button>
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Reinforcement Techniques
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            A comprehensive guide to concrete reinforcement methods and best practices
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Reinforcement is essential for concrete structures to resist tensile stresses, cracking, and increase overall durability. Understanding proper placement and techniques is crucial for structural integrity.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Rebar Placement</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Cover Requirements</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Minimum concrete cover for protection:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Footings and walls: 3 inches minimum</li>
                  <li>Slabs on grade: 2 inches minimum</li>
                  <li>Beams and columns: 1.5 inches minimum</li>
                  <li>Exposed elements: Increase by 0.5 inches</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Spacing Guidelines</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Proper bar spacing for effective reinforcement:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Minimum 1 inch clear between bars</li>
                  <li>Maximum 3 times slab thickness</li>
                  <li>Consider aggregate size constraints</li>
                  <li>Follow code requirements for specific applications</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Lap Splices</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Connecting reinforcement bars properly:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Calculate based on bar size and concrete strength</li>
                  <li>Stagger splices in different bars</li>
                  <li>Maintain proper spacing during overlap</li>
                  <li>Use tie wire to secure connections</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Alternative Reinforcement</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Welded Wire Mesh</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Prefabricated reinforcement for slabs:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Easier installation than individual bars</li>
                  <li>Consistent spacing and alignment</li>
                  <li>Ideal for thin slabs and pavements</li>
                  <li>Requires proper support during placement</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Fiber Reinforcement</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Distributed reinforcement throughout concrete:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Steel, synthetic, or glass fiber options</li>
                  <li>Improves crack control and toughness</li>
                  <li>Does not replace structural reinforcement</li>
                  <li>Easier placement than traditional rebar</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">Best Practices</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Installation</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Use proper chair supports</li>
                  <li>Secure against displacement</li>
                  <li>Check alignment before pour</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quality Control</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Verify bar sizes and grades</li>
                  <li>Inspect for cleanliness</li>
                  <li>Document placement details</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Safety</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Cap exposed rebar ends</li>
                  <li>Provide safe walkways</li>
                  <li>Use proper lifting techniques</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Coordination</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Work with other trades</li>
                  <li>Plan pour sequence</li>
                  <li>Communicate special requirements</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Reinforcement;