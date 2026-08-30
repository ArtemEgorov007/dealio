#!/usr/bin/env python3
"""Upload public/api/ to erp-mt.online without remote deletion."""

from __future__ import annotations

import ftplib
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_API = ROOT / 'public' / 'api'
REMOTE_API = '/www/erp-mt.online/api'
SKIP_NAMES = ('_bootstrap', '_diag', '_migrate')


def load_credentials() -> tuple[str, str, str]:
    host = os.environ.get('ERP_FTP_HOST', '').strip()
    user = os.environ.get('ERP_FTP_USER', '').strip()
    password = os.environ.get('ERP_FTP_PASSWORD', '')
    missing = [name for name, value in (
        ('ERP_FTP_HOST', host),
        ('ERP_FTP_USER', user),
        ('ERP_FTP_PASSWORD', password),
    ) if not value]
    if missing:
        print('Set env vars: ' + ', '.join(missing), file=sys.stderr)
        sys.exit(2)
    return host, user, password


def collect_files() -> list[tuple[Path, str]]:
    files: list[tuple[Path, str]] = []
    for local in sorted(LOCAL_API.rglob('*')):
        if not local.is_file():
            continue
        if any(local.name.startswith(prefix) for prefix in SKIP_NAMES):
            continue
        rel = local.relative_to(LOCAL_API).as_posix()
        files.append((local, f'{REMOTE_API}/{rel}'))
    return files


def connect(host: str, user: str, password: str) -> ftplib.FTP:
    last_error: Exception | None = None
    for attempt in range(1, 9):
        try:
            ftp = ftplib.FTP()
            ftp.connect(host, 21, timeout=90)
            ftp.login(user, password)
            ftp.set_pasv(True)
            return ftp
        except Exception as error:  # noqa: BLE001 — FTP raises many types
            last_error = error
            print(f'connect retry {attempt}: {error!r}', flush=True)
            time.sleep(min(attempt * 2, 12))
    raise SystemExit(f'FTP connect failed: {last_error!r}')


def ensure_dir(ftp: ftplib.FTP, remote_dir: str, cache: set[str]) -> None:
    if remote_dir in cache:
        return
    parts = remote_dir.strip('/').split('/')
    current = ''
    for part in parts:
        current = f'{current}/{part}' if current else part
        try:
            ftp.mkd(current)
        except Exception:  # noqa: BLE001
            pass
    cache.add(remote_dir)


def main() -> int:
    host, user, password = load_credentials()
    files = collect_files()
    print(f'api files {len(files)}', flush=True)

    ftp = connect(host, user, password)
    made: set[str] = set()
    uploaded = 0

    for index, (local, remote) in enumerate(files, 1):
        remote_dir = os.path.dirname(remote)
        for attempt in range(1, 6):
            try:
                ensure_dir(ftp, remote_dir, made)
                with local.open('rb') as handle:
                    ftp.storbinary(f'STOR {remote}', handle)
                uploaded += 1
                if index % 5 == 0 or index == len(files):
                    print(f'progress {index}/{len(files)}', flush=True)
                break
            except Exception as error:  # noqa: BLE001
                print(f'retry {remote} {attempt}: {error!r}', flush=True)
                try:
                    ftp.quit()
                except Exception:  # noqa: BLE001
                    pass
                time.sleep(min(attempt * 2, 10))
                ftp = connect(host, user, password)
        else:
            print(f'failed {remote}', file=sys.stderr)
            return 1

    try:
        ftp.quit()
    except Exception:  # noqa: BLE001
        pass

    print(f'DONE {uploaded}', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
