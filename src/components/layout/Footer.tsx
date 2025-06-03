import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import Modal from '../ui/Modal';
import TermsOfService from '../legal/TermsOfService';
import PrivacyPolicy from '../legal/PrivacyPolicy';
import ContactUs from '../legal/ContactUs';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showContact, setShowContact] = useState(false);
  
  return (
    <footer className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 w-full mt-auto">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8" style={{
        paddingLeft: 'max(env(safe-area-inset-left), 1rem)',
        paddingRight: 'max(env(safe-area-inset-right), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)'
      }}>
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center">
            <Calculator className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="ml-2 text-lg font-semibold text-gray-900 dark:text-white">ConcreteCalc</span>
          </div>
          
          <div className="flex flex-col md:flex-row md:space-x-8 text-sm text-gray-600 dark:text-gray-400 items-center">
            <button 
              onClick={() => setShowTerms(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 mb-2 md:mb-0"
            >
              Terms of Service
            </button>
            <button
              onClick={() => setShowPrivacy(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400 mb-2 md:mb-0"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setShowContact(true)}
              className="hover:text-blue-600 dark:hover:text-blue-400"
            >
              Contact Us
            </button>
          </div>
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 w-full">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              © {currentYear} ConcreteCalc. Made for Professionals.
            </p>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        title="Terms of Service"
        size="lg"
      >
        <TermsOfService />
      </Modal>

      <Modal
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacy Policy"
        size="lg"
      >
        <PrivacyPolicy />
      </Modal>

      <Modal
        isOpen={showContact}
        onClose={() => setShowContact(false)}
        title="Contact Us"
        size="md"
      >
        <ContactUs />
      </Modal>
    </footer>
  );
};

export default Footer;