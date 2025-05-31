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
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Even well-planned concrete projects can face issues like cracking, scaling, or discoloration. Understanding common problems, their root causes, and proven prevention strategies helps contractors deliver durable, aesthetically pleasing results while avoiding costly repairs.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Most concrete defects stem from improper mix design, inadequate curing, poor weather management, or construction practices that stress the material beyond its limits.
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Cracking Issues</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Plastic Shrinkage Cracks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Characteristics</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Appear within 1–4 hours of placement</li>
                      <li>Random pattern, typically 6 in. to 3 ft long</li>
                      <li>Shallow depth (1–2 in.) but can be wide</li>
                      <li>Often occur in hot, windy, or low-humidity conditions</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Prevention</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Use evaporation retarders or fog spray</li>
                      <li>Erect windbreaks around fresh concrete</li>
                      <li>Schedule pours during cooler parts of the day</li>
                      <li>Cover concrete with wet burlap immediately after finishing</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Drying Shrinkage Cracks</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Characteristics</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Develop weeks to months after placement</li>
                      <li>Follow regular patterns at joints or stress points</li>
                      <li>Often perpendicular to the direction of restraint</li>
                      <li>Width increases with time as moisture is lost</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Prevention</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Plan adequate control joints (max 24–36 × slab thickness)</li>
                      <li>Use lower w/c ratios where possible</li>
                      <li>Extend moist curing for at least 7 days</li>
                      <li>Include synthetic fibers (0.9–1.2 kg/m³) for crack control</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Thermal Cracking</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Characteristics</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Result from temperature differentials within the concrete</li>
                      <li>Common in thick pours (&gt;18 in.) or mass concrete</li>
                      <li>Can occur during early hydration or seasonal temperature swings</li>
                      <li>May extend through the full thickness of the member</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Prevention</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Use fly ash or slag to reduce heat of hydration</li>
                      <li>Cool aggregates or mixing water for large pours</li>
                      <li>Insulate surfaces to slow cooling rates</li>
                      <li>Plan construction joints to accommodate thermal movement</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Surface Problems</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Scaling & Spalling</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Common Causes</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li><strong>Freeze-thaw cycles:</strong> Inadequate air entrainment (target 4–7%)</li>
                      <li><strong>Chemical attack:</strong> Deicing salts penetrating weak surface paste</li>
                      <li><strong>Poor finishing:</strong> Overworking surface or adding water during finishing</li>
                      <li><strong>Early loading:</strong> Traffic before concrete reaches adequate strength</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Solutions</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Ensure proper air content with entrained air agent</li>
                      <li>Apply penetrating sealers 28 days after curing</li>
                      <li>Avoid overfinishing and never add water to the surface</li>
                      <li>Allow full strength development before heavy loads</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Discoloration</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Issue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Cause</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Prevention</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Efflorescence</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Soluble salts migrating to surface</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Low w/c, dense mix, proper curing</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Color Variations</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Inconsistent curing or water content</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Uniform curing, consistent batching</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Rust Stains</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Iron in aggregates or contamination</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Clean aggregates, proper material handling</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Remediation Strategies</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Minor Crack Repair</h3>
                <ul className="list-disc pl-5 text-yellow-800 dark:text-yellow-200 space-y-1">
                  <li>Clean crack thoroughly</li>
                  <li>Use epoxy injection for structural cracks</li>
                  <li>Apply polyurethane sealants for moving cracks</li>
                  <li>Monitor for recurring movement</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Surface Restoration</h3>
                <ul className="list-disc pl-5 text-yellow-800 dark:text-yellow-200 space-y-1">
                  <li>Remove loose or damaged material</li>
                  <li>Apply bonding agents to existing concrete</li>
                  <li>Use polymer-modified repair mortars</li>
                  <li>Match texture and color when possible</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Prevention Focus</h3>
                <ul className="list-disc pl-5 text-yellow-800 dark:text-yellow-200 space-y-1">
                  <li>Quality control during batching</li>
                  <li>Proper curing procedures</li>
                  <li>Weather protection measures</li>
                  <li>Regular maintenance inspections</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Professional Assessment</h3>
                <ul className="list-disc pl-5 text-yellow-800 dark:text-yellow-200 space-y-1">
                  <li>Structural evaluation for load-bearing members</li>
                  <li>Core testing for strength verification</li>
                  <li>Chemical analysis for durability issues</li>
                  <li>Long-term monitoring when needed</li>
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