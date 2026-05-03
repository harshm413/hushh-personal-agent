# Implementation Plan: Hushh Personal Data Agent

## Overview

### What This Is
The Hushh Personal Data Agent is a privacy-first Next.js 14+ Progressive Web App providing two AI personas — **Kai** (financial advisor) and **Nav** (lifestyle/brand concierge) — as personal digital butlers. All user data is AES-256-GCM encrypted at rest in a personal Vault, with granular consent toggles (MCP) controlling what each persona can access, and a tamper-evident SHA-256 hash-chain audit trail logging every action.

### Tech Stack
- **Framework**: Next.js 14+ with App Router, TypeScript, React 18+
- **Styling**: Tailwind CSS + shadcn/ui component library + next-themes (dark/light)
- **Database**: PostgreSQL (via Docker) + Prisma ORM
- **Auth**: NextAuth.js (Google OAuth, GitHub OAuth, email/password with bcryptjs) + @simplewebauthn/server (WebAuthn/biometric) + TOTP 2FA
- **AI/LLM**: LangChain.js + Ollama (local) or any OpenAI-compatible API endpoint
- **Validation**: Zod for schema validation
- **IDs**: uuid for unique identifiers
- **Encryption**: Node.js built-in `crypto` module (AES-256-GCM + HKDF key derivation)

### Architecture Layers
1. **Presentation**: Next.js App Router pages → React components → shadcn/ui primitives
2. **API**: Next.js Route Handlers (REST) with NextAuth session middleware
3. **Service**: Domain services (Agent, Vault, Consent, Audit, Notification, Adapter, Crypto, LLM, Persona)
4. **Data**: PostgreSQL via Prisma ORM, AES-256-GCM encryption at rest for Vault entries
5. **AI**: LangChain.js orchestrating Ollama/OpenAI-compatible endpoints, SSE streaming to client

### Key Design Patterns
- **Consent-gated data access**: Every Vault read passes through ConsentService.checkAccess() before decryption
- **Server-side encryption**: Vault data encrypted/decrypted in API layer only, keys never sent to client
- **Append-only audit log**: SHA-256 hash chain where each entry references previous entry's hash (first = "GENESIS")
- **Adapter pattern**: All external data sources implement DataAdapter interface; MockAdapter is default
- **SSE streaming chat**: LLM tokens stream via Server-Sent Events to the client in real-time

### Environment Variables (`.env.example`)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hushh
NEXTAUTH_SECRET=<random-32-byte-hex>
NEXTAUTH_URL=http://localhost:3000
VAULT_MASTER_KEY=<random-32-byte-hex>
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=llama3
LLM_MAX_TOKENS=4096
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

### Prisma Models (defined in `prisma/schema.prisma`)
User, Account, Session, WebAuthnCredential, Conversation, Message, VaultEntry, ConsentToggle, AuditEntry, Notification, NotificationPreference, Escalation, UserProfile

### Project Directory Structure
```
hushh-personal-agent/
├── prisma/
│   ├── schema.prisma          # All 14 Prisma models
│   ├── seed.ts                # Mock data seeder
│   └── migrations/
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── icons/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout (SessionProvider + ThemeProvider)
│   │   ├── page.tsx           # Landing redirect
│   │   ├── (auth)/login/page.tsx
│   │   ├── (auth)/register/page.tsx
│   │   ├── (main)/layout.tsx  # Authenticated layout (sidebar + header)
│   │   ├── (main)/chat/[conversationId]/page.tsx
│   │   ├── (main)/vault/page.tsx
│   │   ├── (main)/consent/page.tsx
│   │   ├── (main)/audit/page.tsx
│   │   ├── (main)/profile/page.tsx
│   │   ├── (main)/notifications/page.tsx
│   │   ├── (main)/calendar/page.tsx
│   │   ├── onboarding/page.tsx
│   │   ├── admin/escalations/page.tsx
│   │   └── api/ (auth, chat, vault, consent, audit, profile, notifications, calendar, contacts, escalation)
│   ├── components/ (chat, vault, consent, onboarding, notifications, layout, shared)
│   ├── lib/ (auth, prisma, crypto, audit, llm, personas, consent, vault, vault-schema, vault-serializer, notifications, adapters/)
│   ├── hooks/ (useChat, useVoice, useTheme, useNotifications)
│   └── types/ (index, vault, persona, adapter)
├── docker-compose.yml
├── .env.example
├── next.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## Tasks

- [x] 1. Project scaffolding and configuration
  - [x] 1.1 Initialize Next.js 14+ project with TypeScript, Tailwind CSS, and shadcn/ui
    - Run `npx create-next-app@latest hushh-personal-agent` with flags: `--typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
    - Install runtime dependencies: `npm install prisma @prisma/client next-auth @auth/prisma-adapter langchain @langchain/ollama @langchain/openai bcryptjs zod uuid next-themes @simplewebauthn/server @simplewebauthn/browser otpauth qrcode`
    - Install type definitions: `npm install -D @types/bcryptjs @types/uuid @types/qrcode`
    - Initialize shadcn/ui: `npx shadcn-ui@latest init` — select "New York" style, slate base color, CSS variables enabled
    - Add shadcn components: `npx shadcn-ui@latest add button input card dialog dropdown-menu avatar badge toggle switch tabs separator skeleton toast sheet scroll-area`
    - Create `.env.example` with all env vars listed in the Overview section above
    - Create `docker-compose.yml` with a PostgreSQL 16 service: port 5432, user `postgres`, password `postgres`, database `hushh`, volume `pgdata:/var/lib/postgresql/data`
    - Create `next.config.js` with: `output: 'standalone'`, headers for service worker scope, and PWA-related config
    - _Requirements: 15.1, 16.1, 17.4, 18.1_

  - [x] 1.2 Set up Prisma schema and database migrations
    - Run `npx prisma init` to create `prisma/` directory
    - Create `prisma/schema.prisma` with PostgreSQL datasource using `env("DATABASE_URL")` and all 14 models from the design document:
      - **User**: id (cuid), email (unique), name?, passwordHash?, avatar?, timezone (default "UTC"), preferredLanguage (default "en"), onboardingDone (default false), twoFactorEnabled (default false), twoFactorSecret?, failedTotpAttempts (default 0), totpLockedUntil?, createdAt, updatedAt. Relations: accounts[], sessions[], webauthnCreds[], conversations[], vaultEntries[], consentToggles[], auditEntries[], notifications[], escalations[], profile?
      - **Account**: id, userId, type, provider, providerAccountId, refresh_token?, access_token?, expires_at?, token_type?, scope?, id_token?. Unique on [provider, providerAccountId]
      - **Session**: id, sessionToken (unique), userId, expires
      - **WebAuthnCredential**: id, userId, credentialId (unique), publicKey, counter (default 0), transports (String[]), createdAt
      - **Conversation**: id, userId, personaId, title, createdAt, updatedAt. Index on [userId, personaId]. Has messages[]
      - **Message**: id, conversationId, role ("user"|"assistant"), content, createdAt. Index on [conversationId]
      - **VaultEntry**: id, userId, entryType (string), encryptedData (string — format: `{iv}:{authTag}:{ciphertext}` all base64), createdAt, updatedAt. Index on [userId, entryType]
      - **ConsentToggle**: id, userId, dataFieldId (string), enabled (default false), personaScope (default "both"), updatedAt. Unique on [userId, dataFieldId, personaScope]
      - **AuditEntry**: id, userId, actionType, resource, resourceId?, personaId?, metadata (Json?), hash (string — SHA-256), previousHash (string — previous hash or "GENESIS"), createdAt. Indexes on [userId, actionType] and [userId, createdAt]
      - **Notification**: id, userId, type, title, body, read (default false), linkedResource?, createdAt. Index on [userId, read]
      - **NotificationPreference**: id, userId, notificationType, enabled (default true), pushEnabled (default false). Unique on [userId, notificationType]
      - **Escalation**: id, userId, personaId, originalQuery, preliminaryResponse?, escalationReason, status (default "pending"), resolution?, resolvedBy?, createdAt, updatedAt. Index on [status]
      - **UserProfile**: id, userId (unique), riskTolerance?, investmentGoals?, incomeRange?, wellnessInterests (String[]), dietaryPreferences (String[]), favoriteCategories (String[])
    - All models use `@@map("snake_case_table_names")` and `onDelete: Cascade` for user relations
    - Run `npx prisma migrate dev --name init` to generate migration
    - Create `src/lib/prisma.ts`: export a singleton PrismaClient using the global pattern to avoid multiple instances in dev:
      ```typescript
      import { PrismaClient } from '@prisma/client';
      const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
      export const prisma = globalForPrisma.prisma || new PrismaClient();
      if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
      ```
    - _Requirements: 1.1–1.8, 8.1, 13.1_

  - [x] 1.3 Define shared TypeScript types
    - Create `src/types/index.ts` with:
      ```typescript
      export interface PaginationParams { page: number; pageSize: number; }
      export interface PaginatedResult<T> { data: T[]; total: number; page: number; pageSize: number; totalPages: number; }
      export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string };
      ```
    - Create `src/types/vault.ts` with:
      ```typescript
      export type VaultEntryType = 'financial_record' | 'contact' | 'calendar_event' | 'preference' | 'booking' | 'escalation';
      export interface FinancialRecord { type: 'financial_record'; subtype: 'transaction' | 'holding' | 'budget'; data: { description: string; amount: number; currency: string; category: string; date: string; account: string; metadata?: Record<string, unknown>; }; }
      export interface Contact { type: 'contact'; data: { name: string; email?: string; phone?: string; relationshipType: 'personal' | 'professional' | 'family'; importantDates: { label: string; date: string }[]; notes?: string; tags: string[]; communicationHistory: { date: string; summary: string }[]; }; }
      export interface CalendarEvent { type: 'calendar_event'; data: { title: string; description?: string; startTime: string; endTime: string; location?: string; recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'; }; }
      export interface Preference { type: 'preference'; data: { category: 'financial' | 'lifestyle' | 'notification'; key: string; value: unknown; }; }
      export interface Booking { type: 'booking'; data: { serviceType: 'restaurant' | 'appointment' | 'service'; venue: string; date: string; time: string; preferences?: string; status: 'pending' | 'confirmed' | 'cancelled'; }; }
      export type VaultEntryData = FinancialRecord | Contact | CalendarEvent | Preference | Booking;
      ```
    - Create `src/types/persona.ts` with:
      ```typescript
      export interface PersonaConfig { id: string; name: string; avatar: string; systemPrompt: string; behavioralRules: string[]; allowedDataScopes: VaultEntryType[]; description: string; }
      export type PersonaScope = 'kai' | 'nav' | 'both';
      ```
    - Create `src/types/adapter.ts` with:
      ```typescript
      export interface AdapterConfig { id: string; name: string; enabled: boolean; credentials?: Record<string, string>; }
      export interface AdapterResult<T> { success: boolean; data?: T; error?: { code: string; message: string }; }
      export interface DataAdapter { readonly id: string; readonly name: string; initialize(config: AdapterConfig): Promise<void>; authenticate(): Promise<AdapterResult<void>>; fetchData<T>(query: DataQuery): Promise<AdapterResult<T[]>>; transformData<TInput, TOutput>(raw: TInput): AdapterResult<TOutput>; healthCheck(): Promise<AdapterResult<{ status: 'ok' | 'degraded' | 'down' }>>; }
      export interface DataQuery { entityType: VaultEntryType; filters?: Record<string, unknown>; limit?: number; offset?: number; }
      ```
    - _Requirements: 5.2, 8.2, 9.1, 22.1_

