#!/usr/bin/env python3
"""Generate VAPID keys for ERP Web Push (print once, store in private config)."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    api_dir = Path(__file__).resolve().parents[1] / 'public' / 'api'
    if not (api_dir / 'vendor/autoload.php').is_file():
        subprocess.run(['composer', 'install', '--no-dev', '--working-dir', str(api_dir)], check=True)

    php = """<?php
require __DIR__ . '/vendor/autoload.php';
use Minishlink\\WebPush\\VAPID;
echo json_encode(VAPID::createVapidKeys(), JSON_UNESCAPED_UNICODE);
"""
    with tempfile.NamedTemporaryFile('w', suffix='.php', dir=api_dir, delete=False) as handle:
        handle.write(php.replace('__DIR__', repr(str(api_dir))))
        temp_path = Path(handle.name)

    try:
        result = subprocess.run(['php', str(temp_path)], capture_output=True, text=True, check=True, cwd=api_dir)
    finally:
        temp_path.unlink(missing_ok=True)

    keys = json.loads(result.stdout.strip())
    print('Add to erp-api-config.php:')
    print(json.dumps({
        'push': {
            'vapid_public_key': keys['publicKey'],
            'vapid_private_key': keys['privateKey'],
            'vapid_subject': 'mailto:erp-push@erp-mt.online',
        },
    }, ensure_ascii=False, indent=4))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
