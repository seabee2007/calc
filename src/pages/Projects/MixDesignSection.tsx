import React from 'react';
import { useProjects } from './useProjects';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import { calculateMixMaterials } from '../../utils/calculations';
import { CONCRETE_MIX_DESIGNS } from '../../types';

export default function MixDesignSection() {
  const { currentProject, ui } = useProjects();
  
  if (!currentProject) return null;

  const calculations = currentProject.calculations || [];
  const totalVolume = calculations.reduce((sum, c) => sum + c.result.volume, 0) * 
    (1 + parseInt(ui.wasteFactor) / 100);

  const mixDesign = calculateMixMaterials(totalVolume || 1, ui.selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Concrete Mix Design</h3>
        <Select
          options={Object.entries(CONCRETE_MIX_DESIGNS).map(([psi]) => ({
            value: psi,
            label: `${psi} PSI`
          }))}
          value={ui.selectedPsi}
          onChange={(value) => ui.setUi(s => ({ ...s, selectedPsi: value }))}
        />
      </div>

      {currentProject.calculations.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Portland Cement</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.materials.cement} yd³
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Fine Aggregate (Sand)</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.materials.sand} yd³
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Coarse Aggregate</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.materials.aggregate} yd³
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Water</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.materials.water} gal
              </p>
            </div>
            <div className="col-span-2 pt-2">
              <p className="text-sm text-gray-600">Slump Range</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.slump.min}" - {mixDesign.slump.max}"
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Water/Cement Ratio</p>
              <p className="text-lg font-semibold text-gray-900">
                {mixDesign.waterCementRatio}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}