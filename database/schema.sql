/* =========================================================
   RESOLVEDESK DATABASE SCHEMA
   PostgreSQL
========================================================= */


/* =========================================================
   RESET TABLES
   Development only
========================================================= */

DROP TABLE IF EXISTS
    audit_logs,
    knowledge_base,
    notifications,
    ticket_history,
    ticket_attachments,
    ticket_comments,
    tickets,
    sla_policies,
    categories,
    app_settings,
    user_sessions,
    users,
    departments
CASCADE;


/* =========================================================
   DEPARTMENTS
========================================================= */

CREATE TABLE departments (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(120)
        NOT NULL,

    code VARCHAR(20)
        NOT NULL,

    description TEXT,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT departments_name_not_blank
        CHECK (
            LENGTH(
                BTRIM(name)
            ) > 0
        ),

    CONSTRAINT departments_code_not_blank
        CHECK (
            LENGTH(
                BTRIM(code)
            ) > 0
        )

);


/* =========================================================
   UNIQUE DEPARTMENT VALUES
========================================================= */

CREATE UNIQUE INDEX departments_name_unique
ON departments (
    LOWER(name)
);


CREATE UNIQUE INDEX departments_code_unique
ON departments (
    LOWER(code)
);


/* =========================================================
   USERS
========================================================= */

CREATE TABLE users (

    id BIGSERIAL PRIMARY KEY,

    full_name VARCHAR(150)
        NOT NULL,

    email VARCHAR(255)
        NOT NULL,

    password_hash TEXT
        NOT NULL,

    role VARCHAR(20)
        NOT NULL
        DEFAULT 'STAFF',

    department_id BIGINT
        REFERENCES departments(id)
        ON DELETE SET NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'PENDING',

    phone VARCHAR(40),

    job_title VARCHAR(120),

    bio TEXT,

    profile_photo TEXT,

    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER
        NOT NULL
        DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_failed_login_at TIMESTAMPTZ,

    approved_at TIMESTAMPTZ,

    approved_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT users_name_not_blank
        CHECK (
            LENGTH(
                BTRIM(full_name)
            ) > 0
        ),

    CONSTRAINT users_email_not_blank
        CHECK (
            LENGTH(
                BTRIM(email)
            ) > 0
        ),

    CONSTRAINT users_role_check
        CHECK (
            role IN (
                'ADMIN',
                'TECHNICIAN',
                'STAFF'
            )
        ),

    CONSTRAINT users_status_check
        CHECK (
            status IN (
                'PENDING',
                'ACTIVE',
                'SUSPENDED',
                'INACTIVE'
            )
        )

);


/* =========================================================
   CASE-INSENSITIVE UNIQUE EMAIL
========================================================= */

CREATE UNIQUE INDEX users_email_unique
ON users (
    LOWER(email)
);


/* =========================================================
   USER LOOKUP INDEXES
========================================================= */

CREATE INDEX users_role_idx
ON users(role);


CREATE INDEX users_status_idx
ON users(status);


CREATE INDEX users_department_idx
ON users(department_id);


/* =========================================================
   DEPARTMENT HEAD
   Added after users exists to avoid circular dependency
========================================================= */

ALTER TABLE departments
ADD COLUMN head_user_id BIGINT
REFERENCES users(id)
ON DELETE SET NULL;


/* =========================================================
   CATEGORIES
========================================================= */

CREATE TABLE categories (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100)
        NOT NULL,

    description TEXT,

    default_priority VARCHAR(20)
        NOT NULL
        DEFAULT 'MEDIUM',

    department_id BIGINT
        REFERENCES departments(id)
        ON DELETE SET NULL,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT categories_priority_check
        CHECK (
            default_priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        )

);


CREATE UNIQUE INDEX categories_name_unique
ON categories (
    LOWER(name)
);


/* =========================================================
   SLA POLICIES
========================================================= */

CREATE TABLE sla_policies (

    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100)
        NOT NULL,

    priority VARCHAR(20)
        NOT NULL,

    first_response_minutes INTEGER
        NOT NULL,

    resolution_minutes INTEGER
        NOT NULL,

    warning_threshold_minutes INTEGER
        NOT NULL
        DEFAULT 30,

    business_hours_only BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT sla_priority_check
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT sla_first_response_positive
        CHECK (
            first_response_minutes > 0
        ),

    CONSTRAINT sla_resolution_positive
        CHECK (
            resolution_minutes > 0
        ),

    CONSTRAINT sla_warning_non_negative
        CHECK (
            warning_threshold_minutes >= 0
        )

);


