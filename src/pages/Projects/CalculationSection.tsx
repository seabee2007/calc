import React from 'react';
import { Calculator, Trash2, Plus } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { useProjects } from './useProjects';
import { soundService } from '../../services/soundService';
import {
  OPS_BODY,
  OPS_EMPTY_STATE,
  OPS_MUTED,
  OPS_PANEL_INNER,
  OPS_TITLE,
} from '../../components/dashboard/opsTheme';

export default function CalculationSection() {
  const { currentProject, handlers } = useProjects();
  
  if (!currentProject) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-lg font-semibold ${OPS_TITLE}`}>Calculations</h3>
        <Button
          variant="accent"
          onClick={() => handlers.navigateToCalculator(currentProject.id)}
          icon={<Calculator size={18} />}
        >
          <span className="hidden sm:inline">New Calculation</span>
        </Button>
      </div>
      
      {currentProject.calculations.length > 0 ? (
        <div className="space-y-4">
          {currentProject.calculations.map((calc) => (
            <Card key={calc.id} className={`p-4 ${OPS_PANEL_INNER}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-medium capitalize ${OPS_TITLE}`}>
                      {calc.type.replace(/_/g, ' ')} Calculation
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        soundService.play('trash');
                        handlers.confirmDelete('calculation', calc.id);
                      }}
                      icon={<Trash2 size={16} />}
                      className="text-red-600 hover:text-red-700"
                    />
                  </div>
                  
                  <div className={`${OPS_PANEL_INNER} p-3 mb-3`}>
                    <p className={`text-sm ${OPS_BODY}`}>
                      {Object.entries(calc.dimensions)
                        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value.toFixed(2)}`)
                        .join(' | ')}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className={`${OPS_PANEL_INNER} p-2`}>
                      <p className={`text-sm ${OPS_MUTED}`}>Volume</p>
                      <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                        {calc.result.volume} yd³
                      </p>
                    </div>
                    <div className={`${OPS_PANEL_INNER} p-2`}>
                      <p className={`text-sm ${OPS_MUTED}`}>Bags Required</p>
                      <p className={`text-lg font-semibold ${OPS_TITLE}`}>
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
        <div className={OPS_EMPTY_STATE}>
          <Calculator className={`h-12 w-12 ${OPS_MUTED} mx-auto mb-4`} />
          <p className={`${OPS_MUTED} mb-4`}>No calculations in this project yet</p>
          <Button 
            variant="accent"
            onClick={() => handlers.navigateToCalculator(currentProject.id)}
            icon={<Plus size={18} />}
          >
            Add Calculation
          </Button>
        </div>
      )}
    </div>
  );
}
