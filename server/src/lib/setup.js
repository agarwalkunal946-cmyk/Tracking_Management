import { hashSecret } from "./auth.js";
import { AuditLog, Client, Delivery, Setting, User, Vehicle } from "../models/index.js";

export const seededUsers = [
  {
    name: "System Admin",
    email: "admin@routeflow.app",
    password: "Admin@123",
    role: "ADMIN"
  },
  {
    name: "Delivery Staff",
    email: "staff@routeflow.app",
    password: "Staff@123",
    role: "STAFF"
  }
];

export const defaultSettings = {
  companyName: "RouteFlow Logistics",
  companyPhoneNumber: "",
  reporterName: "",
  reporterTitle: "",
  soundsEnabled: "true"
};

const models = [User, Client, Vehicle, Delivery, AuditLog, Setting];

async function ensureCollectionsAndIndexes() {
  const database = User.db.db;
  const existing = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name)
  );

  for (const model of models) {
    if (!existing.has(model.collection.collectionName)) await model.createCollection();
  }

  await Promise.all(models.map((model) => model.createIndexes()));
}

async function ensureUsers({ resetSeedCredentials }) {
  const emails = seededUsers.map((user) => user.email);
  const existingUsers = await User.find({ email: { $in: emails } })
    .select("+passwordHash email")
    .lean();
  const existingByEmail = new Map(existingUsers.map((user) => [user.email, user]));

  await Promise.all(seededUsers.map(async (seededUser) => {
    const existing = existingByEmail.get(seededUser.email);
    const needsPassword = resetSeedCredentials || !existing?.passwordHash;
    const passwordHash = needsPassword ? await hashSecret(seededUser.password) : undefined;

    if (existing) {
      if (passwordHash) await User.updateOne({ _id: existing._id }, { $set: { passwordHash } });
      return;
    }

    await User.updateOne(
      { email: seededUser.email },
      {
        $setOnInsert: {
          name: seededUser.name,
          email: seededUser.email,
          passwordHash,
          role: seededUser.role,
          active: true
        }
      },
      { upsert: true }
    );
  }));
}

async function ensureSettings({ resetSeedCredentials }) {
  const existingSettings = await Setting.find().lean();
  const existingByKey = new Map(existingSettings.map((setting) => [setting.key, setting.value]));
  const adminPinHash = resetSeedCredentials || !existingByKey.get("adminPinHash")
    ? await hashSecret("2468")
    : existingByKey.get("adminPinHash");

  const settings = {
    ...defaultSettings,
    adminPinHash
  };

  await Promise.all(Object.entries(settings).map(([key, value]) => {
    const update = resetSeedCredentials && key === "adminPinHash"
      ? { $set: { value } }
      : { $setOnInsert: { value } };
    return Setting.updateOne({ key }, update, { upsert: true });
  }));
}

async function verifySetup() {
  const expectedCollections = models.map((model) => model.collection.collectionName);
  const [collections, users, settings] = await Promise.all([
    User.db.db.listCollections({}, { nameOnly: true }).toArray(),
    User.find({ email: { $in: seededUsers.map((user) => user.email) } }).lean(),
    Setting.find({ key: { $in: [...Object.keys(defaultSettings), "adminPinHash"] } }).lean()
  ]);

  const collectionNames = new Set(collections.map((item) => item.name));
  const missingCollections = expectedCollections.filter((name) => !collectionNames.has(name));
  const userEmails = new Set(users.map((user) => user.email));
  const missingUsers = seededUsers.filter((user) => !userEmails.has(user.email)).map((user) => user.email);
  const settingKeys = new Set(settings.map((setting) => setting.key));
  const missingSettings = [...Object.keys(defaultSettings), "adminPinHash"]
    .filter((key) => !settingKeys.has(key));

  if (missingCollections.length || missingUsers.length || missingSettings.length) {
    throw new Error([
      missingCollections.length ? `collections: ${missingCollections.join(", ")}` : "",
      missingUsers.length ? `users: ${missingUsers.join(", ")}` : "",
      missingSettings.length ? `settings: ${missingSettings.join(", ")}` : ""
    ].filter(Boolean).join("; "));
  }

  return {
    collections: expectedCollections.length,
    users: users.length,
    settings: settings.length
  };
}

export async function ensureDatabaseSetup({ resetSeedCredentials = false } = {}) {
  await ensureCollectionsAndIndexes();
  await ensureUsers({ resetSeedCredentials });
  await ensureSettings({ resetSeedCredentials });
  await ensureCollectionsAndIndexes();
  return verifySetup();
}
