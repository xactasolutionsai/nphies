import React, { useState } from 'react';
import { Search } from 'lucide-react';
import MedicationSearchModal from './MedicationSearchModal';

/**
 * MedicationInputWithSearch Component
 * Text input with integrated medicine database search
 */
const MedicationInputWithSearch = ({ 
  value, 
  onChange, 
  onSelectFromSearch,
  index,
  placeholder = "Enter medication name or search database"
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSelect = (medicine) => {
    onSelectFromSearch(index, medicine);
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="relative flex gap-2">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(index, 'medicationName', e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
          title="Search medicine database"
        >
          <Search className="w-4 h-4" />
          Search
        </button>
      </div>

      {isModalOpen && (
        <MedicationSearchModal
          onClose={() => setIsModalOpen(false)}
          onSelect={handleSelect}
        />
      )}
    </>
  );
};

export default MedicationInputWithSearch;

