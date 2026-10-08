require('dotenv').config({
  path: require('node:path').resolve(__dirname, '../../../.env'),
  quiet: true,
});
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const db = new PrismaClient();
async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const displayName = (process.env.ADMIN_DISPLAY_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    !/^[a-z0-9_.-]{3,80}$/.test(username) ||
    !displayName ||
    displayName.length > 120 ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error(
      'Supply valid ADMIN_EMAIL, ADMIN_USERNAME, ADMIN_DISPLAY_NAME and ADMIN_PASSWORD (12–256 characters).',
    );
  if (
    process.env.APP_ENV === 'production' &&
    /ProViewDemo|AcceptancePassword|password123|change.me/i.test(password)
  )
    throw new Error('Production bootstrap rejects demonstration/example passwords.');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7067266577696577::bigint)`;
    if (await tx.user.count({ where: { role: 'ADMIN' } }))
      throw new Error('An administrator already exists; use audited user administration instead.');
    const user = await tx.user.create({
      data: { email, username, displayName, passwordHash, role: 'ADMIN' },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: 'INITIAL_ADMIN_BOOTSTRAPPED',
        entityType: 'User',
        entityId: user.id,
        metadata: { source: 'controlled CLI provisioning' },
      },
    });
  });
  console.log('Initial administrator created; provisioning was recorded in the audit log.');
}
main()
  .catch((error) => {
    // Known input errors are safe; database errors can contain credentials or connection URLs.
    console.error(
      error.message.startsWith('Supply ') ||
        error.message.startsWith('Production ') ||
        error.message.startsWith('An administrator ')
        ? error.message
        : 'Administrator provisioning failed. Check database/configuration.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
