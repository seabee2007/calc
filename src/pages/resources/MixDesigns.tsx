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
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Defining Requirements</h2>
            <p className="text-gray-700 mb-4">
              Every successful mix design begins by asking, "What do I need this concrete to do?" If you're pouring a home foundation, you might need a compressive strength of 25–30 MPa (3,600–4,350 psi). A driveway slab might only need 20 MPa (2,900 psi), but must resist freeze–thaw cycles in winter. Structural beams often call for 35–40 MPa (5,000–5,800 psi) so they safely carry heavy loads.
            </p>
            <p className="text-gray-700 mb-4">
              In each case, you also think about durability. For a sidewalk exposed to deicing salts, you'll plan for air-entrainment to resist cracking, and perhaps a sulfate-resistant cement if the soil contains harmful chemicals. Finally, consider how you'll place the concrete: pumping long distances requires a more fluid mix (higher slump), while hand-placing around tightly spaced reinforcement may call for a stiffer mix (lower slump).
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Material Selection</h2>
            <p className="text-gray-700 mb-4">
              Once you know the project's needs, you choose the ingredients. For general-purpose work, Type I Portland cement is a solid choice; for moderate sulfate exposure, Type II; for marine or aggressive soils, Type V. Next, pick your aggregates: clean, hard sand (0–4.75 mm) and crushed stone or gravel (5–20 mm is typical for slabs).
            </p>
            <p className="text-gray-700 mb-4">
              You check the grading curve of each to make sure smaller and larger particles fill the gaps well—this improves both strength and workability. The water must be free of oil, acid, or salts, so you use potable water on site. If you know the concrete must endure freezing and thawing, you add an air-entraining agent at about 0.05% by cement weight (roughly 200 mL per 100 kg of cement). To keep the mix fluid without extra water, you might use a mid-range water reducer at about 1% dosage.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Basic Mix Components</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Portland Cement Types</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li><strong>Type I:</strong> General-purpose cement for sidewalks, foundations, and buildings</li>
                  <li><strong>Type II:</strong> Offers moderate sulfate resistance—ideal where soil or groundwater carries sulfates</li>
                  <li><strong>Type III:</strong> High-early-strength cement, useful when you need the concrete to carry loads quickly</li>
                  <li><strong>Type IV:</strong> Produces low heat during hydration, reducing cracking risk in large pours</li>
                  <li><strong>Type V:</strong> Provides the highest sulfate resistance for very aggressive environments</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Aggregates</h3>
                <p className="text-gray-700 mb-2">
                  Aggregates make up 60–75% of concrete by volume, lowering cost and shrinkage while boosting strength:
                </p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li><strong>Fine aggregates (sand):</strong> Particles up to 4.75 mm in size</li>
                  <li><strong>Coarse aggregates:</strong> Particles typically between 4.75 and 150 mm</li>
                  <li><strong>Well-graded aggregates:</strong> A range of sizes that pack tightly, improving workability and strength</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Water</h3>
                <p className="text-gray-700 mb-2">The water–cement (w/c) ratio controls strength and workability:</p>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li><strong>Low w/c (0.35):</strong> Higher strength, but stiffer mix that can be hard to place</li>
                  <li><strong>High w/c (0.55):</strong> More fluid mix, easier to pour, but lower ultimate strength</li>
                  <li><strong>Typical range:</strong> 0.40 to 0.50 for structural concrete</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">Admixtures</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li><strong>Air-entraining agents:</strong> Introduce tiny bubbles to resist freeze–thaw damage</li>
                  <li><strong>Plasticizers:</strong> Achieve desired slump with less water, boosting strength</li>
                  <li><strong>Retarders/Accelerators:</strong> Control setting time based on weather conditions</li>
                  <li><strong>Pozzolans:</strong> Replace part of cement to improve durability and reduce heat</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Example Mix Designs</h2>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Strength</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">w/c Ratio</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cement (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Water (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fine Agg. (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Coarse Agg. (kg)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Air Content (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">25 MPa (≈3,600 psi)</td>
                    <td className="px-6 py-4 whitespace-nowrap">0.50</td>
                    <td className="px-6 py-4 whitespace-nowrap">320</td>
                    <td className="px-6 py-4 whitespace-nowrap">160</td>
                    <td className="px-6 py-4 whitespace-nowrap">720</td>
                    <td className="px-6 py-4 whitespace-nowrap">1,080</td>
                    <td className="px-6 py-4 whitespace-nowrap">2.0</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">30 MPa (≈4,350 psi)</td>
                    <td className="px-6 py-4 whitespace-nowrap">0.45</td>
                    <td className="px-6 py-4 whitespace-nowrap">360</td>
                    <td className="px-6 py-4 whitespace-nowrap">162</td>
                    <td className="px-6 py-4 whitespace-nowrap">690</td>
                    <td className="px-6 py-4 whitespace-nowrap">1,070</td>
                    <td className="px-6 py-4 whitespace-nowrap">2.0</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap">40 MPa (≈5,800 psi)</td>
                    <td className="px-6 py-4 whitespace-nowrap">0.40</td>
                    <td className="px-6 py-4 whitespace-nowrap">400</td>
                    <td className="px-6 py-4 whitespace-nowrap">160</td>
                    <td className="px-6 py-4 whitespace-nowrap">660</td>
                    <td className="px-6 py-4 whitespace-nowrap">1,040</td>
                    <td className="px-6 py-4 whitespace-nowrap">2.0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Trial Mixes and Testing</h2>
            <p className="text-gray-700 mb-4">
              Before you pour thousands of liters, you verify your design in the lab or on a small batch plant. You weigh out materials exactly as calculated and mix them thoroughly. First, you measure slump: if it's more than 25 mm off your target, you adjust water or admixture dosage.
            </p>
            <p className="text-gray-700 mb-4">
              Next, you cast cylinders for compressive strength tests at 7 and 28 days. If the 7-day strength is too low, you might increase cement by 10 kg/m³ or reduce w/c by 0.02. You also check air content with a pressure meter: if it's under 1.2% when you wanted 1.5%, you add a bit more air-entrainer.
            </p>
          </div>

          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Key Considerations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Cost Optimization</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  <li>Minimize cement content while meeting strength requirements</li>
                  <li>Balance material costs with performance needs</li>
                  <li>Consider local material availability</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Workability</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  <li>Match slump to placement method</li>
                  <li>Consider temperature effects</li>
                  <li>Account for reinforcement spacing</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Durability</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  <li>Select appropriate w/c ratio for exposure</li>
                  <li>Include air entrainment when needed</li>
                  <li>Choose correct cement type</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Quality Control</h3>
                <ul className="list-disc list-inside text-blue-800 space-y-1">
                  <li>Regular material testing</li>
                  <li>Consistent batching procedures</li>
                  <li>Proper documentation</li>
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