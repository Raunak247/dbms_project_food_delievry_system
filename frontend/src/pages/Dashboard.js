import { useEffect, useState } from "react";
import api from "../api";

export default function Dashboard({ addToCart }) {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(null);
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    api.get("/api/restaurants").then((res) => {
      setRestaurants(res.data);
      if (res.data.length > 0) {
        setSelectedRestaurantId(res.data[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) return;
    api
      .get(`/api/restaurants/${selectedRestaurantId}/menu`)
      .then((res) => setMenu(res.data));
  }, [selectedRestaurantId]);

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Restaurants</h2>
        {restaurants.map((r) => (
          <button
            key={r.id}
            className={`list-btn ${selectedRestaurantId === r.id ? "active" : ""}`}
            onClick={() => setSelectedRestaurantId(r.id)}
          >
            {r.name}
          </button>
        ))}
      </section>

      <section className="panel">
        <h2>Menu</h2>
        {menu.map((item) => (
          <div className="menu-row" key={item.id}>
            <div>
              <strong>{item.item_name}</strong>
              <p>Rs. {Number(item.price).toFixed(2)}</p>
            </div>
            <button onClick={() => addToCart(item)}>Add</button>
          </div>
        ))}
      </section>
    </div>
  );
}
