import "dotenv/config";
import { app } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./lib/database.js";

const port = Number(process.env.PORT) || 4000;

try {
  await connectDatabase();
  const server = app.listen(port, () => {
    console.log(`RouteFlow API running at http://localhost:${port}`);
    console.log("MongoDB connected.");
  });

  async function shutdown() {
    server.close();
    await disconnectDatabase();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  console.error("RouteFlow could not start:", error.message);
  console.error("Check MONGODB_URI and make sure MongoDB is running.");
  process.exit(1);
}
