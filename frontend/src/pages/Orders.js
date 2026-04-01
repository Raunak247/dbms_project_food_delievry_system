import { useEffect, useState } from "react";
import api from "../api";

export default function Orders({ user }) {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!user) return;
    api.get(`/api/orders/user/${user.id}`).then((res) => setOrders(res.data));
  }, [user]);

  if (!user) {
    return (
      <section className="panel">
        <h2>Orders</h2>
        <p>Please login to view your orders.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Your Orders</h2>
      {orders.length === 0 ? <p>No orders found.</p> : null}
      {orders.map((order) => (
        <div key={order.id} className="order-card">
          <h3>Order #{order.id}</h3>
          <p>Status: {order.status}</p>
          <p>Total: Rs. {Number(order.total).toFixed(2)}</p>
          {order.items.map((item) => (
            <p key={`${order.id}-${item.menu_id}`}>
              {item.item_name} x {item.quantity}
            </p>
          ))}
        </div>
      ))}
    </section>
  );
}
