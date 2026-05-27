import React from 'react';
import {
  AlertTriangle,
  Beaker,
  CheckCircle,
  CloudSun,
  Droplets,
  Hammer,
  Shield,
  Truck,
  XCircle,
} from 'lucide-react';
import type { ProfessionalMixDesignResult } from '../../types/mixDesignAdvisor';
import type { MixApprovalStatus } from '../../types/mixDesignAdvisor';
import Card from '../ui/Card';

const STATUS_STYLES: Record<
  MixApprovalStatus,
  { bg: string; text: string; icon: React.ReactNode }
> = {
  OK: {
    bg: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700',
    text: 'text-green-900 dark:text-green-100',
    icon: <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />,
  },
  Caution: {
    bg: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    text: 'text-amber-900 dark:text-amber-100',
    icon: <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />,
  },
  Reject: {
    bg: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700',
    text: 'text-red-900 dark:text-red-100',
    icon: <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />,
  },
};

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">None</p>;
  }
  return (
    <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-cyan-600 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface MixDesignOutputCardsProps {
  result: ProfessionalMixDesignResult;
  selectedPsi: string;
}

const MixDesignOutputCards: React.FC<MixDesignOutputCardsProps> = ({
  result,
  selectedPsi,
}) => {
  const statusStyle = STATUS_STYLES[result.compliance.status];

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl border p-4 flex items-center gap-3 ${statusStyle.bg} border`}
      >
        {statusStyle.icon}
        <div>
          <p className="text-xs uppercase tracking-wide font-semibold opacity-80 dark:text-white">
            Approval status
          </p>
          <p className={`text-xl font-bold ${statusStyle.text}`}>
            {result.compliance.status}
          </p>
        </div>
      </div>

      {result.compliance.failures.length > 0 && (
        <Card className="p-4 border-red-200 dark:border-red-800">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">
            Must resolve
          </p>
          <BulletList items={result.compliance.failures} />
        </Card>
      )}

      {result.compliance.warnings.length > 0 && (
        <Card className="p-4 border-amber-200 dark:border-amber-800">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Cautions
          </p>
          <BulletList items={result.compliance.warnings} />
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Beaker className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Mix summary</h3>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">Design PSI</dt>
            <dd className="font-medium text-gray-900 dark:text-white">{selectedPsi} PSI</dd>
          </div>
          <div>
            <dt className="text-gray-500">Required avg. strength</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.requiredAverageStrengthPsi.toLocaleString()} PSI
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Max w/c ratio</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.maxAllowedWaterCementRatio.toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Target slump</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.slumpRange[0]}–{result.slumpRange[1]} in
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Target air</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.targetAir[0]}–{result.targetAir[1]}%
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Max aggregate</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.recommendedAggregateSize}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Cementitious content</dt>
            <dd className="font-medium text-gray-900 dark:text-white">
              {result.cementitiousContentLbPerYd[0]}–{result.cementitiousContentLbPerYd[1]} lb/yd³
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Durability check</h3>
        </div>
        <BulletList items={result.durabilityCheck} />
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Hammer className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Workability check</h3>
        </div>
        <BulletList items={result.workabilityCheck} />
        {result.pumpabilityWarning && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 flex gap-2">
            <Truck className="h-4 w-4 shrink-0" />
            {result.pumpabilityWarning}
          </p>
        )}
        {result.finishabilityWarning && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-300 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {result.finishabilityWarning}
          </p>
        )}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CloudSun className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Weather risk</h3>
        </div>
        <BulletList items={result.weatherRisk} />
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Evaporation: {result.evaporationRate.metric.toFixed(2)} kg/m²·hr
        </p>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Droplets className="h-5 w-5 text-cyan-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Admixture recommendations
          </h3>
        </div>
        <BulletList items={result.admixtureRecommendations} />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          <strong>WR:</strong> {result.waterReducerRecommendation}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          <strong>Retarder / accelerator:</strong>{' '}
          {result.retarderAcceleratorRecommendation}
        </p>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          <strong>SCM:</strong> {result.scmRecommendation}
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Placement notes</h3>
        <BulletList items={result.placementNotes} />
        <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
          Curing: {result.curingMethod}
        </p>
        {result.hotWeatherPrecautions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-300">
              Hot weather
            </p>
            <BulletList items={result.hotWeatherPrecautions} />
          </div>
        )}
        {result.coldWeatherPrecautions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
              Cold weather
            </p>
            <BulletList items={result.coldWeatherPrecautions} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default MixDesignOutputCards;
