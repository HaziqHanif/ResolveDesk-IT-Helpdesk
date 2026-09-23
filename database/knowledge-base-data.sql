BEGIN;

-- =========================================================
-- FINANCE
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'How to troubleshoot payroll export errors',
    'troubleshoot-payroll-export-errors',
    'Common checks when payroll reports fail to export.',
    E'1. Confirm the payroll period is correct.\n\n2. Check that all required employee records are complete.\n\n3. Retry the export using the approved format.\n\n4. Confirm that the Finance system session has not expired.\n\n5. If the export continues to fail, create a Finance Systems ticket and include the error message.',
    c.id,
    u.id,
    'PUBLISHED',
    143,
    NOW() - INTERVAL '20 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Finance Systems')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'troubleshoot-payroll-export-errors'
);

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'Finance system month-end checklist',
    'finance-month-end-system-checklist',
    'System checks to complete before month-end processing.',
    E'Confirm access to the Finance system.\n\nVerify that scheduled reports are available.\n\nCheck shared Finance folders and permissions.\n\nReport system issues before month-end processing begins.',
    c.id,
    u.id,
    'DRAFT',
    0,
    NULL
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Finance Systems')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'finance-month-end-system-checklist'
);

-- =========================================================
-- HR
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'New employee IT onboarding checklist',
    'new-employee-it-onboarding-checklist',
    'Prepare system access and equipment for a new employee.',
    E'1. Confirm the employee name, department and start date.\n\n2. Request the required company account.\n\n3. Confirm laptop or workstation requirements.\n\n4. Request access to approved systems and shared folders.\n\n5. Complete MFA enrolment after the account is activated.',
    c.id,
    u.id,
    'PUBLISHED',
    126,
    NOW() - INTERVAL '18 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('HR Onboarding')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'new-employee-it-onboarding-checklist'
);

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'Employee offboarding system access',
    'employee-offboarding-system-access',
    'Legacy offboarding checklist retained for reference.',
    E'Disable company account access.\n\nRemove shared drive permissions.\n\nRecover company equipment.\n\nConfirm access removal with Human Resources.',
    c.id,
    u.id,
    'ARCHIVED',
    89,
    NOW() - INTERVAL '120 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('HR Onboarding')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'employee-offboarding-system-access'
);

-- =========================================================
-- OPERATIONS
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'Barcode scanner not responding',
    'barcode-scanner-not-responding',
    'Basic troubleshooting for warehouse barcode scanners.',
    E'1. Disconnect and reconnect the scanner.\n\n2. Confirm the device has power.\n\n3. Restart the workstation.\n\n4. Check whether the scanner appears in the operating system.\n\n5. Test a second USB port if available.\n\n6. Create an Operations Devices ticket if the scanner remains unavailable.',
    c.id,
    u.id,
    'PUBLISHED',
    201,
    NOW() - INTERVAL '15 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Operations Devices')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'barcode-scanner-not-responding'
);

-- =========================================================
-- SALES
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'CRM login troubleshooting',
    'crm-login-troubleshooting',
    'Resolve common problems signing in to the company CRM.',
    E'Confirm the correct company email is being used.\n\nCheck Caps Lock before entering the password.\n\nTry signing in using a private browser window.\n\nComplete MFA if requested.\n\nIf access remains unavailable, create a Sales CRM support ticket.',
    c.id,
    u.id,
    'PUBLISHED',
    174,
    NOW() - INTERVAL '12 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Sales CRM')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'crm-login-troubleshooting'
);

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'CRM customer import guide',
    'crm-customer-import-guide',
    'Draft procedure for importing customer records into CRM.',
    E'Prepare the customer import file using the approved template.\n\nRemove duplicate records.\n\nValidate required fields before importing.\n\nDo not import confidential data that is not required.',
    c.id,
    u.id,
    'DRAFT',
    0,
    NULL
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Sales CRM')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'crm-customer-import-guide'
);

-- =========================================================
-- MANAGEMENT
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'Request access to executive dashboards',
    'request-access-executive-dashboards',
    'Guidance for requesting access to management reporting dashboards.',
    E'1. Confirm which dashboard is required.\n\n2. Confirm the business reason for access.\n\n3. Obtain approval from the relevant owner if required.\n\n4. Create a Management Access ticket.\n\n5. IT will verify the request before access is granted.',
    c.id,
    u.id,
    'PUBLISHED',
    98,
    NOW() - INTERVAL '10 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Management Access')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'request-access-executive-dashboards'
);

-- =========================================================
-- EXTRA IT ARTICLES
-- =========================================================

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'Laptop battery drains quickly',
    'laptop-battery-drains-quickly',
    'Steps to investigate unusually fast laptop battery drain.',
    E'Restart the laptop.\n\nClose unused applications.\n\nCheck battery usage in system settings.\n\nReduce screen brightness temporarily.\n\nDisconnect unused external devices.\n\nCreate a Hardware ticket if battery health appears degraded.',
    c.id,
    u.id,
    'PUBLISHED',
    132,
    NOW() - INTERVAL '8 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Hardware')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'laptop-battery-drains-quickly'
);

INSERT INTO knowledge_base (
    title, slug, summary, content,
    category_id, author_id,
    status, views, published_at
)
SELECT
    'What to do after clicking a phishing link',
    'what-to-do-after-clicking-phishing-link',
    'Immediate actions after interacting with a suspicious link.',
    E'Disconnect from the suspicious website immediately.\n\nDo not enter additional information.\n\nIf credentials were entered, change the password using the approved company process.\n\nNotify IT Security immediately.\n\nCreate a Critical Security ticket and describe what happened.\n\nDo not delete the suspicious message until IT has reviewed it.',
    c.id,
    u.id,
    'PUBLISHED',
    319,
    NOW() - INTERVAL '5 days'
FROM categories c
JOIN users u
    ON LOWER(u.email) = LOWER('admin@resolvedesk.local')
WHERE LOWER(c.name) = LOWER('Security')
AND NOT EXISTS (
    SELECT 1
    FROM knowledge_base
    WHERE slug = 'what-to-do-after-clicking-phishing-link'
);

COMMIT;

SELECT
    'ResolveDesk Knowledge Base sample data inserted.'
    AS message;
