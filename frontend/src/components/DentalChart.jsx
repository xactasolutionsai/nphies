import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import Odontogram from 'react-odontogram';
import './DentalChart.css';

/**
 * Interactive Dental Chart Component
 * Uses react-odontogram library for professional anatomical dental chart
 * Displays all 32 adult teeth in FDI notation with proper curved layout
 * Supports click selection for easy tooth number input
 */
export default function DentalChart({ 
  selectedTeeth = [], 
  onToothClick = null, 
  mode = 'select',
  className = '' 
}) {
  // Track if component has mounted to prevent onChange during initial render
  const hasMountedRef = useRef(false);
  const prevSelectedRef = useRef(selectedTeeth);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Convert selectedTeeth array (e.g., ['21', '12']) to library format (e.g., ['teeth-21', 'teeth-12'])
  const defaultSelected = useMemo(() => {
    return selectedTeeth.map(tooth => `teeth-${tooth}`);
  }, [selectedTeeth]);

  // Handle tooth selection changes from the odontogram
  const handleChange = useCallback((selectedTeethObjects) => {
    // Prevent setState during initial render
    if (!hasMountedRef.current) {
      return;
    }

    // Only trigger onToothClick if mode is select and we have a handler
    if (mode === 'select' && onToothClick) {
      // Get all selected tooth numbers in FDI notation
      const currentTeeth = selectedTeethObjects.map(t => t.notations.fdi);
      const prevTeeth = prevSelectedRef.current;
      
      // Check if selection actually changed
      const currentTeethStr = [...currentTeeth].sort().join(',');
      const prevTeethStr = [...prevTeeth].sort().join(',');
      
      if (currentTeethStr !== prevTeethStr) {
        // Use setTimeout to defer the state update to next tick
        setTimeout(() => {
          // Pass all selected teeth to the parent
          onToothClick(currentTeeth);
        }, 0);
        
        // Update previous selection
        prevSelectedRef.current = currentTeeth;
      }
    }
  }, [mode, onToothClick]);

  return (
    <div className={`dental-chart ${className}`}>
      {/* Legend */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-purple-100 border-2 border-primary-purple rounded"></div>
            <span className="text-gray-700">Selected Teeth</span>
          </div>
          {selectedTeeth.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="px-3 py-1 bg-primary-purple text-white rounded-full text-xs font-semibold">
                {selectedTeeth.length} Selected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Dental Chart - Using react-odontogram library */}
      <div 
        className="dental-chart-container" 
        data-readonly={mode === 'display' ? 'true' : undefined}
      >
        <Odontogram
          onChange={handleChange}
          defaultSelected={defaultSelected}
          theme="light"
          colors={{
            darkBlue: '#553781',
            baseBlue: '#7c3aed',
            lightBlue: '#c4b5fd'
          }}
          notation="FDI"
          className="mx-auto"
        />
      </div>

      {/* Instructions */}
      {mode === 'select' && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            <span className="font-medium">💡 Tip:</span> Click on a tooth to auto-fill the tooth number in your procedure
          </p>
        </div>
      )}
    </div>
  );
}

