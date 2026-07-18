import { useState } from "react";
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
  const alerts = trpc.alerts.list.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  const utils = trpc.useUtils();
  const removeAlert = trpc.alerts.remove.useMutation({
    onSuccess: () => void utils.alerts.list.invalidate(),
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAccount = trpc.profile.deleteAccount.useMutation({
    onSuccess: () => void supabase.auth.signOut(),
  });
  const subStatus = trpc.subscription.status.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  // Visible uniquement si le serveur confirme le rôle admin (FORBIDDEN sinon).
  const adminCheck = trpc.admin.stats.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });
  const cancelSub = trpc.subscription.cancel.useMutation({
    onSuccess: () => void utils.subscription.status.invalidate(),
  });
  const resumeSub = trpc.subscription.resume.useMutation({
    onSuccess: () => void utils.subscription.status.invalidate(),
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

      {session && subStatus.data && (
        <>
          <SectionTitle>{t("sub.title")}</SectionTitle>
          <Card>
            <Text style={subStatus.data.isPro ? styles.proTitle : styles.username}>
              {subStatus.data.isPro ? t("sub.proPlan") : t("sub.freePlan")}
            </Text>
            {subStatus.data.subscription && (
              <Muted>
                {subStatus.data.subscription.cancelAtPeriodEnd
                  ? t("sub.endsOn", {
                      date: new Date(
                        subStatus.data.subscription.currentPeriodEnd,
                      ).toLocaleDateString(i18n.language),
                    })
                  : t("sub.renewsOn", {
                      date: new Date(
                        subStatus.data.subscription.currentPeriodEnd,
                      ).toLocaleDateString(i18n.language),
                    })}
              </Muted>
            )}
            {subStatus.data.subscription ? (
              subStatus.data.subscription.cancelAtPeriodEnd ? (
                <Pressable
                  disabled={resumeSub.isPending}
                  onPress={() => resumeSub.mutate()}
                >
                  <Text style={styles.link}>{t("sub.resume")}</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    disabled={cancelSub.isPending}
                    onPress={() => cancelSub.mutate()}
                  >
                    <Text style={styles.signOut}>{t("sub.cancel")}</Text>
                  </Pressable>
                  <Muted>{t("sub.cancelInfo")}</Muted>
                </>
              )
            ) : (
              <Link href="/paywall" asChild>
                <Pressable>
                  <Text style={styles.link}>{t("sub.upgrade")} →</Text>
                </Pressable>
              </Link>
            )}
          </Card>
        </>
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

      {session && (alerts.data?.length ?? 0) > 0 && (
        <>
          <SectionTitle>{t("alerts.title")}</SectionTitle>
          {alerts.data?.map((alert) => (
            <Card key={alert.id}>
              <Text style={styles.txTitle}>
                {alert.card?.name ?? alert.sealedProduct?.name ?? "—"}
                {alert.cardLanguage ? ` · ${alert.cardLanguage.toUpperCase()}` : ""}
              </Text>
              <Pressable onPress={() => removeAlert.mutate({ id: alert.id })}>
                <Text style={styles.signOut}>{t("alerts.delete")}</Text>
              </Pressable>
              {removeAlert.isError && <Muted>{removeAlert.error.message}</Muted>}
            </Card>
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
      {adminCheck.isSuccess && adminCheck.data && (
        <Link href="/admin" asChild>
          <Pressable>
            <Card style={styles.proCard}>
              <Text style={styles.proTitle}>⚙️ {t("admin.title")}</Text>
              {(adminCheck.data.reports_open > 0 ||
                adminCheck.data.disputes_open > 0) && (
                <Muted>
                  {adminCheck.data.reports_open + adminCheck.data.disputes_open} à
                  traiter
                </Muted>
              )}
            </Card>
          </Pressable>
        </Link>
      )}

      <Link href="/legal" asChild>
        <Pressable>
          <Card>
            <Text style={styles.link}>{t("account.legal")} →</Text>
          </Card>
        </Pressable>
      </Link>
      {session && (
        <Card>
          <Link href="/change-password" asChild>
            <Pressable>
              <Text style={styles.link}>{t("password.change")} →</Text>
            </Pressable>
          </Link>
          <Pressable onPress={() => void supabase.auth.signOut()}>
            <Text style={styles.signOut}>{t("profile.signOut")}</Text>
          </Pressable>
          <Pressable
            disabled={deleteAccount.isPending}
            onPress={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              deleteAccount.mutate();
            }}
          >
            <Text style={styles.signOut}>
              {deleteAccount.isPending ? t("common.loading") : t("account.delete")}
            </Text>
          </Pressable>
          {confirmDelete && !deleteAccount.isPending && (
            <Muted>{t("account.deleteWarning")}</Muted>
          )}
          {deleteAccount.isError && <Muted>{deleteAccount.error.message}</Muted>}
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
