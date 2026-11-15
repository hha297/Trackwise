import Link from 'next/link';

import { Topbar } from '@/components/layout/topbar';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function SettingsPage() {
  const supabase = await createClient();

  const [
    { count: exerciseCount },
    { count: missingDescription },
    { count: missingImagePath },
    { count: missingImageKey },
    { count: archivedCount },
    { count: foodCount },
    { count: flagCount },
    { count: auditCount },
  ] = await Promise.all([
    supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
      .is('archived_at', null),
    supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
      .is('archived_at', null)
      .or('description.is.null,description.eq.'),
    supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
      .is('archived_at', null)
      .is('image_storage_path', null),
    supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
      .is('archived_at', null)
      .is('image_key', null),
    supabase
      .from('exercises')
      .select('*', { count: 'exact', head: true })
      .eq('is_system', true)
      .not('archived_at', 'is', null),
    supabase
      .from('foods')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'system')
      .is('archived_at', null),
    supabase.from('feature_flags').select('*', { count: 'exact', head: true }),
    supabase.from('admin_audit_logs').select('*', { count: 'exact', head: true }),
  ]);

  const metrics = [
    { label: 'Active system exercises', value: exerciseCount ?? 0, href: '/exercises' },
    {
      label: 'Missing overview (description)',
      value: missingDescription ?? 0,
      href: '/exercises',
    },
    {
      label: 'Missing image_storage_path',
      value: missingImagePath ?? 0,
      href: '/exercises',
    },
    { label: 'Missing image_key', value: missingImageKey ?? 0, href: '/exercises' },
    { label: 'Archived exercises', value: archivedCount ?? 0, href: '/exercises?archived=1' },
    { label: 'System foods', value: foodCount ?? 0, href: '/foods' },
    { label: 'Feature flags', value: flagCount ?? 0, href: '/system/flags' },
    { label: 'Audit log rows', value: auditCount ?? 0, href: '/system/audit' },
  ];

  return (
    <>
      <Topbar
        title="Catalog health"
        description="Live counts from Supabase — use these to spot incomplete catalog rows."
      />
      <div className="space-y-4 p-8">
        <Card className="space-y-2 text-sm text-mute">
          <p>
            Replace system exercise artwork from <strong className="text-ink">Exercises</strong>{' '}
            (uploads go to the <code className="font-mono-metric text-ink">exercise-images</code>{' '}
            bucket). Keep matching files under the mobile{' '}
            <code className="font-mono-metric text-ink">assets/images/workout/exercises/</code>{' '}
            tree for offline fallbacks.
          </p>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Link key={metric.label} href={metric.href}>
              <Card className="transition hover:border-primary/40">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">
                  {metric.label}
                </div>
                <div className="mt-3 font-mono-metric text-3xl font-bold text-ink">
                  {metric.value}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
