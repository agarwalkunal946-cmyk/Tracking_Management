import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, BellRing, Building2, CheckCircle2, CloudDownload, DatabaseBackup, Download, KeyRound, RefreshCcw, ShieldCheck, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Modal, PageLoader, SecretInput } from "../components/UI";
import { notify } from "../notify";
import { displayDateTime } from "../utils";
import { numericInput, settingsSchema, validateForm } from "../validation";
function Settings() {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [adminPin, setAdminPin] = useState("");
  const [restoreFile, setRestoreFile] = useState("");
  const [restoreOpen, setRestoreOpen] = useState(false);
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: () => api("/admin/settings") });
  const backupsQuery = useQuery({ queryKey: ["backups"], queryFn: () => api("/backups") });
  useEffect(() => {
    if (settingsQuery.data) {
      setCompanyName(settingsQuery.data.settings.companyName ?? "RouteFlow Logistics");
      setSoundsEnabled(settingsQuery.data.settings.soundsEnabled !== "false");
    }
  }, [settingsQuery.data]);
  const settingsMutation = useMutation({
    mutationFn: (data) => api("/admin/settings", { method: "PUT", body: { companyName: data.companyName, soundsEnabled: data.soundsEnabled, ...data.adminPin ? { adminPin: data.adminPin } : {} } }),
    onSuccess: () => {
      localStorage.setItem("routeflow_sounds", String(soundsEnabled));
      setAdminPin("");
      notify.success("Settings saved");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => notify.error(error.message)
  });
  const backupMutation = useMutation({
    mutationFn: () => api("/backups", { method: "POST" }),
    onSuccess: ({ filename }) => {
      notify.success(`Backup created: ${filename}`);
      void queryClient.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (error) => notify.error(error.message)
  });
  const restoreMutation = useMutation({
    mutationFn: () => api("/backups/restore", { method: "POST", body: { filename: restoreFile } }),
    onSuccess: () => {
      notify.success("Backup restored. Refreshing workspace...");
      setTimeout(() => window.location.assign("/login"), 900);
    },
    onError: (error) => notify.error(error.message)
  });
  if (settingsQuery.isLoading || backupsQuery.isLoading) return <PageLoader />;
  function exportBackup() {
    const token = localStorage.getItem("routeflow_token");
    fetch("/api/backups/export", { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: "include" }).then(async (response) => {
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `routeflow-backup-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      notify.success("Backup downloaded");
    }).catch(() => notify.error("Could not download backup"));
  }
  function save(event) {
    event.preventDefault();
    const result = validateForm(settingsSchema, { companyName, soundsEnabled, adminPin });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    settingsMutation.mutate(result.data);
  }
  return <div className="settings-grid">
      <form className="card settings-card" onSubmit={save}>
        <div className="settings-section-head"><div className="settings-icon coral"><Building2 /></div><div><span className="eyebrow">General</span><h2>Workspace identity</h2><p>Used across reports and system screens.</p></div></div>
        <label className="field"><span>Company name</span><input minLength={2} maxLength={100} value={companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label>
        <div className="settings-divider" />
        <div className="settings-section-head"><div className="settings-icon gold"><BellRing /></div><div><span className="eyebrow">Feedback</span><h2>Sounds & notifications</h2><p>Small audio cues for important actions.</p></div></div>
        <label className="toggle-row">
          <div><strong><Volume2 /> Interface sounds</strong><span>Success tone on save and warning tone for errors</span></div>
          <input type="checkbox" checked={soundsEnabled} onChange={(event) => setSoundsEnabled(event.target.checked)} />
        </label>
        <div className="settings-divider" />
        <div className="settings-section-head"><div className="settings-icon dark"><KeyRound /></div><div><span className="eyebrow">Security</span><h2>Admin delete PIN</h2><p>Leave blank to keep the current PIN.</p></div></div>
        <label className="field"><span>New Admin PIN</span><SecretInput inputMode="numeric" pattern="[0-9]*" value={adminPin} onChange={(event) => setAdminPin(numericInput(event.target.value))} minLength={4} maxLength={12} placeholder="Enter 4 to 12 digits" /></label>
        <button className="primary-button" disabled={settingsMutation.isPending}><CheckCircle2 size={17} /> Save settings</button>
      </form>

      <section className="card settings-card backup-card">
        <div className="settings-section-head"><div className="settings-icon mint"><DatabaseBackup /></div><div><span className="eyebrow">Data protection</span><h2>Backup & restore</h2><p>Create server snapshots and portable cloud-ready exports.</p></div></div>
        <div className="backup-actions">
          <button className="primary-button" onClick={() => backupMutation.mutate()} disabled={backupMutation.isPending}><Archive size={17} /> Create snapshot</button>
          <button className="secondary-button" onClick={exportBackup}><CloudDownload size={17} /> Download backup</button>
        </div>
        <div className="cloud-note"><ShieldCheck /><div><strong>Portable backup</strong><p>Downloaded JSON backups can be stored in secure cloud storage or an encrypted external drive.</p></div></div>
        <div className="settings-divider" />
        <div className="backup-list-head"><div><span className="eyebrow">Server snapshots</span><h3>Available restore points</h3></div><RefreshCcw size={17} /></div>
        <div className="backup-list">
          {!backupsQuery.data?.backups.length ? <p className="muted">No snapshots yet. Create your first backup above.</p> : backupsQuery.data.backups.map((filename) => {
    const datePart = filename.replace("routeflow-", "").replace(".json", "").replace(/-(\d{3})Z$/, ".$1Z").replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
    return <div className="backup-row" key={filename}>
                <div className="backup-file-icon"><Download /></div>
                <div><strong>{filename}</strong><span>{Number.isNaN(new Date(datePart).getTime()) ? "Server snapshot" : displayDateTime(datePart)}</span></div>
                <button className="ghost-button" onClick={() => {
      setRestoreFile(filename);
      setRestoreOpen(true);
    }}>Restore</button>
              </div>;
  })}</div>
      </section>

      <Modal open={restoreOpen} title="Restore system backup?" onClose={() => setRestoreOpen(false)}>
        <div className="restore-warning"><DatabaseBackup /><div><strong>Current data will be replaced</strong><p>The database will return to the state saved in <b>{restoreFile}</b>. Active sessions may be signed out.</p></div></div>
        <div className="modal-actions"><button className="ghost-button" onClick={() => setRestoreOpen(false)}>Cancel</button><button className="danger-button" onClick={() => restoreMutation.mutate()} disabled={restoreMutation.isPending}>{restoreMutation.isPending ? "Restoring..." : "Restore backup"}</button></div>
      </Modal>
    </div>;
}
export {
  Settings
};
