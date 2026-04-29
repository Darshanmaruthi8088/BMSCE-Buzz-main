import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import {
  addDoc,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../components/Avatar";
import { Badge, CategoryBadge } from "../components/Badge";
import { useApp } from "../contexts/AppContext";
import { db } from "../services/firebase";
import { getTheme } from "../services/theme";
import { formatPostReleaseDateTime, relativeTime } from "../services/utils";

const ArticleScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const commentInputRef = useRef(null);
  const insets = useSafeAreaInsets();

  const { dark, user, newsWithUser, toggleBookmark, toggleLike, useFirebaseBackend } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const { articleId } = route.params || {};
  const item = useMemo(() => newsWithUser.find((newsItem) => newsItem.id === articleId), [newsWithUser, articleId]);

  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);

  useEffect(() => {
    if (!item?.id || !useFirebaseBackend) {
      setComments([]);
      return undefined;
    }

    const commentsRef = query(collection(db, "news", item.id, "comments"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(commentsRef, (snapshot) => {
      const mapped = snapshot.docs.map((commentDoc) => {
        const data = commentDoc.data() || {};
        return {
          id: commentDoc.id,
          user: data.user || "User",
          userId: data.userId || "",
          avatar: data.avatar || "U",
          avatarUrl: data.avatarUrl || "",
          text: data.text || "",
          likes: Number.isFinite(data.likes) ? data.likes : 0,
          time: relativeTime(data.createdAt),
        };
      });
      setComments(mapped);
    });

    return () => unsubscribe();
  }, [item?.id, useFirebaseBackend]);

  if (!item) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}> 
        <Text style={[styles.notFoundText, { color: theme.text2 }]}>Article not found.</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.accent }]}> 
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isLiked = !!(user?.id && item.likedBy?.[user.id]);

  const postComment = async () => {
    if (!comment.trim() || !user?.id) return;
    const payload = {
      user: user.name,
      avatar: user.avatar,
      avatarUrl: user.avatarUrl || "",
      text: comment.trim(),
      likes: 0,
      createdAt: serverTimestamp(),
      userId: user.id,
    };

    setComment("");

    if (useFirebaseBackend) {
      try {
        await addDoc(collection(db, "news", item.id, "comments"), payload);
        await updateDoc(doc(db, "news", item.id), {
          comments: increment(1),
          [`commentedBy.${user.id}`]: true,
        });
      } catch (error) {
        console.error("Failed to post comment:", error);
      }
      return;
    }

    setComments((prev) => [...prev, { ...payload, id: `c${Date.now()}`, time: "just now" }]);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${item.title}\nhttps://bmsce-buzz.app/news/${item.id}`,
      });
    } catch (error) {
      console.error("Failed to share article:", error);
    }
  };

  const openCommentAuthorProfile = (commentItem) => {
    navigation.navigate("UserProfile", {
      userId: commentItem?.userId || "",
      fallbackName: commentItem?.user || "User",
      fallbackAvatar: commentItem?.avatar || "U",
      fallbackAvatarUrl: commentItem?.avatarUrl || "",
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    > 
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.header,
            borderBottomColor: theme.border,
            paddingTop: Math.max(12, insets.top + 8),
          },
        ]}
      > 
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.topRound, { borderColor: theme.border, backgroundColor: theme.card2 }]}
        >
          <Feather name="chevron-left" size={17} color={theme.text} />
        </Pressable>

        <Text style={[styles.topTitle, { color: theme.text }]} numberOfLines={1}>
          {item.category}
        </Text>

        <Pressable onPress={() => toggleBookmark(item.id)} style={styles.topPlainBtn}>
          <Ionicons
            name={item.bookmarked ? "bookmark" : "bookmark-outline"}
            size={20}
            color={item.bookmarked ? "#F59E0B" : theme.text2}
          />
        </Pressable>

        <Pressable onPress={handleShare} style={styles.topPlainBtn}>
          <Ionicons name="share-social-outline" size={20} color={theme.text2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          {item.coverImage ? <Image source={{ uri: item.coverImage }} style={styles.coverImage} resizeMode="cover" /> : null}

          <View style={styles.badgesRow}>
            <CategoryBadge category={item.category} />
            {item.priority === "urgent" ? <Badge text="Urgent" color="#DC2626" /> : null}
          </View>

          <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>

          <View style={[styles.authorRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}> 
            <Avatar
              initials={item.authorAvatar || item.author?.split(" ").map((word) => word[0]).join("").slice(0, 2) || "U"}
              imageUrl={item.authorAvatarUrl}
              size={40}
              color="#059669"
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.authorName, { color: theme.text }]}>{item.author}</Text>
              <Text style={[styles.authorSub, { color: theme.text2 }]}> 
                Released: {formatPostReleaseDateTime(item)} | {item.dept}
              </Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Feather name="eye" size={13} color={theme.text3} />
                <Text style={[styles.metricText, { color: theme.text3 }]}>{item.views || 0}</Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="trending-up" size={13} color={theme.accent} />
                <Text style={[styles.metricText, { color: theme.accent }]}>Trending</Text>
              </View>
            </View>
          </View>

          <Text style={[styles.bodyText, { color: theme.text }]}>{item.summary || item.body || ""}</Text>
          <Text style={[styles.bodyText, { color: theme.text }]}>Students are encouraged to stay updated with all official communications and portal announcements.</Text>

          <View style={[styles.quoteCard, { borderLeftColor: theme.accent, backgroundColor: `${theme.accent}14` }]}> 
            <Text style={[styles.quoteText, { color: theme.text }]}> 
              "This is an important announcement. Please share with peers and ensure timely action."
            </Text>
            <Text style={[styles.quoteAuthor, { color: theme.text2 }]}>- {item.author}, {item.dept}</Text>
          </View>

          {item.tags?.length ? (
            <View style={styles.tagsRow}>
              {item.tags.map((tag) => (
                <View key={tag} style={[styles.tagChip, { backgroundColor: `${theme.accent2}1F` }]}> 
                  <Text style={[styles.tagText, { color: theme.accent2 }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.actionsRow, { borderTopColor: theme.border, borderBottomColor: theme.border }]}> 
            <Pressable
              onPress={() => toggleLike(item.id)}
              style={[
                styles.actionBtn,
                {
                  borderColor: isLiked ? "#EF4444" : theme.border,
                  backgroundColor: isLiked ? "#EF444420" : "transparent",
                },
              ]}
            >
              <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? "#EF4444" : theme.text2} />
              <Text style={[styles.actionText, { color: isLiked ? "#EF4444" : theme.text2 }]}>{item.likes || 0}</Text>
            </Pressable>

            <Pressable
              onPress={() => commentInputRef.current?.focus()}
              style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: "transparent" }]}
            >
              <Feather name="message-circle" size={17} color={theme.text2} />
              <Text style={[styles.actionText, { color: theme.text2 }]}>{comments.length}</Text>
            </Pressable>

            <Pressable
              onPress={handleShare}
              style={[styles.actionBtn, { borderColor: theme.border, backgroundColor: "transparent" }]}
            >
              <Ionicons name="share-social-outline" size={17} color={theme.text2} />
              <Text style={[styles.actionText, { color: theme.text2 }]}>Share</Text>
            </Pressable>
          </View>

          <Text style={[styles.commentsTitle, { color: theme.text }]}>Comments ({comments.length})</Text>

          {comments.map((commentItem) => (
            <Pressable key={commentItem.id} onPress={() => openCommentAuthorProfile(commentItem)} style={styles.commentRow}>
              <Avatar initials={commentItem.avatar} imageUrl={commentItem.avatarUrl} size={30} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <View style={[styles.commentBubble, { backgroundColor: theme.card2 }]}> 
                  <Text style={[styles.commentMeta, { color: theme.text }]}> 
                    {commentItem.user} <Text style={{ color: theme.text3, fontWeight: "500" }}>| {commentItem.time}</Text>
                  </Text>
                  <Text style={[styles.commentText, { color: theme.text }]}>{commentItem.text}</Text>
                </View>
                <Text style={[styles.commentFooter, { color: theme.text3 }]}>Likes {commentItem.likes} | Reply</Text>
              </View>
            </Pressable>
          ))}

          <View style={styles.commentInputRow}>
            <Avatar initials={user?.avatar} imageUrl={user?.avatarUrl} size={32} />
            <View style={[styles.commentInputWrap, { borderColor: theme.border, backgroundColor: theme.input }]}> 
              <TextInput
                ref={commentInputRef}
                value={comment}
                onChangeText={setComment}
                placeholder="Write a comment"
                placeholderTextColor={theme.text3}
                style={[styles.commentInput, { color: theme.text }]}
              />
              <Pressable onPress={postComment} style={[styles.postBtn, { backgroundColor: theme.accent }]}> 
                <Text style={styles.postBtnText}>Post</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  notFoundText: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 14,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  topBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topRound: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  topPlainBtn: {
    padding: 5,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 100,
    paddingTop: 10,
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  coverImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 21,
    fontWeight: "900",
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  authorRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authorName: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  authorSub: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "500",
  },
  metricsRow: {
    alignItems: "flex-end",
    gap: 4,
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metricText: {
    fontSize: 11,
    fontWeight: "700",
  },
  bodyText: {
    fontSize: 14.5,
    lineHeight: 24,
  },
  quoteCard: {
    borderLeftWidth: 4,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  quoteText: {
    fontSize: 13.5,
    fontStyle: "italic",
    fontWeight: "600",
    lineHeight: 20,
  },
  quoteAuthor: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagChip: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  actionsRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  actionText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  commentsTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  commentRow: {
    flexDirection: "row",
    gap: 10,
  },
  commentBubble: {
    borderRadius: 13,
    borderTopLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  commentMeta: {
    fontSize: 11.5,
    fontWeight: "800",
    marginBottom: 4,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
  },
  commentFooter: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 4,
    marginLeft: 2,
  },
  commentInputRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  commentInputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 10,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  commentInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  postBtn: {
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  postBtnText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
});

export default ArticleScreen;
