import { AuditLog } from "../models/index.js";

export function audit(input) {
  return AuditLog.create({
    action: input.action,
    entity: input.entity,
    entityId: input.entityId || null,
    summary: input.summary,
    userId: input.userId || null,
    ipAddress: input.ipAddress || null,
    beforeJson: input.before ? JSON.stringify(input.before) : null,
    afterJson: input.after ? JSON.stringify(input.after) : null
  });
}
