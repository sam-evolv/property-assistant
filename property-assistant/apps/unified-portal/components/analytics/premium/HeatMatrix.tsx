'use client';

interface HeatMatrixProps {
  data: { x: string; y: string; value: number }[];
  title: string;
}

export function HeatMatrix({ data, title }: HeatMatrixProps) {
  const xLabels = Array.from(new Set(data.map(d => d.x)));
  const yLabels = Array.from(new Set(data.map(d => d.y)));
  const maxValue = Math.max(...data.map(d => d.value), 1);

  const getValue = (x: string, y: string) => {
    const item = data.find(d => d.x === x && d.y === y);
    return item ? item.value : 0;
  };

  const getIntensity = (value: number) => {
    const intensity = (value / maxValue);
    return `rgba(251, 191, 36, ${intensity})`;
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-black p-6">
      <h3 className="text-sm font-medium text-gray-400 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2"></th>
              {xLabels.map(label => (
                <th key={label} className="p-2 text-xs text-gray-400 font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {yLabels.map(yLabel => (
              <tr key={yLabel}>
                <td className="p-2 text-xs text-gray-400 font-normal">{yLabel}</td>
                {xLabels.map(xLabel => {
                  const value = getValue(xLabel, yLabel);
                  return (
                    <td key={`${xLabel}-${yLabel}`} className="p-1">
                      <div
                        className="h-8 w-8 rounded flex items-center justify-center text-xs font-medium text-white transition-all hover:scale-110"
                        style={{ backgroundColor: getIntensity(value) }}
                        title={`${xLabel} - ${yLabel}: ${value}`}
                      >
                        {value > 0 ? value : ''}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
