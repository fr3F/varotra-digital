import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '@/core/i18n/i18n';
import { colors, fontSize, radius, spacing } from '@/core/theme/theme';
import { onboardingService } from '@/services/onboarding.service';
import { AppButton } from '@/shared/components/AppButton';
import { onboardingMessages } from './onboarding.messages';

/** Guide du premier lancement : quelques étapes, puis il ne s'affiche plus jamais. */
export function OnboardingScreen() {
  const t = useMessages(onboardingMessages);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const step = t.steps[index] ?? t.steps[0];
  const last = index === t.steps.length - 1;

  const finish = async () => {
    await onboardingService.complete();
    router.replace('/');
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.top}>
        <Text style={styles.counter}>{t.stepOf(index + 1, t.steps.length)}</Text>
        {!last ? (
          <Pressable accessibilityRole="button" onPress={() => void finish()} hitSlop={12}>
            <Text style={styles.skip}>{t.skip}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{step?.title}</Text>
        <Text style={styles.text}>{step?.text}</Text>
      </View>

      <View style={styles.dots}>
        {t.steps.map((item, dot) => (
          <View key={item.title} style={[styles.dot, dot === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.actions}>
        {last ? (
          <AppButton label={t.start} onPress={() => void finish()} />
        ) : (
          <AppButton label={t.next} onPress={() => setIndex((value) => value + 1)} />
        )}
        {index > 0 ? <AppButton label={t.back} variant="secondary" onPress={() => setIndex((value) => value - 1)} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textMuted },
  skip: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  body: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  text: { fontSize: fontSize.lg, lineHeight: 26, color: colors.text },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  dotActive: { width: 24, backgroundColor: colors.primary },
  actions: { gap: spacing.sm },
});
