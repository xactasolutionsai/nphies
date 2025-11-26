import React, { useState } from 'react';
import { Search, Pill, Info, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const MedicineSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [expandedMedicines, setExpandedMedicines] = useState(new Set()); // Track which cards are expanded (multiple)
  const [aiInfoMap, setAiInfoMap] = useState({}); // Store AI info for each medicine
  const [loadingAIMap, setLoadingAIMap] = useState({}); // Track loading state for each medicine
  const [aiErrorMap, setAiErrorMap] = useState({}); // Track errors for each medicine

  // Search medicines using natural language
  const handleSearch = async (e) => {
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
  };

  // Get AI information for a medicine (inline in card)
  const handleGetAIInfo = async (medicine) => {
    const mrid = medicine.mrid;
    
    // Check if this card is currently expanded
    const isCurrentlyExpanded = expandedMedicines.has(mrid);
    
    if (isCurrentlyExpanded) {
      // If already expanded, just collapse it
      setExpandedMedicines(prev => {
        const newSet = new Set(prev);
        newSet.delete(mrid);
        return newSet;
      });
      return;
    }
    
    // If we don't have data yet, set loading state FIRST
    if (!aiInfoMap[mrid]) {
      setLoadingAIMap(prev => ({ ...prev, [mrid]: true }));
      setAiErrorMap(prev => ({ ...prev, [mrid]: null }));
    }
    
    // Now expand the card
    setExpandedMedicines(prev => {
      const newSet = new Set(prev);
      newSet.add(mrid);
      return newSet;
    });
    
    // If we already have the data, no need to fetch again
    if (aiInfoMap[mrid]) {
      return;
    }

    // Fetch the data
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/medicines/${mrid}/ai-info`
      );

      if (!response.ok) {
        throw new Error('Failed to get AI information');
      }

      const data = await response.json();
      
      if (data.success && data.medicine?.aiInfo) {
        setAiInfoMap(prev => ({ ...prev, [mrid]: data.medicine.aiInfo }));
      } else {
        setAiErrorMap(prev => ({ ...prev, [mrid]: data.error || 'Failed to get AI information' }));
      }
    } catch (error) {
      console.error('AI info error:', error);
      setAiErrorMap(prev => ({ ...prev, [mrid]: 'Failed to load AI information. Please try again.' }));
    } finally {
      setLoadingAIMap(prev => ({ ...prev, [mrid]: false }));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Pill className="w-8 h-8 text-blue-600" />
          Medicine Search
        </h1>
        <p className="text-gray-600">
          Search medicines using natural language. Get detailed information powered by AI.
        </p>
      </div>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSearch}>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search medicines (e.g., 'painkiller for headache', 'antibiotics for infection', 'insulin')"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
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
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <p className="text-yellow-800">{searchError}</p>
          </div>
        )}
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Search Results ({searchResults.length})
          </h2>
          
          <div className="space-y-4">
            {searchResults.map((medicine, index) => {
              const mrid = medicine.mrid;
              const isExpanded = expandedMedicines.has(mrid);
              const aiInfo = aiInfoMap[mrid];
              const isLoadingAI = loadingAIMap[mrid];
              const aiError = aiErrorMap[mrid];
              
              return (
                <div
                  key={medicine.mrid || index}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
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
                    
                    <div className="flex flex-col items-end gap-2">
                      <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                        {Math.round(medicine.similarity * 100)}% Match
                      </div>
                      <button
                        onClick={() => handleGetAIInfo(medicine)}
                        className={`px-4 py-2 ${isExpanded ? 'bg-gray-600' : 'bg-blue-600'} text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm font-medium`}
                      >
                        <Info className="w-4 h-4" />
                        {isExpanded ? 'Hide AI Info' : 'Get AI Info'}
                      </button>
                    </div>
                  </div>

                  {/* Brand Names */}
                  {medicine.brands && medicine.brands.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm font-medium text-gray-700 mb-2">Brand Names:</p>
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
                  
                  {/* AI Information Section (Inline) */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      {isLoadingAI && (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                          <p className="text-gray-600">Loading AI information...</p>
                        </div>
                      )}

                      {aiError && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                          <p className="text-red-800">{aiError}</p>
                        </div>
                      )}

                      {aiInfo && !isLoadingAI && (
                        <div className="space-y-4">
                          <h3 className="text-xl font-bold text-gray-900 mb-4">AI-Generated Medical Information</h3>
                          
                          {/* Medication Information */}
                          {aiInfo.medicationInfo && (
                            <div className="bg-blue-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">Medication Information</h4>
                              {aiInfo.medicationInfo.type && (
                                <p className="text-sm text-gray-700"><span className="font-medium">Type:</span> {aiInfo.medicationInfo.type}</p>
                              )}
                              {aiInfo.medicationInfo.packSize && (
                                <p className="text-sm text-gray-700"><span className="font-medium">Pack Size:</span> {aiInfo.medicationInfo.packSize}</p>
                              )}
                              {aiInfo.medicationInfo.composition && (
                                <p className="text-sm text-gray-700 mt-2"><span className="font-medium">Composition:</span> {aiInfo.medicationInfo.composition}</p>
                              )}
                            </div>
                          )}
                          
                          {/* Side Effects */}
                          {aiInfo.sideEffects && (aiInfo.sideEffects.common?.length > 0 || aiInfo.sideEffects.serious?.length > 0) && (
                            <div className="bg-yellow-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-yellow-600" />
                                Side Effects
                              </h4>
                              
                              {aiInfo.sideEffects.common?.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-sm font-medium text-gray-800 mb-2">Common side effects include:</p>
                                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                    {aiInfo.sideEffects.common.map((effect, idx) => (
                                      <li key={idx}>{effect}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {aiInfo.sideEffects.serious?.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-800 mb-2">Less common but more serious side effects can include:</p>
                                  <ul className="list-disc list-inside space-y-1 text-sm text-red-700 ml-2">
                                    {aiInfo.sideEffects.serious.map((effect, idx) => (
                                      <li key={idx}>{effect}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Drug Interactions */}
                          {aiInfo.interactions && aiInfo.interactions.length > 0 && (
                            <div className="bg-orange-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <Info className="w-5 h-5 text-orange-600" />
                                Drug Interactions
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                {aiInfo.interactions.map((interaction, idx) => (
                                  <li key={idx}>{interaction}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Price */}
                          {aiInfo.price && (
                            <div className="bg-green-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">Price</h4>
                              <p className="text-sm text-gray-700">{aiInfo.price}</p>
                            </div>
                          )}
                          
                          {/* Manufacturer */}
                          {aiInfo.manufacturer && (
                            <div className="bg-purple-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">Manufacturer</h4>
                              <p className="text-sm text-gray-700">{aiInfo.manufacturer}</p>
                            </div>
                          )}
                          
                          {/* Clinical Information */}
                          {aiInfo.clinicalInformation && (
                            <div className="bg-indigo-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">Clinical Information</h4>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{aiInfo.clinicalInformation}</p>
                            </div>
                          )}

                          {/* Contraindications */}
                          {aiInfo.contraindications && aiInfo.contraindications.length > 0 && (
                            <div className="bg-red-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                Contraindications
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                {aiInfo.contraindications.map((contra, idx) => (
                                  <li key={idx}>{contra}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Dosage Guidelines */}
                          {aiInfo.dosageGuidelines && (
                            <div className="bg-teal-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">Dosage Guidelines</h4>
                              <p className="text-sm text-gray-700 whitespace-pre-line">{aiInfo.dosageGuidelines}</p>
                            </div>
                          )}

                          {/* Warnings */}
                          {aiInfo.warnings && aiInfo.warnings.length > 0 && (
                            <div className="bg-orange-50 rounded-lg p-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                Warnings
                              </h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 ml-2">
                                {aiInfo.warnings.map((warning, idx) => (
                                  <li key={idx}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Full AI Response - shown always or when parsing is incomplete */}
                          {aiInfo.fullDescription && (
                            <div className="bg-gray-50 rounded-lg p-4 mt-4">
                              <h4 className="text-md font-semibold text-gray-900 mb-2">
                                Complete AI Response
                              </h4>
                              <div className="text-sm text-gray-700 whitespace-pre-line">
                                {aiInfo.fullDescription}
                              </div>
                            </div>
                          )}

                          {/* Metadata */}
                          {aiInfo.metadata && (
                            <div className="pt-4 border-t border-gray-200">
                              <p className="text-xs text-gray-500">
                                Generated by {aiInfo.metadata.model} in {aiInfo.metadata.responseTime}
                                {aiInfo.metadata.parsingSuccess === false && ' - Showing full response due to parsing limitations'}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicineSearch;

