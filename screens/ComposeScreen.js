import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Picker } from "@react-native-picker/picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppButton from "../components/AppButton";
import AppInput from "../components/AppInput";
import { Badge, CategoryBadge } from "../components/Badge";
import { useApp } from "../contexts/AppContext";
import { CATEGORIES, DEPTS } from "../services/constants";
import { getTheme } from "../services/theme";

const createDefaultStartDate = () => {
  const value = new Date();
  value.setMinutes(0, 0, 0);
  value.setHours(value.getHours() + 1);
  return value;
};

const createDefaultEndDate = (startDate) => new Date(startDate.getTime() + 60 * 60 * 1000);

const mergeDateTimeByMode = (baseDate, selectedDate, mode) => {
  const next = new Date(baseDate);
  if (mode === "date") {
    next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    return next;
  }
  next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return next;
};

const formatDateLabel = (value) =>
  value.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });

const formatTimeLabel = (value) =>
  value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

const ComposeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { dark, user, publishPost } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("Academics");
  const [tags, setTags] = useState("");
  const [priority, setPriority] = useState("normal");
  const [step, setStep] = useState(1);
  const [coverImageName, setCoverImageName] = useState("");
  const [coverImageUri, setCoverImageUri] = useState("");
  const [startDateTime, setStartDateTime] = useState(() => createDefaultStartDate());
  const [endDateTime, setEndDateTime] = useState(() => createDefaultEndDate(createDefaultStartDate()));
  const [pickerConfig, setPickerConfig] = useState({ visible: false, mode: "date", target: "start" });

  const openDateTimePicker = (target, mode) => {
    setPickerConfig({ visible: true, target, mode });
  };

  const applyDateTimeSelection = (selectedDate) => {
    if (!selectedDate) return;
    if (pickerConfig.target === "start") {
      const nextStart = mergeDateTimeByMode(startDateTime, selectedDate, pickerConfig.mode);
      setStartDateTime(nextStart);
      if (endDateTime <= nextStart) {
        setEndDateTime(createDefaultEndDate(nextStart));
      }
      return;
    }

    const nextEnd = mergeDateTimeByMode(endDateTime, selectedDate, pickerConfig.mode);
    if (nextEnd <= startDateTime) {
      Alert.alert("Validation", "Ending date and time must be after the start date and time.");
      setEndDateTime(createDefaultEndDate(startDateTime));
      return;
    }
    setEndDateTime(nextEnd);
  };

  const onDateTimeChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setPickerConfig((prev) => ({ ...prev, visible: false }));
    }
    if (event?.type === "dismissed" || !selectedDate) return;
    applyDateTimeSelection(selectedDate);
    if (Platform.OS !== "android") {
      setPickerConfig((prev) => ({ ...prev, visible: false }));
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert("Validation", "Title is required.");
      return;
    }
    if (!body.trim()) {
      Alert.alert("Validation", "Content is required.");
      return;
    }
    if (endDateTime <= startDateTime) {
      Alert.alert("Validation", "Ending date and time must be after the start date and time.");
      return;
    }

    const ok = await publishPost({
      title,
      body,
      category,
      tags: tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      priority,
      coverImageUri,
      coverImageName,
      startDateTime: startDateTime.toISOString(),
      endDateTime: endDateTime.toISOString(),
    });

    if (ok) {
      navigation.goBack();
      return;
    }
    Alert.alert("Publish failed", "Image upload failed. Please check your connection and try again.");
  };

  const pickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow media access to select a cover image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
      exif: false,
      selectionLimit: 1,
    });

    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.uri) setCoverImageUri(asset.uri);
    if (asset?.fileName) setCoverImageName(asset.fileName);
    else if (asset?.uri) setCoverImageName(asset.uri.split("/").pop() || "selected-image.jpg");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    > 
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
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.closeBtn, { borderColor: theme.border, backgroundColor: theme.card2 }]}
        >
          <Feather name="x" size={17} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]}>New Article</Text>

        <AppButton
          title="Submit"
          onPress={submit}
          background={theme.accent}
          borderColor={theme.accent}
          style={styles.submitBtn}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.stepsWrap, { backgroundColor: theme.card, borderColor: theme.border }]}> 
          {["Details", "Content", "Publish"].map((label, index) => (
            <Pressable
              key={label}
              onPress={() => setStep(index + 1)}
              style={[styles.stepBtn, step === index + 1 && { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.stepText, { color: step === index + 1 ? "#FFFFFF" : theme.text2 }]}>
                {index + 1}. {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {step === 1 ? (
          <View style={styles.sectionGap}>
            <AppInput
              label="Title *"
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a compelling headline"
              autoCapitalize="sentences"
              theme={theme}
            />

            <View>
              <Text style={[styles.label, { color: theme.text2 }]}>Category *</Text>
              <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
                <Picker
                  selectedValue={category}
                  onValueChange={(value) => setCategory(value)}
                  dropdownIconColor={theme.text2}
                  style={{ color: theme.text }}
                >
                  {CATEGORIES.filter((item) => item !== "All").map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
            </View>

            <View>
              <Text style={[styles.label, { color: theme.text2 }]}>Department</Text>
              <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
                <Picker selectedValue={user?.dept} dropdownIconColor={theme.text2} style={{ color: theme.text }}>
                  {DEPTS.map((item) => (
                    <Picker.Item key={item} label={item} value={item} />
                  ))}
                </Picker>
              </View>
            </View>

            <AppInput
              label="Tags (comma-separated)"
              value={tags}
              onChangeText={setTags}
              placeholder="e.g. TCS, Placement, 2025"
              autoCapitalize="none"
              theme={theme}
            />

            <AppButton
              title="Next: Add Content"
              onPress={() => setStep(2)}
              background={theme.accent}
              borderColor={theme.accent}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.sectionGap}>
            <View style={[styles.editorTools, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              {["B", "I", "U", "H1", "H2", "List", "Link", "#"].map((token) => (
                <Pressable
                  key={token}
                  onPress={() => setBody((prev) => (prev ? `${prev} [${token}]` : `[${token}]`))}
                  style={[styles.toolBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
                >
                  <Text style={[styles.toolText, { color: theme.text }]}>{token}</Text>
                </Pressable>
              ))}
            </View>

            <View>
              <Text style={[styles.label, { color: theme.text2 }]}>Content *</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your article"
                placeholderTextColor={theme.text3}
                multiline
                style={[styles.bodyInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.input }]}
              />
            </View>

            <Pressable
              onPress={pickCoverImage}
              style={[styles.uploadCard, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Text style={[styles.uploadTitle, { color: theme.text2 }]}>Upload Cover Image</Text>
              <Text style={[styles.uploadSub, { color: theme.text3 }]}>{coverImageName || "PNG, JPG up to 10MB"}</Text>
              {coverImageUri ? <Image source={{ uri: coverImageUri }} style={styles.coverPreview} /> : null}
            </Pressable>

            <View style={styles.rowActions}>
              <AppButton
                title="Back"
                onPress={() => setStep(1)}
                outline
                borderColor={theme.border}
                color={theme.text}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Next"
                onPress={() => setStep(3)}
                background={theme.accent}
                borderColor={theme.accent}
                style={{ flex: 2 }}
              />
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.sectionGap}>
            <View>
              <Text style={[styles.label, { color: theme.text2 }]}>Priority Level</Text>
              <View style={styles.priorityRow}>
                {[
                  ["normal", "Normal", "#059669"],
                  ["high", "High", "#F59E0B"],
                  ["urgent", "Urgent", "#EF4444"],
                ].map(([value, label, color]) => (
                  <Pressable
                    key={value}
                    onPress={() => setPriority(value)}
                    style={[
                      styles.priorityBtn,
                      {
                        borderColor: priority === value ? color : theme.border,
                        backgroundColor: priority === value ? `${color}22` : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: priority === value ? color : theme.text2 }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.scheduleCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.previewLabel, { color: theme.text2 }]}>Event Schedule</Text>
              <View style={styles.scheduleSection}>
                <Text style={[styles.scheduleHeading, { color: theme.text }]}>Start</Text>
                <View style={styles.scheduleButtonsRow}>
                  <Pressable
                    onPress={() => openDateTimePicker("start", "date")}
                    style={[styles.scheduleBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
                  >
                    <Text style={[styles.scheduleBtnText, { color: theme.text }]}>{formatDateLabel(startDateTime)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openDateTimePicker("start", "time")}
                    style={[styles.scheduleBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
                  >
                    <Text style={[styles.scheduleBtnText, { color: theme.text }]}>{formatTimeLabel(startDateTime)}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.scheduleSection}>
                <Text style={[styles.scheduleHeading, { color: theme.text }]}>End</Text>
                <View style={styles.scheduleButtonsRow}>
                  <Pressable
                    onPress={() => openDateTimePicker("end", "date")}
                    style={[styles.scheduleBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
                  >
                    <Text style={[styles.scheduleBtnText, { color: theme.text }]}>{formatDateLabel(endDateTime)}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openDateTimePicker("end", "time")}
                    style={[styles.scheduleBtn, { borderColor: theme.border, backgroundColor: theme.input }]}
                  >
                    <Text style={[styles.scheduleBtnText, { color: theme.text }]}>{formatTimeLabel(endDateTime)}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {pickerConfig.visible ? (
              <DateTimePicker
                value={pickerConfig.target === "start" ? startDateTime : endDateTime}
                mode={pickerConfig.mode}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                is24Hour={false}
                minimumDate={pickerConfig.target === "end" && pickerConfig.mode === "date" ? startDateTime : undefined}
                onChange={onDateTimeChange}
              />
            ) : null}

            <View style={[styles.previewCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <Text style={[styles.previewLabel, { color: theme.text2 }]}>Preview</Text>
              <View style={styles.previewBadges}>
                <CategoryBadge category={category} small />
                <Badge
                  text={priority}
                  color={priority === "urgent" ? "#EF4444" : priority === "high" ? "#F59E0B" : "#059669"}
                  small
                />
              </View>
              <Text style={[styles.previewTitle, { color: theme.text }]}>{title || "Your article title here"}</Text>
              <Text style={[styles.previewSub, { color: theme.text2 }]}>By {user?.name}  {user?.dept}</Text>
              <Text style={[styles.previewSub, { color: theme.text2 }]}>
                {formatDateLabel(startDateTime)} {formatTimeLabel(startDateTime)} to {formatDateLabel(endDateTime)}{" "}
                {formatTimeLabel(endDateTime)}
              </Text>
            </View>

            <View style={styles.rowActions}>
              <AppButton
                title="Back"
                onPress={() => setStep(2)}
                outline
                borderColor={theme.border}
                color={theme.text}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Submit"
                onPress={submit}
                background="#059669"
                borderColor="#059669"
                style={{ flex: 2 }}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  submitBtn: {
    minHeight: 34,
    paddingHorizontal: 14,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 100,
  },
  stepsWrap: {
    borderWidth: 1,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 20,
  },
  stepBtn: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    fontSize: 11,
    fontWeight: "800",
  },
  sectionGap: {
    gap: 14,
  },
  label: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  pickerWrap: {
    borderWidth: 1.5,
    borderRadius: 11,
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
  },
  editorTools: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  toolBtn: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  toolText: {
    fontSize: 11,
    fontWeight: "700",
  },
  bodyInput: {
    minHeight: 180,
    borderWidth: 1.5,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 13.5,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  uploadCard: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 11,
    paddingVertical: 20,
    alignItems: "center",
  },
  uploadTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  uploadSub: {
    marginTop: 3,
    fontSize: 11,
  },
  coverPreview: {
    marginTop: 10,
    width: "92%",
    height: 160,
    borderRadius: 10,
  },
  rowActions: {
    flexDirection: "row",
    gap: 8,
  },
  priorityRow: {
    flexDirection: "row",
    gap: 8,
  },
  priorityBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 11,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "800",
  },
  scheduleCard: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  scheduleSection: {
    gap: 7,
  },
  scheduleHeading: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  scheduleButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  scheduleBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewLabel: {
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  previewBadges: {
    flexDirection: "row",
    gap: 7,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 20,
  },
  previewSub: {
    marginTop: 5,
    fontSize: 11,
  },
});

export default ComposeScreen;
