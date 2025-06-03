import React, { useState } from 'react';
import { Beaker } from 'lucide-react';
import Card from '../ui/Card';
import Input from '../ui/Input';

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
            onChange={(e) => setTargetAir(parseFloat(e.target.value) || 0)}
            min={0}
            max={10}
            step={0.5}
            placeholder="Enter target air content"
            fullWidth
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              W/C Ratio Reduction (%)
            </label>
          <Input
            type="number"
            value={wcReduction}
            onChange={(e) => setWcReduction(parseFloat(e.target.value) || 0)}
            min={0}
            max={20}
            step={1}
            placeholder="Enter W/C ratio reduction"
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
    </Card>
  );
};

export default AdmixtureCalculator;