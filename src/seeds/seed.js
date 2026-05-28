const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

const User = require('../models/User');
const Series = require('../models/Series');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Series.deleteMany({});
    console.log('Cleared existing data');

    // ===== CREATE USERS =====
    const users = await User.create([
      {
        name: 'Eiichiro Oda',
        email: 'mangaka@test.com',
        password: '123456',
        role: 'MANGAKA',
        avatar: '',
      },
      {
        name: 'Takuma Narita',
        email: 'assistant@test.com',
        password: '123456',
        role: 'ASSISTANT',
        avatar: '',
      },
      {
        name: 'Yujiro Hattori',
        email: 'editor@test.com',
        password: '123456',
        role: 'EDITOR',
        avatar: '',
      },
      {
        name: 'Sasaki Board',
        email: 'board@test.com',
        password: '123456',
        role: 'BOARD_MEMBER',
        avatar: '',
      },
    ]);

    const mangaka = users[0];
    const editor = users[2];

    console.log('Created users:');
    users.forEach((u) => console.log(`  [${u.role}] ${u.name} — ${u.email}`));

    // ===== CREATE SAMPLE SERIES =====
    const seriesList = await Series.create([
      {
        title: 'Dragon Slayer Chronicles',
        synopsis: 'A young warrior embarks on a journey to slay ancient dragons threatening the kingdom.',
        mangakaId: mangaka._id,
        status: 'PENDING',
      },
      {
        title: 'Cyber Ronin 2099',
        synopsis: 'In a cyberpunk future, a masterless samurai fights corporate tyranny with a plasma katana.',
        mangakaId: mangaka._id,
        status: 'APPROVED',
        pubSchedule: 'WEEKLY',
        reviewedBy: editor._id,
        reviewNote: 'Great hook and fast pacing, perfect for weekly.',
        reviewedAt: new Date(),
      },
      {
        title: 'Moonlit Garden',
        synopsis: 'A botanical artist discovers that the flowers she paints come to life under moonlight.',
        mangakaId: mangaka._id,
        status: 'PENDING',
      },
    ]);

    console.log('\nCreated series:');
    seriesList.forEach((s) => console.log(`  [${s.status}] ${s.title}`));

    // ===== SUMMARY =====
    console.log('\n========================================');
    console.log('SEED COMPLETE');
    console.log('========================================');
    console.log('\nTest accounts (password: 123456):');
    console.log('  Mangaka:      mangaka@test.com');
    console.log('  Assistant:    assistant@test.com');
    console.log('  Editor:       editor@test.com');
    console.log('  Board Member: board@test.com');
    console.log('========================================');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exit(1);
  }
};

seedData();
