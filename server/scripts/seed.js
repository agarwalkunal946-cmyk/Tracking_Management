import "dotenv/config";
import { hash } from "bcryptjs";
import { connectDatabase, disconnectDatabase } from "../src/lib/database.js";
import { Setting, User } from "../src/models/index.js";

async function main() {
  await connectDatabase();

  const [passwordHash, staffPasswordHash, pinHash] = await Promise.all([
    hash("Admin@123", 12),
    hash("Staff@123", 12),
    hash("2468", 12)
  ]);

  await User.findOneAndUpdate(
    { email: "admin@routeflow.app" },
    {
      $setOnInsert: {
        name: "System Admin",
        email: "admin@routeflow.app",
        passwordHash,
        role: "ADMIN",
        active: true
      }
    },
    { upsert: true, returnDocument: "after" }
  );
  await User.findOneAndUpdate(
    { email: "staff@routeflow.app" },
    {
      $setOnInsert: {
        name: "Delivery Staff",
        email: "staff@routeflow.app",
        passwordHash: staffPasswordHash,
        role: "STAFF",
        active: true
      }
    },
    { upsert: true, returnDocument: "after" }
  );

  await Promise.all([
    Setting.findOneAndUpdate({ key: "adminPinHash" }, { $setOnInsert: { value: pinHash } }, { upsert: true }),
    Setting.findOneAndUpdate({ key: "companyName" }, { $setOnInsert: { value: "RouteFlow Logistics" } }, { upsert: true }),
    Setting.findOneAndUpdate({ key: "soundsEnabled" }, { $setOnInsert: { value: "true" } }, { upsert: true })
  ]);

  console.log("MongoDB database initialized.");
  console.log("No clients, vehicles, or deliveries were added.");
  console.log("Admin: admin@routeflow.app / Admin@123");
  console.log("Staff: staff@routeflow.app / Staff@123");
  console.log("Delete PIN: 2468");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