CREATE UNIQUE INDEX sla_priority_unique
ON sla_policies(priority);


/* =========================================================
   TICKETS
========================================================= */

CREATE TABLE tickets (

    id BIGSERIAL PRIMARY KEY,

    ticket_number VARCHAR(30)
        NOT NULL
        UNIQUE,

    subject VARCHAR(200)
        NOT NULL,

    description TEXT
        NOT NULL,

    requester_id BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    assigned_to BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    department_id BIGINT
        REFERENCES departments(id)
        ON DELETE SET NULL,

    category_id BIGINT
        REFERENCES categories(id)
        ON DELETE SET NULL,

    sla_policy_id BIGINT
        REFERENCES sla_policies(id)
        ON DELETE SET NULL,

    priority VARCHAR(20)
        NOT NULL
        DEFAULT 'MEDIUM',

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'OPEN',

    source VARCHAR(30)
        NOT NULL
        DEFAULT 'PORTAL',

    first_response_due_at TIMESTAMPTZ,

    resolution_due_at TIMESTAMPTZ,

    first_response_at TIMESTAMPTZ,

    resolved_at TIMESTAMPTZ,

    closed_at TIMESTAMPTZ,

    resolution_note TEXT,

    sla_breached BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT tickets_subject_not_blank
        CHECK (
            LENGTH(
                BTRIM(subject)
            ) > 0
        ),

    CONSTRAINT tickets_description_not_blank
        CHECK (
            LENGTH(
                BTRIM(description)
            ) > 0
        ),

    CONSTRAINT tickets_priority_check
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT tickets_status_check
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'PENDING',
                'RESOLVED',
                'CLOSED'
            )
        ),

    CONSTRAINT tickets_source_check
        CHECK (
            source IN (
                'PORTAL',
                'EMAIL',
                'PHONE',
                'ADMIN'
            )
        )

);


/* =========================================================
   TICKET INDEXES
========================================================= */

CREATE INDEX tickets_requester_idx
ON tickets(requester_id);


CREATE INDEX tickets_assigned_to_idx
ON tickets(assigned_to);


CREATE INDEX tickets_department_idx
ON tickets(department_id);


CREATE INDEX tickets_category_idx
ON tickets(category_id);


CREATE INDEX tickets_status_idx
ON tickets(status);


CREATE INDEX tickets_priority_idx
ON tickets(priority);


CREATE INDEX tickets_created_at_idx
ON tickets(created_at DESC);


CREATE INDEX tickets_resolution_due_idx
ON tickets(resolution_due_at)
WHERE
    status NOT IN (
        'RESOLVED',
        'CLOSED'
    );


/* =========================================================
   TICKET COMMENTS
========================================================= */

CREATE TABLE ticket_comments (

    id BIGSERIAL PRIMARY KEY,

    ticket_id BIGINT
        NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    user_id BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    body TEXT
        NOT NULL,

    is_internal BOOLEAN
        NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT comments_body_not_blank
        CHECK (
            LENGTH(
                BTRIM(body)
            ) > 0
        )

);


CREATE INDEX ticket_comments_ticket_idx
ON ticket_comments(
    ticket_id,
    created_at
);


/* =========================================================
   TICKET ATTACHMENTS
========================================================= */

CREATE TABLE ticket_attachments (

    id BIGSERIAL PRIMARY KEY,

    ticket_id BIGINT
        NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    uploaded_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    original_name VARCHAR(255)
        NOT NULL,

    stored_name VARCHAR(255)
        NOT NULL,

    mime_type VARCHAR(150),

    size_bytes BIGINT
        NOT NULL,

    file_path TEXT
        NOT NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT attachment_size_non_negative
        CHECK (
            size_bytes >= 0
        )

);


CREATE INDEX ticket_attachments_ticket_idx
ON ticket_attachments(ticket_id);


/* =========================================================
   TICKET HISTORY
========================================================= */

