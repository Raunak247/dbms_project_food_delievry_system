import { useEffect, useState } from "react";
import api from "../api";

export default function Admin() {
  const [summary, setSummary] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get("/api/orders/summary").then((res) => setSummary(res.data));
    api.get("/api/orders/analytics/top-users").then((res) => setTopUsers(res.data));
    api.get("/api/orders/recovery/logs").then((res) => setLogs(res.data));
  }, []);

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Top Users (Nested Query)</h2>
        {topUsers.length === 0 ? <p>No analytics yet.</p> : null}
        {topUsers.map((u) => (
          <div key={u.id} className="order-card">
            <strong>{u.name}</strong>
            <p>{u.email}</p>
            <p>Orders: {u.total_orders}</p>
            <p>Total Spent: Rs. {Number(u.total_spent).toFixed(2)}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Order Summary (View)</h2>
        {summary.length === 0 ? <p>No orders found.</p> : null}
        {summary.slice(0, 10).map((row) => (
          <div key={row.order_id} className="order-card">
            <strong>Order #{row.order_id}</strong>
            <p>User: {row.user_name}</p>
            <p>Status: {row.status}</p>
            <p>Line Items: {row.line_items}</p>
            <p>Total Qty: {row.total_quantity}</p>
            <p>Total: Rs. {Number(row.total).toFixed(2)}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Recovery Logs</h2>
        {logs.length === 0 ? <p>No logs yet.</p> : null}
        {logs.slice(0, 10).map((log) => (
          <div key={log.id} className="order-card">
            <strong>{log.event_type}</strong>
            <p>Order ID: {log.order_id || "N/A"}</p>
            <p>{new Date(log.created_at).toLocaleString()}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
