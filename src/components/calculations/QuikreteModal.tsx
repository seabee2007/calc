import React from 'react';
import { Package } from 'lucide-react';
import Modal from '../ui/Modal';

interface QuikreteProduct {
  type: string;
  weights: {
    weight: number;
    yield: number;
  }[];
}

const QUIKRETE_PRODUCTS: QuikreteProduct[] = [
  {
    type: 'Standard Concrete Mix',
    weights: [
      { weight: 40, yield: 0.30 },
      { weight: 50, yield: 0.375 },
      { weight: 60, yield: 0.45 },
      { weight: 80, yield: 0.60 },
      { weight: 90, yield: 0.675 }
    ]
  },
  {
    type: 'Fast-Setting Concrete Mix',
    weights: [
      { weight: 50, yield: 0.375 },
      { weight: 70, yield: 0.52 }
    ]
  },
  {
    type: '5000 High Early Strength',
    weights: [
      { weight: 50, yield: 0.375 },
      { weight: 60, yield: 0.45 },
      { weight: 66, yield: 0.50 },
      { weight: 80, yield: 0.60 }
    ]
  },
  {
    type: 'Maximum Yield Concrete Mix',
    weights: [
      { weight: 80, yield: 1.00 }
    ]
  }
];

interface QuikreteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: { type: string; weight: number; yield: number }) => void;
}

const QuikreteModal: React.FC<QuikreteModalProps> = ({ isOpen, onClose, onSelect }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="QUIKRETE® Product Selection"
      size="lg"
    >
      <div className="space-y-6">
        <p className="text-gray-600 dark:text-gray-300">
          Select a QUIKRETE® product and bag size to calculate the number of bags needed for your project.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {QUIKRETE_PRODUCTS.map((product) => (
            <div
              key={product.type}
              className="bg-white dark:bg-gray-700 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
            >
              <div className="bg-gray-50 dark:bg-gray-600 p-4 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-medium text-gray-900 dark:text-white">{product.type}</h3>
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-2">
                  {product.weights.map((size) => (
                    <button
                      key={size.weight}
                      onClick={() => onSelect({ 
                        type: product.type, 
                        weight: size.weight, 
                        yield: size.yield 
                      })}
                      className="w-full text-left p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-between group"
                    >
                      <span className="text-gray-700 dark:text-gray-200 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {size.weight} lb bag
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        Yields {size.yield} ft³
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Note: Yields are approximate. Actual yield may vary based on installation conditions and techniques.
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default QuikreteModal;