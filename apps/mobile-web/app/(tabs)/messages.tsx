import { Pressable, StyleSheet, Text } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { Card, Muted, Screen, SectionTitle } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { useSession } from "../../src/lib/auth";
import { trpc } from "../../src/lib/trpc";
import { colors } from "../../src/theme";

export default function MessagesScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const conversations = trpc.chat.conversations.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });

  return (
    <Screen>
      <SectionTitle>{t("tabs.messages")}</SectionTitle>
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
      {conversations.isLoading && session && <Muted>{t("common.loading")}</Muted>}
      {conversations.isError && <Muted>{t("common.error")}</Muted>}
      {conversations.data?.length === 0 && <Muted>{t("chat.empty")}</Muted>}
      {conversations.data?.map((conversation) => (
        <Link key={conversation.id} href={`/conversation/${conversation.id}`} asChild>
          <Pressable>
            <Card>
              <Text style={styles.title}>
                {conversation.listing?.card?.name ??
                  conversation.listing?.sealedProduct?.name ??
                  "Conversation"}
              </Text>
              <Muted>{conversation.messages[0]?.body ?? "…"}</Muted>
            </Card>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 16, fontWeight: "600" },
});
