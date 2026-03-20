import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";
import { NOTIFICATION_TYPE_COLORS } from "../services/constants";

const NotificationsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { dark, notifs, markNotifRead, markAllNotifsRead, isAdmin } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);
  const unread = notifs.filter((item) => !item.read).length;

  const openNotification = async (notif) => {
    await markNotifRead(notif.id);

    if (!isAdmin) return;

    const pendingFromAction =
      notif?.action?.screen === "Admin" &&
      (!notif?.action?.tab || notif.action.tab === "pending");
    const pendingFromTitle =
      typeof notif?.title === "string" && notif.title.toLowerCase().includes("pending review");

    if (pendingFromAction || pendingFromTitle) {
      navigation.navigate("Admin", { focusTab: "pending" });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}> 
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.header,
            borderBottomColor: theme.border,
            paddingTop: Math.max(12, insets.top + 8),
          },
        ]}
      > 
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Notifications</Text>
            {unread ? <Text style={[styles.subtitle, { color: theme.text2 }]}>{unread} unread</Text> : null}
          </View>

          {unread ? (
            <Pressable
              onPress={markAllNotifsRead}
              style={[styles.markAllBtn, { borderColor: theme.accent }]}
            >
              <Text style={[styles.markAllText, { color: theme.accent }]}>Mark all read</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {notifs.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text3 }]}>No notifications yet.</Text>
        ) : null}

        {notifs.map((notif) => {
          const color = NOTIFICATION_TYPE_COLORS[notif.type] || theme.accent;
          return (
            <Pressable
              key={notif.id}
              onPress={() => openNotification(notif)}
              style={[
                styles.card,
                {
                  backgroundColor: notif.read ? theme.card : `${color}14`,
                  borderColor: notif.read ? theme.border : `${color}55`,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${color}33` }]}> 
                <Text style={styles.iconText}>{notif.icon}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: theme.text, fontWeight: notif.read ? "600" : "800" }]}>
                  {notif.title}
                </Text>
                <Text style={[styles.cardTime, { color: theme.text3 }]}>{notif.time}</Text>
              </View>

              {!notif.read ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
  },
  markAllBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  markAllText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 17,
  },
  cardTitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  cardTime: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: "500",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
});

export default NotificationsScreen;
