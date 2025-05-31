import React from 'react';
import { Calculator, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useProjects } from './useProjects';

export default function CalculationSection() {
  const { currentProject, handlers } = useProjects();
  
  if (!currentProject) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calculations</h3>
        <Button
          onClick={() => handlers.navigateToCalculator(currentProject.id)}
          icon={<Calculator size={18} />}
        >
          <span className="hidden sm:inline">New Calculation</span>
        </Button>
      </div>
      
      {currentProject.calculations.length > 0 ? (
        <div className="space-y-4">
          {currentProject.calculations.map((calc) => (
            <Card key={calc.id} className="p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                      {calc.type.replace(/_/g, ' ')} Calculation
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlers.confirmDelete('calculation', calc.id)}
                      icon={<Trash2 size={16} />}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    />
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md mb-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {Object.entries(calc.dimensions)
                        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value.toFixed(2)}`)
                        .join(' | ')}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-900/50 p-2 rounded-md">
                      <p className="text-sm text-blue-700 dark:text-blue-300">Volume</p>
                      <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {calc.result.volume} yd³
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/50 p-2 rounded-md">
                      <p className="text-sm text-green-700 dark:text-green-300">Bags Required</p>
                      <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                        {calc.result.bags} bags
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Calculator className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">No calculations in this project yet</p>
          <Button 
            onClick={() => handlers.navigateToCalculator(currentProject.id)}
            icon={<Calculator size={18} />}
          >
            Add Calculation
          </Button>
        </div>
      )}
    </div>
  );
}