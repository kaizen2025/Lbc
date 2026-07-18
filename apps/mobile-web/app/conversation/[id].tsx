import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Muted, Screen } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { retry: false });

  const messages = trpc.chat.messages.useQuery(
    { conversationId: id! },
    { enabled: !!id, refetchInterval: 5000 },
  );
  const [draft, setDraft] = useState("");
  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.chat.messages.invalidate();
    },
  });

  return (
    <Screen scroll={false}>
      <View style={styles.thread}>
        {messages.data?.length === 0 && <Muted>{t("chat.empty")}</Muted>}
        {messages.data?.map((message) => {
          const mine = message.senderId === me.data?.id;
          return (
            <View
              key={message.id}
              style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
            >
              <Text style={mine ? styles.bubbleTextMine : styles.bubbleText}>
                {message.body}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.composer}>
        <TextInput
          style={[formStyles.input, styles.composerInput]}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
        />
        <Pressable
          style={formStyles.cta}
          disabled={draft.length === 0 || send.isPending}
          onPress={() => send.mutate({ conversationId: id!, body: draft })}
        >
          <Text style={formStyles.ctaText}>{t("listingDetail.send")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thread: { flex: 1, gap: spacing.sm },
  bubble: {
    maxWidth: "80%",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.accent },
  bubbleOther: { alignSelf: "flex-start", backgroundColor: colors.surface },
  bubbleText: { color: colors.text, fontSize: 15 },
  bubbleTextMine: { color: colors.background, fontSize: 15, fontWeight: "500" },
  composer: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  composerInput: { flex: 1 },
});
