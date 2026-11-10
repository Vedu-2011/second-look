/** Conservative request bound: includes reasoning in max output and both production reader attempts. */
export function requestCostBound(
  model: string,
  inputTokens: number,
  maxOutput: number,
  attempts = 1,
) {
  if (!Number.isFinite(inputTokens) || inputTokens < 0)
    throw new Error("Invalid token estimate");
  const rates =
    model === "claude-sonnet-5-5"
      ? [2, 10]
      : model === "claude-haiku-5-5"
        ? [0.1, 0.5]
        : null;
  if (!rates) throw new Error("No verified price for model");
  return (
    (attempts *
      ((Math.ceil(inputTokens * 1.1) + 4096) * rates[0] +
        maxOutput * rates[1])) /
    1e6
  );
}
export function canReserve(
  spent: number,
  inFlight: number,
  requestBound: number,
) {
  return spent + inFlight + requestBound <= 8;
}