CREATE TABLE ticket_history (

    id BIGSERIAL PRIMARY KEY,

    ticket_id BIGINT
        NOT NULL
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    actor_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(120)
        NOT NULL,

    old_value JSONB,

    new_value JSONB,

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX ticket_history_ticket_idx
ON ticket_history(
    ticket_id,
    created_at DESC
);


CREATE INDEX ticket_history_actor_idx
ON ticket_history(actor_id);


/* =========================================================
   NOTIFICATIONS
========================================================= */

CREATE TABLE notifications (

    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(50)
        NOT NULL,

    title VARCHAR(180)
        NOT NULL,

    body TEXT,

    link TEXT,

    read_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


CREATE INDEX notifications_user_idx
ON notifications(
    user_id,
    created_at DESC
);


CREATE INDEX notifications_unread_idx
ON notifications(user_id)
WHERE read_at IS NULL;


/* =========================================================
   KNOWLEDGE BASE
========================================================= */

CREATE TABLE knowledge_base (

    id BIGSERIAL PRIMARY KEY,

    title VARCHAR(220)
        NOT NULL,

    slug VARCHAR(240)
        NOT NULL
        UNIQUE,

    summary TEXT,

    content TEXT
        NOT NULL,

    category_id BIGINT
        REFERENCES categories(id)
        ON DELETE SET NULL,

    author_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(20)
        NOT NULL
        DEFAULT 'DRAFT',

    visibility VARCHAR(30)
        NOT NULL
        DEFAULT 'ALL_STAFF',
    views INTEGER
        NOT NULL
        DEFAULT 0,
    helpful_yes INTEGER
        NOT NULL
        DEFAULT 0,
    helpful_no INTEGER
        NOT NULL
        DEFAULT 0,

    published_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT knowledge_status_check
        CHECK (
            status IN (
                'DRAFT',
                'PUBLISHED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT knowledge_views_non_negative
        CHECK (
            views >= 0
        )

);


CREATE INDEX knowledge_category_idx
ON knowledge_base(category_id);


CREATE INDEX knowledge_status_idx
ON knowledge_base(status);


/* =========================================================
   AUDIT LOGS
========================================================= */

CREATE TABLE audit_logs (

    id BIGSERIAL PRIMARY KEY,

    actor_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(160)
        NOT NULL,

    entity_type VARCHAR(80),

    entity_id VARCHAR(120),

    severity VARCHAR(20)
        NOT NULL
        DEFAULT 'INFO',

    metadata JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    ip_address VARCHAR(64),

    user_agent TEXT,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    CONSTRAINT audit_severity_check
        CHECK (
            severity IN (
                'INFO',
                'WARNING',
                'CRITICAL'
            )
        )

);


CREATE INDEX audit_logs_actor_idx
ON audit_logs(actor_id);


CREATE INDEX audit_logs_entity_idx
ON audit_logs(
    entity_type,
    entity_id
);


CREATE INDEX audit_logs_created_at_idx
ON audit_logs(created_at DESC);


/* =========================================================
   APPLICATION SETTINGS
========================================================= */

CREATE TABLE app_settings (

    id BIGSERIAL PRIMARY KEY,

    setting_key VARCHAR(150)
        NOT NULL
        UNIQUE,

    setting_value JSONB
        NOT NULL
        DEFAULT '{}'::JSONB,

    description TEXT,

    updated_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW()

);


/* =========================================================
   SESSION STORE
   Compatible with connect-pg-simple
========================================================= */

CREATE TABLE user_sessions (

    sid VARCHAR
        NOT NULL
        PRIMARY KEY,

    sess JSON
        NOT NULL,

    expire TIMESTAMP(6)
        NOT NULL

);


CREATE INDEX user_sessions_expire_idx
ON user_sessions(expire);


/* =========================================================
   UPDATED_AT FUNCTION
========================================================= */

CREATE OR REPLACE FUNCTION
set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$

BEGIN

    NEW.updated_at =
        NOW();

    RETURN NEW;

END;

$$;


/* =========================================================
   UPDATED_AT TRIGGERS
========================================================= */

CREATE TRIGGER departments_updated_at
BEFORE UPDATE
ON departments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER users_updated_at
BEFORE UPDATE
ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER categories_updated_at
BEFORE UPDATE
ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER sla_policies_updated_at
BEFORE UPDATE
ON sla_policies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER tickets_updated_at
BEFORE UPDATE
ON tickets
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER ticket_comments_updated_at
BEFORE UPDATE
ON ticket_comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER knowledge_base_updated_at
BEFORE UPDATE
ON knowledge_base
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


CREATE TRIGGER app_settings_updated_at
BEFORE UPDATE
ON app_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


/* =========================================================
   FINISHED
========================================================= */

SELECT
    'ResolveDesk schema created successfully.'
    AS message;
