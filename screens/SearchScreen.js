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
import NewsCard from "../components/NewsCard";
import { useApp } from "../contexts/AppContext";
import { CATEGORIES } from "../services/constants";
import { getTheme } from "../services/theme";

const SearchScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { dark, user, newsWithUser, toggleBookmark, toggleLike, incrementArticleViews } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const results = useMemo(() => {
    return newsWithUser.filter((item) => {
      if (item.status === "pending") return false;
      const q = query.toLowerCase();
      const matchQuery =
        !q ||
        item.title?.toLowerCase().includes(q) ||
        item.summary?.toLowerCase().includes(q) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(q));
      return matchQuery && (category === "All" || item.category === category);
    });
  }, [newsWithUser, query, category]);

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
            placeholder="Search articles, events, clubs"
            placeholderTextColor={theme.text3}
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>

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
          {results.length} result{results.length !== 1 ? "s" : ""}
        </Text>

        {results.map((item) => (
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
});

export default SearchScreen;
