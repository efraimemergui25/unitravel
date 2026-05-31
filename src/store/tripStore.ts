import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { TripState, DayPlan, TravelEntity, BudgetBreakdown } from '@/types';

// ── Mock Data ─────────────────────────────────────────────────────────────────

const generateDays = (): DayPlan[] => {
  const destinations = [
    { city: 'Mexico City', country: 'MX', days: 4 },
    { city: 'Tulum',       country: 'MX', days: 5 },
    { city: 'Riviera Maya',country: 'MX', days: 7 },
    { city: 'Cabo San Lucas', country: 'MX', days: 6 },
  ];

  const weatherOptions = [
    { temp: 28, icon: '☀️', condition: 'Sunny' },
    { temp: 31, icon: '⛅', condition: 'Partly Cloudy' },
    { temp: 27, icon: '🌤', condition: 'Mostly Clear' },
  ];

  const days: DayPlan[] = [];
  let dayCounter = 1;
  const baseDate = new Date('2026-10-01');

  destinations.forEach(dest => {
    for (let i = 0; i < dest.days; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + dayCounter - 1);

      const entities: TravelEntity[] = [];

      if (i === 0 && dayCounter > 1) {
        entities.push({
          id: `flight-${dayCounter}`,
          category: 'flight',
          title: `Business Class · ${destinations[destinations.indexOf(dest) - 1]?.city || 'TLV'} → ${dest.city}`,
          subtitle: 'AeroMéxico · AM 123',
          price: 1200,
          currency: 'USD',
          time: '09:00',
          duration: '1h 45m',
          rating: 4.8,
          details: { class: 'Business', terminal: 'T2', gate: 'G14', baggage: '2 × 32kg' },
          booked: dayCounter === 1,
          aiGenerated: true,
        });
      }

      if (dayCounter === 1) {
        entities.push({
          id: `flight-intl-1`,
          category: 'flight',
          title: 'Business Class · TLV → MEX',
          subtitle: 'El Al + Aeromexico · Codeshare',
          price: 4800,
          currency: 'USD',
          time: '23:55',
          duration: '15h 20m',
          rating: 4.9,
          details: { class: 'Business', terminal: 'T3', gate: 'B22', baggage: '2 × 32kg', stopover: 'Madrid 2h' },
          booked: true,
          aiGenerated: false,
        });
      }

      entities.push({
        id: `hotel-${dayCounter}`,
        category: 'hotel',
        title: i === 0
          ? `${dest.city === 'Mexico City' ? 'Four Seasons Mexico City' : dest.city === 'Tulum' ? 'Azulik Resort & Spa' : dest.city === 'Riviera Maya' ? 'Rosewood Mayakoba' : 'One&Only Palmilla'}`
          : '',
        subtitle: '5★ · Sea View Suite',
        price: dest.city === 'Mexico City' ? 680 : dest.city === 'Tulum' ? 920 : dest.city === 'Riviera Maya' ? 1100 : 1350,
        currency: 'USD',
        time: '15:00',
        duration: 'Check-in',
        rating: 4.95,
        details: { roomType: 'Overwater Suite', breakfast: 'Included', spa: 'Complimentary Access' },
        booked: dayCounter <= 3,
        aiGenerated: false,
      });

      if (entities[entities.length - 1].title === '') {
        entities[entities.length - 1].title = `Night ${i + 1} · ${dest.city === 'Mexico City' ? 'Four Seasons Mexico City' : dest.city === 'Tulum' ? 'Azulik Resort & Spa' : dest.city === 'Riviera Maya' ? 'Rosewood Mayakoba' : 'One&Only Palmilla'}`;
      }

      entities.push({
        id: `dinner-${dayCounter}`,
        category: 'restaurant',
        title: ['Pujol', 'Hartwood', 'La Cocina de Mamá Carmen', 'El Farallon', 'Quintonil', 'Manta', 'Axiom'][dayCounter % 7],
        subtitle: 'Fine Dining · 8 PM Reservation',
        price: 320,
        currency: 'USD',
        time: '20:00',
        duration: '2h 30m',
        rating: 4.7 + (dayCounter % 3) * 0.05,
        details: { cuisine: 'Contemporary Mexican', dressCode: 'Smart Casual', michelin: '2 Stars' },
        booked: dayCounter <= 2,
        aiGenerated: true,
      });

      days.push({
        id: `day-${dayCounter}`,
        date: date.toISOString().split('T')[0],
        dayNumber: dayCounter,
        destination: dest.city,
        countryCode: dest.country,
        entities,
        dailyBudget: 2800,
        weather: weatherOptions[dayCounter % 3],
      });

      dayCounter++;
    }
  });

  return days;
};

const initialDays = generateDays();

const computeBudgetBreakdown = (days: DayPlan[]): BudgetBreakdown => {
  const breakdown: BudgetBreakdown = { flights: 0, hotels: 0, restaurants: 0, activities: 0, transport: 0 };
  days.forEach(day => {
    day.entities.forEach(e => {
      if (e.category === 'flight') breakdown.flights += e.price;
      else if (e.category === 'hotel') breakdown.hotels += e.price;
      else if (e.category === 'restaurant') breakdown.restaurants += e.price;
      else if (e.category === 'activity') breakdown.activities += e.price;
      else if (e.category === 'transport') breakdown.transport += e.price;
    });
  });
  return breakdown;
};

