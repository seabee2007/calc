import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm<ResetPasswordForm>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const onSubmit = async (data: ResetPasswordForm) => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) throw error;

      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (error) {
      setError('root', {
        message: 'Error resetting password. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <KeyRound className="mx-auto h-12 w-12 text-blue-600 dark:text-blue-400" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Reset Password</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Enter your new password below
          </p>
        </div>

        {isSuccess ? (
          <div className="bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-700 rounded-md p-4 text-center">
            <p className="text-green-800 dark:text-green-200">
              Password has been reset successfully! Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input
              label="New Password"
              type="password"
              icon={<Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
              error={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters'
                }
              })}
              fullWidth
            />

            <Input
              label="Confirm Password"
              type="password"
              icon={<Lock className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (val: string) => {
                  if (watch('password') !== val) {
                    return 'Passwords do not match';
                  }
                }
              })}
              fullWidth
            />

            {errors.root && (
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                {errors.root.message}
              </p>
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={isLoading}
              icon={<KeyRound size={18} />}
            >
              Reset Password
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
};

export default ResetPassword;