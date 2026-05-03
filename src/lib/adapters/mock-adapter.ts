import { DataAdapter, AdapterConfig, AdapterResult, DataQuery } from './interface';
import type { VaultEntryData, FinancialRecord, Contact, CalendarEvent, Preference, Booking } from '@/types/vault';

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function mockFinancialRecords(): FinancialRecord[] {
  const transactions: FinancialRecord[] = [
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Whole Foods Groceries', amount: -87.43, currency: 'USD', category: 'groceries', date: pastDate(1), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Trader Joe\'s Weekly Shop', amount: -62.15, currency: 'USD', category: 'groceries', date: pastDate(4), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Costco Bulk Purchase', amount: -145.80, currency: 'USD', category: 'groceries', date: pastDate(8), account: 'credit' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Sushi Nakazawa Dinner', amount: -124.50, currency: 'USD', category: 'dining', date: pastDate(2), account: 'credit' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Blue Bottle Coffee', amount: -6.75, currency: 'USD', category: 'dining', date: pastDate(1), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Thai Basil Takeout', amount: -32.00, currency: 'USD', category: 'dining', date: pastDate(5), account: 'credit' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Electric Bill - ConEd', amount: -142.30, currency: 'USD', category: 'utilities', date: pastDate(10), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Internet - Spectrum', amount: -79.99, currency: 'USD', category: 'utilities', date: pastDate(12), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Water & Sewer Bill', amount: -45.00, currency: 'USD', category: 'utilities', date: pastDate(15), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Monthly Salary - Acme Corp', amount: 8500.00, currency: 'USD', category: 'salary', date: pastDate(3), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Freelance Payment - Design Work', amount: 1200.00, currency: 'USD', category: 'salary', date: pastDate(7), account: 'checking' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Vanguard S&P 500 Purchase', amount: -500.00, currency: 'USD', category: 'investments', date: pastDate(6), account: 'brokerage' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Dividend - AAPL', amount: 24.80, currency: 'USD', category: 'investments', date: pastDate(14), account: 'brokerage' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Bitcoin Purchase', amount: -250.00, currency: 'USD', category: 'investments', date: pastDate(9), account: 'crypto' } },
    { type: 'financial_record', subtype: 'transaction', data: { description: 'Bond ETF Purchase', amount: -300.00, currency: 'USD', category: 'investments', date: pastDate(11), account: 'brokerage' } },
  ];

  const holdings: FinancialRecord[] = [
    { type: 'financial_record', subtype: 'holding', data: { description: 'Apple Inc.', amount: 15230.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'AAPL', shares: 85 } } },
    { type: 'financial_record', subtype: 'holding', data: { description: 'Alphabet Inc.', amount: 8940.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'GOOGL', shares: 52 } } },
    { type: 'financial_record', subtype: 'holding', data: { description: 'Microsoft Corp.', amount: 12100.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'MSFT', shares: 30 } } },
    { type: 'financial_record', subtype: 'holding', data: { description: 'Amazon.com Inc.', amount: 6780.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'AMZN', shares: 38 } } },
    { type: 'financial_record', subtype: 'holding', data: { description: 'Bitcoin', amount: 4250.00, currency: 'USD', category: 'crypto', date: pastDate(0), account: 'crypto', metadata: { ticker: 'BTC', shares: 0.065 } } },
  ];

  const budgets: FinancialRecord[] = [
    { type: 'financial_record', subtype: 'budget', data: { description: 'Monthly Groceries Budget', amount: 600.00, currency: 'USD', category: 'groceries', date: pastDate(0), account: 'checking' } },
    { type: 'financial_record', subtype: 'budget', data: { description: 'Monthly Dining Budget', amount: 400.00, currency: 'USD', category: 'dining', date: pastDate(0), account: 'checking' } },
    { type: 'financial_record', subtype: 'budget', data: { description: 'Monthly Utilities Budget', amount: 350.00, currency: 'USD', category: 'utilities', date: pastDate(0), account: 'checking' } },
  ];

  return [...transactions, ...holdings, ...budgets];
}

