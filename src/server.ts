import app from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
// import { logger } from "./utils/logger";

const startServer = async () => {
  try {
    await connectDB();

    app.listen(parseInt(env.PORT), () => {
      // logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`Server running in production mode on port ${env.PORT}`);
    });
  } catch (error) {
    // logger.error("Failed to start server:", error);
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
