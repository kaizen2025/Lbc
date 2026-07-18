import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { normalizeLanguage } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const me = trpc.profile.me.useQuery(undefined, { retry: false });

  const currentLanguage = normalizeLanguage(i18n.language);
  const nextLanguage = currentLanguage === "fr" ? "en" : "fr";

  return (
    <Screen>
      <SectionTitle>{t("tabs.profile")}</SectionTitle>

      {me.isError && (
        <Card>
          <Muted>{t("auth.signIn")} — connexion Supabase à brancher (Phase 1)</Muted>
        </Card>
      )}
      {me.data?.profile && (
        <Card>
          <Text style={styles.username}>@{me.data.profile.username}</Text>
          <Muted>
            {me.data.profile.city ?? "—"} ·{" "}
            {t("profile.trades", { count: me.data.profile.tradeCount })}
          </Muted>
        </Card>
      )}

      <SectionTitle>{t("profile.settings")}</SectionTitle>
      <Card>
        <Muted>{t("profile.language")}</Muted>
        <Pressable onPress={() => void i18n.changeLanguage(nextLanguage)}>
          <Text style={styles.languageSwitch}>
            {currentLanguage === "fr" ? "Français → English" : "English → Français"}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  username: { color: colors.text, fontSize: 18, fontWeight: "700" },
  languageSwitch: { color: colors.accent, fontSize: 16, fontWeight: "600" },
});
