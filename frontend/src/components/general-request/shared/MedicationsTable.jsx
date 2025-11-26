import React from 'react';
import { Plus, Trash2, AlertCircle, AlertTriangle, Info, Copy } from 'lucide-react';
import MedicationInputWithSearch from './MedicationInputWithSearch';

/**
 * MedicationsTable Component
 * Reusable table for managing medications list with AI safety features
 */
const MedicationsTable = React.memo(({ 
  medications, 
  onAdd, 
  onRemove, 
  onUpdate,
  onSelectFromSearch 
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Medications List</h3>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-purple text-white text-sm hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Add Medication
        </button>
      </div>
      
      <div className="space-y-3">
        {medications.map((med, index) => {
          const hasWarnings = med.hasInteractions || med.hasSideEffects || med.hasAgeWarning || 
                             med.hasPregnancyWarning || med.isDuplicate;
          
          return (
            <div 
              key={index} 
              className={`border rounded-lg p-4 ${hasWarnings ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}
            >
              {/* Header with badges */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-700">Medication #{index + 1}</span>
                  
                  {/* Warning badges */}
                  {med.hasInteractions && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Interaction
                    </span>
                  )}
                  {med.hasSideEffects && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Side Effects
                    </span>
                  )}
                  {med.hasAgeWarning && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Age Warning
                    </span>
                  )}
                  {med.hasPregnancyWarning && (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Pregnancy
                    </span>
                  )}
                  {med.isDuplicate && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium flex items-center gap-1">
                      <Copy className="w-3 h-3" />
                      Duplicate
                    </span>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className={`p-1.5 rounded-[4px] transition ${
                    medications.length === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                  }`}
                  disabled={medications.length === 1}
                  title="Remove medication"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medication Name
                  </label>
                  <MedicationInputWithSearch
                    value={med.medicationName}
                    onChange={onUpdate}
                    onSelectFromSearch={onSelectFromSearch}
                    index={index}
                    placeholder="Enter medication name or search database"
                  />
                  
                  {/* Medicine details if selected from database */}
                  {med.mrid && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                      <p className="text-blue-900">
                        <span className="font-medium">Active Ingredient:</span> {med.activeIngredient || 'N/A'}
                      </p>
                      <p className="text-blue-900">
                        <span className="font-medium">Strength:</span> {med.strength || 'N/A'} {med.unit || ''}
                      </p>
                      <p className="text-blue-700">
                        <span className="font-medium">MRID:</span> {med.mrid || 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <input
                    type="text"
                    value={med.type || ''}
                    onChange={(e) => onUpdate(index, 'type', e.target.value)}
                    placeholder="Type (e.g., Tablet)"
                    className="w-full rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                  />
                </div>
              </div>
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  value={med.quantity || ''}
                  onChange={(e) => onUpdate(index, 'quantity', e.target.value)}
                  placeholder="Quantity"
                  className="w-full md:w-48 rounded-[4px] border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-purple/30"
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {medications.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>No medications added yet</p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 text-primary-purple hover:underline"
          >
            Add your first medication
          </button>
        </div>
      )}
    </div>
  );
});

MedicationsTable.displayName = 'MedicationsTable';

export default MedicationsTable;

