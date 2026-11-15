import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';

/**
 * Trackwise type stack (DESIGN.MD):
 * - Display + body/UI: Bricolage Grotesque
 * - Mono: JetBrains Mono (metrics)
 *
 * `dm*` / `ibm*` aliases kept so existing call sites keep resolving.
 */
export const fonts = {
  displayMedium: 'BricolageGrotesque_500Medium',
  displaySemiBold: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayExtraBold: 'BricolageGrotesque_800ExtraBold',
  bodyRegular: 'BricolageGrotesque_400Regular',
  bodyMedium: 'BricolageGrotesque_500Medium',
  bodySemiBold: 'BricolageGrotesque_600SemiBold',
  bodyBold: 'BricolageGrotesque_700Bold',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemiBold: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
  /** @deprecated Prefer display* / body* — aliases for older call sites. */
  ibmRegular: 'BricolageGrotesque_400Regular',
  ibmMedium: 'BricolageGrotesque_500Medium',
  ibmSemiBold: 'BricolageGrotesque_600SemiBold',
  ibmBold: 'BricolageGrotesque_700Bold',
  dmRegular: 'BricolageGrotesque_400Regular',
  dmMedium: 'BricolageGrotesque_500Medium',
  dmSemiBold: 'BricolageGrotesque_600SemiBold',
  dmBold: 'BricolageGrotesque_700Bold',
} as const;

const fontMap = {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  ...MaterialCommunityIcons.font,
};

export function useAppFonts(): boolean {
  const [loaded] = useFonts(fontMap);
  return loaded;
}
