import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Linking,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useUser } from "../components/UserContext";
import React, { useState, useEffect, useRef } from "react";

const SOCIAL_KEYS = [
  "instagram",
  "snapchat",
  "spotify",
  "linkedin",
  "github",
] as const;
type SocialKey = (typeof SOCIAL_KEYS)[number];

const SOCIAL_URLS: Partial<Record<SocialKey, string>> = {
  instagram: "https://instagram.com/",
  linkedin: "https://linkedin.com/in/",
  github: "https://github.com/",
  spotify: "https://open.spotify.com/user/",
};

interface EditData {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  hometown: string;
  school: string;
  job: string;
  interests: string[];
  links: { [K in SocialKey]: string };
}

export default function ProfileScreen() {
  const { user, setUser } = useUser();
  const [editData, setEditData] = useState<EditData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interestInput, setInterestInput] = useState("");
  const interestInputRef = useRef<TextInput>(null);
  const [addedSocials, setAddedSocials] = useState<SocialKey[]>([]);
  const [showSocialPicker, setShowSocialPicker] = useState(false);

  useEffect(() => {
    if (user) {
      const presentSocials = SOCIAL_KEYS.filter((k) => user.links?.[k]);
      setAddedSocials(presentSocials);
      setEditData({
        email: user.email || "",
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        hometown: user.hometown || "",
        school: user.school || "",
        job: user.job || "",
        interests: Array.isArray(user.interests) ? user.interests : [],
        links: {
          instagram: user.links?.instagram || "",
          snapchat: user.links?.snapchat || "",
          spotify: user.links?.spotify || "",
          linkedin: user.links?.linkedin || "",
          github: user.links?.github || "",
        },
      });
      setIsEditing(false);
      setInterestInput("");
    }
  }, [user]);

  if (!user || !editData) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.text}>No user info available.</Text>
      </View>
    );
  }

  // Check if any field has changed
  const isChanged = () => {
    if (!user) return false;
    const interestsArr = Array.isArray(user.interests) ? user.interests : [];
    return (
      editData.email !== user.email ||
      editData.username !== user.username ||
      editData.first_name !== (user.first_name || "") ||
      editData.last_name !== (user.last_name || "") ||
      editData.hometown !== (user.hometown || "") ||
      editData.school !== (user.school || "") ||
      editData.job !== (user.job || "") ||
      JSON.stringify(editData.interests) !== JSON.stringify(interestsArr) ||
      SOCIAL_KEYS.some(
        (k) => (editData.links[k] || "") !== (user.links?.[k] || "")
      )
    );
  };

  const handleChange = (
    field: keyof Omit<EditData, "interests" | "links">,
    value: string
  ) => {
    setEditData({ ...editData, [field]: value });
    setIsEditing(true);
  };

  const handleSocialChange = (key: SocialKey, value: string) => {
    setEditData({ ...editData, links: { ...editData.links, [key]: value } });
    setIsEditing(true);
  };

  const handleAddInterest = () => {
    const trimmed = interestInput.trim();
    if (trimmed && !editData.interests.includes(trimmed)) {
      setEditData({ ...editData, interests: [...editData.interests, trimmed] });
      setIsEditing(true);
    }
    setInterestInput("");
    Keyboard.dismiss();
  };

  const handleRemoveInterest = (interest: string) => {
    setEditData({
      ...editData,
      interests: editData.interests.filter((i) => i !== interest),
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditData({
      email: user.email || "",
      username: user.username || "",
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      hometown: user.hometown || "",
      school: user.school || "",
      job: user.job || "",
      interests: Array.isArray(user.interests) ? user.interests : [],
      links: {
        instagram: user.links?.instagram || "",
        snapchat: user.links?.snapchat || "",
        spotify: user.links?.spotify || "",
        linkedin: user.links?.linkedin || "",
        github: user.links?.github || "",
      },
    });
    setIsEditing(false);
    setInterestInput("");
  };

  const handleSave = async () => {
    setLoading(true);
    // Only send non-empty links, and for IG/LinkedIn/GitHub, prepend the starter if not empty
    const links: { [K in SocialKey]?: string } = {};
    SOCIAL_KEYS.forEach((k) => {
      const val = editData.links[k];
      if (val) {
        if (SOCIAL_URLS[k]) {
          // Only add if not already a full URL
          links[k] = val.startsWith("http")
            ? val
            : SOCIAL_URLS[k]! + val.replace(/^\/+/, "");
        } else {
          links[k] = val;
        }
      }
    });
    const payload = {
      email: editData.email,
      username: editData.username,
      first_name: editData.first_name,
      last_name: editData.last_name,
      hometown: editData.hometown,
      school: editData.school,
      job: editData.job,
      interests: editData.interests,
      links,
    };
    try {
      const response = await fetch(`http://10.0.0.64:8000/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to update profile");
      }
      const updatedUser = await response.json();
      setUser(updatedUser);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSocial = (key: SocialKey) => {
    setAddedSocials([...addedSocials, key]);
    setShowSocialPicker(false);
    setIsEditing(true);
  };

  const handleRemoveSocial = (key: SocialKey) => {
    setAddedSocials(addedSocials.filter((k) => k !== key));
    setEditData({
      ...editData,
      links: { ...editData.links, [key]: "" },
    });
    setIsEditing(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.profileCard}>
          <Text style={styles.title}>
            {editData.first_name
              ? `${editData.first_name}'s Profile`
              : "Profile"}
          </Text>
          <View style={styles.section}>
            <Text style={styles.label}>Hometown</Text>
            <TextInput
              style={styles.input}
              value={editData.hometown}
              onChangeText={(v) => handleChange("hometown", v)}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>School</Text>
            <TextInput
              style={styles.input}
              value={editData.school}
              onChangeText={(v) => handleChange("school", v)}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Job</Text>
            <TextInput
              style={styles.input}
              value={editData.job}
              onChangeText={(v) => handleChange("job", v)}
            />
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Interests</Text>
            <View style={styles.interestInputRow}>
              <TextInput
                ref={interestInputRef}
                style={[styles.input, { flex: 1, marginRight: 8 }]}
                value={interestInput}
                onChangeText={setInterestInput}
                placeholder="Type an interest and press enter"
                onSubmitEditing={handleAddInterest}
                blurOnSubmit={false}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.addInterestButton}
                onPress={handleAddInterest}
              >
                <Text style={styles.addInterestButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.interestsBubbleRow}>
              {editData.interests.map((interest) => (
                <View key={interest} style={styles.interestBubble}>
                  <Text style={styles.interestText}>{interest}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveInterest(interest)}
                  >
                    <Text style={styles.removeInterest}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Social Links</Text>
            {addedSocials.map((key) => (
              <View
                key={key}
                style={{
                  width: "100%",
                  marginBottom: 8,
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={styles.socialLabel}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
                <TextInput
                  style={[styles.input, { flex: 1, marginLeft: 8 }]}
                  value={editData.links[key]}
                  onChangeText={(v) => handleSocialChange(key, v)}
                  placeholder={`Enter your ${key} handle or link`}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveSocial(key)}
                  style={styles.removeSocialButton}
                >
                  <Text style={styles.removeInterest}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {showSocialPicker ? (
              <View style={styles.socialPickerContainer}>
                {SOCIAL_KEYS.filter((k) => !addedSocials.includes(k)).map(
                  (key) => (
                    <TouchableOpacity
                      key={key}
                      style={styles.socialPickerOption}
                      onPress={() => handleAddSocial(key)}
                    >
                      <Text style={styles.socialPickerText}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  )
                )}
                <TouchableOpacity
                  style={styles.socialPickerCancel}
                  onPress={() => setShowSocialPicker(false)}
                >
                  <Text style={styles.socialPickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              addedSocials.length < SOCIAL_KEYS.length && (
                <TouchableOpacity
                  style={styles.addSocialButton}
                  onPress={() => setShowSocialPicker(true)}
                >
                  <Text style={styles.addInterestButtonText}>
                    Add Social Link
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
          {isChanged() && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  loading && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    minHeight: "100%",
    backgroundColor: "#f5f6fa",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    alignItems: "center",
    justifyContent: "center",
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 18,
    textAlign: "left",
  },
  section: {
    marginBottom: 16,
    alignItems: "flex-start",
    width: "100%",
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#888",
    marginBottom: 2,
    textAlign: "left",
  },
  socialLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 2,
    marginLeft: 2,
  },
  value: {
    fontSize: 17,
    color: "#222",
    marginBottom: 2,
    textAlign: "left",
  },
  input: {
    width: "100%",
    fontSize: 17,
    color: "#222",
    backgroundColor: "#f0f4f8",
    borderRadius: 8,
    padding: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  interestInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    width: "100%",
  },
  addInterestButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  addInterestButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  interestsBubbleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    width: "100%",
  },
  interestBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e7ef",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 15,
    color: "#333",
    marginRight: 6,
  },
  removeInterest: {
    color: "#ff3b30",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 2,
    marginTop: -2,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 18,
    gap: 12,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    alignItems: "center",
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: "#007AFF",
  },
  cancelButton: {
    backgroundColor: "#aaa",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  text: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#888",
  },
  socialInputRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  socialUrlStarter: {
    fontSize: 15,
    color: "#888",
    marginRight: 2,
  },
  removeSocialButton: {
    padding: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  socialPickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
    width: "100%",
  },
  socialPickerOption: {
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  socialPickerText: {
    fontSize: 15,
    color: "#333",
  },
  socialPickerCancel: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  socialPickerCancelText: {
    fontSize: 15,
    color: "#333",
  },
  addSocialButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
