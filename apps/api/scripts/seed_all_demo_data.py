"""
Seed all demo data for screenshots/testing.

This script seeds:
1. Document templates (annual_intake_report, annual_food_consumption, website_listing_report)
2. Food inventory items
3. Feeding plans and completed tasks

Usage:
  cd apps/api
  python scripts/seed_all_demo_data.py          # local
  railway run python scripts/seed_all_demo_data.py  # Railway
"""

import asyncio
import subprocess
import sys
import os

# Change to apps/api directory
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def main():
    print("=" * 60)
    print("SEEDING ALL DEMO DATA")
    print("=" * 60)

    scripts = [
        ("Document Templates", [
            "scripts/seed_annual_intake_report_template.py",
            "scripts/seed_annual_food_consumption_template.py",
            "scripts/seed_website_listing_report_template.py",
        ]),
        ("Feeding Data", [
            "scripts/seed_feeding_data.py",
        ]),
    ]

    for category, script_list in scripts:
        print(f"\n{'='*60}")
        print(f"  {category}")
        print(f"{'='*60}")

        for script in script_list:
            print(f"\n>>> Running: {script}")
            result = subprocess.run([sys.executable, script], capture_output=False)
            if result.returncode != 0:
                print(f"  WARNING: {script} returned non-zero exit code")

    print("\n" + "=" * 60)
    print("ALL DONE!")
    print("=" * 60)
    print("\nYou can now check:")
    print("- /dashboard/reports → Document templates + Feeding consumption")
    print("- /dashboard/feeding/plans → Feeding plans")
    print("- /dashboard/animals/[id] → Feeding tab → Consumption history")


if __name__ == "__main__":
    asyncio.run(main())