const AI_SUGGESTIONS: TravelEntity[] = [
  {
    id: 'ai-1',
    category: 'activity',
    title: 'Private Cenote Snorkeling',
    subtitle: 'Exclusive after-hours access · Gran Cenote',
    price: 480,
    currency: 'USD',
    time: '07:00',
    duration: '3h',
    rating: 4.95,
    details: { groupSize: 'Private', equipment: 'Included', guide: 'Certified' },
    booked: false,
    aiGenerated: true,
  },
  {
    id: 'ai-2',
    category: 'activity',
    title: 'Tequila Masterclass at Casa Noble',
    subtitle: 'Estate tour + barrel selection',
    price: 350,
    currency: 'USD',
    time: '11:00',
    duration: '2h',
    rating: 4.8,
    details: { bottles: '2 custom labeled', transport: 'Included' },
    booked: false,
    aiGenerated: true,
  },
  {
    id: 'ai-3',
    category: 'transport',
    title: 'Private Helicopter · Tulum → Cancun',
    subtitle: 'Bell 407 · Scenic Route',
    price: 1800,
    currency: 'USD',
    time: 'Flexible',
    duration: '45m',
    rating: 5.0,
    details: { capacity: '4 pax', luggage: '40kg total', champagne: 'Included' },
    booked: false,
    aiGenerated: true,
  },
  {
    id: 'ai-4',
    category: 'restaurant',
    title: 'Sunset Dinner on Private Beach',
    subtitle: 'Catamaran · Chef\'s Table · 12 courses',
    price: 890,
    currency: 'USD',
    time: '18:30',
    duration: '4h',
    rating: 5.0,
    details: { cuisine: 'Modern Mexican', pairing: 'Wine Pairing Included', capacity: 'Couple Only' },
    booked: false,
    aiGenerated: true,
  },
];

// ── Store ─────────────────────────────────────────────────────────────────────

interface TripActions {
  setActiveDay: (dayId: string | null) => void;
  addEntityToDay: (dayId: string, entity: TravelEntity) => void;
  removeEntityFromDay: (dayId: string, entityId: string) => void;
  toggleEntityBooked: (dayId: string, entityId: string) => void;
  setDraggingEntity: (entity: TravelEntity | null) => void;
  toggleSidebar: () => void;
  toggleAIPanel: () => void;
  reorderEntities: (dayId: string, fromIndex: number, toIndex: number) => void;
  getTotalSpent: () => number;
  getBurnRate: () => number; // 0-1
}

type TripStore = TripState & TripActions;

export const useTripStore = create<TripStore>()(
  immer((set, get) => ({
    id: 'honeymoon-mx-2026',
    title: 'Effi & Nofar · Honeymoon in Mexico',
    travelers: ['Effi', 'Nofar'],
    startDate: '2026-10-01',
    endDate: '2026-10-21',
    totalBudget: 42000,
    currency: 'USD',
    days: initialDays,
    budgetBreakdown: computeBudgetBreakdown(initialDays),
    burnRate: [],
    aiSuggestions: AI_SUGGESTIONS,
    activeDay: 'day-1',
    draggingEntity: null,
    sidebarOpen: false,
    aiPanelOpen: true,
    budgetAlertThreshold: 0.85,

    setActiveDay: (dayId) => set(state => { state.activeDay = dayId; }),

    addEntityToDay: (dayId, entity) => set(state => {
      const day = state.days.find(d => d.id === dayId);
      if (day) {
        day.entities.push(entity);
        const idx = state.aiSuggestions.findIndex(e => e.id === entity.id);
        if (idx !== -1) state.aiSuggestions.splice(idx, 1);
        state.budgetBreakdown = computeBudgetBreakdown(state.days);
      }
    }),

    removeEntityFromDay: (dayId, entityId) => set(state => {
      const day = state.days.find(d => d.id === dayId);
      if (day) {
        day.entities = day.entities.filter(e => e.id !== entityId);
        state.budgetBreakdown = computeBudgetBreakdown(state.days);
      }
    }),

    toggleEntityBooked: (dayId, entityId) => set(state => {
      const day = state.days.find(d => d.id === dayId);
      const entity = day?.entities.find(e => e.id === entityId);
      if (entity) entity.booked = !entity.booked;
    }),

    setDraggingEntity: (entity) => set(state => { state.draggingEntity = entity; }),

    toggleSidebar: () => set(state => { state.sidebarOpen = !state.sidebarOpen; }),

    toggleAIPanel: () => set(state => { state.aiPanelOpen = !state.aiPanelOpen; }),

    reorderEntities: (dayId, fromIndex, toIndex) => set(state => {
      const day = state.days.find(d => d.id === dayId);
      if (day) {
        const [moved] = day.entities.splice(fromIndex, 1);
        day.entities.splice(toIndex, 0, moved);
      }
    }),

    getTotalSpent: () => {
      const { budgetBreakdown } = get();
      return Object.values(budgetBreakdown).reduce((a, b) => a + b, 0);
    },

    getBurnRate: () => {
      const store = get();
      const totalSpent = store.getTotalSpent();
      return totalSpent / store.totalBudget;
    },
  }))
);
