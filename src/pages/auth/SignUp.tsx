import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import UserAgreement from '../../components/legal/UserAgreement';
import backgroundImage from '../../assets/images/bkgrnd.jpg';

interface SignUpForm {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  verificationAnswer: number;
}

const SignUp: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors }, setError } = useForm<SignUpForm>({
    defaultValues: {
      agreeToTerms: false
    }
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  
  // Human verification
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);
  const [operator, setOperator] = useState<'+' | '-' | 'x'>('x');
  
  useEffect(() => {
    generateVerificationQuestion();
  }, []);
  
  const generateVerificationQuestion = () => {
    const operators: Array<'+' | '-' | 'x'> = ['+', '-', 'x'];
    const newOperator = operators[Math.floor(Math.random() * operators.length)];
    
    let n1: number, n2: number;
    switch (newOperator) {
      case '+':
        n1 = Math.floor(Math.random() * 10) + 1;
        n2 = Math.floor(Math.random() * 10) + 1;
        break;
      case '-':
        n1 = Math.floor(Math.random() * 10) + 5;
        n2 = Math.floor(Math.random() * (n1 - 1)) + 1;
        break;
      case 'x':
        n1 = Math.floor(Math.random() * 5) + 1;
        n2 = Math.floor(Math.random() * 5) + 1;
        break;
      default:
        n1 = 1;
        n2 = 1;
    }
    
    setNum1(n1);
    setNum2(n2);
    setOperator(newOperator);
  };
  
  const getExpectedAnswer = (): number => {
    switch (operator) {
      case '+': return num1 + num2;
      case '-': return num1 - num2;
      case 'x': return num1 * num2;
      default: return 0;
    }
  };

  const onSubmit = async (data: SignUpForm) => {
    const expectedAnswer = getExpectedAnswer();
    if (data.verificationAnswer !== expectedAnswer) {
      setError('verificationAnswer', {
        type: 'manual',
        message: 'Incorrect answer. Please try again.'
      });
      generateVerificationQuestion();
      return;
    }

    try {
      setIsLoading(true);
      await signUp(data.email, data.password);
      navigate('/login', { 
        state: { 
          message: 'Account created successfully! Please sign in.' 
        }
      });
    } catch (error) {
      setError('root', {
        message: 'Error creating account. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      
      <div className="relative z-10 w-full max-w-md">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          icon={<ArrowLeft size={20} />}
          className="absolute top-0 left-0 -translate-y-16 text-white hover:text-blue-200"
        >
          Back
        </Button>

        <Card className="p-8">
          <div className="text-center mb-8">
            <UserPlus className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Create your account</h2>
            <p className="mt-2 text-sm text-gray-600">
              Or{' '}
              <button
                onClick={() => navigate('/login')}
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                sign in to existing account
              </button>
            </p>
          </div>

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

            <Input
              label="Confirm Password"
              type="password"
              icon={<Lock className="h-5 w-5 text-gray-400" />}
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

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  {...register('agreeToTerms', {
                    required: 'You must agree to the User Agreement to continue'
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="agreeToTerms" className="text-sm text-gray-600">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowAgreement(true)}
                    className="text-blue-600 hover:text-blue-500 font-medium"
                  >
                    User Agreement
                  </button>
                </label>
                {errors.agreeToTerms && (
                  <p className="text-sm text-red-600 mt-1">{errors.agreeToTerms.message}</p>
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center mb-2">
                <ShieldCheck className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="text-sm font-medium text-blue-900">Human Verification</h3>
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Please solve this simple math problem:
              </p>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-medium text-blue-900">
                  {num1} {operator} {num2} = ?
                </span>
              </div>
              <Input
                type="number"
                label="Your answer"
                error={errors.verificationAnswer?.message}
                {...register('verificationAnswer', {
                  required: 'Please answer the verification question',
                  valueAsNumber: true
                })}
                fullWidth
              />
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
              icon={<UserPlus size={18} />}
            >
              Create Account
            </Button>
          </form>
        </Card>
      </div>

      <Modal
        isOpen={showAgreement}
        onClose={() => setShowAgreement(false)}
        title="User Agreement"
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto">
          <UserAgreement />
        </div>
      </Modal>
    </div>
  );
};

export default SignUp;