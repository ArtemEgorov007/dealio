#!/usr/bin/env python3
"""HTTPS smoke for /api/approvals auth boundary on erp-mt.online."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

BASE = os.environ.get('ERP_STAGING_API_BASE', 'https://erp-mt.online/api').rstrip('/')
try:
    QA_LOGIN = os.environ['ERP_QA_LOGIN']
    QA_PASSWORD = os.environ['ERP_QA_PASSWORD']
except KeyError as error:
    raise SystemExit(f'{error.args[0]} is required') from error


class ApiClient:
    def __init__(self) -> None:
        self.jar = CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
        payload = None if body is None else json.dumps(body).encode()
        request = urllib.request.Request(f'{BASE}{path}', data=payload, method=method)
        request.add_header('Content-Type', 'application/json')
        try:
            with self.opener.open(request, timeout=30) as response:
                return response.status, json.loads(response.read().decode())
        except urllib.error.HTTPError as error:
            raw = error.read().decode()
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = {'raw': raw[:200]}
            return error.code, parsed


def expect_status(label: str, actual: int, expected: int) -> None:
    if actual != expected:
        raise SystemExit(f'{label}: expected HTTP {expected}, got {actual}')


def expect_code(label: str, payload: dict, expected: str) -> None:
    code = (payload.get('error') or {}).get('code')
    if code != expected:
        raise SystemExit(f'{label}: expected error.code={expected!r}, got {code!r}')


def main() -> int:
    anonymous = ApiClient()

    status, payload = anonymous.call('GET', '/approvals')
    expect_status('anonymous GET /approvals', status, 401)
    expect_code('anonymous GET /approvals', payload, 'unauthorized')

    status, payload = anonymous.call('POST', '/approvals/decisions', {
        'rowNumber': 2,
        'action': 'approve',
    })
    expect_status('anonymous POST /approvals/decisions', status, 401)
    expect_code('anonymous POST /approvals/decisions', payload, 'unauthorized')

    qa = ApiClient()
    status, login = qa.call('POST', '/auth/login', {'login': QA_LOGIN, 'password': QA_PASSWORD})
    expect_status('qa login', status, 200)
    if not login.get('ok'):
        raise SystemExit('qa login failed')
    if login['data']['access'].get('approvals'):
        raise SystemExit('qa.staging must not have approvals for this smoke')

    status, payload = qa.call('GET', '/approvals')
    expect_status('qa GET /approvals', status, 403)
    expect_code('qa GET /approvals', payload, 'forbidden')

    status, payload = qa.call('POST', '/approvals/decisions', {
        'rowNumber': 2,
        'action': 'approve',
    })
    expect_status('qa POST /approvals/decisions', status, 403)
    expect_code('qa POST /approvals/decisions', payload, 'forbidden')

    print('Approvals staging auth smoke passed')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
