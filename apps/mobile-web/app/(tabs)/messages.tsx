import { Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function MessagesScreen() {
  const { t } = useTranslation();
  const conversations = trpc.chat.conversations.useQuery(undefined, { retry: false });

  return (
    <Screen>
      <SectionTitle>{t("tabs.messages")}</SectionTitle>
      {conversations.isLoading && <Muted>{t("common.loading")}</Muted>}
      {conversations.isError && <Muted>{t("auth.signIn")}</Muted>}
      {conversations.data?.map((conversation) => (
        <Card key={conversation.id}>
          <Text style={styles.title}>
            {conversation.listing?.card?.name ??
              conversation.listing?.sealedProduct?.name ??
              "Conversation"}
          </Text>
          <Muted>{conversation.messages[0]?.body ?? "…"}</Muted>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
