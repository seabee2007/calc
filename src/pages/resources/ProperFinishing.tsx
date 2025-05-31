import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';

const ProperFinishing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/resources')}
            icon={<ArrowLeft size={20} />}
            className="text-white hover:text-blue-200 mb-4"
          >
            Back to Resources
          </Button>
          <h1 className="text-3xl font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Proper Concrete Finishing Methods
          </h1>
          <p className="text-white text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] mt-2">
            Essential techniques for achieving high-quality concrete finishes
          </p>
        </div>

        <div className="space-y-6">
<<<<<<< HEAD
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Introduction</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              Proper finishing is crucial for both the appearance and durability of concrete surfaces. The right techniques and timing can make the difference between a successful project and surface defects.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Basic Finishing Steps</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Screeding</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  The first step in concrete finishing:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
=======
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 mb-6">
              Proper finishing is crucial for both the appearance and durability of concrete surfaces. The right techniques and timing can make the difference between a successful project and surface defects.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3">Basic Finishing Steps</h3>
            <div className="space-y-4 mb-6">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Screeding</h4>
                <p className="text-gray-700">
                  The first step in concrete finishing:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Use straight edge across form boards</li>
                  <li>Establish proper grade and slope</li>
                  <li>Remove excess concrete</li>
                  <li>Fill low spots immediately</li>
                </ul>
              </div>

              <div>
<<<<<<< HEAD
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Floating</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Compacting and consolidating the surface:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
=======
                <h4 className="text-lg font-medium text-gray-900 mb-2">Floating</h4>
                <p className="text-gray-700">
                  Compacting and consolidating the surface:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Wait for bleed water to evaporate</li>
                  <li>Use bull float for large areas</li>
                  <li>Hand float for edges and small areas</li>
                  <li>Work surface until uniform</li>
                </ul>
              </div>

              <div>
<<<<<<< HEAD
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Troweling</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Final smoothing and densifying:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
=======
                <h4 className="text-lg font-medium text-gray-900 mb-2">Troweling</h4>
                <p className="text-gray-700">
                  Final smoothing and densifying:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Wait for surface moisture to disappear</li>
                  <li>Multiple passes required</li>
                  <li>Increase pressure with each pass</li>
                  <li>Tilt blade slightly with each pass</li>
                </ul>
              </div>
            </div>

<<<<<<< HEAD
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Specialty Finishes</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Broom Finish</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Creating slip-resistant surfaces:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
=======
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Specialty Finishes</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Broom Finish</h4>
                <p className="text-gray-700">
                  Creating slip-resistant surfaces:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Time application carefully</li>
                  <li>Maintain consistent pressure</li>
                  <li>Use appropriate bristle stiffness</li>
                  <li>Stroke in one direction only</li>
                </ul>
              </div>

              <div>
<<<<<<< HEAD
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Exposed Aggregate</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Decorative finish showing aggregate:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 dark:text-gray-300 space-y-1">
=======
                <h4 className="text-lg font-medium text-gray-900 mb-2">Exposed Aggregate</h4>
                <p className="text-gray-700">
                  Decorative finish showing aggregate:
                </p>
                <ul className="list-disc list-inside mt-2 text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Apply surface retarder</li>
                  <li>Time washing carefully</li>
                  <li>Use proper washing pressure</li>
                  <li>Seal after curing</li>
                </ul>
              </div>
            </div>
          </div>

<<<<<<< HEAD
          <div className="bg-blue-50/90 dark:bg-blue-900/50 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">Critical Factors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Timing</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
=======
          <div className="bg-blue-50/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-blue-900 mb-3">Critical Factors</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Timing</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Monitor bleed water</li>
                  <li>Check surface firmness</li>
                  <li>Consider weather conditions</li>
                </ul>
              </div>
              
<<<<<<< HEAD
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tools</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
=======
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Tools</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Proper tool selection</li>
                  <li>Tool maintenance</li>
                  <li>Technique application</li>
                </ul>
              </div>
              
<<<<<<< HEAD
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Environment</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
=======
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Environment</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Temperature effects</li>
                  <li>Wind conditions</li>
                  <li>Humidity impact</li>
                </ul>
              </div>
              
<<<<<<< HEAD
              <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Mix Design</h4>
                <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
=======
              <div className="bg-white rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Mix Design</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
>>>>>>> 81a2cbd4801da4ed24dd873c85d90e22ceebbd29
                  <li>Workability</li>
                  <li>Setting time</li>
                  <li>Aggregate type</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ProperFinishing;