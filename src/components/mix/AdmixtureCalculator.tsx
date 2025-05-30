import React, { useState } from 'react';
import { Beaker, Thermometer, Droplets, Info } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Modal from '../ui/Modal';

interface AdmixtureCalculatorProps {
  temperature: number;
  unitsImperial?: boolean;
}

const AdmixtureCalculator: React.FC<AdmixtureCalculatorProps> = ({ 
  temperature,
  unitsImperial = true 
}) => {
  const [targetAir, setTargetAir] = useState<number>(6);
  const [wcReduction, setWcReduction] = useState<number>(5);
  const [showWcInfo, setShowWcInfo] = useState(false);

  const aeDosageRange = () => {
    const basePerPercent = 0.01;
    const baseLow = basePerPercent * targetAir * 0.8;
    const baseHigh = basePerPercent * targetAir * 1.2;
    
    const tempDelta = (temperature - 70) / 10;
    const factor = Math.max(0.6, Math.min(1.4, 1 - 0.15 * tempDelta));
    
    return [baseLow * factor, baseHigh * factor].map(v => (unitsImperial ? v : v * 0.0625));
  };

  const wrDosage = () => {
    const per1p = temperature > 85 ? 0.85 : 0.75;
    const oz = per1p * wcReduction;
    return [oz * 0.8, oz * 1.2];
  };

  const getAccelRetarder = () => {
    if (temperature <= 40) return { type: 'Accelerator', range: '2-4' };
    if (temperature <= 70) return { type: 'Accelerator', range: '1-2' };
    if (temperature <= 90) return { type: 'Retarder', range: '0.5-1' };
    return { type: 'Retarder', range: '1-2' };
  };

  const [aeLow, aeHigh] = aeDosageRange();
  const accelRetarder = getAccelRetarder();

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <Beaker className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Admixture Calculator</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Air Content (%)
          </label>
          <Input
            type="number"
            value={targetAir}
            onChange={(e) => setTargetAir(parseFloat(e.target.value))}
            min={0}
            max={10}
            step={0.5}
            fullWidth
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              W/C Ratio Reduction (%)
            </label>
            <button
              onClick={() => setShowWcInfo(true)}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <Input
            type="number"
            value={wcReduction}
            onChange={(e) => setWcReduction(parseFloat(e.target.value))}
            min={0}
            max={20}
            step={1}
            fullWidth
          />
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg space-y-3">
          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">Air-Entraining Agent</p>
            <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {aeLow.toFixed(3)}–{aeHigh.toFixed(3)} oz/cwt
            </p>
          </div>

          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">Water-Reducer</p>
            <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {wrDosage()[0].toFixed(1)}–{wrDosage()[1].toFixed(1)} oz/cwt
            </p>
          </div>

          <div>
            <p className="text-sm text-blue-700 dark:text-blue-300">{accelRetarder.type}</p>
            <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              {accelRetarder.range} oz/cwt
            </p>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Dosages are in ounces per hundredweight (oz/cwt) of cement.
            Adjust based on specific product instructions and field trials.
          </p>
        </div>
      </div>

      <Modal
        isOpen={showWcInfo}
        onClose={() => setShowWcInfo(false)}
        title="W/C Reduction Guide"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The W/C Reduction field accepts a whole number percentage (1-10) that indicates how much you want to reduce the water-to-cement ratio. The calculator will then determine the required water-reducer dosage to achieve this reduction.
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recommended Reductions by Job Type</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Job Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Typical Reduction</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Standard slab or sidewalk</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">3 – 5%</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Light reduction for durability without loss of workability</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">High-strength structural</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">5 – 8%</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Aggressive reduction; use high-range water reducer and superplasticizer</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">Decorative finish</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">1 – 3%</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">Preserve flow for troweling and stamping</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Example</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              If you enter 5%, and your base w/c ratio is 0.55, the resulting w/c ratio will be reduced to approximately 0.523 (a 5% reduction). The calculator will then show you the required water-reducer dosage to achieve this reduction.
            </p>
          </div>
        </div>
      </Modal>
    </Card>
  );
};

export default AdmixtureCalculator;