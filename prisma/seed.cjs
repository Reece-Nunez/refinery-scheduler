const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allJobs = await prisma.job.findMany();
  const jobConnections = allJobs.map((job) => ({ id: job.id }));

  const userSub = '3ff9d357-e891-4cf9-9f9d-7c2a8eb00a1f'; // <- Replace with your actual Supabase UID
  const userEmail = 'reece.nunez@p66.com';

  await prisma.user.upsert({
    where: { id: userSub },
    update: {},
    create: {
      id: userSub,
      email: userEmail,
      password: 'Nov042011!',
      role: 'ADMIN',
      operator: {
        create: {
          name: 'Reece Nunez',
          employeeId: 'RN123',
          role: 'ADMIN',
          team: 'A',
          trainedJobs: {
            connect: jobConnections,
          },
        },
      },
    },
  });

  console.log('✅ Admin user and operator seeded.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
