/* =========================================================
   RESOLVEDESK DATABASE SEED
   PostgreSQL
========================================================= */

BEGIN;


/* =========================================================
   DEPARTMENTS
========================================================= */

INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Information Technology',
    'IT',
    'Technology infrastructure, applications, security and technical support.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Information Technology')
);


INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Finance',
    'FIN',
    'Finance, accounting and financial operations.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Finance')
);


INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Human Resources',
    'HR',
    'Employee administration and human resource operations.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Human Resources')
);


INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Operations',
    'OPS',
    'Business operations and internal operational support.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Operations')
);


INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Sales',
    'SAL',
    'Sales operations and customer-facing commercial activities.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Sales')
);


INSERT INTO departments (
    name,
    code,
    description
)
SELECT
    'Management',
    'MGT',
    'Management and executive business operations.'
WHERE NOT EXISTS (
    SELECT 1
    FROM departments
    WHERE LOWER(name) =
        LOWER('Management')
);


/* =========================================================
   CATEGORIES
========================================================= */

INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Network',
    'VPN, WiFi, internet, LAN and connectivity issues.',
    'MEDIUM',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Network')
);


INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Software',
    'Application errors, installation and software troubleshooting.',
    'MEDIUM',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Software')
);


INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Hardware',
    'Laptop, desktop, printer, monitor and peripheral issues.',
    'MEDIUM',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Hardware')
);


INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Access',
    'Account, password, permission and system access issues.',
    'HIGH',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Access')
);


INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Email',
    'Email, Outlook and mailbox related issues.',
    'MEDIUM',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Email')
);


INSERT INTO categories (
    name,
    description,
    default_priority,
    department_id
)
SELECT
    'Security',
    'Phishing, malware, suspicious activity and security incidents.',
    'HIGH',
    (
        SELECT id
        FROM departments
        WHERE code = 'IT'
        LIMIT 1
    )
WHERE NOT EXISTS (
    SELECT 1
    FROM categories
    WHERE LOWER(name) =
        LOWER('Security')
);


/* =========================================================
   SLA POLICIES

   Critical:
   Response 15 minutes
   Resolution 1 hour

   High:
   Response 30 minutes
   Resolution 4 hours

   Medium:
   Response 2 hours
   Resolution 8 hours

   Low:
   Response 4 hours
   Resolution 24 hours
========================================================= */

INSERT INTO sla_policies (
    name,
    priority,
    first_response_minutes,
    resolution_minutes,
    warning_threshold_minutes,
    business_hours_only,
    is_active
)
VALUES (
    'Critical Priority SLA',
    'CRITICAL',
    15,
    60,
    30,
    TRUE,
    TRUE
)
ON CONFLICT (priority)
DO UPDATE SET
    name = EXCLUDED.name,
    first_response_minutes =
        EXCLUDED.first_response_minutes,
    resolution_minutes =
        EXCLUDED.resolution_minutes,
    warning_threshold_minutes =
        EXCLUDED.warning_threshold_minutes,
    business_hours_only =
        EXCLUDED.business_hours_only,
    is_active =
        EXCLUDED.is_active;


INSERT INTO sla_policies (
    name,
    priority,
    first_response_minutes,
    resolution_minutes,
    warning_threshold_minutes,
    business_hours_only,
    is_active
)
VALUES (
    'High Priority SLA',
    'HIGH',
    30,
    240,
    60,
    TRUE,
    TRUE
)
ON CONFLICT (priority)
DO UPDATE SET
    name = EXCLUDED.name,
    first_response_minutes =
        EXCLUDED.first_response_minutes,
    resolution_minutes =
        EXCLUDED.resolution_minutes,
    warning_threshold_minutes =
        EXCLUDED.warning_threshold_minutes,
    business_hours_only =
        EXCLUDED.business_hours_only,
    is_active =
        EXCLUDED.is_active;


