import subprocess
import sys


def main():
    print("Running Alembic migrations on Railway...")
    try:
        result = subprocess.run(
            ["railway", "run", "alembic", "upgrade", "head"],
            cwd="apps/api",
            capture_output=True,
            text=True,
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return result.returncode
    except FileNotFoundError:
        print("Error: railway CLI not found. Please install it first:", file=sys.stderr)
        print("  npm install -g @railway/cli", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
