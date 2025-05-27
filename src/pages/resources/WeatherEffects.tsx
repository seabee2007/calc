import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const WeatherEffects: React.FC = () => {
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
            Weather Effects on Concrete Curing
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Understanding and managing weather impacts on concrete placement and curing
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Weather conditions significantly impact concrete curing and final strength. Understanding these effects is crucial for successful concrete placement.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Hot Weather Concreting</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Temperature Effects</h4>
                <p className="text-gray-700">
                  High temperatures accelerate hydration and can lead to rapid moisture loss:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Every 10°F increase reduces set time by up to 30%</li>
                  <li>Increased risk of plastic shrinkage cracking</li>
                  <li>Higher water demand for workability</li>
                  <li>Potential for reduced final strength</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Preventive Measures</h4>
                <p className="text-gray-700">
                  Steps to mitigate hot weather effects:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Use chilled mixing water or ice</li>
                  <li>Apply evaporation retarders</li>
                  <li>Schedule pours for cooler hours</li>
                  <li>Use appropriate retarding admixtures</li>
                  <li>Protect aggregates from direct sun</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Cold Weather Concreting</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Freezing Prevention</h4>
                <p className="text-gray-700">
                  Critical measures to prevent freezing damage:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Maintain temperature above 40°F for first 48 hours</li>
                  <li>Use insulation blankets or heated enclosures</li>
                  <li>Monitor internal concrete temperature</li>
                  <li>Protect against sudden temperature changes</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Heating Methods</h4>
                <p className="text-gray-700">
                  Techniques for cold weather placement:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
                  <li>Heat mixing water (max 140°F)</li>
                  <li>Use insulated forms</li>
                  <li>Apply indirect heating</li>
                  <li>Consider accelerating admixtures</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-3">Critical Weather Factors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Temperature</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Affects setting time</li>
                  <li>Influences strength development</li>
                  <li>Impacts water demand</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Wind</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Increases evaporation rate</li>
                  <li>Affects surface finishing</li>
                  <li>Can cause plastic shrinkage</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Humidity</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Controls moisture loss</li>
                  <li>Affects curing conditions</li>
                  <li>Impacts surface durability</li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Solar Radiation</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Increases surface temperature</li>
                  <li>Creates temperature gradients</li>
                  <li>Affects moisture evaporation</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherEffects;