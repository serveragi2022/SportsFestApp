import assert from 'node:assert/strict';
import { handle } from '../supabase/functions/sf-admin/handler.ts';

function deps({ admin = true, caller = { id: 'admin1', email: 'a@x.com' }, createFails, insertFails } = {}) {
  const log = [];
  return {
    log,
    getCaller: async (t) => (t === 'good' ? caller : null),
    isAdmin: async () => admin,
    createUser: async (email, password) => { log.push(['createUser', email, password]); if (createFails) throw new Error(createFails); return { id: 'u9' }; },
    deleteUser: async (id) => { log.push(['deleteUser', id]); },
    setPassword: async (id, pw) => { log.push(['setPassword', id, pw]); },
    insertStaff: async (row) => { log.push(['insertStaff', row]); if (insertFails) throw new Error('db down'); },
    insertAdmin: async (id) => { log.push(['insertAdmin', id]); },
    setGames: async (id, g) => { log.push(['setGames', id, g]); },
    staffExists: async (id) => id !== 'ghost',
  };
}
const H = 'Bearer good';
const create = { action: 'create', username: ' Ana.Cruz ', password: 'secret1', fullName: 'Nel Marasigan', gameIds: ['chess', 'darts', 'chess'] };

// auth
assert.equal((await handle(null, create, deps())).status, 401);
assert.equal((await handle('Bearer bad', create, deps())).status, 401);
let r = await handle(H, create, deps({ admin: false }));
assert.equal(r.status, 403);

// create committee account with games (deduped, username normalised, internal login address)
let d = deps();
r = await handle(H, create, d);
assert.equal(r.status, 200); assert.equal(r.body.userId, 'u9');
assert.deepEqual(d.log, [
  ['createUser', 'ana.cruz@sportsfest.example.com', 'secret1'],
  ['insertStaff', { user_id: 'u9', username: 'nel.marasigan', email: 'ana.cruz@sportsfest.example.com', full_name: 'Nel Marasigan', role: 'committee' }],
  ['setGames', 'u9', ['chess', 'darts']],
]);

// create admin account: no games, also inserted into sf_admins
d = deps();
r = await handle(H, { ...create, role: 'admin' }, d);
assert.equal(r.status, 200);
assert.deepEqual(d.log.map((x) => x[0]), ['createUser', 'insertStaff', 'insertAdmin']);

// validation
assert.equal((await handle(H, { ...create, username: 'a b' }, deps())).status, 400, 'no spaces');
assert.equal((await handle(H, { ...create, username: 'ab' }, deps())).status, 400, 'too short');
assert.equal((await handle(H, { ...create, username: 'ana@x.com' }, deps())).status, 400, 'no @');
assert.equal((await handle(H, { ...create, password: 'short' }, deps())).status, 400);
assert.equal((await handle(H, { ...create, fullName: '  ' }, deps())).status, 400);
r = await handle(H, create, deps({ createFails: 'A user with this email address has already been registered' }));
assert.equal(r.status, 400); assert.equal(r.body.error, 'That username is already taken.');

// rollback when saving the profile fails
d = deps({ insertFails: true });
r = await handle(H, create, d);
assert.equal(r.status, 500);
assert.deepEqual(d.log.at(-1), ['deleteUser', 'u9']);

// delete
d = deps();
assert.equal((await handle(H, { action: 'delete', userId: 'u5' }, d)).status, 200);
assert.deepEqual(d.log, [['deleteUser', 'u5']]);
assert.equal((await handle(H, { action: 'delete', userId: 'admin1' }, deps())).status, 400, 'cannot delete yourself');
assert.equal((await handle(H, { action: 'delete', userId: 'ghost' }, deps())).status, 404);

// password
d = deps();
assert.equal((await handle(H, { action: 'password', userId: 'u5', password: 'newpass1' }, d)).status, 200);
assert.deepEqual(d.log, [['setPassword', 'u5', 'newpass1']]);
assert.equal((await handle(H, { action: 'password', userId: 'u5', password: 'x' }, deps())).status, 400);

assert.equal((await handle(H, { action: 'boom' }, deps())).status, 400);
assert.equal((await handle(H, null, deps())).status, 400);
console.log('SF-ADMIN FUNCTION TESTS PASSED');