INSERT INTO sla_policies (
    name,
    priority,
    first_response_minutes,
    resolution_minutes,
    warning_threshold_minutes,
    business_hours_only,
    is_active
)
VALUES (
    'Medium Priority SLA',
    'MEDIUM',
    120,
    480,
    120,
    TRUE,
    TRUE
)
ON CONFLICT (priority)
DO UPDATE SET
    name = EXCLUDED.name,
    first_response_minutes =
        EXCLUDED.first_response_minutes,
    resolution_minutes =
        EXCLUDED.resolution_minutes,
    warning_threshold_minutes =
        EXCLUDED.warning_threshold_minutes,
    business_hours_only =
        EXCLUDED.business_hours_only,
    is_active =
        EXCLUDED.is_active;


INSERT INTO sla_policies (
    name,
    priority,
    first_response_minutes,
    resolution_minutes,
    warning_threshold_minutes,
    business_hours_only,
    is_active
)
VALUES (
    'Low Priority SLA',
    'LOW',
    240,
    1440,
    240,
    TRUE,
    TRUE
)
ON CONFLICT (priority)
DO UPDATE SET
    name = EXCLUDED.name,
    first_response_minutes =
        EXCLUDED.first_response_minutes,
    resolution_minutes =
        EXCLUDED.resolution_minutes,
    warning_threshold_minutes =
        EXCLUDED.warning_threshold_minutes,
    business_hours_only =
        EXCLUDED.business_hours_only,
    is_active =
        EXCLUDED.is_active;


/* =========================================================
   APPLICATION SETTINGS
========================================================= */

INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'organization',
    '{
        "name": "ResolveDesk Demo Organization",
        "helpDeskName": "ResolveDesk IT Support",
        "supportEmail": "support@resolvedesk.local",
        "timezone": "Asia/Kuala_Lumpur"
    }'::JSONB,
    'General organization settings.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'business_hours',
    '{
        "workingDays": [
            "MONDAY",
            "TUESDAY",
            "WEDNESDAY",
            "THURSDAY",
            "FRIDAY"
        ],
        "startTime": "08:00",
        "endTime": "17:00",
        "pauseSlaOutsideHours": true
    }'::JSONB,
    'Service desk business hours.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'ticket_settings',
    '{
        "prefix": "RD",
        "startingNumber": 1000,
        "defaultPriority": "MEDIUM",
        "autoAssignment": true,
        "allowReopen": true,
        "requireResolutionNote": true,
        "autoClose": true,
        "autoCloseDays": 3,
        "attachmentLimitMb": 10,
        "maximumAttachments": 5
    }'::JSONB,
    'Ticket workflow configuration.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'registration_settings',
    '{
        "registrationEnabled": true,
        "requireAdminApproval": true,
        "defaultRole": "STAFF"
    }'::JSONB,
    'Staff account registration settings.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'notification_settings',
    '{
        "newTicket": true,
        "assignment": true,
        "publicReply": true,
        "slaWarning": true,
        "resolved": true
    }'::JSONB,
    'Default notification configuration.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'security_settings',
    '{
        "minimumPasswordLength": 10,
        "requireUppercase": true,
        "requireNumber": true,
        "requireSpecialCharacter": true,
        "sessionTimeoutMinutes": 60,
        "lockRepeatedFailedLogins": true,
        "auditAdminChanges": true
    }'::JSONB,
    'ResolveDesk account and session security settings.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


INSERT INTO app_settings (
    setting_key,
    setting_value,
    description
)
VALUES (
    'system_settings',
    '{
        "maintenanceMode": false,
        "knowledgeBaseSuggestions": true,
        "slaEscalation": true,
        "autoSlaBreach": true
    }'::JSONB,
    'General ResolveDesk behaviour.'
)
ON CONFLICT (setting_key)
DO UPDATE SET
    setting_value =
        EXCLUDED.setting_value,
    description =
        EXCLUDED.description;


/* =========================================================
   KNOWLEDGE BASE ARTICLES
   author_id is NULL until real users exist.
========================================================= */

INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'How to reconnect to corporate VPN',
    'how-to-reconnect-corporate-vpn',
    'Troubleshoot common VPN connectivity problems.',
    $$1. Confirm that your internet connection is working.

2. Disconnect the existing VPN session.

3. Restart the VPN client.

4. Confirm that the correct company VPN profile is selected.

5. Sign in again and complete MFA if required.

6. Restart the device if the problem continues.

