import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import axios from "axios";
import { io } from "socket.io-client";
import * as Notifications from "expo-notifications";
import { Alert } from "react-native";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:5000";

const api = axios.create({
  baseURL: API_BASE_URL
});

function AuthScreen({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async () => {
    try {
      if (isRegister) {
        await api.post("/api/auth/register", { name, email, password });
        setMessage("Registration successful. Please login.");
        setIsRegister(false);
        return;
      }

      const { data } = await api.post("/api/auth/login", { email, password });
      onLogin(data.user, data.token);
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Request failed");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{isRegister ? "Create Account" : "Login"}</Text>
      {isRegister ? (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name"
          style={styles.input}
        />
      ) : null}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        style={styles.input}
        secureTextEntry
      />
      <TouchableOpacity style={styles.primaryBtn} onPress={submit}>
        <Text style={styles.primaryBtnText}>{isRegister ? "Register" : "Login"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsRegister((prev) => !prev)}>
        <Text style={styles.linkText}>
          {isRegister ? "Already have an account? Login" : "New user? Register"}
        </Text>
      </TouchableOpacity>
      {!!message && <Text style={styles.errorText}>{message}</Text>}
    </View>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [orders, setOrders] = useState([]);
    const [userReviews, setUserReviews] = useState([]);
    const [showReviewForm, setShowReviewForm] = useState(null);
    const [reviewFormData, setReviewFormData] = useState({ rating: 5, comment: "" });
  const [message, setMessage] = useState("");

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  useEffect(() => {
    if (token) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [token]);

  useEffect(() => {
    if (!user || !token) return undefined;

    const socket = io(API_BASE_URL, { transports: ["websocket"] });
    socket.emit("joinUser", user.id);

    const onOrderPlaced = (payload) => {
      if (payload.user_id !== user.id) return;
      setMessage(`Order #${payload.order_id} placed successfully`);
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Food Ordering",
          body: `Order #${payload.order_id} placed successfully`
        },
        trigger: null
      }).catch(() => {
        Alert.alert("Food Ordering", `Order #${payload.order_id} placed successfully`);
      });
    };

    const onStatusUpdated = (payload) => {
      setMessage(`Order #${payload.order_id} status: ${payload.status}`);
      Notifications.scheduleNotificationAsync({
        content: {
          title: "Order Update",
          body: `Order #${payload.order_id} is now ${payload.status}`
        },
        trigger: null
      }).catch(() => {
        Alert.alert("Order Update", `Order #${payload.order_id} is now ${payload.status}`);
      });
    };

    socket.on("orderPlaced", onOrderPlaced);
    socket.on("orderStatusUpdated", onStatusUpdated);

    return () => {
      socket.off("orderPlaced", onOrderPlaced);
      socket.off("orderStatusUpdated", onStatusUpdated);
      socket.disconnect();
    };
  }, [user, token]);

  useEffect(() => {
    if (!user) return;

    api.get("/api/restaurants").then((res) => {
      setRestaurants(res.data);
      if (res.data.length > 0) setSelectedRestaurantId(res.data[0].id);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedRestaurantId) return;

    api.get(`/api/restaurants/${selectedRestaurantId}/menu`).then((res) => {
      setMenu(res.data);
    });
  }, [selectedRestaurantId]);

  useEffect(() => {
    if (!user) return;
    api.get(`/api/orders/user/${user.id}`).then((res) => setOrders(res.data));
  }, [user, tab]);

    useEffect(() => {
      if (!user) return;
      api.get(`/api/reviews/user/${user.id}`).then((res) => {
        setUserReviews(res.data.reviews || []);
      });
    }, [user, tab]);

  const addToCart = (item) => {
    setCartItems((prev) => {
      const found = prev.find((p) => p.id === item.id);
      if (found) {
        return prev.map((p) => (p.id === item.id ? { ...p, quantity: p.quantity + 1 } : p));
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setMessage("Added to cart");
  };

  const updateQty = (id, nextQty) => {
    if (nextQty <= 0) {
      setCartItems((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    setCartItems((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: nextQty } : p)));
  };

  const placeOrder = async () => {
    if (cartItems.length === 0 || !user) {
      setMessage("Cart is empty");
      return;
    }

    try {
      await api.post("/api/orders", {
        user_id: user.id,
        total: cartTotal,
        items: cartItems.map((item) => ({
          menu_id: item.id,
          quantity: item.quantity
        }))
      });
      setCartItems([]);
      setMessage("Order placed successfully");
      setTab("orders");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Order failed");
    }
  };

    const submitReview = async (orderId, restaurantId) => {
      try {
        await api.post("/api/reviews", {
          order_id: orderId,
          user_id: user.id,
          restaurant_id: restaurantId,
          rating: reviewFormData.rating,
          comment: reviewFormData.comment
        });
        setMessage("Review submitted successfully!");
        setShowReviewForm(null);
        setReviewFormData({ rating: 5, comment: "" });
        api.get(`/api/reviews/user/${user.id}`).then((res) => {
          setUserReviews(res.data.reviews || []);
        });
      } catch (error) {
        setMessage(error?.response?.data?.message || "Review submission failed");
      }
    };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.centerWrap}>
          <AuthScreen
            onLogin={(nextUser, nextToken) => {
              setUser(nextUser);
              setToken(nextToken || "");
            }}
          />
        </ScrollView>
        <StatusBar style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Food Ordering Mobile</Text>
        <Text style={styles.headerSub}>Welcome, {user.name}</Text>
      </View>

      <View style={styles.tabs}>
        {[
          ["dashboard", "Dashboard"],
          ["cart", `Cart (${cartItems.length})`],
            ["orders", "Orders"],
            ["reviews", "Reviews"]
        ].map(([value, label]) => (
          <TouchableOpacity
            key={value}
            onPress={() => setTab(value)}
            style={[styles.tabBtn, tab === value && styles.tabBtnActive]}
          >
            <Text style={[styles.tabBtnText, tab === value && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollPad}>
        {tab === "dashboard" ? (
          <View>
            <Text style={styles.sectionTitle}>Restaurants</Text>
            <View style={styles.restaurantList}>
              {restaurants.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  onPress={() => setSelectedRestaurantId(r.id)}
                  style={[
                    styles.chip,
                    selectedRestaurantId === r.id ? styles.chipActive : null
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedRestaurantId === r.id ? styles.chipTextActive : null
                    ]}
                  >
                    {r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Menu</Text>
            {menu.map((item) => (
              <View key={item.id} style={styles.rowCard}>
                <View>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemSub}>Rs. {Number(item.price).toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.smallBtn} onPress={() => addToCart(item)}>
                  <Text style={styles.smallBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {tab === "cart" ? (
          <View>
            <Text style={styles.sectionTitle}>Cart</Text>
            {cartItems.length === 0 ? <Text>No items in cart.</Text> : null}
            {cartItems.map((item) => (
              <View key={item.id} style={styles.rowCard}>
                <View>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemSub}>Rs. {Number(item.price).toFixed(2)}</Text>
                </View>
                <View style={styles.qtyWrap}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item.id, item.quantity - 1)}
                  >
                    <Text>-</Text>
                  </TouchableOpacity>
                  <Text>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQty(item.id, item.quantity + 1)}
                  >
                    <Text>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.total}>Total: Rs. {cartTotal.toFixed(2)}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={placeOrder}>
              <Text style={styles.primaryBtnText}>Place Order</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {tab === "orders" ? (
          <View>
            <Text style={styles.sectionTitle}>Your Orders</Text>
            {orders.length === 0 ? <Text>No orders found.</Text> : null}
            {orders.map((order) => (
              <View key={order.id} style={styles.rowCard}>
                <Text style={styles.itemName}>Order #{order.id}</Text>
                <Text>Status: {order.status}</Text>
                <Text>Total: Rs. {Number(order.total).toFixed(2)}</Text>
                {order.items.map((item) => (
                  <Text key={`${order.id}-${item.menu_id}`}>
                    {item.item_name} x {item.quantity}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

          {tab === "reviews" ? (
            <View>
              <Text style={styles.sectionTitle}>Your Reviews ({userReviews.length})</Text>
              {userReviews.length === 0 ? <Text>No reviews yet.</Text> : null}
              {userReviews.map((review) => (
                <View key={review.id} style={styles.rowCard}>
                  <Text style={styles.itemName}>{review.restaurant_name}</Text>
                  <Text>Rating: {"⭐".repeat(review.rating)} ({review.rating}/5)</Text>
                  {review.comment ? <Text>{review.comment}</Text> : null}
                </View>
              ))}

              <Text style={styles.sectionTitle}>Add Review</Text>
              {orders.filter((o) => !userReviews.some((r) => r.order_id === o.id)).length === 0 ? (
                <Text>All orders reviewed!</Text>
              ) : (
                orders
                  .filter((o) => !userReviews.some((r) => r.order_id === o.id))
                  .map((order) => (
                    <View key={order.id} style={styles.rowCard}>
                      <Text style={styles.itemName}>Order #{order.id}</Text>
                      <Text>Total: Rs. {Number(order.total).toFixed(2)}</Text>
                      {showReviewForm === order.id ? (
                        <View>
                          <Text>Rating: {reviewFormData.rating}/5</Text>
                          <View style={styles.ratingRow}>
                            {[1, 2, 3, 4, 5].map((r) => (
                              <TouchableOpacity
                                key={r}
                                onPress={() => setReviewFormData({ ...reviewFormData, rating: r })}
                                style={[styles.ratingBtn, reviewFormData.rating === r && styles.ratingBtnActive]}
                              >
                                <Text>{"⭐".repeat(r)}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                          <TextInput
                            value={reviewFormData.comment}
                            onChangeText={(text) => setReviewFormData({ ...reviewFormData, comment: text })}
                            placeholder="Add a comment..."
                            style={styles.input}
                            multiline
                          />
                          <TouchableOpacity
                            style={styles.primaryBtn}
                            onPress={() => submitReview(order.id, order.restaurant_id || 1)}
                          >
                            <Text style={styles.primaryBtnText}>Submit Review</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.secondaryBtn}
                            onPress={() => { setShowReviewForm(null); setReviewFormData({ rating: 5, comment: "" }); }}
                          >
                            <Text style={styles.secondaryBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.smallBtn}
                          onPress={() => setShowReviewForm(order.id)}
                        >
                          <Text style={styles.smallBtnText}>Add Review</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
              )}
            </View>
          ) : null}

        {!!message ? <Text style={styles.infoText}>{message}</Text> : null}
      </ScrollView>

      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f6fb"
  },
  centerWrap: {
    minHeight: "100%",
    justifyContent: "center",
    padding: 16
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    gap: 12
  },
  title: {
    fontSize: 22,
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "#cdd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff"
  },
  primaryBtn: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700"
  },
  linkText: {
    color: "#0f766e",
    fontWeight: "600"
  },
  errorText: {
    color: "#dc2626"
  },
  header: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700"
  },
  headerSub: {
    color: "#ccfbf1"
  },
  tabs: {
    flexDirection: "row",
    padding: 8,
    gap: 8,
    backgroundColor: "#fff"
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#eef2ff"
  },
  tabBtnActive: {
    backgroundColor: "#0f766e"
  },
  tabBtnText: {
    color: "#0f172a",
    fontWeight: "600"
  },
  tabBtnTextActive: {
    color: "#fff"
  },
  scrollPad: {
    padding: 12,
    paddingBottom: 24
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8
  },
  restaurantList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e"
  },
  chipText: {
    color: "#0f172a"
  },
  chipTextActive: {
    color: "#fff"
  },
  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 6
  },
  itemName: {
    fontWeight: "700"
  },
  itemSub: {
    color: "#64748b"
  },
  smallBtn: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  smallBtnText: {
    color: "#fff",
    fontWeight: "700"
  },
  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center"
  },
  total: {
    fontWeight: "700",
    marginVertical: 8
  },
  infoText: {
    marginTop: 6,
    color: "#0f766e",
    fontWeight: "600"
  },
  ratingRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 8,
    justifyContent: "space-around"
  },
  ratingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f1f5f9"
  },
  ratingBtnActive: {
    backgroundColor: "#fef3c7",
    borderColor: "#fbbf24"
  },
  secondaryBtn: {
    marginTop: 8,
    backgroundColor: "#94a3b8",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center"
  },
  secondaryBtnText: {
    color: "#fff",
    fontWeight: "700"
  }
});
