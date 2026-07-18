import type { PropsWithChildren } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../theme";

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.scrollContent}>{children}</View>
  );
  return <SafeAreaView style={styles.screen}>{content}</SafeAreaView>;
}

export function SectionTitle({ children }: PropsWithChildren) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Muted({ children }: PropsWithChildren) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function PriceChange({
  cents,
  percent,
  currency = "EUR",
}: {
  cents: number;
  percent?: number;
  currency?: "EUR" | "USD";
}) {
  const positive = cents >= 0;
  const symbol = currency === "USD" ? "$" : "€";
  return (
    <Text style={[styles.priceChange, { color: positive ? colors.positive : colors.negative }]}>
      {positive ? "▲" : "▼"} {(Math.abs(cents) / 100).toFixed(2)} {symbol}
      {percent != null ? ` (${Math.abs(percent).toFixed(2)} %)` : ""}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: "600",
  },
});
