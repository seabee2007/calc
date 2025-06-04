import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Layers, Zap, Trash2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { type ReinforcementSet } from '../../types/index';
import { soundService } from '../../services/soundService';

interface ReinforcementDetailsProps {
  reinforcements: ReinforcementSet[];
  onDelete?: (setId: string) => void;
}

// Interface for cut list items from database
interface CutListItemDB {
  id?: string;
  lengthFt: number;
  qty: number;
  direction?: 'X' | 'Y';
  barSize?: string;
}

// Helper function to format length display
const formatLength = (lengthFt: number): string => {
  const feet = Math.floor(lengthFt);
  const inches = Math.round((lengthFt - feet) * 12);
  
  if (inches === 0) {
    return `${feet}'`;
  } else if (inches === 12) {
    return `${feet + 1}'`;
  } else {
    return `${feet}' ${inches}"`;
  }
};

const ReinforcementDetails: React.FC<ReinforcementDetailsProps> = ({ 
  reinforcements, 
  onDelete 
}) => {
  if (!reinforcements || reinforcements.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <BarChart3 className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Reinforcement Designs</h3>
        <p className="text-gray-500 dark:text-gray-400">
          Create reinforcement designs from the calculator to see them here
        </p>
      </div>
    );
  }

  const getModeIcon = (type: string) => {
    switch (type) {
      case 'rebar': return <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'mesh': return <Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
      case 'fiber': return <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
      default: return <BarChart3 className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getModeColor = (type: string) => {
    switch (type) {
      case 'rebar': return 'blue';
      case 'mesh': return 'purple';
      case 'fiber': return 'orange';
      default: return 'gray';
    }
  };

  const getDimensionsBgClass = (type: string) => {
    switch (type) {
      case 'rebar': return 'bg-blue-50 dark:bg-blue-900/70';
      case 'mesh': return 'bg-purple-50 dark:bg-purple-900/70';
      case 'fiber': return 'bg-orange-50 dark:bg-orange-900/70';
      default: return 'bg-gray-50 dark:bg-gray-900/70';
    }
  };

  const getDimensionsTextClass = (type: string) => {
    switch (type) {
      case 'rebar': return 'text-blue-900 dark:text-blue-100';
      case 'mesh': return 'text-purple-900 dark:text-purple-100';
      case 'fiber': return 'text-orange-900 dark:text-orange-100';
      default: return 'text-gray-900 dark:text-gray-100';
    }
  };

  const getDimensionsLabelClass = (type: string) => {
    switch (type) {
      case 'rebar': return 'text-blue-700 dark:text-blue-300';
      case 'mesh': return 'text-purple-700 dark:text-purple-300';
      case 'fiber': return 'text-orange-700 dark:text-orange-300';
      default: return 'text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Reinforcement Designs ({reinforcements.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reinforcements.map((reinforcement) => {
          const color = getModeColor(reinforcement.reinforcement_type);
          const formattedDate = (() => {
            try {
              if (!reinforcement.createdAt) return '—';
              const date = parseISO(reinforcement.createdAt);
              if (isNaN(date.getTime())) return '—';
              return format(date, 'MMM d, yyyy h:mm a');
            } catch (error) {
              return '—';
            }
          })();

          return (
            <motion.div
              key={reinforcement.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group"
            >
              <Card className="p-6 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-shadow">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getModeIcon(reinforcement.reinforcement_type)}
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white capitalize">
                        {reinforcement.reinforcement_type} Design
                      </h4>
                      <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formattedDate}
                      </div>
                    </div>
                  </div>
                  
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        soundService.play('delete');
                        onDelete(reinforcement.id);
                      }}
                      icon={<Trash2 size={16} />}
                      className="text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    />
                  )}
                </div>

                {/* Dimensions */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
                  <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Dimensions
                  </h5>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Length:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">
                        {formatLength(reinforcement.length_ft)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Width:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">
                        {formatLength(reinforcement.width_ft)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Thickness:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">
                        {reinforcement.thickness_in}"
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Cover:</span>
                      <span className="ml-1 font-medium text-gray-900 dark:text-white">
                        {reinforcement.cover_in}"
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reinforcement Specific Details */}
                {reinforcement.reinforcement_type === 'rebar' && (
                  <RebarDetails reinforcement={reinforcement} />
                )}
                {reinforcement.reinforcement_type === 'fiber' && (
                  <FiberDetails reinforcement={reinforcement} />
                )}
                {reinforcement.reinforcement_type === 'mesh' && (
                  <MeshDetails reinforcement={reinforcement} />
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// Rebar Details Component
const RebarDetails: React.FC<{ reinforcement: ReinforcementSet }> = ({ reinforcement }) => {
  // Separate cut list items by direction
  const cutListX = reinforcement.cut_list_items?.filter((item: CutListItemDB) => item.direction === 'X') || [];
  const cutListY = reinforcement.cut_list_items?.filter((item: CutListItemDB) => item.direction === 'Y') || [];
  
  return (
    <div className="space-y-4">
      {/* Bar Information */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <h5 className="font-medium text-gray-900 dark:text-white mb-3">Bar Details</h5>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Size:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.bar_size || '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">X-Spacing:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.spacing_x_in ? `${reinforcement.spacing_x_in}" o.c.` : '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Y-Spacing:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.spacing_y_in ? `${reinforcement.spacing_y_in}" o.c.` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Bar Quantities */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
        <h5 className="font-medium text-gray-900 dark:text-white mb-3">Quantities</h5>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">X-Direction:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.total_bars_x || '—'} bars
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Y-Direction:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.total_bars_y || '—'} bars
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total Bars:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.total_bars || '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Linear Feet:</span>
            <span className="ml-1 font-medium text-gray-900 dark:text-white">
              {reinforcement.total_linear_ft ? reinforcement.total_linear_ft.toFixed(1) : '—'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Cut List Details */}
      {(cutListX.length > 0 || cutListY.length > 0) && (
        <div className="space-y-4">
          <h5 className="font-medium text-gray-900 dark:text-white">Cut List Details</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* X-Direction Cut List */}
            {cutListX.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <h6 className="font-medium text-gray-900 dark:text-white mb-3">X-Direction (Width)</h6>
                <div className="space-y-2">
                  {cutListX.map((item: CutListItemDB, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatLength(item.lengthFt)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.qty} bars
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Y-Direction Cut List */}
            {cutListY.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                <h6 className="font-medium text-gray-900 dark:text-white mb-3">Y-Direction (Length)</h6>
                <div className="space-y-2">
                  {cutListY.map((item: CutListItemDB, index: number) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                      <span className="text-gray-700 dark:text-gray-300">
                        {formatLength(item.lengthFt)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.qty} bars
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Fiber Details Component
const FiberDetails: React.FC<{ reinforcement: ReinforcementSet }> = ({ reinforcement }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
    <h5 className="font-medium text-gray-900 dark:text-white mb-3">Fiber Mix Details</h5>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
      <div>
        <span className="text-gray-600 dark:text-gray-400">Type:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white capitalize">
          {reinforcement.fiber_type || '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-600 dark:text-gray-400">Dosage:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.fiber_dose ? `${reinforcement.fiber_dose} lb/yd³` : '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-600 dark:text-gray-400">Total Weight:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.fiber_total_lb ? `${reinforcement.fiber_total_lb.toFixed(1)} lbs` : '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-600 dark:text-gray-400">Bags:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.fiber_bags || '—'}
        </span>
      </div>
    </div>
  </div>
);

// Mesh Details Component
const MeshDetails: React.FC<{ reinforcement: ReinforcementSet }> = ({ reinforcement }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
    <h5 className="font-medium text-gray-900 dark:text-white mb-3">Mesh Details</h5>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
      <div>
        <span className="text-gray-600 dark:text-gray-400">Sheet Size:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.mesh_sheet_size || '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-600 dark:text-gray-400">Sheets:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.mesh_sheets || '—'}
        </span>
      </div>
      <div>
        <span className="text-gray-600 dark:text-gray-400">Coverage:</span>
        <span className="ml-1 font-medium text-gray-900 dark:text-white">
          {reinforcement.length_ft && reinforcement.width_ft 
            ? `${(reinforcement.length_ft * reinforcement.width_ft).toFixed(0)} sq ft` 
            : '—'}
        </span>
      </div>
    </div>
  </div>
);

export default ReinforcementDetails; 