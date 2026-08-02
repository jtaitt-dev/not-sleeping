# Chopped survival model

For each active roster, the model combines current points with projected remaining points and a floor/ceiling range. The range is converted into a bounded standard deviation. Pairwise normal comparisons estimate each team's relative likelihood of finishing below every other remaining team; those raw likelihoods are normalized so the displayed last-place probabilities sum to one.

The safety line is the second-lowest projected final. Distance from safety is the user's projected final minus that line. A last-place probability of at least 30%, or a deficit greater than eight points, selects ceiling-required guidance. A probability at most 12% with an eight-point cushion selects floor-first guidance. Other cases remain balanced.

This is a decision distribution, not a guarantee. Missing projections produce a conservative warning. Nearly tied chop-zone outcomes without a supplied tiebreaker are explicitly labeled. Eliminated-team and released-player identification depends on data present in Sleeper transaction and roster payloads.
