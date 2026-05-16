export interface Settings {
  apiKey: string;
  dailyGoal: number;
  userContext: string;
  proteinGoal?: number;
  fatGoal?: number;
  carbsGoal?: number;
  apiMode?: 'free' | 'simple' | 'advanced';
}

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  ai_thoughts: string;
  reasoning?: string;
  confidence_score?: number;
  images?: string[]; // Base64 array
  image?: string; // For backward compatibility
}

export interface FavoriteMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface WeightEntry {
  date: string; // YYYY-MM-DD
  weight: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  images?: string[];
}
