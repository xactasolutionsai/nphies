import React from 'react';
import { Pill, Stethoscope } from 'lucide-react';

/**
 * ModeSelector Component
 * Toggle between drug information and general medical modes
 */
const ModeSelector = ({ currentMode, onModeChange, disabled }) => {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onModeChange('general')}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentMode === 'general'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="General medical information and health advice"
      >
        <Stethoscope className="w-4 h-4" />
        <span>General Medical</span>
      </button>
      
      <button
        onClick={() => onModeChange('drug')}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
          currentMode === 'drug'
            ? 'bg-white text-purple-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Pharmaceutical information, dosages, and drug interactions"
      >
        <Pill className="w-4 h-4" />
        <span>Drug Info</span>
      </button>
    </div>
  );
};

export default ModeSelector;

