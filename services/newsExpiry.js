import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { getPostEndTimeMs } from "./utils";

const BATCH_LIMIT = 450;

export const canSessionDeletePostForExpiry = (post, userId, isPrimaryAdmin) => {
  if (!post?.id || !userId) return false;
  if (isPrimaryAdmin) return true;
  return post.authorId === userId;
};

export const listExpiredNewsIdsForUser = (newsItems, userId, isPrimaryAdmin, nowMs = Date.now()) => {
  if (!Array.isArray(newsItems) || !userId) return [];
  const ids = [];
  for (const item of newsItems) {
    const endMs = getPostEndTimeMs(item);
    if (endMs == null || endMs >= nowMs) continue;
    if (!canSessionDeletePostForExpiry(item, userId, isPrimaryAdmin)) continue;
    ids.push(item.id);
  }
  return ids;
};

export const deleteNewsDocAndComments = async (db, newsId) => {
  if (!db || !newsId) return;

  const commentsRef = collection(db, "news", newsId, "comments");
  const snapshot = await getDocs(commentsRef);
  const docs = snapshot.docs;

  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const chunk = docs.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await deleteDoc(doc(db, "news", newsId));
};
