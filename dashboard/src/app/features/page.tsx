import type { ReactNode } from 'react';

import { DiaryMock } from '@/components/mockups/diary-mock';
import { GoalsMock } from '@/components/mockups/goals-mock';
import { ProgressMock } from '@/components/mockups/progress-mock';
import { ScanMock } from '@/components/mockups/scan-mock';
import { WorkoutMock } from '@/components/mockups/workout-mock';
import { Button } from '@/components/ui/button';
import { featureCategories } from '@/content/features';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  title: 'Features',
  description:
    'Explore Trackwise features: food diary, barcode scanning, workouts, home-screen widgets, goals, progress, and account controls.',
  path: '/features',
});

const mockById: Record<string, ReactNode> = {
  nutrition: <DiaryMock label="" className="w-[240px]" />,
  scanning: <ScanMock label="" />,
  workouts: <WorkoutMock label="" className="w-[240px]" />,
  goals: <GoalsMock label="" className="w-[240px]" />,
  progress: <ProgressMock label="" className="w-[240px]" />,
};

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-hairline bg-bone/50">
        <div className="container-site py-16 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-mute">Features</p>
          <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.5rem,6vw,4rem)] font-extrabold leading-[0.98] tracking-tight text-ink">
            Everything Trackwise can do today.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-body">
            A deeper look at nutrition, scanning, workouts, home-screen widgets, goals, progress,
            and account tools — based on the shipping mobile app, not a wishlist.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {featureCategories.map((category) => (
              <a
                key={category.id}
                href={`#${category.id}`}
                className="rounded-full border border-hairline bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-bone"
              >
                {category.title}
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="container-site py-16 sm:py-20">
        <div className="space-y-20">
          {featureCategories.map((category, index) => (
            <section
              key={category.id}
              id={category.id}
              className="scroll-mt-28 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]"
            >
              <div className={index % 2 === 1 ? 'lg:order-2' : undefined}>
                <p className="font-metric text-sm font-bold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                  {category.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-body">{category.summary}</p>
                <div className="mt-8 space-y-5">
                  {category.points.map((point) => (
                    <div key={point.title} className="border-l-2 border-primary/40 pl-4">
                      <h3 className="text-base font-bold text-ink">{point.title}</h3>
                      <p className="mt-1 text-[15px] leading-relaxed text-body">
                        {point.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className={`flex justify-center rounded-[24px] border border-hairline bg-bone/60 p-8 ${index % 2 === 1 ? 'lg:order-1' : ''
                  }`}
              >
                {mockById[category.id] ?? (
                  <div className="max-w-sm text-center text-sm text-mute">
                    {category.id === 'widgets'
                      ? 'On Android: long-press the home screen → Widgets → Trackwise. Add Daily or Workout, then tap to open the app.'
                      : 'Account controls live in the Account tab: profile, export/import, deletion, units, language, and appearance.'}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 rounded-[24px] bg-ink px-8 py-10 text-card sm:px-12">
          <h2 className="font-display text-3xl font-bold tracking-tight">Ready to try Trackwise?</h2>
          <p className="mt-3 max-w-xl text-white/70">
            Trackwise is free on Android via Google Play. After you install it, add the Daily or
            Workout widget from the home screen. iOS comes later.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/#download">Download</Button>
            <Button href="/feedback" variant="secondary" className="border-transparent">
              Send feedback
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
