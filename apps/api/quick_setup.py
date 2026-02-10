#!/usr/bin/env python3
"""
Quick setup script to create organization and add user.
Runs directly without module imports.
"""
import os
import sys

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

import asyncio
import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

# Get DATABASE_URL from environment (use psycopg2 driver)
DATABASE_URL = os.getenv('DATABASE_URL_SYNC', 'postgresql+psycopg2://postgres.ieubksumlsvsdsvqbalh:Malinva2026+@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require')

def main():
    print("Connecting to database...")
    engine = create_engine(DATABASE_URL, poolclass=NullPool)

    with engine.connect() as conn:
        print("Creating organization and membership...")

        # Run the SQL
        result = conn.execute(text("""
            DO $$
            DECLARE
                v_user_id UUID;
                v_org_id UUID;
                v_role_id UUID;
            BEGIN
                -- Get user
                SELECT id INTO v_user_id FROM users WHERE email = 'admin@example.com';

                IF v_user_id IS NULL THEN
                    RAISE EXCEPTION 'User admin@example.com not found!';
                END IF;

                -- Create org (or get existing)
                INSERT INTO organizations (id, name, slug, timezone, created_at, updated_at)
                VALUES (gen_random_uuid(), 'Test Shelter', 'test-shelter', 'Europe/Prague', NOW(), NOW())
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id INTO v_org_id;

                -- Create admin role (or get existing)
                SELECT id INTO v_role_id FROM roles
                WHERE organization_id = v_org_id AND name = 'admin';

                IF v_role_id IS NULL THEN
                    INSERT INTO roles (id, organization_id, name, description, is_template, created_at, updated_at)
                    VALUES (gen_random_uuid(), v_org_id, 'admin', 'Administrator', false, NOW(), NOW())
                    RETURNING id INTO v_role_id;
                END IF;

                -- Add membership (only if doesn't exist)
                IF NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = v_user_id AND organization_id = v_org_id) THEN
                    INSERT INTO memberships (id, user_id, organization_id, role_id, status, created_at, updated_at)
                    VALUES (gen_random_uuid(), v_user_id, v_org_id, v_role_id, 'ACTIVE', NOW(), NOW());
                END IF;

                RAISE NOTICE 'Success! User % added to org %', v_user_id, v_org_id;
            END $$;
        """))

        conn.commit()

        # Verify
        result = conn.execute(text("""
            SELECT u.email, o.name as org_name, r.name as role_name
            FROM memberships m
            JOIN users u ON m.user_id = u.id
            JOIN organizations o ON m.organization_id = o.id
            JOIN roles r ON m.role_id = r.id
            WHERE u.email = 'admin@example.com'
        """))

        row = result.fetchone()
        if row:
            print(f"\nSUCCESS!")
            print(f"   User: {row[0]}")
            print(f"   Organization: {row[1]}")
            print(f"   Role: {row[2]}")
            print("\nYou can now login and select the organization!")
        else:
            print("\nERROR: Membership not created")

    engine.dispose()

if __name__ == '__main__':
    main()
