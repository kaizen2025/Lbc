import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen, SectionTitle } from "../src/components/ui";
import { trpc } from "../src/lib/trpc";
import { colors, spacing } from "../src/theme";

export default function AdminScreen() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const stats = trpc.admin.stats.useQuery(undefined, { retry: false });
  const reports = trpc.admin.reports.useQuery(undefined, { retry: false });
  const disputes = trpc.admin.disputes.useQuery(undefined, { retry: false });
  const recentUsers = trpc.admin.recentUsers.useQuery(undefined, { retry: false });

  const resolveReport = trpc.admin.resolveReport.useMutation({
    onSuccess: () => void utils.admin.invalidate(),
  });
  const resolveDispute = trpc.admin.resolveDispute.useMutation({
    onSuccess: () => void utils.admin.invalidate(),
  });

  if (stats.isError) {
    return (
      <Screen>
        <Muted>{t("common.error")}</Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle>{t("admin.title")}</SectionTitle>
      {stats.data && (
        <Card>
          <Text style={styles.stats}>
            {t("admin.stats", {
              users: stats.data.users,
              listings: stats.data.listings_active,
              tx: stats.data.transactions_completed,
            })}
          </Text>
        </Card>
      )}

      <SectionTitle>{t("admin.reports")}</SectionTitle>
      {reports.data?.length === 0 && <Muted>{t("admin.noReports")}</Muted>}
      {reports.data?.map((report) => (
        <Card key={report.id}>
          <Text style={styles.reason}>{report.reason}</Text>
          <Muted>
            {report.listingId ? `Annonce ${report.listingId.slice(0, 8)}` : ""}
            {report.reportedUserId ? ` · User ${report.reportedUserId.slice(0, 8)}` : ""}
          </Muted>
          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                resolveReport.mutate({ id: report.id, action: "reviewed" })
              }
            >
              <Text style={styles.actionOk}>{t("admin.review")}</Text>
            </Pressable>
            {report.listingId && (
              <Pressable
                onPress={() =>
                  resolveReport.mutate({
                    id: report.id,
                    action: "reviewed",
                    cancelListing: true,
                  })
                }
              >
                <Text style={styles.actionDanger}>{t("admin.reviewAndCancel")}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() =>
                resolveReport.mutate({ id: report.id, action: "dismissed" })
              }
            >
              <Text style={styles.actionMuted}>{t("admin.dismiss")}</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <SectionTitle>{t("admin.disputes")}</SectionTitle>
      {disputes.data?.length === 0 && <Muted>{t("admin.noDisputes")}</Muted>}
      {disputes.data?.map((dispute) => (
        <Card key={dispute.id}>
          <Text style={styles.reason}>{dispute.reason}</Text>
          <Muted>Transaction {dispute.transactionId.slice(0, 8)}</Muted>
          <View style={styles.actions}>
            <Pressable
              onPress={() =>
                resolveDispute.mutate({ id: dispute.id, action: "resolved_refund" })
              }
            >
              <Text style={styles.actionDanger}>{t("admin.refund")}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                resolveDispute.mutate({ id: dispute.id, action: "resolved_release" })
              }
            >
              <Text style={styles.actionOk}>{t("admin.release")}</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <SectionTitle>{t("admin.recentUsers")}</SectionTitle>
      {recentUsers.data?.map((user) => (
        <Card key={user.userId}>
          <Text style={styles.reason}>
            @{user.username} · {user.email}
          </Text>
          <Muted>
            {user.city ?? "—"} · {user.tradeCount} trades ·{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { color: colors.text, fontSize: 15, fontWeight: "700" },
  reason: { color: colors.text, fontSize: 15, fontWeight: "600" },
  actions: { flexDirection: "row", gap: spacing.md, flexWrap: "wrap" },
  actionOk: { color: colors.accent, fontWeight: "700", fontSize: 14 },
  actionDanger: { color: colors.negative, fontWeight: "700", fontSize: 14 },
  actionMuted: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
});
