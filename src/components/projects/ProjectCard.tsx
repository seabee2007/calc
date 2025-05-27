import React from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { Folder, Clock, Calculator, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Project } from '../../types';

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
              <div className="p-2 bg-blue-100 rounded-lg">
                <Folder className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="ml-3 text-lg font-semibold text-gray-900 truncate">
                {project.name}
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              icon={<Trash2 size={16} />}
              className="text-gray-400 hover:text-red-600"
            />
          </div>
          
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {project.description || 'No description provided'}
          </p>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{formattedDate}</span>
            </div>
            
            <div className="flex items-center">
              <Calculator className="h-4 w-4 mr-1" />
              <span>{project.calculations?.length ?? 0} calculations</span>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProjectCard;