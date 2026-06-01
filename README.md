# Hushh Personal Agent

A full-stack AI-powered personal assistant with encrypted data vault, consent-based access control, and multi-persona streaming chat.

## Features

- **Two AI Personas** — Financial Advisor and Lifestyle Concierge with distinct scopes and personalities
- **Streaming Chat** — Real-time LLM responses via Server-Sent Events (Ollama/OpenAI)
- **Encrypted Vault** — AES-encrypted personal data storage with per-user key derivation
- **Consent-Based Access** — Granular per-field, per-persona data access with full audit trail
- **Multi-Auth** — Password, OAuth, TOTP 2FA, and WebAuthn support
- **Action Parsing** — LLM generates structured actions from natural language queries

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Server Actions
- **Database**: PostgreSQL with Prisma ORM (13 models)
- **AI/LLM**: LangChain, Ollama, OpenAI API
- **Auth**: NextAuth.js, WebAuthn, TOTP

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Next.js App                     │
├──────────────────┬──────────────────────────────┤
│   Frontend       │         Backend               │
│   React UI       │   28+ API Routes             │
│   Streaming Chat │   Auth (NextAuth)            │
│   Vault UI       │   Vault (Encrypt/Decrypt)    │
│   Consent Mgmt   │   Chat (LLM + Actions)       │
│                  │   Consent (Per-persona)       │
├──────────────────┴──────────────────────────────┤
│              PostgreSQL (Prisma)                  │
│   Users, Personas, VaultEntries, Consents,       │
│   ChatSessions, Messages, AuditLogs...          │
└─────────────────────────────────────────────────┘
```

## Database Schema (13 Models)

- User, Account, Session — Authentication
- Persona — AI persona definitions with scopes
- VaultEntry — Encrypted personal data
- Consent — Per-field, per-persona access grants
- ChatSession, Message — Conversation history
- AuditLog — Blockchain-style hash chain for compliance
- Notification, Escalation — Alert system

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

See `.env.example` for required configuration (database URL, auth secrets, LLM provider settings).

## Development Notes

This project was built using AI-assisted development workflows (Kiro IDE) for architecture planning, design, and frontend implementation — demonstrating modern AI-augmented software development practices.
