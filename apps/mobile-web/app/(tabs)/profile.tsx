import { Pressable, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { normalizeLanguage } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { useSession } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  const transactions = trpc.transactions.mine.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });

  const currentLanguage = normalizeLanguage(i18n.language);
  const nextLanguage = currentLanguage === "fr" ? "en" : "fr";

  return (
    <Screen>
      <SectionTitle>{t("tabs.profile")}</SectionTitle>

      {!session && (
        <Card>
          <Muted>{t("auth.signInRequired")}</Muted>
          <Link href="/auth" asChild>
            <Pressable style={formStyles.cta}>
              <Text style={formStyles.ctaText}>{t("auth.signIn")}</Text>
            </Pressable>
          </Link>
        </Card>
      )}

      {session && me.data?.profile && (
        <Card>
          <Text style={styles.username}>@{me.data.profile.username}</Text>
          <Muted>
            {me.data.profile.city ?? "—"} ·{" "}
            {t("profile.trades", { count: me.data.profile.tradeCount })}
          </Muted>
          <Link href="/profile-edit" asChild>
            <Pressable>
              <Text style={styles.link}>{t("profileEdit.title")} →</Text>
            </Pressable>
          </Link>
        </Card>
      )}

      <Link href="/paywall" asChild>
        <Pressable>
          <Card style={styles.proCard}>
            <Text style={styles.proTitle}>{t("paywall.title")}</Text>
            <Muted>{t("paywall.subtitle")}</Muted>
          </Card>
        </Pressable>
      </Link>

      {session && (transactions.data?.length ?? 0) > 0 && (
        <>
          <SectionTitle>{t("tx.title")}</SectionTitle>
          {transactions.data?.map((tx) => (
            <Link key={tx.id} href={`/transaction/${tx.id}`} asChild>
              <Pressable>
                <Card>
                  <Text style={styles.txTitle}>
                    {tx.listing.card?.name ?? tx.listing.sealedProduct?.name ?? "—"}
                  </Text>
                  <Muted>{t(`tx.status.${tx.status}`)}</Muted>
                </Card>
              </Pressable>
            </Link>
          ))}
        </>
      )}

      <SectionTitle>{t("profile.settings")}</SectionTitle>
      <Card>
        <Muted>{t("profile.language")}</Muted>
        <Pressable onPress={() => void i18n.changeLanguage(nextLanguage)}>
          <Text style={styles.link}>
            {currentLanguage === "fr" ? "Français → English" : "English → Français"}
          </Text>
        </Pressable>
      </Card>
      {session && (
        <Card>
          <Pressable onPress={() => void supabase.auth.signOut()}>
            <Text style={styles.signOut}>{t("profile.signOut")}</Text>
          </Pressable>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  username: { color: colors.text, fontSize: 18, fontWeight: "700" },
  link: { color: colors.accent, fontSize: 16, fontWeight: "600" },
  signOut: { color: colors.negative, fontSize: 16, fontWeight: "600" },
  proCard: { borderColor: colors.gold },
  proTitle: { color: colors.gold, fontSize: 18, fontWeight: "800" },
  txTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
