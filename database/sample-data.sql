BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE LOWER(email) = LOWER('admin@resolvedesk.local')
    ) THEN
        RAISE EXCEPTION 'Base admin account is required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE LOWER(email) = LOWER('teststaff@resolvedesk.local')
    ) THEN
        RAISE EXCEPTION 'Base staff account is required.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM users
        WHERE LOWER(email) = LOWER('testtech@resolvedesk.local')
    ) THEN
        RAISE EXCEPTION 'Base technician account is required.';
    END IF;
END
$$;

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id,
    is_active
)
SELECT
    'Finance Systems',
    'Finance applications, payroll and accounting systems.',
    'HIGH',
    d.id,
    TRUE
FROM departments d
WHERE d.code = 'FIN'
AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER('Finance Systems')
);

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id,
    is_active
)
SELECT
    'HR Onboarding',
    'Employee onboarding, HR portal and access requests.',
    'MEDIUM',
    d.id,
    TRUE
FROM departments d
WHERE d.code = 'HR'
AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER('HR Onboarding')
);

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id,
    is_active
)
SELECT
    'Operations Devices',
    'Operational devices, scanners and workstation issues.',
    'LOW',
    d.id,
    TRUE
FROM departments d
WHERE d.code = 'OPS'
AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER('Operations Devices')
);

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id,
    is_active
)
SELECT
    'Sales CRM',
    'CRM, sales portal and customer system issues.',
    'MEDIUM',
    d.id,
    TRUE
FROM departments d
WHERE d.code = 'SAL'
AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER('Sales CRM')
);

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id,
    is_active
)
SELECT
    'Management Access',
    'Management dashboard and executive access requests.',
    'HIGH',
    d.id,
    TRUE
FROM departments d
WHERE d.code = 'MGT'
AND NOT EXISTS (
    SELECT 1 FROM categories
    WHERE LOWER(name) = LOWER('Management Access')
);

