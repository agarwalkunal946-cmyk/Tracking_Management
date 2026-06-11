import { useQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, ArchiveRestore, Clock3, FilePenLine, LogIn, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "../api";
import { EmptyState, PageLoader } from "../components/UI";
import { displayDateTime } from "../utils";
const actionStyle = {
  CREATE: { icon: Plus, className: "create" },
  UPDATE: { icon: FilePenLine, className: "update" },
  DELETE: { icon: Trash2, className: "delete" },
  LOGIN: { icon: LogIn, className: "login" },
  RESTORE: { icon: ArchiveRestore, className: "restore" },
  BACKUP: { icon: ArchiveRestore, className: "backup" }
};
function Activity() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => api("/admin/audit") });
  if (query.isLoading) return <PageLoader />;
  return <div className="page-stack">
      <section className="security-banner"><ShieldAlert /><div><strong>Complete accountability</strong><p>Edits, deletions, logins, backups, and administrative changes are permanently recorded here.</p></div></section>
      <section className="card activity-card">
        <div className="card-head"><div><span className="eyebrow">Latest first</span><h3>System activity</h3></div><span className="record-count">{query.data?.logs.length ?? 0} recent events</span></div>
        {!query.data?.logs.length ? <EmptyState icon={<ActivityIcon />} title="No activity yet" message="Security and operational events will appear here." /> : <div className="timeline">
            {query.data.logs.map((log) => {
    const style = actionStyle[log.action];
    const Icon = style.icon;
    return <article className="timeline-row" key={log.id}>
                  <div className={`timeline-icon ${style.className}`}><Icon /></div>
                  <div className="timeline-copy"><strong>{log.summary}</strong><span>{log.user?.name ?? "System"} · {log.entity}</span></div>
                  <span className={`action-chip ${style.className}`}>{log.action}</span>
                  <time><Clock3 /> {displayDateTime(log.createdAt)}</time>
                </article>;
  })}
          </div>}
      </section>
    </div>;
}
export {
  Activity
};
