const Vote = require("../models/Vote.js");
const Submission = require("../models/SeriesSubmission.js");
const SeriesProposal = require("../models/SeriesProposal.js");
const Series = require("../models/Series.js");
const Notification = require("../models/Notification.js");
const { logAction } = require("../utils/auditLogger");

exports.submitVote = async (req, res) => {
  try {
    const { submissionId, decision, comment } = req.body;
    if (!submissionId || !["ACCEPT", "REJECT"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "submissionId and a valid decision are required",
      });
    }

    const submissionRecord = await Submission.findById(submissionId);
    if (!submissionRecord) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }
    if (submissionRecord.decisionStatus && submissionRecord.decisionStatus !== "PENDING") {
      return res.status(409).json({
        success: false,
        message: "This submission has already been decided",
      });
    }
    const isRequiredVoter = submissionRecord.requiredVoters.some(
      (entry) => entry.userId.toString() === req.user._id.toString(),
    );
    if (!isRequiredVoter) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to vote on this submission",
      });
    }

    const vote = await Vote.create({
      submissionId,
      voterId: req.user._id,
      decision,
      comment,
    });

    // ==================== AUDIT LOG ====================
    await logAction(
      req.user._id,
      req.user.name || "Unknown",
      "Submitted Vote",
      `Submission ID: ${vote.submissionId}`,
      `Decision: ${vote.decision}, Comment: ${vote.comment || "No comment"}`,
    );

    if (req.io) req.io.emit("vote_submitted", vote);

    // Update the requiredVoters entry...
    const submission = await Submission.findOneAndUpdate(
      {
        _id: vote.submissionId,
        "requiredVoters.userId": vote.voterId,
      },
      {
        $set: {
          "requiredVoters.$.hasVoted": true,
          "requiredVoters.$.voteId": vote._id,
        },
      },
      { new: true },
    );

    if (submission) {
      const allVoted = submission.requiredVoters.every(
        (v) => v.hasVoted === true,
      );

      if (allVoted && submission.requiredVoters.length > 0) {
        const requiredIds = submission.requiredVoters.map((entry) => entry.userId);
        const allVotes = await Vote.find({
          submissionId: vote.submissionId,
          voterId: { $in: requiredIds },
        });
        const acceptCount = allVotes.filter(
          (v) => v.decision === "ACCEPT",
        ).length;
        const rejectCount = allVotes.filter(
          (v) => v.decision === "REJECT",
        ).length;

        let newStatus = acceptCount > rejectCount ? "APPROVED" : "REJECTED";

        submission.decisionStatus = newStatus;
        await submission.save();

        if (submission.decisionStatus == "APPROVED") {
          const proposal = await SeriesProposal.findById(submission.proposalId);
          if (proposal) {
            const series = await Series.findOneAndUpdate(
              { proposalId: proposal._id },
              {
                $setOnInsert: {
                  title: proposal.title,
                  synopsis: proposal.synopsis,
                  mangakaId: proposal.mangakaId,
                  editorId: submission.submittedBy,
                  status: "APPROVED",
                  proposalId: proposal._id,
                },
              },
              { new: true, upsert: true, runValidators: true },
            );
            submission.seriesId = series._id;
            await submission.save();
            proposal.status = "SERIES_CREATED";
            proposal.seriesId = series._id;
            await proposal.save();
          }
        } else {
          await SeriesProposal.findOneAndUpdate(
            {
              _id: submission.proposalId,
            },
            {
              $set: {
                status: "REJECTED",
              },
            },
            { new: true },
          );
        }

        await logAction(
          req.user._id,
          req.user.name || "Board",
          "Submission Decision Made",
          `Submission ID: ${submission._id}`,
          `Result: ${newStatus} (Accept: ${acceptCount}, Reject: ${rejectCount})`,
        );

        if (req.io) req.io.emit("submission_decided", {
          submissionId: submission._id,
          decisionStatus: newStatus,
          acceptCount,
          rejectCount,
        });

        // ===== Notify Mangaka + Update Series/Proposal status =====
        const series = await Series.findById(submission.seriesId);
        if (series) {
          if (newStatus === 'APPROVED') {
            // Update Series status to ACTIVE
            series.status = 'ACTIVE';
            await series.save();

            // Update SeriesProposal status to APPROVED
            await SeriesProposal.findOneAndUpdate(
              { title: series.title, mangakaId: series.mangakaId },
              { status: 'APPROVED' }
            );

            // Notify Mangaka
            const approveNotification = await Notification.create({
              userId: series.mangakaId,
              title: 'Series Approved by Board!',
              content: `Congratulations! Your series "${series.title}" has been approved by the Editorial Board and is now ACTIVE.`,
              type: 'INFO',
            });

            req.io.emit('notification', approveNotification);
            req.io.emit('series_approved', {
              seriesId: series._id,
              title: series.title,
              status: 'ACTIVE',
            });
          } else {
            // Update Series status to REJECTED
            series.status = 'REJECTED';
            await series.save();

            // Update SeriesProposal status to REJECTED
            await SeriesProposal.findOneAndUpdate(
              { title: series.title, mangakaId: series.mangakaId },
              { status: 'REJECTED' }
            );

            // Notify Mangaka
            const rejectNotification = await Notification.create({
              userId: series.mangakaId,
              title: 'Series Rejected by Board',
              content: `Unfortunately, your series "${series.title}" has been rejected by the Editorial Board.`,
              type: 'WARNING',
            });

            req.io.emit('notification', rejectNotification);
            req.io.emit('series_rejected', {
              seriesId: series._id,
              title: series.title,
              status: 'REJECTED',
            });
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      data: vote,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already voted on this submission",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getMyVotes = async (req, res) => {
  try {
    const votes = await Vote.find({ voterId: req.user._id });
    res.status(200).json({ success: true, data: votes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVotesBySubmission = async (req, res) => {
  try {
    const votes = await Vote.find({ submissionId: req.params.id }).populate(
      "voterId",
      "name email",
    );

    res.status(200).json({
      success: true,
      count: votes.length,
      data: votes,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateVote = async (req, res) => {
  try {
    const filter = { _id: req.params.voteId };
    if (req.user.role !== "ADMIN") filter.voterId = req.user._id;
    const vote = await Vote.findOneAndUpdate(filter, {
      decision: req.body.decision,
      comment: req.body.comment,
    }, {
      new: true,
      runValidators: true,
    });

    if (vote) {
      await logAction(
        req.user._id,
        req.user.name || "Unknown",
        "Updated Vote",
        `Vote ID: ${req.params.voteId}`,
        `New decision: ${vote.decision}`,
      );
    } else {
      return res.status(404).json({ success: false, message: "Vote not found" });
    }
    res.status(200).json({ success: true, data: vote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVote = async (req, res) => {
  try {
    const filter = { _id: req.params.voteId };
    if (req.user.role !== "ADMIN") filter.voterId = req.user._id;
    const vote = await Vote.findOneAndDelete(filter);

    if (vote) {
      await logAction(
        req.user._id,
        req.user.name || "Unknown",
        "Deleted Vote",
        `Vote ID: ${req.params.voteId}`,
        `Submission: ${vote.submissionId}`,
      );
    } else {
      return res.status(404).json({ success: false, message: "Vote not found" });
    }
    res.status(200).json({ success: true, data: vote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
