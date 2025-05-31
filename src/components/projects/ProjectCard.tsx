import React from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
<<<<<<< HEAD
import { Folder, Clock, Calculator, Trash2, BarChart3 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Project, ReinforcementSet } from '../../types';
=======
import { Folder, Clock, Calculator, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Project } from '../../types';
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, onClick, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const formattedDate = (() => {
    try {
      if (!project.updatedAt) return '—';
      const date = parseISO(project.updatedAt);
      if (isNaN(date.getTime())) {
        console.error('Invalid date:', project.updatedAt);
        return '—';
      }
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '—';
    }
  })();

<<<<<<< HEAD
  const reinforcementCount = project.reinforcements?.length || 0;
  const hasRebar = project.reinforcements?.some((r: ReinforcementSet) => r.reinforcement_type === 'rebar') || false;
  const hasFiber = project.reinforcements?.some((r: ReinforcementSet) => r.reinforcement_type === 'fiber') || false;
  const hasMesh = project.reinforcements?.some((r: ReinforcementSet) => r.reinforcement_type === 'mesh') || false;

=======
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className="cursor-pointer h-full"
        shadow="md"
        onClick={onClick}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Folder className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 dark:text-white truncate">
                {project.name}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              icon={<Trash2 size={16} />}
              className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400"
            />
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
            {project.description || 'No description provided'}
          </p>
          
<<<<<<< HEAD
          {/* Reinforcement Summary */}
          {reinforcementCount > 0 && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center mb-2">
                <BarChart3 className="h-4 w-4 text-green-600 dark:text-green-400 mr-2" />
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  {reinforcementCount} Reinforcement Design{reinforcementCount > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {hasRebar && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                    Rebar
                  </span>
                )}
                {hasFiber && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300">
                    Fiber
                  </span>
                )}
                {hasMesh && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300">
                    Mesh
                  </span>
                )}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
=======
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex items-center">
<<<<<<< HEAD
              <Calculator className="h-4 w-4 mr-1 text-gray-400 dark:text-gray-500" />
=======
              <Calculator className="h-4 w-4 mr-1" />
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
              <span>{project.calculations?.length ?? 0} calculations</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;