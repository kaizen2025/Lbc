import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@cardtrade/i18n";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function TransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const tx = trpc.transactions.byId.useQuery(
    { id: id! },
    { enabled: !!id, refetchInterval: 5000 },
  );
  const [code, setCode] = useState("");
  const validate = trpc.transactions.validate.useMutation({
    onSuccess: () => void utils.transactions.byId.invalidate(),
  });

  if (!tx.data) {
    return (
      <Screen>
        <Muted>{tx.isError ? t("common.error") : t("common.loading")}</Muted>
      </Screen>
    );
  }

  const item = tx.data;
  const title = item.listing.card?.name ?? item.listing.sealedProduct?.name ?? "—";
  const done = item.status === "completed";

  return (
    <Screen>
      <SectionTitle>{t("tx.title")}</SectionTitle>
      <Card>
        <Text style={styles.itemTitle}>{title}</Text>
        {item.amountCents > 0 && (
          <Text style={styles.price}>
            {formatCurrency(item.amountCents, item.currency, i18n.language)}
            {"  "}
            <Muted>
              {t("transaction.fee", {
                fee: formatCurrency(item.feeCents, item.currency, i18n.language),
              })}
            </Muted>
          </Text>
        )}
        <Text style={styles.status}>{t(`tx.status.${item.status}`)}</Text>
        <Muted>{t("transaction.meetInPublic")}</Muted>
      </Card>

      {done ? (
        <Card>
          <Text style={styles.completed}>{t("tx.completed")}</Text>
        </Card>
      ) : (
        <>
          <SectionTitle>{t("tx.myQr")}</SectionTitle>
          <Card style={styles.qrCard}>
            <Text style={styles.code}>{item.myCode ?? "—"}</Text>
            <Muted>{t("tx.showQr")}</Muted>
            {item.otherHasValidatedMe && <Muted>{t("tx.youValidated")}</Muted>}
          </Card>

          <SectionTitle>{t("transaction.scanQr")}</SectionTitle>
          <Card>
            <TextInput
              style={formStyles.input}
              placeholder={t("tx.enterCode")}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              value={code}
              onChangeText={setCode}
            />
            <Pressable
              style={formStyles.cta}
              disabled={validate.isPending || code.length < 6}
              onPress={() => validate.mutate({ transactionId: item.id, code })}
            >
              <Text style={formStyles.ctaText}>{t("tx.validate")}</Text>
            </Pressable>
            {item.iAmValidated && !done && <Muted>{t("tx.youValidated")}</Muted>}
            {validate.isError && <Muted>{validate.error.message}</Muted>}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  itemTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  price: { color: colors.accent, fontSize: 20, fontWeight: "800" },
  status: { color: colors.gold, fontSize: 15, fontWeight: "700" },
  completed: { color: colors.positive, fontSize: 17, fontWeight: "700" },
  qrCard: { alignItems: "center" },
  code: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 4,
    fontVariant: ["tabular-nums"],
  },
});
