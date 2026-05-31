import React from 'react';
import { useProjects } from './useProjects';
import Select from '../../components/ui/Select';
import { calculateMixMaterials } from '../../utils/calculations';
import { CONCRETE_MIX_DESIGNS } from '../../types';
import {
  OPS_BODY,
  OPS_MUTED,
  OPS_TITLE,
} from '../../components/dashboard/opsTheme';

export default function MixDesignSection() {
  const { currentProject, ui } = useProjects();
  
  if (!currentProject) return null;

  const calculations = currentProject.calculations || [];
  const totalVolume = calculations.reduce((sum, c) => sum + c.result.volume, 0) * 
    (1 + parseInt(ui.wasteFactor) / 100);

  const mixDesign = calculateMixMaterials(totalVolume || 1, ui.selectedPsi as keyof typeof CONCRETE_MIX_DESIGNS);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${OPS_TITLE}`}>Concrete Mix Design</h3>
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
              <p className={`text-sm ${OPS_MUTED}`}>Portland Cement</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.materials.cement} yd³
              </p>
            </div>
            <div>
              <p className={`text-sm ${OPS_MUTED}`}>Fine Aggregate (Sand)</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.materials.sand} yd³
              </p>
            </div>
            <div>
              <p className={`text-sm ${OPS_MUTED}`}>Coarse Aggregate</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.materials.aggregate} yd³
              </p>
            </div>
            <div>
              <p className={`text-sm ${OPS_MUTED}`}>Water</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.materials.water} gal
              </p>
            </div>
            <div className="col-span-2 pt-2">
              <p className={`text-sm ${OPS_MUTED}`}>Slump Range</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.slump.min}" - {mixDesign.slump.max}"
              </p>
            </div>
            <div className="col-span-2">
              <p className={`text-sm ${OPS_MUTED}`}>Water/Cement Ratio</p>
              <p className={`text-lg font-semibold ${OPS_TITLE}`}>
                {mixDesign.waterCementRatio}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
