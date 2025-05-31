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
<<<<<<< HEAD
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Admixtures are chemical additions that modify concrete properties. They can improve workability, accelerate or retard setting, enhance durability, and provide specialized performance characteristics.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Water-Reducing Admixtures</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Normal Range</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Standard water reducers (Type A):
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>5-10% water reduction at same slump</li>
                  <li>Improved workability and finish quality</li>
                  <li>Typical dosage: 2-5 oz per 100 lbs cement</li>
                  <li>Cost-effective for most applications</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">High Range (Superplasticizers)</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Advanced water reducers (Type F):
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>12-30% water reduction possible</li>
                  <li>Self-consolidating concrete capability</li>
                  <li>Extended workability time</li>
                  <li>Higher strength without additional cement</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Air-Entraining Agents</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Freeze-thaw protection (Type A):
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>4-7% air content for durability</li>
                  <li>Microscopic bubble formation</li>
                  <li>Critical for cold climate exposure</li>
                  <li>Improved workability as side benefit</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Set-Controlling Admixtures</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Accelerators</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Faster setting and early strength:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Calcium chloride (for non-reinforced concrete)</li>
                  <li>Non-chloride alternatives for reinforced work</li>
                  <li>Useful in cold weather conditions</li>
                  <li>Enables faster construction cycles</li>
                </ul>
              </div>

              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Retarders</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Extended workability and placement time:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Essential for hot weather concreting</li>
                  <li>Large pours requiring extended placement</li>
                  <li>Prevents cold joints in continuous pours</li>
                  <li>Allows better finishing quality</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Specialty Admixtures</h2>
            
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Admixture Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purpose</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Typical Dosage</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Applications</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Shrinkage Reducers</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Minimize drying shrinkage</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">1-2% by cement weight</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Slabs, overlays, repair work</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Corrosion Inhibitors</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Protect reinforcement</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">10-30 lbs/yd³</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Marine, bridge structures</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Viscosity Modifiers</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Improve cohesion</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">0.1-0.3% by cement weight</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Underwater, pumped concrete</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">Coloring Agents</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Architectural appearance</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">1-10% by cement weight</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">Decorative concrete</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50/90 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">Selection Guidelines</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Compatibility</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Test with specific cement</li>
                  <li>Check interaction effects</li>
                  <li>Verify with other admixtures</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Dosage Control</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Follow manufacturer guidelines</li>
                  <li>Account for ambient conditions</li>
                  <li>Monitor concrete performance</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Quality Assurance</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Verify certification standards</li>
                  <li>Maintain storage conditions</li>
                  <li>Document usage records</li>
                </ul>
              </div>
              
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Cost Analysis</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Initial cost vs. benefits</li>
                  <li>Long-term performance value</li>
                  <li>Construction time savings</li>
=======
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-4">
              Admixtures are specialized ingredients added to concrete mixes to tailor performance beyond what cement, water, and aggregates alone can achieve. By introducing chemical or mineral admixtures at the batching plant, contractors and engineers can enhance workability, control setting time, boost durability, and even reduce overall cost.
            </p>
            <p className="text-gray-700">
              The right admixture choice balances project demands—be it pumping high-slump concrete, finishing in hot weather, or ensuring long-term resistance to freeze–thaw cycles.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Chemical Admixtures</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Water Reducers</h3>
                <p className="text-gray-700 mb-4">
                  Water reducers, sometimes called plasticizers, improve concrete flow without increasing water content. They fall into three categories:
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admixture Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typical Dosage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Water Reduction</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Common Applications</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4">Normal (Type A)</td>
                        <td className="px-6 py-4">0.2 – 0.5%</td>
                        <td className="px-6 py-4">5–10%</td>
                        <td className="px-6 py-4">Slab-on-grade, sidewalks</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Mid-Range</td>
                        <td className="px-6 py-4">0.5 – 1.0%</td>
                        <td className="px-6 py-4">10–20%</td>
                        <td className="px-6 py-4">Pumped concrete, precast panels</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">High-Range</td>
                        <td className="px-6 py-4">1.0 – 2.5%</td>
                        <td className="px-6 py-4">20–30%</td>
                        <td className="px-6 py-4">Self-consolidating concrete, high-strength mixes</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Set Controllers</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Retarders (Type B)</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Slow hydration rate, extending working time by 1–4 hours</li>
                      <li>Typical dosage: 0.05–0.2% by cement weight</li>
                      <li>Useful in hot climates or large pours to prevent cold joints</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Accelerators (Type C)</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Speed up strength development, reducing set time by 20–50%</li>
                      <li>Calcium chloride: up to 2% by weight (may promote corrosion)</li>
                      <li>Non-chloride alternatives: 0.5–1% (preferred for reinforced concrete)</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Air-Entraining Agents</h3>
                <p className="text-gray-700 mb-4">
                  To withstand freeze–thaw exposure, air-entraining agents introduce uniformly distributed microscopic bubbles (spacing factor ≤ 0.20 mm).
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li><strong>Dosage:</strong> 0.02–0.1% by cement weight yields 4–7% air content</li>
                  <li><strong>Benefits:</strong> Each bubble acts as a pressure-relief chamber</li>
                  <li><strong>Trade-off:</strong> Every 1% of air can reduce compressive strength by ~5%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Mineral Admixtures</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Pozzolans</h3>
                <p className="text-gray-700 mb-4">
                  Pozzolans are fine, non-cementitious materials that react with calcium hydroxide to form additional cementitious compounds.
                </p>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pozzolan Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Replacement Rate</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key Advantages</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4">Fly Ash</td>
                        <td className="px-6 py-4">15–25%</td>
                        <td className="px-6 py-4">Improved workability, reduced permeability, lower heat</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Silica Fume</td>
                        <td className="px-6 py-4">5–10%</td>
                        <td className="px-6 py-4">High early strength, very low permeability</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">GGBFS</td>
                        <td className="px-6 py-4">30–50%</td>
                        <td className="px-6 py-4">Enhanced durability, lower thermal cracking</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Natural Pozzolans</td>
                        <td className="px-6 py-4">10–20%</td>
                        <td className="px-6 py-4">Cost-effective, sustainable, local resource</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Selection Factors</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Project Requirements</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>High-strength applications (≥40 MPa)</li>
                  <li>Workability needs</li>
                  <li>Environmental exposure</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Compatibility</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Cement type interactions</li>
                  <li>Multiple admixture sequencing</li>
                  <li>Aggregate effects</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Cost Analysis</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Material costs vs. benefits</li>
                  <li>Long-term durability savings</li>
                  <li>Local availability impact</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Quality Control</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Dosage accuracy requirements</li>
                  <li>Mixing time adjustments</li>
                  <li>Testing protocol updates</li>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
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