- [x] 2. Cryptography and vault serialization core
  - [x] 2.1 Implement AES-256-GCM encryption service
    - Create `src/lib/crypto.ts` using Node.js built-in `crypto` module (no external deps)
    - Import: `import crypto from 'crypto';`
    - Implement three exported functions:
      - `deriveUserKey(masterKey: Buffer, userId: string): Buffer` — uses `crypto.hkdfSync('sha256', masterKey, userId, 'hushh-vault-key', 32)` to derive a 32-byte per-user key from the VAULT_MASTER_KEY env var + userId
      - `encrypt(plaintext: string, userKey: Buffer): string` — generates 12-byte random IV via `crypto.randomBytes(12)`, creates cipher with `crypto.createCipheriv('aes-256-gcm', userKey, iv)`, encrypts plaintext, gets authTag via `cipher.getAuthTag()`, returns `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`
      - `decrypt(encrypted: string, userKey: Buffer): string` — splits on ':', base64-decodes iv/authTag/ciphertext, creates decipher with `crypto.createDecipheriv('aes-256-gcm', userKey, iv)`, calls `decipher.setAuthTag(authTag)`, decrypts and returns plaintext string. Throws descriptive error on tampered data (GCM auth tag verification failure)
    - Also export a helper `getMasterKey(): Buffer` that reads `process.env.VAULT_MASTER_KEY` and converts from hex to Buffer, throwing if not set
    - _Requirements: 8.1, 8.3_

  - [x] 2.2 Implement vault JSON schemas and validation with Zod
    - Create `src/lib/vault-schema.ts`
    - Import: `import { z } from 'zod';` and vault types from `@/types/vault`
    - Define Zod schemas for each VaultEntry type matching the JSON structures in the design document:
      - `financialRecordSchema`: validates type='financial_record', subtype enum, data object with description (string), amount (number), currency (string), category (string), date (ISO8601 string via z.string().datetime()), account (string), optional metadata
      - `contactSchema`: validates type='contact', data with name, optional email (z.string().email()), optional phone, relationshipType enum, importantDates array of {label, date}, optional notes, tags string array, communicationHistory array of {date, summary}
      - `calendarEventSchema`: validates type='calendar_event', data with title, optional description, startTime/endTime (datetime strings), optional location, recurrence enum
      - `preferenceSchema`: validates type='preference', data with category enum, key string, value z.unknown()
      - `bookingSchema`: validates type='booking', data with serviceType enum, venue, date, time, optional preferences, status enum
    - Export `vaultEntrySchema` as `z.discriminatedUnion('type', [...])` combining all five schemas
    - Export `validateVaultEntry(data: unknown): { valid: boolean; data?: VaultEntryData; errors?: { field: string; message: string }[] }` — uses `vaultEntrySchema.safeParse(data)`, maps Zod errors to `{ field: issue.path.join('.'), message: issue.message }` format
    - _Requirements: 8.2, 9.1, 9.5_

  - [x] 2.3 Implement vault serializer (parse, serialize, pretty-print)
    - Create `src/lib/vault-serializer.ts`
    - Import: `validateVaultEntry` from `./vault-schema`, types from `@/types/vault`
    - Implement the `VaultSerializer` interface from the design document:
      - `parse(json: string): VaultEntryData` — calls `JSON.parse(json)`, then `validateVaultEntry(parsed)`. If invalid, throws error with field-level details. Returns typed VaultEntryData
      - `serialize(entry: VaultEntryData): string` — produces deterministic JSON via `JSON.stringify(entry)` with sorted keys (use a recursive key-sorting helper to ensure determinism)
      - `prettyPrint(entry: VaultEntryData): string` — produces `JSON.stringify(entry, null, 2)` indented human-readable JSON
      - `validate(json: string, entryType: VaultEntryType): ValidationResult` — parses JSON and validates against the specific schema for that entry type
    - Export type `ValidationResult = { valid: boolean; errors?: { field: string; message: string }[] }`
    - The round-trip property must hold: `parse(serialize(entry))` then `serialize()` again yields identical JSON string
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 3. Consent management service
  - [x] 3.1 Implement consent service
    - Create `src/lib/consent.ts`
    - Import: `prisma` from `./prisma`, types from `@/types/persona` (PersonaScope), `@/types/index` (PaginationParams)
    - Uses Prisma model: **ConsentToggle** (fields: userId, dataFieldId, enabled, personaScope, updatedAt)
    - Implement the `ConsentService` interface from the design document with these functions:
      - `getToggles(userId: string): Promise<ConsentToggle[]>` — queries `prisma.consentToggle.findMany({ where: { userId } })`, returns all toggles for the user
      - `setToggle(userId: string, fieldId: string, enabled: boolean, personaScope: PersonaScope): Promise<void>` — uses `prisma.consentToggle.upsert()` with unique constraint on [userId, dataFieldId, personaScope]. After upsert, calls `auditService.log()` with actionType `consent_grant` or `consent_revoke`, resource = fieldId, personaId = personaScope
      - `checkAccess(userId: string, fieldId: string, personaId: string): Promise<boolean>` — queries toggle for [userId, fieldId] where personaScope is either the specific personaId or 'both'. Returns `toggle?.enabled ?? false` (defaults to false = denied if no toggle exists, satisfying Req 7.7)
      - `getPermittedFields(userId: string, personaId: string): Promise<string[]>` — queries all enabled toggles where personaScope matches personaId or 'both', returns array of dataFieldId strings
      - `getHistory(userId: string, pagination: PaginationParams): Promise<ConsentHistoryEntry[]>` — queries AuditEntry where actionType IN ['consent_grant', 'consent_revoke'] for the user, with pagination (skip/take), ordered by createdAt desc. Returns array of `{ timestamp, fieldId, action, personaScope }`
    - Default behavior: new users have NO ConsentToggle rows → `checkAccess` returns false → all data access denied until explicit opt-in
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 4. Audit trail service with SHA-256 hash chain
  - [x] 4.1 Implement audit service with hash chain
    - Create `src/lib/audit.ts`
    - Import: `crypto` from 'crypto', `prisma` from `./prisma`, types from `@/types/index`
    - Uses Prisma model: **AuditEntry** (fields: userId, actionType, resource, resourceId?, personaId?, metadata?, hash, previousHash, createdAt)
    - Define `AuditActionType` union: `'data_read' | 'data_write' | 'data_delete' | 'consent_grant' | 'consent_revoke' | 'auth_login' | 'auth_logout' | 'auth_failed' | 'escalation_created' | 'escalation_resolved' | 'notification_sent'`
    - Implement the `AuditService` interface:
      - `log(entry: CreateAuditEntry): Promise<AuditEntry>` — Steps: (1) Find the most recent AuditEntry for this userId ordered by createdAt desc. (2) Get previousHash = lastEntry?.hash ?? "GENESIS". (3) Compute hash = `crypto.createHash('sha256').update(JSON.stringify({ previousHash, timestamp: new Date().toISOString(), userId: entry.userId, actionType: entry.actionType, resource: entry.resource, resourceId: entry.resourceId })).digest('hex')`. (4) Create entry via `prisma.auditEntry.create({ data: { ...entry, hash, previousHash } })`
      - `getEntries(userId: string, filters: AuditFilters, pagination: PaginationParams): Promise<PaginatedResult<AuditEntry>>` — Build Prisma `where` clause from filters: actionType (optional string match), dateFrom/dateTo (createdAt gte/lte), personaId (optional match). Use `prisma.auditEntry.findMany()` with skip/take from pagination, orderBy createdAt desc. Also get total count for pagination metadata
      - `verifyChain(userId: string): Promise<{ valid: boolean; brokenAt?: string }>` — Fetch ALL audit entries for user ordered by createdAt asc. Walk the chain: for each entry, recompute the expected hash from { previousHash, timestamp, userId, actionType, resource, resourceId } and compare to stored hash. If mismatch, return `{ valid: false, brokenAt: entry.id }`. If all match, return `{ valid: true }`
    - Define `AuditFilters` type: `{ actionType?: string; dateFrom?: Date; dateTo?: Date; personaId?: string }`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 5. Checkpoint — Core services
  - Verify crypto encrypt/decrypt works by running a quick manual test in a script. Verify Prisma migrations applied successfully. Ensure consent and audit services compile without errors. Ask the user if questions arise.

