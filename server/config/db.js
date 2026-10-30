import mongoose from 'mongoose';
import colors from 'colors';

const connectDB = async () => {
  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    console.error(
      '[FATAL] MONGO_URI is not set. Add MONGO_URI to your .env file\n' +
        'Example: MONGO_URI=mongodb://localhost:27017/kisan-ai'
    );
    process.exit(1);
  }

  let retries = 5;
  while (retries) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI);
      console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline.bold);
      return;
    } catch (error) {
      console.error(`MongoDB connection error: ${error.message}`.red.bold);
      retries -= 1;
      if (retries === 0) {
        console.error('Max retries reached. Exiting...'.red.bold);
        process.exit(1);
      }
      console.log(`Retrying... (${retries} attempts left)`.yellow);
      await new Promise(res => setTimeout(res, 3000));
    }
  }
};

export default connectDB;
