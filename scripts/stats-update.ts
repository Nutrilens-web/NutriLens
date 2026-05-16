import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/Stats.tsx'), 'utf-8');

// 1. Tooltip component
const customTooltip = `
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-gray-100/50">
        <p className="text-sm font-semibold text-gray-900">{payload[0].value} <span className="text-[10px] text-gray-500 font-normal">ккал</span></p>
      </div>
    );
  }
  return null;
};
`;

content = content.replace("export function StatsScreen() {", customTooltip + "\nexport function StatsScreen() {");

content = content.replace(
  /<Tooltip \n\s*cursor=\{\{ fill: '#F3F4F6', radius: 6 \}\}\n\s*contentStyle=\{\{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb\(0 0 0 \/ 0\.1\)', fontSize: '12px' \}\}\n\s*\/>/g,
  `<Tooltip cursor={{ fill: '#F3F4F6', radius: 6 }} content={<CustomTooltip />} />`
);

content = content.replace(
  /<Bar dataKey="calories" radius=\{\[4, 4, 4, 4\]\}>/g,
  `<Bar dataKey="calories" radius={[6, 6, 6, 6]} isAnimationActive={true} animationBegin={0} animationDuration={800} animationEasing="ease-out">`
);

// Shimmer button
const oldButton = `<button 
             onClick={handleHealthAnalysis}
             disabled={healthLoading}
             className="w-full relative bg-gray-50 text-emerald-600 font-medium text-sm py-3 rounded-[12px] hover:bg-emerald-50 active:scale-95 transition-all flex items-center justify-center gap-2 border border-emerald-100"
          >
             {healthLoading ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : 'Получить оценку от ИИ'}
          </button>`;

const newButton = `<button 
             onClick={handleHealthAnalysis}
             disabled={healthLoading}
             className="relative w-full overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm py-3.5 rounded-2xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)] disabled:opacity-70 disabled:active:scale-100"
          >
             <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-[shimmer_2s_infinite] -skew-x-12 translate-x-[-150%]" />
             {healthLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : 'Получить оценку от ИИ'}
          </button>`;

content = content.replace(oldButton, newButton);


// Container Shadows
content = content.replace(/className="bg-white rounded-\[20px\] p-5 shadow-sm"/g, 'className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]"');
content = content.replace(/className="bg-white rounded-\[20px\] p-5 shadow-sm mt-5"/g, 'className="bg-white rounded-[24px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] mt-5"');


fs.writeFileSync(path.resolve('src/screens/Stats.tsx'), content);
console.log('Stats code updated');
