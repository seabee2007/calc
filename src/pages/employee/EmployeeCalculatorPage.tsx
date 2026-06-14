import React from 'react';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import ConstructionCalculator from '../../features/tools/construction-calculator/ui/ConstructionCalculator';

export default function EmployeeCalculatorPage() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Calculator className="h-8 w-8 shrink-0 text-cyan-400" aria-hidden />
        <h1 className="text-xl font-bold text-white">Arden Field Calculator</h1>
      </div>
      <p className="mb-4 text-sm text-slate-400">
        Feet-inch-fraction keypad, conversions, and trade calculators.
      </p>
      <ConstructionCalculator layout="field" />
      <Link
        to="/employee/dashboard"
        className="mt-6 inline-block text-sm font-medium text-cyan-400 hover:text-cyan-300"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
