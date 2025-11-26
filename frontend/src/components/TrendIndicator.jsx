import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TrendIndicator = ({ 
  currentValue, 
  previousValue, 
  isCurrency = false,
  className = "" 
}) => {
  if (!previousValue || previousValue === 0) {
    return null;
  }

  const change = currentValue - previousValue;
  const percentageChange = ((change / previousValue) * 100).toFixed(1);
  const isPositive = change > 0;
  const isNegative = change < 0;

  const formatValue = (val) => {
    if (isCurrency) {
      return `$${Math.abs(val).toLocaleString()}`;
    }
    return Math.abs(val).toLocaleString();
  };

  return (
    <div className={`flex items-center ${className}`}>
      {isPositive && (
        <div className="flex items-center text-green-600">
          <TrendingUp className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">+{percentageChange}%</span>
        </div>
      )}
      {isNegative && (
        <div className="flex items-center text-red-600">
          <TrendingDown className="h-4 w-4 mr-1" />
          <span className="text-sm font-medium">-{percentageChange}%</span>
        </div>
      )}
      {!isPositive && !isNegative && (
        <div className="flex items-center text-text-muted">
          <Minus className="h-4 w-4 mr-1" />
          <span className="text-sm">0%</span>
        </div>
      )}
    </div>
  );
};

export default TrendIndicator;
