const db = require("../config/db");

async function addReview(req, res, next) {
  try {
    const { order_id, rating, comment } = req.body;
    const user_id = req.user?.id || req.body.user_id;

    if (!order_id || !user_id || !rating) {
      return res.status(400).json({
        message: "order_id, user_id, and rating are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Verify order belongs to this user and resolve restaurant_id from the order.
    const [orders] = await db.query(
      `SELECT o.id, MIN(m.restaurant_id) AS restaurant_id
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN menu m ON m.id = oi.menu_id
       WHERE o.id = ? AND o.user_id = ?
       GROUP BY o.id`,
      [order_id, user_id]
    );

    if (orders.length === 0) {
      return res.status(403).json({ message: "Order not found or does not belong to this user" });
    }

    const restaurant_id = orders[0].restaurant_id;
    if (!restaurant_id) {
      return res.status(400).json({ message: "Unable to resolve restaurant for this order" });
    }

    // Check if review already exists for this order
    const [existingReview] = await db.query(
      "SELECT id FROM reviews WHERE order_id = ? AND user_id = ?",
      [order_id, user_id]
    );

    if (existingReview.length > 0) {
      return res.status(400).json({ message: "Review already exists for this order" });
    }

    const [result] = await db.query(
      "INSERT INTO reviews (order_id, user_id, restaurant_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [order_id, user_id, restaurant_id, rating, comment || null]
    );

    res.status(201).json({
      message: "Review added successfully",
      review_id: result.insertId,
    });
  } catch (error) {
    next(error);
  }
}

async function getRestaurantReviews(req, res, next) {
  try {
    const { restaurant_id } = req.params;

    const [reviews] = await db.query(
      `SELECT 
        r.id,
        r.order_id,
        r.user_id,
        u.name AS user_name,
        r.rating,
        r.comment,
        r.created_at,
        ROUND(AVG(r.rating) OVER (PARTITION BY r.restaurant_id), 2) AS avg_rating
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.restaurant_id = ?
      ORDER BY r.created_at DESC`,
      [restaurant_id]
    );

    const avgRating = reviews.length > 0 ? reviews[0].avg_rating : null;
    const totalReviews = reviews.length;

    res.json({
      restaurant_id,
      average_rating: avgRating,
      total_reviews: totalReviews,
      reviews: reviews.map(({ avg_rating, ...rest }) => rest),
    });
  } catch (error) {
    next(error);
  }
}

async function getUserReviews(req, res, next) {
  try {
    const user_id = req.user?.id || req.params.user_id;

    const [reviews] = await db.query(
      `SELECT 
        r.id,
        r.order_id,
        r.restaurant_id,
        rest.name AS restaurant_name,
        r.rating,
        r.comment,
        r.created_at
      FROM reviews r
      JOIN restaurants rest ON rest.id = r.restaurant_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC`,
      [user_id]
    );

    res.json({
      user_id,
      review_count: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
}

async function updateReview(req, res, next) {
  try {
    const { review_id } = req.params;
    const { rating, comment } = req.body;
    const user_id = req.user?.id || req.body.user_id;

    if (!rating && !comment) {
      return res.status(400).json({ message: "rating or comment is required to update" });
    }

    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    // Verify review belongs to this user
    const [review] = await db.query(
      "SELECT user_id FROM reviews WHERE id = ?",
      [review_id]
    );

    if (review.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review[0].user_id !== user_id) {
      return res.status(403).json({ message: "You can only update your own reviews" });
    }

    const updateFields = [];
    const values = [];

    if (rating) {
      updateFields.push("rating = ?");
      values.push(rating);
    }
    if (comment !== undefined) {
      updateFields.push("comment = ?");
      values.push(comment || null);
    }

    values.push(review_id);

    await db.query(`UPDATE reviews SET ${updateFields.join(", ")} WHERE id = ?`, values);

    res.json({ message: "Review updated successfully" });
  } catch (error) {
    next(error);
  }
}

async function deleteReview(req, res, next) {
  try {
    const { review_id } = req.params;
    const user_id = req.user?.id || req.body.user_id;

    // Verify review belongs to this user
    const [review] = await db.query(
      "SELECT user_id FROM reviews WHERE id = ?",
      [review_id]
    );

    if (review.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    if (review[0].user_id !== user_id) {
      return res.status(403).json({ message: "You can only delete your own reviews" });
    }

    await db.query("DELETE FROM reviews WHERE id = ?", [review_id]);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  addReview,
  getRestaurantReviews,
  getUserReviews,
  updateReview,
  deleteReview,
};