function mockContacts(): Contact[] {
  return [
    { type: 'contact', data: { name: 'Sarah Chen', email: 'sarah.chen@email.com', phone: '+1-555-0101', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1990-03-15' }], tags: ['colleague', 'engineering'], communicationHistory: [{ date: pastDate(2), summary: 'Discussed Q3 roadmap priorities' }] } },
    { type: 'contact', data: { name: 'Marcus Johnson', email: 'marcus.j@email.com', phone: '+1-555-0102', relationshipType: 'personal', importantDates: [{ label: 'Birthday', date: '1988-07-22' }], tags: ['friend', 'college'], communicationHistory: [{ date: pastDate(5), summary: 'Planned weekend hiking trip' }] } },
    { type: 'contact', data: { name: 'Emily Rodriguez', email: 'emily.r@company.com', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1992-11-08' }], tags: ['manager', 'mentor'], communicationHistory: [{ date: pastDate(1), summary: '1:1 performance review discussion' }] } },
    { type: 'contact', data: { name: 'David Park', email: 'david.park@email.com', phone: '+1-555-0104', relationshipType: 'family', importantDates: [{ label: 'Birthday', date: '1965-01-30' }, { label: 'Anniversary', date: '1990-06-15' }], tags: ['father'], communicationHistory: [{ date: pastDate(3), summary: 'Weekly family video call' }] } },
    { type: 'contact', data: { name: 'Lisa Wang', email: 'lisa.wang@startup.io', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1994-09-12' }], tags: ['investor', 'advisor'], communicationHistory: [{ date: pastDate(7), summary: 'Reviewed investment portfolio strategy' }] } },
    { type: 'contact', data: { name: 'James O\'Brien', phone: '+1-555-0106', relationshipType: 'personal', importantDates: [{ label: 'Birthday', date: '1991-04-18' }], tags: ['friend', 'gym-buddy'], communicationHistory: [{ date: pastDate(1), summary: 'Morning workout session' }] } },
    { type: 'contact', data: { name: 'Priya Sharma', email: 'priya.s@email.com', phone: '+1-555-0107', relationshipType: 'family', importantDates: [{ label: 'Birthday', date: '1993-12-25' }, { label: 'Anniversary', date: '2020-10-10' }], tags: ['sister'], communicationHistory: [{ date: pastDate(4), summary: 'Discussed holiday travel plans' }] } },
    { type: 'contact', data: { name: 'Tom Mitchell', email: 'tom.m@agency.com', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1987-06-03' }], tags: ['client', 'design'], communicationHistory: [{ date: pastDate(6), summary: 'Reviewed brand redesign mockups' }] } },
    { type: 'contact', data: { name: 'Ana Costa', email: 'ana.costa@email.com', phone: '+1-555-0109', relationshipType: 'personal', importantDates: [{ label: 'Birthday', date: '1995-08-20' }], tags: ['friend', 'book-club'], communicationHistory: [{ date: pastDate(10), summary: 'Book club meeting - discussed latest read' }] } },
    { type: 'contact', data: { name: 'Robert Kim', email: 'robert.kim@firm.com', phone: '+1-555-0110', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1980-02-14' }], tags: ['financial-advisor'], communicationHistory: [{ date: pastDate(14), summary: 'Quarterly portfolio review meeting' }] } },
  ];
}

function mockCalendarEvents(): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (let i = 0; i < 5; i++) {
    events.push({ type: 'calendar_event', data: { title: 'Team Standup', description: 'Daily engineering sync', startTime: daysFromNow(i * 2), endTime: daysFromNow(i * 2), location: 'Zoom', recurrence: 'daily' } });
  }
  events.push(
    { type: 'calendar_event', data: { title: 'Product Strategy Meeting', description: 'Q4 planning session', startTime: daysFromNow(1), endTime: daysFromNow(1), location: 'Conference Room A', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Client Demo', description: 'Demo new features to Acme Corp', startTime: daysFromNow(3), endTime: daysFromNow(3), location: 'Zoom', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: '1:1 with Emily', description: 'Weekly manager sync', startTime: daysFromNow(2), endTime: daysFromNow(2), location: 'Office', recurrence: 'weekly' } },
    { type: 'calendar_event', data: { title: 'Board Meeting', description: 'Monthly board review', startTime: daysFromNow(14), endTime: daysFromNow(14), location: 'Boardroom', recurrence: 'monthly' } },
    { type: 'calendar_event', data: { title: 'Morning Gym Session', description: 'Strength training', startTime: daysFromNow(1), endTime: daysFromNow(1), location: 'Equinox Gym', recurrence: 'daily' } },
    { type: 'calendar_event', data: { title: 'Yoga Class', description: 'Vinyasa flow', startTime: daysFromNow(3), endTime: daysFromNow(3), location: 'Yoga Studio', recurrence: 'weekly' } },
    { type: 'calendar_event', data: { title: 'Gym - Cardio Day', description: 'Running and cycling', startTime: daysFromNow(5), endTime: daysFromNow(5), location: 'Equinox Gym', recurrence: 'weekly' } },
    { type: 'calendar_event', data: { title: 'Dinner with Marcus', description: 'Catching up at Italian place', startTime: daysFromNow(4), endTime: daysFromNow(4), location: 'Carbone NYC', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Family Dinner', description: 'Sunday family gathering', startTime: daysFromNow(6), endTime: daysFromNow(6), location: 'Dad\'s House', recurrence: 'weekly' } },
    { type: 'calendar_event', data: { title: 'Birthday Dinner - Ana', description: 'Surprise dinner for Ana', startTime: daysFromNow(18), endTime: daysFromNow(18), location: 'Le Bernardin', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Doctor Appointment', description: 'Annual physical checkup', startTime: daysFromNow(10), endTime: daysFromNow(10), location: 'Dr. Smith\'s Office', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Dentist Cleaning', description: 'Routine dental cleaning', startTime: daysFromNow(20), endTime: daysFromNow(20), location: 'Bright Smiles Dental', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Sprint Retrospective', description: 'End of sprint review', startTime: daysFromNow(8), endTime: daysFromNow(8), location: 'Conference Room B', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Design Review', description: 'Review UI mockups with Tom', startTime: daysFromNow(12), endTime: daysFromNow(12), location: 'Figma Call', recurrence: 'none' } },
    { type: 'calendar_event', data: { title: 'Book Club Meeting', description: 'Monthly book discussion', startTime: daysFromNow(25), endTime: daysFromNow(25), location: 'Ana\'s Apartment', recurrence: 'monthly' } },
  );
  return events;
}

function mockPreferences(): Preference[] {
  return [
    { type: 'preference', data: { category: 'financial', key: 'risk_tolerance', value: 'moderate' } },
    { type: 'preference', data: { category: 'financial', key: 'investment_horizon', value: 'long-term' } },
    { type: 'preference', data: { category: 'lifestyle', key: 'wellness', value: ['yoga', 'meditation', 'strength-training'] } },
    { type: 'preference', data: { category: 'lifestyle', key: 'dietary', value: 'pescatarian' } },
    { type: 'preference', data: { category: 'notification', key: 'daily_digest', value: true } },
  ];
}

function mockBookings(): Booking[] {
  return [
    { type: 'booking', data: { serviceType: 'restaurant', venue: 'Carbone NYC', date: daysFromNow(4).split('T')[0], time: '19:30', preferences: 'Window table, no shellfish', status: 'confirmed' } },
    { type: 'booking', data: { serviceType: 'service', venue: 'Exhale Spa', date: daysFromNow(9).split('T')[0], time: '14:00', preferences: 'Deep tissue massage, 60 min', status: 'pending' } },
    { type: 'booking', data: { serviceType: 'appointment', venue: 'Bright Smiles Dental', date: daysFromNow(20).split('T')[0], time: '10:00', status: 'confirmed' } },
  ];
}

export class MockAdapter implements DataAdapter {
  readonly id = 'mock';
  readonly name = 'Mock Data';

  async initialize(_config: AdapterConfig): Promise<void> {
    // No-op — mock adapter needs no external connection
  }

  async authenticate(): Promise<AdapterResult<void>> {
    return { success: true };
  }

  async fetchData<T>(query: DataQuery): Promise<AdapterResult<T[]>> {
    const generators: Record<string, () => VaultEntryData[]> = {
      financial_record: mockFinancialRecords,
      contact: mockContacts,
      calendar_event: mockCalendarEvents,
      preference: mockPreferences,
      booking: mockBookings,
    };

    const generator = generators[query.entityType];
    if (!generator) {
      return { success: false, error: { code: 'UNKNOWN_ENTITY', message: `Unknown entity type: ${query.entityType}` } };
    }

    let data = generator();
    if (query.offset) data = data.slice(query.offset);
    if (query.limit) data = data.slice(0, query.limit);

    return { success: true, data: data as unknown as T[] };
  }

  transformData<TInput, TOutput>(raw: TInput): AdapterResult<TOutput> {
    return { success: true, data: raw as unknown as TOutput };
  }

  async healthCheck(): Promise<AdapterResult<{ status: 'ok' | 'degraded' | 'down' }>> {
    return { success: true, data: { status: 'ok' } };
  }
}

export const mockAdapter = new MockAdapter();
