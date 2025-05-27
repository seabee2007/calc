import React from 'react';

const UserAgreement: React.FC = () => {
  return (
    <div className="prose prose-sm max-w-none">
      <h2 className="text-xl font-semibold mb-4">ConcreteCalc User Agreement</h2>
      <p className="text-sm text-gray-500 mb-4">Effective Date: May 22, 2025</p>
      
      <p className="mb-4">
        This User Agreement ("Agreement") is a binding legal contract between you ("You," "User") and ConcreteCalc, LLC ("ConcreteCalc," "we," "us," or "our"). By accessing or using the ConcreteCalc mobile or web application (the "App"), you agree to be bound by this Agreement. If you do not agree to any provision of this Agreement, do not use the App.
      </p>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">1. License Grant</h3>
        <p>
          Subject to your compliance with this Agreement, ConcreteCalc grants you a limited, non-exclusive, non-transferable, revocable license to access and use the App solely for your internal business or personal use.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">2. No Professional Advice; Independent Verification</h3>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Informational Use Only.</strong> The App provides estimates and recommendations based on standard engineering formulas and third-party weather data.</li>
          <li><strong>No Professional Relationship.</strong> Use of the App does not create a professional services relationship (e.g., engineer, architect, contractor).</li>
          <li><strong>Independent Verification Required.</strong> You are solely responsible for verifying all dimensions, calculations, mix designs, and weather conditions with qualified professionals and your local building codes before placing or ordering concrete.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">3. Disclaimers</h3>
        <p className="uppercase mb-4">
          TO THE FULLEST EXTENT PERMITTED BY LAW, THE APP AND ITS CONTENT ARE PROVIDED "AS-IS," "AS AVAILABLE," AND "WITH ALL FAULTS."
        </p>
        <p>CONCRETECALC DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. CONCRETECALC DOES NOT WARRANT THAT:</p>
        <ul className="list-disc pl-5 mt-2">
          <li>THE APP WILL MEET YOUR REQUIREMENTS;</li>
          <li>THE APP WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE;</li>
          <li>ANY ESTIMATES, CALCULATIONS, OR RECOMMENDATIONS ARE ACCURATE, COMPLETE, OR FREE FROM DEFECTS;</li>
          <li>WEATHER DATA IS UP-TO-DATE OR ACCURATE; OR</li>
          <li>THE APP IS COMPATIBLE WITH YOUR DEVICE OR BROWSER.</li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">4. Limitation of Liability</h3>
        <p className="uppercase mb-2">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>NO INDIRECT DAMAGES.</strong> NEITHER CONCRETECALC NOR ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES.
          </li>
          <li>
            <strong>CAP ON LIABILITY.</strong> CONCRETECALC'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED USD 100 (ONE HUNDRED DOLLARS).
          </li>
          <li>
            <strong>NO LIABILITY FOR DECISIONS.</strong> YOU ASSUME ALL RISK AND LIABILITY FOR YOUR CONCRETE PLACEMENT DECISIONS.
          </li>
        </ul>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">5. Indemnification</h3>
        <p>
          You agree to indemnify, defend, and hold harmless ConcreteCalc and its officers, directors, employees, agents, and licensors from and against all claims, liabilities, losses, damages, costs, and expenses arising out of or related to your use of the App.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">6. User Data; Privacy</h3>
        <p>
          ConcreteCalc's collection and use of your personal data are governed by our Privacy Policy. By using the App, you consent to the terms of that policy.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">7. Termination</h3>
        <p>
          We may suspend or terminate your access to the App at any time, with or without cause, and with or without notice.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">8. Governing Law & Dispute Resolution</h3>
        <p>
          This Agreement shall be governed by the laws of the State of California. You agree that any legal action shall be brought exclusively in San Francisco County, California.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">9. Severability</h3>
        <p>
          If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions will remain in full force and effect.
        </p>
      </section>

      <section className="mb-6">
        <h3 className="text-lg font-semibold mb-2">10. Entire Agreement; Amendments</h3>
        <p>
          This Agreement constitutes the entire agreement between you and ConcreteCalc regarding the App. We may modify this Agreement at any time by posting a revised version.
        </p>
      </section>

      <section className="mt-8 pt-4 border-t">
        <p className="text-sm text-gray-600">
          <strong>Contact:</strong><br />
          ConcreteCalc, LLC<br />
          Email: support@concretecalc.com<br />
          Address: 1234 Builder's Way, San Francisco, CA 94107
        </p>
      </section>
    </div>
  );
};

export default UserAgreement;