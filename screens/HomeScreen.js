import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader, { HeaderAction } from "../components/AppHeader";
import NewsCard from "../components/NewsCard";
import Avatar from "../components/Avatar";
import { Badge, CategoryBadge } from "../components/Badge";
import { useApp } from "../contexts/AppContext";
import { CATEGORIES, DEPTS } from "../services/constants";
import { getTheme } from "../services/theme";
import { toViewCountLabel } from "../services/utils";

const HomeScreen = () => {
  const navigation = useNavigation();
  const {
    dark,
    toggleDark,
    user,
    isAdmin,
    newsWithUser,
    importantNotice,
    toggleBookmark,
    toggleLike,
    incrementArticleViews,
  } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [activeCat, setActiveCat] = useState("All");
  const [showFilter, setShowFilter] = useState(false);
  const [filterDept, setFilterDept] = useState("All Departments");

  const filtered = useMemo(
    () =>
      newsWithUser.filter((item) => {
        const canViewItem =
          item.status === "published" ||
          (item.status === "pending" && (isAdmin || item.authorId === user?.id));
        if (!canViewItem) return false;
        if (activeCat !== "All" && item.category !== activeCat) return false;
        if (filterDept !== "All Departments" && item.dept !== "All" && item.dept !== filterDept) return false;
        return true;
      }),
    [newsWithUser, activeCat, filterDept, isAdmin, user?.id]
  );

  const featured = filtered[0];
  const rest = filtered.slice(1);

  const openArticle = async (item) => {
    await incrementArticleViews(item);
    navigation.navigate("Article", { articleId: item.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <AppHeader
        theme={theme}
        title="BMSCE Buzz"
        subtitle="Campus Pulse"
        rightActions={
          <>
            <HeaderAction theme={theme} icon={dark ? "sunny" : "moon"} onPress={toggleDark} />
            <HeaderAction theme={theme} icon="filter" onPress={() => setShowFilter((prev) => !prev)} active={showFilter} />
            <Pressable onPress={() => navigation.navigate("Profile")}> 
              <Avatar initials={user?.avatar} imageUrl={user?.avatarUrl} size={34} />
            </Pressable>
          </>
        }
      />

      {showFilter ? (
        <View style={styles.filterWrap}>
          <View style={[styles.pickerWrap, { borderColor: theme.border, backgroundColor: theme.input }]}>
            <Picker
              selectedValue={filterDept}
              onValueChange={(value) => setFilterDept(value)}
              dropdownIconColor={theme.text2}
              style={{ color: theme.text }}
            >
              {DEPTS.map((dept) => (
                <Picker.Item key={dept} label={dept} value={dept} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {importantNotice ? (
          <Pressable style={styles.notice} onPress={() => openArticle(importantNotice)}>
            <Ionicons name="flash" size={16} color="#FCD34D" />
            <Text style={styles.noticeText}>{importantNotice.title}</Text>
          </Pressable>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setActiveCat(cat)}
              style={[
                styles.categoryPill,
                {
                  borderColor: activeCat === cat ? theme.accent : theme.border,
                  backgroundColor: activeCat === cat ? theme.accent : "transparent",
                },
              ]}
            >
              <Text style={[styles.categoryPillText, { color: activeCat === cat ? "#FFFFFF" : theme.text2 }]}>{cat}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {featured ? (
          <View style={styles.featureWrap}>
            <View style={styles.featureLabelRow}>
              <Ionicons name="star" size={13} color={theme.accent} />
              <Text style={[styles.featureLabel, { color: theme.accent }]}>Featured Story</Text>
            </View>

            <Pressable
              onPress={() => openArticle(featured)}
              style={[styles.featureCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.featureBadges}>
                <CategoryBadge category={featured.category} />
                {featured.status === "pending" ? <Badge text="Pending Review" color="#B45309" /> : null}
                {featured.priority === "urgent" ? <Badge text="Urgent" color="#DC2626" /> : null}
              </View>

              <Text style={[styles.featureTitle, { color: theme.text }]}>{featured.title}</Text>
              <Text style={[styles.featureSummary, { color: theme.text2 }]} numberOfLines={3}>
                {featured.summary}
              </Text>

              <View style={styles.featureFooter}>
                <View style={styles.featureAuthorWrap}>
                  <Avatar
                    initials={featured.authorAvatar || featured.author?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "U"}
                    imageUrl={featured.authorAvatarUrl}
                    size={24}
                    color="#059669"
                  />
                  <View>
                    <Text style={[styles.featureAuthorName, { color: theme.text }]}>{featured.author}</Text>
                    <Text style={[styles.featureAuthorDate, { color: theme.text3 }]}>{featured.date}</Text>
                  </View>
                </View>

                <View style={styles.featureStats}>
                  <View style={styles.featureStatItem}>
                    <Feather name="eye" size={13} color={theme.text3} />
                    <Text style={[styles.featureStatText, { color: theme.text3 }]}>{toViewCountLabel(featured.views)}</Text>
                  </View>
                  <View style={styles.featureStatItem}>
                    <Ionicons name="heart-outline" size={13} color={theme.text3} />
                    <Text style={[styles.featureStatText, { color: theme.text3 }]}>{featured.likes || 0}</Text>
                  </View>
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.latestHeader}>
          <View style={styles.latestTitleWrap}>
            <Ionicons name="trending-up" size={15} color={theme.accent} />
            <Text style={[styles.latestTitle, { color: theme.text }]}>Latest News</Text>
          </View>
          <Text style={[styles.latestCount, { color: theme.text3 }]}>{filtered.length} articles</Text>
        </View>

        {rest.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            theme={theme}
            currentUserId={user?.id}
            onPress={openArticle}
            onBookmark={toggleBookmark}
            onToggleLike={toggleLike}
          />
        ))}

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.text3 }]}>No articles found.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pickerWrap: {
    borderWidth: 1.5,
    borderRadius: 12,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 110,
  },
  notice: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeText: {
    color: "#FFFFFF",
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },
  categoryRow: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  categoryPill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  categoryPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  featureWrap: {
    marginTop: 12,
  },
  featureLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  featureLabel: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  featureCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  featureBadges: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  featureTitle: {
    fontSize: 19,
    fontWeight: "900",
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  featureSummary: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  featureFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  featureAuthorWrap: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  featureAuthorName: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  featureAuthorDate: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },
  featureStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  featureStatText: {
    fontSize: 11,
    fontWeight: "600",
  },
  latestHeader: {
    marginTop: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  latestTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  latestTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  latestCount: {
    fontSize: 11,
    fontWeight: "600",
  },
  emptyWrap: {
    paddingVertical: 50,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export default HomeScreen;
