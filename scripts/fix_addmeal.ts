import fs from "fs";
import path from "path";

let content = fs.readFileSync(path.resolve("src/screens/AddMeal.tsx"), "utf-8");

// State changes inside AddMeal:
const stateTarget = `const [loadingProgress, setLoadingProgress] = useState(0);`;
const stateReplacement = `const [loadingProgress, setLoadingProgress] = useState(0);
  const [isDeepAnalyze, setIsDeepAnalyze] = useState(false);`;
content = content.replace(stateTarget, stateReplacement);

// Handle analyze function logic:
const handleAnalyzeTarget = `    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += (95 - currentProgress) * 0.15;
      setLoadingProgress(Math.round(currentProgress));
    }, 200);

    // Prepare recent meals context
    const recentMealsText = meals`;

const handleAnalyzeReplacement = `    setIsDeepAnalyze(false);
    
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        let step = 0;
        if (prev < 20) step = 8;
        else if (prev < 75) step = Math.max(0.2, (75 - prev) * 0.05);
        else step = 0.2;
        
        const next = Math.min(prev + step, 95);
        currentProgress = next;
        return next;
      });
    }, 200);

    // Prepare recent meals context
    const recentMealsText = meals`;
content = content.replace(handleAnalyzeTarget, handleAnalyzeReplacement);

// Hook into progress messages:
const msgHookTarget = `        recentMealsText,
        (msg) => setProgressMsg(msg)
      );
      setResult({ ...aiResult, aiThoughts });`;

const msgHookReplacement = `        recentMealsText,
        (msg) => {
          setProgressMsg(msg);
          if (msg.includes("глубокий анализ")) {
            setIsDeepAnalyze(true);
            setLoadingProgress(50);
            currentProgress = 50;
          }
        }
      );
      setLoadingProgress(100);
      setTimeout(() => setResult({ ...aiResult, aiThoughts }), 300);`;
content = content.replace(msgHookTarget, msgHookReplacement);

// Wait! Finally block
const finallyBlockTarget = `    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
    }`;

const finallyBlockReplacement = `    } finally {
      clearInterval(progressInterval);
      setTimeout(() => setIsAnalyzing(false), 300);
    }`;
content = content.replace(finallyBlockTarget, finallyBlockReplacement);

// Add the AnalyzingSkeleton component before and replacing the gray blocks:
const skeletonComponentStr = `

function AnalyzingSkeleton({ isDeep }: { isDeep: boolean }) {
  const [statusIdx, setStatusIdx] = useState(0);
  const statuses = [
    "Подключаем нейросети...",
    "Рассматриваем ингредиенты...",
    "Ищем скрытые жиры...",
    "Считаем каждую калорию...",
    "Почти готово..."
  ];

  React.useEffect(() => {
    const int = setInterval(() => {
      setStatusIdx(i => (i + 1) % statuses.length);
    }, 1200);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full flex flex-col gap-4">
      <div className="flex gap-4 items-start">
        <div className="w-24 h-24 rounded-[16px] bg-gray-100 overflow-hidden relative shrink-0 shadow-inner">
          <div className="absolute inset-0 bg-gray-200 animate-pulse" />
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_12px_3px_rgba(52,211,153,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
        </div>
        
        <div className="flex-1 space-y-3 py-1">
          <div className="space-y-2 mb-2">
            <div className="h-4 bg-gray-200 rounded w-full animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
          </div>
          
          <div className="flex gap-2 pt-2">
            <div className="h-5 bg-gray-100 rounded flex-1 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded flex-1 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded flex-1 animate-pulse" />
          </div>
        </div>
      </div>
      
      <div className="text-center w-full pt-2">
         <span className={"text-xs font-medium tracking-wide transition-colors duration-300 " + (isDeep ? "text-orange-500" : "text-emerald-500")}>
           {isDeep ? "Блюдо сложное, подключаем глубокий анализ..." : statuses[statusIdx]}
         </span>
      </div>
    </div>
  )
}
`;

// Insert the component before export function AddMeal
content = content.replace("export function AddMeal", skeletonComponentStr + "export function AddMeal");

const graySkeletonTarget = `{isAnalyzing ? (
            <div className="bg-white rounded-[24px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] w-full animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded-md w-1/2 mb-2"></div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
                <div className="h-12 bg-gray-100 rounded-xl w-full"></div>
              </div>
              <div className="h-16 bg-gray-100 rounded-xl w-full mt-2"></div>
            </div>
          ) : (`;

const graySkeletonReplacement = `{isAnalyzing ? (
            <AnalyzingSkeleton isDeep={isDeepAnalyze} />
          ) : (`

content = content.replace(graySkeletonTarget, graySkeletonReplacement);

// Smart Mock Progress logic on Button
const buttonProgressTarget = `className="absolute left-0 top-0 bottom-0 bg-emerald-600 transition-all duration-200"
                style={{ width: \`\${loadingProgress}%\` }}`;

const buttonProgressReplacement = `className={"absolute left-0 top-0 bottom-0 transition-all duration-300 ease-out " + (isDeepAnalyze ? "bg-orange-500" : "bg-emerald-600")}
                style={{ width: \`\${loadingProgress}%\` }}`;

content = content.replace(buttonProgressTarget, buttonProgressReplacement);

fs.writeFileSync(path.resolve("src/screens/AddMeal.tsx"), content);
console.log("Done");
