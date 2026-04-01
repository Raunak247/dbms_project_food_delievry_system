import { useEffect, useState } from "react";
import api from "../api";

export default function Reviews({ user }) {
  const [orders, setOrders] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [showReviewForm, setShowReviewForm] = useState(null);
  const [formData, setFormData] = useState({ rating: 5, comment: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    fetchUserReviews();
  }, [user]);

  async function fetchOrders() {
    try {
      const res = await api.get(`/api/orders/user/${user.id}`);
      setOrders(res.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  }

  async function fetchUserReviews() {
    try {
      const res = await api.get(`/api/reviews/user/${user.id}`);
      setUserReviews(res.data.reviews || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  }

  async function handleSubmitReview(orderId) {
    if (!formData.rating) {
      setMessage("Please select a rating");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await api.post("/api/reviews", {
        order_id: orderId,
        user_id: user.id,
        rating: formData.rating,
        comment: formData.comment,
      });

      setMessage("Review submitted successfully!");
      setShowReviewForm(null);
      setFormData({ rating: 5, comment: "" });
      fetchUserReviews();
      fetchOrders();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Error submitting review"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteReview(reviewId) {
    if (!window.confirm("Are you sure you want to delete this review?")) return;

    try {
      await api.delete(`/api/reviews/${reviewId}`, {
        data: { user_id: user.id },
      });

      setMessage("Review deleted successfully!");
      fetchUserReviews();
      fetchOrders();
    } catch (error) {
      setMessage(error.response?.data?.message || "Error deleting review");
    }
  }

  if (!user) {
    return (
      <section className="panel">
        <h2>Reviews</h2>
        <p>Please login to view and submit reviews.</p>
      </section>
    );
  }

  const ordersWithoutReviews = orders.filter(
    (order) => !userReviews.some((review) => review.order_id === order.id)
  );

  return (
    <section className="panel">
      <h2>Reviews & Ratings</h2>

      {message && (
        <div
          style={{
            padding: "10px",
            marginBottom: "15px",
            backgroundColor: message.includes("Error") ? "#ffcccc" : "#ccffcc",
            borderRadius: "4px",
          }}
        >
          {message}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <h3>Your Reviews ({userReviews.length})</h3>
        {userReviews.length === 0 ? (
          <p>No reviews yet.</p>
        ) : (
          userReviews.map((review) => (
            <div
              key={review.id}
              style={{
                border: "1px solid #ddd",
                padding: "10px",
                marginBottom: "10px",
                borderRadius: "4px",
              }}
            >
              <p>
                <strong>{review.restaurant_name}</strong> - Order #{review.order_id}
              </p>
              <p>Rating: {"⭐".repeat(review.rating)} ({review.rating}/5)</p>
              {review.comment && <p>Comment: {review.comment}</p>}
              <p style={{ fontSize: "12px", color: "#666" }}>
                {new Date(review.created_at).toLocaleDateString()}
              </p>
              <button
                onClick={() => handleDeleteReview(review.id)}
                style={{
                  backgroundColor: "#ff6666",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Delete Review
              </button>
            </div>
          ))
        )}
      </div>

      <div>
        <h3>Add Review ({ordersWithoutReviews.length} orders pending review)</h3>
        {ordersWithoutReviews.length === 0 ? (
          <p>All your orders have been reviewed!</p>
        ) : (
          ordersWithoutReviews.map((order) => (
            <div
              key={order.id}
              style={{
                border: "1px solid #ddd",
                padding: "10px",
                marginBottom: "15px",
                borderRadius: "4px",
              }}
            >
              <p>
                <strong>Order #{order.id}</strong> - Total: Rs. {Number(order.total).toFixed(2)}
              </p>
              {order.items && (
                <p style={{ fontSize: "12px" }}>
                  {order.items.map((item) => `${item.item_name} x${item.quantity}`).join(", ")}
                </p>
              )}

              {showReviewForm === order.id ? (
                <div style={{ marginTop: "10px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <label>
                      Rating:
                      <select
                        value={formData.rating}
                        onChange={(e) =>
                          setFormData({ ...formData, rating: Number(e.target.value) })
                        }
                        style={{ marginLeft: "10px" }}
                      >
                        <option value={5}>5 Stars ⭐⭐⭐⭐⭐</option>
                        <option value={4}>4 Stars ⭐⭐⭐⭐</option>
                        <option value={3}>3 Stars ⭐⭐⭐</option>
                        <option value={2}>2 Stars ⭐⭐</option>
                        <option value={1}>1 Star ⭐</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ marginBottom: "10px" }}>
                    <label>
                      Comment:
                      <textarea
                        value={formData.comment}
                        onChange={(e) =>
                          setFormData({ ...formData, comment: e.target.value })
                        }
                        style={{
                          width: "100%",
                          height: "80px",
                          marginTop: "5px",
                          padding: "8px",
                          fontFamily: "Arial, sans-serif",
                        }}
                        placeholder="Share your experience..."
                      />
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <button
                      onClick={() => handleSubmitReview(order.id)}
                      disabled={loading}
                      style={{
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        padding: "8px 15px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      {loading ? "Submitting..." : "Submit Review"}
                    </button>
                    <button
                      onClick={() => setShowReviewForm(null)}
                      style={{
                        backgroundColor: "#999",
                        color: "white",
                        border: "none",
                        padding: "8px 15px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowReviewForm(order.id)}
                  style={{
                    backgroundColor: "#0066cc",
                    color: "white",
                    border: "none",
                    padding: "8px 15px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Add Review
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
