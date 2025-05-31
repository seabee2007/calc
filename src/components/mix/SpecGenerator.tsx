import React from 'react';
import { FileText, Download, Mail } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';

interface SpecGeneratorProps {
  psi: string;
  airContent: [number, number];
  waterCementRatio: number;
  admixtures: string[];
  onDownload: () => void;
}

const SpecGenerator: React.FC<SpecGeneratorProps> = ({
  psi,
  airContent,
  waterCementRatio,
  admixtures,
  onDownload
}) => {
  const handleEmailSpec = () => {
    const subject = encodeURIComponent(`Concrete Mix Specification - ${psi} PSI`);
    const body = encodeURIComponent(`
Concrete Mix Specification

Design Strength: ${psi} PSI
Air Content Range: ${airContent[0]}-${airContent[1]}%
Maximum W/C Ratio: ${waterCementRatio.toFixed(2)}

Required Admixtures:
${admixtures.join('\n')}

Please prepare mix according to these specifications.
    `);
    
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Mix Specification</h3>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Design Strength</p>
            <p className="font-medium text-gray-900 dark:text-white">{psi} PSI</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Air Content Range</p>
            <p className="font-medium text-gray-900 dark:text-white">{airContent[0]}-{airContent[1]}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Maximum W/C Ratio</p>
            <p className="font-medium text-gray-900 dark:text-white">{waterCementRatio.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required Admixtures</p>
          <ul className="space-y-1 text-sm">
            {admixtures.map((admix, index) => (
              <li key={index} className="text-gray-600 dark:text-gray-400">• {admix}</li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={onDownload}
            icon={<Download size={16} />}
            fullWidth
            className="px-3 py-2"
            title="Download PDF"
          >
          </Button>
          <Button
            onClick={handleEmailSpec}
            icon={<Mail size={16} />}
            fullWidth
            className="px-3 py-2"
            title="Email Spec"
          >
          </Button>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p>References:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>ACI 318-19 Section 5 (Durability)</li>
            <li>ACI 211.2-98 (Mix Design)</li>
            <li>ACI 308R-16 (Curing)</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};

export default SpecGenerator;