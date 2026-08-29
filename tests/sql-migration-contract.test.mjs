import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../database/migrations/001_erp_identity.sql', import.meta.url), 'utf8').catch(() => '')

test('identity migration creates only namespaced tables with protected credentials', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_users/i)
  assert.match(migration, /login .*UNIQUE/i)
  assert.match(migration, /password_hash/i)
  assert.doesNotMatch(migration, /\bpassword\s+VARCHAR/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_user_permissions/i)
  assert.match(migration, /UNIQUE KEY .*user_id.*permission_code/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_sessions/i)
  assert.match(migration, /token_hash/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_shift_events/i)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS erp_audit_log/i)
  assert.doesNotMatch(migration, /(?:ALTER|DROP|TRUNCATE|DELETE|UPDATE)\s+TABLE\s+(?!erp_)/i)
})
