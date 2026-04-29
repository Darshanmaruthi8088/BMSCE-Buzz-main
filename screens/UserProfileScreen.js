import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import { RoleBadge } from "../components/Badge";
import NewsCard from "../components/NewsCard";
import { useApp } from "../contexts/AppContext";
import { getTheme } from "../services/theme";
import { getPostReleaseTimeMs } from "../services/utils";

const UserProfileScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const {
    dark,
    user,
    users,
    newsWithUser,
    toggleBookmark,
    toggleLike,
    incrementArticleViews,
  } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const {
    userId = "",
    fallbackName = "User",
    fallbackAvatar = "U",
    fallbackAvatarUrl = "",
  } = route.params || {};

  const targetUser = useMemo(() => users.find((item) => item.id === userId) || null, [users, userId]);

  const profileName = targetUser?.name || fallbackName;
  const profileAvatar = targetUser?.avatar || fallbackAvatar;
  const profileAvatarUrl = targetUser?.avatarUrl || fallbackAvatarUrl || "";
  const profileRole = targetUser?.role || "user";
  const profileUserType = targetUser?.userType || "student";
  const profileDept = targetUser?.dept || "Campus";

  const posts = useMemo(
    () =>
      newsWithUser
        .filter((item) => {
          if (item.status !== "published") return false;
          if (userId && item.authorId === userId) return true;
          if (!item.authorId && item.author === profileName) return true;
          return false;
        })
        .sort((a, b) => getPostReleaseTimeMs(b) - getPostReleaseTimeMs(a)),
    [newsWithUser, profileName, userId]
  );

  const openArticle = async (item) => {
    await incrementArticleViews(item);
    navigation.navigate("Article", { articleId: item.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(12, insets.top + 8),
            backgroundColor: theme.header,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { borderColor: theme.border, backgroundColor: theme.card2 }]}>
          <Ionicons name="chevron-back" size={18} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          Profile
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Avatar initials={profileAvatar} imageUrl={profileAvatarUrl} size={58} color="#2563EB" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]}>{profileName}</Text>
            <Text style={[styles.meta, { color: theme.text2 }]}>{profileDept}</Text>
            <View style={styles.roleWrap}>
              <RoleBadge role={profileRole} userType={profileUserType} />
            </View>
          </View>
        </View>

        <View style={styles.listHeader}>
          <Text style={[styles.listTitle, { color: theme.text }]}>Posts</Text>
          <Text style={[styles.listCount, { color: theme.text3 }]}>{posts.length}</Text>
        </View>

        {posts.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.text3 }]}>No published posts yet.</Text>
        ) : (
          posts.map((item) => (
            <NewsCard
              key={item.id}
              item={item}
              theme={theme}
              currentUserId={user?.id}
              onPress={openArticle}
              onBookmark={toggleBookmark}
              onToggleLike={toggleLike}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },
  profileCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: "900",
  },
  meta: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "600",
  },
  roleWrap: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  listHeader: {
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTitle: {
    fontSize: 13.5,
    fontWeight: "900",
  },
  listCount: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    paddingVertical: 26,
    fontSize: 12.5,
    fontWeight: "700",
  },
});

export default UserProfileScreen;
