import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from '../src/utils/password.ts'

test('new PBKDF2 password hashes round-trip and wrong passwords fail', async () => {
  const stored = await hashPassword('a unique test passphrase')
  assert.match(stored, /^pbkdf2:100000:[0-9a-f]{32}:[0-9a-f]{64}$/)
  assert.equal(await verifyPassword('a unique test passphrase', stored), true)
  assert.equal(await verifyPassword('wrong passphrase', stored), false)
})

test('invalid metadata and malformed hex fail closed without deriving', async () => {
  const stored = await hashPassword('test')
  const [scheme, iterations, salt, hash] = stored.split(':')
  const malformed = [
    '', 'sha256:100000:' + salt + ':' + hash,
    `pbkdf2:100000junk:${salt}:${hash}`,
    `pbkdf2:0:${salt}:${hash}`,
    `pbkdf2:1000001:${salt}:${hash}`,
    `pbkdf2:1e5:${salt}:${hash}`,
    `pbkdf2:100000:${salt}:${hash}:ignored`,
    `pbkdf2:${iterations}:${salt.slice(0,-1)}:${hash}`,
    `pbkdf2:${iterations}:0g${salt.slice(2)}:${hash}`,
    `pbkdf2:${iterations}:${salt}:${hash.slice(0,-2)}`,
    `pbkdf2:${iterations}:${salt}:`,
    `pbkdf2:${iterations}:${salt}:${hash.slice(0,-2)}0z`,
  ]
  assert.equal(scheme,'pbkdf2')
  for(const item of malformed){
    assert.equal(await verifyPassword('test', item), false, `should reject ${item}`)
  }
})
