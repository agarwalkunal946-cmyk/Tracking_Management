import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/lib/database.js";
import { ensureDatabaseSetup } from "../src/lib/setup.js";

async function main() {
  await connectDatabase();
  const result = await ensureDatabaseSetup();

  console.log("MongoDB database is ready.");
  console.log(`Verified ${result.collections} collections, ${result.users} users, and ${result.settings} settings.`);
  console.log("No clients, vehicles, or deliveries were added.");
  console.log("Admin: admin@routeflow.app / Admin@123");
  console.log("Staff: staff@routeflow.app / Staff@123");
  console.log("Delete PIN: 2468");
}

main()
  .catch((error) => {
    console.error("Database setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
