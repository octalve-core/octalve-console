import os
import shutil


def delete_migration_files_starting_with_00(base_directory):
    print("🚀 Starting migration cleanup...\n")
    for dirpath, dirnames, filenames in os.walk(base_directory):
        if "venv" in dirpath.split(os.sep):
            continue

        if os.path.basename(dirpath) == "migrations":
            for filename in filenames:
                if filename in {"__init__.py"} or filename.endswith(".pyc"):
                    continue

                if filename.startswith("00") and filename.endswith(".py"):
                    full_path = os.path.join(dirpath, filename)
                    try:
                        os.chmod(full_path, 0o777)  # Ensure writable
                        os.remove(full_path)
                        print(f"✅ Deleted: {full_path}")
                    except PermissionError:
                        print(f"🔐 Permission denied: {full_path}")
                    except Exception as e:
                        print(f"❌ Error deleting {full_path}: {e}")
    print("\n🎉 Migration cleanup complete.")


def clean_pycaches(base_directory):
    print("\n🧹 Cleaning __pycache__ folders...\n")
    for dirpath, dirnames, _ in os.walk(base_directory):
        if "venv" in dirpath.split(os.sep):
            continue

        if "__pycache__" in dirnames:
            pycache_path = os.path.join(dirpath, "__pycache__")
            try:
                shutil.rmtree(pycache_path)
                print(f"✅ Deleted: {pycache_path}")
            except Exception as e:
                print(f"❌ Error deleting {pycache_path}: {e}")
    print("\n🎯 __pycache__ cleanup complete.")


if __name__ == "__main__":
    root = os.getcwd()
    delete_migration_files_starting_with_00(root)
    clean_pycaches(root)
    print("\n✅ All clean! You can now safely run `makemigrations` and `migrate`.")
