import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import AppHeader, { HeaderAction } from "../components/AppHeader";
import NewsCard from "../components/NewsCard";
import Avatar from "../components/Avatar";
import { useApp } from "../contexts/AppContext";
import { CATEGORIES, DEPTS } from "../services/constants";
import { getTheme } from "../services/theme";
import { getPostReleaseTimeMs } from "../services/utils";

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
        const canViewItem = item.status === "published";
        if (!canViewItem) return false;
        if (activeCat !== "All" && item.category !== activeCat) return false;
        if (filterDept !== "All Departments" && item.dept !== "All" && item.dept !== filterDept) return false;
        return true;
      }).sort((a, b) => getPostReleaseTimeMs(b) - getPostReleaseTimeMs(a)),
    [newsWithUser, activeCat, filterDept]
  );

  const openArticle = async (item) => {
    await incrementArticleViews(item);
    navigation.navigate("Article", { articleId: item.id });
  };

  const openContactUs = () => navigation.navigate("ContactUs");

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
              <Avatar initials={user?.avatar} imageUrl={user?.avatarUrl} size={34} enablePreview={false} />
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
        <Pressable
          onPress={openContactUs}
          style={[styles.contactBanner, { borderColor: theme.border, backgroundColor: theme.card }]}
        >
          <View style={[styles.contactIconWrap, { backgroundColor: `${theme.accent}1A` }]}>
            <Ionicons name="people" size={20} color={theme.accent} />
          </View>
          <View style={styles.contactBannerText}>
            <Text style={[styles.contactBannerTitle, { color: theme.text }]}>Contact us</Text>
            <Text style={[styles.contactBannerSub, { color: theme.text2 }]}>Meet the creators</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.text3} />
        </Pressable>

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

        <View style={styles.latestHeader}>
          <View style={styles.latestTitleWrap}>
            <Ionicons name="trending-up" size={15} color={theme.accent} />
            <Text style={[styles.latestTitle, { color: theme.text }]}>Latest News</Text>
          </View>
          <Text style={[styles.latestCount, { color: theme.text3 }]}>{filtered.length} articles</Text>
        </View>

        {filtered.map((item) => (
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
  contactBanner: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  contactBannerText: {
    flex: 1,
    minWidth: 0,
  },
  contactBannerTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  contactBannerSub: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
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
