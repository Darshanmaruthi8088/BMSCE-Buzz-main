import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { Badge, CategoryBadge } from "./Badge";
import { toViewCountLabel } from "../services/utils";

const NewsCard = ({
  item,
  theme,
  compact = false,
  currentUserId,
  onPress,
  onBookmark,
  onToggleLike,
}) => {
  const isLiked = !!(currentUserId && item?.likedBy?.[currentUserId]);

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={[styles.headerRow, compact && styles.headerRowCompact]}>
        <View style={styles.badgeWrap}>
          <CategoryBadge category={item.category} small />
          {item.status === "pending" ? <Badge text="Pending Review" color="#B45309" small /> : null}
          {item.priority === "urgent" ? <Badge text="Urgent" color="#DC2626" small /> : null}
        </View>
        <Pressable onPress={() => onBookmark?.(item.id)} style={styles.iconButton}>
          <Ionicons
            name={item.bookmarked ? "bookmark" : "bookmark-outline"}
            size={17}
            color={item.bookmarked ? "#F59E0B" : theme.text3}
          />
        </Pressable>
      </View>

      <Text style={[styles.title, { color: theme.text }, compact && styles.titleCompact]}>{item.title}</Text>

      {item.coverImage ? <Image source={{ uri: item.coverImage }} style={styles.coverImage} resizeMode="cover" /> : null}

      {!compact ? (
        <Text style={[styles.summary, { color: theme.text2 }]} numberOfLines={3}>
          {item.summary || item.body || ""}
        </Text>
      ) : null}

      {!compact && item.tags?.length ? (
        <View style={styles.tagWrap}>
          {item.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={[styles.tagChip, { backgroundColor: `${theme.accent2}1F` }]}>
              <Text style={[styles.tagText, { color: theme.accent2 }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.authorWrap}>
          <Avatar
            initials={item.authorAvatar || item.author?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "U"}
            imageUrl={item.authorAvatarUrl}
            size={20}
            color="#3B82F6"
          />
          <Text style={[styles.authorText, { color: theme.text2 }]} numberOfLines={1}>
            {item.author}  {item.date?.slice(5)?.replace("-", "/")}
          </Text>
        </View>

        <View style={styles.metaWrap}>
          <View style={styles.metaItem}>
            <Feather name="eye" size={13} color={theme.text3} />
            <Text style={[styles.metaText, { color: theme.text3 }]}>{toViewCountLabel(item.views)}</Text>
          </View>

          <Pressable style={styles.metaItem} onPress={() => onToggleLike?.(item.id)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={14} color={isLiked ? "#EF4444" : theme.text3} />
            <Text style={[styles.metaText, { color: isLiked ? "#EF4444" : theme.text3 }]}>{item.likes || 0}</Text>
          </Pressable>

          <View style={styles.metaItem}>
            <Feather name="message-circle" size={13} color={theme.text3} />
            <Text style={[styles.metaText, { color: theme.text3 }]}>{item.comments || 0}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  headerRowCompact: {
    marginBottom: 0,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  iconButton: {
    padding: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  titleCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  coverImage: {
    width: "100%",
    height: 150,
    borderRadius: 12,
    marginTop: 2,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  authorWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  authorText: {
    fontSize: 10.5,
    fontWeight: "600",
    flexShrink: 1,
  },
  metaWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default NewsCard;
