import fs from 'fs';
import path from 'path';

let content = fs.readFileSync(path.resolve('src/screens/AddMeal.tsx'), 'utf-8');

const skeletonHtml = `
          {isAnalyzing ? (
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
          ) : (
            <>
              {/* Image Capture / Preview */}
`;

// Looking for :
//          {/* Image Capture / Preview */}
//          {images.length === 0 ? (
// Need to add skeleton condition

content = content.replace(
  "{/* Image Capture / Preview */}",
  skeletonHtml
);

// Search for the end of the input fields to close the `) : (` tag.
// Where should the closing tag be? Right before `{/* Analyze Button */}` or maybe before `{error &&`

content = content.replace(
  "{error && (",
  "</>\n          )}\n\n          {error && ("
);

// Fix button text style to match the new rounded-xl style
content = content.replace(/className="bg-white rounded-\[20px\] shadow-sm p-5/g, 'className="bg-white rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5');
content = content.replace(/className="bg-white rounded-\[20px\] shadow-sm p-3"/g, 'className="bg-white rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-3"');
content = content.replace(/className="bg-white rounded-\[20px\] p-5 shadow-sm"/g, 'className="bg-white rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-5"');


fs.writeFileSync(path.resolve('src/screens/AddMeal.tsx'), content);
console.log('AddMeal updated');
