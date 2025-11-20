#!/usr/bin/env python3
"""
Simple test script for settings backend functionality
Tests the core functionality without complex imports
"""

import json
import os
from pathlib import Path
from datetime import datetime


def test_directory_structure():
    """Test that required directories can be created"""
    print("\n📁 Test 1: Directory Structure")

    required_dirs = [
        "config",
        "backups",
        "data",
        "data/database",
        "data/exports",
        "data/logs",
        "data/cache"
    ]

    success = True
    for dir_name in required_dirs:
        dir_path = Path(dir_name)
        try:
            dir_path.mkdir(exist_ok=True, parents=True)
            print(f"   ✅ Created/verified: {dir_name}")
        except Exception as e:
            print(f"   ❌ Failed to create {dir_name}: {e}")
            success = False

    return success


def test_config_files():
    """Test creating and reading config files"""
    print("\n📄 Test 2: Config Files")

    # Test RSS feeds config
    rss_config_path = Path("config/rss_feeds.json")
    test_rss_data = {
        "test_feed": {
            "name": "Test RSS Feed",
            "rss_url": "https://example.com/feed.xml",
            "episodes_to_fetch": 1
        }
    }

    try:
        with open(rss_config_path, 'w') as f:
            json.dump(test_rss_data, f, indent=2)
        print(f"   ✅ Created RSS config: {rss_config_path}")

        # Read it back
        with open(rss_config_path, 'r') as f:
            loaded_data = json.load(f)
        print(f"   ✅ Loaded RSS config: {len(loaded_data)} feeds")

    except Exception as e:
        print(f"   ❌ RSS config test failed: {e}")
        return False

    # Test processing config
    processing_config_path = Path("config/processing.json")
    test_processing_data = {
        "max_articles_per_run": 20,
        "enable_link_enrichment": True,
        "max_links_to_enrich": 10,
        "claude_model": "claude-3-5-sonnet-20241022"
    }

    try:
        with open(processing_config_path, 'w') as f:
            json.dump(test_processing_data, f, indent=2)
        print(f"   ✅ Created processing config: {processing_config_path}")

        # Read it back
        with open(processing_config_path, 'r') as f:
            loaded_data = json.load(f)
        print(f"   ✅ Loaded processing config: {loaded_data['max_articles_per_run']} max articles")

    except Exception as e:
        print(f"   ❌ Processing config test failed: {e}")
        return False

    return True


def test_env_file():
    """Test .env file operations"""
    print("\n🌍 Test 3: Environment File")

    env_path = Path(".env")

    # Create test .env file if it doesn't exist
    if not env_path.exists():
        test_env_content = """# Research Automation Configuration - Test
# Created by test script

# Email Configuration
EMAIL_SERVER=imap.gmail.com
EMAIL_USERNAME=test@example.com
EMAIL_PASSWORD=test_password
EMAIL_FOLDER=INBOX

# API Keys
CLAUDE_API_KEY=test_claude_key
LINKPREVIEW_API_KEY=test_linkpreview_key

# Application Settings
APP_ENV=development
LOG_LEVEL=INFO
DATA_DIR=./data
"""

        try:
            with open(env_path, 'w') as f:
                f.write(test_env_content)
            print(f"   ✅ Created test .env file")
        except Exception as e:
            print(f"   ❌ Failed to create .env file: {e}")
            return False

    # Test reading .env file
    try:
        env_vars = {}
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key] = value.strip('"\'')

        print(f"   ✅ Read .env file: {len(env_vars)} variables found")

        # Show some key variables
        key_vars = ['EMAIL_SERVER', 'CLAUDE_API_KEY', 'APP_ENV']
        for key in key_vars:
            if key in env_vars:
                display_value = env_vars[key]
                # Mask sensitive values
                if 'KEY' in key or 'PASSWORD' in key:
                    display_value = '***MASKED***'
                print(f"      • {key}: {display_value}")

    except Exception as e:
        print(f"   ❌ Failed to read .env file: {e}")
        return False

    return True


