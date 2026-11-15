export type SupportTopic = {
  id: string;
  title: string;
  summary: string;
  items: { heading: string; body: string }[];
};

export const supportTopics: SupportTopic[] = [
  {
    id: 'account',
    title: 'Account and login',
    summary: 'Sign-up, verification, recovery, and profile basics.',
    items: [
      {
        heading: 'Create an account',
        body: 'Use email and password on the sign-up screen, then enter the verification code from your email. Google sign-in is available when configured on your device.',
      },
      {
        heading: 'Forgot password',
        body: 'Use Forgot password, enter your email, then complete the recovery code and set a new password. Stay in the recovery flow until it finishes.',
      },
      {
        heading: 'Update profile',
        body: 'Open Account → Edit profile to change display name, height, sex, birth date, activity level, units, and avatar.',
      },
    ],
  },
  {
    id: 'food',
    title: 'Food tracking',
    summary: 'Diary logging, search, custom foods, and barcode scan.',
    items: [
      {
        heading: 'Log a meal',
        body: 'From the Diary tab, pick a meal and add food. Search the catalog, pick a recent food, create a custom food, or open Scan.',
      },
      {
        heading: 'Edit or delete entries',
        body: 'Tap an entry to adjust serving or amount. Use delete with confirmation when you need to remove a log.',
      },
      {
        heading: 'Barcode scan',
        body: 'Open Scan, allow camera access, and scan a product barcode. Confirm serving, meal, and date before saving. Lookup uses Open Food Facts — not AI photo recognition.',
      },
    ],
  },
  {
    id: 'workout',
    title: 'Workout tracking',
    summary: 'Library, templates, active sessions, and history.',
    items: [
      {
        heading: 'Start a workout',
        body: 'From Workout, choose Quick workout or a template. Add exercises, log sets, use rest timers, and finish to save.',
      },
      {
        heading: 'Browse exercises',
        body: 'Open the exercise library by category, favorite exercises you use often, or create a custom exercise.',
      },
      {
        heading: 'History',
        body: 'Open History to review past sessions, inspect details, delete, or repeat a workout.',
      },
    ],
  },
  {
    id: 'goals-progress',
    title: 'Goals and progress',
    summary: 'Targets, measurements, and trend views.',
    items: [
      {
        heading: 'Change goals',
        body: 'Open Account → Goal (or Goals) to edit goal type, daily calories, target weight, and macro targets.',
      },
      {
        heading: 'Log measurements',
        body: 'Open Measurements to log weight and circumferences by date. Progress shows 7 / 30 / 90 day trends when data exists.',
      },
      {
        heading: 'Estimates disclaimer',
        body: 'Calories, burn, BMI, and body-composition previews are everyday estimates — not medical measurements.',
      },
    ],
  },
  {
    id: 'widgets',
    title: 'Home-screen widgets',
    summary: 'Add Daily or Workout widgets on Android.',
    items: [
      {
        heading: 'What you get',
        body: 'Trackwise Daily shows calories remaining and carbs, protein, fat, and water. Trackwise Workout shows today’s plan or completed session. Numbers are estimates from the last time you opened the app.',
      },
      {
        heading: 'How to add a widget',
        body: 'Install Trackwise from Google Play, sign in, and open the app once. Long-press an empty area on the Android home screen, choose Widgets, find Trackwise, and add Daily or Workout. Resize if your launcher allows it.',
      },
      {
        heading: 'Tap to open',
        body: 'Tap Daily to open the diary. Tap Workout to open today’s plan or session. If the widget still shows dashes, open Trackwise while signed in so it can refresh the snapshot.',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical troubleshooting',
    summary: 'Common device and connectivity issues.',
    items: [
      {
        heading: 'Camera permission for Scan',
        body: 'If Scan cannot open, enable camera permission for Trackwise in your device settings, then return to the Scan tab.',
      },
      {
        heading: 'Sign-in or sync issues',
        body: 'Confirm you have an internet connection. Sign out and sign back in if session state looks wrong. Local drafts for an active workout are kept on the device until you finish.',
      },
      {
        heading: 'Image uploads',
        body: 'Optional food, avatar, and custom-exercise photos must stay within the app’s size limit (1 MB). Uploads require a configured image service; if upload fails, try a smaller image or skip the photo.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy and your data',
    summary: 'Export, delete, and policy links.',
    items: [
      {
        heading: 'Export or import',
        body: 'Account → Export data downloads a JSON backup. Import can merge or replace data from a backup file.',
      },
      {
        heading: 'Delete data or account',
        body: 'Delete account data keeps your login but removes tracked records. Delete account removes the account entirely through the app’s deletion flow.',
      },
      {
        heading: 'Policies',
        body: 'Read the Privacy Policy and Terms of Use on this website, or contact support by email or phone listed on the Contact section.',
      },
    ],
  },
];
