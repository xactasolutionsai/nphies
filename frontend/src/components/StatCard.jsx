import React from 'react';

const StatCard = ({ 
  title, 
  value, 
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = 'primary',
  size = 'default'
}) => {
  const colorClasses = {
    primary: 'bg-primary-purple/5 text-primary-purple',
    cyan: 'bg-accent-cyan/10 text-accent-cyan',
    teal: 'bg-accent-teal/10 text-accent-teal',
    orange: 'bg-accent-orange/10 text-accent-orange',
    purple: 'bg-accent-purple/10 text-accent-purple',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600'
  };

  const sizeClasses = {
    small: 'p-4',
    default: 'p-6',
    large: 'p-8'
  };

  const valueSizeClasses = {
    small: 'text-2xl',
    default: 'text-3xl',
    large: 'text-4xl'
  };

  const formatValue = (val) => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 ${sizeClasses[size]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className={`${valueSizeClasses[size]} font-bold text-gray-900 mt-2`}>
            {formatValue(value)}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-3">
              <span className={`inline-flex items-center text-sm font-medium ${
                trend === 'up' ? 'text-green-600' : 
                trend === 'down' ? 'text-red-600' : 
                'text-gray-500'
              }`}>
                {trend === 'up' && (
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                )}
                {trend === 'down' && (
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                )}
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-xl p-3 ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;

