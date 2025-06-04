import React, { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, BarChart3, Layers, Zap, X, Save } from 'lucide-react';
import {
  calculateRebar,
  calculateColumnRebar,
  calculateFiber,
  calculateMesh,
  generateCutListCSV,
  RebarResult,
  ColumnRebarResult,
  FiberResult,
  MeshResult,
  FiberType,
  DutyLevel,
  RebarSize,
  feetToFeetInches
} from '../../utils/reinforcement';
import { saveReinforcement } from '../../utils/saveReinforcement';
import { useProjectStore } from '../../store';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { generateReinforcementPDF } from '../../utils/pdf';

interface ReinforcementOptimizerProps {
  // TODO: Get these from calculator store
  calculatorData: {
    length_ft: number;
    width_ft: number;
    thickness_in: number;
    cubicYards: number;
    height_ft?: number; // For columns
  };
  projectName?: string;
  onClose?: () => void;
  onSaved?: (setId: string) => void;
  isColumn?: boolean; // New prop to indicate column mode
}

type ReinforcementMode = 'rebar' | 'mesh' | 'fiber';

const ReinforcementOptimizer: React.FC<ReinforcementOptimizerProps> = ({
  calculatorData,
  projectName,
  onClose,
  onSaved,
  isColumn = false
}) => {
  const { currentProject } = useProjectStore();
  
  const [coverIn, setCoverIn] = useState(isColumn ? 1.5 : 2);
  const [mode, setMode] = useState<ReinforcementMode>('rebar');
  const [fiberType, setFiberType] = useState<FiberType>('micro');
  const [duty, setDuty] = useState<DutyLevel>('med');
  const [stockLength, setStockLength] = useState(20);
  const [manualRebarSize, setManualRebarSize] = useState<'auto' | RebarSize>('auto');
  
  // New spacing controls
  const [spacingXIn, setSpacingXIn] = useState<number | ''>('');
  const [spacingYIn, setSpacingYIn] = useState<number | ''>('');
  const [verticalBars, setVerticalBars] = useState(4); // For columns
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Helper function to get spacing value for calculations (with defaults)
  const getSpacingValue = (spacing: number | '') => spacing === '' ? 12 : spacing;

  // Calculate results based on current settings
  const result = useMemo(() => {
    const { length_ft, width_ft, thickness_in, cubicYards, height_ft } = calculatorData;
    
    switch (mode) {
      case 'rebar':
        if (isColumn && height_ft) {
          return calculateColumnRebar(
            width_ft,
            length_ft,
            height_ft,
            coverIn,
            stockLength,
            manualRebarSize === 'auto' ? undefined : manualRebarSize as RebarSize,
            verticalBars
          );
        } else {
          return calculateRebar(
            length_ft, 
            width_ft, 
            thickness_in, 
            coverIn, 
            stockLength,
            manualRebarSize === 'auto' ? undefined : manualRebarSize as RebarSize,
            getSpacingValue(spacingXIn),
            getSpacingValue(spacingYIn)
          );
        }
      case 'fiber':
        return calculateFiber(cubicYards, fiberType, duty);
      case 'mesh':
        return calculateMesh(length_ft, width_ft);
      default:
        return null;
    }
  }, [calculatorData, mode, coverIn, fiberType, duty, stockLength, manualRebarSize, spacingXIn, spacingYIn, verticalBars, isColumn]);

  // Export functions
  const handleExportCSV = async () => {
    if (mode === 'rebar' && result) {
      try {
        const rebarResult = result as RebarResult | ColumnRebarResult;
        
        // Check if this is a column or slab result
        if (isColumn) {
          // For columns, create a simplified CSV with vertical and tie bars
          const columnResult = rebarResult as ColumnRebarResult;
          let csvContent = 'Type,Length (ft),Quantity,Bar Size\n';
          
          // Add vertical bars
          if (columnResult.verticalBars) {
            columnResult.verticalBars.forEach((item: any) => {
              csvContent += `Vertical Bar,${item.lengthFt.toFixed(1)},${item.qty},${columnResult.pick.size}\n`;
            });
          }
          
          // Add tie bars
          if (columnResult.tieList) {
            columnResult.tieList.forEach((item: any) => {
              csvContent += `Tie Bar,${item.lengthFt.toFixed(1)},${item.qty},${columnResult.pick.size}\n`;
            });
          }
          
          // Download CSV file
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `column-reinforcement-cutlist-${Date.now()}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          console.log('Column CSV export completed successfully');
        } else {
          // For slabs, use the existing CSV generation function
          const slabResult = rebarResult as RebarResult;
          const csvContent = generateCutListCSV(slabResult, {
            lengthFt: calculatorData.length_ft,
            widthFt: calculatorData.width_ft,
            thicknessIn: calculatorData.thickness_in,
            coverIn
          });
          
          // Download CSV file
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `slab-reinforcement-cutlist-${Date.now()}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          console.log('Slab CSV export completed successfully');
        }
        
      } catch (error) {
        console.error('Error exporting CSV:', error);
        alert('Failed to export CSV. Please try again.');
      }
    }
  };

  // TODO: Save to Supabase
  const handleSave = async () => {
    if (!result || isSaving) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      console.log('Starting save process...', { result, mode, isColumn });
      
      const saveOptions: any = {
        projectId: currentProject?.id,  // Link to current project
        projectName: projectName || 'Untitled Project',
        calc: {
          length_ft: calculatorData.length_ft,
          width_ft: calculatorData.width_ft,
          thickness_in: calculatorData.thickness_in,
          height_ft: calculatorData.height_ft,
        },
        coverIn,
        type: mode,
      };

      console.log('Basic save options:', saveOptions);

      // Add mode-specific data with complete information
      if (mode === 'rebar') {
        const rebarResult = result as RebarResult | ColumnRebarResult;
        
        if (isColumn) {
          // Column rebar data
          const columnResult = rebarResult as ColumnRebarResult;
          console.log('Saving column rebar data:', columnResult);
          
          Object.assign(saveOptions, {
            pickSize: columnResult.pick.size,
            verticalBars: columnResult.pick.verticalBars || verticalBars,
            totalBars: columnResult.totalBars,
            totalLinearFt: columnResult.totalLinearFt,
            // Note: Columns don't use X/Y spacing, they use vertical bar count
          });
        } else {
          // Slab rebar data
          const slabResult = rebarResult as RebarResult;
          console.log('Saving slab rebar data:', slabResult);
          
          Object.assign(saveOptions, {
            pickSize: slabResult.pick.size,
            spacingXIn: slabResult.pick.spacingXIn,
            spacingYIn: slabResult.pick.spacingYIn,
            totalBarsX: slabResult.listX?.reduce((sum, item) => sum + item.qty, 0) || 0,
            totalBarsY: slabResult.listY?.reduce((sum, item) => sum + item.qty, 0) || 0,
            totalBars: slabResult.totalBars,
            totalLinearFt: slabResult.totalLinearFt,
            cutListX: slabResult.listX || [],
            cutListY: slabResult.listY || [],
          });
        }
      } else if (mode === 'fiber') {
        const fiberResult = result as FiberResult;
        console.log('Saving fiber data:', fiberResult);
        
        Object.assign(saveOptions, {
          fiberData: {
            dose: fiberResult.dose,
            totalLb: fiberResult.totalLb,
            bags: fiberResult.bags,
            fiberType: fiberType,
          },
        });
      } else if (mode === 'mesh') {
        const meshResult = result as MeshResult;
        console.log('Saving mesh data:', meshResult);
        
        Object.assign(saveOptions, {
          meshData: {
            sheets: meshResult.sheets,
            sheetSize: meshResult.sheetSize,
          },
        });
      }

      console.log('Final save options:', saveOptions);
      
      const setId = await saveReinforcement(saveOptions);
      console.log('Save successful, setId:', setId);
      
      setSaveMessage({ text: 'Reinforcement design saved successfully! ✓', type: 'success' });
      onSaved?.(setId);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving reinforcement:', error);
      
      // More detailed error handling
      let errorMessage = 'Failed to save reinforcement design';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Common error cases
        if (error.message.includes('not authenticated')) {
          errorMessage = 'Please sign in to save reinforcement designs';
        } else if (error.message.includes('permission')) {
          errorMessage = 'You do not have permission to save designs';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection';
        }
      }
      
      setSaveMessage({ 
        text: errorMessage, 
        type: 'error' 
      });
      
      // Auto-hide error message after 5 seconds
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      console.log('Save process completed, resetting loading state');
      setIsSaving(false);
    }
  };

  // Add PDF download function
  const handleDownloadPDF = async () => {
    if (mode !== 'rebar' || !result) return;
    
    try {
      const rebarResult = result as RebarResult | ColumnRebarResult;
      const title = `${projectName || 'Project'} - Reinforcement Design`;
      
      await generateReinforcementPDF(rebarResult, {
        projectName: projectName || 'Reinforcement Design',
        calculatorData,
        coverIn,
        mode,
        isColumn,
        spacingXIn: getSpacingValue(spacingXIn),
        spacingYIn: getSpacingValue(spacingYIn),
        verticalBars
      }, title);
      
      console.log('Reinforcement PDF generated successfully');
    } catch (error) {
      console.error('Error generating reinforcement PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const getModeIcon = (currentMode: ReinforcementMode) => {
    switch (currentMode) {
      case 'rebar': return <BarChart3 size={20} />;
      case 'mesh': return <Layers size={20} />;
      case 'fiber': return <Zap size={20} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <Card className="w-full max-w-4xl my-4 bg-white dark:bg-gray-800/90 min-h-0">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Reinforcement Optimizer
            </h2>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              icon={<X size={18} />}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            />
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
          {/* Project Info */}
          <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-medium text-blue-900 dark:text-white mb-2">
              Project: {projectName || 'Current Calculation'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700 dark:text-gray-300">Length:</span>
                <span className="ml-1 font-medium text-blue-900 dark:text-white">{calculatorData.length_ft}'</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-gray-300">Width:</span>
                <span className="ml-1 font-medium text-blue-900 dark:text-white">{calculatorData.width_ft}'</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-gray-300">Thickness:</span>
                <span className="ml-1 font-medium text-blue-900 dark:text-white">{calculatorData.thickness_in}"</span>
              </div>
              <div>
                <span className="text-blue-700 dark:text-gray-300">Volume:</span>
                <span className="ml-1 font-medium text-blue-900 dark:text-white">{calculatorData.cubicYards.toFixed(2)} yd³</span>
              </div>
            </div>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className={`p-3 rounded-lg border ${
              saveMessage.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}>
              {saveMessage.text}
            </div>
          )}

          {/* Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Concrete Cover
              </label>
              <Select
                value={coverIn.toString()}
                onChange={(value) => setCoverIn(Number(value))}
                className="w-full"
                options={isColumn ? [
                  { value: '1.5', label: '1.5" columns' },
                  { value: '1.5', label: '1.5" interior walls' },
                  { value: '2', label: '2" exterior walls' }
                ] : [
                  { value: '1.5', label: '1.5" interior walls' },
                  { value: '2', label: '2" exterior walls' },
                  { value: '3', label: '3" slab on grade' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reinforcement Type
              </label>
              <Select
                value={mode}
                onChange={(value) => setMode(value as ReinforcementMode)}
                className="w-full"
                options={[
                  { value: 'rebar', label: isColumn ? 'Column Rebar' : 'Rebar Grid' },
                  { value: 'mesh', label: 'Steel Mesh' },
                  { value: 'fiber', label: 'Fiber Mix' }
                ]}
              />
            </div>

            {mode === 'rebar' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rebar Size
                  </label>
                  <Select
                    value={manualRebarSize}
                    onChange={(value) => setManualRebarSize(value as 'auto' | RebarSize)}
                    className="w-full"
                    options={[
                      { value: 'auto', label: 'Auto Select' },
                      { value: '#1', label: '#1 (1/8")' },
                      { value: '#2', label: '#2 (1/4")' },
                      { value: '#3', label: '#3 (3/8")' },
                      { value: '#4', label: '#4 (1/2")' },
                      { value: '#5', label: '#5 (5/8")' },
                      { value: '#6', label: '#6 (3/4")' },
                      { value: '#7', label: '#7 (7/8")' },
                      { value: '#8', label: '#8 (1")' }
                    ]}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Stock Length (ft)
                  </label>
                  <Input
                    type="number"
                    value={stockLength}
                    onChange={(e) => setStockLength(Number(e.target.value))}
                    min="10"
                    max="60"
                    step="5"
                  />
                </div>
              </>
            )}
          </div>

          {/* Additional Rebar Controls */}
          {mode === 'rebar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {isColumn ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Vertical Bars
                  </label>
                  <Input
                    type="number"
                    value={verticalBars}
                    onChange={(e) => setVerticalBars(Number(e.target.value))}
                    min="4"
                    max="20"
                    step="1"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      X-Direction Spacing (in)
                    </label>
                    <Input
                      type="number"
                      placeholder="12"
                      value={spacingXIn === '' ? '' : spacingXIn}
                      onChange={(e) => setSpacingXIn(e.target.value === '' ? '' : Number(e.target.value))}
                      min="1"
                      max="24"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Y-Direction Spacing (in)
                    </label>
                    <Input
                      type="number"
                      placeholder="12"
                      value={spacingYIn === '' ? '' : spacingYIn}
                      onChange={(e) => setSpacingYIn(e.target.value === '' ? '' : Number(e.target.value))}
                      min="1"
                      max="24"
                      step="1"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {mode === 'fiber' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fiber Type
                </label>
                <Select
                  value={fiberType}
                  onChange={(value) => setFiberType(value as FiberType)}
                  className="w-full"
                  options={[
                    { value: 'micro', label: 'Micro Poly' },
                    { value: 'macro', label: 'Macro Synthetic' },
                    { value: 'steel', label: 'Steel Fiber' }
                  ]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duty Level
                </label>
                <Select
                  value={duty}
                  onChange={(value) => setDuty(value as DutyLevel)}
                  className="w-full"
                  options={[
                    { value: 'light', label: 'Light Duty' },
                    { value: 'med', label: 'Medium Duty' },
                    { value: 'heavy', label: 'Heavy Duty' }
                  ]}
                />
              </div>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6 bg-gray-50 dark:bg-gray-800/90 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  {getModeIcon(mode)}
                  {mode === 'rebar' ? 'Rebar Design' : mode === 'fiber' ? 'Fiber Dosage' : 'Mesh Layout'}
                </h3>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    icon={isSaving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Save size={16} />}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <span className="md:hidden">Save</span>
                    <span className="hidden md:inline">{isSaving ? 'Saving...' : 'Save Design'}</span>
                  </Button>
                  
                  {mode === 'rebar' && (
                    <>
                      <Button
                        onClick={handleExportCSV}
                        icon={<Download size={16} />}
                        variant="outline"
                        className="md:min-w-0"
                      >
                        <span className="hidden md:inline">Export CSV</span>
                      </Button>
                      <Button
                        onClick={handleDownloadPDF}
                        icon={<Download size={16} />}
                        variant="outline"
                        className="md:min-w-0"
                      >
                        <span className="hidden md:inline">Download PDF</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {mode === 'rebar' && <RebarResults result={result as RebarResult | ColumnRebarResult} calculatorData={calculatorData} coverIn={coverIn} spacingXIn={getSpacingValue(spacingXIn)} spacingYIn={getSpacingValue(spacingYIn)} verticalBars={verticalBars} isColumn={isColumn} />}
              {mode === 'fiber' && <FiberResults result={result as FiberResult} fiberType={fiberType} />}
              {mode === 'mesh' && <MeshResults result={result as MeshResult} />}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
};

// Result Components
const RebarResults: React.FC<{ 
  result: RebarResult | ColumnRebarResult; 
  calculatorData: any; 
  coverIn: number; 
  spacingXIn: number; 
  spacingYIn: number; 
  verticalBars: number;
  isColumn?: boolean;
}> = ({ result, calculatorData, coverIn, spacingXIn, spacingYIn, verticalBars, isColumn = false }) => {
  
  if (isColumn) {
    // Column rebar results
    const columnResult = result as ColumnRebarResult;
    const { pick, verticalBars: vBars, tieList, totalBars, totalLinearFt } = columnResult;
    
    const clearHeightFt = calculatorData.height_ft - (2 * coverIn) / 12;
    const lapSpliceIn = 40 * (pick.size === '#1' ? 0.125 : 
                              pick.size === '#2' ? 0.25 :
                              pick.size === '#3' ? 0.375 :
                              pick.size === '#4' ? 0.5 :
                              pick.size === '#5' ? 0.625 :
                              pick.size === '#6' ? 0.75 :
                              pick.size === '#7' ? 0.875 : 1.0);

    return (
      <div className="space-y-6">
        {/* Design Summary */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Column Design Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Cover:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{coverIn}"</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Clear Height:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{feetToFeetInches(clearHeightFt).display}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Vertical Bars:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{pick.verticalBars} × {pick.size}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Lap Splice:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{lapSpliceIn}"</span>
            </div>
          </div>
        </div>

        {/* Cut Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vertical Bars */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Vertical Bars</h4>
            <div className="space-y-2">
              {vBars.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <span className="text-gray-700 dark:text-gray-300">
                    {feetToFeetInches(item.lengthFt).display}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.qty} bars
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tie Bars */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Tie Bars</h4>
            <div className="space-y-2">
              {tieList.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <span className="text-gray-700 dark:text-gray-300">
                    {feetToFeetInches(item.lengthFt).display}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.qty} ties
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalBars}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Total Bars</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalLinearFt.toFixed(1)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Linear Feet</div>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Slab rebar results
    const slabResult = result as RebarResult;
    const { pick, listX, listY, totalBars, totalLinearFt } = slabResult;
    
    // Calculate some helper values for display
    const clearLengthFt = calculatorData.length_ft - (2 * coverIn) / 12;
    const clearWidthFt = calculatorData.width_ft - (2 * coverIn) / 12;
    const lapSpliceIn = 30 * (pick.size === '#1' ? 0.125 : 
                              pick.size === '#2' ? 0.25 :
                              pick.size === '#3' ? 0.375 :
                              pick.size === '#4' ? 0.5 :
                              pick.size === '#5' ? 0.625 :
                              pick.size === '#6' ? 0.75 :
                              pick.size === '#7' ? 0.875 : 1.0);

    return (
      <div className="space-y-6">
        {/* Design Summary */}
        <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Slab Design Summary</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Cover:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{coverIn}"</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Clear Length:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{feetToFeetInches(clearLengthFt).display}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Clear Width:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{feetToFeetInches(clearWidthFt).display}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Lap Splice:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{lapSpliceIn}"</span>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Bar Size:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{pick.size}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">X-Spacing:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{pick.spacingXIn}" o.c.</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Y-Spacing:</span>
              <span className="ml-1 font-medium text-gray-900 dark:text-white">{pick.spacingYIn}" o.c.</span>
            </div>
          </div>
        </div>

        {/* Cut Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* X-Direction */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">X-Direction (Width)</h4>
            <div className="space-y-2">
              {listX.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <span className="text-gray-700 dark:text-gray-300">
                    {feetToFeetInches(item.lengthFt).display}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.qty} bars
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Y-Direction */}
          <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Y-Direction (Length)</h4>
            <div className="space-y-2">
              {listY.map((item, index) => (
                <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                  <span className="text-gray-700 dark:text-gray-300">
                    {feetToFeetInches(item.lengthFt).display}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {item.qty} bars
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Totals */}
        <div className="bg-blue-50 dark:bg-blue-900/50 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalBars}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Total Bars</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalLinearFt.toFixed(1)}</div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Linear Feet</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

const FiberResults: React.FC<{ result: FiberResult; fiberType: FiberType }> = ({ 
  result, 
  fiberType 
}) => {
  const { dose, totalLb, bags, bagWeight } = result;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">Dosage Rate</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {dose} lb/yd³
        </div>
      </div>
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">Total Weight</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {totalLb.toFixed(1)} lbs
        </div>
      </div>
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Bags ({bagWeight} lb {fiberType === 'steel' ? 'steel' : 'synthetic'})
        </div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {bags} bags
        </div>
      </div>
    </div>
  );
};

const MeshResults: React.FC<{ result: MeshResult }> = ({ result }) => {
  const { sheets, sheetSize, totalSqFt } = result;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">Sheet Size</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {sheetSize}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">Sheets Needed</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {sheets} sheets
        </div>
      </div>
      <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="text-sm text-gray-600 dark:text-gray-300">Coverage</div>
        <div className="text-xl font-bold text-gray-900 dark:text-white">
          {totalSqFt} sq ft
        </div>
      </div>
    </div>
  );
};

export default ReinforcementOptimizer; 