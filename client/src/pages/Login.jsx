import { ArrowRight, Check, PackageCheck, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { SecretInput } from "../components/UI";
import { notify } from "../notify";
import { loginSchema, validateForm } from "../validation";
function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event) {
    event.preventDefault();
    const result = validateForm(loginSchema, { email, password });
    if (result.error) {
      notify.error(result.error);
      return;
    }
    setLoading(true);
    try {
      await login(result.data.email, result.data.password);
      navigate("/");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }
  return <main className="login-page">
      <section className="login-story">
        <div className="login-orb login-orb-one" />
        <div className="login-orb login-orb-two" />
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
          <div className="login-brand"><span><Truck size={23} /></span>RouteFlow</div>
          <p className="login-kicker"><Sparkles size={15} /> Delivery intelligence, beautifully simple</p>
          <h1>Every trip.<br />Perfectly <em>accounted for.</em></h1>
          <p className="login-lead">A calm command center for daily deliveries, vehicle activity, client reporting, and complete operational control.</p>
          <div className="login-features">
            <span><Check /> Automatic trip & receipt numbering</span>
            <span><Check /> Professional PDF reports</span>
            <span><Check /> Role-based security & audit trail</span>
          </div>
        </motion.div>
        <motion.div className="login-proof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div><PackageCheck /><span><strong>Fast daily entry</strong><small>Save a delivery in seconds</small></span></div>
          <div><ShieldCheck /><span><strong>Secure by design</strong><small>Admin controls built in</small></span></div>
        </motion.div>
      </section>

      <section className="login-form-side">
        <motion.form className="login-form" onSubmit={submit} autoComplete="off" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>
          <div className="mobile-login-brand"><Truck /> RouteFlow</div>
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to your workspace</h2>
          <p>Enter your details to manage today’s deliveries.</p>

          <label className="field">
            <span>Email address</span>
            <input
              type="email"
              name="routeflow-login-identity"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              maxLength={254}
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              placeholder="Enter your email"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <SecretInput
              name="routeflow-login-secret"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              placeholder="Enter your password"
              minLength={6}
              maxLength={100}
              required
            />
          </label>

          <button className="primary-button login-submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in securely"} <ArrowRight size={18} />
          </button>

          <small className="login-security"><ShieldCheck size={14} /> Protected with secure, role-based access</small>
        </motion.form>
      </section>
    </main>;
}
export {
  Login
};
