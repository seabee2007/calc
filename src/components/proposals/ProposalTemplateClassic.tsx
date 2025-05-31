import React from 'react';
import { ProposalData } from '../../types/proposal';

interface ClassicProps {
  data: ProposalData;
}

const ProposalTemplateClassic: React.FC<ClassicProps> = ({ data }) => {
  const {
    businessName,
    businessLogoUrl,
    businessAddress,
    clientName,
    clientCompany,
    clientAddress,
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
    <div className="max-w-3xl mx-auto bg-white text-gray-800 p-8 shadow-lg">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div>
          {businessLogoUrl && (
            <img src={businessLogoUrl} alt={`${businessName} Logo`} className="h-16 w-auto mb-2" />
          )}
          <h1 className="text-2xl font-bold">{businessName}</h1>
          {businessAddress && (
            <p className="text-sm text-gray-600">{businessAddress}</p>
          )}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-semibold">Proposal</h2>
          <p className="text-sm">{date}</p>
        </div>
      </header>

      {/* Client Info */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Prepared For:</h3>
        <p className="text-base font-medium">{clientName}</p>
        {clientCompany && <p className="text-sm text-gray-600">{clientCompany}</p>}
        {clientAddress && <p className="text-sm text-gray-600">{clientAddress}</p>}
      </section>

      <hr className="border-gray-300 mb-8" />

      {/* Project Title & Intro */}
      <section className="mb-8">
        <h3 className="text-xl font-semibold mb-2">{projectTitle}</h3>
        <p className="text-justify leading-relaxed">{introduction}</p>
      </section>

      {/* Scope of Work */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Scope of Work</h3>
        <p className="text-justify leading-relaxed">{scope}</p>
      </section>

      {/* Timeline (table) */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Project Timeline</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 border-b">Phase</th>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 border-b">Start</th>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 border-b">End</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{t.phase}</td>
                  <td className="py-2 px-4 border-b">{t.start}</td>
                  <td className="py-2 px-4 border-b">{t.end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing (table) */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-4">Pricing</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 border-b">Description</th>
                <th className="py-2 px-4 text-left text-sm font-medium text-gray-700 border-b">Amount</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{p.description}</td>
                  <td className="py-2 px-4 border-b">{p.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Terms */}
      <section className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Terms & Conditions</h3>
        <p className="text-justify leading-relaxed whitespace-pre-line">{terms}</p>
      </section>

      {/* Footer / Prepared By */}
      <footer className="mt-12">
        <p className="text-sm text-gray-600">Prepared by:</p>
        <p className="font-medium">{preparedBy}</p>
        {preparedByTitle && <p className="text-sm text-gray-600">{preparedByTitle}</p>}
      </footer>
    </div>
  );
};

export default ProposalTemplateClassic; 