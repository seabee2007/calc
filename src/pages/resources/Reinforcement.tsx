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
<<<<<<< HEAD
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
=======
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Proper reinforcement is essential for concrete structures to resist tensile stresses, control cracking, and carry design loads safely. Depending on the type of structure, environmental conditions, and performance requirements, engineers can choose from traditional steel rebar, fiber blends, or prefabricated mesh systems.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Steel Reinforcement</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Rebar Grades</h3>
                <p className="text-gray-700 mb-4">
                  Rebar is the workhorse of reinforced concrete, providing high tensile strength. The grade indicates the minimum yield strength (psi) of the steel:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yield Strength</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typical Uses</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4">Grade 40</td>
                        <td className="px-6 py-4">40,000 psi (280 MPa)</td>
                        <td className="px-6 py-4">Light-duty slabs, footings, non-structural walls</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Grade 60</td>
                        <td className="px-6 py-4">60,000 psi (420 MPa)</td>
                        <td className="px-6 py-4">Most common – beams, columns, slabs</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Grade 75</td>
                        <td className="px-6 py-4">75,000 psi (520 MPa)</td>
                        <td className="px-6 py-4">Heavily loaded members, long-span beams</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Grade 80</td>
                        <td className="px-6 py-4">80,000 psi (550 MPa)</td>
                        <td className="px-6 py-4">High-strength custom applications, prestressed elements</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-700 mt-4 italic">
                  Key Point: Higher-strength rebar can reduce steel area but may require extra care in welding and handling.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Placement Guidelines</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Concrete Cover</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Above footing: minimum 3 in. (75 mm)</li>
                      <li>Slabs-on-grade: 1–1.5 in. (25–40 mm)</li>
                      <li>Columns and beams: 1.5–2 in. (40–50 mm)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Spacing & Alignment</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Maintain clear spacing ≥ 1.5 × aggregate maximum size</li>
                      <li>Use chairs, spacers, or bolsters to keep bars at design elevation</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Lap Splices & Development Length</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Lap length typically 40 × bar diameter for Grade 60</li>
                      <li>Development length depends on concrete strength, bar size, and coating</li>
                    </ul>
                  </div>
                </div>
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              </div>
            </div>
          </div>

<<<<<<< HEAD
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
=======
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Alternative Reinforcement</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Fiber Reinforcement</h3>
                <p className="text-gray-700 mb-4">
                  Fibers dispersed throughout the concrete matrix help control crack widths and enhance toughness:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fiber Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Typical Dosage (kg/m³)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Primary Benefits</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4">Steel Fibers</td>
                        <td className="px-6 py-4">15–40</td>
                        <td className="px-6 py-4">Increased post-crack strength, impact resistance</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Synthetic (Polypropylene)</td>
                        <td className="px-6 py-4">0.9–1.2</td>
                        <td className="px-6 py-4">Plastic shrinkage crack control, abrasion resistance</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Glass Fibers</td>
                        <td className="px-6 py-4">0.5–1.0</td>
                        <td className="px-6 py-4">Moderate tensile strength, specialty architectural uses</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4">Natural (e.g., bamboo, sisal)</td>
                        <td className="px-6 py-4">5–20</td>
                        <td className="px-6 py-4">Sustainable, low-cost, limited structural use</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Welded Wire Mesh</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Standard Sizes & Spacing</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Common gauges: W1.4×W1.4 up to W4×W4 (wire diameter in eighths of an inch)</li>
                      <li>Typical grid: 4×4 in. to 6×6 in. spacing</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">Installation Requirements</h4>
                    <ul className="list-disc pl-5 text-gray-700">
                      <li>Lay mesh on full-height chairs to position at mid-depth of slabs</li>
                      <li>Overlap adjacent sheets by one full mesh spacing and tie securely</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Design Considerations</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Load Requirements</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Dead loads: Structure self-weight</li>
                  <li>Live loads: Occupancy, vehicles</li>
                  <li>Environmental loads: Wind, seismic</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Environmental Exposure</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Corrosion protection measures</li>
                  <li>Chemical resistance needs</li>
                  <li>Freeze-thaw considerations</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Construction Methods</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Placement techniques</li>
                  <li>Quality control measures</li>
                  <li>Inspection requirements</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Cost Factors</h3>
                <ul className="list-disc pl-5 text-blue-800">
                  <li>Material costs vs. benefits</li>
                  <li>Labor requirements impact</li>
                  <li>Long-term maintenance costs</li>
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

export default Reinforcement;