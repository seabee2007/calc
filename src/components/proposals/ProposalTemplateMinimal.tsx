import React from 'react';
import { ProposalData } from '../../types/proposal';

interface MinimalProps {
  data: ProposalData;
}

const ProposalTemplateMinimal: React.FC<MinimalProps> = ({ data }) => {
  const {
    businessName,
    businessAddress,
    businessPhone,
    businessEmail,
    businessLicenseNumber,
    businessSlogan,
    clientName,
    projectTitle,
    date,
    introduction,
    scope,
    timeline,
    pricing,
    terms,
    preparedBy,
  } = data;

  return (
    <div className="max-w-2xl mx-auto bg-white text-gray-900 p-6 border border-gray-200 rounded-lg">
      {/* Very simple header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{businessName}</h1>
        {businessSlogan && <p className="text-sm italic text-gray-500 mb-1">{businessSlogan}</p>}
        {businessAddress && <p className="text-xs text-gray-500">{businessAddress}</p>}
        <div className="text-xs text-gray-500 mt-1">
          {businessPhone && <span className="mr-3">{businessPhone}</span>}
          {businessEmail && <span className="mr-3">{businessEmail}</span>}
          {businessLicenseNumber && <span>License: {businessLicenseNumber}</span>}
        </div>
      </header>

      {/* Client & Project */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold">Proposal For</h2>
        <p className="text-base font-medium mb-2">{clientName}</p>
        <h3 className="text-md font-semibold">{projectTitle}</h3>
        <p className="text-xs text-gray-500">{date}</p>
      </section>

      <hr className="border-gray-300 mb-6" />

      {/* Introduction */}
      <section className="mb-6">
        <h4 className="font-semibold mb-1">Introduction</h4>
        <p className="text-sm leading-relaxed">{introduction}</p>
      </section>

      {/* Scope */}
      <section className="mb-6">
        <h4 className="font-semibold mb-1">Scope of Work</h4>
        <p className="text-sm leading-relaxed">{scope}</p>
      </section>

      {/* Timeline Inline */}
      <section className="mb-6">
        <h4 className="font-semibold mb-2">Timeline</h4>
        <div className="space-y-2">
          {timeline.map((t, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{t.phase}</span>
              <span className="font-medium">{t.start} – {t.end}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Inline */}
      <section className="mb-6">
        <h4 className="font-semibold mb-2">Pricing</h4>
        <div className="space-y-2">
          {pricing.map((p, idx) => (
            <div key={idx} className="flex justify-between text-sm">
              <span>{p.description}</span>
              <span className="font-medium">{p.amount}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Terms */}
      <section className="mb-6">
        <h4 className="font-semibold mb-1">Terms &amp; Conditions</h4>
        <p className="text-xs leading-relaxed whitespace-pre-line">{terms}</p>
      </section>

      {/* Footer */}
      <footer className="pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">Prepared by:</p>
        <p className="font-medium">{preparedBy}</p>
      </footer>
    </div>
  );
};

export default ProposalTemplateMinimal; 