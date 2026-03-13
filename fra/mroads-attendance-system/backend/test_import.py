#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')

try:
    from main import app
    print('✅ Backend imported successfully - no face recognition dependency errors!')
    print('\n📋 Available endpoints:')
    for route in app.routes:
        print(f'  - {route.path} [{", ".join(route.methods if hasattr(route, "methods") else [])}]')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
