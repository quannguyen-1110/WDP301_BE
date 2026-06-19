const Ranking = require("../models/Ranking.js");
const User = require("../models/User.js");
const Notification = require("../models/Notification.js");

// Helper: determine trend by comparing current rank to prevRank
const computeTrend = (rank, prevRank) => {
  if (prevRank === null || prevRank === undefined) return "flat";
  if (rank < prevRank) return "up";
  if (rank > prevRank) return "down";
  return "flat";
};

// GET /api/rankings?type=weekly|monthly
exports.getRankings = async (req, res) => {
  try {
    const cycle = req.query.type || "weekly";

    // Find the latest cycle start for the given period
    const latest = await Ranking.findOne({ cycle })
      .sort({ cycleStart: -1 })
      .select("cycleStart");

    if (!latest) {
      return res.json({ data: [] });
    }

    const rankings = await Ranking.find({
      cycle,
      cycleStart: latest.cycleStart,
    })
      .sort({ rank: 1 })
      .populate({
        path: "seriesId",
        select: "title mangakaId",
      });

    // Enrich response: resolve author name from mangakaId
    const data = await Promise.all(
      rankings.map(async (r) => {
        let author = "";
        if (r.seriesId && r.seriesId.mangakaId) {
          const user = await User.findById(r.seriesId.mangakaId).select("name");
          if (user) author = user.name;
        }

        return {
          id: r._id,
          rank: r.rank,
          prevRank: r.prevRank,
          title: r.seriesId ? r.seriesId.title : "Unknown",
          author,
          votes: r.votes,
          trend: r.trend,
          directive: r.directive,
        };
      }),
    );

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PUT /api/rankings/scores
// Body: { entries: [{ id, votes }] }
exports.updateScores = async (req, res) => {
  try {
    const { entries } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({
        success: false,
        message: "entries array is required",
      });
    }

    // Bulk update votes for each entry
    const updates = entries.map(({ id, votes }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { votes } },
      },
    }));

    await Ranking.bulkWrite(updates);

    // Re-sort: re-calculate rank based on votes descending
    // Find the cycle of the first entry (they should all be in same cycle)
    const firstEntry = await Ranking.findById(entries[0].id).select(
      "cycle cycleStart",
    );
    if (!firstEntry) {
      return res
        .status(404)
        .json({ success: false, message: "Entry not found" });
    }

    const allRankings = await Ranking.find({
      cycle: firstEntry.cycle,
      cycleStart: firstEntry.cycleStart,
    }).sort({ votes: -1 });

    // Assign new ranks and trends
    const bulkOps = allRankings.map((r, index) => {
      const newRank = index + 1;
      const trend = computeTrend(newRank, r.rank);
      return {
        updateOne: {
          filter: { _id: r._id },
          update: { $set: { rank: newRank, prevRank: r.rank, trend } },
        },
      };
    });

    await Ranking.bulkWrite(bulkOps);

    // Fetch updated rankings to return
    const updated = await Ranking.find({
      cycle: firstEntry.cycle,
      cycleStart: firstEntry.cycleStart,
    })
      .sort({ rank: 1 })
      .populate({ path: "seriesId", select: "title mangakaId" });

    const data = await Promise.all(
      updated.map(async (r) => {
        let author = "";
        if (r.seriesId && r.seriesId.mangakaId) {
          const user = await User.findById(r.seriesId.mangakaId).select("name");
          if (user) author = user.name;
        }
        return {
          id: r._id,
          rank: r.rank,
          prevRank: r.prevRank,
          title: r.seriesId ? r.seriesId.title : "Unknown",
          author,
          votes: r.votes,
          trend: r.trend,
          directive: r.directive,
        };
      }),
    );

    req.io.emit("rankings_updated", data);

    await sendBottom3Notifications(
      req,
      firstEntry.cycle,
      firstEntry.cycleStart,
    );

    res.json({ data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// POST /api/rankings/directive
// Body: { id, action: 'axed'|'digital', cycle }
exports.applyDirective = async (req, res) => {
  try {
    const { id, action, cycle } = req.body;

    if (!id || !action || !cycle) {
      return res.status(400).json({
        success: false,
        message: "id, action, and cycle are required",
      });
    }

    if (!["axed", "digital"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "action must be 'axed' or 'digital'",
      });
    }

    const ranking = await Ranking.findById(id).populate({
      path: "seriesId",
      select: "title mangakaId",
    });

    if (!ranking) {
      return res.status(404).json({
        success: false,
        message: "Ranking entry not found",
      });
    }

    ranking.directive = action;
    ranking.cycle = cycle;
    await ranking.save();

    let author = "";
    if (ranking.seriesId && ranking.seriesId.mangakaId) {
      const user = await User.findById(ranking.seriesId.mangakaId).select(
        "name",
      );
      if (user) author = user.name;
    }

    const result = {
      id: ranking._id,
      rank: ranking.rank,
      prevRank: ranking.prevRank,
      title: ranking.seriesId ? ranking.seriesId.title : "Unknown",
      author,
      votes: ranking.votes,
      trend: ranking.trend,
      directive: ranking.directive,
    };

    req.io.emit("directive_applied", result);

    res.json({ data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const sendBottom3Notifications = async (req, cycle, cycleStart) => {
  const totalRankings = await Ranking.countDocuments({
    cycle,
    cycleStart,
  });
  if (totalRankings > 3) {
    const bottomRank = totalRankings;
    const lastRankings = await Ranking.find({
      cycle,
      cycleStart,
    })
      .sort({ rank: -1 })
      .limit(3)
      .populate({ path: "seriesId", select: "title mangakaId" });

    for (const ranking of lastRankings) {
      if (!ranking.seriesId || !ranking.seriesId.mangakaId) continue;

      await Notification.create({
        userId: ranking.seriesId.mangakaId._id,
        title: "Your series is in the bottom 3",
        content: `Your series "${ranking.seriesId.title}" is in the bottom 3 rankings and may be axed or moved to digital.`,
        type: "WARNING",
      });

      if (req.io) {
        req.io.to(ranking.seriesId.mangakaId._id).emit("notification", {
          userId: ranking.seriesId.mangakaId._id,
          title: "Your series is in the bottom 3",
          content: `Your series "${ranking.seriesId.title}" is in the bottom 3 rankings and may be axed or moved to digital.`,
          type: "WARNING",
        });
      }
    }
  }
};
