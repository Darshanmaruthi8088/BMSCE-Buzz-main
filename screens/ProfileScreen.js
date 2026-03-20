import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import { Badge, CategoryBadge, RoleBadge } from "../components/Badge";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";

const ProfileScreen = () => {
  const navigation = useNavigation();
  const {
    dark,
    toggleDark,
    user,
    newsWithUser,
    logout,
    updateAvatar,
    commentedPostIdsByUser,
    incrementArticleViews,
  } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState("saved");
  const [commentedMap, setCommentedMap] = useState({});

  const saved = useMemo(() => newsWithUser.filter((item) => item.bookmarked), [newsWithUser]);
  const myPosts = useMemo(
    () => newsWithUser.filter((item) => (item.authorId && item.authorId === user?.id) || item.author === user?.name),
    [newsWithUser, user?.id, user?.name]
  );
  const likedPosts = useMemo(() => newsWithUser.filter((item) => !!item.likedBy?.[user?.id]), [newsWithUser, user?.id]);

  const commentedPosts = useMemo(
    () => newsWithUser.filter((item) => !!item.commentedBy?.[user?.id] || !!commentedMap[item.id]),
    [newsWithUser, user?.id, commentedMap]
  );

  useEffect(() => {
    let mounted = true;
    if (!user?.id || !newsWithUser.length) {
      setCommentedMap({});
      return undefined;
    }

    commentedPostIdsByUser(newsWithUser, user.id).then((map) => {
      if (mounted) setCommentedMap(map);
    });

    return () => {
      mounted = false;
    };
  }, [commentedPostIdsByUser, newsWithUser, user?.id]);

  const totalLikes = myPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const totalComments = myPosts.reduce((sum, post) => sum + (post.comments || 0), 0);
  const publishedPosts = myPosts.filter((post) => post.status === "published").length;
  const activeScore = Math.min(100, saved.length * 10 + myPosts.length * 20 + Math.floor((totalLikes + totalComments) / 5));

  const items =
    tab === "saved"
      ? saved
      : tab === "posts"
        ? myPosts
        : tab === "liked"
          ? likedPosts
          : commentedPosts;

  const openArticle = async (item) => {
    await incrementArticleViews(item);
    navigation.navigate("Article", { articleId: item.id });
  };

  const handleAvatarPick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow media access to update avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    const ok = await updateAvatar(asset.uri);
    if (!ok) {
      Alert.alert("Avatar update failed", "Could not save avatar. Please try again.");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { paddingTop: Math.max(28, insets.top + 8) }]}>
          <View style={styles.profileRow}>
            <View style={styles.avatarWrap}>
              <Avatar initials={user?.avatar} imageUrl={user?.avatarUrl} size={68} color="#F59E0B" />
              <Pressable onPress={handleAvatarPick} style={styles.avatarEditBtn}>
                <Ionicons name="pencil" size={11} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.nameText}>{user?.name}</Text>
              <Text style={styles.emailText}>{user?.email}</Text>
              <View style={styles.badgesWrap}>
                <RoleBadge role={user?.role} userType={user?.userType} />
                <Badge text={user?.dept} color="#3B82F6" />
                {user?.year ? <Badge text={user.year} color="#6B7280" /> : null}
                {user?.usn ? <Badge text={user.usn} color="#475569" /> : null}
              </View>
            </View>

            <Pressable onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={15} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.statsTopGrid}>
            {[
              [`${myPosts.length}`, "My Posts", "posts"],
              [`${saved.length}`, "Saved", "saved"],
              [`${commentedPosts.length}`, "Comments", "commented"],
            ].map(([value, label, targetTab]) => (
              <Pressable key={label} onPress={() => setTab(targetTab)} style={styles.statsTopCard}>
                <Text style={styles.statsTopValue}>{value}</Text>
                <Text style={styles.statsTopLabel}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.actionsGrid}>
          {[
            { icon: dark ? "sunny" : "moon", label: dark ? "Light Mode" : "Dark Mode", col: "#7C3AED", action: toggleDark },
            { icon: "notifications-outline", label: "Notifications", col: "#F59E0B", action: () => navigation.navigate("Notifications") },
            { icon: "bookmark-outline", label: `Saved (${saved.length})`, col: "#059669", action: () => setTab("saved") },
            { icon: "analytics-outline", label: "My Analytics", col: "#3B82F6", action: () => setTab("analytics") },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={item.action}
              style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: `${item.col}22` }]}> 
                <Ionicons name={item.icon} size={16} color={item.col} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.text }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.tabsWrap, { backgroundColor: theme.card2, borderColor: theme.border }]}> 
          {[
            ["saved", `Saved (${saved.length})`],
            ["posts", `My Posts (${myPosts.length})`],
            ["liked", `Liked (${likedPosts.length})`],
            ["commented", `Commented (${commentedPosts.length})`],
            ["analytics", "Analytics"],
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tabBtn, tab === key && { backgroundColor: theme.accent }]}> 
              <Text style={[styles.tabText, { color: tab === key ? "#FFFFFF" : theme.text2 }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === "analytics" ? (
          <View>
            <View style={styles.analyticsGrid}>
              {[
                ["Published Posts", publishedPosts, "#059669"],
                ["Total Likes", totalLikes, "#EF4444"],
                ["Total Comments", totalComments, "#3B82F6"],
                ["Engagement Score", `${activeScore}%`, "#F59E0B"],
              ].map(([label, value, color]) => (
                <View key={label} style={[styles.analyticsCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <Text style={[styles.analyticsValue, { color }]}>{value}</Text>
                  <Text style={[styles.analyticsLabel, { color: theme.text2 }]}>{label}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.progressCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <Text style={[styles.progressTitle, { color: theme.text }]}>Activity On BMSCE-Buzz</Text>
              <View style={[styles.progressBar, { backgroundColor: theme.card2 }]}> 
                <View style={[styles.progressFill, { width: `${activeScore}%` }]} />
              </View>
              <Text style={[styles.progressText, { color: theme.text2 }]}>Based on your posts, saved items, and post engagement.</Text>
            </View>

            {myPosts.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.text3 }]}>No posts yet to analyze.</Text>
            ) : (
              myPosts.map((item) => (
                <View key={item.id} style={[styles.analyticsPostCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.analyticsPostTitle, { color: theme.text }]}>{item.title}</Text>
                    <View style={styles.analyticsMetaRow}>
                      <View style={styles.analyticsMetaItem}>
                        <Ionicons name="eye-outline" size={12} color={theme.text2} />
                        <Text style={[styles.analyticsMeta, { color: theme.text2 }]}>{item.views || 0}</Text>
                      </View>
                      <View style={styles.analyticsMetaItem}>
                        <Ionicons name="heart-outline" size={12} color="#EF4444" />
                        <Text style={[styles.analyticsMeta, { color: "#EF4444" }]}>{item.likes || 0}</Text>
                      </View>
                      <View style={styles.analyticsMetaItem}>
                        <Ionicons name="chatbubble-outline" size={12} color="#3B82F6" />
                        <Text style={[styles.analyticsMeta, { color: "#3B82F6" }]}>{item.comments || 0}</Text>
                      </View>
                    </View>
                  </View>
                  <Pressable onPress={() => openArticle(item)}>
                    <Ionicons name="chevron-forward" size={16} color={theme.text3} />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ) : (
          <View>
            {items.length === 0 ? (
              <Text style={[styles.emptyText, { color: theme.text3 }]}>Nothing here yet.</Text>
            ) : (
              items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => openArticle(item)}
                  style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                    <View style={styles.itemBadges}>
                      <CategoryBadge category={item.category} small />
                      {tab === "posts" ? (
                        <Badge
                          text={item.status === "pending" ? "Pending" : "Published"}
                          color={item.status === "pending" ? "#B45309" : "#059669"}
                          small
                        />
                      ) : null}
                      {tab === "liked" ? <Badge text="Liked" color="#EF4444" small /> : null}
                      {tab === "commented" ? <Badge text="Commented" color="#3B82F6" small /> : null}
                    </View>
                  </View>
                  <Ionicons
                    name={tab === "saved" ? "bookmark" : tab === "liked" ? "heart" : "chevron-forward"}
                    size={16}
                    color={tab === "saved" ? "#F59E0B" : tab === "liked" ? "#EF4444" : theme.text3}
                  />
                </Pressable>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingBottom: 110,
  },
  hero: {
    backgroundColor: "#0F2040",
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 20,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarEditBtn: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#060d1f",
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  nameText: {
    color: "#FFFFFF",
    fontSize: 19,
    fontWeight: "900",
  },
  emailText: {
    marginTop: 2,
    color: "rgba(255,255,255,0.6)",
    fontSize: 11.5,
  },
  badgesWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  logoutBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statsTopGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statsTopCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: "center",
  },
  statsTopValue: {
    color: "#F59E0B",
    fontSize: 20,
    fontWeight: "900",
  },
  statsTopLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  actionsGrid: {
    marginTop: 14,
    marginHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  tabsWrap: {
    marginTop: 14,
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 11,
    padding: 3,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 12,
  },
  tabBtn: {
    minHeight: 32,
    borderRadius: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  analyticsGrid: {
    marginHorizontal: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  analyticsCard: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  analyticsValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  analyticsLabel: {
    marginTop: 3,
    fontSize: 10.5,
    fontWeight: "700",
  },
  progressCard: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 8,
  },
  progressBar: {
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#F59E0B",
  },
  progressText: {
    fontSize: 11,
    lineHeight: 16,
  },
  analyticsPostCard: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  analyticsPostTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
    lineHeight: 18,
  },
  analyticsMetaRow: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
  },
  analyticsMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  analyticsMeta: {
    fontSize: 11,
    fontWeight: "700",
  },
  itemCard: {
    marginHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 5,
  },
  itemBadges: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  emptyText: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 32,
  },
});

export default ProfileScreen;