INSERT INTO users (
    full_name,
    email,
    password_hash,
    role,
    department_id,
    status,
    phone,
    job_title,
    bio,
    approved_at,
    approved_by
)
SELECT
    'Adam Hassan',
    'it.staff@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'ACTIVE',
    '012-1001001',
    'IT Coordinator',
    'Sample active IT staff account.',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'IT'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('it.staff@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, phone, job_title,
    bio, approved_at, approved_by
)
SELECT
    'Aisyah Rahman',
    'hr.staff@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'ACTIVE',
    '012-2002002',
    'HR Executive',
    'Sample active HR staff account.',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'HR'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('hr.staff@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, phone, job_title,
    bio, approved_at, approved_by
)
SELECT
    'Sara Lim',
    'ops.staff@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'ACTIVE',
    '012-3003003',
    'Operations Executive',
    'Sample active Operations staff account.',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'OPS'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('ops.staff@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, phone, job_title,
    bio, approved_at, approved_by
)
SELECT
    'Amir Hakim',
    'sales.staff@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'ACTIVE',
    '012-4004004',
    'Sales Executive',
    'Sample active Sales staff account.',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'SAL'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('sales.staff@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, phone, job_title,
    bio, approved_at, approved_by
)
SELECT
    'Farah Ismail',
    'management.staff@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'ACTIVE',
    '012-5005005',
    'Management Executive',
    'Sample active Management staff account.',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'MGT'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('management.staff@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Finance Technician',
    'finance.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'ACTIVE',
    'Finance Support Technician',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'FIN'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('finance.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'HR Technician',
    'hr.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'ACTIVE',
    'HR Support Technician',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'HR'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('hr.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Operations Technician',
    'ops.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'ACTIVE',
    'Operations Support Technician',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'OPS'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('ops.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Sales Technician',
    'sales.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'ACTIVE',
    'Sales Support Technician',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'SAL'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('sales.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Management Technician',
    'management.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'ACTIVE',
    'Management Support Technician',
    NOW(),
    admin.id
FROM users base
JOIN departments d ON d.code = 'MGT'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('management.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title
)
SELECT
    'Pending User',
    'pending.user@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'PENDING',
    'New Employee'
FROM users base
JOIN departments d ON d.code = 'HR'
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('pending.user@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Suspended Technician',
    'suspended.tech@resolvedesk.local',
    base.password_hash,
    'TECHNICIAN',
    d.id,
    'SUSPENDED',
    'Suspended Support Technician',
    NOW() - INTERVAL '30 days',
    admin.id
FROM users base
JOIN departments d ON d.code = 'OPS'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('suspended.tech@resolvedesk.local')
);

INSERT INTO users (
    full_name, email, password_hash, role,
    department_id, status, job_title,
    approved_at, approved_by
)
SELECT
    'Inactive User',
    'inactive.user@resolvedesk.local',
    base.password_hash,
    'STAFF',
    d.id,
    'INACTIVE',
    'Former Sales Executive',
    NOW() - INTERVAL '90 days',
    admin.id
FROM users base
JOIN departments d ON d.code = 'SAL'
JOIN users admin
    ON LOWER(admin.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(base.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE LOWER(email) = LOWER('inactive.user@resolvedesk.local')
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1001',
    '[SLA BREACHED] Company VPN unavailable',
    'Users cannot connect to the company VPN from external networks.',
    requester.id,
    tech.id,
    d.id,
    c.id,
    s.id,
    'CRITICAL',
    'OPEN',
    'PORTAL',
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '1 hour',
    NULL,
    NULL,
    NULL,
    NULL,
    TRUE,
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours'
FROM users requester
JOIN users tech
    ON LOWER(tech.email) = LOWER('testtech@resolvedesk.local')
JOIN departments d ON d.code = 'IT'
JOIN categories c
    ON LOWER(c.name) = LOWER('Network')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'CRITICAL'
WHERE LOWER(requester.email) = LOWER('it.staff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1001'
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1002',
    '[SLA WARNING] Payroll export failing',
    'Payroll export completes with an unexpected validation error.',
    requester.id,
    tech.id,
    d.id,
    c.id,
    s.id,
    'HIGH',
    'IN_PROGRESS',
    'EMAIL',
    NOW() - INTERVAL '30 minutes',
    NOW() + INTERVAL '20 minutes',
    NOW() - INTERVAL '45 minutes',
    NULL,
    NULL,
    NULL,
    FALSE,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '10 minutes'
FROM users requester
JOIN users tech
    ON LOWER(tech.email) = LOWER('finance.tech@resolvedesk.local')
JOIN departments d ON d.code = 'FIN'
JOIN categories c
    ON LOWER(c.name) = LOWER('Finance Systems')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'HIGH'
WHERE LOWER(requester.email) = LOWER('teststaff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1002'
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1003',
    '[PENDING] New employee account access',
    'New employee requires access to HR systems before onboarding.',
    requester.id,
    tech.id,
    d.id,
    c.id,
    s.id,
    'MEDIUM',
    'PENDING',
    'PHONE',
    NOW() - INTERVAL '5 hours',
    NOW() + INTERVAL '6 hours',
    NOW() - INTERVAL '5 hours 30 minutes',
    NULL,
    NULL,
    NULL,
    FALSE,
    NOW() - INTERVAL '6 hours',
    NOW() - INTERVAL '2 hours'
FROM users requester
JOIN users tech
    ON LOWER(tech.email) = LOWER('hr.tech@resolvedesk.local')
JOIN departments d ON d.code = 'HR'
JOIN categories c
    ON LOWER(c.name) = LOWER('HR Onboarding')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'MEDIUM'
WHERE LOWER(requester.email) = LOWER('hr.staff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1003'
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1004',
    '[RESOLVED] Warehouse scanner disconnected',
    'Warehouse barcode scanner repeatedly disconnected from the workstation.',
    requester.id,
    tech.id,
    d.id,
    c.id,
    s.id,
    'LOW',
    'RESOLVED',
    'PORTAL',
    NOW() - INTERVAL '2 days 20 hours',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days 22 hours',
    NOW() - INTERVAL '2 days 10 hours',
    NULL,
    'Scanner driver reinstalled and device pairing restored.',
    FALSE,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '2 days 10 hours'
FROM users requester
JOIN users tech
    ON LOWER(tech.email) = LOWER('ops.tech@resolvedesk.local')
JOIN departments d ON d.code = 'OPS'
JOIN categories c
    ON LOWER(c.name) = LOWER('Operations Devices')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'LOW'
WHERE LOWER(requester.email) = LOWER('ops.staff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1004'
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1005',
    '[CLOSED] CRM login reset',
    'Sales user was unable to access the customer relationship management portal.',
    requester.id,
    tech.id,
    d.id,
    c.id,
    s.id,
    'MEDIUM',
    'CLOSED',
    'ADMIN',
    NOW() - INTERVAL '4 days 20 hours',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days 22 hours',
    NOW() - INTERVAL '4 days 6 hours',
    NOW() - INTERVAL '3 days',
    'Credentials reset and login confirmed by requester.',
    FALSE,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days'
FROM users requester
JOIN users tech
    ON LOWER(tech.email) = LOWER('sales.tech@resolvedesk.local')
JOIN departments d ON d.code = 'SAL'
JOIN categories c
    ON LOWER(c.name) = LOWER('Sales CRM')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'MEDIUM'
WHERE LOWER(requester.email) = LOWER('sales.staff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1005'
);

INSERT INTO tickets (
    ticket_number, subject, description,
    requester_id, assigned_to,
    department_id, category_id, sla_policy_id,
    priority, status, source,
    first_response_due_at, resolution_due_at,
    first_response_at,
    resolved_at, closed_at,
    resolution_note, sla_breached,
    created_at, updated_at
)
SELECT
    'RD-DEMO-1006',
    '[UNASSIGNED] Executive dashboard access',
    'Management user requires permission to access the executive reporting dashboard.',
    requester.id,
    NULL,
    d.id,
    c.id,
    s.id,
    'HIGH',
    'OPEN',
    'EMAIL',
    NOW() + INTERVAL '30 minutes',
    NOW() + INTERVAL '4 hours',
    NULL,
    NULL,
    NULL,
    NULL,
    FALSE,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
FROM users requester
JOIN departments d ON d.code = 'MGT'
JOIN categories c
    ON LOWER(c.name) = LOWER('Management Access')
    AND c.department_id = d.id
JOIN sla_policies s ON s.priority = 'HIGH'
WHERE LOWER(requester.email) = LOWER('management.staff@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM tickets
    WHERE ticket_number = 'RD-DEMO-1006'
);

INSERT INTO ticket_history (
    ticket_id,
    actor_id,
    action,
    old_value,
    new_value,
    metadata,
    created_at
)
SELECT
    t.id,
    t.requester_id,
    'TICKET_CREATED',
    NULL,
    jsonb_build_object(
        'status', 'OPEN',
        'priority', t.priority
    ),
    '{"sampleData":true}'::jsonb,
    t.created_at
FROM tickets t
WHERE t.ticket_number LIKE 'RD-DEMO-%'
AND NOT EXISTS (
    SELECT 1
    FROM ticket_history h
    WHERE h.ticket_id = t.id
      AND h.action = 'TICKET_CREATED'
      AND h.metadata ->> 'sampleData' = 'true'
);

INSERT INTO ticket_history (
    ticket_id,
    actor_id,
    action,
    old_value,
    new_value,
    metadata,
    created_at
)
SELECT
    t.id,
    t.assigned_to,
    'STATUS_CHANGED',
    '{"status":"OPEN"}'::jsonb,
    jsonb_build_object('status', t.status),
    '{"sampleData":true}'::jsonb,
    t.updated_at
FROM tickets t
WHERE t.ticket_number IN (
    'RD-DEMO-1002',
    'RD-DEMO-1003',
    'RD-DEMO-1004',
    'RD-DEMO-1005'
)
AND NOT EXISTS (
    SELECT 1
    FROM ticket_history h
    WHERE h.ticket_id = t.id
      AND h.action = 'STATUS_CHANGED'
      AND h.metadata ->> 'sampleData' = 'true'
);

INSERT INTO ticket_comments (
    ticket_id,
    user_id,
    body,
    is_internal,
    created_at
)
SELECT
    t.id,
    u.id,
    'Customer confirmed that the problem is still occurring.',
    FALSE,
    NOW() - INTERVAL '40 minutes'
FROM tickets t
JOIN users u
    ON LOWER(u.email) = LOWER('teststaff@resolvedesk.local')
WHERE t.ticket_number = 'RD-DEMO-1002'
AND NOT EXISTS (
    SELECT 1
    FROM ticket_comments c
    WHERE c.ticket_id = t.id
      AND c.body = 'Customer confirmed that the problem is still occurring.'
);

INSERT INTO ticket_comments (
    ticket_id,
    user_id,
    body,
    is_internal,
    created_at
)
SELECT
    t.id,
    u.id,
    'Internal note: checking VPN gateway logs and authentication service.',
    TRUE,
    NOW() - INTERVAL '20 minutes'
FROM tickets t
JOIN users u
    ON LOWER(u.email) = LOWER('testtech@resolvedesk.local')
WHERE t.ticket_number = 'RD-DEMO-1001'
AND NOT EXISTS (
    SELECT 1
    FROM ticket_comments c
    WHERE c.ticket_id = t.id
      AND c.body = 'Internal note: checking VPN gateway logs and authentication service.'
);

INSERT INTO ticket_comments (
    ticket_id,
    user_id,
    body,
    is_internal,
    created_at
)
SELECT
    t.id,
    u.id,
    'Waiting for the employee start date confirmation.',
    FALSE,
    NOW() - INTERVAL '90 minutes'
FROM tickets t
JOIN users u
    ON LOWER(u.email) = LOWER('hr.tech@resolvedesk.local')
WHERE t.ticket_number = 'RD-DEMO-1003'
AND NOT EXISTS (
    SELECT 1
    FROM ticket_comments c
    WHERE c.ticket_id = t.id
      AND c.body = 'Waiting for the employee start date confirmation.'
);

INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    link,
    read_at,
    created_at
)
SELECT
    u.id,
    'SLA_BREACH',
    'Critical ticket breached SLA',
    'RD-DEMO-1001 has exceeded its SLA deadline.',
    '/ticket-detail.html?id=' || t.id,
    NULL,
    NOW() - INTERVAL '15 minutes'
FROM users u
JOIN tickets t ON t.ticket_number = 'RD-DEMO-1001'
WHERE LOWER(u.email) = LOWER('testtech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE title = 'Critical ticket breached SLA'
);

INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    link,
    read_at,
    created_at
)
SELECT
    u.id,
    'SLA_WARNING',
    'SLA deadline approaching',
    'RD-DEMO-1002 is approaching its resolution deadline.',
    '/ticket-detail.html?id=' || t.id,
    NULL,
    NOW() - INTERVAL '5 minutes'
FROM users u
JOIN tickets t ON t.ticket_number = 'RD-DEMO-1002'
WHERE LOWER(u.email) = LOWER('finance.tech@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE title = 'SLA deadline approaching'
);

INSERT INTO notifications (
    user_id,
    type,
    title,
    body,
    link,
    read_at,
    created_at
)
SELECT
    u.id,
    'SYSTEM',
    'Sample notification already read',
    'This notification demonstrates the read state.',
    '/dashboard.html',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '2 hours'
FROM users u
WHERE LOWER(u.email) = LOWER('admin@resolvedesk.local')
AND NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE title = 'Sample notification already read'
);

COMMIT;

SELECT
    'Persistent ResolveDesk sample data inserted successfully.'
    AS message;
