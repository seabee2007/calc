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
            A comprehensive guide to concrete admixtures and their applications
          </p>
        </div>

        <div className="space-y-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Admixtures are specialized ingredients added to concrete mixes to tailor performance beyond what cement, water, and aggregates alone can achieve. By introducing chemical or mineral admixtures at the batching plant, contractors and engineers can enhance workability, control setting time, boost durability, and even reduce overall cost.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              The right admixture choice balances project demands—be it pumping high-slump concrete, finishing in hot weather, or ensuring long-term resistance to freeze–thaw cycles.
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Chemical Admixtures</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Water Reducers</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Water reducers, sometimes called plasticizers, improve concrete flow without increasing water content. They fall into three categories:
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Admixture Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Typical Dosage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Water Reduction</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Common Applications</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Normal (Type A)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">0.2 – 0.5%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">5–10%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Slab-on-grade, sidewalks</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Mid-Range</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">0.5 – 1.0%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">10–20%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Pumped concrete, precast panels</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">High-Range</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">1.0 – 2.5%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">20–30%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Self-consolidating concrete, high-strength mixes</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Set Controllers</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Retarders (Type B)</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Slow hydration rate, extending working time by 1–4 hours</li>
                      <li>Typical dosage: 0.05–0.2% by cement weight</li>
                      <li>Useful in hot climates or large pours to prevent cold joints</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Accelerators (Type C)</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Speed up strength development, reducing set time by 20–50%</li>
                      <li>Calcium chloride: up to 2% by weight (may promote corrosion)</li>
                      <li>Non-chloride alternatives: 0.5–1% (preferred for reinforced concrete)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Air-Entraining Agents</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  To withstand freeze–thaw exposure, air-entraining agents introduce uniformly distributed microscopic bubbles (spacing factor ≤ 0.20 mm).
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                  <li><strong>Dosage:</strong> 0.02–0.1% by cement weight yields 4–7% air content</li>
                  <li><strong>Benefits:</strong> Each bubble acts as a pressure-relief chamber</li>
                  <li><strong>Trade-off:</strong> Every 1% of air can reduce compressive strength by ~5%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Mineral Admixtures</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Pozzolans</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Pozzolans are fine, non-cementitious materials that react with calcium hydroxide to form additional cementitious compounds.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Pozzolan Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Replacement Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Key Advantages</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Fly Ash</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">15–25%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Improved workability, reduced permeability, lower heat</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Silica Fume</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">5–10%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">High early strength, very low permeability</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">GGBFS</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">30–50%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Enhanced durability, lower thermal cracking</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Natural Pozzolans</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">10–20%</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Cost-effective, sustainable, local resource</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Selection Factors</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Project Requirements</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>High-strength applications (≥40 MPa)</li>
                  <li>Workability needs</li>
                  <li>Environmental exposure</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Compatibility</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Cement type interactions</li>
                  <li>Multiple admixture sequencing</li>
                  <li>Aggregate effects</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Cost Analysis</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Material costs vs. benefits</li>
                  <li>Long-term durability savings</li>
                  <li>Local availability impact</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Quality Control</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Dosage accuracy requirements</li>
                  <li>Mixing time adjustments</li>
                  <li>Testing protocol updates</li>
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