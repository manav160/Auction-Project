const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('./models/User');

const testEmailRoles = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({}).select('name email role');
    console.log('Users in database:');
    users.forEach(user => {
      console.log(`  Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
    });

    console.log(`\nTotal users: ${users.length}`);
    mongoose.connection.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

testEmailRoles();
