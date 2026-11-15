export type FeaturePoint = {
  title: string;
  description: string;
};

export type FeatureCategory = {
  id: string;
  title: string;
  summary: string;
  points: FeaturePoint[];
};

export const featureCategories: FeatureCategory[] = [
  {
    id: 'nutrition',
    title: 'Food & nutrition',
    summary:
      'A daily diary built around real meals — search foods, log servings, and see calories and macros against your targets.',
    points: [
      {
        title: 'Daily food diary',
        description:
          'Organize entries by breakfast, lunch, dinner, and snacks with a date strip for any calendar day.',
      },
      {
        title: 'Calories and macros',
        description:
          'Track calories, protein, carbohydrates, and fat. Compare day totals to your goal and optional diet presets.',
      },
      {
        title: 'Food search and recent foods',
        description:
          'Search the shared catalog and your own foods, or quickly re-log recent items.',
      },
      {
        title: 'Custom food entries',
        description:
          'Create foods manually with per-100 g or per-100 ml nutrition, serving size, and an optional photo.',
      },
      {
        title: 'Diary insights',
        description:
          'Open day and week statistics, meal breakdowns, and a monthly calorie overview from the diary.',
      },
    ],
  },
  {
    id: 'scanning',
    title: 'Barcode scanning',
    summary:
      'Scan product barcodes with your camera and confirm servings before they land in your diary.',
    points: [
      {
        title: 'Camera barcode scan',
        description:
          'Supported product barcodes include EAN-13/8, UPC-A/E, and ITF-14 with torch support when lighting is low.',
      },
      {
        title: 'Open Food Facts lookup',
        description:
          'Products are looked up via Open Food Facts. Confirm serving, meal, and date before logging.',
      },
      {
        title: 'What scanning is not',
        description:
          'Trackwise does not claim AI meal recognition or label OCR. Scanning is barcode-based product lookup.',
      },
    ],
  },
  {
    id: 'workouts',
    title: 'Workout tracking',
    summary:
      'Train with a catalog of exercises, templates, live session logging, and history you can repeat.',
    points: [
      {
        title: 'Quick start and templates',
        description:
          'Start a quick workout or use system and personal templates with optional variations.',
      },
      {
        title: 'Exercise library',
        description:
          'Browse categories, favorite exercises, and create custom exercises with optional images.',
      },
      {
        title: 'Active session logging',
        description:
          'Track sets, rest timers, volume, and estimated calorie burn, then save finished workouts.',
      },
      {
        title: 'History',
        description:
          'Review past sessions, open details, delete mistakes, or repeat a workout.',
      },
    ],
  },
  {
    id: 'widgets',
    title: 'Home-screen widgets',
    summary:
      'See today’s calories and workout on the Android home screen — then tap to open Trackwise.',
    points: [
      {
        title: 'Trackwise Daily',
        description:
          'Calories remaining plus carbs, protein, fat, and water as eaten/target cards with progress bars. Fiber is not on the widget.',
      },
      {
        title: 'Trackwise Workout',
        description:
          'Today’s planned session or the workout you already finished, without opening the app first.',
      },
      {
        title: 'How to add them',
        description:
          'Install from Google Play, sign in, and open Trackwise once. Long-press the home screen → Widgets → Trackwise, then add Daily and/or Workout. Tap Daily for the diary or Workout for today’s session.',
      },
    ],
  },
  {
    id: 'goals',
    title: 'Personal goals',
    summary:
      'Set up lose, maintain, or gain goals with calorie and macro targets tailored during onboarding.',
    points: [
      {
        title: 'Guided setup',
        description:
          'Configure goal type, body details, activity, exercise habits, target weight, and pace.',
      },
      {
        title: 'Editable targets',
        description:
          'Adjust daily calories and protein, carbs, and fat targets anytime from Goals.',
      },
      {
        title: 'Safety-aware setup',
        description:
          'Setup includes safety prompts (for example pregnancy or minors) that can route you to manual calorie targets.',
      },
    ],
  },
  {
    id: 'progress',
    title: 'Progress & measurements',
    summary:
      'See nutrition, training, and body trends over 7, 30, or 90 days — and log the measurements that matter to you.',
    points: [
      {
        title: 'Progress dashboard',
        description:
          'Average intake vs goal, workout sessions, estimated burn, and body changes in one overview.',
      },
      {
        title: 'Body measurements',
        description:
          'Log weight, neck, waist, hip, bicep, thigh, optional body fat, and notes by date.',
      },
      {
        title: 'Derived estimates',
        description:
          'When inputs allow, preview body composition with a US Navy method and BMI from weight and height. These remain estimates.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account & control',
    summary:
      'Your data stays under your account with export, import, deletion options, and everyday preferences.',
    points: [
      {
        title: 'Profile and preferences',
        description:
          'Update profile details, units (metric/imperial), appearance (light/dark), and language.',
      },
      {
        title: 'Privacy tools',
        description:
          'Export a JSON backup, import data, delete account data, or delete your entire account.',
      },
      {
        title: 'Secure sign-in',
        description:
          'Email and password with verification codes, optional Google sign-in, and password recovery.',
      },
    ],
  },
];

export const howItWorksSteps = [
  {
    step: 1,
    title: 'Set up your personal goals',
    description:
      'Create an account and complete setup: goal type, body details, activity, and targets. Trackwise estimates a starting calorie and macro plan you can edit.',
  },
  {
    step: 2,
    title: 'Track your food and workouts',
    description:
      'Log meals from search, recent foods, custom entries, or barcode scan. Train with the library or templates and save finished sessions.',
  },
  {
    step: 3,
    title: 'Understand your progress',
    description:
      'Check daily diary balance, diary statistics, and Progress trends for nutrition, workouts, and body measurements over 7, 30, or 90 days.',
  },
] as const;