- [x] 6. Vault service with encryption and consent gating
  - [x] 6.1 Implement vault CRUD service
    - Create `src/lib/vault.ts`
    - Import: `prisma` from `./prisma`, `{ deriveUserKey, encrypt, decrypt, getMasterKey }` from `./crypto`, `{ validateVaultEntry }` from `./vault-schema`, consent service from `./consent`, audit service from `./audit`, types from `@/types/vault`
    - Uses Prisma model: **VaultEntry** (fields: userId, entryType, encryptedData, createdAt, updatedAt)
    - Implement the `VaultService` interface from the design document:
      - `create(userId: string, entry: CreateVaultEntryInput): Promise<VaultEntry>` — Steps: (1) Validate entry data via `validateVaultEntry(entry)`, throw if invalid with field errors. (2) Derive user key: `deriveUserKey(getMasterKey(), userId)`. (3) Serialize entry data to JSON string. (4) Encrypt: `encrypt(jsonString, userKey)`. (5) Store via `prisma.vaultEntry.create({ data: { userId, entryType: entry.type, encryptedData } })`. (6) Log to audit: actionType='data_write', resource=entry.type, resourceId=newEntry.id
      - `read(userId: string, entryId: string, personaId?: string): Promise<VaultEntry>` — Steps: (1) Fetch entry via `prisma.vaultEntry.findUnique({ where: { id: entryId } })`. (2) Verify entry.userId === userId. (3) If personaId provided, call `consentService.checkAccess(userId, entry.entryType, personaId)`. If denied: log audit with actionType='data_read' + metadata `{ denied: true }`, throw AccessDeniedError. (4) Derive user key, decrypt encryptedData. (5) Parse decrypted JSON. (6) Log audit: actionType='data_read', resource=entry.entryType, resourceId=entryId. (7) Return entry with decrypted data
      - `update(userId: string, entryId: string, data: UpdateVaultEntryInput): Promise<VaultEntry>` — Steps: (1) Fetch existing entry, verify ownership. (2) Validate new data. (3) Re-encrypt with user key. (4) Update via `prisma.vaultEntry.update()`. (5) Log audit: actionType='data_write'
      - `delete(userId: string, entryId: string): Promise<void>` — Steps: (1) Verify ownership. (2) Delete via `prisma.vaultEntry.delete({ where: { id: entryId } })`. (3) Log audit: actionType='data_delete'
      - `query(userId: string, query: VaultQuery, personaId?: string): Promise<VaultEntry[]>` — Steps: (1) If personaId, get permitted fields via `consentService.getPermittedFields(userId, personaId)`. (2) Query `prisma.vaultEntry.findMany({ where: { userId, entryType: { in: permittedTypes } } })`. (3) Decrypt each entry. (4) Log audit for each read
    - Define `CreateVaultEntryInput`, `UpdateVaultEntryInput`, `VaultQuery` types locally
    - _Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 7. Authentication system
  - [x] 7.1 Configure NextAuth.js with OAuth and credentials providers
    - Create `src/lib/auth.ts`
    - Import: `NextAuthOptions` from 'next-auth', `PrismaAdapter` from '@auth/prisma-adapter', `GoogleProvider` from 'next-auth/providers/google', `GitHubProvider` from 'next-auth/providers/github', `CredentialsProvider` from 'next-auth/providers/credentials', `bcrypt` from 'bcryptjs', `prisma` from './prisma'
    - Configure `authOptions: NextAuthOptions`:
      - `adapter`: PrismaAdapter(prisma)
      - `session`: `{ strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }` (30 days, configurable)
      - `providers`: [GoogleProvider({ clientId, clientSecret from env }), GitHubProvider({ clientId, clientSecret from env }), CredentialsProvider({ name: 'credentials', credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Password', type: 'password' } }, authorize: async (credentials) => { find user by email, verify password with bcrypt.compare(), return user or null } })]
      - `callbacks`: { jwt: include userId in token, session: include userId in session }
      - `pages`: { signIn: '/login', newUser: '/onboarding' }
    - Create `src/app/api/auth/[...nextauth]/route.ts`:
      ```typescript
      import NextAuth from 'next-auth';
      import { authOptions } from '@/lib/auth';
      const handler = NextAuth(authOptions);
      export { handler as GET, handler as POST };
      ```
    - Create helper `getServerSession()` wrapper for use in API routes: `import { getServerSession } from 'next-auth'; import { authOptions } from '@/lib/auth';`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 7.2 Implement WebAuthn registration and authentication
    - Install already done in 1.1 (`@simplewebauthn/server`, `@simplewebauthn/browser`)
    - Create `src/app/api/auth/webauthn/register/route.ts` (POST):
      - Import: `generateRegistrationOptions`, `verifyRegistrationResponse` from `@simplewebauthn/server`
      - Get authenticated user from session
      - Generate registration options with rpName='Hushh Agent', rpID from env/hostname, userID=user.id, userName=user.email
      - Store challenge in session/cookie for verification
      - On verification POST: verify response, store credential in **WebAuthnCredential** Prisma model (credentialId, publicKey, counter, transports)
    - Create `src/app/api/auth/webauthn/authenticate/route.ts` (POST):
      - Import: `generateAuthenticationOptions`, `verifyAuthenticationResponse` from `@simplewebauthn/server`
      - Fetch user's WebAuthnCredential records, generate auth options
      - On verification: verify assertion, update counter, establish session
    - Uses Prisma model: **WebAuthnCredential** (credentialId unique, publicKey, counter, transports[])
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 7.3 Implement TOTP two-factor authentication
    - Create `src/app/api/auth/totp/setup/route.ts` (POST):
      - Import: `OTPAuth` from 'otpauth', `QRCode` from 'qrcode'
      - Generate TOTP secret: `new OTPAuth.TOTP({ issuer: 'Hushh Agent', label: user.email, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromRandom() })`
      - Store secret in User.twoFactorSecret (encrypted or plain — it's server-side only)
      - Return QR code as data URL via `QRCode.toDataURL(totp.toString())`
    - Create `src/app/api/auth/totp/verify/route.ts` (POST):
      - Accept `{ code: string }` body
      - Load user's twoFactorSecret, create TOTP instance, call `totp.validate({ token: code, window: 1 })`
      - If valid: set `twoFactorEnabled = true`, reset failedTotpAttempts to 0
      - If invalid: increment `failedTotpAttempts`. If >= 3: set `totpLockedUntil = new Date(Date.now() + 15 * 60 * 1000)`, log to audit with actionType='auth_failed'
      - Check `totpLockedUntil` before allowing verification — if locked, return 423 with lockout message
    - Uses Prisma model: **User** (twoFactorEnabled, twoFactorSecret, failedTotpAttempts, totpLockedUntil)
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 7.4 Create login and registration pages
    - Create `src/app/(auth)/login/page.tsx`:
      - Import: `signIn` from 'next-auth/react', shadcn Button, Input, Card components
      - Layout: Card centered on page with app logo at top
      - Sections: (1) OAuth buttons — "Sign in with Google" and "Sign in with GitHub" calling `signIn('google')` / `signIn('github')`. (2) Divider with "or". (3) Email/password form with email Input, password Input, submit Button. On submit: call `signIn('credentials', { email, password, redirect: false })`, handle errors. (4) WebAuthn button (conditionally shown if user has registered credential). (5) Link to /register for new users
      - Error display: show generic "Invalid credentials" message (never reveal which field was wrong per Req 1.6)
      - Use `useSearchParams()` to read error query param from NextAuth redirects
    - Create `src/app/(auth)/register/page.tsx`:
      - Form with: name Input, email Input, password Input (with strength indicator), confirm password Input
      - On submit: POST to a custom `/api/auth/register` route that creates user with `bcrypt.hash(password, 12)`, then auto-signs in
      - Create `src/app/api/auth/register/route.ts`: validate with Zod, check email uniqueness, hash password, create User via Prisma, return success
    - Both pages use `'use client'` directive and shadcn/ui components
    - _Requirements: 1.1, 1.4, 1.6_

- [x] 8. Persona system and LLM integration
  - [x] 8.1 Define Kai and Nav persona configurations
    - Create `src/lib/personas.ts`
    - Import: `PersonaConfig` from `@/types/persona`, `VaultEntryType` from `@/types/vault`
    - Export `PERSONAS: Record<string, PersonaConfig>` with two entries:
      - **Kai** (`id: 'kai'`): name="Kai", avatar="/icons/kai-avatar.png", description="Your personal financial advisor and investment strategist"
        - `systemPrompt`: A detailed prompt establishing Kai as a financial advisor persona — includes instructions to: analyze spending patterns, provide portfolio insights, give investment recommendations with disclaimers ("this is informational only, not financial advice"), reference user's risk tolerance and investment goals from their profile, always check consent before accessing financial data, be proactive about financial insights
        - `behavioralRules`: ["Always include disclaimers on investment advice", "Reference specific data from the user's vault when available", "Suggest consulting a licensed advisor for major decisions", "Never fabricate financial figures", "Be proactive about spending anomalies and savings opportunities"]
        - `allowedDataScopes`: ['financial_record', 'preference'] as VaultEntryType[]
      - **Nav** (`id: 'nav'`): name="Nav", avatar="/icons/nav-avatar.png", description="Your lifestyle concierge and brand advisor"
        - `systemPrompt`: A detailed prompt establishing Nav as a lifestyle/wellness/brand concierge — includes instructions to: help with booking requests (restaurants, spas, appointments), provide wellness recommendations, manage contacts and relationships, remind about important dates, help with brand/creator advisory, reference user's lifestyle preferences
        - `behavioralRules`: ["Present booking options with clear details before confirming", "Personalize recommendations based on user preferences", "Proactively remind about upcoming contact dates", "Suggest calendar events for confirmed bookings", "Be warm and lifestyle-oriented in tone"]
        - `allowedDataScopes`: ['contact', 'calendar_event', 'preference', 'booking'] as VaultEntryType[]
    - Export helper `getPersona(personaId: string): PersonaConfig | undefined` — returns `PERSONAS[personaId]`
    - Export helper `getPersonaIds(): string[]` — returns `Object.keys(PERSONAS)`
    - _Requirements: 5.1, 5.2, 5.5, 5.6_

  - [x] 8.2 Implement LLM service with LangChain.js
    - Create `src/lib/llm.ts`
    - Import: `ChatOllama` from `@langchain/ollama`, `ChatOpenAI` from `@langchain/openai`, `HumanMessage, SystemMessage, AIMessage` from `@langchain/core/messages`
    - Read env vars: `LLM_PROVIDER` ('ollama' | 'openai-compatible'), `LLM_BASE_URL`, `LLM_MODEL`, `LLM_MAX_TOKENS`
    - Create LLM client based on provider:
      ```typescript
      const llm = process.env.LLM_PROVIDER === 'ollama'
        ? new ChatOllama({ baseUrl: process.env.LLM_BASE_URL, model: process.env.LLM_MODEL })
        : new ChatOpenAI({ configuration: { baseURL: process.env.LLM_BASE_URL }, modelName: process.env.LLM_MODEL });
      ```
    - Implement `LLMService` interface from design document:
      - `async *stream(params: LLMStreamParams): AsyncGenerator<string>` — Build messages array: [SystemMessage(systemPrompt), ...history mapped to HumanMessage/AIMessage, HumanMessage(contextData + userMessage)]. Call `llm.stream(messages)`. Yield each chunk's content as string. Wrap in try/catch — if connection fails, yield error message "AI service is currently unavailable"
      - `estimateTokens(text: string): number` — Simple approximation: `Math.ceil(text.length / 4)` (rough 4-chars-per-token estimate, good enough for context management)
      - `truncateHistory(messages: ChatMessage[], maxTokens: number, systemPrompt: string): ChatMessage[]` — Calculate token budget: maxTokens - estimateTokens(systemPrompt) - 500 (buffer for latest message + context). Walk messages from newest to oldest, accumulating token count. Return the subset that fits within budget. Always preserve the latest user message
      - `sanitizeInput(input: string): string` — Strip prompt injection patterns: remove lines starting with "You are now", "Ignore previous", "System:", "SYSTEM:", "###". Escape sequences like `\n\n---\n\n` that could break prompt structure. Log sanitization events if content was modified (call audit.log with actionType='data_write', resource='input_sanitization')
    - Define `ChatMessage` type: `{ role: 'user' | 'assistant'; content: string }`
    - Define `LLMStreamParams` type: `{ systemPrompt: string; history: ChatMessage[]; contextData: string; userMessage: string; maxTokens?: number }`
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 9. Chat API and agent service
  - [x] 9.1 Implement agent service (orchestrates persona, consent, vault, LLM)
    - Create `src/lib/agent.ts`
    - Import: `getPersona` from `./personas`, consent service from `./consent`, vault service from `./vault`, llm service from `./llm`, audit service from `./audit`, `prisma` from `./prisma`
    - Implement `processMessage(params: { userId: string; message: string; conversationId?: string; personaId: string }): AsyncGenerator<string>`:
      - Step 1: Get persona config via `getPersona(personaId)`. If not found, throw error
      - Step 2: Get permitted data scopes via `consentService.getPermittedFields(userId, personaId)`
      - Step 3: Sanitize user input via `llmService.sanitizeInput(message)`
      - Step 4: Query relevant vault data — call `vaultService.query(userId, { entityType: scope }, personaId)` for each permitted scope. Format results as context string
      - Step 5: Get user profile preferences (if consent granted) — query UserProfile via Prisma, include relevant prefs in context (risk tolerance for Kai, wellness interests for Nav)
      - Step 6: Load conversation history — fetch last 20 messages from Conversation via Prisma, map to ChatMessage[]
      - Step 7: Truncate history to fit context window via `llmService.truncateHistory()`
      - Step 8: Build context string combining vault data + user preferences
      - Step 9: Stream LLM response via `llmService.stream({ systemPrompt: persona.systemPrompt, history, contextData, userMessage: sanitizedMessage })`
      - Step 10: Log data access to audit trail
      - Step 11: Check for escalation triggers — if message contains keywords like "delete my account", "transfer funds", "legal advice", or if persona detects low confidence (can add a simple heuristic), create escalation via escalation service
    - Implement 30-second timeout: wrap the stream in a timeout that yields an error message if no tokens received within 30s
    - _Requirements: 3.2, 3.3, 3.4, 3.8, 5.3, 5.7, 6.1, 6.2, 6.3, 6.5, 10.1, 10.2, 14.1_

  - [x] 9.2 Implement chat API route with SSE streaming
    - Create `src/app/api/chat/route.ts`
    - Import: agent service, `prisma`, `getServerSession` from next-auth, `NextResponse`
    - **POST handler**:
      - Authenticate: `const session = await getServerSession(authOptions)`. If no session, return 401
      - Parse body: `{ message: string, conversationId?: string, personaId: string }`
      - If no conversationId: create new Conversation via `prisma.conversation.create({ data: { userId: session.user.id, personaId, title: message.slice(0, 50) } })`. Use the new conversation's ID
      - Store user message: `prisma.message.create({ data: { conversationId, role: 'user', content: message } })`
      - Create ReadableStream for SSE: `new ReadableStream({ async start(controller) { ... } })`
      - Inside the stream: iterate over `agentService.processMessage()`, for each token: `controller.enqueue(encoder.encode(\`data: ${JSON.stringify({ token })}\n\n\`))`. On complete: store full assistant message via `prisma.message.create()`, send `data: [DONE]`, close controller
      - Return `new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })`
    - _Requirements: 3.2, 3.5, 3.6, 18.3_

  - [x] 9.3 Implement conversation management API routes
    - Create `src/app/api/chat/conversations/route.ts`:
      - **GET**: List user conversations. Query `prisma.conversation.findMany({ where: { userId }, include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } })`. Return array of `{ id, title, personaId, lastMessageAt, messagePreview }`
    - Create `src/app/api/chat/conversations/[id]/route.ts`:
      - **GET**: Get conversation with all messages. Verify ownership (conversation.userId === session.user.id). Return conversation + messages ordered by createdAt asc
      - **DELETE**: Delete conversation and cascade-delete messages. Log to audit: actionType='data_delete', resource='conversation'. Verify ownership first
      - **PATCH**: Rename conversation. Accept `{ title: string }` body. Update via `prisma.conversation.update()`
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.6_

- [x] 10. Vault, consent, audit, and profile API routes
  - [x] 10.1 Implement vault API routes
    - Create `src/app/api/vault/route.ts`:
      - **GET**: List vault entries. Call `vaultService.query(userId, { entryType: req.searchParams.get('type') })`. Return decrypted entries
      - **POST**: Create vault entry. Parse body, call `vaultService.create(userId, body)`. Return created entry
    - Create `src/app/api/vault/[entryId]/route.ts`:
      - **GET**: Get single entry. Call `vaultService.read(userId, entryId)`. Handle AccessDeniedError → 403
      - **PUT**: Update entry. Call `vaultService.update(userId, entryId, body)`
      - **DELETE**: Delete entry. Call `vaultService.delete(userId, entryId)`
    - All routes: authenticate via `getServerSession()`, return 401 if no session
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 10.2 Implement consent API routes
    - Create `src/app/api/consent/route.ts`:
      - **GET**: Return `consentService.getToggles(userId)`
      - **PUT**: Accept `{ fieldId: string, enabled: boolean, personaScope: PersonaScope }`. Call `consentService.setToggle(userId, fieldId, enabled, personaScope)`
    - Create `src/app/api/consent/history/route.ts`:
      - **GET**: Accept `page` and `pageSize` query params. Return `consentService.getHistory(userId, { page, pageSize })`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_

  - [x] 10.3 Implement audit API route
    - Create `src/app/api/audit/route.ts`:
      - **GET**: Accept query params: `actionType?`, `dateFrom?`, `dateTo?`, `personaId?`, `page`, `pageSize`
      - Call `auditService.getEntries(userId, filters, pagination)`
      - Also call `auditService.verifyChain(userId)` and include `chainValid` boolean in response
      - Return paginated audit entries with chain verification status
    - _Requirements: 13.3, 13.4, 13.5_

  - [x] 10.4 Implement profile API routes
    - Create `src/app/api/profile/route.ts`:
      - **GET**: Fetch User + UserProfile via `prisma.user.findUnique({ where: { id: userId }, include: { profile: true } })`. Return combined profile data (name, email, avatar, timezone, preferredLanguage, riskTolerance, investmentGoals, incomeRange, wellnessInterests, dietaryPreferences, favoriteCategories)
      - **PUT**: Accept partial update body. Update User fields (name, avatar, timezone, preferredLanguage) via `prisma.user.update()`. Update/create UserProfile fields via `prisma.userProfile.upsert()`. Log changes to audit: actionType='data_write', resource='user_profile'. Store preference changes as VaultEntry if consent is granted for the relevant category
    - Uses Prisma models: **User**, **UserProfile**
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.6_

  - [x] 10.5 Implement calendar API routes
    - Create `src/app/api/calendar/route.ts`:
      - **GET**: Query vault entries where entryType='calendar_event', consent-gated via vaultService.query(). Return decrypted calendar events sorted by startTime
      - **POST**: Accept calendar event data, validate against calendarEventSchema, create via vaultService.create() with entryType='calendar_event'
    - Create `src/app/api/calendar/[id]/route.ts`:
      - **PUT**: Update calendar event vault entry
      - **DELETE**: Delete calendar event vault entry
    - All calendar data is stored as encrypted VaultEntry records with entryType='calendar_event'
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.6 Implement contacts API routes
    - Create `src/app/api/contacts/route.ts`:
      - **GET**: Query vault entries where entryType='contact', consent-gated. Return decrypted contacts
      - **POST**: Accept contact data, validate against contactSchema, create via vaultService.create()
    - Create `src/app/api/contacts/[id]/route.ts`:
      - **PUT**: Update contact vault entry
      - **DELETE**: Delete contact vault entry
    - Create `src/app/api/contacts/search/route.ts`:
      - **GET**: Accept `q` query param. Fetch all contacts (consent-gated), decrypt, then filter in-memory by name/relationshipType/tags matching the search query. Return matching contacts
    - All contact data stored as encrypted VaultEntry records with entryType='contact'
    - _Requirements: 11.1, 11.2, 11.4, 11.5_

  - [x] 10.7 Implement escalation API routes
    - Create `src/app/api/escalation/route.ts`:
      - **POST** (User): Accept `{ originalQuery, preliminaryResponse?, escalationReason, personaId }`. Create via `prisma.escalation.create()`. Log to audit: actionType='escalation_created'. Return escalation with status='pending'
      - **GET** (Admin): Check if user has admin role (add `role` field to User model or check against env-configured admin emails). Return `prisma.escalation.findMany()` with filtering by status, date, personaId
    - Create `src/app/api/escalation/[id]/route.ts`:
      - **PATCH** (Admin): Accept `{ resolution: string }`. Update escalation: status='resolved', resolution, resolvedBy=adminUserId. Log to audit: actionType='escalation_resolved'
    - Uses Prisma model: **Escalation**
    - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 11. Notification system
  - [x] 11.1 Implement notification service
    - Create `src/lib/notifications.ts`
    - Import: `prisma` from `./prisma`, consent service from `./consent`, audit service from `./audit`
    - Uses Prisma models: **Notification**, **NotificationPreference**
    - Define `NotificationType`: `'financial_alert' | 'contact_reminder' | 'calendar_reminder' | 'system_notification'`
    - Map notification types to data categories for consent checking: `{ financial_alert: 'financial_records', contact_reminder: 'contacts', calendar_reminder: 'calendar', system_notification: null }` (system notifications bypass consent)
    - Implement `NotificationService` interface:
      - `create(params: { userId, type, title, body, linkedResource? }): Promise<Notification>` — Check consent: look up the data category for this notification type. If consent is disabled for that category, suppress (don't create). If enabled or system type, create via `prisma.notification.create()`. Log to audit: actionType='notification_sent'
      - `getAll(userId, filters?: { read?: boolean }): Promise<Notification[]>` — Query with optional read/unread filter, ordered by createdAt desc
      - `markAsRead(userId, notificationId): Promise<void>` — Update `prisma.notification.update({ where: { id: notificationId }, data: { read: true } })`. Verify ownership
      - `getUnreadCount(userId): Promise<number>` — `prisma.notification.count({ where: { userId, read: false } })`
      - `checkAndGenerateAlerts(userId): Promise<void>` — Scan vault for: (1) Contact important dates within 7 days → create 'contact_reminder' notifications. (2) Calendar events within 24 hours → create 'calendar_reminder' notifications. (3) Financial anomalies (placeholder logic for MVP) → create 'financial_alert' notifications. All subject to consent checks
    - _Requirements: 23.1, 23.2, 23.3, 23.6, 23.7_

  - [x] 11.2 Implement notification API routes
    - Create `src/app/api/notifications/route.ts`:
      - **GET**: Accept `read` query param (optional boolean filter). Return `notificationService.getAll(userId, filters)`
    - Create `src/app/api/notifications/[id]/route.ts`:
      - **PATCH**: Mark as read. Call `notificationService.markAsRead(userId, id)`
    - Create `src/app/api/notifications/preferences/route.ts`:
      - **GET**: Return `prisma.notificationPreference.findMany({ where: { userId } })`
      - **PUT**: Accept `{ notificationType, enabled, pushEnabled }`. Upsert via `prisma.notificationPreference.upsert()`
    - _Requirements: 23.1, 23.4_

- [x] 12. Checkpoint — All API routes and services complete
  - Verify all API routes compile. Test a few endpoints manually with curl or Postman. Ensure Prisma client is generated and migrations are applied. Ask the user if questions arise.

- [x] 13. UI foundation and layout
  - [x] 13.1 Set up root layout with theme provider and session
    - Create `src/app/layout.tsx`:
      - Import: `SessionProvider` from 'next-auth/react', `ThemeProvider` from 'next-themes', global CSS
      - Wrap children in `<SessionProvider>` then `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
      - Include `<html lang="en" suppressHydrationWarning>` for next-themes compatibility
      - Add metadata: title="Hushh Personal Agent", description, viewport, themeColor
      - Link to `/manifest.json` for PWA
    - Create `src/hooks/useTheme.ts`:
      - Re-export `useTheme` from 'next-themes' with typed wrapper
      - Add helper to persist preference (next-themes handles localStorage automatically)
    - Create `src/components/layout/ThemeToggle.tsx`:
      - Import: `useTheme` hook, shadcn Button, Sun/Moon icons (from lucide-react)
      - Render button that toggles between 'light' and 'dark' themes
      - Use `resolvedTheme` to show correct icon
    - _Requirements: 16.1, 16.2, 16.3_

  - [x] 13.2 Create authenticated layout with sidebar and header
    - Create `src/app/(main)/layout.tsx`:
      - Import: `getServerSession` from next-auth, `redirect` from 'next/navigation'
      - Check session server-side: if no session, `redirect('/login')`
      - If user.onboardingDone === false, `redirect('/onboarding')`
      - Render: `<div className="flex h-screen">` with `<AppSidebar />` and `<main>` containing `<AppHeader />` + `{children}`
    - Create `src/components/layout/AppHeader.tsx`:
      - Import: shadcn Avatar, Badge, DropdownMenu, ThemeToggle, NotificationBadge
      - Layout: flex row with: current persona indicator (Kai/Nav avatar + name), spacer, NotificationBadge (links to /notifications), ThemeToggle, user avatar dropdown (Profile, Settings, Logout)
      - Logout: call `signOut()` from next-auth/react
    - Create `src/components/layout/AppSidebar.tsx`:
      - Import: shadcn Sheet (for mobile), navigation links with icons from lucide-react
      - Navigation items: Chat (MessageSquare icon), Vault (Lock icon), Consent (Shield icon), Audit Trail (FileText icon), Profile (User icon), Calendar (Calendar icon), Notifications (Bell icon)
      - Active link highlighting based on `usePathname()`
      - Collapsible on mobile using shadcn Sheet component
      - "New Chat" button at top that navigates to `/chat/new`
    - Create `src/components/shared/SkeletonLoader.tsx`:
      - Import: shadcn Skeleton component
      - Export reusable skeleton variants: `ChatSkeleton`, `ListSkeleton`, `CardSkeleton` — each renders appropriate skeleton shapes matching the expected content layout
    - Create `src/components/shared/ErrorBoundary.tsx`:
      - React error boundary class component wrapping children
      - On error: display friendly error message with "Try Again" button that resets the error state
    - _Requirements: 16.1, 16.4, 16.5, 16.6_

- [x] 14. Chat interface UI
  - [x] 14.1 Implement chat components
    - Create `src/components/chat/ChatWindow.tsx`:
      - Props: `conversationId: string, personaId: string`
      - State: messages array, isStreaming boolean, currentStreamedText string
      - Uses `useChat` hook (see below) for SSE connection management
      - Renders: ScrollArea containing MessageBubble list, auto-scrolls to bottom on new messages
      - At bottom: MessageInput component + VoiceButton
    - Create `src/components/chat/MessageBubble.tsx`:
      - Props: `message: { role, content, createdAt }`, `persona: PersonaConfig`
      - User messages: right-aligned, primary color background
      - Assistant messages: left-aligned, with persona avatar, muted background
      - Render markdown content using a simple markdown renderer (install `react-markdown` and `remark-gfm` — add to task 1.1 deps: `npm install react-markdown remark-gfm`)
      - Support: bold, italic, code blocks with syntax highlighting, tables, lists, links
    - Create `src/components/chat/MessageInput.tsx`:
      - Props: `onSend: (message: string) => void`, `disabled: boolean`
      - Textarea (auto-growing) + Send button (disabled when streaming or empty)
      - Submit on Enter (Shift+Enter for newline), submit on button click
    - Create `src/components/chat/TypingIndicator.tsx`:
      - Three animated dots using CSS keyframe animation (bounce effect)
      - Shown when `isStreaming` is true, positioned as an assistant message bubble
    - Create `src/components/chat/PersonaSelector.tsx`:
      - Props: `currentPersonaId: string`, `onSelect: (personaId: string) => void`
      - Renders Kai and Nav as selectable cards/buttons with avatar, name, and short description
      - Active persona highlighted with ring/border
      - When switching persona mid-conversation: triggers new conversation creation
    - Create `src/hooks/useChat.ts`:
      - Custom hook managing SSE chat connection
      - `sendMessage(message: string)`: POST to `/api/chat` with message, conversationId, personaId. Read SSE stream via `EventSource` or `fetch` with `ReadableStream`. Parse `data: { token }` events, accumulate tokens into streamed response. On `data: [DONE]`, finalize message
      - State: `messages`, `isStreaming`, `error`
      - Handle 30-second timeout: if no tokens received in 30s, set error state with retry option
      - Handle connection errors: display "AI service unavailable" message
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7, 3.8_

  - [x] 14.2 Implement voice input
    - Create `src/components/chat/VoiceButton.tsx`:
      - Props: `onTranscript: (text: string) => void`, `disabled: boolean`
      - Renders microphone icon button (from lucide-react: Mic, MicOff)
      - Uses `useVoice` hook for Web Speech API integration
      - While recording: show pulsing red indicator, change icon to MicOff
      - If Web Speech API not supported: render nothing (hidden, no error per Req 4.5)
    - Create `src/hooks/useVoice.ts`:
      - Check `typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)`
      - If supported: create SpeechRecognition instance, set `continuous: false`, `interimResults: true`, `lang: 'en-US'`
      - `startListening()`: call `recognition.start()`, set isListening=true
      - `stopListening()`: call `recognition.stop()`, set isListening=false
      - `onresult` handler: extract transcript from event.results, update interim text. On `isFinal`, call `onTranscript(finalText)`
      - `onerror` handler: set error state with "Speech not recognized, please try again"
      - Export: `{ isListening, isSupported, transcript, error, startListening, stopListening }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 14.3 Implement conversation sidebar
    - Create `src/components/chat/ConversationSidebar.tsx`:
      - Fetches conversations from `/api/chat/conversations` on mount
      - Renders list of conversations: each shows title (truncated), persona avatar/name badge, relative timestamp ("2h ago")
      - Search input at top: filters conversations client-side by title match, or calls `/api/chat/conversations?search=query` for message-level search
      - Filter buttons: "All", "Kai", "Nav" — filters by personaId
      - Each conversation item has: click to navigate to `/chat/[id]`, context menu (right-click or "..." button) with Rename and Delete options
      - Rename: inline edit with Enter to save (PATCH `/api/chat/conversations/[id]`)
      - Delete: confirmation dialog, then DELETE `/api/chat/conversations/[id]`
      - "New Chat" button at top
    - Create `src/app/(main)/chat/[conversationId]/page.tsx`:
      - Server component that fetches conversation data
      - If conversationId === 'new': render ChatWindow with no conversationId (will create on first message)
      - Otherwise: fetch conversation, render ChatWindow with existing messages
      - Include PersonaSelector at top if starting new conversation
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 15. Vault, consent, and audit UI pages
  - [x] 15.1 Implement vault management page
    - Create `src/app/(main)/vault/page.tsx`:
      - Fetch vault entries from `/api/vault` grouped by entryType
      - Tabs or sections for each type: Financial Records, Contacts, Calendar Events, Preferences, Bookings
      - "Add Entry" button opens VaultEntryForm in a dialog
    - Create `src/components/vault/VaultEntryList.tsx`:
      - Props: `entries: VaultEntry[]`, `onEdit`, `onDelete`
      - Renders entries as cards grouped by type
      - Each card shows: type badge, key fields (e.g. description+amount for financial, name for contact), date
      - Edit button → opens VaultEntryForm pre-filled. Delete button → confirmation dialog then DELETE API call
    - Create `src/components/vault/VaultEntryForm.tsx`:
      - Props: `entryType: VaultEntryType`, `initialData?`, `onSubmit`, `onCancel`
      - Dynamic form fields based on entryType (uses the Zod schemas for validation):
        - financial_record: subtype select, description, amount, currency, category, date, account
        - contact: name, email, phone, relationshipType select, importantDates (dynamic list), notes, tags (comma-separated)
        - calendar_event: title, description, startTime (datetime-local), endTime, location, recurrence select
        - preference: category select, key, value
        - booking: serviceType select, venue, date, time, preferences, status select
      - Client-side validation with Zod before submit
      - Submit calls POST or PUT `/api/vault` endpoints
    - _Requirements: 8.3, 8.6_

  - [x] 15.2 Implement consent management page
    - Create `src/app/(main)/consent/page.tsx`:
      - Two sections: "Consent Toggles" and "Consent History"
      - Fetch toggles from `/api/consent`, history from `/api/consent/history`
    - Create `src/components/consent/ConsentToggle.tsx`:
      - Props: `fieldId: string`, `label: string`, `description: string`, `enabled: boolean`, `personaScope: PersonaScope`, `onChange`
      - Renders: data field name + description, shadcn Switch toggle, persona scope selector (dropdown: "Both", "Kai only", "Nav only")
      - On toggle change: PUT `/api/consent` with new state
      - Data categories to display: "Financial Records" (financial_records), "Contacts" (contacts), "Calendar" (calendar), "Wellness" (wellness), "Preferences" (preferences)
    - Create `src/components/consent/ConsentHistory.tsx`:
      - Props: `history: ConsentHistoryEntry[]`
      - Chronological list: timestamp, field name, action (Grant/Revoke with color coding green/red), persona scope
      - Paginated with "Load More" button
    - _Requirements: 7.1, 7.5, 7.6_

  - [x] 15.3 Implement audit trail page
    - Create `src/app/(main)/audit/page.tsx`:
      - Fetch audit entries from `/api/audit` with pagination
      - Filter controls: action type dropdown, date range picker (start/end date inputs), persona filter
      - Display chain verification status: green checkmark if valid, red warning banner if tampered
      - Paginated table/list of audit entries: timestamp, action type (color-coded badge), resource, persona, details
      - Each entry expandable to show full metadata JSON
    - _Requirements: 13.3, 13.4, 13.5_

- [x] 16. Profile, calendar, contacts, and notifications UI
  - [x] 16.1 Implement profile and preferences page
    - Create `src/app/(main)/profile/page.tsx`:
      - Fetch profile from `/api/profile`
      - Sections:
        1. **Personal Info**: editable fields for display name (Input), avatar (file upload or URL input), timezone (select from common timezones), preferred language (select)
        2. **Financial Preferences** (for Kai): risk tolerance (radio: conservative/moderate/aggressive), investment goals (textarea), income range (select from ranges)
        3. **Lifestyle Preferences** (for Nav): wellness interests (multi-select tags), dietary preferences (multi-select tags), favorite service categories (multi-select tags)
        4. **Security**: WebAuthn setup button (calls `/api/auth/webauthn/register`), TOTP 2FA setup button (calls `/api/auth/totp/setup`, shows QR code in dialog)
      - Save button: PUT `/api/profile` with all changed fields
      - Each section in a Card component with clear headings
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.6, 2.1, 2.4_

  - [x] 16.2 Implement calendar page
    - Create `src/app/(main)/calendar/page.tsx`:
      - Fetch calendar events from `/api/calendar`
      - Display: list view of upcoming events sorted by startTime, grouped by date
      - Each event card: title, time range, location, recurrence badge
      - "Add Event" button → dialog with form (title, description, start/end datetime, location, recurrence)
      - Edit/Delete buttons on each event card
      - Availability checker: two datetime inputs (range start/end), button to check → calls logic to find free slots by comparing against existing events, displays available time slots
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 16.3 Implement notification center
    - Create `src/app/(main)/notifications/page.tsx`:
      - Fetch notifications from `/api/notifications`
      - Two tabs: "Unread" and "All"
      - Each notification: type icon, title, body preview, relative timestamp, read/unread indicator (dot)
      - Click notification: mark as read (PATCH), navigate to linkedResource if present (parse "conversation:id" → /chat/id, "vault:id" → /vault)
    - Create `src/components/notifications/NotificationCenter.tsx`:
      - Dropdown version for header (shows latest 5 unread, "View All" link to /notifications)
    - Create `src/components/notifications/NotificationBadge.tsx`:
      - Props: none (fetches own data)
      - Uses `useNotifications` hook to poll unread count every 30 seconds
      - Renders Bell icon with red badge showing count (hidden if 0)
    - Create `src/hooks/useNotifications.ts`:
      - Polls `/api/notifications?read=false` every 30 seconds via `setInterval`
      - Returns: `{ unreadCount, notifications, markAsRead, refresh }`
    - Create notification preferences section (can be on the notifications page or in profile):
      - Toggle switches for each notification type: financial alerts, contact reminders, calendar reminders, system notifications
      - Push notification toggle (uses Web Push API if available)
      - Fetches/saves via `/api/notifications/preferences`
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.7_

- [x] 17. Onboarding wizard
  - [x] 17.1 Implement onboarding flow
    - Create `src/app/onboarding/page.tsx`:
      - Check session: if not authenticated, redirect to /login. If onboardingDone === true, redirect to /chat/new
      - Render `<OnboardingWizard />` component
    - Create `src/components/onboarding/OnboardingWizard.tsx`:
      - State: `currentStep` (0-3), `preferences`, `consentSelections`
      - Steps: [PersonaIntroStep, PreferencesStep, ConsentStep, CompletionStep]
      - Progress indicator: dots or step numbers showing current/total (e.g., "Step 2 of 4")
      - Navigation: "Next" button, "Back" button (except step 0), "Skip" button on every step
      - Transitions: CSS transition with `transform: translateX()` and `opacity`, max 300ms duration
      - On complete/skip: POST to `/api/profile` with collected preferences, PUT consent toggles, then PATCH user `onboardingDone = true`, redirect to `/chat/new`
    - Create `src/components/onboarding/PersonaIntroStep.tsx`:
      - Two large cards side by side (stacked on mobile):
        - Kai card: avatar image, name "Kai", subtitle "Your Financial Advisor", bullet list of capabilities (portfolio analysis, spending insights, investment recommendations)
        - Nav card: avatar image, name "Nav", subtitle "Your Lifestyle Concierge", bullet list of capabilities (wellness recommendations, booking assistance, contact management)
      - Animated entrance (fade-in + slide-up)
    - Create `src/components/onboarding/PreferencesStep.tsx`:
      - Two sections:
        - "Financial Preferences (for Kai)": risk tolerance radio buttons (conservative/moderate/aggressive), investment goals textarea
        - "Lifestyle Preferences (for Nav)": wellness interests checkboxes (fitness, meditation, spa, nutrition, etc.), favorite service categories checkboxes (restaurants, travel, wellness, entertainment)
      - All fields optional (can skip)
    - Create `src/components/onboarding/ConsentStep.tsx`:
      - Explanation text: "Choose which data Kai and Nav can access to personalize your experience"
      - List of data categories with toggle switches (same as consent page but simplified):
        - Financial Records (for Kai)
        - Contacts (for Nav)
        - Calendar (for both)
        - Wellness Data (for Nav)
        - Preferences (for both)
      - All default to OFF, user opts in
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

- [x] 18. Checkpoint — UI complete
  - Verify all pages render without errors. Navigate through the full flow: register → onboarding → chat → vault → consent → audit → profile → calendar → notifications. Ask the user if questions arise.

- [x] 19. Adapter architecture and mock data
  - [x] 19.1 Implement adapter interface and registry
    - Create `src/lib/adapters/interface.ts`:
      - Re-export the `DataAdapter`, `AdapterConfig`, `AdapterResult`, `DataQuery` interfaces from `@/types/adapter` (already defined in task 1.3)
      - This file serves as the canonical import point for adapter-related types in the lib layer
    - Create `src/lib/adapters/registry.ts`:
      - Import: `DataAdapter`, `AdapterConfig` from `./interface`
      - Implement `AdapterRegistry` class:
        ```typescript
        class AdapterRegistry {
          private adapters: Map<string, DataAdapter> = new Map();
          register(adapter: DataAdapter): void { this.adapters.set(adapter.id, adapter); }
          get(id: string): DataAdapter | undefined { return this.adapters.get(id); }
          getAll(): DataAdapter[] { return Array.from(this.adapters.values()); }
          async initializeAll(configs: AdapterConfig[]): Promise<void> {
            for (const config of configs) {
              const adapter = this.adapters.get(config.id);
              if (adapter && config.enabled) await adapter.initialize(config);
            }
          }
        }
        ```
      - Export singleton: `export const adapterRegistry = new AdapterRegistry();`
      - Read adapter configs from env or a config file at startup
    - _Requirements: 22.1, 22.3, 22.4, 22.5_

  - [x] 19.2 Implement mock data adapter and seed script
    - Create `src/lib/adapters/mock-adapter.ts`:
      - Implements `DataAdapter` interface with `id: 'mock'`, `name: 'Mock Data'`
      - `initialize()`: no-op (no external connection needed)
      - `authenticate()`: returns `{ success: true }`
      - `fetchData(query)`: returns pre-defined mock data arrays based on `query.entityType`:
        - `financial_record`: 15 transactions (groceries, dining, utilities, salary, investments), 5 portfolio holdings (AAPL, GOOGL, MSFT, AMZN, BTC), 3 budget items
        - `contact`: 10 sample contacts with realistic names, relationship types (mix of personal/professional/family), important dates (birthdays, anniversaries), tags, communication history
        - `calendar_event`: 20 events spread across 30 days (meetings, gym sessions, dinners, doctor appointments, team standups)
        - `preference`: sample financial prefs (risk_tolerance: moderate) and lifestyle prefs (wellness: yoga, meditation)
        - `booking`: 3 sample bookings (restaurant reservation, spa appointment, dentist)
      - `transformData()`: pass-through (mock data already in correct format)
      - `healthCheck()`: returns `{ success: true, data: { status: 'ok' } }`
      - All mock data conforms to the Zod schemas defined in `vault-schema.ts`
    - Create `prisma/seed.ts`:
      - Import: `PrismaClient`, mock adapter, crypto service, vault schema validation
      - Steps:
        1. Create a demo user: email="demo@hushh.ai", name="Demo User", password=bcrypt.hash("demo123", 12)
        2. Create UserProfile with sample preferences
        3. Fetch mock data from MockAdapter for each entity type
        4. For each mock data item: validate against schema, encrypt with user's derived key, store as VaultEntry
        5. Create default ConsentToggle entries (all disabled) for the demo user
        6. Create initial AuditEntry with GENESIS hash
        7. Only seed if no existing users: `const count = await prisma.user.count(); if (count > 0) return;`
      - Add to `package.json`: `"prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }`
      - Install ts-node as dev dep: add `ts-node` to task 1.1 dev deps
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 22.2_

- [x] 20. Admin dashboard
  - [x] 20.1 Implement admin escalation dashboard
    - Create `src/app/admin/escalations/page.tsx`:
      - Auth guard: check session, verify user is admin (check `ADMIN_EMAILS` env var — comma-separated list of admin email addresses). If not admin, redirect to /chat/new
      - Fetch escalations from `/api/escalation` (admin GET endpoint)
      - Filter controls: status dropdown (All, Pending, In Review, Resolved), date range, persona filter
      - Escalation list: each card shows original query, preliminary AI response, escalation reason, status badge (color-coded: pending=yellow, in-review=blue, resolved=green), user info, timestamp
      - Resolution form: for pending/in-review escalations, show textarea for resolution + "Resolve" button. On submit: PATCH `/api/escalation/[id]` with resolution text
      - Add `ADMIN_EMAILS` to `.env.example`
    - _Requirements: 14.4, 14.5, 14.6_

- [x] 21. PWA support
  - [x] 21.1 Configure Progressive Web App
    - Create `public/manifest.json`:
      ```json
      {
        "name": "Hushh Personal Agent",
        "short_name": "Hushh",
        "description": "Your AI-powered personal data agent",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#0f172a",
        "icons": [
          { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
          { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
        ]
      }
      ```
    - Create `public/sw.js` (service worker):
      - Cache name: `hushh-v1`
      - On install: cache static assets (/, /login, CSS, JS bundles)
      - On fetch: cache-first strategy for static assets, network-first for API calls
      - On activate: clean up old caches
    - Create placeholder icons: `public/icons/icon-192.png` and `public/icons/icon-512.png` (simple colored squares with "H" letter as placeholder)
    - Register service worker in `src/app/layout.tsx`:
      ```typescript
      // In a useEffect or script tag:
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js');
      }
      ```
    - Add offline fallback: when fetch fails in service worker, return cached shell with a banner message "You're offline. Some features are limited."
    - Ensure responsive design: all layouts use Tailwind responsive classes (sm:, md:, lg:, xl:, 2xl:) to work from 320px to 2560px. Sidebar collapses to hamburger menu on mobile (<768px)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 22. Integration wiring and final assembly
  - [x] 22.1 Wire agent service with persona-scoped vault access
    - In `src/lib/agent.ts`, ensure the `processMessage` function:
      - For Kai queries: retrieves financial_record and preference vault entries, formats spending analysis (categorize transactions by category, sum amounts), portfolio summary (list holdings with values), and investment context. Includes user's riskTolerance and investmentGoals from UserProfile in the LLM context. Adds disclaimer text to system prompt: "Always remind users this is informational, not professional financial advice"
      - For Nav queries: retrieves contact, calendar_event, preference, and booking vault entries. Formats contact summaries, upcoming events, and lifestyle preferences. Includes user's wellnessInterests and dietaryPreferences from UserProfile in context
      - Enforces persona data scope restrictions: Kai can ONLY access ['financial_record', 'preference'], Nav can ONLY access ['contact', 'calendar_event', 'preference', 'booking']. These scopes are defined in persona config AND enforced by consent toggles (double gate)
      - Mock financial data (from seed) is used for Kai's analysis in MVP — structured to match realistic patterns (monthly spending, diversified portfolio)
    - _Requirements: 5.3, 5.5, 5.6, 5.7, 6.1, 6.2, 6.3, 6.4, 6.5, 10.1, 10.2, 10.3, 10.4, 21.5, 21.7_

  - [x] 22.2 Wire notification triggers
    - Create a notification trigger function (can be called from a cron-like endpoint or on user login):
      - Scan contacts for important dates within 7 days: query contact vault entries, parse importantDates, compare to current date. For each match, call `notificationService.create({ type: 'contact_reminder', title: 'Upcoming: [contact name]\'s [event]', body: '[event] is on [date]', linkedResource: 'vault:[contactEntryId]' })`
      - Scan calendar for events within 24 hours: similar logic for calendar_event entries
      - When Nav confirms a booking (in agent service): automatically create a calendar_event vault entry if calendar consent is granted
      - Wire NotificationBadge in AppHeader to show real-time unread count
    - Create `src/app/api/notifications/check/route.ts`:
      - **POST**: Trigger `notificationService.checkAndGenerateAlerts(userId)`. Can be called on login or periodically
    - _Requirements: 11.3, 10.3, 12.6, 23.5, 23.6, 23.7_

  - [x] 22.3 Wire escalation flow end-to-end
    - In agent service (`src/lib/agent.ts`):
      - After generating LLM response, check for escalation triggers:
        - Keyword detection: if user message contains "delete my account", "transfer money", "legal", "sue", "emergency" → escalate
        - Sensitive action detection: if the agent's response suggests a financial transaction or account modification → escalate
      - On escalation: create Escalation record via `/api/escalation`, notify user in chat: "I've flagged this for a human expert to review. You should hear back within [estimated time]."
      - Store the AI's preliminary response in the escalation record
    - In admin dashboard: when operator resolves, the resolution is stored. Next time user chats, agent can reference the resolution
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 22.4 Add conversation search and availability checking
    - Conversation search (in `/api/chat/conversations` GET route):
      - Accept `search` query param
      - If provided: query `prisma.message.findMany({ where: { content: { contains: search, mode: 'insensitive' }, conversation: { userId } } })`, get unique conversationIds, return those conversations
    - Calendar availability checking (in `/api/calendar` or a new `/api/calendar/availability` route):
      - Accept `startDate` and `endDate` query params
      - Fetch all calendar events in that range
      - Compute free slots: divide the range into 30-min blocks, mark blocks that overlap with existing events as busy, return remaining blocks as available
      - Return: `{ availableSlots: { start: string, end: string }[] }`
    - _Requirements: 20.2, 12.5_

- [x] 23. Final checkpoint — Full integration
  - Run the complete application: `docker-compose up -d` (PostgreSQL), `npx prisma migrate deploy`, `npx prisma db seed`, `npm run dev`
  - Walk through the entire user flow: register → onboarding (meet Kai & Nav, set preferences, grant consent) → chat with Kai (ask about spending, portfolio) → chat with Nav (book a massage, check contacts) → manage vault entries → toggle consent → view audit trail → check notifications → view calendar → admin escalation dashboard
  - Verify all open-source alternatives are in place: NextAuth (not Apple Sign-In), Ollama (not GPT-4o), PostgreSQL+Prisma (not CoreData), mock adapters (not Salesforce/MuleSoft), Web Speech API (not proprietary voice), WebAuthn (not FaceID)
  - Ask the user if questions arise.

## Notes

- **NO TESTING CODE**: This project has zero test files. No unit tests, integration tests, or property tests. Testing is done by using the application manually
- Each task references specific requirement numbers for traceability back to requirements.md
- Checkpoints at tasks 5, 12, 18, and 23 ensure incremental validation
- The mock data adapter (task 19.2) is the default; real adapters can be added later without modifying core services (Req 22.5)
- All encryption keys and secrets are configured via environment variables, never hardcoded
- Additional dependency note: add `react-markdown` and `remark-gfm` to the npm install in task 1.1 for markdown rendering in chat messages
