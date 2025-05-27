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
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Proper reinforcement is essential for concrete structures to resist tensile forces and prevent cracking. Different methods are available depending on the application and requirements.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Steel Reinforcement</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Rebar Grades</h4>
                <p className="text-gray-700">
                  Common reinforcing steel grades and their applications:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Grade 40 (40,000 psi yield strength)</li>
                  <li>Grade 60 (60,000 psi yield strength) - Most common</li>
                  <li>Grade 75 (75,000 psi yield strength)</li>
                  <li>Grade 80 (80,000 psi yield strength) - High strength</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Placement Guidelines</h4>
                <p className="text-gray-700">
                  Critical factors for proper rebar installation:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Minimum concrete cover requirements</li>
                  <li>Proper spacing and alignment</li>
                  <li>Adequate lap splice lengths</li>
                  <li>Support and tie requirements</li>
                  <li>Protection from contamination</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Alternative Reinforcement</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Fiber Reinforcement</h4>
                <p className="text-gray-700">
                  Types and applications of fiber reinforcement:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Steel fibers for structural applications</li>
                  <li>Synthetic fibers for crack control</li>
                  <li>Glass fibers for special applications</li>
                  <li>Natural fibers for sustainability</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Welded Wire Mesh</h4>
                <p className="text-gray-700">
                  Pre-fabricated reinforcement options:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Standard sizes and spacing</li>
                  <li>Installation requirements</li>
                  <li>Overlap specifications</li>
                  <li>Support methods</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-3">Design Considerations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Load Requirements</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Dead loads</li>
                  <li>Live loads</li>
                  <li>Environmental loads</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Environmental Exposure</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Corrosion protection</li>
                  <li>Chemical resistance</li>
                  <li>Freeze-thaw cycles</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Construction Methods</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Placement techniques</li>
                  <li>Quality control</li>
                  <li>Inspection requirements</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Cost Factors</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Material costs</li>
                  <li>Labor requirements</li>
                  <li>Long-term maintenance</li>
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