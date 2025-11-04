"""
Script to migrate external_id values in staff_users table 
to match new Keycloak instance user IDs.

Requirements:
    pip install python-keycloak psycopg2-binary

Usage:    
    # Dry run (no changes made)
    python migrate_keycloak_external_ids.py
    # Execute migration (make changes)
    python migrate_keycloak_external_ids.py --execute
"""

import os
from keycloak import KeycloakAdmin
import psycopg2
from psycopg2.extras import RealDictCursor

# Keycloak Configuration
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "https://dev.loginproxy.gov.bc.ca/auth/")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "eao-epic")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "engage-admin")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET")

# Database Configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_SEARCH_PATH = os.getenv("DB_SEARCH_PATH", "met")


def get_keycloak_admin():
    """Initialize Keycloak admin connection."""
    if not KEYCLOAK_CLIENT_SECRET:
        raise ValueError("KEYCLOAK_CLIENT_SECRET environment variable is required")
    
    return KeycloakAdmin(
        server_url=KEYCLOAK_URL,
        realm_name=KEYCLOAK_REALM,
        client_id=KEYCLOAK_CLIENT_ID,
        client_secret_key=KEYCLOAK_CLIENT_SECRET,
        verify=True
    )


def get_db_connection():
    """Create database connection."""
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    
    # Set search path
    cursor = conn.cursor()
    cursor.execute(f"SET search_path TO {DB_SEARCH_PATH}")
    cursor.close()
    
    return conn


def migrate_external_ids(dry_run=True):
    """
    Migrate external_id values from old Keycloak to new Keycloak.
    
    Args:
        dry_run: If True, only print changes without updating database
    """
    print(f"{'DRY RUN - ' if dry_run else ''}Starting migration...")
    print(f"Keycloak: {KEYCLOAK_URL}realms/{KEYCLOAK_REALM}")
    print(f"Database: {DB_HOST}:{DB_PORT}/{DB_NAME}\n")
    
    # Connect to Keycloak
    print("Connecting to Keycloak...")
    try:
        keycloak_admin = get_keycloak_admin()
    except Exception as e:
        print(f"Failed to connect to Keycloak: {e}")
        print("\nTroubleshooting tips:")
        print("  1. Make sure KEYCLOAK_CLIENT_SECRET is set correctly")
        print("  2. Verify the client has 'Service Accounts Enabled'")
        print("  3. Check that service account has view-users role")
        raise
    
    # Get all users from Keycloak
    print("Fetching users from Keycloak...")
    try:
        keycloak_users = keycloak_admin.get_users({})
    except Exception as e:
        print(f"Failed to fetch users: {e}")
        print("\nThe service account client needs these roles:")
        print("  - Go to Clients → engage-admin → Service Account Roles")
        print("  - Add role: view-users, query-users")
        raise
    
    print(f"Found {len(keycloak_users)} users in Keycloak\n")
    
    # Create username -> id mapping
    keycloak_map = {user['username']: user['id'] for user in keycloak_users}
    
    # Connect to database
    print("Connecting to database...")
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Get all staff users
    cursor.execute("SELECT id, username, external_id, first_name, last_name FROM staff_users ORDER BY username")
    db_users = cursor.fetchall()
    print(f"Found {len(db_users)} users in database\n")
    
    # Track statistics
    matched = 0
    not_found = 0
    already_correct = 0
    to_update = []
    
    print("Analyzing users...")
    print("-" * 80)
    
    for db_user in db_users:
        username = db_user['username']
        old_external_id = db_user['external_id']
        
        if username in keycloak_map:
            new_external_id = keycloak_map[username]
            
            if old_external_id == new_external_id:
                already_correct += 1
                print(f"✓ {username}: Already correct")
            else:
                matched += 1
                to_update.append((new_external_id, db_user['id'], username))
                print(f"→ {username}")
                print(f"  Old: {old_external_id}")
                print(f"  New: {new_external_id}")
        else:
            not_found += 1
            print(f"{username} - {db_user['first_name']} {db_user['last_name']}: NOT FOUND in Keycloak")

    print("-" * 80)
    print(f"\nSummary:")
    print(f"  Already correct: {already_correct}")
    print(f"  To update: {matched}")
    print(f"  Not found in Keycloak: {not_found}")
    print(f"  Total: {len(db_users)}")
    
    # Perform updates
    if to_update:
        if dry_run:
            print(f"\n[DRY RUN] Would update {len(to_update)} users")
        else:
            print(f"\nUpdating {len(to_update)} users...")
            update_query = """
                UPDATE staff_users 
                SET external_id = %s, updated_date = NOW()
                WHERE id = %s
            """
            
            for new_id, user_id, username in to_update:
                cursor.execute(update_query, (new_id, user_id))
                print(f"  Updated: {username}")
            
            conn.commit()
            print(f"\nSuccessfully updated {len(to_update)} users")
    else:
        print("\nNo updates needed!")
    
    # Cleanup
    cursor.close()
    conn.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    import sys
    
    # Check if --execute flag is provided
    dry_run = "--execute" not in sys.argv
    
    if dry_run:
        print("=" * 80)
        print("DRY RUN MODE - No changes will be made")
        print("Run with --execute flag to perform actual updates")
        print("=" * 80)
        print()
    
    try:
        migrate_external_ids(dry_run=dry_run)
    except Exception as e:
        print(f"\n Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)