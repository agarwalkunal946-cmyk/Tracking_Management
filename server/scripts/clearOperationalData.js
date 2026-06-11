import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/lib/database.js";
import { AuditLog, Client, Delivery, Vehicle } from "../src/models/index.js";

async function main() {
  await connectDatabase();

  const [deliveries, clients, vehicles, auditLogs] = await Promise.all([
    Delivery.deleteMany(),
    Client.deleteMany(),
    Vehicle.deleteMany(),
    AuditLog.deleteMany()
  ]);

  console.log("Operational data cleared.");
  console.log(`Deliveries removed: ${deliveries.deletedCount}`);
  console.log(`Clients removed: ${clients.deletedCount}`);
  console.log(`Vehicles removed: ${vehicles.deletedCount}`);
  console.log(`Activity logs removed: ${auditLogs.deletedCount}`);
  console.log("Users and system settings were preserved.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
