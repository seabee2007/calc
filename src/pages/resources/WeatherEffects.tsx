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
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Concrete gains strength through hydration—a chemical reaction between cement and water. If conditions are too hot, cold, windy, or dry, that reaction can be disrupted, leading to surface cracking, delayed strength gain, or even frost damage. Proactive planning and protective measures help ensure concrete cures uniformly and reaches its intended performance.
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Hot Weather Concreting</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Temperature Effects</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  When ambient temperatures climb above about 80°F (27°C), concrete behaves differently:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                  <li><strong>Accelerated hydration:</strong> For every 10°F increase, the set time can shorten by up to 30%, giving less working time</li>
                  <li><strong>Rapid moisture loss:</strong> High heat and low humidity pull water out of the mix, risking plastic shrinkage cracks</li>
                  <li><strong>Increased water demand:</strong> To maintain the same slump, more water is often added—this can reduce ultimate strength</li>
                  <li><strong>Potential strength reduction:</strong> Overly rapid curing can create a less dense microstructure, lowering 28-day strength by 5–10%</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Preventive Measures</h3>
                <ul className="list-disc pl-5 space-y-3 text-gray-700 dark:text-gray-300">
                  <li>
                    <strong>Use chilled mixing water or ice</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Target batch water temperature of 50–60°F (10–16°C)</li>
                      <li>For every 10°F reduction in water temperature, set times slow by roughly 10%</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Apply evaporation retarders</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Spray thin curing compound immediately after finishing</li>
                      <li>Retarder dosage typically 100–200 mL per 100 kg of cement</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Schedule pours for cooler hours</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Early morning or late evening placement avoids peak heat</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Use appropriate retarding admixtures</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Typical dosage: 0.5–1.0% by cement weight</li>
                      <li>Extends workable time by 1–3 hours</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Cold Weather Concreting</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Freezing Prevention</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  When temperatures drop below 40°F (4°C), fresh concrete is vulnerable to frost damage for the first 48–72 hours:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                  <li>Maintain internal temperature at or above 50°F (10°C) until initial set</li>
                  <li>Use insulated blankets or heated enclosures once concrete is placed</li>
                  <li>Monitor internal concrete temperature with embedded thermometers</li>
                  <li>Protect against sudden temperature swings</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Heating Methods</h3>
                <ul className="list-disc pl-5 space-y-3 text-gray-700 dark:text-gray-300">
                  <li>
                    <strong>Heat mixing water</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Maximum 140°F (60°C) to avoid flash setting</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Use insulated forms</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Plywood lined with rigid foam (R-10 or higher)</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Apply indirect heating</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>Place heaters at least 5 ft from forms</li>
                      <li>Warm air around slab without drying surface</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Consider accelerating admixtures</strong>
                    <ul className="list-circle pl-5 mt-1 space-y-1">
                      <li>1–2% calcium chloride (if steel is protected)</li>
                      <li>Non-chloride accelerators for 20–40% faster strength gain</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Critical Weather Factors</h2>
            
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Factor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Impact on Concrete</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Management Strategies</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Temperature</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Sets time and strength gain vary with heat or cold</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Adjust w/c ratio, use retarders/accelerators, heat or cool materials</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Wind</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Increases surface evaporation → plastic shrinkage cracks</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Erect windbreaks, mist water or use curing compounds</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Humidity</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Low humidity speeds moisture loss; high humidity slows drying</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Monitor local RH; cover slabs with damp burlap or plastic sheeting</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Solar Radiation</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Heats surface unevenly → thermal gradients, crazing cracks</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Shade pour area, use reflective covers, schedule shaded pours</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Wind Effects</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Blustery conditions can double evaporation rates. Holding evaporation below 0.2 kg/m²·h (measured by anemometer and psychrometers) helps prevent surface cracks.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Humidity Impact</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Below 50% RH, moisture can bleed out faster than the paste hydrates. In arid climates, fog-spraying or continuous misting maintains a moist surface.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Solar Radiation Effects</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  Direct sun can heat the top 1 in. of concrete 20–30°F above air temperature. Covering initial set concrete with reflective tarps evens out temperatures and reduces dry-out.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-blue-900 mb-4">Summary</h2>
            <p className="text-blue-800">
              By closely monitoring temperature, wind, humidity, and solar load—and by using cooling/heating techniques, admixtures, protective coverings, and well-timed pours—you can control the curing environment. This ensures uniform hydration, minimizes cracking, and achieves the target strength and durability, no matter what the weather brings.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default WeatherEffects;