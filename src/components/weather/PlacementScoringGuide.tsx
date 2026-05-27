import React from 'react';
import { ExternalLink } from 'lucide-react';
import { MAX_MITIGATION_CREDIT_DEFAULT, MITIGATION_DISCLAIMER } from '../../utils/pourMitigations';

const ACI_LINKS = [
  {
    label: 'ACI 305R — Hot Weather Concreting (overview)',
    href: 'https://www.concrete.org/store/productdetail.aspx?ItemID=30519',
  },
  {
    label: 'ACI 306R — Cold Weather Concreting (overview)',
    href: 'https://www.concrete.org/store/productdetail.aspx?ItemID=30619',
  },
  {
    label: 'Structure Magazine — Cold and Hot Weather Concrete',
    href: 'https://www.structuremag.org/article/cold-and-hot-weather-concrete/',
  },
];

function ScoreTable({
  headers,
  rows,
}: {
  headers: [string, string, string];
  rows: [string, string, string][];
}) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {headers.map((h) => (
              <th
                key={h}
                className="text-left py-2 pr-2 font-semibold text-gray-900 dark:text-gray-100"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[0]}
              className="border-b border-gray-100 dark:border-gray-800"
            >
              {row.map((cell, i) => (
                <td
                  key={i}
                  className={`py-1.5 pr-2 text-gray-800 dark:text-gray-200 ${i === 1 ? 'whitespace-nowrap font-medium' : ''}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PlacementScoringGuide: React.FC = () => {
  return (
    <div className="space-y-6 text-sm text-gray-800 dark:text-gray-200">
      <p>
        Each day starts at <strong className="text-gray-900 dark:text-white">100</strong> (ideal
        placement conditions). <strong>Risk impact</strong> points are deducted as weather risk
        increases, based on principles in <strong>ACI 305R</strong> (hot weather) and{' '}
        <strong>ACI 306R</strong> (cold weather). Scores are clamped between 0 and 100; severe
        weather may cap the score at 25. This is field guidance — not a substitute for your project
        specifications.
      </p>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Critical placement warnings
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          These conditions override normal scoring and display a delay recommendation:
        </p>
        <ul className="text-xs list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
          <li>Lightning / active thunderstorms</li>
          <li>Hurricane or tropical storm in forecast</li>
          <li>Freezing conditions without a verified protection plan</li>
          <li>Heavy precipitation during the expected finishing window</li>
        </ul>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Final score meaning</h3>
        <ScoreTable
          headers={['Score', 'Rating', 'Meaning']}
          rows={[
            ['90–100', 'Excellent', 'Favorable placement conditions'],
            ['75–89', 'Good', 'Acceptable with normal precautions'],
            ['60–74', 'Caution', 'Elevated risk — review before placing'],
            ['40–59', 'High risk', 'Significant concerns'],
            ['Below 40', 'Delay', 'Reschedule if possible'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Mitigation credits (score recovery)
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          In the Placement Planner, only mitigations that match the day&apos;s forecast are shown
          (e.g. cold-weather options do not appear on 100°F days). Maximum recovery is normally{' '}
          <strong>+{MAX_MITIGATION_CREDIT_DEFAULT}</strong> points; severe conditions reduce the cap
          (lightning/tropical storm: 0; extreme cold: +10; extreme evaporation: +15).
        </p>
        <ScoreTable
          headers={['Category', 'Examples', 'Typical credit']}
          rows={[
            ['Temperature', 'Night placement, chilled water, heated enclosure', '+5 to +20'],
            ['Wind & evaporation', 'Wind breaks, evap retarder, fogging', '+2 to +10'],
            ['Rain & severe', 'Tarps, enclosure, storm delay buffer', '+3 to +10'],
            ['Mix design', 'Retarder, SRA, SCMs', '+2 to +5'],
            ['Operational', 'QC inspector, experienced crew', '+2 to +5'],
          ]}
        />
        <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">{MITIGATION_DISCLAIMER}</p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
          1. Cold weather (ACI 306R)
        </h3>
        <ScoreTable
          headers={['Low temp', 'Risk impact', 'Risk']}
          rows={[
            ['≤ 20°F', '−70', 'Very high freeze risk'],
            ['21–32°F', '−55', 'Freeze damage likely'],
            ['33–39°F', '−30', 'Cold-weather procedures required'],
            ['40–49°F', '−10', 'Slower hydration'],
            ['≥ 50°F', '0', 'No cold penalty'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
          2. Hot weather (ACI 305R)
        </h3>
        <ScoreTable
          headers={['High temp', 'Risk impact', 'Risk']}
          rows={[
            ['> 100°F', '−55', 'Severe hot-weather placement'],
            ['91–100°F', '−40', 'Rapid set / cracking'],
            ['86–90°F', '−18', 'Elevated risk'],
            ['80–85°F', '−8', 'Moderate'],
            ['50–79°F', '0', 'Favorable range'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Wind</h3>
        <ScoreTable
          headers={['Wind speed', 'Risk impact', 'Risk']}
          rows={[
            ['> 25 mph', '−50', 'Severe plastic shrinkage risk'],
            ['21–25 mph', '−35', 'High evaporation'],
            ['16–20 mph', '−15', 'Moderate'],
            ['10–15 mph', '−5', 'Slight'],
            ['< 10 mph', '0', 'Ideal'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          4. Relative humidity
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Standalone RH penalties are reduced because the Uno evaporation estimate captures most
          drying risk.
        </p>
        <ScoreTable
          headers={['Humidity', 'Risk impact', 'Risk']}
          rows={[
            ['< 20%', '−20', 'Very low RH — drying risk'],
            ['20–35%', '−10', 'Low humidity'],
            ['36–50%', '−10', 'Moderate'],
            ['> 50%', '0', 'Better curing environment'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          5. Rain / precipitation
        </h3>
        <ScoreTable
          headers={['Forecast', 'Risk impact', 'Notes']}
          rows={[
            ['Heavy rain / thunderstorms', '−50', 'Reschedule unless covered'],
            ['Rain chance > 60%', '−40', ''],
            ['Rain chance 31–60%', '−20', ''],
            ['Precip > 0.25"', '−15 extra', 'Added to rain penalties'],
            ['Light isolated showers', '−5', ''],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">6. Severe weather</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          Severe events also cap the daily score at 25 maximum.
        </p>
        <ScoreTable
          headers={['Condition', 'Risk impact', '']}
          rows={[
            ['Tropical storm / hurricane', '−75', ''],
            ['Lightning / thunderstorms', '−60', ''],
            ['Hail', '−50', ''],
            ['Snow / ice', '−50', ''],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          7. Plastic shrinkage & evaporation (ACI 305R)
        </h3>
        <ScoreTable
          headers={['Combined conditions', 'Risk impact', '']}
          rows={[
            ['> 90°F, RH < 30%, wind > 15 mph', '−30', ''],
            ['> 85°F, RH < 50%, wind > 10 mph', '−15', ''],
          ]}
        />
        <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
          Evaporation rate uses the Menzel/Uno simplified equation (ACI 305R). Risk bands:
          &lt;0.5 low, 0.5–1.0 moderate, ≥1.0 severe (kg/m²/h). Rates ≥1.0 add −25; ≥0.5 add
          −10.
        </p>
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          8. Placement type modifier (optional)
        </h3>
        <ScoreTable
          headers={['Type', 'Modifier', '']}
          rows={[
            ['Slab / flatwork', '−8', 'More surface-sensitive'],
            ['Footing', '+5', 'Less surface exposure'],
            ['Vertical wall', '0', 'Moderate'],
            ['Mass concrete', '−5', 'Thermal-sensitive'],
          ]}
        />
      </section>

      <section>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Forecast confidence</h3>
        <ScoreTable
          headers={['Forecast day', 'Confidence', '']}
          rows={[
            ['Today / day 1', 'High (24 hr)', ''],
            ['Days 2–3', 'Medium (2–3 day)', ''],
            ['Days 4–7', 'Low (4–7 day)', ''],
          ]}
        />
      </section>

      <section className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">ACI references</h3>
        <ul className="space-y-2">
          {ACI_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
              >
                {link.label}
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-4">
        Scores are based on forecast weather data and estimated field conditions. Actual site
        conditions, mix design, concrete temperature, placement methods, and project specifications
        may significantly affect performance. Always follow project specifications, engineer
        requirements, and applicable ACI guidance.
      </p>
    </div>
  );
};

export default PlacementScoringGuide;
