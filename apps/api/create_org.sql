-- Create test organization and add user as admin

-- 1. Create organization
INSERT INTO organizations (id, name, slug, email, phone, address, country, timezone, default_locale, is_active, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'Test Shelter',
    'test-shelter',
    'info@test-shelter.cz',
    '+420123456789',
    'Test Street 123, Prague',
    'CZ',
    'Europe/Prague',
    'cs',
    true,
    NOW(),
    NOW()
)
ON CONFLICT DO NOTHING
RETURNING id;

-- Save the org ID (you'll need to replace ORG_ID_HERE below with actual UUID from above)

-- 2. Create admin role for this organization (copy from template)
WITH admin_template AS (
    SELECT id, name, description FROM roles WHERE name = 'admin' AND is_template = true LIMIT 1
),
new_org AS (
    SELECT id FROM organizations WHERE slug = 'test-shelter' LIMIT 1
),
new_role AS (
    INSERT INTO roles (id, organization_id, name, description, is_template, created_at, updated_at)
    SELECT
        gen_random_uuid(),
        new_org.id,
        admin_template.name,
        'Administrator role for Test Shelter',
        false,
        NOW(),
        NOW()
    FROM admin_template, new_org
    ON CONFLICT DO NOTHING
    RETURNING id, organization_id
)
SELECT id as role_id, organization_id FROM new_role;

-- 3. Copy permissions from admin template to org role
WITH admin_template AS (
    SELECT id FROM roles WHERE name = 'admin' AND is_template = true LIMIT 1
),
org_role AS (
    SELECT r.id
    FROM roles r
    JOIN organizations o ON r.organization_id = o.id
    WHERE o.slug = 'test-shelter' AND r.name = 'admin'
    LIMIT 1
)
INSERT INTO role_permissions (role_id, permission_id, allowed, created_at, updated_at)
SELECT
    org_role.id,
    rp.permission_id,
    rp.allowed,
    NOW(),
    NOW()
FROM role_permissions rp
CROSS JOIN org_role
CROSS JOIN admin_template
WHERE rp.role_id = admin_template.id
ON CONFLICT DO NOTHING;

-- 4. Add user to organization
WITH user_info AS (
    SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1
),
org_info AS (
    SELECT id FROM organizations WHERE slug = 'test-shelter' LIMIT 1
),
role_info AS (
    SELECT r.id
    FROM roles r
    JOIN organizations o ON r.organization_id = o.id
    WHERE o.slug = 'test-shelter' AND r.name = 'admin'
    LIMIT 1
)
INSERT INTO memberships (id, user_id, organization_id, role_id, status, created_at, updated_at)
SELECT
    gen_random_uuid(),
    user_info.id,
    org_info.id,
    role_info.id,
    'active',
    NOW(),
    NOW()
FROM user_info, org_info, role_info
ON CONFLICT DO NOTHING
RETURNING id;

-- Verify
SELECT
    u.email,
    o.name as organization,
    r.name as role,
    m.status
FROM memberships m
JOIN users u ON m.user_id = u.id
JOIN organizations o ON m.organization_id = o.id
JOIN roles r ON m.role_id = r.id
WHERE u.email = 'admin@example.com';
