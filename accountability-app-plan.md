# Accountability App

Couples accountability app for proposing, accepting, and tracking tasks with a financial penalty system.

## Users
- user & wife (just two users for now)

## Core Flow
1. Either person proposes a task (e.g. "clean the kitchen by Friday")
2. The other person accepts or rejects the proposal
3. Track whether each person completed the task
4. If someone doesn't complete it, they owe the other person (running tally)

## Features
- **Proposals**: Create tasks with a description, deadline, and penalty amount
- **Accept/Reject**: Other person must agree to the terms
- **Completion tracking**: Mark tasks as done, other person can verify/dispute
- **Running tally**: Track who owes whom and how much (no real payment integration)
- **Email notifications**: New proposals, reminders before deadlines, completion updates
- **Dashboard**: Active tasks, pending proposals, balance/tally

## Tech Stack
- **Cloudflare Worker + Hono** (same as fitness-rpg)
- **D1** for database
- **Email**: Cloudflare Email Workers or a service like Resend for notifications
- **Auth**: Email + password (bcrypt/scrypt hashed, JWT sessions)
- **Domain**: subdomain on iancash.me (e.g. `accountability.iancash.me`)
- **Frontend**: Static HTML/CSS/JS served from worker (same pattern as fitness-rpg)

## Database Schema (Draft)

### users
- id (integer, primary key)
- email (text, unique)
- name (text)
- password_hash (text)
- created_at (timestamp)

### proposals
- id (integer, primary key)
- created_by (integer, FK -> users)
- assigned_to (integer, FK -> users)
- title (text)
- description (text)
- deadline (timestamp)
- penalty_amount (real) -- e.g. 5.00
- status (text) -- 'pending', 'accepted', 'rejected', 'completed', 'failed', 'verified'
- created_at (timestamp)
- accepted_at (timestamp, nullable)
- completed_at (timestamp, nullable)

### ledger
- id (integer, primary key)
- proposal_id (integer, FK -> proposals)
- from_user (integer, FK -> users)
- to_user (integer, FK -> users)
- amount (real)
- reason (text)
- created_at (timestamp)

## Notification Triggers
- New proposal created -> email the other person
- Proposal accepted/rejected -> email the proposer
- Deadline approaching (e.g. 24h before) -> email reminder via cron
- Task marked complete -> email other person to verify
- Task failed/penalty applied -> email both

## Open Questions
- Dispute resolution: what happens if someone says they did it but the other disagrees?
- Can both people be assigned the same task? (e.g. "both clean the garage")
- Recurring tasks? (e.g. "take out trash every week")