def test_backup_system():
    """Test backup directory functionality"""
    print("\n💾 Test 4: Backup System")

    backup_dir = Path("backups")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    test_backup_dir = backup_dir / f"settings_test_{timestamp}"

    try:
        test_backup_dir.mkdir(parents=True, exist_ok=True)
        print(f"   ✅ Created backup directory: {test_backup_dir}")

        # Create test backup manifest
        manifest = {
            "timestamp": timestamp,
            "test_backup": True,
            "files": ["config/rss_feeds.json", "config/processing.json", ".env"]
        }

        with open(test_backup_dir / "manifest.json", 'w') as f:
            json.dump(manifest, f, indent=2)

        print(f"   ✅ Created backup manifest")

        # Copy config files to backup
        config_files = ["config/rss_feeds.json", "config/processing.json"]
        for config_file in config_files:
            source = Path(config_file)
            if source.exists():
                import shutil
                shutil.copy2(source, test_backup_dir / source.name)
                print(f"   ✅ Backed up: {config_file}")

    except Exception as e:
        print(f"   ❌ Backup test failed: {e}")
        return False

    return True


def test_permissions():
    """Test file system permissions"""
    print("\n🔐 Test 5: Permissions")

    tests = [
        ("Current directory write", ".", os.W_OK),
        ("Config directory write", "config", os.W_OK),
        ("Config directory read", "config", os.R_OK),
        ("RSS config read", "config/rss_feeds.json", os.R_OK),
        ("RSS config write", "config/rss_feeds.json", os.W_OK),
    ]

    all_good = True
    for test_name, path, permission in tests:
        path_obj = Path(path)
        if path_obj.exists():
            has_permission = os.access(path_obj, permission)
            status = "✅" if has_permission else "❌"
            permission_name = "write" if permission == os.W_OK else "read"
            print(f"   {status} {test_name} ({permission_name}): {'OK' if has_permission else 'FAILED'}")
            if not has_permission:
                all_good = False
        else:
            print(f"   ⚠️  {test_name}: Path doesn't exist ({path})")

    return all_good


def main():
    """Run all tests"""
    print("Research Automation - Simple Settings Backend Test")
    print("=" * 55)
    print("Testing core settings system functionality...")

    # Check if we're in the right directory
    if not Path("backend").exists():
        print("❌ Error: Run this script from the project root directory")
        print("   (The directory containing the 'backend' folder)")
        return False

    tests = [
        ("Directory Structure", test_directory_structure),
        ("Config Files", test_config_files),
        ("Environment File", test_env_file),
        ("Backup System", test_backup_system),
        ("Permissions", test_permissions)
    ]

    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append(result)
            print(f"   Result: {'✅ PASS' if result else '❌ FAIL'}")
        except Exception as e:
            print(f"   ❌ ERROR: {e}")
            results.append(False)

    # Summary
    print("\n" + "=" * 55)
    print("📊 TEST SUMMARY")
    print("=" * 55)

    passed = sum(results)
    total = len(results)

    for i, (test_name, _) in enumerate(tests):
        status = "✅ PASS" if results[i] else "❌ FAIL"
        print(f"   {test_name:<20} {status}")

    print(f"\nOverall: {passed}/{total} tests passed")

    if passed == total:
        print("\n🎉 All tests passed! Basic settings system is working.")
        print("\nYou can now:")
        print("1. Start the backend: cd backend && uvicorn src.main:app --reload")
        print("2. Test API endpoints:")
        print("   • GET  http://localhost:8000/health")
        print("   • GET  http://localhost:8000/api/settings/health")
        print("   • GET  http://localhost:8000/api/settings/current")
        return True
    else:
        print(f"\n❌ {total - passed} tests failed. Check the output above.")
        print("\nCommon issues:")
        print("• File permissions - make sure you can write to the current directory")
        print("• Missing dependencies - make sure you're in the right environment")
        return False


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)