import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const CommonProblems: React.FC = () => {
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
            Common Concrete Problems
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Identifying and preventing common concrete issues
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Understanding common concrete problems is essential for prevention and proper remediation. Many issues can be avoided with proper planning and execution.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Surface Defects</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Scaling</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Surface flaking or peeling:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Inadequate air entrainment</li>
                  <li>Improper finishing</li>
                  <li>Freeze-thaw damage</li>
                  <li>Poor curing practices</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Crazing</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Network of fine surface cracks:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Rapid surface drying</li>
                  <li>Over-finishing</li>
                  <li>High water-cement ratio</li>
                  <li>Poor curing methods</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Dusting</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Powdery surface condition:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Premature finishing</li>
                  <li>Excess bleed water</li>
                  <li>Poor air entrainment</li>
                  <li>Inadequate curing</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Structural Issues</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Cracking</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Types and causes of cracks:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Plastic shrinkage cracks</li>
                  <li>Settlement cracks</li>
                  <li>Thermal cracks</li>
                  <li>Structural cracks</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Low Strength</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Causes of inadequate strength:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Improper mix design</li>
                  <li>Poor consolidation</li>
                  <li>Inadequate curing</li>
                  <li>Excessive water addition</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">Prevention Strategies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Mix Design</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Proper w/c ratio</li>
                  <li>Adequate air content</li>
                  <li>Appropriate aggregates</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Placement</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Proper consolidation</li>
                  <li>Correct finishing timing</li>
                  <li>Appropriate tools</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Curing</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Adequate moisture</li>
                  <li>Temperature control</li>
                  <li>Protection methods</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quality Control</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Testing procedures</li>
                  <li>Inspection points</li>
                  <li>Documentation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CommonProblems;