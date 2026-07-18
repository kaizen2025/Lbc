import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, Screen } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { colors, radius, spacing } from "../src/theme";

const FEATURES: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "usMarket", icon: "globe-outline" },
  { key: "fullHistory", icon: "trending-up-outline" },
  { key: "pnl", icon: "stats-chart-outline" },
  { key: "unlimitedCollection", icon: "albums-outline" },
  { key: "unlimitedScans", icon: "scan-outline" },
  { key: "alerts", icon: "notifications-outline" },
  { key: "filters", icon: "options-outline" },
  { key: "export", icon: "download-outline" },
  { key: "weekly", icon: "calendar-outline" },
  { key: "themes", icon: "color-palette-outline" },
];

export default function PaywallScreen() {
  const { t, i18n } = useTranslation();
  const plans = trpc.subscription.plans.useQuery();
  const [selected, setSelected] = useState<"yearly" | "monthly">("yearly");
  const [notice, setNotice] = useState(false);

  const pricing = plans.data?.pricing;

  return (
    <Screen>
      <Text style={styles.title}>{t("paywall.title")}</Text>
      <Muted>{t("paywall.subtitle")}</Muted>

      <Card>
        {FEATURES.map(({ key, icon }, index) => (
          <View
            key={key}
            style={[styles.featureRow, index > 0 && styles.featureRowBorder]}
          >
            <Ionicons name={icon} size={26} color={colors.accent} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>
                {t(`paywall.features.${key}.title`)}
              </Text>
              <Muted>{t(`paywall.features.${key}.subtitle`)}</Muted>
            </View>
          </View>
        ))}
      </Card>

      {pricing && (
        <View style={styles.plansRow}>
          <Pressable
            onPress={() => setSelected("yearly")}
            style={[styles.planCard, selected === "yearly" && styles.planCardSelected]}
          >
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>
                {t("paywall.savePercent", {
                  percent: pricing.yearly.savingsPercent,
                })}
              </Text>
            </View>
            <Text style={styles.planName}>{t("paywall.yearly")}</Text>
            <Text style={styles.planPrice}>
              {t("paywall.perYear", {
                price: formatCurrency(
                  pricing.yearly.priceCents,
                  pricing.currency,
                  i18n.language,
                ),
              })}
            </Text>
            <Muted>
              {t("paywall.billedAnnually", {
                price: formatCurrency(
                  pricing.yearly.equivalentMonthlyCents,
                  pricing.currency,
                  i18n.language,
                ),
              })}
            </Muted>
          </Pressable>

          <Pressable
            onPress={() => setSelected("monthly")}
            style={[styles.planCard, selected === "monthly" && styles.planCardSelected]}
          >
            <Text style={styles.planName}>{t("paywall.monthly")}</Text>
            <Text style={styles.planPrice}>
              {t("paywall.perMonth", {
                price: formatCurrency(
                  pricing.monthly.priceCents,
                  pricing.currency,
                  i18n.language,
                ),
              })}
            </Text>
            <Muted>{t("paywall.billedMonthly")}</Muted>
          </Pressable>
        </View>
      )}

      <Pressable style={styles.cta} onPress={() => setNotice(true)}>
        <Text style={styles.ctaText}>{t("paywall.cta")}</Text>
      </Pressable>
      {notice && (
        <Card>
          <Muted>{t("paywall.comingSoon")}</Muted>
        </Card>
      )}
      <Muted>{t("paywall.terms")}</Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: "800" },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  featureRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  plansRow: { flexDirection: "row", gap: spacing.md },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 2,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: "center",
  },
  planCardSelected: { borderColor: colors.accent },
  saveBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  saveBadgeText: { color: colors.background, fontWeight: "800", fontSize: 12 },
  planName: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  planPrice: { color: colors.text, fontSize: 22, fontWeight: "800" },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  ctaText: { color: colors.background, fontSize: 18, fontWeight: "800" },
});
