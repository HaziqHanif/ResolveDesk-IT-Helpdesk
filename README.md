# ResolveDesk

ResolveDesk is a full-stack IT Help Desk and Service Management system built to manage internal support requests, technician workloads, SLA tracking, departments, users, knowledge base content, notifications, reporting, and audit activity.

The project demonstrates a complete help desk workflow from ticket creation to assignment, technician handling, resolution, SLA monitoring, and administrative management.

## Features

* Secure user authentication and session management
* Role-based access control for Admin, Technician, and Staff accounts
* Ticket creation and management
* Automatic and manual technician assignment
* Technician My Queue
* Ticket status workflow
* Priority management
* SLA policies and SLA monitoring
* SLA warning and breach detection
* Department and category management
* User and technician management
* Ticket comments and conversation history
* Ticket activity history
* Knowledge Base
* Notifications
* Reports and operational statistics
* Audit logging
* User profile and preferences
* Responsive dashboard interface

## Ticket Workflow

ResolveDesk supports a structured ticket lifecycle:

```text
OPEN
  ↓
IN_PROGRESS
  ↓
PENDING
  ↓
RESOLVED
  ↓
CLOSED
```

Technicians can manage assigned requests through their queue while administrators can monitor support operations across departments.

## SLA Management

Tickets can be linked to SLA policies based on priority:

| Priority | First Response | Resolution |
| -------- | -------------: | ---------: |
| Critical |     15 minutes | 60 minutes |
| High     |     30 minutes |    4 hours |
| Medium   |        2 hours |    8 hours |
| Low      |        4 hours |   24 hours |

ResolveDesk tracks response and resolution deadlines and identifies tickets that are approaching or exceeding their SLA targets.

## User Roles

### Admin

Administrators can manage the overall ResolveDesk environment, including:

* Users
* Technicians
* Departments
* Tickets
* Assignments
* SLA monitoring
* Reports
* Knowledge Base
* Audit logs
* System settings

### Technician

Technicians can:

* View their assigned ticket queue
* Open assigned tickets
* Start work
* Update ticket status
* Add comments
* Resolve tickets
* View relevant Knowledge Base content

### Staff

Staff users can:

* Submit support requests
* View their tickets
* Follow ticket progress
* Add comments
* Access available Knowledge Base articles
* Manage their profile

## Technology Stack

### Frontend

* HTML5
* CSS3
* JavaScript
* Responsive web interface

### Backend

* Node.js
* Express.js
* REST API
* Express Session
* Role-based middleware
* Secure password hashing

### Database

* PostgreSQL

The database stores users, departments, categories, tickets, ticket history, comments, SLA policies, notifications, knowledge base content, and other service desk data.

## Project Structure

```text
ResolveDesk/
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── uploads/
│   ├── utils/
│   ├── db.js
│   └── server.js
│
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   ├── sample-data.sql
│   └── knowledge-base-data.sql
│
├── frontend/
│   ├── js/
│   ├── dashboard.html
│   ├── tickets.html
│   ├── ticket-detail.html
│   ├── my-queue.html
│   ├── sla-monitor.html
│   ├── technicians.html
│   ├── departments.html
│   ├── users.html
│   ├── knowledge-base.html
│   ├── reports.html
│   ├── profile.html
│   └── settings.html
│
├── scripts/
├── .env.example
├── package.json
└── README.md
```

## Installation

Clone the repository:

```bash
git clone <repository-url>
cd ResolveDesk
```

Install dependencies:

```bash
npm install
```

Create an environment configuration. **Do not overwrite an existing `.env` file:**

```bash
[ -f .env ] || cp .env.example .env
```

Configure the PostgreSQL connection and required environment variables inside `.env`.

## Database Setup

**Important:** These instructions are for a **new, empty setup database only**. `database/schema.sql` contains destructive table-reset commands. Never run it against an existing database containing project data.

The example below uses `resolvedesk_setup` to keep it separate from the existing `resolvedesk` development database. Set `DB_NAME=resolvedesk_setup` in the new `.env`, and configure the PostgreSQL credentials, `SESSION_SECRET`, and admin credentials before starting the application.

**Stop if `resolvedesk_setup` already exists.** Do not rerun the schema against it.

Create the PostgreSQL database:

```bash
createdb resolvedesk_setup
```

Create the database schema:

```bash
test "$(psql -d resolvedesk_setup -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")" = "0" && psql -v ON_ERROR_STOP=1 -d resolvedesk_setup -f database/schema.sql
```

Load the base seed data:

```bash
psql -v ON_ERROR_STOP=1 -d resolvedesk_setup -f database/seed.sql
```

After starting the server and confirming that the default admin account exists, optional demonstration data can be loaded with:

```bash
psql -v ON_ERROR_STOP=1 -d resolvedesk_setup -f database/sample-data.sql
```

Knowledge Base sample data can be loaded with:

```bash
psql -v ON_ERROR_STOP=1 -d resolvedesk_setup -f database/knowledge-base-data.sql
```

## Running ResolveDesk

Start the server:

```bash
node backend/server.js
```

Then open:

```text
http://localhost:3003
```

A health check is available through:

```text
GET /api/health
```

## Main Pages

| Page           | Purpose                                          |
| -------------- | ------------------------------------------------ |
| Dashboard      | Service desk overview and operational statistics |
| Tickets        | View and manage support tickets                  |
| Create Ticket  | Submit a new support request                     |
| My Queue       | Technician assigned-ticket workspace             |
| SLA Monitor    | Track SLA warning and breach conditions          |
| Technicians    | Technician management and workload information   |
| Departments    | Department management                            |
| Users          | User administration                              |
| Knowledge Base | Internal support documentation                   |
| Reports        | Help desk reporting and statistics               |
| Activity Log   | Administrative and audit activity                |
| Profile        | User account and profile settings                |
| Settings       | ResolveDesk system preferences                   |

## Security

ResolveDesk includes several security-focused features:

* Server-side authentication
* Secure password hashing
* Session-based authentication
* Role-based authorization
* Login attempt protection
* Account status checks
* Protected API endpoints
* Security-related HTTP headers
* Audit logging
* Environment-based configuration

Sensitive environment values are not intended to be committed to the repository.

## API

The backend exposes REST endpoints for areas including:

```text
/api/auth
/api/tickets
/api/users
/api/departments
/api/technicians
/api/knowledge-base
/api/notifications
/api/reports
/api/settings
/api/audit-logs
```

Access to protected endpoints depends on the authenticated user's role.

## Current Status

ResolveDesk currently includes working authentication, PostgreSQL persistence, role-based authorization, ticket workflows, technician queues, SLA tracking, knowledge base functionality, reporting, notifications, profile management, and administrative tools.

The project is designed as a portfolio demonstration of a full-stack internal IT service management application.

## Author

**Muhammad Haziq Hanif**

Computer Science graduate and software developer focused on full-stack web development, database systems, and practical business applications.

