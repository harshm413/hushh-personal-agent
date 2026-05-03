import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env with override so system env vars don't interfere
dotenv.config({ path: path.resolve(__dirname, '..', '.env'), override: true });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Inline crypto helpers (seed runs outside Next.js, can't use @/ alias)
function getMasterKey(): Buffer {
  const key = process.env.VAULT_MASTER_KEY;
  if (!key) throw new Error('VAULT_MASTER_KEY environment variable is not set');
  return Buffer.from(key, 'hex');
}

function deriveUserKey(masterKey: Buffer, userId: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', masterKey, userId, 'hushh-vault-key', 32));
}

function encrypt(plaintext: string, userKey: Buffer): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', userKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

// Inline mock data generators (seed runs outside Next.js context)
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

function getMockData(entityType: string): Record<string, unknown>[] {
  switch (entityType) {
    case 'financial_record':
      return [
        { type: 'financial_record', subtype: 'transaction', data: { description: 'Whole Foods Groceries', amount: -87.43, currency: 'USD', category: 'groceries', date: pastDate(1), account: 'checking' } },
        { type: 'financial_record', subtype: 'transaction', data: { description: 'Sushi Nakazawa Dinner', amount: -124.50, currency: 'USD', category: 'dining', date: pastDate(2), account: 'credit' } },
        { type: 'financial_record', subtype: 'transaction', data: { description: 'Electric Bill - ConEd', amount: -142.30, currency: 'USD', category: 'utilities', date: pastDate(10), account: 'checking' } },
        { type: 'financial_record', subtype: 'transaction', data: { description: 'Monthly Salary - Acme Corp', amount: 8500.00, currency: 'USD', category: 'salary', date: pastDate(3), account: 'checking' } },
        { type: 'financial_record', subtype: 'transaction', data: { description: 'Vanguard S&P 500 Purchase', amount: -500.00, currency: 'USD', category: 'investments', date: pastDate(6), account: 'brokerage' } },
        { type: 'financial_record', subtype: 'holding', data: { description: 'Apple Inc.', amount: 15230.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'AAPL', shares: 85 } } },
        { type: 'financial_record', subtype: 'holding', data: { description: 'Alphabet Inc.', amount: 8940.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'GOOGL', shares: 52 } } },
        { type: 'financial_record', subtype: 'holding', data: { description: 'Microsoft Corp.', amount: 12100.00, currency: 'USD', category: 'stocks', date: pastDate(0), account: 'brokerage', metadata: { ticker: 'MSFT', shares: 30 } } },
        { type: 'financial_record', subtype: 'budget', data: { description: 'Monthly Groceries Budget', amount: 600.00, currency: 'USD', category: 'groceries', date: pastDate(0), account: 'checking' } },
      ];
    case 'contact':
      return [
        { type: 'contact', data: { name: 'Sarah Chen', email: 'sarah.chen@email.com', phone: '+1-555-0101', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1990-03-15' }], tags: ['colleague', 'engineering'], communicationHistory: [{ date: pastDate(2), summary: 'Discussed Q3 roadmap priorities' }] } },
        { type: 'contact', data: { name: 'Marcus Johnson', email: 'marcus.j@email.com', relationshipType: 'personal', importantDates: [{ label: 'Birthday', date: '1988-07-22' }], tags: ['friend', 'college'], communicationHistory: [{ date: pastDate(5), summary: 'Planned weekend hiking trip' }] } },
        { type: 'contact', data: { name: 'David Park', email: 'david.park@email.com', phone: '+1-555-0104', relationshipType: 'family', importantDates: [{ label: 'Birthday', date: '1965-01-30' }, { label: 'Anniversary', date: '1990-06-15' }], tags: ['father'], communicationHistory: [{ date: pastDate(3), summary: 'Weekly family video call' }] } },
        { type: 'contact', data: { name: 'Lisa Wang', email: 'lisa.wang@startup.io', relationshipType: 'professional', importantDates: [{ label: 'Birthday', date: '1994-09-12' }], tags: ['investor', 'advisor'], communicationHistory: [{ date: pastDate(7), summary: 'Reviewed investment portfolio strategy' }] } },
        { type: 'contact', data: { name: 'Priya Sharma', email: 'priya.s@email.com', phone: '+1-555-0107', relationshipType: 'family', importantDates: [{ label: 'Birthday', date: '1993-12-25' }], tags: ['sister'], communicationHistory: [{ date: pastDate(4), summary: 'Discussed holiday travel plans' }] } },
      ];
    case 'calendar_event':
      return [
        { type: 'calendar_event', data: { title: 'Team Standup', description: 'Daily engineering sync', startTime: daysFromNow(1), endTime: daysFromNow(1), location: 'Zoom', recurrence: 'daily' } },
        { type: 'calendar_event', data: { title: 'Product Strategy Meeting', startTime: daysFromNow(3), endTime: daysFromNow(3), location: 'Conference Room A', recurrence: 'none' } },
        { type: 'calendar_event', data: { title: 'Morning Gym Session', description: 'Strength training', startTime: daysFromNow(1), endTime: daysFromNow(1), location: 'Equinox Gym', recurrence: 'daily' } },
        { type: 'calendar_event', data: { title: 'Dinner with Marcus', startTime: daysFromNow(4), endTime: daysFromNow(4), location: 'Carbone NYC', recurrence: 'none' } },
        { type: 'calendar_event', data: { title: 'Doctor Appointment', description: 'Annual physical', startTime: daysFromNow(10), endTime: daysFromNow(10), location: "Dr. Smith's Office", recurrence: 'none' } },
      ];
    case 'preference':
      return [
        { type: 'preference', data: { category: 'financial', key: 'risk_tolerance', value: 'moderate' } },
        { type: 'preference', data: { category: 'lifestyle', key: 'wellness', value: ['yoga', 'meditation'] } },
      ];
    case 'booking':
      return [
        { type: 'booking', data: { serviceType: 'restaurant', venue: 'Carbone NYC', date: daysFromNow(4).split('T')[0], time: '19:30', preferences: 'Window table', status: 'confirmed' } },
        { type: 'booking', data: { serviceType: 'service', venue: 'Exhale Spa', date: daysFromNow(9).split('T')[0], time: '14:00', preferences: 'Deep tissue massage', status: 'pending' } },
        { type: 'booking', data: { serviceType: 'appointment', venue: 'Bright Smiles Dental', date: daysFromNow(20).split('T')[0], time: '10:00', status: 'confirmed' } },
      ];
    default:
      return [];
  }
}

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log('Database already seeded — skipping.');
    return;
  }

  console.log('Seeding database...');

  // 1. Create demo user
  const passwordHash = await bcrypt.hash('demo123', 12);
  const user = await prisma.user.create({
    data: {
      email: 'demo@hushh.ai',
      name: 'Demo User',
      passwordHash,
      onboardingDone: true,
    },
  });
  console.log(`Created demo user: ${user.email} (${user.id})`);

  // 2. Create UserProfile
  await prisma.userProfile.create({
    data: {
      userId: user.id,
      riskTolerance: 'moderate',
      investmentGoals: 'Long-term growth with balanced risk',
      incomeRange: '100k-150k',
      wellnessInterests: ['yoga', 'meditation', 'strength-training'],
      dietaryPreferences: ['pescatarian'],
      favoriteCategories: ['technology', 'finance', 'wellness'],
    },
  });
  console.log('Created user profile');

  // 3. Encrypt and store mock vault entries
  const masterKey = getMasterKey();
  const userKey = deriveUserKey(masterKey, user.id);

  const entityTypes = ['financial_record', 'contact', 'calendar_event', 'preference', 'booking'] as const;
  let totalEntries = 0;

  for (const entityType of entityTypes) {
    const items = getMockData(entityType);
    for (const item of items) {
      const json = JSON.stringify(item);
      const encryptedData = encrypt(json, userKey);
      await prisma.vaultEntry.create({
        data: {
          userId: user.id,
          entryType: entityType,
          encryptedData,
        },
      });
      totalEntries++;
    }
  }
  console.log(`Created ${totalEntries} encrypted vault entries`);

  // 4. Create default ConsentToggle entries (all disabled)
  const consentFields = [
    'financial_record', 'contact', 'calendar_event', 'preference', 'booking',
  ];
  const personaScopes = ['kai', 'nav', 'both'];

  for (const fieldId of consentFields) {
    for (const scope of personaScopes) {
      await prisma.consentToggle.create({
        data: {
          userId: user.id,
          dataFieldId: fieldId,
          enabled: false,
          personaScope: scope,
        },
      });
    }
  }
  console.log('Created default consent toggles (all disabled)');

  // 5. Create initial AuditEntry with GENESIS hash
  const genesisPayload = JSON.stringify({
    previousHash: 'GENESIS',
    timestamp: new Date().toISOString(),
    userId: user.id,
    actionType: 'data_write',
    resource: 'seed',
    resourceId: undefined,
  });
  const genesisHash = crypto.createHash('sha256').update(genesisPayload).digest('hex');

  await prisma.auditEntry.create({
    data: {
      userId: user.id,
      actionType: 'data_write',
      resource: 'seed',
      hash: genesisHash,
      previousHash: 'GENESIS',
      metadata: { event: 'database_seeded', entriesCreated: totalEntries },
    },
  });
  console.log('Created genesis audit entry');

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
