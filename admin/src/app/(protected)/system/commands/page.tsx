import { Topbar } from '@/components/layout/topbar';
import { Card } from '@/components/ui/card';

const commands = [
  {
    title: 'Start local Supabase',
    body: 'Boot the local Docker stack used by mobile + Admin.',
    command: 'npm run supabase:start',
  },
  {
    title: 'Apply local migrations',
    body: 'Run pending SQL migrations against the local database.',
    command: 'npx supabase migration up',
  },
  {
    title: 'Bootstrap first admin',
    body: 'SQL Editor / postgres only. Fails if an admin already exists.',
    command: "select public.admin_bootstrap_grant('<user-uuid>');",
  },
  {
    title: 'Grant admin (after bootstrap)',
    body: 'As an authenticated admin session, or via Admin → Users.',
    command:
      "select public.admin_set_role('<user-uuid>', 'admin', true, 'promote');",
  },
  {
    title: 'Run Admin web app',
    body: 'From the admin package with NEXT_PUBLIC_SUPABASE_* and service role set.',
    command: 'cd admin && npm run dev',
  },
  {
    title: 'Admin typecheck / build',
    body: 'Verify the Admin package before deploy.',
    command: 'cd admin && npm run typecheck && npm run build',
  },
];

export default function CommandsPage() {
  return (
    <>
      <Topbar
        title="Ops commands"
        description="Copy-paste commands for local Admin and catalog maintenance."
      />
      <div className="space-y-4 p-8">
        {commands.map((item) => (
          <Card key={item.title} className="space-y-2">
            <h2 className="font-display text-lg font-bold text-ink">{item.title}</h2>
            <p className="text-sm text-mute">{item.body}</p>
            <pre className="overflow-x-auto rounded-[10px] bg-bone px-3 py-2.5 font-mono-metric text-xs text-ink">
              {item.command}
            </pre>
          </Card>
        ))}
      </div>
    </>
  );
}
