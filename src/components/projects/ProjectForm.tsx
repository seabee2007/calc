import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Save, X, Calendar } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import USAddressFields from '../address/USAddressFields';
import { Project, USAddress } from '../../types';
import { EMPTY_US_ADDRESS } from '../../types/address';

export interface ProjectFormData {
  name: string;
  description: string;
  pourDate?: string;
  jobsiteAddress: USAddress;
}

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
  initialData?: Partial<ProjectFormData>;
  isEditing?: boolean;
  isModal?: boolean;
  submitLabel?: string;
  /** Hide pour date until placement planner (workflow / calculator). */
  hidePourDate?: boolean;
}

const defaultJobsite = (): USAddress => ({ ...EMPTY_US_ADDRESS });

const ProjectForm: React.FC<ProjectFormProps> = ({
  onSubmit,
  onCancel,
  initialData,
  isEditing = false,
  isModal = false,
  submitLabel,
  hidePourDate = false,
}) => {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProjectFormData>({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      pourDate: initialData?.pourDate ?? new Date().toISOString().split('T')[0],
      jobsiteAddress: initialData?.jobsiteAddress ?? defaultJobsite(),
    },
  });

  const formBody = (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
    >
      <Input
        label="Project Name"
        fullWidth
        error={errors.name?.message?.toString()}
        {...register('name', { required: 'Project name is required' })}
      />

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white"
          {...register('description')}
        />
      </div>

      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          Jobsite address
        </h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Used for weather, routing, and batch plant lookup in Placement Planner.
        </p>
        <Controller
          name="jobsiteAddress"
          control={control}
          render={({ field }) => (
            <USAddressFields
              value={field.value}
              onChange={field.onChange}
              showStreet2
              idPrefix="project-jobsite"
            />
          )}
        />
      </div>

      {!hidePourDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pour Date
          </label>
          <div className="relative">
            <Input
              type="date"
              icon={<Calendar size={18} />}
              {...register('pourDate')}
              fullWidth
            />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set the concrete pour date to track strength development
          </p>
        </div>
      )}

      <div className="flex justify-end space-x-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} icon={<X size={18} />}>
          Cancel
        </Button>
        <Button type="submit" icon={<Save size={18} />}>
          {submitLabel ?? (isEditing ? 'Update Project' : 'Create Project')}
        </Button>
      </div>
    </form>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {isEditing ? 'Edit Project' : 'Create New Project'}
              </h2>
              <button
                type="button"
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            {formBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        {isEditing ? 'Edit Project' : 'Create New Project'}
      </h2>
      {formBody}
    </Card>
  );
};

export default ProjectForm;
