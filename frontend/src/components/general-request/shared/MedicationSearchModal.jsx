import React, { useState, useCallback } from 'react';
import { Search, X, Loader2, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

/**
 * MedicationSearchModal Component
 * Modal for searching medicines from database
 */
const MedicationSearchModal = ({ onClose, onSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      setSearchError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/medicines/search?q=${encodeURIComponent(searchQuery)}`
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setSearchError('No medicines found matching your query');
        }
      } else {
        setSearchError(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search medicines. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Search Medicine Database</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Form */}
        <div className="p-4 border-b">
          <form onSubmit={handleSearch}>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by medicine name, active ingredient, or use (e.g., 'painkiller')"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Search Error */}
          {searchError && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">{searchError}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-3">
                Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((medicine, index) => (
                <div
                  key={medicine.mrid || index}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
                  onClick={() => onSelect(medicine)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {medicine.activeIngredient}
                      </h3>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Strength:</span> {medicine.strength} {medicine.unit}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Form:</span> {medicine.dosageForm?.parent}
                        {medicine.dosageForm?.child && ` (${medicine.dosageForm.child})`}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        MRID: {medicine.mrid}
                      </p>
                    </div>
                    
                    <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                      {Math.round(medicine.similarity * 100)}% Match
                    </div>
                  </div>

                  {/* Brand Names */}
                  {medicine.brands && medicine.brands.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-700 mb-2">Brand Names:</p>
                      <div className="flex flex-wrap gap-2">
                        {medicine.brands.slice(0, 5).map((brand, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                          >
                            {brand.brand_name || brand.brandName}
                          </span>
                        ))}
                        {medicine.brands.length > 5 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                            +{medicine.brands.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-blue-600 font-medium">
                    Click to select this medication →
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Search for medicines by name or description</p>
              <p className="text-sm mt-1">Results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationSearchModal;

