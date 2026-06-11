export const deliveryPopulation = [
  { path: "client", select: "name" },
  { path: "vehicle", select: "plateNumber" },
  { path: "createdBy", select: "name" }
];

export function toJSON(document) {
  return document?.toJSON ? document.toJSON() : document;
}

export function publicUser(document) {
  const user = toJSON(document);
  if (!user) return user;
  delete user.passwordHash;
  return user;
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
