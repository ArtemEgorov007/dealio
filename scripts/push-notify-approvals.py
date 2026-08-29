#!/usr/bin/env python3
"""Poll approvals queue and send Web Push for new rows (cron every 1 min on staging)."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHP = os.environ.get('ERP_PHP_BIN', 'php')


def main() -> int:
    runner = ROOT / 'scripts' / 'push-notify-approvals.php'
    if not runner.is_file():
        print(f'Missing {runner}', file=sys.stderr)
        return 2

    env = os.environ.copy()
    env.setdefault('ERP_API_SRC', str(ROOT / 'public' / 'api' / 'src'))
    env.setdefault('ERP_MIGRATIONS_DIR', str(ROOT / 'public' / 'api' / 'migrations'))

    result = subprocess.run([PHP, str(runner)], env=env, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0:
        if result.stderr.strip():
            print(result.stderr.strip(), file=sys.stderr)
        return result.returncode

    try:
        summary = json.loads(result.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError):
        return 0

    print(
        'push-notify:',
        f"users={summary.get('users', 0)}",
        f"sent={summary.get('notifications', 0)}",
        f"failed={summary.get('failed', 0)}",
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