If the VPN still fails, create a Network support ticket and include the error message shown on screen.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Network')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    468,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Reset a locked staff account',
    'reset-a-locked-staff-account',
    'Common steps when a staff account becomes locked.',
    $$Confirm that the correct company email address is being used.

Check Caps Lock and keyboard layout before entering the password again.

Avoid repeated password attempts if the account is already locked.

If access remains unavailable, create an Access support ticket so IT can verify the account securely.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Access')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    382,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Microsoft 365 activation troubleshooting',
    'microsoft-365-activation-troubleshooting',
    'Resolve common Microsoft 365 licence activation issues.',
    $$Close all Microsoft Office applications.

Open Word or Excel again.

Sign out of the Microsoft account.

Restart the application.

Sign back in using the company account.

Confirm that the device date and time are correct.

If Microsoft 365 remains inactive, submit a Software support ticket.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Software')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    334,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Office WiFi keeps disconnecting',
    'office-wifi-keeps-disconnecting',
    'Basic checks for unstable office wireless connections.',
    $$Turn WiFi off and on again.

Forget the office wireless network and reconnect using the approved credentials.

Restart the device.

Move closer to an office access point if possible.

Check whether other users in the same area are experiencing the same problem.

If multiple users are affected, create a Network support ticket.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Network')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    292,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Outlook is not receiving new email',
    'outlook-not-receiving-new-email',
    'Check Outlook connectivity and mailbox synchronisation.',
    $$Confirm that the internet connection is working.

Make sure Outlook is not set to Work Offline.

Use Send / Receive.

Restart Outlook.

Try opening the mailbox through Outlook Web.

If Outlook Web works but the desktop application does not, create an Email support ticket.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Email')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    281,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Printer jobs stuck in queue',
    'printer-jobs-stuck-in-queue',
    'Clear blocked jobs and restore office printing.',
    $$Confirm that the correct printer is selected.

Cancel old print jobs.

Restart the printer.

Check the network or USB connection.

Try printing a test page.

If multiple staff members are affected, submit a Hardware support ticket and include the printer location.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Hardware')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    247,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Enable multi-factor authentication',
    'enable-multi-factor-authentication',
    'Improve account security with MFA.',
    $$Open the approved company authentication portal.

Open the security settings for your account.

Choose the option to add a new authentication method.

Use the approved authenticator application.

Complete the verification challenge.

Do not share MFA codes with anyone, including people claiming to be IT support.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Security')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    218,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Laptop does not detect external monitor',
    'laptop-does-not-detect-external-monitor',
    'Troubleshoot external display detection.',
    $$Confirm that the monitor has power.

Check the HDMI, DisplayPort or USB-C cable.

Disconnect and reconnect the display cable.

Restart the laptop.

Use the operating system display settings to detect connected displays.

If the monitor is still unavailable, submit a Hardware support ticket.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Hardware')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    176,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Request access to a shared drive',
    'request-access-to-shared-drive',
    'Guidance for requesting shared drive permissions.',
    $$Confirm the shared drive or folder name.

Confirm the level of access required.

Make sure your manager or department owner has approved the request if necessary.

Create an Access support ticket with the folder path and required permission level.

IT will review the request before granting access.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Access')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    165,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


INSERT INTO knowledge_base (
    title,
    slug,
    summary,
    content,
    category_id,
    author_id,
    status,
    views,
    published_at
)
VALUES (
    'Recognising suspicious phishing email',
    'recognising-suspicious-phishing-email',
    'Identify and respond safely to suspicious messages.',
    $$Do not click suspicious links.

Do not open unexpected attachments.

Check the sender email address carefully.

Never provide a password or MFA code through email.

Use the approved company phishing reporting process.

If you already clicked the link or entered credentials, create a Critical Security ticket immediately.$$,
    (
        SELECT id
        FROM categories
        WHERE LOWER(name) =
            LOWER('Security')
        LIMIT 1
    ),
    NULL,
    'PUBLISHED',
    154,
    NOW()
)
ON CONFLICT (slug)
DO NOTHING;


/* =========================================================
   COMPLETE
========================================================= */

COMMIT;


SELECT
    'ResolveDesk seed data inserted successfully.'
    AS message;