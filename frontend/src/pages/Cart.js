import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function Cart({ user, cartItems, cartTotal, updateQty, clearCart }) {
  const [message, setMessage] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState(null);
  const navigate = useNavigate();

  const finalTotal = promoResult ? promoResult.pricing.final_total : cartTotal;

  const applyPromo = async () => {
    if (!promoCode.trim()) {
      setMessage("Please enter a promo code.");
      return;
    }

    try {
      const { data } = await api.post("/api/promos/validate", {
        code: promoCode.trim().toUpperCase(),
        subtotal: cartTotal
      });
      setPromoResult(data);
      setMessage(`Promo applied: ${data.promo.code}`);
    } catch (error) {
      setPromoResult(null);
      setMessage(error?.response?.data?.message || "Invalid promo code");
    }
  };

  const placeOrder = async () => {
    if (!user) {
      setMessage("Please login first.");
      return;
    }

    if (cartItems.length === 0) {
      setMessage("Your cart is empty.");
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        total: finalTotal,
        promo_code: promoResult?.promo?.code,
        items: cartItems.map((item) => ({
          menu_id: item.id,
          quantity: item.quantity
        }))
      };

      await api.post("/api/orders", payload);
      clearCart();
      setPromoCode("");
      setPromoResult(null);
      setMessage("Order placed successfully.");
      setTimeout(() => navigate("/orders"), 800);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Failed to place order");
    }
  };

  return (
    <section className="panel">
      <h2>Cart</h2>
      {cartItems.length === 0 ? <p>No items added yet.</p> : null}
      {cartItems.map((item) => (
        <div className="menu-row" key={item.id}>
          <div>
            <strong>{item.item_name}</strong>
            <p>Rs. {Number(item.price).toFixed(2)}</p>
          </div>
          <div className="qty-box">
            <button onClick={() => updateQty(item.id, item.quantity - 1)}>-</button>
            <span>{item.quantity}</span>
            <button onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
          </div>
        </div>
      ))}

      <h3>Total: Rs. {cartTotal.toFixed(2)}</h3>
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Promo code"
        />
        <button type="button" onClick={applyPromo}>Apply Promo</button>
      </div>
      {promoResult ? (
        <div>
          <p>Discount: Rs. {promoResult.pricing.discount_amount.toFixed(2)}</p>
          <h3>Final Total: Rs. {finalTotal.toFixed(2)}</h3>
        </div>
      ) : null}
      <button onClick={placeOrder}>Place Order</button>
      {message ? <p className="message">{message}</p> : null}
    </section>
  );
}
