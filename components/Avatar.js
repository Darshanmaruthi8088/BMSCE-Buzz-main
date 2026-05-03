import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo, useState } from "react";

const Avatar = ({ initials, imageUrl, size = 36, color = "#F59E0B", enablePreview = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const uri = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const canPreview = enablePreview && !!uri;
  const imageStyle = useMemo(
    () => ({ width: size, height: size, borderRadius: size / 2 }),
    [size]
  );

  return (
    <>
      <Pressable
        disabled={!canPreview}
        onPress={() => setIsOpen(true)}
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={imageStyle} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials}</Text>
        )}
      </Pressable>

      {canPreview ? (
        <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Image source={{ uri }} style={styles.previewImage} resizeMode="contain" />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  initials: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    height: "85%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#000000",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
});

export default Avatar;
