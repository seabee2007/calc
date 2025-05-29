import React from 'react';
import StrengthProgressBar from '../components/StrengthProgressBar';

const Demo: React.FC = () => {
  return (
    <div className="max-w-md mx-auto space-y-8 p-8">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">25% Complete</h3>
        <StrengthProgressBar percentage={25} label="Day 7 Strength" />
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">50% Complete</h3>
        <StrengthProgressBar percentage={50} label="14 Days Cured" />
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">75% Complete</h3>
        <StrengthProgressBar percentage={75} label="21 Days" />
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">100% Complete</h3>
        <StrengthProgressBar percentage={100} label="Full Strength" />
      </div>
    </div>
  );