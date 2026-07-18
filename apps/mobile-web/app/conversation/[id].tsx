import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Muted, Screen } from "../../src/components/ui";
import { formStyles } from "../../src/components/forms";
import { useSession } from "../../src/lib/auth";
import { supabase } from "../../src/lib/supabase";
import { trpc } from "../../src/lib/trpc";
import { colors, radius, spacing } from "../../src/theme";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { session } = useSession();
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
    enabled: !!session,
  });

  const messages = trpc.chat.messages.useQuery(
    { conversationId: id! },
    // Realtime en canal principal, polling 20 s en filet de sécurité.
    { enabled: !!id && !!session, refetchInterval: 20000 },
  );
  const [draft, setDraft] = useState("");

  // Canal Supabase Realtime : chaque envoi broadcast "msg" → l'autre partie
  // rafraîchit instantanément (pas d'attente du polling).
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!id || !session) return;
    const channel = supabase
      .channel(`conv-${id}`)
      .on("broadcast", { event: "msg" }, () => {
        void utils.chat.messages.invalidate({ conversationId: id });
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.user.id]);

  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setDraft("");
      void utils.chat.messages.invalidate();
      void channelRef.current?.send({ type: "broadcast", event: "msg", payload: {} });
    },
  });

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
        >
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
        </ScrollView>
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
        {send.isError && <Muted>{send.error.message}</Muted>}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.sm },
  thread: { flex: 1 },
  threadContent: { gap: spacing.sm, paddingBottom: spacing.sm },
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
