import mongoose from 'mongoose';
import { env } from '../config/env';

// Import all models to ensure they are registered and we can drop their collections
import { User } from '../models/User';
import { Course } from '../models/Course';
import { Section } from '../models/Section';
import { Lesson } from '../models/Lesson';
import { Enrollment } from '../models/Entrollment';
import { Progress } from '../models/Progress';

async function cleanDatabase() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB.');

    console.log('Cleaning database collections...');
    
    // Delete all documents in all collections
    await Promise.all([
      User.deleteMany({}),
      Course.deleteMany({}),
      Section.deleteMany({}),
      Lesson.deleteMany({}),
      Enrollment.deleteMany({}),
      Progress.deleteMany({})
    ]);

    console.log('✅ Database successfully cleaned. All data removed.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning database:', error);
    process.exit(1);
  }
}

cleanDatabase();
