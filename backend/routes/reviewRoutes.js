const express = require("express");
const {
  addReview,
  getRestaurantReviews,
  getUserReviews,
  updateReview,
  deleteReview,
} = require("../controllers/reviewController");

const router = express.Router();

// POST - Add a new review
router.post("/", addReview);

// GET - Get all reviews for a restaurant
router.get("/restaurant/:restaurant_id", getRestaurantReviews);

// GET - Get all reviews by a user
router.get("/user/:user_id", getUserReviews);

// PUT - Update a review
router.put("/:review_id", updateReview);

// DELETE - Delete a review
router.delete("/:review_id", deleteReview);

module.exports = router;
