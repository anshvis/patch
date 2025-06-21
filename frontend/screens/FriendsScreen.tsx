import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useUser } from "../components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";

// API base URL - must match the one used in other components
const API_URL = "http://10.0.0.64:8000";

interface Friend {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  friendship_id?: number;
}

interface ContactMatch {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  phone_number: string;
  is_registered: boolean;
}

export default function FriendsScreen() {
  const { user, checkContacts } = useUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsPermissionGranted, setContactsPermissionGranted] = useState<
    boolean | null
  >(null);

  // Fetch user's friends when component mounts
  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchFriendRequests();
      checkContactsPermission();
    }
  }, [user]);

  // Check if contacts permission is already granted
  const checkContactsPermission = async () => {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      setContactsPermissionGranted(status === "granted");
    } catch (error) {
      console.error("Error checking contacts permission:", error);
      setContactsPermissionGranted(false);
    }
  };

  const fetchFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/users/${user.id}/friends`);

      if (response.ok) {
        const data = await response.json();
        setFriends(data);
      } else {
        console.error("Failed to fetch friends:", response.status);
        // If the endpoint doesn't exist yet, use empty array
        setFriends([]);
      }
    } catch (error) {
      console.error("Error fetching friends:", error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      setLoadingRequests(true);
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests`
      );

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data);
      } else {
        console.error("Failed to fetch friend requests:", response.status);
        setPendingRequests([]);
      }
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      setPendingRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const syncContacts = async () => {
    try {
      setLoadingContacts(true);
      const { status } = await Contacts.requestPermissionsAsync();

      setContactsPermissionGranted(status === "granted");

      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "To find friends from your contacts, please enable contacts access in settings."
        );
        setLoadingContacts(false);
        return;
      }

      await loadContactMatches();
    } catch (error) {
      console.error("Error syncing contacts:", error);
      Alert.alert("Error", "Failed to sync contacts. Please try again.");
    } finally {
      setLoadingContacts(false);
    }
  };

  const refreshContacts = async () => {
    if (!contactsPermissionGranted) {
      syncContacts();
      return;
    }

    try {
      setLoadingContacts(true);
      await loadContactMatches();
    } catch (error) {
      console.error("Error refreshing contacts:", error);
      Alert.alert("Error", "Failed to refresh contacts. Please try again.");
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadContactMatches = async () => {
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (data.length > 0) {
        // Extract phone numbers
        const phoneNumbers = data
          .filter(
            (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
          )
          .map((contact) => contact.phoneNumbers![0].number!);

        // Check which contacts are registered users
        const contactsResult = await checkContacts(phoneNumbers);

        // Format results
        const matches: ContactMatch[] = [];
        for (const [phone, userData] of Object.entries(contactsResult)) {
          const userInfo = userData as any;
          if (userInfo.is_registered && userInfo.id !== user?.id) {
            // Skip users who are already friends
            if (friends.some((friend) => friend.id === userInfo.id)) {
              continue;
            }

            // Skip users who have pending friend requests
            if (pendingRequests.some((request) => request.id === userInfo.id)) {
              continue;
            }

            matches.push({
              id: userInfo.id,
              username: userInfo.username,
              first_name: userInfo.first_name,
              last_name: userInfo.last_name,
              phone_number: phone,
              is_registered: true,
            });
          }
        }

        setContactMatches(matches);

        if (matches.length === 0) {
          Alert.alert(
            "No New Contacts",
            "All your contacts who use the app are already your friends or have pending requests."
          );
        } else {
          Alert.alert(
            "Contacts Synced",
            `Found ${matches.length} new contacts using the app!`
          );
        }
      } else {
        Alert.alert("No Contacts", "No contacts found on your device.");
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      throw error;
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await fetch(
        `${API_URL}/users/search?query=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        // Filter out current user, existing friends, and pending requests
        const filteredResults = data.filter(
          (result: Friend) =>
            result.id !== user?.id &&
            !friends.some((friend) => friend.id === result.id) &&
            !pendingRequests.some((request) => request.id === result.id)
        );
        setSearchResults(filteredResults);
      } else {
        console.error("Failed to search users:", response.status);
        // If the endpoint doesn't exist yet, show a message
        Alert.alert(
          "Search not available",
          "User search functionality is not available yet."
        );
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching users:", error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addFriend = async (friendId: number) => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/friends`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend_id: friendId }),
      });

      if (response.ok) {
        // Refresh all lists
        fetchFriends();
        fetchFriendRequests();

        // Remove from search results
        setSearchResults(
          searchResults.filter((result) => result.id !== friendId)
        );
        // Remove from contact matches if present
        setContactMatches(
          contactMatches.filter((match) => match.id !== friendId)
        );
        Alert.alert("Success", "Friend added successfully!");
      } else {
        const errorData = await response.text();
        console.error("Failed to add friend:", response.status, errorData);

        // Check if the error is because friendship already exists
        if (errorData.includes("Friendship already exists")) {
          Alert.alert(
            "Already Friends",
            "You already have a pending or accepted friendship with this user."
          );
          // Refresh lists to make sure UI is in sync
          fetchFriends();
          fetchFriendRequests();
        } else if (errorData.includes("User not found")) {
          Alert.alert(
            "User Not Found",
            "The user you're trying to add doesn't exist or has been deleted."
          );
        } else {
          Alert.alert("Error", `Failed to add friend: ${errorData}`);
        }
      }
    } catch (error) {
      console.error("Error adding friend:", error);
      Alert.alert("Error", "An error occurred while adding friend.");
    }
  };

  const acceptFriendRequest = async (friendshipId: number) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests/${friendshipId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_accepted: true }),
        }
      );

      if (response.ok) {
        // Refresh all lists
        fetchFriendRequests();
        fetchFriends();

        // Refresh contacts to filter out the newly added friend
        if (contactsPermissionGranted) {
          loadContactMatches();
        }

        Alert.alert("Success", "Friend request accepted!");
      } else {
        const errorData = await response.text();
        console.error(
          "Failed to accept friend request:",
          response.status,
          errorData
        );
        Alert.alert(
          "Error",
          "Failed to accept friend request. Please try again."
        );
      }
    } catch (error) {
      console.error("Error accepting friend request:", error);
      Alert.alert("Error", "An error occurred while accepting friend request.");
    }
  };

  const rejectFriendRequest = async (friendshipId: number) => {
    if (!user) return;

    try {
      const response = await fetch(
        `${API_URL}/users/${user.id}/friend-requests/${friendshipId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ is_accepted: false }),
        }
      );

      if (response.ok) {
        fetchFriendRequests();

        // Refresh contacts to include the rejected friend
        if (contactsPermissionGranted) {
          loadContactMatches();
        }

        Alert.alert("Success", "Friend request rejected.");
      } else {
        const errorData = await response.text();
        console.error(
          "Failed to reject friend request:",
          response.status,
          errorData
        );
        Alert.alert(
          "Error",
          "Failed to reject friend request. Please try again."
        );
      }
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      Alert.alert("Error", "An error occurred while rejecting friend request.");
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
    </View>
  );

  const renderSearchResultItem = ({ item }: { item: Friend }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addFriend(item.id)}
      >
        <Ionicons name="add-circle" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  const renderContactMatch = ({ item }: { item: ContactMatch }) => (
    <View style={styles.searchResultItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => addFriend(item.id)}
      >
        <Ionicons name="add-circle" size={24} color="#007AFF" />
      </TouchableOpacity>
    </View>
  );

  const renderFriendRequestItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendRequestItem}>
      <View style={styles.friendAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name?.[0] || item.username[0].toUpperCase()}
        </Text>
      </View>
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.first_name && item.last_name
            ? `${item.first_name} ${item.last_name}`
            : item.username}
        </Text>
        <Text style={styles.friendUsername}>@{item.username}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() =>
            item.friendship_id && acceptFriendRequest(item.friendship_id)
          }
        >
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() =>
            item.friendship_id && rejectFriendRequest(item.friendship_id)
          }
        >
          <Ionicons name="close-circle" size={24} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>

      <View style={styles.actionsContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for users..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={searchUsers}
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {contactsPermissionGranted === false && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={syncContacts}
            disabled={loadingContacts}
          >
            {loadingContacts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="people"
                  size={18}
                  color="#fff"
                  style={styles.syncIcon}
                />
                <Text style={styles.syncButtonText}>Sync Contacts</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {contactsPermissionGranted === true && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={refreshContacts}
            disabled={loadingContacts}
          >
            {loadingContacts ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons
                  name="refresh"
                  size={18}
                  color="#fff"
                  style={styles.syncIcon}
                />
                <Text style={styles.syncButtonText}>Refresh Contacts</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {searching && (
        <ActivityIndicator style={styles.loader} size="small" color="#007AFF" />
      )}

      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.sectionTitle}>Search Results</Text>
          <FlatList
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={(item) => `search-${item.id}`}
            style={styles.searchResultsList}
          />
        </View>
      )}

      {contactMatches.length > 0 && (
        <View style={styles.contactsContainer}>
          <Text style={styles.sectionTitle}>From Your Contacts</Text>
          <FlatList
            data={contactMatches}
            renderItem={renderContactMatch}
            keyExtractor={(item) => `contact-${item.id}`}
            style={styles.contactsList}
          />
        </View>
      )}

      {pendingRequests.length > 0 && (
        <View style={styles.requestsContainer}>
          <Text style={styles.sectionTitle}>Friend Requests</Text>
          <FlatList
            data={pendingRequests}
            renderItem={renderFriendRequestItem}
            keyExtractor={(item) => `request-${item.id}`}
            style={styles.requestsList}
          />
        </View>
      )}

      <Text style={styles.sectionTitle}>My Friends</Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />
      ) : friends.length > 0 ? (
        <FlatList
          data={friends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => `friend-${item.id}`}
          style={styles.friendsList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={60} color="#ccc" />
          <Text style={styles.emptyStateText}>
            You don't have any friends yet.
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Search for users or sync your contacts to find friends.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 10,
  },
  actionsContainer: {
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: "row",
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 15,
    backgroundColor: "white",
  },
  searchButton: {
    width: 45,
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    marginLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  syncButton: {
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  refreshButton: {
    height: 45,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 15,
  },
  syncButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  syncIcon: {
    marginRight: 8,
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  avatarText: {
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: "600",
  },
  friendUsername: {
    fontSize: 14,
    color: "#666",
  },
  loader: {
    marginVertical: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 20,
    color: "#555",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#888",
    marginTop: 10,
    textAlign: "center",
  },
  searchResultsContainer: {
    marginBottom: 20,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  addButton: {
    padding: 5,
  },
  contactsContainer: {
    marginBottom: 20,
  },
  contactsList: {
    maxHeight: 200,
  },
  loadingContactsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  loadingText: {
    marginLeft: 10,
    color: "#666",
  },
  requestsContainer: {
    marginBottom: 20,
  },
  requestsList: {
    maxHeight: 200,
  },
  friendRequestItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  requestActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  acceptButton: {
    padding: 5,
    marginRight: 10,
  },
  rejectButton: {
    padding: 5,
  },
});
