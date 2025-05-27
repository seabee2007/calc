import React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';

const ContactUs: React.FC = () => {
  return (
    <div className="text-center">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-center mb-2">
            <MapPin className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-medium">Address</h3>
          </div>
          <p className="text-gray-600">
            ConcreteCalc, LLC<br />
            1234 Builder's Way<br />
            San Francisco, CA 94107
          </p>
        </div>

        <div>
          <div className="flex items-center justify-center mb-2">
            <Mail className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-medium">Email</h3>
          </div>
          <a 
            href="mailto:support@concretecalc.com" 
            className="text-blue-600 hover:text-blue-800"
          >
            support@concretecalc.com
          </a>
        </div>

        <div>
          <div className="flex items-center justify-center mb-2">
            <Phone className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="font-medium">Phone</h3>
          </div>
          <a 
            href="tel:+1-555-123-4567" 
            className="text-blue-600 hover:text-blue-800"
          >
            +1 (555) 123-4567
          </a>
        </div>

        <div className="pt-6 border-t">
          <p className="text-gray-600">
            Our support team is available Monday through Friday,<br />
            9:00 AM to 5:00 PM Pacific Time.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;