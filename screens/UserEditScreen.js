import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppInput from "../components/AppInput";
import AppButton from "../components/AppButton";
import { useApp } from "../contexts/AppContext";
import { PRIMARY_ADMIN, STUDY_YEARS } from "../services/constants";
import { getTheme } from "../services/theme";

const UserEditScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params || {};
  const insets = useSafeAreaInsets();

  const { dark, users, saveUserEdits } = useApp();
  const theme = useMemo(() => getTheme(dark), [dark]);

  const targetUser = users.find((item) => item.id === userId) || null;
  const isPrimaryAdminUser =
    (targetUser?.email || "").trim().toLowerCase() === PRIMARY_ADMIN.email.toLowerCase();

  const [form, setForm] = useState({
    name: "",
    email: "",
    dept: "",
    role: "user",
    userType: "student",
    year: STUDY_YEARS[0],
    usn: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!targetUser) return;
    setForm({
      name: targetUser.name || "",
      email: targetUser.email || "",
      dept: targetUser.dept || "",
      role: targetUser.role || "user",
      userType: targetUser.userType || "student",
      year: targetUser.year || STUDY_YEARS[0],
      usn: targetUser.usn || "",
    });
  }, [targetUser]);

  useEffect(() => {
    if (!isPrimaryAdminUser && form.role === "admin") {
      setForm((prev) => ({ ...prev, role: "user" }));
    }
  }, [form.role, isPrimaryAdminUser]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!targetUser || isPrimaryAdminUser || !form.name.trim()) return;
    setSaving(true);
    const ok = await saveUserEdits({
      ...targetUser,
      name: form.name.trim(),
      email: form.email.trim(),
      dept: form.dept.trim(),
      role: form.role,
      userType: form.role === "user" ? form.userType : null,
      year: form.role === "user" && form.userType === "student" ? form.year : null,
      usn: form.role === "user" && form.userType === "student" ? form.usn : null,
    });
    setSaving(false);
    if (ok) navigation.goBack();
  };

  if (!targetUser) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.bg }]}> 
        <Text style={[styles.emptyText, { color: theme.text2 }]}>User not found.</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.accent }]}> 
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  if (isPrimaryAdminUser) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.bg }]}>
        <Text style={[styles.emptyText, { color: theme.text2 }]}>Admin profile editing is disabled.</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: theme.accent }]}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

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
          style={[styles.backCircle, { borderColor: theme.border, backgroundColor: theme.card2 }]}
        >
          <Feather name="chevron-left" size={17} color={theme.text} />
        </Pressable>

        <Text style={[styles.headerTitle, { color: theme.text }]}>Edit User</Text>

        <AppButton
          title={saving ? "Saving..." : "Save"}
          onPress={handleSave}
          background={theme.accent}
          borderColor={theme.accent}
          style={styles.saveBtn}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppInput
          label="Full Name"
          value={form.name}
          onChangeText={(value) => update("name", value)}
          theme={theme}
          style={styles.inputGap}
          autoCapitalize="words"
        />

        <AppInput
          label="Email"
          value={form.email}
          onChangeText={(value) => update("email", value)}
          theme={theme}
          style={styles.inputGap}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <AppInput
          label="Department"
          value={form.dept}
          onChangeText={(value) => update("dept", value)}
          theme={theme}
          style={styles.inputGap}
          autoCapitalize="words"
        />

        <View style={styles.inputGap}>
          <Text style={[styles.label, { color: theme.text2 }]}>Role</Text>
          <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
            <Picker
              selectedValue={form.role}
              onValueChange={(value) => update("role", value)}
              dropdownIconColor={theme.text2}
              style={{ color: theme.text }}
            >
              <Picker.Item label="User" value="user" />
              {isPrimaryAdminUser ? <Picker.Item label="Admin" value="admin" /> : null}
            </Picker>
          </View>
        </View>

        {form.role === "user" ? (
          <>
            <View style={styles.inputGap}>
              <Text style={[styles.label, { color: theme.text2 }]}>Type</Text>
              <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
                <Picker
                  selectedValue={form.userType}
                  onValueChange={(value) => update("userType", value)}
                  dropdownIconColor={theme.text2}
                  style={{ color: theme.text }}
                >
                  <Picker.Item label="Student" value="student" />
                  <Picker.Item label="Faculty" value="faculty" />
                </Picker>
              </View>
            </View>

            {form.userType === "student" ? (
              <>
                <View style={styles.inputGap}>
                  <Text style={[styles.label, { color: theme.text2 }]}>Year</Text>
                  <View style={[styles.pickerWrap, { backgroundColor: theme.input, borderColor: theme.border }]}> 
                    <Picker
                      selectedValue={form.year}
                      onValueChange={(value) => update("year", value)}
                      dropdownIconColor={theme.text2}
                      style={{ color: theme.text }}
                    >
                      {STUDY_YEARS.map((item) => (
                        <Picker.Item key={item} label={item} value={item} />
                      ))}
                    </Picker>
                  </View>
                </View>

                <AppInput
                  label="USN"
                  value={form.usn}
                  onChangeText={(value) => update("usn", value.toUpperCase())}
                  theme={theme}
                  autoCapitalize="characters"
                />
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  backBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backCircle: {
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
  saveBtn: {
    minHeight: 34,
    paddingHorizontal: 14,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 100,
  },
  inputGap: {
    marginBottom: 14,
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
});

export default UserEditScreen;
