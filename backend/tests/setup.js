import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

process.env.ACCESS_SECRET = 'test_access_secret';
process.env.REFRESH_SECRET = 'test_refresh_secret';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
let mongod;

// Start in-memory MongoDB before all tests
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 600000); // 10 minute timeout for initial binary download

// Clear collections between each test
afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany();
  }
  jest.clearAllMocks();
});

// Drop database and close connection after all tests
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
});
