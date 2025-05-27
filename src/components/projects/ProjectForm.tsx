import React from 'react';
import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { Project } from '../../types';

interface ProjectFormProps {
  onSubmit: (data: { name: string; description: string }) => void;
  onCancel: () => void;
  initialData?: Pick<Project, 'name' | 'description'>;
  isEditing?: boolean;
  isModal?: boolean;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  isModal = false
}) => {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData || {
      name: '',
      description: ''
    }
  });

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {isEditing ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Project Name"
                fullWidth
                error={errors.name?.message?.toString()}
                {...register('name', { required: 'Project name is required' })}
              />
              
              <div>
                <label 
                  htmlFor="description" 
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  {...register('description')}
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onCancel}
                  icon={<X size={18} />}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  icon={<Save size={18} />}
                >
                  {isEditing ? 'Update Project' : 'Create Project'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {isEditing ? 'Edit Project' : 'Create New Project'}
      </h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Project Name"
          fullWidth
          error={errors.name?.message?.toString()}
          {...register('name', { required: 'Project name is required' })}
        />
        
        <div>
          <label 
            htmlFor="description" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            {...register('description')}
          />
        </div>
        
        <div className="flex justify-end space-x-3 pt-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            icon={<X size={18} />}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            icon={<Save size={18} />}
          >
            {isEditing ? 'Update Project' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default ProjectForm;