import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function IngressMonitorTable({
  title,
  columns,
  data = [],
  emptyMessage,
  onRefresh,
  refreshLabel = 'Refresh',
}) {
  return (
    <div className="bg-[#0B1224]/80 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
      <div className="p-5 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
        <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-widest border border-white/5 hover:text-white hover:bg-white/10 transition-colors"
          >
            <RefreshCw size={12} />
            {refreshLabel}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-white/5 bg-white/[0.02]">
              {columns.map((col) => (
                <th key={col.key} className="p-4 font-bold text-left whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="p-10 text-center text-sm text-gray-500 italic"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={row.id ?? i}
                  className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                >
                  {columns.map((col) => (
                    <td key={col.key} className="p-4 text-xs text-gray-300 whitespace-nowrap">
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
