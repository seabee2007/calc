import React from 'react';
import { ProposalData } from '../../types/proposal';

interface ModernProps {
  data: ProposalData;
}

const ProposalTemplateModern: React.FC<ModernProps> = ({ data }) => {
  const {
    businessName,
    businessLogoUrl,
    businessAddress,
    businessPhone,
    businessEmail,
    businessLicenseNumber,
    businessSlogan,
    clientName,
    clientCompany,
    projectTitle,
    date,
    introduction,
    scope,
    timeline,
    pricing,
    terms,
    preparedBy,
    preparedByTitle,
  } = data;

  return (
    <div className="max-w-3xl mx-auto bg-white text-gray-800 p-8 rounded-lg shadow-xl">
      {/* Header / Banner */}
      <div className="flex justify-between items-center border-b-2 border-gray-200 pb-4 mb-6">
        <div className="flex items-center space-x-4">
          {businessLogoUrl && (
            <img src={businessLogoUrl} alt={`${businessName} Logo`} className="h-12 w-auto" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{businessName}</h1>
            {businessSlogan && <p className="text-sm italic text-gray-500">{businessSlogan}</p>}
            {businessAddress && <p className="text-sm text-gray-500">{businessAddress}</p>}
            <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
              {businessPhone && <span>📞 {businessPhone}</span>}
              {businessEmail && <span>✉️ {businessEmail}</span>}
              {businessLicenseNumber && <span>📜 License: {businessLicenseNumber}</span>}
            </div>
          </div>
        </div>
        <div className="text-right">
          <h3 className="text-md text-gray-500">Proposal For</h3>
          <p className="text-lg font-semibold">{clientName}</p>
          {clientCompany && <p className="text-sm text-gray-500">{clientCompany}</p>}
        </div>
      </div>

      {/* Project & Date */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-indigo-600">{projectTitle}</h2>
        <p className="text-sm text-gray-500 mt-1">{date}</p>
      </div>

      {/* Two-column Intro / Scope */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">Introduction</h3>
          <p className="text-justify leading-relaxed">{introduction}</p>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Scope of Work</h3>
          <p className="text-justify leading-relaxed">{scope}</p>
        </div>
      </div>

      {/* Timeline & Pricing Cards side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Timeline Card */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Timeline</h3>
          <ul className="space-y-3">
            {timeline.map((t, idx) => (
              <li key={idx} className="flex justify-between">
                <span className="font-medium text-gray-600">{t.phase}:</span>
                <span className="text-gray-800">{t.start} – {t.end}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pricing Card */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Pricing</h3>
          <ul className="space-y-3">
            {pricing.map((p, idx) => (
              <li key={idx} className="flex justify-between">
                <span className="text-gray-600">{p.description}</span>
                <span className="font-medium text-gray-800">{p.amount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Terms & Prepared By */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Terms &amp; Conditions</h3>
        <p className="text-justify leading-relaxed whitespace-pre-line">{terms}</p>
      </section>

      <hr className="border-dashed border-gray-300 my-8" />

      <footer className="text-center text-gray-600">
        <p>Prepared by: <span className="font-medium text-gray-800">{preparedBy}</span></p>
        {preparedByTitle && <p className="text-sm">{preparedByTitle}</p>}
      </footer>
    </div>
  );
};

export default ProposalTemplateModern; 