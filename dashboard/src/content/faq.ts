export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const homeFaq: FaqItem[] = [
  {
    id: 'what-is',
    question: 'What is Trackwise?',
    answer:
      'Trackwise is a mobile app for everyday nutrition and fitness tracking. Log meals, scan barcodes, track workouts, set personal goals, and review progress over time — all in one place.',
  },
  {
    id: 'free',
    question: 'Is Trackwise free?',
    answer:
      'Yes. Trackwise is free for everyday calorie, macro, meal, and workout tracking. There is no paid plan required right now.',
  },
  {
    id: 'android',
    question: 'Is Trackwise available on Android?',
    answer:
      'Yes. Trackwise is on Google Play: play.google.com/store/apps/details?id=com.trackwise.app. Android is the supported platform for now.',
  },
  {
    id: 'widgets',
    question: 'Does Trackwise have home-screen widgets?',
    answer:
      'Yes, on Android. After you install Trackwise and sign in, long-press the home screen → Widgets → Trackwise. Add Trackwise Daily (calories, carbs, protein, fat, water) or Trackwise Workout (today’s plan or session). Open the app once so today’s numbers can sync, then tap a widget to jump back into Trackwise. Widgets are not in Expo Go, and iOS widgets ship later with the iOS app.',
  },
  {
    id: 'ios',
    question: 'Is Trackwise available on iOS?',
    answer:
      'Not yet. iOS is planned for later — there is no App Store build today. Android is the supported platform for now.',
  },
  {
    id: 'macros',
    question: 'Can I track calories and macros?',
    answer:
      'Yes. Trackwise logs calories, protein, carbohydrates, and fat for each food entry and shows daily totals against your personal targets.',
  },
  {
    id: 'workouts',
    question: 'Can I log workouts?',
    answer:
      'Yes. Browse the exercise library, start quick workouts or templates, log sets, and review workout history with estimated calorie burn.',
  },
  {
    id: 'goals',
    question: 'Can I set personal goals?',
    answer:
      'Yes. During setup you choose lose, maintain, or gain weight goals. You can adjust daily calorie and macro targets anytime from Goals in the app.',
  },
  {
    id: 'measurements',
    question: 'Can I track body measurements?',
    answer:
      'Yes. Log weight and body circumferences (such as waist, hip, and others), review BMI when height is available, and see trends on the Progress tab.',
  },
  {
    id: 'delete-account',
    question: 'How can I delete my account?',
    answer:
      'In the Trackwise app, open Account → Privacy & data → Delete account, then confirm. This permanently removes your account and associated data via the app’s deletion flow. You can also delete account data while keeping your login, or export a backup first. Full steps and email requests: trackwise.one/delete-account.',
  },
  {
    id: 'medical',
    question: 'Is Trackwise a medical application?',
    answer:
      'No. Trackwise provides everyday nutrition and activity tracking estimates. These estimates are not medical measurements and are not medical advice. Talk to a qualified professional for health decisions.',
  },
];

export const supportFaq: FaqItem[] = [
  ...homeFaq,
  {
    id: 'scan',
    question: 'How does barcode scanning work?',
    answer:
      'Open the Scan tab, point your camera at a product barcode (EAN/UPC), and Trackwise looks up the product via Open Food Facts. Confirm the serving and meal, then log it to your diary. Scanning does not use AI meal recognition or label OCR.',
  },
  {
    id: 'export',
    question: 'Can I export or import my data?',
    answer:
      'Yes. From Account you can export a JSON backup of your profile, goals, food entries, workouts, measurements, and related data. You can also import a backup to merge or replace data on the device.',
  },
  {
    id: 'languages',
    question: 'Which languages are supported?',
    answer:
      'The app currently supports English, Finnish, Swedish, and Vietnamese. Change language under Account → Language.',
  },
  {
    id: 'sign-in',
    question: 'How do I sign in?',
    answer:
      'Create an account with email and password, verify with the email code, or sign in with Google when that option is available on your device. Password recovery uses an email verification code flow.',
  },
];
