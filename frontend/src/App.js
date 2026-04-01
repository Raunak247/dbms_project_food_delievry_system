import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Cart from "./pages/Cart";
import Orders from "./pages/Orders";
import Reviews from "./pages/Reviews";
import Admin from "./pages/Admin";

function AppShell({ user, setUser, cartCount, liveMessage, children }) {
  const navigate = useNavigate();

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    navigate("/");
  };

  return (
    <div className="app-container">
      <header className="topbar">
        <h1>Food Ordering System</h1>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/cart">Cart ({cartCount})</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/reviews">Reviews</Link>
          <Link to="/admin">Admin</Link>
          {user ? <button onClick={logout}>Logout</button> : null}
        </nav>
      </header>
      {liveMessage ? <div className="live-banner">{liveMessage}</div> : null}
      <main>{children}</main>
    </div>
  );
}

function App() {
  const getStoredUser = () => {
    const raw = localStorage.getItem("user");
    if (!raw || raw === "undefined" || raw === "null") {
      localStorage.removeItem("user");
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem("user");
      return null;
    }
  };

  const [user, setUser] = useState(getStoredUser);
  const [cartItems, setCartItems] = useState([]);
  const [liveMessage, setLiveMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userParam = params.get("user");

    if (token && userParam) {
      try {
        const oauthUser = JSON.parse(decodeURIComponent(userParam));
        setUser(oauthUser);
        localStorage.setItem("user", JSON.stringify(oauthUser));
        localStorage.setItem("auth_token", token);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error("Failed to parse OAuth response", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;

    const socket = io(process.env.REACT_APP_API_BASE_URL || "http://localhost:5000", {
      transports: ["websocket"],
    });

    socket.emit("joinUser", user.id);

    const onOrderPlaced = (payload) => {
      if (payload.user_id !== user.id) return;
      setLiveMessage(`Order #${payload.order_id} placed successfully`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Food Ordering", {
          body: `Order #${payload.order_id} placed successfully`,
        });
      }
    };

    const onStatusUpdated = (payload) => {
      if (!payload?.order_id) return;
      setLiveMessage(`Order #${payload.order_id} status: ${payload.status}`);
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Order Update", {
          body: `Order #${payload.order_id} is now ${payload.status}`,
        });
      }
    };

    socket.on("orderPlaced", onOrderPlaced);
    socket.on("orderStatusUpdated", onStatusUpdated);

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    return () => {
      socket.off("orderPlaced", onOrderPlaced);
      socket.off("orderStatusUpdated", onStatusUpdated);
      socket.disconnect();
    };
  }, [user]);

  const cartTotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cartItems]
  );

  const addToCart = (menuItem) => {
    setCartItems((prev) => {
      const found = prev.find((i) => i.id === menuItem.id);
      if (found) {
        return prev.map((i) =>
          i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...menuItem, quantity: 1 }];
    });
  };

  const updateQty = (id, qty) => {
    setCartItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(1, qty) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCartItems([]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Login
              setUser={setUser}
              onLogin={(u, token) => {
                setUser(u);
                localStorage.setItem("user", JSON.stringify(u));
                localStorage.setItem("auth_token", token);
              }}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <AppShell user={user} setUser={setUser} cartCount={cartItems.length} liveMessage={liveMessage}>
              <Dashboard addToCart={addToCart} />
            </AppShell>
          }
        />
        <Route
          path="/cart"
          element={
            <AppShell user={user} setUser={setUser} cartCount={cartItems.length} liveMessage={liveMessage}>
              <Cart
                user={user}
                cartItems={cartItems}
                cartTotal={cartTotal}
                updateQty={updateQty}
                clearCart={clearCart}
              />
            </AppShell>
          }
        />
        <Route
          path="/orders"
          element={
            <AppShell user={user} setUser={setUser} cartCount={cartItems.length} liveMessage={liveMessage}>
              <Orders user={user} />
            </AppShell>
          }
        />
          <Route
            path="/reviews"
            element={
              <AppShell user={user} setUser={setUser} cartCount={cartItems.length} liveMessage={liveMessage}>
                <Reviews user={user} />
              </AppShell>
            }
          />
        <Route
          path="/admin"
          element={
            <AppShell user={user} setUser={setUser} cartCount={cartItems.length} liveMessage={liveMessage}>
              <Admin />
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
