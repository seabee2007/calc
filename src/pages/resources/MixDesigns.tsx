import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const MixDesigns: React.FC = () => {
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
            Understanding Concrete Mix Designs
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            A comprehensive guide to concrete mix design principles and methods
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Concrete mix design is the process of determining the right proportions of cement, water, aggregates, and admixtures to achieve desired properties in both fresh and hardened concrete.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Basic Mix Components</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Portland Cement</h4>
                <p className="text-gray-700">
                  The binding agent that holds concrete together. Different types are available for various applications:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Type I - Normal general purpose cement</li>
                  <li>Type II - Moderate sulfate resistance</li>
                  <li>Type III - High early strength</li>
                  <li>Type IV - Low heat of hydration</li>
                  <li>Type V - High sulfate resistance</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Aggregates</h4>
                <p className="text-gray-700">
                  Make up 60-75% of concrete volume. Quality and gradation significantly impact strength:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Fine aggregates (sand): 0-4.75mm</li>
                  <li>Coarse aggregates: 4.75-150mm</li>
                  <li>Well-graded aggregates improve workability</li>
                  <li>Clean, strong aggregates enhance durability</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Water</h4>
                <p className="text-gray-700">
                  Activates cement hydration. The water-cement ratio is crucial for strength and workability:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Lower w/c ratio = Higher strength</li>
                  <li>Higher w/c ratio = Better workability</li>
                  <li>Typical range: 0.35-0.55</li>
                  <li>Clean, potable water required</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Mix Design Methods</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">ACI Method</h4>
                <p className="text-gray-700">
                  Most widely used in North America, based on ACI 211.1 standard:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Step-by-step procedure</li>
                  <li>Based on absolute volume method</li>
                  <li>Considers air content requirements</li>
                  <li>Adjusts for aggregate properties</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">British Method (DOE)</h4>
                <p className="text-gray-700">
                  Popular in UK and Commonwealth countries:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Based on statistical data</li>
                  <li>Uses standard curves</li>
                  <li>Considers workability requirements</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Indian Standard Method</h4>
                <p className="text-gray-700">
                  Based on IS 10262, widely used in South Asia:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Modified version of ACI method</li>
                  <li>Accounts for local materials</li>
                  <li>Includes durability considerations</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-3">Key Considerations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Strength Requirements</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Compressive strength</li>
                  <li>Flexural strength</li>
                  <li>Early strength needs</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Workability</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Slump requirements</li>
                  <li>Placement method</li>
                  <li>Temperature effects</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Durability</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Exposure conditions</li>
                  <li>Chemical resistance</li>
                  <li>Freeze-thaw resistance</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Economy</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Material costs</li>
                  <li>Local availability</li>
                  <li>Transportation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MixDesigns;