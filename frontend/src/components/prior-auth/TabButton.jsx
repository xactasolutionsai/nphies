import React from 'react';

/**
 * Tab Button Component for Prior Authorization Form
 * @param {boolean} active - Whether the tab is currently active
 * @param {function} onClick - Click handler
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {React.ReactNode} children - Button label
 */
const TabButton = ({ active, onClick, icon: Icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active 
        ? 'bg-primary-purple text-white' 
        : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

export default TabButton;

