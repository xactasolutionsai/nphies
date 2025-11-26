import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const KPIRing = ({ 
  value, 
  target, 
  label, 
  color = '#2196F3', 
  size = 120,
  strokeWidth = 8,
  showTarget = true,
  isCurrency = false
}) => {
  // If no target, show a full circle or use a default percentage
  const percentage = target ? Math.min((value / target) * 100, 100) : 100;
  const data = [
    { name: 'completed', value: percentage, fill: color },
    { name: 'remaining', value: 100 - percentage, fill: '#E5E7EB' }
  ];

  const formatValue = (val) => {
    if (isCurrency) {
      if (val >= 1000000) {
        return `$${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `$${(val / 1000).toFixed(1)}K`;
      }
      return `$${val.toLocaleString()}`;
    }
    return val.toLocaleString();
  };

  return (
    <div className="flex flex-col items-center space-y-2 w-full">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size/2 - strokeWidth}
              outerRadius={size/2}
              startAngle={90}
              endAngle={450}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-text-heading leading-tight">
              {formatValue(value)}
            </div>
            {showTarget && target && (
              <div className="text-xs text-text-muted">
                Target: {formatValue(target)}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="text-sm font-medium text-text-body text-center">
        {label}
      </div>
    </div>
  );
};

export default KPIRing;
