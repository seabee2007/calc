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
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Proper reinforcement is essential for concrete structures to resist tensile stresses, control cracking, and carry design loads safely. Depending on the type of structure, environmental conditions, and performance requirements, engineers can choose from traditional steel rebar, fiber blends, or prefabricated mesh systems.
            </p>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Steel Reinforcement</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Rebar Grades</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Rebar is the workhorse of reinforced concrete, providing high tensile strength. The grade indicates the minimum yield strength (psi) of the steel:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Grade</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Yield Strength</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Typical Uses</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Grade 40</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">40,000 psi (280 MPa)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Light-duty slabs, footings, non-structural walls</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Grade 60</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">60,000 psi (420 MPa)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Most common – beams, columns, slabs</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Grade 75</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">75,000 psi (520 MPa)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Heavily loaded members, long-span beams</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Grade 80</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">80,000 psi (550 MPa)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">High-strength custom applications, prestressed elements</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mt-4 italic">
                  Key Point: Higher-strength rebar can reduce steel area but may require extra care in welding and handling.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Placement Guidelines</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Concrete Cover</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Above footing: minimum 3 in. (75 mm)</li>
                      <li>Slabs-on-grade: 1–1.5 in. (25–40 mm)</li>
                      <li>Columns and beams: 1.5–2 in. (40–50 mm)</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Spacing & Alignment</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Maintain clear spacing ≥ 1.5 × aggregate maximum size</li>
                      <li>Use chairs, spacers, or bolsters to keep bars at design elevation</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Lap Splices & Development Length</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Lap length typically 40 × bar diameter for Grade 60</li>
                      <li>Development length depends on concrete strength, bar size, and coating</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Alternative Reinforcement</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Fiber Reinforcement</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Fibers dispersed throughout the concrete matrix help control crack widths and enhance toughness:
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Fiber Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Typical Dosage (kg/m³)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Primary Benefits</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Steel Fibers</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">15–40</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Increased post-crack strength, impact resistance</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Synthetic (Polypropylene)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">0.9–1.2</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Plastic shrinkage crack control, abrasion resistance</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Glass Fibers</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">0.5–1.0</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Moderate tensile strength, specialty architectural uses</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Natural (e.g., bamboo, sisal)</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">5–20</td>
                        <td className="px-6 py-4 text-gray-900 dark:text-white">Sustainable, low-cost, limited structural use</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Welded Wire Mesh</h3>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Standard Sizes & Spacing</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Common gauges: W1.4×W1.4 up to W4×W4 (wire diameter in eighths of an inch)</li>
                      <li>Typical grid: 4×4 in. to 6×6 in. spacing</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Installation Requirements</h4>
                    <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300">
                      <li>Lay mesh on full-height chairs to position at mid-depth of slabs</li>
                      <li>Overlap adjacent sheets by one full mesh spacing and tie securely</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Design Considerations</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Load Requirements</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Dead loads: Structure self-weight</li>
                  <li>Live loads: Occupancy, vehicles</li>
                  <li>Environmental loads: Wind, seismic</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Environmental Exposure</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Corrosion protection measures</li>
                  <li>Chemical resistance needs</li>
                  <li>Freeze-thaw considerations</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Construction Methods</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Placement techniques</li>
                  <li>Quality control measures</li>
                  <li>Inspection requirements</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Cost Factors</h3>
                <ul className="list-disc pl-5 text-blue-800 dark:text-blue-200">
                  <li>Material costs vs. benefits</li>
                  <li>Labor requirements impact</li>
                  <li>Long-term maintenance costs</li>
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