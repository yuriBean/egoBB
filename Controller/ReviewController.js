import ReviewModel from "../Models/ReviewsModel.js";
import Spin from "../Models/spunUser.js";
import { subDays } from "date-fns";
import mongoose from "mongoose";

export const getReviews = async (req, res) => {
  const { userId } = req.params;
  const days = parseInt(req.query.days, 10) || 10; // Default to 10 days if not provided

  try {
    // Get the date range for the specified number of days
    const startDate = subDays(new Date(), days);

    // Get reviews for the user from the specified date range
    const reviews = await ReviewModel.aggregate([
      {
        $match: {
          ownerId: new mongoose.Types.ObjectId(userId),
          reviewDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$reviewDate" } },
          totalReviews: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Prepare the data for the graph
    const labels = reviews.map((review) => review._id);
    const values = reviews.map((review) => review.totalReviews);

    res.json({
      labels, // Date labels for the graph
      values, // Total reviews count per day
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};


export const postReview = async (req, res) => {
    try {
        const data = await ReviewModel.create(req.body);
        res.status(200).json(data);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
}

export const checkUserSpin = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: `L'e-mail est requis`});
  }

  try {
    let spin = await Spin.findOne({ email });
    console.log(spin);

    const currentTime = Date.now();
    const sixtyDaysInMillis = 60 * 24 * 60 * 60 * 1000;

    if (spin) {
      if (currentTime > spin.expiryDate) {
        // Expiry date has passed, allow spin and reset expiry date
        spin.hasSpun = false;
        spin.expiryDate = currentTime + sixtyDaysInMillis;
      } else if (spin.hasSpun) {
        // Expiry date is still valid and user has already spun
        return res.status(400).json({ message: 'Le courrier électronique a déjà été utilisé pour faire tourner la roue au cours des 60 derniers jours.' });
      }
    } else {
      // No spin record found, create a new one
      spin = new Spin({ email, hasSpun: true, expiryDate: currentTime + sixtyDaysInMillis });
      await spin.save();
    }

    // If spin record was found and hasSpun is now false, allow spinning again
    if (spin && !spin.hasSpun) {
      spin.hasSpun = true;
      await spin.save();
    }

    res.json({ message: 'Spin registered.' });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

