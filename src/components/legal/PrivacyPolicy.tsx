import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="prose prose-sm max-w-none">
      <section className="mb-6">
        <p className="text-sm text-gray-500 mb-4">Last Updated: May 22, 2025</p>
        
        <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
        <p>
          Welcome to ConcreteCalc (the "App"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our App. By accessing or using the App, you agree to the terms of this Privacy Policy.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">2. Information We Collect</h3>
        
        <h4 className="font-medium mb-2">2.1 Location Data</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Purpose:</strong> To provide localized weather information that informs concrete curing recommendations.</li>
          <li><strong>Type:</strong> Approximate or precise geographic location (latitude/longitude).</li>
          <li><strong>Collection Method:</strong> We request your permission to access your device's location services.</li>
        </ul>

        <h4 className="font-medium mt-4 mb-2">2.2 User-Submitted Data</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Purpose:</strong> To save your project inputs and results for future reference.</li>
          <li><strong>Type:</strong> Textual and numeric data (e.g., lengths, widths, fractions, calculation settings).</li>
        </ul>

        <h4 className="font-medium mt-4 mb-2">2.3 Usage Data & Diagnostics</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Purpose:</strong> To operate and improve the App, monitor performance, and diagnose technical issues.</li>
          <li><strong>Type:</strong> Device identifiers, App version, operating system, timestamped logs, and error reports.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">3. Data Storage & Security</h3>
        
        <h4 className="font-medium mb-2">3.1 Supabase Online Database</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li>All user-submitted and usage data (other than location) are stored securely in our Supabase database hosted in the United States.</li>
          <li>Supabase implements industry-standard security measures, including encryption at rest, network isolation, and regular audits.</li>
        </ul>

        <h4 className="font-medium mt-4 mb-2">3.2 Security Measures</h4>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Encryption:</strong> All data in transit between your device and our servers is encrypted using TLS.</li>
          <li><strong>Access Controls:</strong> Limited to authorized personnel; multi-factor authentication is enforced.</li>
          <li><strong>Data Minimization:</strong> We collect only the data necessary to deliver features.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">4. How We Use Your Information</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Provide & Personalize Services:</strong> Use location to tailor weather-based recommendations and store your project data for quick retrieval.</li>
          <li><strong>Improve the App:</strong> Analyze usage patterns and error logs to enhance functionality and fix bugs.</li>
          <li><strong>Communicate:</strong> Send you service-related notifications or reply to support inquiries.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">5. Data Sharing & Disclosure</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>We do <strong>not</strong> sell, trade, or rent your personal data to third parties.</li>
          <li>We may disclose information if required by law or to protect our rights and property.</li>
          <li>We use third-party service providers (e.g., Supabase) under strict confidentiality agreements.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">6. Your Rights & Choices</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Access & Correction:</strong> You can view and update your stored project data within the App.</li>
          <li><strong>Location Permission:</strong> You may disable location access at any time; note that weather features will no longer function without it.</li>
          <li><strong>Data Deletion:</strong> You can request deletion of your account and all associated data by contacting us (see Section 11).</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">7. Data Retention</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li>We retain your project and usage data for as long as your account is active or as needed to provide the App.</li>
          <li>After account deletion, we will permanently delete your data from our systems within 30 days, unless otherwise required by law.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">8. Children's Privacy</h3>
        <p>
          The App is not directed to children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us to request deletion.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">9. International Users & GDPR</h3>
        <p>
          If you are located in the European Economic Area, you have the right to access, rectify, or erase your personal data; restrict or object to processing; and data portability. To exercise these rights, see Section 11.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">10. California Privacy Rights (CCPA)</h3>
        <p>
          California residents may request disclosure of categories of personal information collected, the purposes for which it is used, and the categories of third parties with whom it is shared. To make a request, see Section 11.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">11. Contact Us</h3>
        <p>For questions, or to exercise your rights (access, correction, deletion, or objections), please contact:</p>
        <address className="not-italic mt-2">
          <strong>Email:</strong> <a href="mailto:support@concretecalc.com">support@concretecalc.com</a><br />
          <strong>Address:</strong> ConcreteCalc, LLC, 1234 Builder's Way, San Francisco, CA 94107, USA
        </address>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">12. Changes to This Policy</h3>
        <p>
          We may update this Privacy Policy from time to time. We will post the revised policy with a new "Last Updated" date. Your continued use after changes constitutes acceptance of the updated terms.
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;