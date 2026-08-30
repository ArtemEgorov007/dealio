#!/usr/bin/env bash
# Прогон PHP-тестов бэкенда.
#
# Файлы *-test.php — это тесты: запускаются без аргументов и падают ненулевым
# кодом. Прочие файлы в tests/php (например approvals-auth-probe.php) —
# диагностические инструменты, которым нужен сценарий аргументом, поэтому
# в автоматический прогон они не входят.
set -uo pipefail

cd "$(dirname "$0")/.."

if ! command -v php >/dev/null 2>&1; then
    echo "php не найден в PATH — пропускаю тесты бэкенда" >&2
    exit 1
fi

failed=0
total=0

for test_file in tests/php/*-test.php; do
    [ -e "$test_file" ] || continue
    total=$((total + 1))
    if output=$(php "$test_file" 2>&1); then
        printf '  ok   %s\n' "$(basename "$test_file")"
    else
        failed=$((failed + 1))
        printf '  FAIL %s\n' "$(basename "$test_file")"
        printf '%s\n' "$output" | sed 's/^/       /'
    fi
done

echo "PHP-тесты: $((total - failed))/$total пройдено"
[ "$failed" -eq 0 ]
