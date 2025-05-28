import React from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, setError, watch } = useForm<LoginForm>();
  const [isLoading, setIsLoading] = React.useState(false);
  const [resetEmailSent, setResetEmailSent] = React.useState(false);
  const [resetError, setResetError] = React.useState<string | null>(null);
  
  const emailValue = watch('email');

  const onSubmit = async (data: LoginForm) => {
    try {
      setIsLoading(true);
      await signIn(data.email, data.password);
      navigate('/'); // Changed from '/projects' to '/'
    } catch (error) {
      setError('root', {
        message: 'Invalid email or password'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!emailValue) {
      setResetError('Please enter your email address first');
      return;
    }

    try {
      setIsLoading(true);
      setResetError(null);

      const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${origin}/reset-password`,
      });
      
      if (error) throw error;
      
      setResetEmailSent(true);
      setResetError(null);
    } catch (error: any) {
      setResetError(error.message || 'Error sending password reset email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex flex-col relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative z-10 p-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          icon={<ArrowLeft size={20} />}
          className="text-white hover:text-blue-200"
        >
          Back
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <LogIn className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to your account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <button
                onClick={() => navigate('/signup')}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                create a new account
              </button>
            </p>
          </div>

          {resetEmailSent ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 text-center">
              <p className="text-green-800">
                If an account exists with {emailValue}, password reset instructions have been sent.
                Please check your email inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Input
                label="Email address"
                type="email"
                icon={<Mail className="h-5 w-5 text-gray-400" />}
                error={errors.email?.message}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'Invalid email address'
                  }
                })}
                fullWidth
              />

              <div>
                <Input
                  label="Password"
                  type="password"
                  icon={<Lock className="h-5 w-5 text-gray-400" />}
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
                <div className="mt-2 flex flex-col space-y-2">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                  >
                    Forgot your password?
                  </button>
                  {resetError && (
                    <p className="text-sm text-red-600">
                      {resetError}
                    </p>
                  )}
                </div>
              </div>

              {errors.root && (
                <p className="text-sm text-red-600 text-center">
                  {errors.root.message}
                </p>
              )}

              <Button
                type="submit"
                fullWidth
                isLoading={isLoading}
                icon={<LogIn size={18} />}
              >
                Sign in
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;