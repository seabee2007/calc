import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const Admixtures: React.FC = () => {
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
            Admixtures and Their Uses
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Understanding concrete admixtures and their applications
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Admixtures are materials added to concrete during mixing to modify its properties. They can enhance workability, strength, durability, and other characteristics.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Chemical Admixtures</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Water Reducers</h4>
                <p className="text-gray-700">
                  Types and applications:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Normal water reducers (Type A)</li>
                  <li>Mid-range water reducers</li>
                  <li>High-range water reducers (superplasticizers)</li>
                  <li>Water reduction capabilities: 5-30%</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Set Controllers</h4>
                <p className="text-gray-700">
                  Modifying setting time:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Accelerators (Type C)</li>
                  <li>Retarders (Type B)</li>
                  <li>Hydration control admixtures</li>
                  <li>Temperature considerations</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Air Entraining</h4>
                <p className="text-gray-700">
                  Improving freeze-thaw durability:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Typical dosage rates</li>
                  <li>Air content requirements</li>
                  <li>Spacing factor importance</li>
                  <li>Strength implications</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Mineral Admixtures</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Pozzolans</h4>
                <p className="text-gray-700">
                  Common supplementary materials:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Fly ash</li>
                  <li>Silica fume</li>
                  <li>Ground slag</li>
                  <li>Natural pozzolans</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Benefits</h4>
                <p className="text-gray-700">
                  Advantages of mineral admixtures:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Improved workability</li>
                  <li>Enhanced durability</li>
                  <li>Reduced permeability</li>
                  <li>Cost effectiveness</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-3">Selection Factors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Project Requirements</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Strength needs</li>
                  <li>Workability demands</li>
                  <li>Environmental exposure</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Compatibility</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Cement type</li>
                  <li>Other admixtures</li>
                  <li>Mix components</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Cost Analysis</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Material costs</li>
                  <li>Performance benefits</li>
                  <li>Long-term savings</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Quality Control</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Dosage accuracy</li>
                  <li>Mixing requirements</li>
                  <li>Testing procedures</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Admixtures;