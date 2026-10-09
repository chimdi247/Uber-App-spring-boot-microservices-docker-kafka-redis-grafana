import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck, Route as RouteIcon, Radio } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("password123");
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      nav("/", { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      {/* Left: brand panel built around a route line, the product's one recurring motif */}
      <aside className="relative hidden overflow-hidden bg-ink text-primary-foreground lg:block">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <defs>
            <pattern id="g" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="hsl(210 30% 97% / .06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="600" height="800" fill="url(#g)" />
          <path d="M-20 640 C 140 640 160 520 260 500 S 420 540 440 400 S 360 230 520 170 S 620 120 640 100"
            fill="none" stroke="hsl(183 82% 38%)" strokeWidth="6" strokeLinecap="round" />
          <circle cx="120" cy="620" r="12" fill="hsl(41 100% 50%)" />
          <circle cx="520" cy="170" r="12" fill="hsl(210 30% 97%)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-2.5 font-display text-xl font-semibold">
            <span className="grid size-9 place-items-center rounded-lg bg-meter text-ink">🚕</span> RideShare
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-semibold leading-[1.05]">Every ride, from request to receipt.</h1>
            <p className="mt-5 text-lg text-primary-foreground/70">
              Book on the map, watch the match happen over Kafka, and follow the same request through every service in Grafana.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-primary-foreground/80">
              <li className="flex items-center gap-3"><RouteIcon className="size-4 text-meter" /> Live routing on OpenStreetMap + OSRM</li>
              <li className="flex items-center gap-3"><Radio className="size-4 text-meter" /> Driver matching on Redis geospatial + Kafka</li>
              <li className="flex items-center gap-3"><ShieldCheck className="size-4 text-meter" /> JWT-secured gateway in front of every service</li>
            </ul>
          </div>
          <p className="text-xs text-primary-foreground/50">Microservices demo · Spring Boot · Kafka · Redis · MySQL/ProxySQL · OpenTelemetry</p>
        </div>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 font-display text-xl font-semibold lg:hidden">
            <span className="grid size-9 place-items-center rounded-lg bg-ink">🚕</span> RideShare
          </div>
          <h2 className="font-display text-3xl font-semibold">Welcome back</h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Sign in to book rides and manage the fleet.</p>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => login(email, password)); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button className="w-full" size="lg" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Sign in
                </Button>
                <p className="rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
                  Demo account is pre-filled: <b>admin@example.com</b> / <b>password123</b>
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form className="space-y-4" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => register(fullName, regEmail, regPassword)); }}>
                <div className="space-y-1.5">
                  <Label htmlFor="fn">Full name</Label>
                  <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="re">Email</Label>
                  <Input id="re" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rp">Password</Label>
                  <Input id="rp" type="password" minLength={8} autoComplete="new-password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <Button className="w-full" size="lg" disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} Create account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
