import Vote from "../models/vote.model.js";

export const submitVote = async (req, res) => {
  const vote = await Vote.create(req.body);
  req.io.emit("vote_submitted", vote);
  res.json(vote);
};

export const getMyVotes = async (req, res) => {
  const votes = await Vote.find({ userId: req.query.userId });
  res.json(votes);
};