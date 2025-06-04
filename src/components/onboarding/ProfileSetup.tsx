import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Mail, Phone, MapPin, FileText, Save, ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import { useSettingsStore } from '../../store';

interface ProfileSetupProps {
  onBack: () => void;
  onComplete: () => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onBack, onComplete }) => {
  const navigate = useNavigate();
  const { companySettings, updateCompanySettings } = useSettingsStore();
  
  const [formData, setFormData] = useState({
    companyName: companySettings.companyName || '',
    email: companySettings.email || '',
    phone: companySettings.phone || '',
    address: companySettings.address || '',
    licenseNumber: companySettings.licenseNumber || '',
    motto: companySettings.motto || ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Update company settings
      await updateCompanySettings({
        ...companySettings,
        ...formData
      });

      // Mark onboarding as complete with error handling
      try {
        localStorage.setItem('onboarding_completed', 'true');
      } catch (storageError) {
        console.error('LocalStorage error:', storageError);
        // Continue even if localStorage fails
      }
      
      setTimeout(() => {
        setIsLoading(false);
        onComplete();
        try {
          navigate('/');
        } catch (navError) {
          console.error('Navigation error:', navError);
          window.location.href = '/';
        }
      }, 1500);
    } catch (error) {
      console.error('Error saving profile:', error);
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('onboarding_completed', 'true');
    } catch (error) {
      console.error('LocalStorage error:', error);
    }
    
    try {
      navigate('/');
    } catch (error) {
      console.error('Navigation error:', error);
      window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-blue-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
              Setup Your Profile
            </h1>
            <p className="text-gray-600">
              Tell us about your business to personalize your experience
            </p>
          </div>

          {/* Form Card */}
          <Card className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Company Name"
                  placeholder="Your Construction Company"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange('companyName', e.target.value)}
                  icon={<Building2 size={18} />}
                  required
                />

                <Input
                  label="Email Address"
                  type="email"
                  placeholder="contact@yourcompany.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  icon={<Mail size={18} />}
                  required
                />

                <Input
                  label="Phone Number"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  icon={<Phone size={18} />}
                />

                <Input
                  label="License Number"
                  placeholder="License #123456"
                  value={formData.licenseNumber}
                  onChange={(e) => handleInputChange('licenseNumber', e.target.value)}
                  icon={<FileText size={18} />}
                />
              </div>

              <Input
                label="Business Address"
                placeholder="123 Main St, Your City, State ZIP"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                icon={<MapPin size={18} />}
              />

              <Input
                label="Company Motto (Optional)"
                placeholder="Quality concrete solutions since 1995"
                value={formData.motto}
                onChange={(e) => handleInputChange('motto', e.target.value)}
              />

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  icon={<ArrowLeft size={18} />}
                  className="sm:w-auto"
                >
                  Back
                </Button>

                <div className="flex-1 flex flex-col sm:flex-row gap-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSkip}
                    className="sm:w-auto text-gray-500 hover:text-gray-700"
                  >
                    Skip for now
                  </Button>

                  <Button
                    type="submit"
                    disabled={isLoading || !formData.companyName || !formData.email}
                    icon={isLoading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Save size={18} />}
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-1"
                  >
                    {isLoading ? 'Saving...' : 'Save & Continue'}
                  </Button>
                </div>
              </div>
            </form>
          </Card>

          {/* Footer */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center mt-8 text-sm text-gray-500"
          >
            You can always update this information later in Settings
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProfileSetup; 