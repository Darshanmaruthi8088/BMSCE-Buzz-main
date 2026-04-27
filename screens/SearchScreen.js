import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import { RoleBadge } from "../components/Badge";
import NewsCard from "../components/NewsCard";
import { useApp } from "../contexts/AppContext";
import { CATEGORIES } from "../services/constants";
import { getTheme } from "../services/theme";

const SearchScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { dark, user, users, isAdmin, newsWithUser, toggleBookmark, toggleLike, incrementArticleViews } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [resultType, setResultType] = useState("all");

  const normalizedQuery = query.trim().toLowerCase();

  const newsResults = useMemo(() => {
    return newsWithUser.filter((item) => {
      const canViewItem =
        item.status === "published" ||
        (item.status === "pending" && (isAdmin || item.authorId === user?.id));
      if (!canViewItem) return false;
      const matchQuery =
        !normalizedQuery ||
        item.title?.toLowerCase().includes(normalizedQuery) ||
        item.summary?.toLowerCase().includes(normalizedQuery) ||
        item.body?.toLowerCase().includes(normalizedQuery) ||
        item.author?.toLowerCase().includes(normalizedQuery) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      return matchQuery && (category === "All" || item.category === category);
    });
  }, [newsWithUser, normalizedQuery, category, isAdmin, user?.id]);

  const userResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return users.filter((item) => {
      return (
        item.name?.toLowerCase().includes(normalizedQuery) ||
        item.email?.toLowerCase().includes(normalizedQuery) ||
        item.dept?.toLowerCase().includes(normalizedQuery) ||
        item.usn?.toLowerCase().includes(normalizedQuery) ||
        item.userType?.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [users, normalizedQuery]);

  const showNewsResults = resultType === "all" || resultType === "news";
  const showUserResults = resultType === "all" || resultType === "users";
  const visibleNews = showNewsResults ? newsResults : [];
  const visibleUsers = showUserResults ? userResults : [];
  const totalResults = visibleNews.length + visibleUsers.length;

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
            backgroundColor: theme.header,
            borderBottomColor: theme.border,
            paddingTop: Math.max(12, insets.top + 8),
          },
        ]}
      > 
        <Text style={[styles.title, { color: theme.text }]}>Search</Text>

        <View style={[styles.searchWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
          <Ionicons name="search" size={17} color={theme.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search articles, users, clubs"
            placeholderTextColor={theme.text3}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

        <View style={styles.resultTypeWrap}>
          {[
            ["all", "All"],
            ["news", "News"],
            ["users", "Users"],
          ].map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setResultType(value)}
              style={[
                styles.resultTypePill,
                {
                  borderColor: resultType === value ? theme.accent : theme.border,
                  backgroundColor: resultType === value ? `${theme.accent}1F` : "transparent",
                },
              ]}
            >
              <Text style={[styles.resultTypeText, { color: resultType === value ? theme.accent : theme.text2 }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {resultType !== "users" ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesWrap}>
            {CATEGORIES.map((value) => (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                style={[
                  styles.categoryPill,
                  {
                    borderColor: category === value ? theme.accent : theme.border,
                    backgroundColor: category === value ? `${theme.accent}1F` : "transparent",
                  },
                ]}
              >
                <Text style={[styles.categoryText, { color: category === value ? theme.accent : theme.text2 }]}>{value}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!query ? (
          <View style={styles.trendingWrap}>
            <Text style={[styles.trendingLabel, { color: theme.text2 }]}>Trending Topics</Text>
            <View style={styles.trendingTags}>
              {["#TCS2025", "#ExamTimetable", "#Utkarsh2025", "#IEEE", "#Basketball", "#Scholarship"].map((tag) => (
                <Pressable
                  key={tag}
                  onPress={() => setQuery(tag.slice(1))}
                  style={[styles.trendingChip, { borderColor: theme.border, backgroundColor: theme.card }]}
                >
                  <Text style={[styles.trendingText, { color: theme.accent2 }]}>{tag}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.resultCount, { color: theme.text3 }]}>
          {totalResults} result{totalResults !== 1 ? "s" : ""}
        </Text>

        {visibleNews.map((item) => (
          <NewsCard
            key={item.id}
            item={item}
            theme={theme}
            compact
            currentUserId={user?.id}
            onPress={openArticle}
            onBookmark={toggleBookmark}
            onToggleLike={toggleLike}
          />
        ))}

        {visibleUsers.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              if (isAdmin) navigation.navigate("UserEdit", { userId: item.id });
            }}
            style={[styles.userCard, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <Avatar initials={item.avatar} imageUrl={item.avatarUrl} size={38} color={item.role === "admin" ? "#7C3AED" : "#3B82F6"} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.userName, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.userMeta, { color: theme.text2 }]}>
                {item.dept}
                {item.usn ? ` | ${item.usn}` : ""}
              </Text>
              {isAdmin ? <Text style={[styles.userMeta, { color: theme.text3 }]}>{item.email}</Text> : null}
            </View>
            <RoleBadge role={item.role} userType={item.userType} />
          </Pressable>
        ))}
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
  title: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  searchWrap: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    paddingVertical: 10,
  },
  categoriesWrap: {
    gap: 7,
  },
  resultTypeWrap: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
  },
  resultTypePill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  resultTypeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryPill: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 100,
  },
  trendingWrap: {
    marginBottom: 20,
  },
  trendingLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  trendingTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trendingChip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 13,
  },
  trendingText: {
    fontSize: 12,
    fontWeight: "700",
  },
  resultCount: {
    marginBottom: 10,
    fontSize: 11,
    fontWeight: "600",
  },
  userCard: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userName: {
    fontSize: 13,
    fontWeight: "800",
  },
  userMeta: {
    marginTop: 2,
    fontSize: 10.5,
    fontWeight: "600",
  },
});

export default SearchScreen;
