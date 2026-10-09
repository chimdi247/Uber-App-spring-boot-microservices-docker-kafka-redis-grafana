import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { config } from "@/lib/config";

const t = config.tools;

const DASHBOARDS = [
  { title: "Services overview", desc: "Uptime, latency, SLI/SLO, error budget, success vs failed requests, container + node CPU/memory, business KPIs.", href: `${t.grafana}/d/rideshare-overview` },
  { title: "Logs & traces", desc: "Search logs, jump from a log line to its trace and spans, service map.", href: `${t.grafana}/d/rideshare-logs-traces` },
  { title: "MySQL & ProxySQL", desc: "Queries per backend (load balancing), connection pool, replication lag.", href: `${t.grafana}/d/rideshare-mysql` },
  { title: "Kafka", desc: "Topics, throughput, consumer lag per group.", href: `${t.grafana}/d/rideshare-kafka` },
  { title: "Redis", desc: "Memory, commands, hit rate, drivers online.", href: `${t.grafana}/d/rideshare-redis` },
  { title: "Alert rules", desc: "Grafana-managed alerts (CPU / memory > 50 %, service down, 5xx, latency).", href: `${t.grafana}/alerting/list` },
];

const TOOLS = [
  { title: "Kafka UI", desc: "Browse ride.requested / ride.matched, consumer groups, messages.", href: t.kafkaUi },
  { title: "Redis UI", desc: "Inspect the drivers:locations geo set.", href: t.redisUi },
  { title: "Mailpit", desc: "Inbox for Grafana alert e-mails (SMTP catch-all).", href: t.mailpit },
  { title: "Prometheus", desc: "Raw metrics and targets.", href: t.prometheus },
];

function LinkCard({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            {title} <ExternalLink className="size-4 text-muted-foreground group-hover:text-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{desc}</p></CardContent>
      </Card>
    </a>
  );
}

export default function ObservabilityPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold">Observability</h1>
        <p className="text-sm text-muted-foreground">
          Every request is traced end to end (gateway → ride-service → Kafka → matching-service → location-service → Redis).
          Grafana login: <b>admin</b> / <b>admin</b>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Grafana dashboards</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{DASHBOARDS.map((d) => <LinkCard key={d.title} {...d} />)}</div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Infrastructure tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{TOOLS.map((d) => <LinkCard key={d.title} {...d} />)}</div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Follow one ride through the system</CardTitle>
          <CardDescription>
            Book a ride, then open <b>Logs &amp; traces</b> in Grafana, filter logs for <code>ride-service</code>, expand a line and press
            <b> View trace</b>: the waterfall shows the HTTP call, the SQL statements, the Kafka publish, the matching consumer and the Redis lookup.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
