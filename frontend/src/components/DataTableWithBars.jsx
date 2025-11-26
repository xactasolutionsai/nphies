import React from 'react';

const DataTableWithBars = ({ data, columns, onRowClick }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-accent-cyan';
    if (score >= 60) return 'bg-accent-teal';
    if (score >= 40) return 'bg-accent-orange';
    return 'bg-red-500';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border-light">
        <thead className="bg-bg-tab">
          <tr>
            {columns.map((column, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider"
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-bg-card divide-y divide-border-light">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-bg-tab cursor-pointer transition-colors"
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((column, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-text-body">
                  {column.key === 'score' ? (
                    <div className="flex items-center space-x-3">
                      <div className="flex-1 bg-border-light rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getScoreColor(row[column.key])}`}
                          style={{ width: `${row[column.key]}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-text-heading min-w-[3rem]">
                        {row[column.key]}%
                      </span>
                    </div>
                  ) : column.key === 'status' ? (
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      row[column.key] === 'Approved' || row[column.key] === 'Completed' 
                        ? 'bg-accent-teal/10 text-accent-teal' 
                        : row[column.key] === 'Pending' 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : row[column.key] === 'Rejected' || row[column.key] === 'Failed' 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {row[column.key]}
                    </span>
                  ) : column.key === 'amount' ? (
                    <span className="text-right font-medium">
                      ${typeof row[column.key] === 'number' ? row[column.key].toLocaleString() : row[column.key]}
                    </span>
                  ) : (
                    row[column.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTableWithBars;
