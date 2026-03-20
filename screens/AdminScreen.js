import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import AppButton from "../components/AppButton";
import { Badge, CategoryBadge, RoleBadge } from "../components/Badge";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";

const AdminScreen = ({ route }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const {
    dark,
    user,
    newsWithUser,
    users,
    approvePost,
    rejectPost,
    updatePost,
    deletePost,
    deleteUserProfile,
  } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [tab, setTab] = useState("pending");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [editingPost, setEditingPost] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const focusTab = route?.params?.focusTab;

  const pending = useMemo(() => newsWithUser.filter((item) => item.status === "pending"), [newsWithUser]);
  const published = useMemo(() => newsWithUser.filter((item) => item.status === "published"), [newsWithUser]);

  const selectedUser = users.find((item) => item.id === selectedUserId) || null;
  const userPosts = selectedUser
    ? newsWithUser.filter((item) => (item.authorId && item.authorId === selectedUser.id) || item.author === selectedUser.name)
    : [];

  const totalViews = useMemo(() => newsWithUser.reduce((sum, item) => sum + (item.views || 0), 0), [newsWithUser]);
  const viewLabel = totalViews > 999 ? `${(totalViews / 1000).toFixed(1)}k` : `${totalViews}`;

  const chartData = useMemo(() => {
    const recentDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date.toISOString().slice(0, 10);
    });

    return recentDays.map((day, index) => {
      const dayViews = newsWithUser
        .filter((item) => item.date === day)
        .reduce((sum, item) => sum + (item.views || 0), 0);
      const labelDate = new Date(day);
      return {
        key: `${day}-${index}`,
        d: labelDate.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
        v: dayViews,
      };
    });
  }, [newsWithUser]);

  const maxValue = Math.max(1, ...chartData.map((item) => item.v));

  useEffect(() => {
    if (!focusTab || !["pending", "published", "users", "userPosts"].includes(focusTab)) return;
    setTab((prev) => (prev === focusTab ? prev : focusTab));
    if (navigation?.setParams) {
      navigation.setParams({ focusTab: undefined });
    }
  }, [focusTab, navigation]);

  const openEditPost = (post) => {
    setEditingPost(post);
    setEditTitle(post.title || "");
    setEditSummary(post.summary || "");
  };

  const handleSavePost = async () => {
    if (!editingPost) return;
    const ok = await updatePost(editingPost.id, { title: editTitle, summary: editSummary });
    if (ok) {
      setEditingPost(null);
      setEditTitle("");
      setEditSummary("");
    }
  };

  const confirmDeletePost = (postId) => {
    Alert.alert("Delete Post", "Delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deletePost(postId);
        },
      },
    ]);
  };

  const confirmRejectPost = (postId) => {
    Alert.alert("Reject Post", "Reject and remove this pending post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () => {
          rejectPost(postId);
        },
      },
    ]);
  };

  const confirmDeleteUser = (targetUser) => {
    Alert.alert("Delete User", `Delete user profile for ${targetUser.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteUserProfile(targetUser.id);
        },
      },
    ]);
  };

  const tabItems = [
    ["pending", `Pending (${pending.length})`],
    ["published", "Published"],
    ["users", "Users"],
    ...(selectedUser ? [["userPosts", `${selectedUser.name.split(" ")[0]} Posts`]] : []),
  ];

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
            <Text style={[styles.title, { color: theme.text }]}>Admin</Text>
            <Text style={[styles.subtitle, { color: theme.text2 }]}>{user?.dept}</Text>
          </View>
          <Avatar initials={user?.avatar} imageUrl={user?.avatarUrl} size={36} color="#EF4444" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statsGrid}>
          {[
            ["N", "Total", newsWithUser.length, "#3B82F6"],
            ["P", "Pending", pending.length, "#F59E0B"],
            ["OK", "Published", published.length, "#059669"],
            ["V", "Views", viewLabel, "#7C3AED"],
          ].map(([icon, label, value, color]) => (
            <View key={label} style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <Text style={styles.statIcon}>{icon}</Text>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: theme.text2 }]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          <View style={styles.chartHeader}>
            <Feather name="bar-chart-2" size={15} color={theme.accent} />
            <Text style={[styles.chartTitle, { color: theme.text }]}>Weekly Views</Text>
          </View>

          <View style={styles.chartBars}>
            {chartData.map(({ key, d, v }) => (
              <View key={key} style={styles.chartBarItem}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: Math.max(4, (v / maxValue) * 60),
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
                <Text style={[styles.chartLabel, { color: theme.text3 }]}>{d}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.tabsWrap, { backgroundColor: theme.card2, borderColor: theme.border }]}> 
          {tabItems.map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tabBtn, tab === key && { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.tabText, { color: tab === key ? "#FFFFFF" : theme.text2 }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "pending" ? (
          pending.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.text3 }]}>All clear. No pending posts.</Text>
          ) : (
            pending.map((item) => (
              <View key={item.id} style={[styles.pendingCard, { backgroundColor: theme.card, borderColor: `${theme.accent}66` }]}> 
                <View style={styles.badgeRow}>
                  <CategoryBadge category={item.category} small />
                  <Badge text="Awaiting Review" color="#B45309" small />
                </View>
                <Text style={[styles.pendingTitle, { color: theme.text }]}>{item.title}</Text>
                <Text style={[styles.pendingSummary, { color: theme.text2 }]} numberOfLines={3}>
                  {item.summary}
                </Text>
                <View style={styles.authorMini}>
                  <Avatar initials={item.author?.slice(0, 2)} size={22} color="#059669" />
                  <Text style={[styles.authorMiniText, { color: theme.text2 }]}>{item.author}  {item.date}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <AppButton
                    title="Approve"
                    onPress={() => approvePost(item.id)}
                    background="#059669"
                    borderColor="#059669"
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="Reject"
                    onPress={() => confirmRejectPost(item.id)}
                    background="#EF4444"
                    borderColor="#EF4444"
                    style={{ flex: 1 }}
                  />
                  <Pressable
                    onPress={() => openEditPost(item)}
                    style={[styles.iconBtn, { borderColor: theme.border, backgroundColor: "transparent" }]}
                  >
                    <Feather name="edit-2" size={14} color={theme.text2} />
                  </Pressable>
                  <Pressable
                    onPress={() => confirmDeletePost(item.id)}
                    style={[styles.iconBtn, { backgroundColor: "#EF444422" }]}
                  >
                    <Feather name="x" size={14} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))
          )
        ) : null}

        {tab === "published"
          ? published.map((item) => (
              <View key={item.id} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{item.title}</Text>
                  <View style={styles.listMetaRow}>
                    <CategoryBadge category={item.category} small />
                    <Text style={[styles.listMetaText, { color: theme.text3 }]}>{item.views} views  {item.likes} likes</Text>
                  </View>
                </View>
                <Pressable onPress={() => openEditPost(item)} style={styles.listIconBtn}>
                  <Feather name="edit-2" size={15} color={theme.text2} />
                </Pressable>
                <Pressable onPress={() => confirmDeletePost(item.id)} style={styles.listIconBtn}>
                  <Feather name="x" size={15} color="#EF4444" />
                </Pressable>
              </View>
            ))
          : null}

        {tab === "users"
          ? users.map((item) => (
              <View key={item.id} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                <Avatar initials={item.avatar} imageUrl={item.avatarUrl} size={36} color={item.role === "admin" ? "#7C3AED" : "#3B82F6"} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listTitle, { color: theme.text }]}>{item.name}</Text>
                  <Text style={[styles.userEmail, { color: theme.text2 }]}>{item.email}</Text>
                  <View style={styles.userBadges}>
                    <RoleBadge role={item.role} userType={item.userType} />
                    <Badge text={item.dept} color="#475569" small />
                  </View>
                </View>

                <View style={styles.userActions}>
                  <Pressable
                    onPress={() => {
                      setSelectedUserId(item.id);
                      setTab("userPosts");
                    }}
                    style={[styles.userActionBtn, { borderColor: theme.border, backgroundColor: `${theme.accent}22` }]}
                  >
                    <Text style={[styles.userActionText, { color: theme.accent }]}>Posts</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => navigation.navigate("UserEdit", { userId: item.id })}
                    style={[styles.userActionBtn, { borderColor: theme.border }]}
                  >
                    <Text style={[styles.userActionText, { color: theme.text2 }]}>Edit</Text>
                  </Pressable>

                  {item.id !== user?.id ? (
                    <Pressable
                      onPress={() => confirmDeleteUser(item)}
                      style={[styles.userActionBtn, { backgroundColor: "#EF444422" }]}
                    >
                      <Text style={[styles.userActionText, { color: "#EF4444" }]}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          : null}

        {tab === "userPosts"
          ? userPosts.length === 0
            ? <Text style={[styles.emptyText, { color: theme.text3 }]}>No posts for selected user.</Text>
            : userPosts.map((item) => (
                <View key={item.id} style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listTitle, { color: theme.text }]}>{item.title}</Text>
                    <View style={styles.listMetaRow}>
                      <CategoryBadge category={item.category} small />
                      <Badge
                        text={item.status === "pending" ? "Pending" : "Published"}
                        color={item.status === "pending" ? "#B45309" : "#059669"}
                        small
                      />
                    </View>
                  </View>
                  <Pressable onPress={() => openEditPost(item)} style={styles.listIconBtn}>
                    <Feather name="edit-2" size={15} color={theme.text2} />
                  </Pressable>
                  <Pressable onPress={() => confirmDeletePost(item.id)} style={styles.listIconBtn}>
                    <Feather name="x" size={15} color="#EF4444" />
                  </Pressable>
                </View>
              ))
          : null}
      </ScrollView>

      <Modal visible={!!editingPost} transparent animationType="slide" onRequestClose={() => setEditingPost(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Post</Text>

            <Text style={[styles.fieldLabel, { color: theme.text2 }]}>Title</Text>
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Post title"
              placeholderTextColor={theme.text3}
              style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.input }]}
            />

            <Text style={[styles.fieldLabel, { color: theme.text2 }]}>Summary</Text>
            <TextInput
              value={editSummary}
              onChangeText={setEditSummary}
              placeholder="Post summary"
              placeholderTextColor={theme.text3}
              multiline
              numberOfLines={4}
              style={[
                styles.modalInput,
                styles.modalTextArea,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.input },
              ]}
            />

            <View style={styles.modalActions}>
              <AppButton
                title="Cancel"
                onPress={() => setEditingPost(null)}
                outline
                borderColor={theme.border}
                color={theme.text}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Save"
                onPress={handleSavePost}
                background={theme.accent}
                borderColor={theme.accent}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: 17,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 110,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  chartCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginBottom: 18,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  chartBars: {
    height: 70,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
  },
  chartBarItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  chartBar: {
    width: "100%",
    borderRadius: 3,
  },
  chartLabel: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  tabsWrap: {
    borderWidth: 1,
    borderRadius: 11,
    padding: 3,
    marginBottom: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  tabBtn: {
    borderRadius: 9,
    minHeight: 32,
    paddingHorizontal: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 30,
  },
  pendingCard: {
    borderWidth: 1.5,
    borderRadius: 15,
    padding: 14,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 9,
  },
  pendingTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 7,
    lineHeight: 19,
  },
  pendingSummary: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  authorMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  authorMiniText: {
    fontSize: 10.5,
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 6,
  },
  listMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  listMetaText: {
    fontSize: 10,
    fontWeight: "600",
  },
  listIconBtn: {
    padding: 2,
  },
  userEmail: {
    fontSize: 11,
    marginBottom: 5,
  },
  userBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  userActions: {
    gap: 6,
    alignItems: "flex-end",
  },
  userActionBtn: {
    minWidth: 52,
    minHeight: 28,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  userActionText: {
    fontSize: 10,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalTextArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  modalActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
});

export default AdminScreen;
