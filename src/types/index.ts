export type EntityCategory = 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';

export interface BudgetBreakdown {
  flights: number;
  hotels: number;
  restaurants: number;
  activities: number;
  transport: number;
}

export interface TravelEntity {
  id: string;
  category: EntityCategory;
  title: string;
  subtitle: string;
  price: number;
  currency: 'USD';
  time?: string;
  duration?: string;
  rating?: number;
  image?: string;
  aiGenerated?: boolean;
  details: Record<string, string | number | boolean>;
  booked: boolean;
}

export interface DayPlan {
  id: string;
  date: string; // ISO date string
  dayNumber: number;
  destination: string;
  countryCode: string;
  entities: TravelEntity[];
  dailyBudget: number;
  weather?: { temp: number; icon: string; condition: string };
}

export interface BurnRateSnapshot {
  date: string;
  spent: number;
  projected: number;
  dailyAverage: number;
}

export interface TripState {
  id: string;
  title: string;
  travelers: string[];
  startDate: string;
  endDate: string;
  totalBudget: number;
  currency: 'USD';
  days: DayPlan[];
  budgetBreakdown: BudgetBreakdown;
  burnRate: BurnRateSnapshot[];
  aiSuggestions: TravelEntity[];
  activeDay: string | null;
  draggingEntity: TravelEntity | null;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  budgetAlertThreshold: number; // 0-1, percentage
}
